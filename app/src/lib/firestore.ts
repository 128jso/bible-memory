import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
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
  const refs = verses.map((v) => userDoc(`collections/${id}/verses/${v.id}`));
  refs.push(userDoc(`collections/${id}`));

  for (let i = 0; i < refs.length; i += 500) {
    const chunk = refs.slice(i, i + 500);
    const batch = writeBatch(db);
    for (const ref of chunk) {
      batch.delete(ref);
    }
    await batch.commit();
  }
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
  if (snap.exists()) {
    const data = snap.data() as Partial<UserSettings>;
    return {
      ignorePunctuation: data.ignorePunctuation ?? false,
      darkMode: data.darkMode ?? false,
      lastCollection: data.lastCollection ?? null,
      lastVerse: data.lastVerse ?? null,
      lessonsPerDay: data.lessonsPerDay ?? 12,
    };
  }
  return { ignorePunctuation: false, darkMode: false, lastCollection: null, lastVerse: null, lessonsPerDay: 12 };
}

export async function saveSettings(settings: UserSettings) {
  await setDoc(userDoc('settings/prefs'), settings);
}

export async function batchImport(
  collections: { name: string; verses: { reference: string; text: string; customText?: string | null; progress?: Verse['progress'] }[] }[]
): Promise<{ collections: number; verses: number }> {
  const uid = getUserId();
  if (!uid) throw new Error('Not authenticated');

  let colCount = 0;
  let verseCount = 0;
  const existingCols = await getCollections();

  for (const col of collections) {
    if (!col.name || !Array.isArray(col.verses)) continue;

    const colId = crypto.randomUUID();
    const colRef = doc(db, `users/${uid}/collections/${colId}`);

    const verses = col.verses.filter((v) => v.reference && v.text);
    const allWrites: { ref: ReturnType<typeof doc>; data: Record<string, unknown> }[] = [];

    allWrites.push({
      ref: colRef,
      data: { name: col.name, order: existingCols.length + colCount },
    });

    verses.forEach((v, i) => {
      const verseId = crypto.randomUUID();
      const verseRef = doc(db, `users/${uid}/collections/${colId}/verses/${verseId}`);
      allWrites.push({
        ref: verseRef,
        data: {
          reference: v.reference,
          text: v.text,
          customText: v.customText ?? null,
          order: i,
          progress: v.progress ?? createInitialProgress(),
        },
      });
    });

    // Firestore batch limit is 500 writes per batch
    for (let i = 0; i < allWrites.length; i += 500) {
      const chunk = allWrites.slice(i, i + 500);
      const batch = writeBatch(db);
      for (const { ref, data } of chunk) {
        batch.set(ref, data);
      }
      await batch.commit();
    }

    colCount++;
    verseCount += verses.length;
  }

  return { collections: colCount, verses: verseCount };
}
