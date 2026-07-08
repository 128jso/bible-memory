export interface Verse {
  id: string;
  reference: string;
  text: string;
  customText: string | null;
  order: number;
  progress: ProgressRecord;
}

export interface ProgressRecord {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: string;
  lastPracticed: string;
  history: PracticeAttempt[];
}

export interface PracticeAttempt {
  date: string;
  level: DifficultyLevel;
  accuracy: number;
}

export interface Collection {
  id: string;
  name: string;
  order: number;
}

export interface UserSettings {
  ignorePunctuation: boolean;
  darkMode: boolean;
  lastCollection: string | null;
  lastVerse: string | null;
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export type ViewState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'success'; data: T };
