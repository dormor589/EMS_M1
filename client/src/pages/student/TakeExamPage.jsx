/**
 * TakeExamPage — exam-taking view with per-question answer inputs.
 *
 * Question rendering per spec §7:
 *   • multiple-choice → radio buttons, one per option
 *   • open-text       → textarea
 *
 * Entry guards (checked on load):
 *   1. Exam must exist.
 *   2. Exam must be Published — student cannot take a Draft or Closed exam.
 *   3. Student must not have already submitted this exam — redirect to /student/grades.
 *
 * Draft auto-save (Nice-to-Have §5.2):
 *   Answers are saved to StorageService on every change under the key
 *   `ems_draft_${examId}_${studentId}`.  On mount the draft is rehydrated
 *   so the student can resume if they navigate away.  The draft is cleared
 *   after a successful submit.
 *
 * Submit:
 *   Calls SubmissionService.submitExam(). On success clears draft, notifies,
 *   navigates to /student/grades.
 *
 * Validation: warns (inline) if questions are left unanswered, but allows
 * submission (M2 will enforce stricter rules).
 *
 * No business logic in JSX — all service calls delegate to SubmissionService.
 *
 * Source: the milestone brief §5.1 — Student can open an exam and submit
 * Source: the milestone brief §7 — Question types: multiple-choice, open-text
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { auth, examService, submissionService, storage, notify } from '../../services/index.js';

/** StorageService key for a student's in-progress draft answers. */
const draftKey = (examId, studentId) => `ems_draft_${examId}_${studentId}`;

