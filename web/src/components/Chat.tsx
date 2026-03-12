import { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import { api, ws } from '../api';
import type { SessionDetail, Message } from '../api';

interface Props {
  sessionId: string;
  onSessionUpdate: () => void;
}

interface ImageAttachment {
  base64: string;
  mimeType: string;
  preview: string; // data URL for display
}

const STUCK_TIMEOUT = 90_000;

// Compress + resize image to max 1024px, JPEG 85% — keeps base64 payload manageable
async function compressImage(file: File): Promise<ImageAttachment> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1024;
      let { width: w, height: h } = img;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
        else { w = Math.round((w * MAX) / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(url);
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', preview: dataUrl });
    };
    img.src = url;
  });
}

export default function Chat({ sessionId, onSessionUpdate }: Props) {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stuckWarning, setStuckWarning] = useState(false);
  const [image, setImage] = useState<ImageAttachment | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const compressed = await compressImage(file);
    setImage(compressed);
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content && !image) return;

    if (sending || session?.status === 'running') {
      try {
        await api.resetSession(sessionId);
        setSending(false);
        setStreaming('');
        setActiveTool(null);
        setStuckWarning(false);
      } catch {}
    }

    const imageToSend = image;
    setInput('');
    setImage(null);
    setSending(true);
    setStreaming('');
    setActiveTool(null);
    setStuckWarning(false);

    if (inputRef.current) inputRef.current.style.height = 'auto';

    // Optimistic: show user message with optional image preview
    const tempMsg: Message & { imagePreview?: string } = {
      id: 'temp-' + Date.now(),
      session_id: sessionId,
      role: 'user',
      content: content || '[Image]',
      created_at: new Date().toISOString(),
      imagePreview: imageToSend?.preview,
    };
    setSession(prev => prev ? { ...prev, status: 'running', messages: [...prev.messages, tempMsg] } : prev);

    try {
      setError(null);
      await api.sendMessage(
        sessionId,
        content,
        imageToSend ? { base64: imageToSend.base64, mimeType: imageToSend.mimeType } : undefined,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send';
      if (msg.includes('busy')) {
        try {
          await api.resetSession(sessionId);
          await api.sendMessage(sessionId, content, imageToSend ? { base64: imageToSend.base64, mimeType: imageToSend.mimeType } : undefined);
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
  const canSend = !!(input.trim() || image);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black">
      {/* Session header */}
      <div className="px-4 py-3 border-b border-black/8 dark:border-white/5 flex items-center justify-between
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
              className="min-h-[36px] px-3 text-xs bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200
                dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400 hover:text-gray-700
                dark:hover:text-white rounded-full transition-colors border border-black/5 dark:border-white/5
                active:scale-95"
            >
              Stop
            </button>
          )}
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
            isRunning
              ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400/90'
              : 'bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-zinc-600'
          }`}>
            {isRunning ? 'running' : 'idle'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-2">
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
            <div className="max-w-[88%] lg:max-w-[72%] bg-gray-100 dark:bg-zinc-900 rounded-[20px]
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
                  <span className="text-fern/70 dark:text-fern-light/60 text-xs">{activeTool}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 py-0.5">
                  {[0, 150, 300].map((delay) => (
                    <div key={delay} className="w-2 h-2 bg-gray-300 dark:bg-zinc-600 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center px-4">
            <div className="bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 text-xs px-4 py-3
              rounded-2xl border border-red-200 dark:border-red-500/20 flex items-center gap-3">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="p-1 -m-1 active:opacity-60">
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
        <div className="mx-4 mb-2 px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200
          dark:border-amber-500/20 rounded-2xl flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-amber-600 dark:text-amber-400/80">No activity for 90s — may be stuck</span>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300
              rounded-full hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors ml-3 active:scale-95"
          >
            Reset
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 pt-2 flex-shrink-0" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        {/* Image preview */}
        {image && (
          <div className="mb-2 flex items-start gap-2">
            <div className="relative">
              <img src={image.preview} alt="attachment" className="h-20 w-20 object-cover rounded-2xl border border-black/10 dark:border-white/10" />
              <button
                onClick={() => setImage(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900
                  rounded-full flex items-center justify-center text-[10px] font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className={`flex items-end gap-1.5 bg-gray-100 dark:bg-zinc-900 rounded-[26px] border
          px-2 py-1.5 transition-colors max-w-4xl mx-auto ${
            isRunning
              ? 'border-amber-300/60 dark:border-amber-500/25'
              : 'border-black/8 dark:border-white/8'
          }`}>

          {/* Camera / image picker */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 flex items-center justify-center text-gray-400 dark:text-zinc-600
              hover:text-gray-600 dark:hover:text-zinc-400 rounded-full transition-colors flex-shrink-0
              active:bg-black/5 dark:active:bg-white/5"
            title="Attach image"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRunning ? 'Claude is working…' : 'Message'}
            rows={1}
            className="flex-1 bg-transparent text-gray-900 dark:text-white text-base
              placeholder-gray-400 dark:placeholder-zinc-600 resize-none
              focus:outline-none py-2.5 max-h-36 leading-5 min-w-0"
            style={{ minHeight: '44px', fontSize: '16px' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 144) + 'px';
            }}
          />

          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0
              transition-all active:scale-90 ${
                canSend
                  ? isRunning
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-fern hover:bg-fern-dark'
                  : 'bg-gray-200 dark:bg-zinc-800'
              }`}
          >
            <svg className={`w-4 h-4 ${canSend ? 'text-white' : 'text-gray-400 dark:text-zinc-600'}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {isRunning && (
          <p className="text-[11px] text-gray-400 dark:text-zinc-700 mt-1.5 text-center pb-0.5">
            Sending will interrupt and restart
          </p>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message: msg }: { message: Message & { imagePreview?: string } }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex px-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] lg:max-w-[72%] ${
        isUser
          ? 'bg-fern text-white rounded-[20px] rounded-br-[5px] px-4 py-3'
          : 'bg-gray-100 dark:bg-zinc-900 text-gray-800 dark:text-zinc-100 rounded-[20px] rounded-bl-[5px] px-4 py-3 border border-black/5 dark:border-white/5'
      }`}>
        {msg.imagePreview && (
          <img src={msg.imagePreview} alt="attachment" className="max-w-full rounded-xl mb-2 max-h-48 object-cover" />
        )}
        {isUser ? (
          <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {msg.content !== '[Image]' ? msg.content : null}
          </div>
        ) : (
          <div className="msg-content text-[15px] leading-relaxed">
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
