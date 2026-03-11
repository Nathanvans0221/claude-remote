import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const PASSWORD = process.env.CLAUDE_REMOTE_PASSWORD || 'clauderemote';
const PROJECTS_DIR = process.env.PROJECTS_DIR || '/mnt/c/Users/NathanvanWingerden';
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const TASK_TIMEOUT = 30 * 60 * 1000;

// ─── Projects ────────────────────────────────────────────
const KNOWN_PROJECTS = [
  { name: 'action-center', path: `${PROJECTS_DIR}/action-center`, deploy: 'Vercel' },
  { name: 'helm-dashboard', path: `${PROJECTS_DIR}/helm-dashboard`, deploy: 'Vercel' },
  { name: 'berean', path: `${PROJECTS_DIR}/berean`, deploy: 'Vercel' },
  { name: 'boutique-site', path: `${PROJECTS_DIR}/boutique-site`, deploy: 'Vercel' },
  { name: 'greenhouse-scout', path: `${PROJECTS_DIR}/greenhouse-scout`, deploy: 'Vercel' },
  { name: 'meta-glasses-companion', path: `${PROJECTS_DIR}/meta-glasses-companion`, deploy: 'EAS' },
  { name: 'blln-automation', path: `${PROJECTS_DIR}/blln-automation`, deploy: 'TBD' },
  { name: 'claude-remote', path: `${PROJECTS_DIR}/claude-remote`, deploy: 'VM' },
  { name: 'sf-ai-helm-mcp', path: `${PROJECTS_DIR}/sf-ai-helm-mcp`, deploy: 'npm' },
  { name: 'sf-ai-atlas-mcp', path: `${PROJECTS_DIR}/sf-ai-atlas-mcp`, deploy: 'npm' },
];

// ─── Database ────────────────────────────────────────────
const DB_PATH = path.join(__dirname, '..', 'data', 'claude-remote.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    project TEXT,
    project_path TEXT,
    claude_session_id TEXT,
    status TEXT DEFAULT 'idle',
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
`);

// Reset stuck sessions on startup
db.prepare("UPDATE sessions SET status = 'idle' WHERE status = 'running'").run();

// ─── Auth ────────────────────────────────────────────────
const activeTokens = new Set();

function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.add(token);
  return token;
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── Express ─────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Auth endpoint (public)
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (!PASSWORD) return res.status(500).json({ error: 'No password configured' });
  if (password !== PASSWORD) return res.status(401).json({ error: 'Invalid password' });
  res.json({ token: generateToken() });
});

// All other /api routes require auth
app.use('/api', authMiddleware);

// Projects
app.get('/api/projects', (_req, res) => {
  const projects = KNOWN_PROJECTS.filter(p => {
    try { return fs.existsSync(p.path); } catch { return false; }
  }).map(p => ({
    ...p,
    hasClaude: fs.existsSync(path.join(p.path, 'CLAUDE.md')),
  }));
  res.json(projects);
});

// Sessions CRUD
app.get('/api/sessions', (_req, res) => {
  const sessions = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count,
      (SELECT content FROM messages WHERE session_id = s.id AND role = 'user'
       ORDER BY created_at DESC LIMIT 1) as last_message
    FROM sessions s ORDER BY s.updated_at DESC
  `).all();
  res.json(sessions);
});

app.post('/api/sessions', (req, res) => {
  const { title, project } = req.body;
  const id = uuid();
  const proj = KNOWN_PROJECTS.find(p => p.name === project);
  db.prepare('INSERT INTO sessions (id, title, project, project_path) VALUES (?, ?, ?, ?)').run(
    id, title || 'New Session', project || null, proj?.path || PROJECTS_DIR
  );
  res.json(db.prepare('SELECT * FROM sessions WHERE id = ?').get(id));
});

app.get('/api/sessions/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  const messages = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);
  res.json({ ...session, messages });
});

app.delete('/api/sessions/:id', (req, res) => {
  const child = runningProcesses.get(req.params.id);
  if (child) { child.kill('SIGTERM'); runningProcesses.delete(req.params.id); }
  db.prepare('DELETE FROM messages WHERE session_id = ?').run(req.params.id);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Messages
app.post('/api/sessions/:id/messages', (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Empty message' });
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  if (session.status === 'running') return res.status(409).json({ error: 'Session is busy' });

  const msgId = uuid();
  db.prepare('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)').run(
    msgId, req.params.id, 'user', content.trim()
  );
  db.prepare("UPDATE sessions SET status = 'running', updated_at = datetime('now') WHERE id = ?")
    .run(req.params.id);

  processMessage(req.params.id, content.trim(), session.claude_session_id, session.project_path || PROJECTS_DIR);
  res.json({ messageId: msgId, status: 'processing' });
});

// Reset stuck session
app.post('/api/sessions/:id/reset', (req, res) => {
  const child = runningProcesses.get(req.params.id);
  if (child) { child.kill('SIGTERM'); runningProcesses.delete(req.params.id); }
  db.prepare("UPDATE sessions SET status = 'idle', updated_at = datetime('now') WHERE id = ?")
    .run(req.params.id);
  res.json({ ok: true });
});

// Status
app.get('/api/status', (_req, res) => {
  res.json({
    status: 'online',
    totalSessions: db.prepare('SELECT COUNT(*) as c FROM sessions').get().c,
    runningSessions: db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status = 'running'").get().c,
    totalMessages: db.prepare('SELECT COUNT(*) as c FROM messages').get().c,
    uptime: process.uptime(),
  });
});

// Serve web build (production)
const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
}
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
    if (fs.existsSync(webDist)) {
      res.sendFile(path.join(webDist, 'index.html'));
    } else {
      res.status(404).json({ error: 'Web UI not built. Run: npm run build:web' });
    }
  }
});

