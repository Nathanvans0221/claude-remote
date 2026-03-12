import { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import { api, ws } from '../api';
import type { SessionDetail, Message } from '../api';

interface Props {
  sessionId: string;
  onSessionUpdate: () => void;
}

const STUCK_TIMEOUT = 90_000;

export default function Chat({ sessionId, onSessionUpdate }: Props) {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stuckWarning, setStuckWarning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastActivityRef = useRef<number>(Date.now());

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

  useEffect(() => {
    const u1 = ws.on('stream', (e) => {
      if ((e as { sessionId: string }).sessionId === sessionId) {
        setStreaming(prev => prev + (e as { content: string }).content);
        setActiveTool(null);
        lastActivityRef.current = Date.now();
        setStuckWarning(false);
      }
    });
    const u2 = ws.on('tool_use', (e) => {
      if ((e as { sessionId: string }).sessionId === sessionId) {
        setActiveTool((e as { tool: string }).tool);
        lastActivityRef.current = Date.now();
        setStuckWarning(false);
      }
    });
    const u3 = ws.on('complete', (e) => {
      if ((e as { sessionId: string }).sessionId === sessionId) {
        setStreaming('');
        setActiveTool(null);
        setSending(false);
        setStuckWarning(false);
        loadSession();
        onSessionUpdate();
      }
    });
    return () => { u1(); u2(); u3(); };
  }, [sessionId, loadSession, onSessionUpdate]);

  useEffect(() => {
    if (!sending) { setStuckWarning(false); return; }
    lastActivityRef.current = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > STUCK_TIMEOUT) setStuckWarning(true);
    }, 10_000);
    return () => clearInterval(interval);
  }, [sending]);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, streaming, activeTool]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content) return;

    if (sending || session?.status === 'running') {
      try {
        await api.resetSession(sessionId);
        setSending(false);
        setStreaming('');
        setActiveTool(null);
        setStuckWarning(false);
      } catch {}
    }

    setInput('');
    setSending(true);
    setStreaming('');
    setActiveTool(null);
    setStuckWarning(false);

    if (inputRef.current) inputRef.current.style.height = 'auto';

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
        try {
          await api.resetSession(sessionId);
          await api.sendMessage(sessionId, content);
          return;
        } catch {
          setError('Session was stuck. Please try sending again.');
        }
      } else {
        setError(msg);
      }
      setSending(false);
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
    setStuckWarning(false);
    loadSession();
  };

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-300 dark:text-zinc-700 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  const isRunning = session.status === 'running' || sending;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black">
      {/* Session header */}
      <div className="px-5 py-3.5 border-b border-black/8 dark:border-white/5 flex items-center justify-between
        flex-shrink-0 bg-white/90 dark:bg-black/80 backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white tracking-tight truncate">
            {session.title}
          </h2>
          {session.project && (
            <span className="text-[11px] text-fern/70 dark:text-fern-light/70">{session.project}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isRunning && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700
                text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-white rounded-full
                transition-colors border border-black/5 dark:border-white/5"
            >
              Stop
            </button>
          )}
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium tabular-nums ${
            isRunning
              ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400/90'
              : 'bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-zinc-600'
          }`}>
            {isRunning ? 'running' : 'idle'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-5 space-y-2">
        {session.messages.length === 0 && !streaming && !sending && (
          <div className="text-center py-16 px-8">
            <p className="text-sm text-gray-300 dark:text-zinc-700">Send a message to start</p>
            {session.project && (
              <p className="text-xs mt-1.5 text-fern/50 dark:text-fern-light/40">{session.project}</p>
            )}
          </div>
        )}

        {session.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming / Loading */}
        {(streaming || sending) && (
          <div className="flex justify-start px-4">
            <div className="max-w-[85%] lg:max-w-[72%] bg-gray-100 dark:bg-zinc-900 rounded-[20px]
              rounded-bl-[5px] px-4 py-3 border border-black/5 dark:border-white/5">
              {streaming ? (
                <div className="msg-content text-sm text-gray-800 dark:text-zinc-100 leading-relaxed">
                  <Markdown>{streaming}</Markdown>
                  <span className="inline-block w-[7px] h-[15px] bg-fern/60 animate-pulse ml-0.5
                    align-text-bottom rounded-[2px]" />
                </div>
              ) : activeTool ? (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3.5 h-3.5 border-[1.5px] border-fern/50 border-t-transparent
                    rounded-full animate-spin" />
                  <span className="text-fern/70 dark:text-fern-light/60">{activeTool}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 py-0.5">
                  {[0, 150, 300].map((delay) => (
                    <div key={delay} className="w-1.5 h-1.5 bg-gray-300 dark:bg-zinc-600 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center px-4">
            <div className="bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 text-xs px-4 py-2.5
              rounded-2xl border border-red-200 dark:border-red-500/20 flex items-center gap-3">
              <span>{error}</span>
              <button onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Stuck session banner */}
      {stuckWarning && (
        <div className="mx-4 mb-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200
          dark:border-amber-500/20 rounded-2xl flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-amber-600 dark:text-amber-400/80">No activity for 90s — session may be stuck</span>
          <button
            onClick={handleReset}
            className="px-3 py-1 text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300
              rounded-full hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors ml-3"
          >
            Reset
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0">
        <div className={`flex items-end gap-2 bg-gray-100 dark:bg-zinc-900 rounded-[22px] border
          px-3.5 py-1.5 transition-colors max-w-4xl mx-auto ${
            isRunning
              ? 'border-amber-300/60 dark:border-amber-500/25'
              : 'border-black/8 dark:border-white/8'
          }`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRunning ? 'Claude is working…' : 'Message'}
            rows={1}
            className="flex-1 bg-transparent text-gray-900 dark:text-white text-sm
              placeholder-gray-400 dark:placeholder-zinc-600 resize-none
              focus:outline-none py-2.5 max-h-36 leading-5"
            style={{ minHeight: '38px' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 144) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-1
              transition-all ${
                input.trim()
                  ? isRunning
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-fern hover:bg-fern-dark'
                  : 'bg-gray-200 dark:bg-zinc-800'
              }`}
          >
            <svg className={`w-4 h-4 ${input.trim() ? 'text-white' : 'text-gray-400 dark:text-zinc-600'}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {isRunning && (
          <p className="text-[10px] text-gray-400 dark:text-zinc-700 mt-1.5 text-center">
            Sending will interrupt and restart
          </p>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message: msg }: { message: Message }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex px-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] lg:max-w-[72%] ${
        isUser
          ? 'bg-fern text-white rounded-[20px] rounded-br-[5px] px-4 py-2.5'
          : 'bg-gray-100 dark:bg-zinc-900 text-gray-800 dark:text-zinc-100 rounded-[20px] rounded-bl-[5px] px-4 py-3 border border-black/5 dark:border-white/5'
      }`}>
        {isUser ? (
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</div>
        ) : (
          <div className="msg-content text-sm leading-relaxed">
            <Markdown>{msg.content}</Markdown>
          </div>
        )}
        <div className={`text-[10px] mt-1.5 ${isUser ? 'text-white/45 text-right' : 'text-gray-400 dark:text-zinc-600'}`}>
          {new Date(msg.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
