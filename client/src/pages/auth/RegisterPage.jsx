/**
 * RegisterPage — new account registration form.
 *
 * All auth logic delegated to AuthService; no business logic here.
 * On success: calls onSuccess(user) and navigates to '/'.
 * On error: renders error message and fires notify.error().
 *
 * Source: the milestone brief §5.1 — Register must-have feature
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, config, notify } from '../../services/index.js';

const styles = {
  page:    { fontFamily: 'sans-serif', maxWidth: 420, margin: '4rem auto', padding: '2rem', border: '1px solid #ddd', borderRadius: 8 },
  title:   { marginBottom: '1.5rem', textAlign: 'center' },
  field:   { marginBottom: '1rem' },
  label:   { display: 'block', marginBottom: 4, fontWeight: 600 },
  input:   { width: '100%', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: 4 },
  select:  { width: '100%', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: 4, background: '#fff' },
  btn:     { width: '100%', padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, fontSize: 15, cursor: 'pointer', marginTop: 8 },
  error:   { color: '#dc2626', marginBottom: '1rem', fontSize: 14 },
  hint:    { color: '#6b7280', fontSize: 12, marginTop: 4 },
  link:    { display: 'block', textAlign: 'center', marginTop: '1rem', color: '#2563eb' },
};

/**
 * @param {{ onSuccess: function(User): void }} props
 */
function RegisterPage({ onSuccess }) {
  const navigate    = useNavigate();
  const roles       = config.getRoles(); // ['teacher', 'student'] — no magic strings

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState(roles[0]);  // default: 'teacher'
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Client-side presence check — AuthService validates further (format, dups).
    if (!name || !email || !password || !role) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    try {
      // All business logic in AuthService — no auth logic here.
      const user = await auth.register({ name, email, password, role });
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
      <h2 style={styles.title}>Create Account</h2>

      {error && <div style={styles.error} role="alert">{error}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="name">Full Name</label>
          <input
            id="name"
            type="text"
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            disabled={loading}
          />
        </div>

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
            autoComplete="new-password"
            disabled={loading}
          />
          <span style={styles.hint}>Minimum 4 characters (M1 mock auth)</span>
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="role">Role</label>
          <select
            id="role"
            style={styles.select}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={loading}
          >
            {/* Roles sourced from ConfigService — no hard-coded strings */}
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <button style={styles.btn} type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Register'}
        </button>
      </form>

      <Link style={styles.link} to="/login">Already have an account? Log in</Link>
    </div>
  );
}

export default RegisterPage;
