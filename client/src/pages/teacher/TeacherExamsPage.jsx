/**
 * TeacherExamsPage — list of the logged-in teacher's exams with status actions.
 *
 * Columns: title, status badge, duration, # questions, action buttons.
 * Action buttons per row:
 *   • Edit  — always visible (navigate to /teacher/exams/:id/edit)
 *   • Publish — shown only if status === 'Draft'
 *   • Close   — shown only if status === 'Published'
 *   (Both are absent for Closed exams)
 *
 * State transitions call ExamService.publishExam() / closeExam() which
 * enforce the state machine. After a transition the local list is refreshed.
 *
 * No business logic in JSX — data and transitions delegate to ExamService.
 *
 * Source: docs/spec_brief.txt §5.1 — Must-Have: teacher exam management
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, examService, notify } from '../../services/index.js';

function TeacherExamsPage() {
  const [exams, setExams]     = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate               = useNavigate();

  // ── Fetch teacher's exams ─────────────────────────────────────────────────

  const loadExams = useCallback(() => {
    const user = auth.getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }
    setLoading(true);
    examService
      .getExamsByTeacher(user.id)
      .then((data) => setExams(data))
      .catch((err) => notify.error(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  // ── Status transitions ────────────────────────────────────────────────────

  function handlePublish(examId) {
    examService
      .publishExam(examId)
      .then(() => {
        notify.success('Exam published successfully.');
        loadExams();
      })
      .catch((err) => notify.error(err.message));
  }

  function handleClose(examId) {
    examService
      .closeExam(examId)
      .then(() => {
        notify.success('Exam closed.');
        loadExams();
      })
      .catch((err) => notify.error(err.message));
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function statusBadge(status) {
    const cls = {
      Draft:     'ems-badge ems-badge--draft',
      Published: 'ems-badge ems-badge--published',
      Closed:    'ems-badge ems-badge--closed',
    }[status] || 'ems-badge';
    return <span className={cls}>{status}</span>;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">My Exams</h1>
        <p className="ems-loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className="ems-page">
      <h1 className="ems-page__title">My Exams</h1>

      <div style={{ marginBottom: '1rem' }}>
        <Link to="/teacher/exams/new" className="ems-btn ems-btn--primary">
          + Create New Exam
        </Link>
      </div>

      {exams.length === 0 ? (
        <p className="ems-empty">
          No exams yet.{' '}
          <Link to="/teacher/exams/new">Create your first exam</Link>.
        </p>
      ) : (
        <div className="ems-table-wrap">
          <table className="ems-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Questions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <td>{exam.title}</td>
                  <td>{statusBadge(exam.status)}</td>
                  <td>{exam.durationMinutes} min</td>
                  <td>{(exam.questions || []).length}</td>
                  <td>
                    <div className="ems-table__actions">
                      {/* Edit — always available */}
                      <Link
                        to={`/teacher/exams/${exam.id}/edit`}
                        className="ems-btn ems-btn--secondary ems-btn--sm"
                      >
                        Edit
                      </Link>

                      {/* Publish — only for Draft */}
                      {exam.status === 'Draft' && (
                        <button
                          className="ems-btn ems-btn--success ems-btn--sm"
                          onClick={() => handlePublish(exam.id)}
                        >
                          Publish
                        </button>
                      )}

                      {/* Close — only for Published */}
                      {exam.status === 'Published' && (
                        <button
                          className="ems-btn ems-btn--warning ems-btn--sm"
                          onClick={() => handleClose(exam.id)}
                        >
                          Close
                        </button>
                      )}
                    </div>
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

export default TeacherExamsPage;
