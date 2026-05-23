/**
 * TeacherDashboard — summary counters and navigation shortcuts.
 *
 * Reads the current teacher's exams via ExamService and displays:
 *   • Total exams created by this teacher
 *   • Draft count
 *   • Published count
 *   • Submissions count (stub — 0 until D007 wires SubmissionService)
 *
 * No business logic in JSX — all data fetching delegates to ExamService.
 *
 * Source: docs/spec_brief.txt §5.2 — Nice-to-Have: dashboard counters
 * Source: docs/spec_brief.txt §5.1 — Must-Have: teacher flow
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, examService } from '../../services/index.js';

function TeacherDashboard() {
  const [exams, setExams]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.getCurrentUser();
    if (!user) return;

    examService
      .getExamsByTeacher(user.id)
      .then((data) => {
        setExams(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Derive counters from the loaded list — no extra service calls needed.
  const totalExams     = exams.length;
  const draftCount     = exams.filter((e) => e.status === 'Draft').length;
  const publishedCount = exams.filter((e) => e.status === 'Published').length;
  const closedCount    = exams.filter((e) => e.status === 'Closed').length;
  // Submissions count: stub (0) until SubmissionService is wired in D007.
  const submissionsCount = 0;

  if (loading) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">Teacher Dashboard</h1>
        <p className="ems-loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className="ems-page">
      <h1 className="ems-page__title">Teacher Dashboard</h1>

      {/* ── Counter cards ──────────────────────────────────────────────── */}
      <div className="ems-dashboard__grid">
        <div className="ems-card">
          <div className="ems-card__value">{totalExams}</div>
          <div className="ems-card__label">Total Exams</div>
        </div>
        <div className="ems-card">
          <div className="ems-card__value">{draftCount}</div>
          <div className="ems-card__label">Draft</div>
        </div>
        <div className="ems-card">
          <div className="ems-card__value">{publishedCount}</div>
          <div className="ems-card__label">Published</div>
        </div>
        <div className="ems-card">
          <div className="ems-card__value">{closedCount}</div>
          <div className="ems-card__label">Closed</div>
        </div>
        <div className="ems-card">
          <div className="ems-card__value">{submissionsCount}</div>
          <div className="ems-card__label">Submissions</div>
        </div>
      </div>

      {/* ── Quick links ────────────────────────────────────────────────── */}
      <div className="ems-dashboard__actions">
        <Link to="/teacher/exams/new" className="ems-btn ems-btn--primary">
          + Create New Exam
        </Link>
        <Link to="/teacher/exams" className="ems-btn ems-btn--secondary">
          View My Exams
        </Link>
        <Link to="/teacher/submissions" className="ems-btn ems-btn--secondary">
          Submissions
        </Link>
      </div>
    </div>
  );
}

export default TeacherDashboard;
