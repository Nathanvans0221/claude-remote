import { useState, useEffect } from 'react';
import { api, VersionCommit } from '../api';

interface Props {
  onClose: () => void;
}

export default function Settings({ onClose }: Props) {
  const [ntfyTopic, setNtfyTopic] = useState('');
  const [ntfyEnabled, setNtfyEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [commits, setCommits] = useState<VersionCommit[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    api.getSettings().then(s => {
      setNtfyTopic(s.ntfy_topic || '');
      setNtfyEnabled(s.ntfy_enabled === 'true');
    }).catch(() => {});
    api.getVersionHistory().then(setCommits).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.updateSettings({
        ntfy_topic: ntfyTopic,
        ntfy_enabled: String(ntfyEnabled),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  const handleTest = async () => {
    if (!ntfyTopic) return;
    setTesting(true);
    try {
      await fetch(`https://ntfy.sh/${ntfyTopic}`, {
        method: 'POST',
        headers: { 'Title': 'Claude Remote — Test', 'Tags': 'robot' },
        body: 'Test notification from Claude Remote!',
      });
    } catch {}
    setTesting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/8 w-full sm:max-w-md
          rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full" />
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Title */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">Settings</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center bg-gray-100 dark:bg-zinc-800
                hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 dark:text-zinc-400
                hover:text-gray-700 dark:hover:text-white rounded-full transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Push Notifications */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-800 dark:text-zinc-200">Push Notifications</h3>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1 leading-relaxed">
                Get notified when Claude finishes a response. Install{' '}
                <a href="https://ntfy.sh" target="_blank" rel="noreferrer" className="text-fern hover:underline">
                  ntfy
                </a>{' '}
                and subscribe to your topic.
              </p>
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-zinc-300">Enable notifications</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={ntfyEnabled} onChange={e => setNtfyEnabled(e.target.checked)}
                  className="sr-only peer" />
                <div className="w-10 h-6 bg-gray-200 dark:bg-zinc-700 peer-checked:bg-fern rounded-full
                  peer-focus:ring-2 peer-focus:ring-fern/30 transition-colors
                  after:content-[''] after:absolute after:top-[3px] after:left-[3px]
                  after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all
                  peer-checked:after:translate-x-4 after:shadow-sm" />
              </label>
            </div>

            {/* Topic input */}
            <div>
              <label className="block text-xs text-gray-400 dark:text-zinc-500 mb-1.5">Topic name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ntfyTopic}
                  onChange={e => setNtfyTopic(e.target.value)}
                  placeholder="your-topic-name"
                  className="flex-1 px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-black/10 dark:border-white/8
                    rounded-xl text-gray-900 dark:text-white text-sm placeholder-gray-300 dark:placeholder-zinc-600
                    focus:outline-none focus:border-fern/50 focus:ring-1 focus:ring-fern/20 transition-all"
                />
                <button
                  onClick={handleTest}
                  disabled={!ntfyTopic || testing}
                  className="px-3.5 py-2 text-xs bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200
                    dark:hover:bg-zinc-700 disabled:opacity-40 text-gray-500 dark:text-zinc-400
                    hover:text-gray-700 dark:hover:text-zinc-200 rounded-xl transition-all
                    border border-black/8 dark:border-white/5 whitespace-nowrap"
                >
                  {testing ? 'Sending…' : 'Test'}
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-black/8 dark:border-white/5" />

          {/* Version History */}
          <div className="space-y-2.5">
            <button
              onClick={() => setShowHistory(h => !h)}
              className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-zinc-400
                hover:text-gray-700 dark:hover:text-zinc-200 transition-colors w-full text-left"
            >
              <svg
                className={`w-3 h-3 text-gray-300 dark:text-zinc-600 transition-transform ${showHistory ? 'rotate-90' : ''}`}
                fill="currentColor" viewBox="0 0 24 24"
              >
                <path d="M8 5l8 7-8 7V5z" />
              </svg>
              Version History
              {commits[0] && (
                <span className="ml-auto text-[10px] text-gray-300 dark:text-zinc-700 font-mono">{commits[0].hash}</span>
              )}
            </button>

            {showHistory && (
              <div className="rounded-2xl border border-black/8 dark:border-white/6 overflow-hidden
                divide-y divide-black/5 dark:divide-white/5 max-h-52 overflow-y-auto">
                {commits.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-gray-400 dark:text-zinc-600">No history available.</p>
                ) : commits.map((c, i) => (
                  <div key={c.hash} className={`px-4 py-2.5 ${
                    i === 0
                      ? 'bg-gray-50 dark:bg-zinc-800/60'
                      : 'bg-white dark:bg-zinc-900/60'
                  }`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-[10px] text-fern/80">{c.hash}</span>
                      {i === 0 && (
                        <span className="text-[9px] bg-fern/10 text-fern/80 px-1.5 py-0.5 rounded-full font-medium">
                          latest
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 dark:text-zinc-600 ml-auto">
                        {new Date(c.date).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-zinc-400 leading-snug">{c.subject}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            {saved && (
              <span className="text-xs text-fern mr-auto">Saved</span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 dark:text-zinc-500 hover:text-gray-700
                dark:hover:text-zinc-300 transition-colors rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm bg-fern hover:bg-fern-dark disabled:opacity-40
                text-white font-medium rounded-xl transition-all"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
