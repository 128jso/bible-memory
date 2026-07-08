import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentUser } from './auth';
import type { Collection as AppCollection, Verse, UserSettings } from '../types';
import { createInitialProgress } from './sm2';

function getUserId(): string | null {
  return getCurrentUser()?.uid ?? null;
}

function userDoc(path: string) {
  const uid = getUserId();
  if (!uid) throw new Error('Not authenticated');
  return doc(db, `users/${uid}/${path}`);
}

function userCollection(path: string) {
  const uid = getUserId();
  if (!uid) throw new Error('Not authenticated');
  return collection(db, `users/${uid}/${path}`);
}

export async function getCollections(): Promise<AppCollection[]> {
  const ref = userCollection('collections');
  const q = query(ref, orderBy('order'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AppCollection));
}

export async function addCollection(name: string): Promise<AppCollection> {
  const cols = await getCollections();
  const id = crypto.randomUUID();
  const newCol: AppCollection = { id, name, order: cols.length };
  await setDoc(userDoc(`collections/${id}`), { name, order: cols.length });
  return newCol;
}

export async function renameCollection(id: string, name: string) {
  const ref = userDoc(`collections/${id}`);
  await setDoc(ref, { name }, { merge: true });
}

export async function deleteCollection(id: string) {
  const verses = await getVerses(id);
  for (const verse of verses) {
    await deleteDoc(userDoc(`collections/${id}/verses/${verse.id}`));
  }
  await deleteDoc(userDoc(`collections/${id}`));
}

export async function getVerses(collectionId: string): Promise<Verse[]> {
  const ref = userCollection(`collections/${collectionId}/verses`);
  const q = query(ref, orderBy('order'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Verse));
}

export async function addVerse(
  collectionId: string,
  reference: string,
  text: string
): Promise<Verse> {
  const verses = await getVerses(collectionId);
  const id = crypto.randomUUID();
  const newVerse: Verse = {
    id,
    reference,
    text,
    customText: null,
    order: verses.length,
    progress: createInitialProgress(),
  };
  const { id: _, ...data } = newVerse;
  await setDoc(userDoc(`collections/${collectionId}/verses/${id}`), data);
  return newVerse;
}

export async function deleteVerse(collectionId: string, verseId: string) {
  await deleteDoc(userDoc(`collections/${collectionId}/verses/${verseId}`));
}

export async function updateVerseProgress(
  collectionId: string,
  verseId: string,
  progress: Verse['progress']
) {
  await setDoc(
    userDoc(`collections/${collectionId}/verses/${verseId}`),
    { progress },
    { merge: true }
  );
}

export async function getSettings(): Promise<UserSettings> {
  const { getDoc } = await import('firebase/firestore');
  const ref = userDoc('settings/prefs');
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as UserSettings;
  return { ignorePunctuation: false, darkMode: false, lastCollection: null, lastVerse: null };
}

export async function saveSettings(settings: UserSettings) {
  await setDoc(userDoc('settings/prefs'), settings);
}
