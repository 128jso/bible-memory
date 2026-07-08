import { useState, useEffect, useRef } from 'react';
import type { UserSettings, Verse } from '../types';
import * as firestore from '../lib/firestore';
import './Settings.css';

interface Props {
  onBack: () => void;
  onDarkModeChange: (darkMode: boolean) => void;
}

interface BackupVerse {
  reference: string;
  text: string;
  customText: Verse['customText'];
  progress: Verse['progress'];
}

interface BackupCollection {
  name: string;
  verses: BackupVerse[];
}

interface Backup {
  collections: BackupCollection[];
}

export function Settings({ onBack, onDarkModeChange }: Props) {
  const [settings, setSettings] = useState<UserSettings>({
    ignorePunctuation: false,
    darkMode: false,
    lastCollection: null,
    lastVerse: null,
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firestore.getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  async function handleTogglePunctuation() {
    const updated = { ...settings, ignorePunctuation: !settings.ignorePunctuation };
    setSettings(updated);
    await firestore.saveSettings(updated);
  }

  async function handleToggleDarkMode() {
    const updated = { ...settings, darkMode: !settings.darkMode };
    setSettings(updated);
    onDarkModeChange(updated.darkMode);
    await firestore.saveSettings(updated);
  }

  async function handleExport() {
    setBusy(true);
    setStatus(null);
    try {
      const collections = await firestore.getCollections();
      const backup: Backup = { collections: [] };
      for (const col of collections) {
        const verses = await firestore.getVerses(col.id);
        backup.collections.push({
          name: col.name,
          verses: verses.map((v) => ({
            reference: v.reference,
            text: v.text,
            customText: v.customText,
            progress: v.progress,
          })),
        });
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bible-memory-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({ kind: 'success', message: 'Backup exported.' });
    } catch (err) {
      setStatus({ kind: 'error', message: `Export failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(false);
    }
  }

  function handleImportClick() {
    if (!window.confirm('This will add imported collections. Continue?')) return;
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    setStatus(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Backup;
      if (!parsed.collections || !Array.isArray(parsed.collections)) {
        throw new Error('Invalid backup: missing collections array.');
      }

      const result = await firestore.batchImport(parsed.collections);
      setStatus({
        kind: 'success',
        message: `Imported ${result.collections} collection${result.collections === 1 ? '' : 's'} and ${result.verses} verse${result.verses === 1 ? '' : 's'}.`,
      });
    } catch (err) {
      setStatus({ kind: 'error', message: `Import failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="settings"><p>Loading...</p></div>;
  }

  return (
    <div className="settings">
      <div className="settings-header">
        <button className="back-btn" onClick={onBack}>&larr; Back</button>
        <h2>Settings</h2>
      </div>

      <section className="settings-section">
        <h3>Practice</h3>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.ignorePunctuation}
            onChange={handleTogglePunctuation}
          />
          <span>Ignore punctuation</span>
        </label>
      </section>

      <section className="settings-section">
        <h3>Appearance</h3>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.darkMode}
            onChange={handleToggleDarkMode}
          />
          <span>Dark mode</span>
        </label>
      </section>

      <section className="settings-section">
        <h3>Backup</h3>
        <div className="settings-actions">
          <button className="btn-settings" onClick={handleExport} disabled={busy}>
            Export Backup (JSON)
          </button>
          <button className="btn-settings btn-import" onClick={handleImportClick} disabled={busy}>
            Import Backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
        </div>
        {status && (
          <p className="import-status" style={status.kind === 'error' ? { color: '#dc2626' } : undefined}>
            {status.message}
          </p>
        )}
      </section>
    </div>
  );
}
