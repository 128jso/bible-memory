import { useState, useEffect } from 'react';
import type { Collection, Verse } from '../types';
import * as firestore from '../lib/firestore';
import { isDueForReview, getMasteryLevel, getMasteryColor } from '../lib/sm2';
import { fetchVerse } from '../lib/esv';
import './CollectionView.css';

interface Props {
  collection: Collection;
  onBack: () => void;
  onPracticeVerse: (verse: Verse, verses: Verse[]) => void;
}

type BulkResult = {
  reference: string;
  text: string | null;
  status: 'success' | 'failed';
};

export function CollectionView({ collection, onBack, onPracticeVerse }: Props) {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [reference, setReference] = useState('');
  const [text, setText] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const [displayName, setDisplayName] = useState(collection.name);
  const [loading, setLoading] = useState(true);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkFetching, setBulkFetching] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [bulkAdding, setBulkAdding] = useState(false);

  useEffect(() => {
    loadVerses();
  }, [collection.id]);

  async function loadVerses() {
    setLoading(true);
    const v = await firestore.getVerses(collection.id);
    setVerses(v);
    setLoading(false);
  }

  async function handleFetch() {
    if (!reference.trim()) return;
    setFetching(true);
    setFetchError('');
    const result = await fetchVerse(reference.trim());
    if (result) {
      setText(result);
    } else {
      setFetchError('Could not fetch verse. Check the reference or paste manually.');
    }
    setFetching(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim() || !text.trim()) return;
    await firestore.addVerse(collection.id, reference.trim(), text.trim());
    setReference('');
    setText('');
    setFetchError('');
    setShowAdd(false);
    await loadVerses();
  }

  async function handleRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== displayName) {
      await firestore.renameCollection(collection.id, trimmed);
      setDisplayName(trimmed);
    }
    setEditing(false);
  }

  async function handleDelete(verseId: string) {
    if (!confirm('Delete this verse?')) return;
    await firestore.deleteVerse(collection.id, verseId);
    await loadVerses();
  }

  function toggleBulk() {
    const next = !showBulk;
    setShowBulk(next);
    if (next) {
      setShowAdd(false);
    } else {
      setBulkResults(null);
      setBulkProgress(null);
    }
  }

  async function handleBulkFetch() {
    const refs = bulkInput
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    if (refs.length === 0) return;

    setBulkFetching(true);
    setBulkResults(null);
    const results: BulkResult[] = [];
    for (let i = 0; i < refs.length; i++) {
      setBulkProgress({ current: i + 1, total: refs.length });
      const text = await fetchVerse(refs[i]);
      results.push({
        reference: refs[i],
        text,
        status: text ? 'success' : 'failed',
      });
    }
    setBulkResults(results);
    setBulkFetching(false);
    setBulkProgress(null);
  }

  async function handleBulkAdd() {
    if (!bulkResults) return;
    const successes = bulkResults.filter((r) => r.status === 'success' && r.text);
    if (successes.length === 0) return;
    setBulkAdding(true);
    for (const r of successes) {
      await firestore.addVerse(collection.id, r.reference, r.text as string);
    }
    setBulkAdding(false);
    setBulkInput('');
    setBulkResults(null);
    setBulkProgress(null);
    setShowBulk(false);
    await loadVerses();
  }

  return (
    <div className="collection-view">
      <div className="collection-view-header">
        <button className="back-btn" onClick={onBack}>&larr; Back</button>
        {editing ? (
          <input
            className="edit-title-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') { setEditName(displayName); setEditing(false); }
            }}
            autoFocus
          />
        ) : (
          <h2 className="editable-title" onClick={() => setEditing(true)}>
            {displayName}
          </h2>
        )}
        <div className="header-actions">
          <button className="btn-small" onClick={toggleBulk}>
            Bulk Import
          </button>
          <button
            className="btn-small btn-primary"
            onClick={() => {
              setShowAdd(!showAdd);
              if (!showAdd) setShowBulk(false);
            }}
          >
            + Add Verse
          </button>
        </div>
      </div>

      {showAdd && (
        <form className="add-verse-form" onSubmit={handleAdd}>
          <div className="reference-row">
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Reference (e.g. John 3:16)"
              autoFocus
            />
            <button
              type="button"
              className="btn-small btn-fetch"
              onClick={handleFetch}
              disabled={fetching || !reference.trim()}
            >
              {fetching ? 'Fetching...' : 'Fetch ESV'}
            </button>
          </div>
          {fetchError && <p className="fetch-error">{fetchError}</p>}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Verse text (or use Fetch ESV above)"
            rows={6}
          />
          <div className="add-verse-actions">
            <button type="submit" className="btn-small btn-primary">Add</button>
            <button type="button" className="btn-small" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      {showBulk && (
        <div className="add-verse-form">
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={'Paste references, one per line\nJohn 3:16\nRomans 8:28\nPhilippians 4:13'}
            rows={6}
            disabled={bulkFetching || bulkAdding}
          />
          {bulkProgress && (
            <p className="bulk-progress">
              Fetching {bulkProgress.current}/{bulkProgress.total}...
            </p>
          )}
          {bulkResults && (
            <ul className="bulk-results">
              {bulkResults.map((r, i) => (
                <li key={i} className={`bulk-result bulk-result-${r.status}`}>
                  <span className="bulk-result-status">
                    {r.status === 'success' ? '✓' : '✗'}
                  </span>
                  <span className="bulk-result-reference">{r.reference}</span>
                  {r.status === 'failed' && (
                    <span className="bulk-result-note">not found</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="add-verse-actions">
            {!bulkResults ? (
              <button
                type="button"
                className="btn-small btn-primary"
                onClick={handleBulkFetch}
                disabled={bulkFetching || !bulkInput.trim()}
              >
                {bulkFetching ? 'Fetching...' : 'Fetch All'}
              </button>
            ) : (
              <button
                type="button"
                className="btn-small btn-primary"
                onClick={handleBulkAdd}
                disabled={
                  bulkAdding ||
                  bulkResults.filter((r) => r.status === 'success').length === 0
                }
              >
                {bulkAdding
                  ? 'Adding...'
                  : `Add All (${bulkResults.filter((r) => r.status === 'success').length})`}
              </button>
            )}
            <button
              type="button"
              className="btn-small"
              onClick={toggleBulk}
              disabled={bulkFetching || bulkAdding}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="empty-state">Loading...</p>
      ) : verses.length === 0 && !showAdd && !showBulk ? (
        <p className="empty-state">No verses in this collection. Add one to get started.</p>
      ) : (
        <ul className="verses-list">
          {verses.map((verse) => {
            const due = isDueForReview(verse.progress);
            const mastery = getMasteryLevel(verse.progress);
            return (
              <li key={verse.id} className="verse-item">
                <button className="verse-btn" onClick={() => onPracticeVerse(verse, verses)}>
                  <div className="verse-info">
                    <span className="verse-reference">{verse.reference}</span>
                    <span className="verse-mastery-badge" style={{ color: getMasteryColor(mastery) }}>
                      {mastery}
                    </span>
                    {due && <span className="verse-due-badge">Due</span>}
                  </div>
                  <span className="verse-next-review">
                    {verse.progress.lastPracticed
                      ? `Next: ${verse.progress.nextReview}`
                      : 'Not practiced yet'}
                  </span>
                </button>
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(verse.id)}
                  aria-label={`Delete ${verse.reference}`}
                >
                  &times;
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
