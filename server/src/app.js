// Source: the milestone brief §5.2 Nice-to-Have — Initial backend Express skeleton
// Express skeleton — M1 scope: health endpoint only.
// Real routes, auth, and DB integration planned for M2.

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health endpoint
// Source: the milestone brief §5.2 — /health → { status: "ok", milestone: "M1", time: <ISO> }
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    milestone: 'M1',
    time: new Date().toISOString(),
  });
});

// Placeholder: routes will be wired in M2
// app.use('/api/auth', authRouter);
// app.use('/api/exams', examRouter);
// app.use('/api/submissions', submissionRouter);

app.listen(PORT, () => {
  console.info(`[EMS_M1] Server running on port ${PORT}`);
});

export default app;
