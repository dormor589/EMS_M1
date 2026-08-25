/**
 * AvailableExamsPage — lists Published exams the student has NOT yet submitted.
 *
 * CRITICAL (overlay rule): ONLY Published exams are shown. Draft and Closed
 * exams are never visible to students. This is enforced by using
 * ExamService.getPublishedExams() which hard-filters on status === 'Published'.
 *
 * Exams the student has already submitted are HIDDEN (not shown disabled) —
 * there is no value in surfacing a locked entry.  The student can see their
 * completed work on the GradesPage.
 *
 * Both data sources are fetched concurrently (Promise.all) to avoid waterfall.
 *
 * No business logic in JSX.
 *
 * Source: the milestone brief §5.1 — Student can view published exams only
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, examService, submissionService } from '../../services/index.js';

function AvailableExamsPage() {
  const navigate = useNavigate();

  const [exams,   setExams]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }

    // Fetch published exams + this student's submissions concurrently.
    Promise.all([
      examService.getPublishedExams(),
      submissionService.getSubmissionsByStudent(user.id),
    ])
      .then(([publishedExams, mySubmissions]) => {
        // Remove exams the student has already submitted.
        const submittedExamIds = new Set(mySubmissions.map((s) => s.examId));
        const available = publishedExams.filter((e) => !submittedExamIds.has(e.id));
        setExams(available);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">Available Exams</h1>
        <p className="ems-loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className="ems-page">
      <h1 className="ems-page__title">Available Exams</h1>

      {exams.length === 0 ? (
        <p className="ems-empty">
          No exams available right now. Check back later, or{' '}
          <Link to="/student/grades">view your submitted exams</Link>.
        </p>
      ) : (
        <div className="ems-table-wrap">
          <table className="ems-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Description</th>
                <th>Duration</th>
                <th>Questions</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <td>{exam.title}</td>
                  <td className="ems-td-muted">
                    {exam.description
                      ? exam.description.slice(0, 60) + (exam.description.length > 60 ? '…' : '')
                      : '—'}
                  </td>
                  <td>{exam.durationMinutes} min</td>
                  <td>{(exam.questions || []).length}</td>
                  <td>
                    <Link
                      to={`/student/exams/${exam.id}`}
                      className="ems-btn ems-btn--primary ems-btn--sm"
                    >
                      Start Exam
                    </Link>
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

export default AvailableExamsPage;
