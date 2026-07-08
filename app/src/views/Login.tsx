import { signInWithGoogle } from '../lib/auth';
import './Login.css';

export function Login() {
  async function handleLogin() {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Login failed:', err);
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
      </div>
    </div>
  );
}
