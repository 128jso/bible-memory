import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { DifficultyLevel } from '../types';
import {
  buildExpectedChars,
  getTypableIndices,
  buildMediumExpectedChars,
  compareChar,
  isSpace,
  isPunctuation,
} from '../lib/compare';
import './PracticeTyping.css';

interface Props {
  verseText: string;
  reference: string;
  difficulty: DifficultyLevel;
  ignorePunctuation: boolean;
  onComplete: (accuracy: number) => void;
}

interface CharState {
  char: string;
  status: 'correct' | 'incorrect' | 'pending' | 'anchor';
}

export function PracticeTyping({
  verseText,
  reference,
  difficulty,
  ignorePunctuation,
  onComplete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const { charStates, typableIndices } = useMemo(() => {
    if (difficulty === 'medium') {
      const { chars, typableIndices: rawIndices } = buildMediumExpectedChars(verseText);
      const filteredIndices = ignorePunctuation
        ? rawIndices.filter((i) => !isPunctuation(chars[i]))
        : rawIndices;
      const states: CharState[] = chars.map((ch, i) => ({
        char: ch,
        status: filteredIndices.includes(i) ? 'pending' : 'anchor',
      }));
      return { charStates: states, typableIndices: filteredIndices };
    } else {
      const chars = buildExpectedChars(verseText);
      const indices = getTypableIndices(chars).filter(
        (i) => !ignorePunctuation || !isPunctuation(chars[i])
      );
      const states: CharState[] = chars.map((ch, i) => ({
        char: ch,
        status: isSpace(ch) || (ignorePunctuation && isPunctuation(ch))
          ? 'anchor'
          : ('pending' as const),
      }));
      return { charStates: states, typableIndices: indices };
    }
  }, [verseText, difficulty, ignorePunctuation]);

  const [results, setResults] = useState<CharState[]>(charStates);
  const [currentTypableIdx, setCurrentTypableIdx] = useState(0);
  const [completed, setCompleted] = useState(false);
  const firstAttemptRef = useRef<Map<number, boolean>>(new Map());
  const [attemptStats, setAttemptStats] = useState({ attempted: 0, correct: 0 });

  useEffect(() => {
    setResults(charStates);
    setCurrentTypableIdx(0);
    setCompleted(false);
    firstAttemptRef.current = new Map();
    setAttemptStats({ attempted: 0, correct: 0 });
    inputRef.current?.focus();
  }, [charStates]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (completed) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (currentTypableIdx > 0) {
          const prevIdx = currentTypableIdx - 1;
          const charIdx = typableIndices[prevIdx];
          setResults((prev) => {
            const next = [...prev];
            next[charIdx] = { ...next[charIdx], status: 'pending' };
            return next;
          });
          setCurrentTypableIdx(prevIdx);
        }
        return;
      }

      if (e.key.length !== 1) return;
      if (e.key === ' ') {
        e.preventDefault();
        return;
      }
      e.preventDefault();

      const charIdx = typableIndices[currentTypableIdx];
      if (charIdx === undefined) return;

      const expected = charStates[charIdx].char;
      const status = compareChar(e.key, expected, ignorePunctuation);

      if (!firstAttemptRef.current.has(charIdx)) {
        firstAttemptRef.current.set(charIdx, status === 'correct');
        setAttemptStats((prev) => ({
          attempted: prev.attempted + 1,
          correct: prev.correct + (status === 'correct' ? 1 : 0),
        }));
      }

      setResults((prev) => {
        const next = [...prev];
        next[charIdx] = { ...next[charIdx], status };
        return next;
      });

      const nextTypableIdx = currentTypableIdx + 1;
      setCurrentTypableIdx(nextTypableIdx);

      if (nextTypableIdx >= typableIndices.length) {
        setCompleted(true);
        const firstAttempts = firstAttemptRef.current;
        const correctCount = typableIndices.filter((idx) => firstAttempts.get(idx) === true).length;
        const totalTypable = typableIndices.length;
        const accuracy = totalTypable > 0 ? correctCount / totalTypable : 1;
        onComplete(accuracy);
      }
    },
    [
      completed,
      currentTypableIdx,
      typableIndices,
      charStates,
      ignorePunctuation,
      results,
      onComplete,
    ]
  );

  const cursorRef = useRef<HTMLSpanElement | null>(null);

  const currentCharIdx =
    currentTypableIdx < typableIndices.length
      ? typableIndices[currentTypableIdx]
      : -1;

  useEffect(() => {
    if (cursorRef.current) {
      cursorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentCharIdx]);

  const liveAccuracy = attemptStats.attempted > 0
    ? Math.round((attemptStats.correct / attemptStats.attempted) * 100)
    : 100;

  return (
    <div className="practice-typing" onClick={() => inputRef.current?.focus()}>
      <div className="practice-top-info">
        <div className="practice-reference">{reference}</div>
        {attemptStats.attempted > 0 && (
          <div className={`live-accuracy ${liveAccuracy === 100 ? 'live-accuracy--perfect' : liveAccuracy >= 80 ? 'live-accuracy--good' : 'live-accuracy--low'}`}>
            {liveAccuracy}%
          </div>
        )}
      </div>

      {difficulty === 'hard' ? (
        <div className="practice-hint">Type the verse from memory</div>
      ) : null}

      <div className="practice-chars">
        {results.map((charState, i) =>
          charState.char === ' ' ? (
            <span key={i} className="char char--space">{' '}</span>
          ) : (
            <span
              key={i}
              ref={i === currentCharIdx ? cursorRef : undefined}
              className={`char char--${charState.status} ${i === currentCharIdx ? 'char--cursor' : ''}`}
            >
              {charState.status === 'pending' && (difficulty === 'hard' || difficulty === 'medium')
                ? '_'
                : charState.char}
            </span>
          )
        )}
      </div>

      <input
        ref={inputRef}
        className="practice-input"
        onKeyDown={handleKeyDown}
        autoFocus
        aria-label="Type the verse"
      />
    </div>
  );
}
