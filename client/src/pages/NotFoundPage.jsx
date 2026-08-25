/**
 * NotFoundPage — 404 catch-all.
 *
 * Source: the milestone brief §6 Recommended Architecture
 */

import { Link } from 'react-router-dom';
import { auth } from '../services/index.js';

function NotFoundPage() {
  const user = auth.getCurrentUser();
  const home = user ? (user.role === 'teacher' ? '/teacher' : '/student') : '/login';

  return (
    <div className="ems-404">
      <h1>404 — Page Not Found</h1>
      <p>The page you requested does not exist.</p>
      <Link to={home} className="ems-btn ems-btn--secondary">Go to home</Link>
    </div>
  );
}

export default NotFoundPage;
