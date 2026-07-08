import { useState } from 'react';
import { signInWithGoogle } from '../lib/auth';
import './Login.css';

export function Login() {
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Login failed:', err);
      setError('Sign-in failed. Please try again.');
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <h1>Bible Memory</h1>
        <p>Memorize scripture with spaced repetition</p>
        <button className="login-btn" onClick={handleLogin}>
          Sign in with Google
        </button>
        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  );
}
