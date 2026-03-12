import { useState, useEffect, useCallback } from 'react';
import { api, ws } from './api';
import type { Session, Project } from './api';
import Login from './components/Login';
import SessionList from './components/SessionList';
import Chat from './components/Chat';
import Settings from './components/Settings';

export default function App() {
  const [authed, setAuthed] = useState(api.isAuthed());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('claude_remote_theme') as 'light' | 'dark') || 'dark';
  });
  const [updateInfo, setUpdateInfo] = useState<{ hasUpdate: boolean; commits: number }>({
    hasUpdate: false, commits: 0,
  });
  const [updating, setUpdating] = useState(false);

  // Apply theme class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('claude_remote_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!authed) return;
    api.getSessions().then(setSessions).catch(() => {});
    api.getProjects().then(setProjects).catch(() => {});

    ws.connect();
    const u1 = ws.on('connected', () => setConnected(true));
    const u2 = ws.on('disconnected', () => setConnected(false));

    // Check for updates after a short delay, then every 10 minutes
    const checkUpdate = () => api.checkUpdate().then(setUpdateInfo).catch(() => {});
    const t = setTimeout(checkUpdate, 3000);
    const interval = setInterval(checkUpdate, 10 * 60 * 1000);

    return () => { u1(); u2(); ws.disconnect(); clearTimeout(t); clearInterval(interval); };
  }, [authed]);

  const refreshSessions = useCallback(() => {
    api.getSessions().then(setSessions).catch(() => {});
  }, []);

  const handleLogin = async (password: string) => {
    await api.login(password);
    setAuthed(true);
  };

  const handleLogout = () => {
    api.logout();
    ws.disconnect();
    setAuthed(false);
    setSessions([]);
    setActiveSessionId(null);
  };

  const handleNewSession = async (title: string, project?: string) => {
    const session = await api.createSession(title, project);
    setSessions(prev => [session, ...prev]);
    setActiveSessionId(session.id);
    setSidebarOpen(false);
  };

  const handleDeleteSession = async (id: string) => {
    await api.deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setSidebarOpen(false);
    ws.subscribe(id);
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await api.applyUpdate();
      // Server will restart — poll for reconnection
      setTimeout(() => window.location.reload(), 8000);
    } catch {
      setUpdating(false);
    }
  };

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  if (!authed) return <Login onLogin={handleLogin} theme={theme} onToggleTheme={toggleTheme} />;

  return (
    <div className="h-dvh flex bg-gray-50 dark:bg-black text-gray-900 dark:text-white overflow-hidden">
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-72 border-r border-black/8 dark:border-white/5
        transform transition-transform lg:transform-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <SessionList
          sessions={sessions}
          activeId={activeSessionId}
          projects={projects}
          connected={connected}
          theme={theme}
          updateInfo={updateInfo}
          updating={updating}
          onSelect={handleSelectSession}
          onNew={handleNewSession}
          onDelete={handleDeleteSession}
          onLogout={handleLogout}
          onRefresh={refreshSessions}
          onSettings={() => setShowSettings(true)}
          onToggleTheme={toggleTheme}
          onUpdate={handleUpdate}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3.5 border-b border-black/8 dark:border-white/5 bg-white/90 dark:bg-black/90 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-[15px] font-semibold tracking-tight">Claude Remote</span>
          <div className="ml-auto flex items-center gap-3">
            {updateInfo.hasUpdate && !updating && (
              <button
                onClick={handleUpdate}
                className="text-[11px] px-2.5 py-1 bg-fern/15 text-fern font-medium rounded-full
                  hover:bg-fern/25 transition-colors"
              >
                Update
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 rounded-lg transition-colors"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-700'}`} />
          </div>
        </div>

        {updating ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-8">
              <div className="w-10 h-10 border-2 border-fern border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">Updating…</p>
              <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">Rebuilding and restarting. Page will reload shortly.</p>
            </div>
          </div>
        ) : activeSessionId ? (
          <Chat sessionId={activeSessionId} onSessionUpdate={refreshSessions} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-8">
              <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-900 border border-black/8 dark:border-white/5 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg className="w-6 h-6 text-gray-300 dark:text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.862 9.862 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold tracking-tight mb-1.5">Claude Remote</h2>
              <p className="text-sm text-gray-400 dark:text-zinc-600 max-w-xs mx-auto leading-relaxed">
                Select a session or create a new one to start
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
