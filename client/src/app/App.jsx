/**
 * App.jsx — application root.
 *
 * Responsibilities:
 *   1. Seed mock DB on first mount (no-op if already populated).
 *   2. Wrap with BrowserRouter.
 *   3. Render AppRoutes (the full route tree with MainLayout shell).
 *
 * Auth state is managed by NavigationMenu (reads on location change) and
 * ProtectedRoute (reads on each render). No top-level prop drilling needed.
 *
 * Source: the milestone brief §6 Recommended Architecture
 */

import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { mockApi } from '../services/index.js';
import AppRoutes  from './routes.jsx';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Seed mock DB once; no-op on subsequent mounts.
    // No business logic — delegated to MockApiService.
    mockApi.seedIfEmpty().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '4rem' }}>
        <p>Loading EMS_M1…</p>
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
