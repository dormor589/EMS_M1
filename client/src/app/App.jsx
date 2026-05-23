// Source: docs/spec_brief.txt §6 Recommended Architecture
// App root — seeds mock data on first mount, renders landing message.
// Full routing and pages wired in D005+.

import { useEffect, useState } from 'react';
import { mockApi } from '../services/index.js';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    mockApi.seedIfEmpty().then(() => setReady(true));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', textAlign: 'center' }}>
      <h1>EMS_M1 — {ready ? 'mock data seeded' : 'loading…'}</h1>
      <p>Full Stack Exam Management System</p>
      <p>
        {ready
          ? 'Mock DB ready. Login pages and routing wired in D004–D005.'
          : 'Seeding demo data into localStorage…'}
      </p>
    </div>
  );
}

export default App;
