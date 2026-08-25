/**
 * SubmissionsPage — teacher's view of all submissions across their exams.
 *
 * Groups submissions by exam: one section per exam the teacher owns, each
 * showing a table of submitted student responses (student ID, submitted date,
 * current status, and grade if any).
 *
 * Data strategy:
 *   1. getExamsByTeacher(user.id)          — the teacher's exams
 *   2. getSubmissionsByExam(exam.id) x N   — fetched concurrently
 *
 * There is no "all submissions" endpoint by design: the API scopes submissions
 * to an exam and checks that the caller owns it, so a teacher cannot read
 * another teacher's submissions. N is the teacher's own exam count, and the
 * requests run in parallel.
 *
 * No business logic in JSX.
 *
 * Source: the milestone brief §5.1 — Teacher: review submissions
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, examService, submissionService, notify } from '../../services/index.js';

function SubmissionsPage() {
  const navigate = useNavigate();

  // groups: [{ exam, submissions: [] }]
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }

    examService
      .getExamsByTeacher(user.id)
      .then(async (myExams) => {
        const perExam = await Promise.all(
          myExams.map((exam) => submissionService.getSubmissionsByExam(exam.id))
        );

        const grouped = myExams.map((exam, i) => ({
          exam,
          submissions: [...perExam[i]].sort(
            (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
          ),
        }));

        // Show exams with submissions first, then empty ones.
        grouped.sort((a, b) => b.submissions.length - a.submissions.length);

        setGroups(grouped);
      })
      .catch((err) => notify.error(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">Submissions</h1>
        <p className="ems-loading">Loading…</p>
      </div>
    );
  }

  const totalSubmissions = groups.reduce((sum, g) => sum + g.submissions.length, 0);

  return (
    <div className="ems-page">
      <h1 className="ems-page__title">Submissions</h1>

      {groups.length === 0 ? (
        <div className="ems-stub">
          <p><strong>No exams yet.</strong></p>
          <p>Create and publish an exam so students can submit answers.</p>
        </div>
      ) : (
        <>
          <p className="ems-page__lead">
            {totalSubmissions} submission{totalSubmissions !== 1 ? 's' : ''} across{' '}
            {groups.length} exam{groups.length !== 1 ? 's' : ''}.
            Grading UI available in M2.
          </p>

          {groups.map(({ exam, submissions }) => (
            <div key={exam.id} className="ems-subs-group">
              <div className="ems-subs-group__header">
                <h2 className="ems-subs-group__title">
                  {exam.title}
                </h2>
                <span
                  className={
                    exam.status === 'Published'
                      ? 'ems-badge ems-badge--published'
                      : exam.status === 'Draft'
                      ? 'ems-badge ems-badge--draft'
                      : 'ems-badge ems-badge--closed'
                  }
                >
                  {exam.status}
                </span>
                <span className="ems-subs-group__count">
                  {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
                </span>
              </div>

              {submissions.length === 0 ? (
                <p className="ems-empty">
                  No submissions for this exam yet.
                </p>
              ) : (
                <div className="ems-table-wrap">
                  <table className="ems-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Submitted At</th>
                        <th>Status</th>
                        <th>Grade</th>
                        <th>Answers</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((s) => (
                        <tr key={s.id}>
                          <td className="ems-td-mono">
                            {s.studentId}
                          </td>
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
                              ? <strong>{s.grade} / 100</strong>
                              : <span className="ems-faint">—</span>}
                          </td>
                          <td className="ems-td-muted">
                            {(s.answers || []).length} answer
                            {(s.answers || []).length !== 1 ? 's' : ''}
                          </td>
                          <td>
                            <Link
                              to={`/teacher/submissions/${s.id}`}
                              className="ems-btn ems-btn--secondary ems-btn--sm"
                            >
                              {s.status === 'graded' ? 'Review' : 'Grade'}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default SubmissionsPage;
