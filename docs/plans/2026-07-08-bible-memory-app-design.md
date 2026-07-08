# Bible Memory App — Design Document

## Overview

A lightweight desktop web app for Bible verse memorization with real-time typing feedback. Designed to work in a narrow side panel (~300px) or full-screen. Users organize verses into collections and practice typing them at three difficulty levels with per-letter feedback and spaced repetition scheduling.

## Tech Stack

- **Frontend:** React
- **Backend:** Firebase (Auth + Firestore)
- **API:** ESV API for verse lookup
- **Hosting:** Firebase Hosting

## Core Features

### Three Difficulty Levels

| Level | Display | User Types |
|-------|---------|------------|
| Easy | Full verse shown | Type the entire verse |
| Medium | Every other word shown (gaps as ___) | Type only the missing words |
| Hard | Only the reference shown | Type the entire verse from memory |

### Real-Time Per-Letter Feedback

- Each character lights up green (correct) or red (wrong) as typed
- Spaces are auto-inserted — user only types letters/punctuation
- Wrong letters do NOT block — user continues, mistakes are marked
- Capitalization is always ignored
- Punctuation checking is toggleable (off = ignore punctuation characters)
- At completion: accuracy score displayed (correct characters / total characters)

### Medium Mode Detail

Anchor words are pre-filled and grayed out. The cursor skips over them and the user only types into the gap positions (the missing words).

### Verse Source

- **ESV API** as primary lookup — user searches by book/chapter/verse
- **Manual paste** — user can paste or edit verse text for custom wording
- Custom text overrides API text when present

### Organization

Verses are grouped into named folders/collections (e.g., "A2N Devotionals", "TMS - Navigators"). Users can create, rename, reorder, and delete collections.

### Spaced Repetition (SM-2)

After each practice attempt, the app scores accuracy and updates the SRS schedule:

- **easeFactor** — SM-2 multiplier (starts at 2.5)
- **interval** — days until next review
- **repetitions** — consecutive correct recalls
- **nextReview** — date the verse is due
- **history** — log of past attempts (date, level, accuracy)

High accuracy pushes the next review further out. Low accuracy resets the interval.

### Dashboard

- "Due for Review" section at the top — surfaces verses ready for practice
- Collections list below for browsing/adding

### Persistence

- **Cloud:** Firebase Auth (login) + Firestore for all user data
- **Backup:** JSON export/import of all collections and progress

## Data Model (Firestore)

```
users/{userId}/
  settings/
    ignorePunctuation: boolean
    lastCollection: string
    lastVerse: string

  collections/{collectionId}/
    name: string
    order: number

    verses/{verseId}/
      reference: string          // "2 Corinthians 4:1"
      text: string               // from ESV API
      customText: string | null  // user override
      order: number
      progress:
        easeFactor: number       // default 2.5
        interval: number         // days
        repetitions: number
        nextReview: string       // ISO date
        lastPracticed: string    // ISO date
        history: [
          { date, level, accuracy }
        ]
```

## UI Views

1. **Dashboard** — Due for review + collections list
2. **Collection View** — Verses in a folder with review status
3. **Practice View** — Difficulty toggle, typing area with live feedback, accuracy summary + SRS update on completion
4. **Add Verse** — Search ESV API by reference or paste manually
5. **Settings** — Account, punctuation toggle, export/import

## Layout

- Responsive from ~300px (side panel) to full-screen
- Navigation collapses to icons in narrow mode
- Compact, focused UI — minimal chrome

## UI State Handling

Every data-fetching view handles all four states explicitly:

| State | Dashboard | Collection View | Add Verse |
|-------|-----------|-----------------|-----------|
| Loading | Skeleton placeholders | Skeleton list | Spinner on search |
| Error | Retry banner + offline notice | Retry button | "Could not fetch verse" + retry |
| Empty | "No verses yet — add your first" CTA | "Empty collection" + add button | "No results" for bad reference |
| Success | Due list + collections | Verse list with SRS status | Verse text preview + confirm |

## Security

- **Auth:** Firebase Auth with Google sign-in (or email/password). Firestore security rules enforce `request.auth.uid == userId` on all reads/writes — users can only access their own data.
- **XSS:** No `dangerouslySetInnerHTML`. Verse text rendered as plain text nodes only.
- **ESV API key:** Stored in environment variable, proxied through a Firebase Cloud Function to avoid exposing it client-side.
- **Tokens:** Firebase handles auth tokens via httpOnly cookies / SDK session management — no manual token storage in localStorage.
- **Input validation:** Verse references validated against expected format before API calls. User-pasted text is stored as-is but always rendered as text content, never HTML.

## Performance

- **Memoization:** SM-2 calculations and "due for review" filtering memoized with `useMemo`.
- **Lazy loading:** Settings and Add Verse views code-split with `React.lazy`.
- **Typing input:** Per-letter comparison uses a stable callback (`useCallback`) to avoid re-render thrashing during rapid typing.
- **Firestore queries:** Collections and verses fetched with snapshot listeners for real-time sync; queries scoped to single collection at a time (not loading all verses globally).

## Accessibility

- Semantic HTML: `<main>`, `<nav>`, `<button>`, `<input>` used throughout.
- Practice view typing area uses `aria-live="polite"` for accuracy announcements.
- Difficulty toggle uses `role="radiogroup"` with `aria-label`.
- Focus management: after completing a verse, focus returns to the "next verse" or dashboard action.
- Color feedback (green/red) supplemented with icons (checkmark/x) for color-blind users.
- Keyboard-navigable throughout — no mouse-only interactions.

## Type Safety

- TypeScript throughout.
- Interfaces for: `Verse`, `Collection`, `UserSettings`, `ProgressRecord`, `PracticeAttempt`.
- Firestore converters enforce typed reads/writes.
- ESV API response validated against expected shape before use.
- Discriminated union for view state: `type ViewState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'empty' } | { status: 'success'; data: T }`.

## Interaction Safety

- **Add Verse button:** Disabled during ESV API fetch to prevent duplicate additions.
- **Practice submission:** SRS update fires once on completion; button disabled until next verse is loaded.
- **Export/Import:** Import button disabled during processing; confirmation dialog before overwriting existing data.
- **Delete collection:** Confirmation dialog required. Soft-disabled during Firestore delete operation.

## Error Handling & Offline

- **ESV API failure:** Cached verse text in Firestore means offline practice still works for previously-fetched verses.
- **Firestore offline:** Firebase SDK handles offline persistence automatically — changes sync when connection returns.
- **Network indicator:** Subtle banner when offline ("Changes will sync when you reconnect").

## Testing Strategy

- **Unit tests:** SM-2 algorithm, per-letter comparison logic, accuracy scoring.
- **Component tests:** Each view rendered in all 4 states (React Testing Library).
- **Integration tests:** Firestore read/write with emulator, ESV API calls with mocked responses.
- **E2E:** One happy-path flow (login → add verse → practice → see SRS update).
