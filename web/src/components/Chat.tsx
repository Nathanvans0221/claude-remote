import { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import { api, ws } from '../api';
import type { SessionDetail, Message } from '../api';

interface Props {
  sessionId: string;
  onSessionUpdate: () => void;
}

export default function Chat({ sessionId, onSessionUpdate }: Props) {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadSession = useCallback(async () => {
    try {
      const data = await api.getSession(sessionId);
      setSession(data);
      setStreaming('');
      setActiveTool(null);
      if (data.status !== 'running') setSending(false);
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    loadSession();
    ws.subscribe(sessionId);
  }, [sessionId, loadSession]);

  // WebSocket events
  useEffect(() => {
    const u1 = ws.on('stream', (e) => {
      if ((e as { sessionId: string }).sessionId === sessionId) {
        setStreaming(prev => prev + (e as { content: string }).content);
        setActiveTool(null);
      }
    });
    const u2 = ws.on('tool_use', (e) => {
      if ((e as { sessionId: string }).sessionId === sessionId) {
        setActiveTool((e as { tool: string }).tool);
      }
    });
    const u3 = ws.on('complete', (e) => {
      if ((e as { sessionId: string }).sessionId === sessionId) {
        setStreaming('');
        setActiveTool(null);
        setSending(false);
        loadSession();
        onSessionUpdate();
      }
    });
    return () => { u1(); u2(); u3(); };
  }, [sessionId, loadSession, onSessionUpdate]);

  // Polling fallback when session is running (in case WebSocket drops)
  useEffect(() => {
    if (!sending && session?.status !== 'running') return;
    const interval = setInterval(() => {
      api.getSession(sessionId).then(data => {
        if (data.status === 'idle') {
          setSession(data);
          setStreaming('');
          setActiveTool(null);
          setSending(false);
          onSessionUpdate();
        }
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId, sending, session?.status, onSessionUpdate]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, streaming, activeTool]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    setInput('');
    setSending(true);
    setStreaming('');
    setActiveTool(null);

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';

    // Optimistic update
    const tempMsg: Message = {
      id: 'temp-' + Date.now(),
      session_id: sessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setSession(prev => prev ? { ...prev, status: 'running', messages: [...prev.messages, tempMsg] } : prev);

    try {
      setError(null);
      await api.sendMessage(sessionId, content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send';
      if (msg.includes('busy')) {
        // Session stuck as "running" — auto-reset and retry
        try {
          await api.resetSession(sessionId);
          await api.sendMessage(sessionId, content);
          return; // retry succeeded
        } catch {
          setError('Session was stuck. Please try sending again.');
        }
      } else {
        setError(msg);
      }
      setSending(false);
      // Keep the user message visible but mark session as idle
      setSession(prev => prev ? { ...prev, status: 'idle' } : prev);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = async () => {
    await api.resetSession(sessionId);
    setSending(false);
    setStreaming('');
    setActiveTool(null);
    loadSession();
  };

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <div className="animate-pulse">Loading session...</div>
      </div>
    );
  }

  const isRunning = session.status === 'running' || sending;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Session header */}
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold truncate">{session.title}</h2>
          {session.project && <span className="text-xs text-fern-light">{session.project}</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isRunning && (
            <button onClick={handleReset}
              className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 rounded-full hover:bg-amber-500/30 transition-colors">
              Stop
            </button>
          )}
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            isRunning ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'
          }`}>
            {isRunning ? 'running' : 'idle'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {session.messages.length === 0 && !streaming && !sending && (
          <div className="text-center text-slate-500 py-16">
            <p className="text-sm">Send a message to start working with Claude Code</p>
            {session.project && (
              <p className="text-xs mt-2 text-fern-light">
                Working in: {session.project}
              </p>
            )}
          </div>
        )}

        {session.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming / Loading */}
        {(streaming || sending) && (
          <div className="flex justify-start">
            <div className="max-w-[90%] lg:max-w-[75%] rounded-2xl px-4 py-3 bg-slate-800 border border-slate-700">
              {streaming ? (
                <div className="msg-content text-sm text-slate-200">
                  <Markdown>{streaming}</Markdown>
                  <span className="inline-block w-2 h-4 bg-fern animate-pulse ml-0.5 align-text-bottom" />
                </div>
              ) : activeTool ? (
                <div className="flex items-center gap-2 text-sm text-fern-light">
                  <div className="w-4 h-4 border-2 border-fern border-t-transparent rounded-full animate-spin" />
                  Using {activeTool}...
                </div>
              ) : (
                <div className="flex items-center gap-1.5 py-1">
                  <div className="w-2 h-2 bg-fern rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-fern rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-fern rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-500/20 text-red-300 text-sm px-4 py-2 rounded-lg border border-red-500/30">
              {error}
              <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-200">✕</button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 lg:p-4 bg-slate-800 border-t border-slate-700 flex-shrink-0">
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRunning ? 'Claude is working...' : 'Message Claude Code...'}
            disabled={isRunning}
            rows={1}
            className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white text-sm
              placeholder-slate-400 resize-none focus:outline-none focus:border-fern focus:ring-1
              focus:ring-fern disabled:opacity-50 max-h-32"
            style={{ minHeight: '48px' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 128) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isRunning}
            className="px-4 py-3 bg-fern hover:bg-fern-dark disabled:bg-slate-600
              disabled:cursor-not-allowed text-white rounded-xl transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5 text-center">
          Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message: msg }: { message: Message }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[90%] lg:max-w-[75%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-fern text-white'
          : 'bg-slate-800 text-slate-200 border border-slate-700'
      }`}>
        {isUser ? (
          <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
        ) : (
          <div className="msg-content text-sm">
            <Markdown>{msg.content}</Markdown>
          </div>
        )}
        <div className={`text-[10px] mt-1.5 ${isUser ? 'text-white/60' : 'text-slate-500'}`}>
          {new Date(msg.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
