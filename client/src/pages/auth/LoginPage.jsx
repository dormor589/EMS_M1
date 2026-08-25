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
    <div className="ems-auth">
      <div className="ems-auth__brand" aria-hidden="true">
        <div className="ems-auth__seal" />
      </div>
      <div className="ems-auth-card">
      <h2 className="ems-auth__title">Log In</h2>

      {/* Demo credentials hint — visible in dev to simplify testing */}
      <div className="ems-auth__demo">
        <strong>Demo credentials</strong><br />
        Teacher: <code>{DEMO_CREDS.teacher.email}</code> / <code>{DEMO_CREDS.teacher.password}</code><br />
        Student: <code>{DEMO_CREDS.student.email}</code> / <code>{DEMO_CREDS.student.password}</code>
      </div>

      {error && <div className="ems-form__error" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="ems-form__group">
          <label className="ems-form__label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="ems-form__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <div className="ems-form__group">
          <label className="ems-form__label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="ems-form__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
        </div>

        <button className="ems-btn ems-btn--primary ems-btn--block" type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Log In'}
        </button>
      </form>

      <Link className="ems-auth__alt" to="/register">No account? Register here</Link>
      </div>
    </div>
  );
}

export default LoginPage;
