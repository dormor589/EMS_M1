/**
 * NavigationMenu — role-aware top navigation bar.
 *
 * Reads auth state via AuthService on every location change so the nav
 * reflects the current session without needing prop drilling through Outlet.
 * Re-renders on route change via useLocation() dependency in useEffect.
 *
 * Roles:
 *   Unauthenticated → Login | Register links
 *   Teacher         → Dashboard, Exams, New Exam, Submissions + Logout
 *   Student         → Dashboard, Available Exams, Grades + Logout
 *
 * Source: the milestone brief §5.1 Must-Have — role-based navigation
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../../services/index.js';

/**
 * NavigationMenu renders the top nav bar, adapting to the current auth role.
 *
 * @returns {JSX.Element}
 */
function NavigationMenu() {
  const navigate = useNavigate();

  // Read auth state during render rather than mirroring it into state.
  // getCurrentUser() is synchronous, and a route change re-renders this
  // component anyway, so the menu stays in sync after login, register or
  // logout without an effect that sets state and forces a second render.
  const currentUser = auth.getCurrentUser();

  /**
   * Log out the current user and redirect to /login.
   * Business logic delegated entirely to AuthService.
   */
  function handleLogout() {
    auth.logout();
    // No local state to clear: navigating re-renders, and the next render
    // reads the now-empty session straight from AuthService.
    navigate('/login');
  }

  return (
    <nav className="ems-nav" aria-label="Main navigation">
      <div className="ems-nav__brand">
        <NavLink to="/" className="ems-nav__logo">EMS</NavLink>
      </div>

      <div className="ems-nav__links">
        {!currentUser && <UnauthLinks />}
        {currentUser?.role === 'teacher' && (
          <TeacherLinks user={currentUser} onLogout={handleLogout} />
        )}
        {currentUser?.role === 'student' && (
          <StudentLinks user={currentUser} onLogout={handleLogout} />
        )}
      </div>
    </nav>
  );
}

// ── Unauthenticated nav ───────────────────────────────────────────────────────

function UnauthLinks() {
  return (
    <>
      <NavLink to="/login"    className="ems-nav__link">Login</NavLink>
      <NavLink to="/register" className="ems-nav__link">Register</NavLink>
    </>
  );
}

// ── Teacher nav ────────────────────────────────────────────────────────────────

function TeacherLinks({ user, onLogout }) {
  return (
    <>
      <NavLink to="/teacher"             className="ems-nav__link">Dashboard</NavLink>
      <NavLink to="/teacher/exams"       className="ems-nav__link">My Exams</NavLink>
      <NavLink to="/teacher/exams/new"   className="ems-nav__link">New Exam</NavLink>
      <NavLink to="/teacher/exams/generate" className="ems-nav__link">✨ Generate</NavLink>
      <NavLink to="/teacher/submissions" className="ems-nav__link">Submissions</NavLink>
      <NavLink to="/teacher/analytics"   className="ems-nav__link">Analytics</NavLink>
      <span className="ems-nav__user">
        {user.name} <span className="ems-nav__role-tag">(teacher)</span>
      </span>
      <button className="ems-nav__logout" onClick={onLogout}>Logout</button>
    </>
  );
}

// ── Student nav ────────────────────────────────────────────────────────────────

function StudentLinks({ user, onLogout }) {
  return (
    <>
      <NavLink to="/student"       className="ems-nav__link">Dashboard</NavLink>
      <NavLink to="/student/exams" className="ems-nav__link">Available Exams</NavLink>
      <NavLink to="/student/grades" className="ems-nav__link">Grades</NavLink>
      <span className="ems-nav__user">
        {user.name} <span className="ems-nav__role-tag">(student)</span>
      </span>
      <button className="ems-nav__logout" onClick={onLogout}>Logout</button>
    </>
  );
}

export default NavigationMenu;
