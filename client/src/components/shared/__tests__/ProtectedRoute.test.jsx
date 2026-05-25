/**
 * ProtectedRoute unit tests.
 *
 * Mocks auth.getCurrentUser() to simulate the three guard outcomes:
 *   1. No user → redirect to /login
 *   2. User with wrong role → redirect to their own home
 *   3. User with matching role → renders children
 *
 * Uses MemoryRouter to capture <Navigate /> redirects.
 *
 * Source: the milestone brief §5.1 — role-based access control
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute  from '../ProtectedRoute.jsx';
import * as servicesIndex from '../../../services/index.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Render ProtectedRoute inside a MemoryRouter and capture the rendered path.
 * A sentinel route shows what path was navigated to.
 */
function renderProtected({ role, user, initialPath = '/protected' } = {}) {
  vi.spyOn(servicesIndex.auth, 'getCurrentUser').mockReturnValue(user ?? null);

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute role={role}>
              <div data-testid="protected-content">Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login"   element={<div data-testid="login-page">Login Page</div>} />
        <Route path="/teacher" element={<div data-testid="teacher-home">Teacher Home</div>} />
        <Route path="/student" element={<div data-testid="student-home">Student Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Unauthenticated ───────────────────────────────────────────────────────────
describe('ProtectedRoute — no user', () => {
  it('redirects to /login when not authenticated', () => {
    renderProtected({ user: null });
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to /login for a role-restricted route with no user', () => {
    renderProtected({ role: 'teacher', user: null });
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });
});

// ── Wrong role ────────────────────────────────────────────────────────────────
describe('ProtectedRoute — wrong role', () => {
  const student = { id: 's1', name: 'Bob', email: 'b@ems.dev', role: 'student' };

  it('redirects student trying to access a teacher route to /student', () => {
    renderProtected({ role: 'teacher', user: student });
    expect(screen.getByTestId('student-home')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  const teacher = { id: 't1', name: 'Alice', email: 'a@ems.dev', role: 'teacher' };

  it('redirects teacher trying to access a student route to /teacher', () => {
    renderProtected({ role: 'student', user: teacher });
    expect(screen.getByTestId('teacher-home')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});

// ── Correct role / auth-only ──────────────────────────────────────────────────
describe('ProtectedRoute — correct access', () => {
  const teacher = { id: 't1', name: 'Alice', email: 'a@ems.dev', role: 'teacher' };
  const student = { id: 's1', name: 'Bob',   email: 'b@ems.dev', role: 'student' };

  it('renders children when teacher accesses teacher route', () => {
    renderProtected({ role: 'teacher', user: teacher });
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('renders children when student accesses student route', () => {
    renderProtected({ role: 'student', user: student });
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('renders children for auth-only route (no role required) with any user', () => {
    renderProtected({ role: undefined, user: student });
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
