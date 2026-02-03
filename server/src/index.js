import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Database setup
const dbPath = join(__dirname, '..', 'tasks.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    project TEXT,
    status TEXT DEFAULT 'pending',
    output TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME
  )
`);

app.use(cors());
app.use(express.json());

// Serve static files from web build (production)
const webBuildPath = join(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(webBuildPath)) {
  app.use(express.static(webBuildPath));
}

// API Routes

// Get all tasks
app.get('/api/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  res.json(tasks);
});

// Get single task
app.get('/api/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// Create new task
app.post('/api/tasks', (req, res) => {
  const { title, prompt, project } = req.body;
  if (!title || !prompt) {
    return res.status(400).json({ error: 'Title and prompt required' });
  }

  const id = uuidv4();
  db.prepare('INSERT INTO tasks (id, title, prompt, project) VALUES (?, ?, ?, ?)')
    .run(id, title, prompt, project || null);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json(task);

  // Trigger processing
  processNextTask();
});

// Cancel/delete task
app.delete('/api/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (task.status === 'running') {
    return res.status(400).json({ error: 'Cannot delete running task' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Get server status
app.get('/api/status', (req, res) => {
  const pending = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?').get('pending');
  const running = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?').get('running');
  const completed = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?').get('completed');
  const failed = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?').get('failed');

  res.json({
    status: 'online',
    queue: {
      pending: pending.count,
      running: running.count,
      completed: completed.count,
      failed: failed.count
    }
  });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  if (fs.existsSync(webBuildPath)) {
    res.sendFile(join(webBuildPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Web UI not built. Run npm run build:web' });
  }
});

// Task processing
let isProcessing = false;

async function processNextTask() {
  if (isProcessing) return;

  const task = db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at ASC LIMIT 1').get('pending');
  if (!task) return;

  isProcessing = true;

  // Mark as running
  db.prepare('UPDATE tasks SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('running', task.id);

  console.log(`[RUNNER] Starting task: ${task.title}`);

  try {
    const output = await runClaude(task.prompt, task.project);

    db.prepare('UPDATE tasks SET status = ?, output = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('completed', output, task.id);

    console.log(`[RUNNER] Completed task: ${task.title}`);
  } catch (error) {
    db.prepare('UPDATE tasks SET status = ?, output = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('failed', error.message, task.id);

    console.error(`[RUNNER] Failed task: ${task.title}`, error.message);
  }

  isProcessing = false;

  // Check for more tasks
  processNextTask();
}

function runClaude(prompt, project) {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--output-format', 'text'];

    // Add allowed tools
    args.push('--allowedTools', 'Read,Edit,Write,Bash,Glob,Grep,WebFetch,WebSearch');

    const options = {
      cwd: project ? `/mnt/c/Users/NathanvanWingerden/${project}` : process.cwd(),
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024 // 10MB
    };

    console.log(`[CLAUDE] Running: claude ${args.slice(0, 2).join(' ')}...`);

    const child = spawn('claude', args, options);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout || 'Task completed successfully');
      } else {
        reject(new Error(stderr || `Claude exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start Claude: ${err.message}`));
    });

    // Timeout after 30 minutes
    setTimeout(() => {
      child.kill();
      reject(new Error('Task timed out after 30 minutes'));
    }, 30 * 60 * 1000);
  });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║           CLAUDE REMOTE - Server Running               ║
╠════════════════════════════════════════════════════════╣
║  API:     http://localhost:${PORT}/api                   ║
║  Web UI:  http://localhost:${PORT}                       ║
╚════════════════════════════════════════════════════════╝
  `);

  // Process any pending tasks on startup
  processNextTask();
});
