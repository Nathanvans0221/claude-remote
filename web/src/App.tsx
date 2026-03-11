import { useState, useEffect, useCallback } from 'react';
import { api, ws } from './api';
import type { Session, Project } from './api';
import Login from './components/Login';
import SessionList from './components/SessionList';
import Chat from './components/Chat';

export default function App() {
  const [authed, setAuthed] = useState(api.isAuthed());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!authed) return;
    api.getSessions().then(setSessions).catch(() => {});
    api.getProjects().then(setProjects).catch(() => {});

    ws.connect();
    const u1 = ws.on('connected', () => setConnected(true));
    const u2 = ws.on('disconnected', () => setConnected(false));
    return () => { u1(); u2(); ws.disconnect(); };
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

  if (!authed) return <Login onLogin={handleLogin} />;

  return (
    <div className="h-screen flex bg-slate-900 text-white overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-80 bg-slate-800 border-r border-slate-700
        transform transition-transform lg:transform-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <SessionList
          sessions={sessions}
          activeId={activeSessionId}
          projects={projects}
          connected={connected}
          onSelect={handleSelectSession}
          onNew={handleNewSession}
          onDelete={handleDeleteSession}
          onLogout={handleLogout}
          onRefresh={refreshSessions}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-lg font-semibold">Claude Remote</span>
          <div className={`ml-auto w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
        </div>

        {activeSessionId ? (
          <Chat sessionId={activeSessionId} onSessionUpdate={refreshSessions} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center px-6">
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-2xl font-bold text-white mb-2">Claude Remote</h2>
              <p className="text-sm max-w-xs mx-auto">
                Run Claude Code sessions from anywhere. Select a session or create a new one.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
