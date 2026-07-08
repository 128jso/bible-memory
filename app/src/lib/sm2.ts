import type { ProgressRecord, DifficultyLevel } from '../types';

export function createInitialProgress(): ProgressRecord {
  return {
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    nextReview: new Date().toISOString().split('T')[0],
    lastPracticed: '',
    history: [],
  };
}

export function updateProgress(
  progress: ProgressRecord,
  accuracy: number,
  level: DifficultyLevel
): ProgressRecord {
  const adjustedAccuracy = accuracy >= 0.95 ? 1.0 : accuracy;
  const quality = Math.round(adjustedAccuracy * 5);
  const today = new Date().toISOString().split('T')[0];

  let { easeFactor, interval, repetitions } = progress;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReview = addDays(today, interval);

  return {
    easeFactor,
    interval,
    repetitions,
    nextReview,
    lastPracticed: today,
    history: [
      ...progress.history,
      { date: today, level, accuracy },
    ],
  };
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export function isDueForReview(progress: ProgressRecord): boolean {
  if (!progress.nextReview) return true;
  const today = new Date().toISOString().split('T')[0];
  return progress.nextReview <= today;
}

export type MasteryLevel = 'new' | 'apprentice' | 'guru' | 'master' | 'enlightened' | 'burned';

export function getMasteryLevel(progress: ProgressRecord): MasteryLevel {
  const { repetitions, interval } = progress;
  if (repetitions === 0) return 'new';
  if (interval < 4) return 'apprentice';
  if (interval < 14) return 'guru';
  if (interval < 30) return 'master';
  if (interval < 120) return 'enlightened';
  return 'burned';
}

export function getMasteryColor(level: MasteryLevel): string {
  switch (level) {
    case 'new': return '#94a3b8';
    case 'apprentice': return '#f472b6';
    case 'guru': return '#a78bfa';
    case 'master': return '#60a5fa';
    case 'enlightened': return '#fbbf24';
    case 'burned': return '#34d399';
  }
}
