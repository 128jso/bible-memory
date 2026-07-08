import { useState, useEffect, useCallback } from 'react';
import { PracticeTyping } from '../components/PracticeTyping';
import type { Collection, DifficultyLevel, Verse } from '../types';
import { updateProgress, getMasteryLevel } from '../lib/sm2';
import * as firestore from '../lib/firestore';
import './SessionView.css';

export interface SessionVerse {
  verse: Verse;
  collectionId: string;
  collection: Collection;
}

interface Props {
  mode: 'lessons' | 'reviews';
  verses: SessionVerse[];
  onBack: () => void;
}

function getDefaultDifficulty(verse: Verse, mode: 'lessons' | 'reviews'): DifficultyLevel {
  if (mode === 'lessons') return 'easy';
  const mastery = getMasteryLevel(verse.progress);
  if (mastery === 'guru' || mastery === 'master' || mastery === 'enlightened' || mastery === 'burned') return 'hard';
  if (mastery === 'apprentice') return 'medium';
  return 'easy';
}

export function SessionView({ mode, verses, onBack }: Props) {
  const [index, setIndex] = useState(0);
  const [accuracies, setAccuracies] = useState<number[]>([]);
  const [ignorePunctuation, setIgnorePunctuation] = useState(false);
  const [result, setResult] = useState<{ accuracy: number; nextReview: string } | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(() =>
    verses.length > 0 ? getDefaultDifficulty(verses[0].verse, mode) : 'easy'
  );

  useEffect(() => {
    firestore.getSettings().then((s) => setIgnorePunctuation(s.ignorePunctuation));
  }, []);

  useEffect(() => {
    if (index < verses.length) {
      setDifficulty(getDefaultDifficulty(verses[index].verse, mode));
      setResult(null);
    }
  }, [index, verses, mode]);

  const current = index < verses.length ? verses[index] : null;
  const total = verses.length;
  const isComplete = index >= verses.length;

  const handleComplete = useCallback(
    (accuracy: number) => {
      if (!current) return;
      const updated = updateProgress(current.verse.progress, accuracy, difficulty);
      firestore.updateVerseProgress(current.collectionId, current.verse.id, updated);
      setAccuracies((prev) => [...prev, accuracy]);
      setResult({ accuracy, nextReview: updated.nextReview });
    },
    [current, difficulty]
  );

  const handleNext = useCallback(() => {
    setResult(null);
    setIndex((i) => i + 1);
  }, []);

  useEffect(() => {
    if (!result) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') handleNext();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [result, handleNext]);

  if (total === 0) {
    return (
      <div className="session-view">
        <div className="session-top-bar">
          <button className="back-btn" onClick={onBack}>&larr; Back</button>
        </div>
        <div className="session-empty">
          <p>No verses available for this session.</p>
          <button className="btn-primary" onClick={onBack}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    const completed = accuracies.length;
    const avg = completed > 0 ? accuracies.reduce((s, a) => s + a, 0) / completed : 0;
    return (
      <div className="session-view">
        <div className="session-top-bar">
          <button className="back-btn" onClick={onBack}>&larr; Back</button>
        </div>
        <div className="session-summary">
          <div className="session-summary-icon">✓</div>
          <h2>Session complete!</h2>
          <p className="session-summary-line">
            {completed} {completed === 1 ? 'verse' : 'verses'} {mode === 'lessons' ? 'learned' : 'reviewed'}.
          </p>
          <p className="session-summary-accuracy">
            Average accuracy: {Math.round(avg * 100)}%
          </p>
          <button className="btn-primary" onClick={onBack}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const verse = current!.verse;
  const verseText = verse.customText || verse.text;
  const progressPct = ((index) / total) * 100;
  const modeLabel = mode === 'lessons' ? 'Lesson' : 'Review';

  return (
    <div className="session-view">
      <div className="session-top-bar">
        <button className="back-btn" onClick={onBack}>&larr; Back</button>
        <div className="session-progress-info">
          <span className="session-mode">{modeLabel}</span>
          <span className="session-count">{index + 1}/{total}</span>
        </div>
      </div>

      <div className="session-progress-bar">
        <div
          className={`session-progress-fill session-progress-fill--${mode}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="session-collection-label">
        {current!.collection.name}
      </div>

      <div className="practice-controls">
        <div className="difficulty-toggle" role="radiogroup" aria-label="Difficulty level">
          {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map((level) => (
            <button
              key={level}
              className={`difficulty-btn ${difficulty === level ? 'difficulty-btn--active' : ''}`}
              onClick={() => {
                setDifficulty(level);
                setResult(null);
              }}
              role="radio"
              aria-checked={difficulty === level}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {result ? (
        <div className="practice-result">
          <div className="result-score">
            {Math.round(result.accuracy * 100)}% accurate
          </div>
          <div className="result-next-review">
            Next review: {result.nextReview}
          </div>
          <button className="btn-primary" onClick={handleNext}>
            {index + 1 >= total ? 'Finish' : 'Next Verse'}
          </button>
          <span className="restart-hint">or press Enter</span>
        </div>
      ) : (
        <PracticeTyping
          key={`${verse.id}-${difficulty}-${ignorePunctuation}`}
          verseText={verseText}
          reference={verse.reference}
          difficulty={difficulty}
          ignorePunctuation={ignorePunctuation}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
