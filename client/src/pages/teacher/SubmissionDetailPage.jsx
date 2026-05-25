/**
 * SubmissionDetailPage — teacher's view of one student submission with grading.
 *
 * Rendered at /teacher/submissions/:id (ProtectedRoute role="teacher").
 *
 * On mount:
 *   1. Fetch submission via submissionService.getSubmissionById(id).
 *   2. Concurrently fetch the related exam and the submitting student.
 *
 * Displays:
 *   - Header: exam title, student name, submitted-at, current grade.
 *   - Per-question read-only review: question text, type, student's answer.
 *   - Grading form at bottom: numeric grade 0–100 + optional feedback textarea.
 *     Form is pre-filled if the submission was previously graded.
 *
 * On grade save:
 *   submissionService.gradeSubmission(id, { grade, feedback }) → re-fetch.
 *
 * Failure modes:
 *   - Submission not found → "Submission not found" message + back link.
 *   - Exam deleted        → graceful "Exam no longer available" note.
 *   - Grade out of range  → rejected before service call.
 *
 * No business logic in JSX — validation delegate to service; UI only decides
 * when to call and how to display results.
 *
 * Source: the milestone brief §2 — Teacher capabilities: review submissions, grade exams
 * Source: the milestone brief §5.1 — Must-Have: teacher review + grading flow (D010)
 * Source: the milestone brief §7 — Submission entity fields
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { auth, examService, submissionService, notify } from '../../services/index.js';

function SubmissionDetailPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  // ── Data state ────────────────────────────────────────────────────────────────

  const [submission, setSubmission] = useState(null);
  const [exam,       setExam]       = useState(null);
  const [student,    setStudent]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [dataError,  setDataError]  = useState(null);

  // ── Grading form state ────────────────────────────────────────────────────────

  const [grade,    setGrade]    = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState(null);

  // ── Load ──────────────────────────────────────────────────────────────────────

  /**
   * Fetch submission + exam + student concurrently. Populates form if already graded.
   */
  const loadData = useCallback(async () => {
    const user = auth.getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setDataError(null);

    try {
      // Step 1: load submission.
      const sub = await submissionService.getSubmissionById(id);
      if (!sub) {
        setDataError('Submission not found.');
        return;
      }

      // Step 2: load exam + student concurrently.
      const [foundExam, foundStudent] = await Promise.all([
        examService.getExamById(sub.examId),
        auth.getUserById(sub.studentId),
      ]);

      setSubmission(sub);
      setExam(foundExam);     // may be null if exam was deleted
      setStudent(foundStudent);

      // Pre-fill grading form if a grade already exists.
      if (sub.grade !== null && sub.grade !== undefined) {
        setGrade(String(sub.grade));
        setFeedback(sub.feedback || '');
      }
    } catch (err) {
      setDataError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Grade submit ─────────────────────────────────────────────────────────────

  async function handleSaveGrade(e) {
    e.preventDefault();
    setFormErr(null);

    // Client-side validation — belt-and-suspenders on top of type="number" min/max.
    const numGrade = Number(grade);
    if (grade === '' || isNaN(numGrade)) {
      setFormErr('Grade is required and must be a number.');
      return;
    }
    if (numGrade < 0 || numGrade > 100) {
      setFormErr('Grade must be between 0 and 100.');
      return;
    }

    setSaving(true);
    try {
      await submissionService.gradeSubmission(submission.id, {
        grade:    numGrade,
        feedback: feedback.trim(),
      });
      notify.success('Grade saved successfully.');
      // Re-fetch so the header "Current grade" updates immediately.
      await loadData();
    } catch (err) {
      notify.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  /** Find the student's answer for a given question, or return "(no answer)". */
  function answerFor(questionId) {
    if (!submission?.answers) return '(no answer)';
    const found = submission.answers.find((a) => a.questionId === questionId);
    return found?.value?.trim() ? found.value : '(no answer)';
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">Submission Detail</h1>
        <p className="ems-loading">Loading…</p>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">Submission Detail</h1>
        <div className="ems-form__banner ems-form__banner--error">
          {dataError}
        </div>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/teacher/submissions" className="ems-btn ems-btn--secondary ems-btn--sm">
            ← Back to Submissions
          </Link>
        </p>
      </div>
    );
  }

  const questions = exam?.questions || [];
  const isGraded  = submission.status === 'graded';

  return (
    <div className="ems-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link to="/teacher/submissions" className="ems-btn ems-btn--secondary ems-btn--sm">
          ← Back
        </Link>
        <h1 className="ems-page__title" style={{ margin: 0 }}>Submission Detail</h1>
      </div>

      {/* ── Header ── */}
      <div className="ems-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <dl className="ems-detail-grid">
          <dt>Exam title</dt>
          <dd>
            {exam
              ? exam.title
              : <span style={{ color: '#94a3b8' }}>Exam no longer available</span>}
          </dd>

          <dt>Student</dt>
          <dd>
            {student
              ? <>{student.name} <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>({student.email})</span></>
              : <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{submission.studentId}</span>}
          </dd>

          <dt>Submitted at</dt>
          <dd>{new Date(submission.submittedAt).toLocaleString()}</dd>

          <dt>Status</dt>
          <dd>
            <span className={isGraded ? 'ems-badge ems-badge--published' : 'ems-badge ems-badge--draft'}>
              {submission.status}
            </span>
          </dd>

          <dt>Current grade</dt>
          <dd>
            {submission.grade !== null && submission.grade !== undefined
              ? <strong>{submission.grade} / 100</strong>
              : <span style={{ color: '#94a3b8' }}>Not yet graded</span>}
          </dd>

          {submission.feedback && (
            <>
              <dt>Feedback</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>{submission.feedback}</dd>
            </>
          )}
        </dl>
      </div>

      {/* ── Questions + answers (read-only) ── */}
      {questions.length === 0 && !exam && (
        <p className="ems-empty" style={{ marginBottom: '1.5rem' }}>
          Exam data unavailable — question list cannot be displayed.
        </p>
      )}

      {questions.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e3a5f' }}>
            Student Answers ({questions.length} question{questions.length !== 1 ? 's' : ''})
          </h2>

          {questions.map((q, idx) => (
            <div key={q.id} className="ems-question-card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: 700, color: '#1e3a5f', minWidth: '1.5rem' }}>
                  Q{idx + 1}.
                </span>
                <span style={{ fontWeight: 600 }}>{q.text}</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    background: '#e2e8f0',
                    borderRadius: '4px',
                    padding: '0 6px',
                    color: '#64748b',
                    marginLeft: 'auto',
                  }}
                >
                  {q.type === 'multiple-choice' ? 'Multiple choice' : 'Open text'}
                  {q.points ? ` · ${q.points} pt${q.points !== 1 ? 's' : ''}` : ''}
                </span>
              </div>

              {q.type === 'multiple-choice' && q.options?.length > 0 && (
                <ul style={{ margin: '0 0 0.5rem 2rem', padding: 0, color: '#64748b', fontSize: '0.875rem' }}>
                  {q.options.map((opt) => (
                    <li key={opt} style={{ listStyle: 'disc', marginBottom: '2px' }}>
                      {opt}
                      {q.correctAnswer === opt && (
                        <span style={{ color: '#16a34a', marginLeft: '0.4rem', fontSize: '0.75rem' }}>
                          ✓ correct
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div
                style={{
                  background: '#f8fafc',
                  border:     '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding:    '0.6rem 0.9rem',
                  marginLeft: '1.5rem',
                  fontSize:   '0.9rem',
                  color:      answerFor(q.id) === '(no answer)' ? '#94a3b8' : '#1e293b',
                  fontStyle:  answerFor(q.id) === '(no answer)' ? 'italic' : 'normal',
                }}
              >
                {answerFor(q.id)}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Grading form ── */}
      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e3a5f' }}>
          {isGraded ? 'Update Grade' : 'Grade This Submission'}
        </h2>

        <form onSubmit={handleSaveGrade} className="ems-form" style={{ maxWidth: '480px' }}>
          {formErr && (
            <div className="ems-form__banner ems-form__banner--error" style={{ marginBottom: '1rem' }}>
              {formErr}
            </div>
          )}

          <div className="ems-form__group">
            <label className="ems-form__label" htmlFor="grade-input">
              Grade (0–100)
            </label>
            <input
              id="grade-input"
              type="number"
              min="0"
              max="100"
              step="1"
              required
              className="ems-form__input"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="ems-form__group">
            <label className="ems-form__label" htmlFor="feedback-input">
              Feedback (optional)
            </label>
            <textarea
              id="feedback-input"
              className="ems-form__textarea"
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={saving}
              placeholder="Write feedback for the student…"
            />
          </div>

          <div className="ems-form__actions">
            <button
              type="submit"
              className="ems-btn ems-btn--primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save grade'}
            </button>
            <Link to="/teacher/submissions" className="ems-btn ems-btn--secondary">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}

export default SubmissionDetailPage;
