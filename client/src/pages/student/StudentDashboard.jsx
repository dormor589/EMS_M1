/**
 * StudentDashboard — summary counters and navigation shortcuts for students.
 *
 * Counters:
 *   • Available  — Published exams the student has NOT yet submitted.
 *   • Submitted  — Submissions with status 'submitted' (not yet graded).
 *   • Graded     — Submissions with status 'graded'.
 *
 * Fetches both published exams and the student's submissions concurrently
 * (Promise.all) to avoid serial waterfall. Derives all counts in JS.
 *
 * No business logic in JSX — all data from ExamService + SubmissionService.
 *
 * Source: the milestone brief §5.1 — Must-Have: student dashboard
 * Source: the milestone brief §5.2 — Nice-to-Have: simple dashboard counters
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, examService, submissionService } from '../../services/index.js';

function StudentDashboard() {
  const navigate = useNavigate();

  const [availableCount, setAvailableCount] = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [gradedCount,    setGradedCount]    = useState(0);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    const user = auth.getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }

    // Fetch published exams + student submissions concurrently.
    Promise.all([
      examService.getPublishedExams(),
      submissionService.getSubmissionsByStudent(user.id),
    ])
      .then(([publishedExams, mySubmissions]) => {
        // Available = published exams the student hasn't already submitted.
        const submittedExamIds = new Set(mySubmissions.map((s) => s.examId));
        const available = publishedExams.filter((e) => !submittedExamIds.has(e.id)).length;

        const submitted = mySubmissions.filter((s) => s.status === 'submitted').length;
        const graded    = mySubmissions.filter((s) => s.status === 'graded').length;

        setAvailableCount(available);
        setSubmittedCount(submitted);
        setGradedCount(graded);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">Student Dashboard</h1>
        <p className="ems-loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className="ems-page">
      <h1 className="ems-page__title">Student Dashboard</h1>

      {/* ── Counter cards ──────────────────────────────────────────────── */}
      <div className="ems-dashboard__grid">
        <div className="ems-card">
          <div className="ems-card__value">{availableCount}</div>
          <div className="ems-card__label">Available Exams</div>
        </div>
        <div className="ems-card">
          <div className="ems-card__value">{submittedCount}</div>
          <div className="ems-card__label">Submitted</div>
        </div>
        <div className="ems-card">
          <div className="ems-card__value">{gradedCount}</div>
          <div className="ems-card__label">Graded</div>
        </div>
      </div>

      {/* ── Quick links ────────────────────────────────────────────────── */}
      <div className="ems-dashboard__actions">
        <Link to="/student/exams" className="ems-btn ems-btn--primary">
          View Available Exams
        </Link>
        <Link to="/student/grades" className="ems-btn ems-btn--secondary">
          View My Grades
        </Link>
      </div>
    </div>
  );
}

export default StudentDashboard;