function TakeExamPage() {
  const { id: examId } = useParams();
  const navigate        = useNavigate();

  const [exam,          setExam]          = useState(null);
  const [answers,       setAnswers]       = useState({});  // { [questionId]: string }
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [unansweredIds, setUnansweredIds] = useState([]);

  // ── Load exam + guard checks ───────────────────────────────────────────────

  const loadExam = useCallback(() => {
    const user = auth.getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }

    Promise.all([
      examService.getExamById(examId),
      submissionService.getSubmissionByExamAndStudent(examId, user.id),
    ])
      .then(([foundExam, existingSubmission]) => {
        // Guard 1: exam not found
        if (!foundExam) {
          setError('Exam not found.');
          setLoading(false);
          return;
        }

        // Guard 2: exam not Published (critical — students must not see Draft/Closed)
        if (foundExam.status !== 'Published') {
          setError(
            `This exam is not currently available (status: ${foundExam.status}).`
          );
          setLoading(false);
          return;
        }

        // Guard 3: already submitted — redirect to grades
        if (existingSubmission) {
          navigate('/student/grades', { replace: true });
          return;
        }

        setExam(foundExam);

        // Rehydrate draft answers if available (Nice-to-Have §5.2).
        const draft = storage.get(draftKey(examId, user.id));
        if (draft && typeof draft === 'object') {
          setAnswers(draft);
        }

        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [examId, navigate]);

  useEffect(() => {
    loadExam();
  }, [loadExam]);

  // ── Answer change handler — also auto-saves draft ─────────────────────────

  function handleAnswer(questionId, value) {
    setAnswers((prev) => {
      const updated = { ...prev, [questionId]: value };

      // Auto-save draft to StorageService (Nice-to-Have §5.2).
      // StorageService is the ONLY file allowed to touch localStorage.
      const user = auth.getCurrentUser();
      if (user) {
        storage.set(draftKey(examId, user.id), updated);
      }

      return updated;
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit(e) {
    e.preventDefault();

    const user = auth.getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }

    // Warn on unanswered questions (soft — do not block submission).
    const missing = (exam.questions || [])
      .filter((q) => !answers[q.id] || answers[q.id].trim() === '')
      .map((q) => q.id);
    setUnansweredIds(missing);

    // Build answers array: { questionId, value } per spec §7 — Answer entity.
    const answersPayload = (exam.questions || []).map((q) => ({
      questionId: q.id,
      value:      answers[q.id] || '',
    }));

    setSubmitting(true);
    submissionService
      .submitExam({ examId: exam.id, studentId: user.id, answers: answersPayload })
      .then(() => {
        // Clear draft on successful submit.
        storage.remove(draftKey(examId, user.id));
        notify.success('Exam submitted successfully!');
        navigate('/student/grades');
      })
      .catch((err) => {
        notify.error(err.message);
        setSubmitting(false);
      });
  }

  // ── Early exits ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">Loading Exam…</h1>
        <p className="ems-loading">Please wait…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">Exam Unavailable</h1>
        <p className="ems-form__error">{error}</p>
        <Link to="/student/exams" className="ems-btn ems-btn--secondary">
          Back to Available Exams
        </Link>
      </div>
    );
  }

  const questions = exam.questions || [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ems-page">
      <h1 className="ems-page__title">{exam.title}</h1>

      {exam.description && (
        <p className="ems-page__subtitle">{exam.description}</p>
      )}

      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Duration: <strong>{exam.durationMinutes} minutes</strong> ·{' '}
        {questions.length} question{questions.length !== 1 ? 's' : ''}
      </p>

      {unansweredIds.length > 0 && (
        <div className="ems-form__banner" role="alert">
          ⚠️ {unansweredIds.length} question
          {unansweredIds.length > 1 ? 's are' : ' is'} unanswered.
          You may still submit, but unanswered questions will count as blank.
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {questions.map((q, idx) => {
          const isUnanswered = unansweredIds.includes(q.id);
          return (
            <div
              key={q.id}
              className="ems-question-card"
              style={isUnanswered ? { borderColor: '#f59e0b' } : {}}
            >
              <div className="ems-question-card__header">
                <span className="ems-question-card__title">
                  Question {idx + 1}
                  {q.points > 1 && (
                    <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: '0.4rem' }}>
                      ({q.points} pts)
                    </span>
                  )}
                </span>
                {isUnanswered && (
                  <span style={{ color: '#d97706', fontSize: '0.78rem', fontWeight: 600 }}>
                    Unanswered
                  </span>
                )}
              </div>

              <p style={{ margin: '0 0 0.85rem', lineHeight: 1.5 }}>{q.text}</p>

              {/* ── Multiple-choice: radio buttons ─────────────────────── */}
              {q.type === 'multiple-choice' && (
                <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                  <legend className="ems-form__label" style={{ marginBottom: '0.5rem' }}>
                    Select one answer:
                  </legend>
                  {(q.options || []).map((opt, oi) => (
                    <label
                      key={oi}
                      style={{
                        display:     'flex',
                        alignItems:  'center',
                        gap:         '0.5rem',
                        marginBottom: '0.4rem',
                        cursor:      'pointer',
                        fontSize:    '0.9rem',
                      }}
                    >
                      <input
                        type="radio"
                        name={`question-${q.id}`}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => handleAnswer(q.id, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </fieldset>
              )}

              {/* ── Open-text: textarea ────────────────────────────────── */}
              {q.type === 'open-text' && (
                <div className="ems-form__group">
                  <label className="ems-form__label" htmlFor={`ot-${q.id}`}>
                    Your answer:
                  </label>
                  <textarea
                    id={`ot-${q.id}`}
                    className="ems-form__textarea"
                    rows={4}
                    value={answers[q.id] || ''}
                    onChange={(e) => handleAnswer(q.id, e.target.value)}
                    placeholder="Write your answer here…"
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* ── Actions ────────────────────────────────────────────────── */}
        <div className="ems-form__actions" style={{ marginTop: '1.5rem' }}>
          <button
            type="submit"
            className="ems-btn ems-btn--primary"
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Submit Answers'}
          </button>
          <Link to="/student/exams" className="ems-btn ems-btn--secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default TakeExamPage;
