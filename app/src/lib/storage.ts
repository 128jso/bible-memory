import type { Collection, Verse, UserSettings } from '../types';
import { createInitialProgress } from './sm2';

const STORAGE_KEYS = {
  collections: 'bible-memory-collections',
  verses: 'bible-memory-verses',
  settings: 'bible-memory-settings',
};

export function getCollections(): Collection[] {
  const raw = localStorage.getItem(STORAGE_KEYS.collections);
  return raw ? JSON.parse(raw) : [];
}

export function saveCollections(collections: Collection[]) {
  localStorage.setItem(STORAGE_KEYS.collections, JSON.stringify(collections));
}

export function getVerses(collectionId: string): Verse[] {
  const raw = localStorage.getItem(`${STORAGE_KEYS.verses}-${collectionId}`);
  return raw ? JSON.parse(raw) : [];
}

export function saveVerses(collectionId: string, verses: Verse[]) {
  localStorage.setItem(`${STORAGE_KEYS.verses}-${collectionId}`, JSON.stringify(verses));
}

export function getAllVerses(): Verse[] {
  const collections = getCollections();
  return collections.flatMap((c) => getVerses(c.id));
}

export function addCollection(name: string): Collection {
  const collections = getCollections();
  const newCollection: Collection = {
    id: crypto.randomUUID(),
    name,
    order: collections.length,
  };
  saveCollections([...collections, newCollection]);
  return newCollection;
}

export function renameCollection(id: string, name: string) {
  const collections = getCollections().map((c) =>
    c.id === id ? { ...c, name } : c
  );
  saveCollections(collections);
}

export function deleteCollection(id: string) {
  const collections = getCollections().filter((c) => c.id !== id);
  saveCollections(collections);
  localStorage.removeItem(`${STORAGE_KEYS.verses}-${id}`);
}

export function addVerse(collectionId: string, reference: string, text: string): Verse {
  const verses = getVerses(collectionId);
  const newVerse: Verse = {
    id: crypto.randomUUID(),
    reference,
    text,
    customText: null,
    order: verses.length,
    progress: createInitialProgress(),
  };
  saveVerses(collectionId, [...verses, newVerse]);
  return newVerse;
}

export function deleteVerse(collectionId: string, verseId: string) {
  const verses = getVerses(collectionId).filter((v) => v.id !== verseId);
  saveVerses(collectionId, verses);
}

export function updateVerseProgress(collectionId: string, verseId: string, progress: Verse['progress']) {
  const verses = getVerses(collectionId);
  const updated = verses.map((v) => (v.id === verseId ? { ...v, progress } : v));
  saveVerses(collectionId, updated);
}

export function getSettings(): UserSettings {
  const raw = localStorage.getItem(STORAGE_KEYS.settings);
  return raw ? JSON.parse(raw) : { ignorePunctuation: false, lastCollection: null, lastVerse: null };
}

export function saveSettings(settings: UserSettings) {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

export function exportData(): string {
  const collections = getCollections();
  const data = {
    collections,
    verses: Object.fromEntries(collections.map((c) => [c.id, getVerses(c.id)])),
    settings: getSettings(),
  };
  return JSON.stringify(data, null, 2);
}

export function importData(json: string) {
  const data = JSON.parse(json);
  if (data.collections) saveCollections(data.collections);
  if (data.verses) {
    for (const [collectionId, verses] of Object.entries(data.verses)) {
      saveVerses(collectionId, verses as Verse[]);
    }
  }
  if (data.settings) saveSettings(data.settings);
}
