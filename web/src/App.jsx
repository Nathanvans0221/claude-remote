import React, { useState, useEffect } from 'react';

const API_BASE = '/api';

const PROJECTS = [
  { value: '', label: 'No specific project' },
  { value: 'action-center-static', label: 'Action Center (Static)' },
  { value: 'action-center-pwa', label: 'Action Center (PWA)' },
  { value: 'blln-automation', label: 'BLLN Automation' },
];

function App() {
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);

  // Form state
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [project, setProject] = useState('');

  // Fetch tasks and status
  const fetchData = async () => {
    try {
      const [tasksRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/tasks`),
        fetch(`${API_BASE}/status`)
      ]);

      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (statusRes.ok) setStatus(await statusRes.json());
    } catch (err) {
      console.error('Failed to fetch:', err);
      setStatus({ status: 'offline' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !prompt.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, prompt, project: project || null })
      });

      if (res.ok) {
        setTitle('');
        setPrompt('');
        setProject('');
        fetchData();
      }
    } catch (err) {
      console.error('Failed to submit:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return;

    try {
      await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const isOnline = status?.status === 'online';

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>Claude Remote</h1>
        <div className="status-badge">
          <span className={`status-dot ${isOnline ? '' : 'offline'}`}></span>
          {isOnline ? 'Online' : 'Offline'}
          <button className="refresh-btn" onClick={fetchData}>↻</button>
        </div>
      </header>

      {/* Stats */}
      {status?.queue && (
        <div className="stats">
          <div className="stat">
            <div className="stat-value">{status.queue.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat">
            <div className="stat-value">{status.queue.running}</div>
            <div className="stat-label">Running</div>
          </div>
          <div className="stat">
            <div className="stat-value">{status.queue.completed}</div>
            <div className="stat-label">Done</div>
          </div>
          <div className="stat">
            <div className="stat-value">{status.queue.failed}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>
      )}

      {/* New Task Form */}
      <section className="new-task">
        <h2>New Task</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              placeholder="Add dark mode toggle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label>Project (optional)</label>
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              disabled={submitting}
            >
              {PROJECTS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Prompt</label>
            <textarea
              placeholder="Describe what you want Claude to do..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button type="submit" className="submit-btn" disabled={submitting || !title || !prompt}>
            {submitting ? (
              <><span className="spinner"></span>Submitting...</>
            ) : (
              'Submit Task'
            )}
          </button>
        </form>
      </section>

      {/* Task List */}
      <section className="task-list">
        <h2>Tasks</h2>

        {loading ? (
          <div className="empty-state">
            <span className="spinner"></span> Loading...
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <h3>No tasks yet</h3>
            <p>Submit your first task above</p>
          </div>
        ) : (
          tasks.map(task => (
            <div
              key={task.id}
              className={`task-card ${task.status}`}
              onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
            >
              <div className="task-header">
                <span className="task-title">{task.title}</span>
                <span className={`task-status ${task.status}`}>
                  {task.status === 'running' && <span className="spinner"></span>}
                  {task.status}
                </span>
              </div>

              {task.project && (
                <div className="task-project">{task.project}</div>
              )}

              <div className="task-prompt">{task.prompt}</div>

              <div className="task-time">
                Created: {formatTime(task.created_at)}
                {task.completed_at && ` • Completed: ${formatTime(task.completed_at)}`}
              </div>

              {expandedTask === task.id && (
                <>
                  {task.output && (
                    <div className="task-output">{task.output}</div>
                  )}

                  <div className="task-actions">
                    {task.status !== 'running' && (
                      <button
                        className="task-btn delete"
                        onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export default App;
