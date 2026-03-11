let authToken: string | null = localStorage.getItem('claude_remote_token');

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    authToken = null;
    localStorage.removeItem('claude_remote_token');
    window.location.reload();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as T;
}

export const api = {
  login: async (password: string) => {
    const { token } = await request<{ token: string }>('/api/auth', {
      method: 'POST', body: JSON.stringify({ password }),
    });
    authToken = token;
    localStorage.setItem('claude_remote_token', token);
    return token;
  },
  logout: () => {
    authToken = null;
    localStorage.removeItem('claude_remote_token');
  },
  isAuthed: () => !!authToken,
  getProjects: () => request<Project[]>('/api/projects'),
  getSessions: () => request<Session[]>('/api/sessions'),
  createSession: (title: string, project?: string) =>
    request<Session>('/api/sessions', { method: 'POST', body: JSON.stringify({ title, project }) }),
  getSession: (id: string) => request<SessionDetail>(`/api/sessions/${id}`),
  deleteSession: (id: string) => request(`/api/sessions/${id}`, { method: 'DELETE' }),
  resetSession: (id: string) => request(`/api/sessions/${id}/reset`, { method: 'POST' }),
  sendMessage: (sessionId: string, content: string) =>
    request<{ messageId: string }>(`/api/sessions/${sessionId}/messages`, {
      method: 'POST', body: JSON.stringify({ content }),
    }),
  getStatus: () => request<ServerStatus>('/api/status'),
};

// ─── WebSocket ───────────────────────────────────────────
type WSHandler = (event: Record<string, unknown>) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<WSHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribedSession: string | null = null;

  connect() {
    if (!authToken) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.ws = new WebSocket(`${protocol}//${host}/ws?token=${authToken}`);

    this.ws.onopen = () => {
      this.emit('connected', {});
      if (this.subscribedSession) this.subscribe(this.subscribedSession);
    };
    this.ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        this.emit(event.type, event);
      } catch {}
    };
    this.ws.onclose = () => {
      this.emit('disconnected', {});
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };
    this.ws.onerror = () => {};
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  subscribe(sessionId: string) {
    this.subscribedSession = sessionId;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
    }
  }

  on(event: string, handler: WSHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => { this.handlers.get(event)?.delete(handler); };
  }

  private emit(event: string, data: Record<string, unknown>) {
    this.handlers.get(event)?.forEach(h => h(data));
  }
}

export const ws = new WebSocketClient();

// ─── Types ───────────────────────────────────────────────
export interface Project {
  name: string;
  path: string;
  deploy: string;
  hasClaude: boolean;
}

export interface Session {
  id: string;
  title: string;
  project: string | null;
  project_path: string | null;
  status: string;
  message_count: number;
  last_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface SessionDetail extends Session {
  messages: Message[];
  claude_session_id: string | null;
}

export interface ServerStatus {
  status: string;
  totalSessions: number;
  runningSessions: number;
  totalMessages: number;
  uptime: number;
}
