import { useState } from 'react';
import type { Session, Project } from '../api';

interface Props {
  sessions: Session[];
  activeId: string | null;
  projects: Project[];
  connected: boolean;
  theme: 'light' | 'dark';
  updateInfo: { hasUpdate: boolean; commits: number };
  updating: boolean;
  onSelect: (id: string) => void;
  onNew: (title: string, project?: string) => void;
  onDelete: (id: string) => void;
  onLogout: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  onToggleTheme: () => void;
  onUpdate: () => void;
}

function relativeTime(dateStr: string) {
  const date = new Date(dateStr + 'Z');
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function SessionList({
  sessions, activeId, projects, connected, theme, updateInfo, updating,
  onSelect, onNew, onDelete, onLogout, onRefresh, onSettings, onToggleTheme, onUpdate,
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
    <div className="h-full flex flex-col bg-gray-50 dark:bg-zinc-950">

      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-semibold text-gray-900 dark:text-white tracking-tight">Sessions</h1>
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                connected ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-700'
              }`}
              title={connected ? 'Connected' : 'Disconnected'}
            />
          </div>
          <div className="flex items-center gap-0.5">
            {/* Update button */}
            {updateInfo.hasUpdate && !updating && (
              <button
                onClick={onUpdate}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-fern
                  bg-fern/10 hover:bg-fern/20 rounded-lg transition-colors mr-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Update{updateInfo.commits > 0 ? ` (${updateInfo.commits})` : ''}
              </button>
            )}
            <button
              onClick={onRefresh}
              className="p-1.5 text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400
                rounded-lg transition-colors"
              title="Refresh"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* New session form */}
        {showNew ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Session name"
              autoFocus
              className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/8
                rounded-xl text-gray-900 dark:text-white text-sm placeholder-gray-300 dark:placeholder-zinc-600
                focus:outline-none focus:border-fern/50 transition-all shadow-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <select
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/8
                rounded-xl text-gray-700 dark:text-zinc-300 text-sm focus:outline-none focus:border-fern/50
                transition-all shadow-sm"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="flex-1 py-2 bg-fern hover:bg-fern-dark disabled:opacity-40
                  text-white text-sm font-medium rounded-xl transition-all"
              >
                Create
              </button>
              <button
                onClick={() => { setShowNew(false); setNewTitle(''); setNewProject(''); }}
                className="px-4 py-2 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300
                  text-sm rounded-xl hover:bg-black/5 dark:hover:bg-zinc-800 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNew(true)}
            className="w-full py-2.5 bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800
              text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200
              text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-1.5
              border border-black/8 dark:border-white/5 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Session
          </button>
        )}
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-px">
        {sessions.length === 0 ? (
          <p className="text-gray-300 dark:text-zinc-700 text-xs text-center py-10">No sessions yet</p>
        ) : sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`group relative pl-3 pr-3 py-3 rounded-xl cursor-pointer transition-colors min-h-[56px] flex items-center ${
              activeId === s.id
                ? 'bg-white dark:bg-zinc-800/80 shadow-sm'
                : 'hover:bg-white/60 dark:hover:bg-zinc-900 active:bg-white/80 dark:active:bg-zinc-900'
            }`}
          >
            {/* Active left-edge indicator */}
            {activeId === s.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-fern rounded-r-full" />
            )}

            <div className="flex items-start justify-between gap-2 pl-0.5 w-full">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {s.status === 'running' && (
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
                  )}
                  <span className={`text-sm truncate leading-snug ${
                    activeId === s.id
                      ? 'text-gray-900 dark:text-white font-medium'
                      : 'text-gray-700 dark:text-zinc-300'
                  }`}>
                    {s.title}
                  </span>
                </div>
                <div className="mt-0.5">
                  {s.project ? (
                    <span className="text-[11px] text-fern/70 dark:text-fern-light/60">{s.project}</span>
                  ) : (
                    <span className="text-[11px] text-gray-400 dark:text-zinc-600">
                      {s.message_count} {s.message_count === 1 ? 'message' : 'messages'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0">
                <span className="text-[10px] text-gray-300 dark:text-zinc-700 group-hover:hidden leading-none mt-0.5 block">
                  {relativeTime(s.updated_at)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                  className="hidden group-hover:flex p-1 text-gray-300 dark:text-zinc-600
                    hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors"
                  title="Delete"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="border-t border-black/8 dark:border-white/5 px-2 pt-1 pb-2 flex items-center gap-1 flex-shrink-0"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        {/* Settings */}
        <button
          onClick={onSettings}
          className="flex-1 flex flex-col items-center gap-1 py-2.5 text-gray-400 dark:text-zinc-600
            hover:text-gray-700 dark:hover:text-zinc-300 rounded-xl hover:bg-black/5 dark:hover:bg-zinc-800
            active:bg-black/8 dark:active:bg-zinc-700 transition-all min-h-[52px]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[10px] font-medium">Settings</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="flex-1 flex flex-col items-center gap-1 py-2.5 text-gray-400 dark:text-zinc-600
            hover:text-gray-700 dark:hover:text-zinc-300 rounded-xl hover:bg-black/5 dark:hover:bg-zinc-800
            active:bg-black/8 dark:active:bg-zinc-700 transition-all min-h-[52px]"
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
          <span className="text-[10px] font-medium">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        {/* Sign out */}
        <button
          onClick={onLogout}
          className="flex-1 flex flex-col items-center gap-1 py-2.5 text-gray-400 dark:text-zinc-600
            hover:text-red-500 dark:hover:text-red-400 rounded-xl hover:bg-black/5 dark:hover:bg-zinc-800
            active:bg-black/8 dark:active:bg-zinc-700 transition-all min-h-[52px]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="text-[10px] font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
