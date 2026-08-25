/**
 * GradesPage — student's submission history with grades and feedback.
 *
 * Fetches the student's submissions then resolves each exam title by joining
 * against a single getAllExams() call (one round-trip, not N+1).
 *
 * Columns: Exam Title | Submitted | Grade | Feedback
 *   • Grade:    numeric if graded, "Not yet graded" otherwise.
 *   • Feedback: teacher's text if present, "—" otherwise.
 *
 * No business logic in JSX.
 *
 * Source: the milestone brief §5.1 — Student can view submitted grade/feedback
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, examService, submissionService } from '../../services/index.js';

function GradesPage() {
  const navigate = useNavigate();

  // Each row: { submission, examTitle }
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }

    // Fetch submissions + all exams concurrently; join by examId in JS.
    Promise.all([
      submissionService.getSubmissionsByStudent(user.id),
      examService.getAllExams(),
    ])
      .then(([submissions, allExams]) => {
        const examMap = {};
        allExams.forEach((e) => { examMap[e.id] = e.title; });

        const built = submissions.map((s) => ({
          submission: s,
          examTitle:  examMap[s.examId] || '(exam deleted)',
        }));

        // Most recent first.
        built.sort(
          (a, b) => new Date(b.submission.submittedAt) - new Date(a.submission.submittedAt)
        );

        setRows(built);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">My Grades</h1>
        <p className="ems-loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className="ems-page">
      <h1 className="ems-page__title">My Grades</h1>

      {rows.length === 0 ? (
        <p className="ems-empty">
          No submissions yet.{' '}
          <Link to="/student/exams">Take an available exam</Link>.
        </p>
      ) : (
        <div className="ems-table-wrap">
          <table className="ems-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Grade</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ submission: s, examTitle }) => (
                <tr key={s.id}>
                  <td>{examTitle}</td>
                  <td className="ems-td-muted">
                    {new Date(s.submittedAt).toLocaleString()}
                  </td>
                  <td>
                    <span
                      className={
                        s.status === 'graded'
                          ? 'ems-badge ems-badge--published'
                          : 'ems-badge ems-badge--draft'
                      }
                    >
                      {s.status}
                    </span>
                  </td>
                  <td>
                    {s.grade !== null && s.grade !== undefined
                      ? <strong>{s.grade}</strong>
                      : <span className="ems-faint">Not yet graded</span>}
                  </td>
                  <td className="ems-td-muted">
                    {s.feedback || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default GradesPage;
