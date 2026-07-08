import { useState, useCallback, useEffect } from 'react';
import { PracticeTyping } from '../components/PracticeTyping';
import { AudioPlayer } from '../components/AudioPlayer';
import type { DifficultyLevel, Verse } from '../types';
import { updateProgress, getMasteryLevel } from '../lib/sm2';
import * as firestore from '../lib/firestore';
import './PracticeView.css';

interface Props {
  verse: Verse;
  collectionId: string;
  onBack: () => void;
  onNavigate?: (verse: Verse) => void;
  verses?: Verse[];
}

function getDefaultDifficulty(verse: Verse): DifficultyLevel {
  const mastery = getMasteryLevel(verse.progress);
  if (mastery === 'guru' || mastery === 'master' || mastery === 'enlightened' || mastery === 'burned') return 'hard';
  if (mastery === 'apprentice') return 'medium';
  return 'easy';
}

export function PracticeView({ verse, collectionId, onBack, onNavigate, verses }: Props) {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(getDefaultDifficulty(verse));
  const [ignorePunctuation, setIgnorePunctuation] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [result, setResult] = useState<{
    accuracy: number;
    nextReview: string;
  } | null>(null);

  useEffect(() => {
    firestore.getSettings().then((s) => setIgnorePunctuation(s.ignorePunctuation));
  }, []);

  useEffect(() => {
    setDifficulty(getDefaultDifficulty(verse));
  }, [verse.id]);

  const verseText = verse.customText || verse.text;

  const currentIndex = verses ? verses.findIndex((v) => v.id === verse.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = verses ? currentIndex < verses.length - 1 : false;

  const handleComplete = useCallback(
    (accuracy: number) => {
      const updated = updateProgress(verse.progress, accuracy, difficulty);
      firestore.updateVerseProgress(collectionId, verse.id, updated);
      setResult({ accuracy, nextReview: updated.nextReview });
    },
    [verse.progress, verse.id, collectionId, difficulty]
  );

  const handleReset = () => {
    setResult(null);
  };

  function handlePrev() {
    if (hasPrev && verses && onNavigate) {
      setResult(null);
      setAutoPlay(false);
      onNavigate(verses[currentIndex - 1]);
    }
  }

  function handleNext(shouldAutoPlay = false) {
    if (verses && onNavigate) {
      setResult(null);
      setAutoPlay(shouldAutoPlay);
      if (hasNext) {
        onNavigate(verses[currentIndex + 1]);
      } else if (shouldAutoPlay) {
        onNavigate(verses[0]);
      }
    }
  }

  useEffect(() => {
    if (!result) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') handleReset();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [result]);

  return (
    <div className="practice-view">
      <div className="practice-top-bar">
        <button className="back-btn" onClick={onBack}>&larr; Back</button>
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
          <button className="btn-primary" onClick={handleReset}>
            Practice Again
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

      <div className="audio-bar">
        <div className="audio-bar-controls">
          <button
            className="audio-control-btn"
            onClick={handlePrev}
            disabled={!hasPrev}
            aria-label="Previous verse"
          >
            ⏮
          </button>
          <AudioPlayer reference={verse.reference} autoPlay={autoPlay} onTrackEnded={() => handleNext(true)} />
          <button
            className="audio-control-btn"
            onClick={() => handleNext(false)}
            disabled={!hasNext}
            aria-label="Next verse"
          >
            ⏭
          </button>
        </div>
      </div>
    </div>
  );
}
