/**
 * routes.jsx — route declarations for EMS_M1.
 *
 * D004: minimal scaffold — '/', '/login', '/register' only.
 * D005 will expand this to full role-based routes with protected guards
 * and replace the inline Landing with MainLayout + role-specific pages.
 *
 * Source: docs/spec_brief.txt §6 Recommended Architecture
 */

import { Routes, Route, Link } from 'react-router-dom';
import { auth }         from '../services/index.js';
import LoginPage        from '../pages/auth/LoginPage.jsx';
import RegisterPage     from '../pages/auth/RegisterPage.jsx';

/**
 * Application route table.
 *
 * @param {{ onAuthChange: function(import('../models/User.js').default|null): void,
 *           currentUser:  import('../models/User.js').default|null }} props
 */
function AppRoutes({ onAuthChange, currentUser }) {
  return (
    <Routes>
      <Route
        path="/"
        element={<Landing currentUser={currentUser} onAuthChange={onAuthChange} />}
      />
      <Route
        path="/login"
        element={<LoginPage onSuccess={onAuthChange} />}
      />
      <Route
        path="/register"
        element={<RegisterPage onSuccess={onAuthChange} />}
      />
    </Routes>
  );
}

// ── Landing ──────────────────────────────────────────────────────────────────

/**
 * Minimal landing view — replaced by role-aware pages in D006/D007.
 *
 * Shows authenticated user's name + role with a logout button, or
 * Login / Register links when no session exists.
 * No business logic here — auth operations delegated to AuthService.
 *
 * @param {{ currentUser: import('../models/User.js').default|null,
 *           onAuthChange: function(null): void }} props
 */
function Landing({ currentUser, onAuthChange }) {
  function handleLogout() {
    auth.logout(); // business logic in AuthService
    onAuthChange(null);
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 600, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
      <h1>Full Stack Exam Management System</h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>Milestone 1</p>

      {currentUser ? (
        <div>
          <p style={{ fontSize: 18 }}>
            Welcome, <strong>{currentUser.name}</strong>{' '}
            <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 4, padding: '2px 8px', fontSize: 13 }}>
              {currentUser.role}
            </span>
          </p>
          <button
            onClick={handleLogout}
            style={{ marginTop: '1rem', padding: '8px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Logout
          </button>
          <p style={{ marginTop: '1.5rem', color: '#9ca3af', fontSize: 13 }}>
            Role-based dashboard pages wired in D006/D007.
          </p>
        </div>
      ) : (
        <div>
          <p>Please log in or register to continue.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: '1rem' }}>
            <Link to="/login"    style={{ padding: '10px 24px', background: '#2563eb', color: '#fff', borderRadius: 4, textDecoration: 'none' }}>Log In</Link>
            <Link to="/register" style={{ padding: '10px 24px', background: '#16a34a', color: '#fff', borderRadius: 4, textDecoration: 'none' }}>Register</Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppRoutes;
