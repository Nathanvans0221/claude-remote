import { useState, useEffect } from 'react';
import { api } from '../api';

interface Props {
  onClose: () => void;
}

export default function Settings({ onClose }: Props) {
  const [ntfyTopic, setNtfyTopic] = useState('');
  const [ntfyEnabled, setNtfyEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.getSettings().then(s => {
      setNtfyTopic(s.ntfy_topic || '');
      setNtfyEnabled(s.ntfy_enabled === 'true');
    }).catch(() => {});
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md p-6 space-y-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">&times;</button>
        </div>

        {/* ntfy Notifications */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-300">Push Notifications (ntfy.sh)</h3>
          <p className="text-xs text-slate-500">
            Get notified on your phone when Claude finishes a response.
            Install the <a href="https://ntfy.sh" target="_blank" rel="noreferrer"
              className="text-fern hover:underline">ntfy app</a> and subscribe to your topic.
          </p>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={ntfyEnabled} onChange={e => setNtfyEnabled(e.target.checked)}
                className="sr-only peer" />
              <div className="w-9 h-5 bg-slate-600 peer-checked:bg-fern rounded-full
                peer-focus:ring-2 peer-focus:ring-fern/50 transition-colors
                after:content-[''] after:absolute after:top-0.5 after:left-0.5
                after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all
                peer-checked:after:translate-x-4" />
            </label>
            <span className="text-sm text-slate-300">
              {ntfyEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Topic name</label>
            <input
              type="text"
              value={ntfyTopic}
              onChange={e => setNtfyTopic(e.target.value)}
              placeholder="nathan-claude-updates"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white
                placeholder-slate-500 focus:outline-none focus:border-fern focus:ring-1 focus:ring-fern"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Same topic you subscribe to in the ntfy app
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={handleTest} disabled={!ntfyTopic || testing}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50
                text-slate-300 rounded-lg transition-colors">
              {testing ? 'Sending...' : 'Send Test'}
            </button>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700">
          {saved && <span className="text-xs text-fern">Saved!</span>}
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-fern hover:bg-fern-dark disabled:opacity-50
              text-white rounded-lg transition-colors">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
