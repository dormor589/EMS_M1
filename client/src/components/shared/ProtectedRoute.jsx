/**
 * ProtectedRoute — route guard component.
 *
 * Wraps a page component to enforce authentication and optional role restrictions:
 *   - Not authenticated → redirect to /login
 *   - Authenticated but wrong role → redirect to the user's own home (/teacher or /student)
 *   - Authenticated + role matches (or no role required) → render children
 *
 * Usage in routes.jsx:
 *   <ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>
 *   <ProtectedRoute>              <SomePage />          </ProtectedRoute>  // auth only
 *
 * Source: docs/spec_brief.txt §5.1 Must-Have — role-based access control
 */

import { Navigate } from 'react-router-dom';
import { auth } from '../../services/index.js';

/**
 * @param {{ role?: 'teacher'|'student', children: JSX.Element }} props
 * @returns {JSX.Element}
 */
function ProtectedRoute({ role, children }) {
  const user = auth.getCurrentUser();

  // Not logged in → go to login page.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Wrong role → redirect to the user's own home section.
  if (role && user.role !== role) {
    const home = user.role === 'teacher' ? '/teacher' : '/student';
    return <Navigate to={home} replace />;
  }

  return children;
}

export default ProtectedRoute;
