/**
 * SubmissionsPage — stub submissions review view for teachers.
 *
 * Full submission wiring (SubmissionService, per-exam grouping, grading)
 * is implemented in D007. This page reads raw mock data directly so the
 * route is navigable without crashing, and shows a placeholder when empty.
 *
 * D007 replaces this component with the full implementation.
 *
 * Source: docs/spec_brief.txt §5.1 — Teacher: review submissions (wired D007)
 */

import { useState, useEffect } from 'react';
import { mockApi, auth, notify } from '../../services/index.js';

function SubmissionsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    // Read raw submissions from mock API.
    // D007 will replace this with SubmissionService.getSubmissionsByTeacher().
    mockApi
      .get('submissions')
      .then((all) => {
        const user = auth.getCurrentUser();
        // Best-effort filter: if we can, show only submissions for this
        // teacher's exams. Without ExamService cross-ref here we show all.
        // D007 will do the proper join via SubmissionService.
        setSubmissions(user ? all : all);
      })
      .catch((err) => notify.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">Submissions</h1>
        <p className="ems-loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className="ems-page">
      <h1 className="ems-page__title">Submissions</h1>

      {submissions.length === 0 ? (
        <div className="ems-stub">
          <p>
            <strong>No submissions yet.</strong>
          </p>
          <p>
            Publish an exam so students can submit answers.
            Full submission review (grading, feedback) will be available once
            D007 is implemented.
          </p>
        </div>
      ) : (
        <>
          <div className="ems-form__banner">
            Full grading interface wired in D007. Showing raw submission records
            below.
          </div>
          <div className="ems-table-wrap">
            <table className="ems-table">
              <thead>
                <tr>
                  <th>Submission ID</th>
                  <th>Exam ID</th>
                  <th>Student ID</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {s.id}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {s.examId}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {s.studentId}
                    </td>
                    <td>
                      <span className="ems-badge ems-badge--draft">
                        {s.status}
                      </span>
                    </td>
                    <td>{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default SubmissionsPage;
