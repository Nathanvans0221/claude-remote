import { useState } from 'react';
import type { Session, Project } from '../api';

interface Props {
  sessions: Session[];
  activeId: string | null;
  projects: Project[];
  connected: boolean;
  onSelect: (id: string) => void;
  onNew: (title: string, project?: string) => void;
  onDelete: (id: string) => void;
  onLogout: () => void;
  onRefresh: () => void;
}

export default function SessionList({
  sessions, activeId, projects, connected,
  onSelect, onNew, onDelete, onLogout, onRefresh,
}: Props) {
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProject, setNewProject] = useState('');

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    onNew(newTitle.trim(), newProject || undefined);
    setNewTitle('');
    setNewProject('');
    setShowNew(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">Claude Remote</span>
            <div
              className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`}
              title={connected ? 'Connected' : 'Disconnected'}
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onRefresh}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-700 transition-colors"
              title="Logout"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* New Session */}
      <div className="p-3 flex-shrink-0">
        {showNew ? (
          <div className="bg-slate-700/50 rounded-xl p-3 space-y-2 border border-slate-600">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Session name..."
              autoFocus
              className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm
                placeholder-slate-400 focus:outline-none focus:border-fern"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <select
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm
                focus:outline-none focus:border-fern"
            >
              <option value="">No project (general)</option>
              {projects.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} {p.hasClaude ? '📋' : ''} — {p.deploy}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="flex-1 py-2 bg-fern hover:bg-fern-dark disabled:bg-slate-600
                  text-white text-sm font-medium rounded-lg transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => { setShowNew(false); setNewTitle(''); setNewProject(''); }}
                className="px-4 py-2 text-slate-400 hover:text-white text-sm rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNew(true)}
            className="w-full py-3 bg-fern hover:bg-fern-dark text-white text-sm font-semibold
              rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Session
          </button>
        )}
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {sessions.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No sessions yet</p>
        ) : sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`group p-3 rounded-xl cursor-pointer transition-colors ${
              activeId === s.id
                ? 'bg-fern/15 border border-fern/30'
                : 'hover:bg-slate-700/50 border border-transparent'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    s.status === 'running' ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'
                  }`} />
                  <span className="text-sm font-medium truncate">{s.title}</span>
                </div>
                {s.project && (
                  <span className="text-xs text-fern-light ml-4">{s.project}</span>
                )}
                <div className="flex items-center gap-3 mt-1 ml-4">
                  <span className="text-xs text-slate-500">{s.message_count} msgs</span>
                  <span className="text-xs text-slate-500">
                    {new Date(s.updated_at + 'Z').toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400
                  rounded-lg hover:bg-slate-600/50 transition-all"
                title="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
