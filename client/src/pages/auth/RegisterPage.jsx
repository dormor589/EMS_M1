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
    <div className="ems-auth">
      <div className="ems-auth__brand" aria-hidden="true">
        <div className="ems-auth__seal" />
      </div>
      <div className="ems-auth-card">
      <h2 className="ems-auth__title">Create Account</h2>

      {error && <div className="ems-form__error" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="ems-form__group">
          <label className="ems-form__label" htmlFor="name">Full Name</label>
          <input
            id="name"
            type="text"
            className="ems-form__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            disabled={loading}
          />
        </div>

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
            autoComplete="new-password"
            disabled={loading}
          />
          <span className="ems-form__hint">Minimum 4 characters (M1 mock auth)</span>
        </div>

        <div className="ems-form__group">
          <label className="ems-form__label" htmlFor="role">Role</label>
          <select
            id="role"
            className="ems-form__select"
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

        <button className="ems-btn ems-btn--primary ems-btn--block" type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Register'}
        </button>
      </form>

      <Link className="ems-auth__alt" to="/login">Already have an account? Log in</Link>
      </div>
    </div>
  );
}

export default RegisterPage;
