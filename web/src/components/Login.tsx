import { useState } from 'react';

interface Props {
  onLogin: (password: string) => Promise<void>;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Login({ onLogin, theme, onToggleTheme }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(password);
    } catch {
      setError('Incorrect password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
      {/* Theme toggle */}
      <button
        onClick={onToggleTheme}
        className="fixed top-4 right-4 p-2 text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400
          bg-white dark:bg-zinc-900 border border-black/8 dark:border-white/8 rounded-xl transition-colors"
      >
        {theme === 'dark' ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

      <div className="w-full max-w-[340px]">
        <div className="text-center mb-9">
          <div className="w-14 h-14 bg-white dark:bg-zinc-900 border border-black/8 dark:border-white/8
            rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
            <svg className="w-7 h-7 text-fern" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.862 9.862 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">Claude Remote</h1>
          <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1.5">Enter your password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full px-4 py-3.5 bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/8
              rounded-2xl text-gray-900 dark:text-white text-sm placeholder-gray-300 dark:placeholder-zinc-600
              focus:outline-none focus:border-fern/50 focus:ring-1 focus:ring-fern/20 transition-all shadow-sm"
          />
          {error && (
            <p className="text-red-500 dark:text-red-400 text-xs text-center py-0.5">{error}</p>
          )}
          <button
            type="submit"
            disabled={!password || loading}
            className="w-full py-3.5 bg-fern hover:bg-fern-dark disabled:opacity-40
              disabled:cursor-not-allowed text-white font-medium rounded-2xl transition-all text-sm tracking-tight"
          >
            {loading ? 'Connecting…' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
}
