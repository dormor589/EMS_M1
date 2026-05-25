/**
 * NavigationMenu unit tests.
 *
 * Mocks auth.getCurrentUser() to simulate unauthenticated / teacher / student
 * states and asserts that the correct navigation links are rendered.
 *
 * Uses @testing-library/react with a MemoryRouter (required for NavLink / Link).
 *
 * Source: the milestone brief §5.1 — role-based navigation
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter }   from 'react-router-dom';
import NavigationMenu     from '../NavigationMenu.jsx';
import * as servicesIndex from '../../../services/index.js';

/** Helper: render NavigationMenu inside a MemoryRouter at a given path. */
function renderNav(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <NavigationMenu />
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Unauthenticated ───────────────────────────────────────────────────────────
describe('NavigationMenu — unauthenticated', () => {
  beforeEach(() => {
    vi.spyOn(servicesIndex.auth, 'getCurrentUser').mockReturnValue(null);
  });

  it('shows Login link', () => {
    renderNav();
    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
  });

  it('shows Register link', () => {
    renderNav();
    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument();
  });

  it('does NOT show teacher-only links', () => {
    renderNav();
    expect(screen.queryByText(/my exams/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/submissions/i)).not.toBeInTheDocument();
  });

  it('does NOT show student-only links', () => {
    renderNav();
    expect(screen.queryByText(/available exams/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/grades/i)).not.toBeInTheDocument();
  });
});

// ── Teacher ───────────────────────────────────────────────────────────────────
describe('NavigationMenu — teacher', () => {
  const teacher = { id: 't1', name: 'Alice', email: 'a@ems.dev', role: 'teacher' };

  beforeEach(() => {
    vi.spyOn(servicesIndex.auth, 'getCurrentUser').mockReturnValue(teacher);
  });

  it('shows Dashboard link', () => {
    renderNav('/teacher');
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('shows My Exams link', () => {
    renderNav('/teacher');
    expect(screen.getByRole('link', { name: /my exams/i })).toBeInTheDocument();
  });

  it('shows New Exam link', () => {
    renderNav('/teacher');
    expect(screen.getByRole('link', { name: /new exam/i })).toBeInTheDocument();
  });

  it('shows Submissions link', () => {
    renderNav('/teacher');
    expect(screen.getByRole('link', { name: /submissions/i })).toBeInTheDocument();
  });

  it('shows user name and (teacher) tag', () => {
    renderNav('/teacher');
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('(teacher)')).toBeInTheDocument();
  });

  it('shows Logout button', () => {
    renderNav('/teacher');
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('does NOT show Login / Register links', () => {
    renderNav('/teacher');
    expect(screen.queryByRole('link', { name: /^login$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /register/i })).not.toBeInTheDocument();
  });

  it('does NOT show student-only links', () => {
    renderNav('/teacher');
    expect(screen.queryByText(/available exams/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/grades/i)).not.toBeInTheDocument();
  });
});

// ── Student ───────────────────────────────────────────────────────────────────
describe('NavigationMenu — student', () => {
  const student = { id: 's1', name: 'Bob', email: 'b@ems.dev', role: 'student' };

  beforeEach(() => {
    vi.spyOn(servicesIndex.auth, 'getCurrentUser').mockReturnValue(student);
  });

  it('shows Available Exams link', () => {
    renderNav('/student');
    expect(screen.getByRole('link', { name: /available exams/i })).toBeInTheDocument();
  });

  it('shows Grades link', () => {
    renderNav('/student');
    expect(screen.getByRole('link', { name: /grades/i })).toBeInTheDocument();
  });

  it('shows user name and (student) tag', () => {
    renderNav('/student');
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('(student)')).toBeInTheDocument();
  });

  it('shows Logout button', () => {
    renderNav('/student');
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('does NOT show teacher-only links', () => {
    renderNav('/student');
    expect(screen.queryByText(/my exams/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/submissions/i)).not.toBeInTheDocument();
  });
});
