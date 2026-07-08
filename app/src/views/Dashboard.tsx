import { useState, useEffect } from 'react';
import type { Collection, Verse } from '../types';
import * as firestore from '../lib/firestore';
import { isDueForReview } from '../lib/sm2';
import './Dashboard.css';

interface Props {
  onSelectCollection: (collection: Collection) => void;
  onPracticeVerse: (verse: Verse, collectionId: string, collection: Collection) => void;
}

export function Dashboard({ onSelectCollection, onPracticeVerse }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [verseCounts, setVerseCounts] = useState<Record<string, number>>({});
  const [dueVerses, setDueVerses] = useState<{ verse: Verse; collectionId: string; collectionName: string; collection: Collection }[]>([]);
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const cols = await firestore.getCollections();
    setCollections(cols);

    const due: typeof dueVerses = [];
    const counts: Record<string, number> = {};
    for (const col of cols) {
      const verses = await firestore.getVerses(col.id);
      counts[col.id] = verses.length;
      for (const verse of verses) {
        if (isDueForReview(verse.progress)) {
          due.push({ verse, collectionId: col.id, collectionName: col.name, collection: col });
        }
      }
    }
    setVerseCounts(counts);
    setDueVerses(due);
    setLoading(false);
  }

  async function handleAddCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await firestore.addCollection(newName.trim());
    setNewName('');
    setShowAdd(false);
    await loadData();
  }

  async function handleDeleteCollection(id: string) {
    if (!confirm('Delete this collection and all its verses?')) return;
    await firestore.deleteCollection(id);
    await loadData();
  }

  if (loading) {
    return <div className="dashboard"><p className="empty-state">Loading...</p></div>;
  }

  return (
    <div className="dashboard">
      {dueVerses.length > 0 && (
        <section className="due-section">
          <h2>Due for Review</h2>
          <ul className="due-list">
            {dueVerses.map(({ verse, collectionId, collectionName, collection }) => (
              <li key={verse.id} className="due-item">
                <button
                  className="due-btn"
                  onClick={() => onPracticeVerse(verse, collectionId, collection)}
                >
                  <span className="due-reference">{verse.reference}</span>
                  <span className="due-collection">{collectionName}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="collections-section">
        <div className="collections-header">
          <h2>Collections</h2>
          <button className="btn-small" onClick={() => setShowAdd(!showAdd)}>
            + New
          </button>
        </div>

        {showAdd && (
          <form className="add-collection-form" onSubmit={handleAddCollection}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              autoFocus
            />
            <button type="submit" className="btn-small btn-primary">Add</button>
            <button type="button" className="btn-small" onClick={() => setShowAdd(false)}>Cancel</button>
          </form>
        )}

        {collections.length === 0 && !showAdd ? (
          <p className="empty-state">No collections yet. Create one to get started.</p>
        ) : (
          <ul className="collections-list">
            {collections.map((col) => (
              <li key={col.id} className="collection-item">
                <button className="collection-btn" onClick={() => onSelectCollection(col)}>
                  <span className="collection-name">{col.name}</span>
                  <span className="collection-count">{verseCounts[col.id] ?? 0} verses</span>
                </button>
                <button
                  className="delete-btn"
                  onClick={() => handleDeleteCollection(col.id)}
                  aria-label={`Delete ${col.name}`}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
