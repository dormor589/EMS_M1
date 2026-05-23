/**
 * App.jsx — application root.
 *
 * Responsibilities (D004 scope):
 *  1. Seed mock DB on first mount via mockApi.seedIfEmpty().
 *  2. Read initial auth state from AuthService (localStorage-backed).
 *  3. Wrap with BrowserRouter and render route table.
 *  4. Propagate auth-state changes up from Login/Register/Logout.
 *
 * Full role-aware layout (MainLayout, NavigationMenu, route guards) wired in D005.
 *
 * Source: docs/spec_brief.txt §6 Recommended Architecture
 */

import { useEffect, useState } from 'react';
import { BrowserRouter }       from 'react-router-dom';
import { mockApi, auth }       from '../services/index.js';
import AppRoutes               from './routes.jsx';

function App() {
  // currentUser is null until seedIfEmpty resolves; then read from AuthService.
  const [currentUser, setCurrentUser] = useState(null);
  const [ready, setReady]             = useState(false);

  useEffect(() => {
    // Seed mock DB (no-op if already populated), then hydrate auth state.
    // No business logic here — delegated to mockApi and auth services.
    mockApi.seedIfEmpty().then(() => {
      setCurrentUser(auth.getCurrentUser());
      setReady(true);
    });
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
      <AppRoutes currentUser={currentUser} onAuthChange={setCurrentUser} />
    </BrowserRouter>
  );
}

export default App;
