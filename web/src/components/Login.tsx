import { useState } from 'react';

interface Props {
  onLogin: (password: string) => Promise<void>;
}

export default function Login({ onLogin }: Props) {
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
      setError('Invalid password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-fern/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🤖</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Claude Remote</h1>
          <p className="text-slate-400 text-sm mt-2">Access Claude Code from anywhere</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoFocus
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white
              placeholder-slate-400 focus:outline-none focus:border-fern focus:ring-1 focus:ring-fern"
          />
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <button
            type="submit"
            disabled={!password || loading}
            className="w-full mt-4 py-3 bg-fern hover:bg-fern-dark disabled:bg-slate-600
              disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
}
