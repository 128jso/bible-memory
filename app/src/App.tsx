import { useEffect, useState } from 'react';
import type { Collection, Verse } from './types';
import { useAuth } from './components/AuthProvider';
import { Login } from './views/Login';
import { Dashboard } from './views/Dashboard';
import { CollectionView } from './views/CollectionView';
import { PracticeView } from './views/PracticeView';
import { SessionView } from './views/SessionView';
import type { SessionVerse } from './views/SessionView';
import { Settings } from './views/Settings';
import { StatsView } from './views/StatsView';
import { signOut } from './lib/auth';
import * as firestore from './lib/firestore';
import './App.css';

type Screen =
  | { view: 'dashboard' }
  | { view: 'collection'; collection: Collection }
  | { view: 'practice'; verse: Verse; collectionId: string; collection: Collection; verses?: Verse[] }
  | { view: 'session'; mode: 'lessons' | 'reviews'; verses: SessionVerse[] }
  | { view: 'settings' }
  | { view: 'stats' };

function App() {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState<Screen>({ view: 'dashboard' });
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (!user) return;
    firestore.getSettings().then((s) => setDarkMode(s.darkMode));
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  if (loading) {
    return <div className="app-loading">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <main className="app">
      <header className="app-header">
        <button className="app-title" onClick={() => setScreen({ view: 'dashboard' })}>
          Bible Memory
        </button>
        <div className="header-right">
          <span className="user-name">{user.displayName?.split(' ')[0]}</span>
          <button
            className="stats-btn"
            onClick={() => setScreen({ view: 'stats' })}
            aria-label="Stats"
          >
            &#9776;
          </button>
          <button
            className="settings-btn"
            onClick={() => setScreen({ view: 'settings' })}
            aria-label="Settings"
          >
            &#9881;
          </button>
          <button className="signout-btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {screen.view === 'dashboard' && (
        <Dashboard
          onSelectCollection={(collection) =>
            setScreen({ view: 'collection', collection })
          }
          onPracticeVerse={(verse, collectionId, collection, verses) =>
            setScreen({ view: 'practice', verse, collectionId, collection, verses })
          }
          onStartSession={(mode, verses) =>
            setScreen({ view: 'session', mode, verses })
          }
        />
      )}

      {screen.view === 'session' && (
        <SessionView
          mode={screen.mode}
          verses={screen.verses}
          onBack={() => setScreen({ view: 'dashboard' })}
        />
      )}

      {screen.view === 'collection' && (
        <CollectionView
          collection={screen.collection}
          onBack={() => setScreen({ view: 'dashboard' })}
          onPracticeVerse={(verse, verses) =>
            setScreen({ view: 'practice', verse, collectionId: screen.collection.id, collection: screen.collection, verses })
          }
        />
      )}

      {screen.view === 'practice' && (
        <PracticeView
          verse={screen.verse}
          collectionId={screen.collectionId}
          verses={screen.verses}
          onBack={() => setScreen({ view: 'collection', collection: screen.collection })}
          onNavigate={(verse) => setScreen({ ...screen, verse })}
        />
      )}

      {screen.view === 'stats' && (
        <StatsView onBack={() => setScreen({ view: 'dashboard' })} />
      )}

      {screen.view === 'settings' && (
        <Settings
          onBack={() => setScreen({ view: 'dashboard' })}
          onDarkModeChange={setDarkMode}
        />
      )}
    </main>
  );
}

export default App;
