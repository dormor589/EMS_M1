/**
 * App.jsx — application root.
 *
 * Responsibilities:
 *   1. Verify the API is reachable before rendering, so a server that is down
 *      produces one clear message instead of every page failing separately.
 *   2. Re-validate any stored session against the server. A JWT can expire or
 *      be revoked while the tab is closed, and only the server knows.
 *   3. Wrap the route tree in BrowserRouter.
 *
 * Milestone 1 seeded a mock database here. That is gone: the data now lives in
 * PostgreSQL and is seeded server-side with `npm run db:seed`.
 *
 * Source: the milestone brief §6 Recommended Architecture
 */

import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { api, auth, config } from '../services/index.js';
import AppRoutes from './routes.jsx';

function App() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const health = await api.health();
      if (cancelled) return;

      if (!health.ok) {
        setStatus('offline');
        return;
      }
      // Confirm the stored token is still good before the guards trust it.
      await auth.refreshSession();
      if (!cancelled) setStatus('ready');
    })();

    return () => { cancelled = true; };
  }, []);

  if (status === 'checking') {
    return (
      <div className="ems-boot">
        <p className="ems-loading">Connecting to the server…</p>
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div className="ems-boot">
        <div className="ems-boot__card">
          <h1 className="ems-boot__title">Cannot reach the server</h1>
          <p>
            The API at <code>{config.getApiBaseUrl()}</code> is not responding.
          </p>
          <p className="ems-boot__hint">Start it with:</p>
          <pre className="ems-boot__code">cd server
npm run db:reset
npm start</pre>
          <button
            type="button"
            className="ems-btn ems-btn--primary"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
