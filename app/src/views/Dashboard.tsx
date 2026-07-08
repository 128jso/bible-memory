import { useState, useEffect } from 'react';
import type { Collection, Verse } from '../types';
import * as firestore from '../lib/firestore';
import { isDueForReview } from '../lib/sm2';
import './Dashboard.css';

interface SessionVerse {
  verse: Verse;
  collectionId: string;
  collection: Collection;
}

interface Props {
  onSelectCollection: (collection: Collection) => void;
  onPracticeVerse: (verse: Verse, collectionId: string, collection: Collection, verses: Verse[]) => void;
  onStartSession: (mode: 'lessons' | 'reviews', verses: SessionVerse[]) => void;
}

function isNewVerse(verse: Verse): boolean {
  return verse.progress.repetitions === 0 && verse.progress.lastPracticed === '';
}

export function Dashboard({ onSelectCollection, onPracticeVerse, onStartSession }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [verseCounts, setVerseCounts] = useState<Record<string, number>>({});
  const [versesMap, setVersesMap] = useState<Record<string, Verse[]>>({});
  const [dueVerses, setDueVerses] = useState<{ verse: Verse; collectionId: string; collectionName: string; collection: Collection }[]>([]);
  const [newVerses, setNewVerses] = useState<SessionVerse[]>([]);
  const [reviewVerses, setReviewVerses] = useState<SessionVerse[]>([]);
  const [lessonsPerDay, setLessonsPerDay] = useState(12);
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [cols, settings] = await Promise.all([
      firestore.getCollections(),
      firestore.getSettings(),
    ]);
    setCollections(cols);
    setLessonsPerDay(settings.lessonsPerDay);

    const due: typeof dueVerses = [];
    const news: SessionVerse[] = [];
    const reviews: SessionVerse[] = [];
    const counts: Record<string, number> = {};
    const vMap: Record<string, Verse[]> = {};
    for (const col of cols) {
      const verses = await firestore.getVerses(col.id);
      counts[col.id] = verses.length;
      vMap[col.id] = verses;
      for (const verse of verses) {
        if (isNewVerse(verse)) {
          news.push({ verse, collectionId: col.id, collection: col });
        } else if (isDueForReview(verse.progress)) {
          due.push({ verse, collectionId: col.id, collectionName: col.name, collection: col });
          reviews.push({ verse, collectionId: col.id, collection: col });
        }
      }
    }
    setVerseCounts(counts);
    setVersesMap(vMap);
    setDueVerses(due);
    setNewVerses(news);
    setReviewVerses(reviews);
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

  const lessonsAvailable = Math.min(newVerses.length, lessonsPerDay);

  return (
    <div className="dashboard">
      <section className="srs-cards">
        <div className="srs-card srs-card--lessons">
          <div className="srs-card-label">Lessons</div>
          <div className="srs-card-count">{lessonsAvailable}</div>
          <div className="srs-card-sub">
            {newVerses.length === 0
              ? 'No new verses'
              : lessonsAvailable < newVerses.length
              ? `${newVerses.length} available (limit ${lessonsPerDay})`
              : `new ${lessonsAvailable === 1 ? 'verse' : 'verses'} ready`}
          </div>
          <button
            className="srs-card-btn"
            onClick={() => onStartSession('lessons', newVerses.slice(0, lessonsPerDay))}
            disabled={lessonsAvailable === 0}
          >
            Start Lessons
          </button>
        </div>

        <div className="srs-card srs-card--reviews">
          <div className="srs-card-label">Reviews</div>
          <div className="srs-card-count">{reviewVerses.length}</div>
          <div className="srs-card-sub">
            {reviewVerses.length === 0 ? 'All caught up' : 'due for review'}
          </div>
          <button
            className="srs-card-btn"
            onClick={() => onStartSession('reviews', reviewVerses)}
            disabled={reviewVerses.length === 0}
          >
            Start Reviews
          </button>
        </div>
      </section>

      {dueVerses.length > 0 && (
        <section className="due-section">
          <h2>Due for Review ({dueVerses.length})</h2>
          <ul className="due-list">
            {dueVerses.slice(0, 5).map(({ verse, collectionId, collectionName, collection }) => (
              <li key={verse.id} className="due-item">
                <button
                  className="due-btn"
                  onClick={() => onPracticeVerse(verse, collectionId, collection, versesMap[collectionId] || [])}
                >
                  <span className="due-reference">{verse.reference}</span>
                  <span className="due-collection">{collectionName}</span>
                </button>
              </li>
            ))}
          </ul>
          {dueVerses.length > 5 && (
            <p className="due-more">+ {dueVerses.length - 5} more due for review</p>
          )}
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
