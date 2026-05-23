/**
 * SubmissionsPage — teacher's view of all submissions across their exams.
 *
 * Groups submissions by exam: one section per exam the teacher owns, each
 * showing a table of submitted student responses (student ID, submitted date,
 * current status, and grade if any).
 *
 * Data strategy (2 API calls total, no N+1):
 *   1. getExamsByTeacher(user.id)  — teacher's exam list
 *   2. mockApi.get('submissions')  — all submissions (filter in JS)
 * Both are fetched concurrently via Promise.all.
 *
 * Grading UI is M2 — this page is read-only in M1.
 *
 * No business logic in JSX.
 *
 * Source: docs/spec_brief.txt §5.1 — Teacher: review submissions
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, examService, mockApi, notify } from '../../services/index.js';

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

    // Fetch teacher's exams + all submissions concurrently (2 calls, filter in JS).
    Promise.all([
      examService.getExamsByTeacher(user.id),
      mockApi.get('submissions'),
    ])
      .then(([myExams, allSubmissions]) => {
        const myExamIds = new Set(myExams.map((e) => e.id));

        // Filter submissions to only those for this teacher's exams.
        const mine = allSubmissions.filter((s) => myExamIds.has(s.examId));

        // Group by exam.
        const grouped = myExams.map((exam) => ({
          exam,
          submissions: mine
            .filter((s) => s.examId === exam.id)
            .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)),
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
          <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {totalSubmissions} submission{totalSubmissions !== 1 ? 's' : ''} across{' '}
            {groups.length} exam{groups.length !== 1 ? 's' : ''}.
            Grading UI available in M2.
          </p>

          {groups.map(({ exam, submissions }) => (
            <div key={exam.id} style={{ marginBottom: '2rem' }}>
              <div
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            '0.75rem',
                  marginBottom:   '0.6rem',
                  borderBottom:   '2px solid #e2e8f0',
                  paddingBottom:  '0.4rem',
                }}
              >
                <h2
                  style={{
                    margin:   0,
                    fontSize: '1rem',
                    fontWeight: 700,
                    color:    '#1e3a5f',
                  }}
                >
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
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                  {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
                </span>
              </div>

              {submissions.length === 0 ? (
                <p className="ems-empty" style={{ paddingLeft: '0.5rem' }}>
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
                          <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                            {s.studentId}
                          </td>
                          <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
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
                              : <span style={{ color: '#94a3b8' }}>—</span>}
                          </td>
                          <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
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
