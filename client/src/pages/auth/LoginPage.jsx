/**
 * LoginPage — mock authentication login form.
 *
 * All auth logic delegated to AuthService; no business logic here.
 * On success: calls onSuccess(user) and navigates to '/'.
 * On error: renders error message and fires notify.error().
 *
 * Source: the milestone brief §5.1 — Login must-have feature
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, notify } from '../../services/index.js';

/** Demo credentials — match the seed data (teacher@ems.dev / password). */
const DEMO_CREDS = {
  teacher: { email: 'teacher@ems.dev', password: 'password' },
  student: { email: 'student@ems.dev', password: 'password' },
};

const styles = {
  page:   { fontFamily: 'sans-serif', maxWidth: 400, margin: '4rem auto', padding: '2rem', border: '1px solid #ddd', borderRadius: 8 },
  title:  { marginBottom: '1.5rem', textAlign: 'center' },
  field:  { marginBottom: '1rem' },
  label:  { display: 'block', marginBottom: 4, fontWeight: 600 },
  input:  { width: '100%', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: 4 },
  btn:    { width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 15, cursor: 'pointer', marginTop: 8 },
  error:  { color: '#dc2626', marginBottom: '1rem', fontSize: 14 },
  demo:   { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 4, padding: '0.75rem', fontSize: 13, marginBottom: '1.5rem' },
  link:   { display: 'block', textAlign: 'center', marginTop: '1rem', color: '#2563eb' },
};

/**
 * @param {{ onSuccess: function(User): void }} props
 */
function LoginPage({ onSuccess }) {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      // All business logic in AuthService — no auth logic here.
      const user = await auth.login(email, password);
      if (onSuccess) onSuccess(user);
      navigate('/');
    } catch (err) {
      setError(err.message);
      notify.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>Log In</h2>

      {/* Demo credentials hint — visible in dev to simplify testing */}
      <div style={styles.demo}>
        <strong>Demo credentials</strong><br />
        Teacher: <code>{DEMO_CREDS.teacher.email}</code> / <code>{DEMO_CREDS.teacher.password}</code><br />
        Student: <code>{DEMO_CREDS.student.email}</code> / <code>{DEMO_CREDS.student.password}</code>
      </div>

      {error && <div style={styles.error} role="alert">{error}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            style={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
        </div>

        <button style={styles.btn} type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Log In'}
        </button>
      </form>

      <Link style={styles.link} to="/register">No account? Register here</Link>
    </div>
  );
}

export default LoginPage;