// ─── HTTP + WebSocket ────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const token = url.searchParams.get('token');
  if (!token || !activeTokens.has(token)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
    ws.close();
    return;
  }
  clients.set(ws, { token, subscribedSession: null });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'subscribe' && msg.sessionId) {
        clients.get(ws).subscribedSession = msg.sessionId;
      }
    } catch {}
  });
  ws.on('close', () => clients.delete(ws));
  ws.send(JSON.stringify({ type: 'connected' }));
});

function broadcast(sessionId, event) {
  const data = JSON.stringify(event);
  for (const [ws, client] of clients) {
    if (ws.readyState === 1 && (!client.subscribedSession || client.subscribedSession === sessionId)) {
      ws.send(data);
    }
  }
}

// ─── Claude Runner ───────────────────────────────────────
const runningProcesses = new Map();

function processMessage(sessionId, prompt, existingClaudeSessionId, projectPath) {
  const args = ['-p', prompt, '--output-format', 'stream-json'];
  if (existingClaudeSessionId) {
    args.push('--resume', existingClaudeSessionId);
  }
  args.push('--allowedTools',
    'Read,Edit,Write,Bash,Glob,Grep,WebFetch,WebSearch,Agent,TodoRead,TodoWrite'
  );

  const cwd = projectPath || PROJECTS_DIR;
  console.log(`[CLAUDE] Session ${sessionId} | CWD: ${cwd}`);

  const child = spawn(CLAUDE_BIN, args, {
    cwd,
    env: { ...process.env },
    maxBuffer: 50 * 1024 * 1024,
  });
  runningProcesses.set(sessionId, child);

  let fullOutput = '';
  let claudeSessionId = existingClaudeSessionId;
  let buffer = '';
  let costUsd = 0;

  child.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.session_id) claudeSessionId = event.session_id;

        // Text content
        if (event.type === 'assistant' && event.subtype === 'text') {
          const text = event.content_block?.text || '';
          if (text) {
            fullOutput += text;
            broadcast(sessionId, { type: 'stream', sessionId, content: text });
          }
        }

        // Tool use
        if (event.type === 'assistant' && event.subtype === 'tool_use') {
          const name = event.content_block?.name || 'unknown';
          broadcast(sessionId, { type: 'tool_use', sessionId, tool: name });
        }

        // Result
        if (event.type === 'result') {
          if (event.session_id) claudeSessionId = event.session_id;
          if (event.result && !fullOutput) fullOutput = event.result;
          if (event.cost_usd) costUsd = event.cost_usd;
        }
      } catch {
        // Non-JSON output — stream as raw text
        fullOutput += line + '\n';
        broadcast(sessionId, { type: 'stream', sessionId, content: line + '\n' });
      }
    }
  });

  child.stderr.on('data', (data) => {
    console.error(`[CLAUDE STDERR] ${data.toString()}`);
  });

  child.on('close', (code) => {
    runningProcesses.delete(sessionId);

    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer);
        if (event.session_id) claudeSessionId = event.session_id;
        if (event.type === 'result' && event.result && !fullOutput) fullOutput = event.result;
      } catch {
        fullOutput += buffer;
      }
    }

    const output = fullOutput.trim() ||
      (code === 0 ? 'Task completed successfully.' : `Process exited with code ${code}`);

    const msgId = uuid();
    db.prepare('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)').run(
      msgId, sessionId, 'assistant', output
    );
    db.prepare(`
      UPDATE sessions SET status = 'idle',
        claude_session_id = COALESCE(?, claude_session_id),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(claudeSessionId, sessionId);

    broadcast(sessionId, {
      type: 'complete', sessionId, messageId: msgId,
      content: output, exitCode: code, costUsd,
    });
    console.log(`[CLAUDE] Session ${sessionId} done (exit ${code}, $${costUsd.toFixed(4)})`);
  });

  const timeout = setTimeout(() => {
    if (runningProcesses.has(sessionId)) {
      child.kill('SIGTERM');
      setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 5000);
    }
  }, TASK_TIMEOUT);
  child.on('close', () => clearTimeout(timeout));
}

// ─── Start ───────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Claude Remote v2.0`);
  console.log(`  http://0.0.0.0:${PORT}`);
  console.log(`  Projects: ${PROJECTS_DIR}`);
  console.log(`  Auth: ${PASSWORD ? 'enabled' : 'DISABLED'}`);
  console.log(`  Web: ${fs.existsSync(webDist) ? 'ready' : 'not built'}\n`);
});
