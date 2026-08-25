/**
 * TakeExamPage — sitting an exam.
 *
 * Milestone 1 collected answers in React state, saved a draft to localStorage,
 * and posted everything once at the end. Milestone 2 makes the attempt a real
 * server-side record:
 *
 *   1. Opening the page starts (or resumes) an attempt. The server fixes the
 *      deadline, so refreshing cannot buy more time.
 *   2. Answers autosave to the server, debounced. Closing the tab loses nothing,
 *      and the draft follows the student to another machine.
 *   3. A countdown runs to the server's deadline and submits automatically at
 *      zero. The server accepts that submission even though it arrives late,
 *      because the answers were captured before expiry.
 *
 * Multiple-choice answers are stored as the OPTION INDEX, which is what the
 * server marks against. Milestone 1 stored the option text.
 *
 * Source: the milestone brief §5.1 — Student can open an exam and submit
 * Source: the milestone brief §7 — Question types
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { submissionService, notify } from '../../services/index.js';

/** Idle time before an edit is pushed to the server. */
const AUTOSAVE_DELAY_MS = 1200;

/** Below this many seconds the timer turns red. */
const TIMER_WARNING_SECONDS = 60;

/**
 * Format seconds as mm:ss (or h:mm:ss beyond an hour).
 *
 * @param {number} total
 * @returns {string}
 */
function formatTime(total) {
  const s = Math.max(0, total);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function TakeExamPage() {
  const { id: examId } = useParams();
  const navigate = useNavigate();

  const [exam,      setExam]      = useState(null);
  const [answers,   setAnswers]   = useState({});   // { [questionId]: string }
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
  const [remaining, setRemaining] = useState(null);
  const [unansweredIds, setUnansweredIds] = useState([]);

  // Refs, not state: the autosave timer and the submit guard must not trigger
  // re-renders, and the countdown callback needs the latest values without
  // being re-created every second.
  const saveTimer   = useRef(null);
  const submittedRef = useRef(false);
  const answersRef  = useRef({});
  const attemptRef  = useRef(null);

  // ── Start or resume the attempt ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    submissionService
      .startAttempt(examId)
      .then((started) => {
        if (cancelled) return;

        // Held in a ref, not state: the id and deadline are read by callbacks
        // and never rendered, so storing them in state would re-render for
        // nothing.
        attemptRef.current = started;
        setExam(started.exam);
        setRemaining(started.secondsRemaining);

        // Rehydrate whatever was autosaved previously.
        const restored = {};
        for (const a of started.answers || []) restored[a.questionId] = a.value;
        setAnswers(restored);
        answersRef.current = restored;

        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        // Already submitted: the student belongs on their grades page.
        if (/already submitted/i.test(err.message)) {
          navigate('/student/grades', { replace: true });
          return;
        }
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [examId, navigate]);

  // ── Submit ───────────────────────────────────────────────────────────────

  const doSubmit = useCallback(
    async ({ auto }) => {
      if (submittedRef.current || !attemptRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);

      // Flush any pending autosave first, so the last keystrokes are not lost.
      clearTimeout(saveTimer.current);
      try {
        await submissionService.saveDraft(
          attemptRef.current.id,
          Object.entries(answersRef.current).map(([questionId, value]) => ({ questionId, value }))
        );
      } catch {
        // An autosave failure must not block the submission itself.
      }

      try {
        await submissionService.submitExam(attemptRef.current.id, { auto });
        notify.success(auto ? 'Time is up — your exam was submitted.' : 'Exam submitted.');
        navigate('/student/grades');
      } catch (err) {
        submittedRef.current = false;
        setSubmitting(false);
        notify.error(err.message);
      }
    },
    [navigate]
  );

  // ── Countdown ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (remaining === null || loading) return undefined;

    if (remaining <= 0) {
      // Deferred rather than called inline: doSubmit sets state before its
      // first await, and setting state synchronously inside an effect causes
      // a cascading render.
      const fire = setTimeout(() => doSubmit({ auto: true }), 0);
      return () => clearTimeout(fire);
    }

    const tick = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(tick);
  }, [remaining, loading, doSubmit]);

  // Clean up a pending autosave if the student navigates away.
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // ── Answering ────────────────────────────────────────────────────────────

  /**
   * Record an answer and schedule an autosave.
   *
   * Debounced so typing a sentence produces one request rather than one per
   * keystroke.
   *
   * @param {string} questionId
   * @param {string} value
   */
  function handleAnswer(questionId, value) {
    const updated = { ...answersRef.current, [questionId]: value };
    answersRef.current = updated;
    setAnswers(updated);

    clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(async () => {
      if (submittedRef.current) return;
      try {
        await submissionService.saveDraft(
          attemptRef.current.id,
          Object.entries(updated).map(([qid, v]) => ({ questionId: qid, value: v }))
        );
        setSaveState('saved');
      } catch (err) {
        setSaveState('idle');
        notify.error(`Could not save your answer: ${err.message}`);
      }
    }, AUTOSAVE_DELAY_MS);
  }

  function handleSubmit(e) {
    e.preventDefault();

    const missing = (exam.questions || [])
      .filter((q) => {
        const v = answers[q.id];
        return v === undefined || String(v).trim() === '';
      })
      .map((q) => q.id);
    setUnansweredIds(missing);

    doSubmit({ auto: false });
  }

  // ── Early exits ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="ems-page ems-page--exam">
        <h1 className="ems-page__title">Opening exam…</h1>
        <p className="ems-loading">Please wait…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ems-page ems-page--exam">
        <h1 className="ems-page__title">Exam unavailable</h1>
        <p className="ems-form__error">{error}</p>
        <Link to="/student/exams" className="ems-btn ems-btn--secondary">
          Back to available exams
        </Link>
      </div>
    );
  }

  const questions = exam.questions || [];
  const lowOnTime = remaining !== null && remaining <= TIMER_WARNING_SECONDS;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="ems-page ems-page--exam">
      <div className="ems-exam-header">
        <div>
          <h1 className="ems-page__title">{exam.title}</h1>
          {exam.description && <p className="ems-page__subtitle">{exam.description}</p>}
        </div>

        <div
          className={`ems-timer ${lowOnTime ? 'ems-timer--warning' : ''}`}
          role="timer"
          aria-live={lowOnTime ? 'assertive' : 'off'}
        >
          <span className="ems-timer__label">Time remaining</span>
          <span className="ems-timer__value">{formatTime(remaining ?? 0)}</span>
        </div>
      </div>

      <p className="ems-exam-meta">
        {questions.length} question{questions.length !== 1 ? 's' : ''}
        {' · '}
        <span className={`ems-save-state ems-save-state--${saveState}`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All answers saved' : 'Answers save automatically'}
        </span>
      </p>

      {unansweredIds.length > 0 && (
        <div className="ems-form__banner" role="alert">
          ⚠️ {unansweredIds.length} question
          {unansweredIds.length > 1 ? 's are' : ' is'} unanswered. You may still
          submit, but unanswered questions score zero.
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
                  {q.weight > 0 && (
                    <span className="ems-question-card__weight">
                      ({q.weight}% of the grade)
                    </span>
                  )}
                </span>
                {isUnanswered && <span className="ems-question-card__flag">Unanswered</span>}
              </div>

              <p className="ems-question-card__text">{q.text}</p>

              {q.type === 'multiple-choice' && (
                <fieldset className="ems-choice-set">
                  <legend className="ems-form__label">Select one answer:</legend>
                  {(q.options || []).map((opt, oi) => (
                    <label key={oi} className="ems-choice">
                      <input
                        type="radio"
                        name={`question-${q.id}`}
                        /* The INDEX is stored, because that is what the server
                           marks against — not the option's text. */
                        value={String(oi)}
                        checked={answers[q.id] === String(oi)}
                        onChange={() => handleAnswer(q.id, String(oi))}
                      />
                      {opt}
                    </label>
                  ))}
                </fieldset>
              )}

              {q.type === 'open-text' && (
                <div className="ems-form__group">
                  <label className="ems-form__label" htmlFor={`ot-${q.id}`}>
                    Your answer:
                  </label>
                  <textarea
                    id={`ot-${q.id}`}
                    className="ems-form__textarea"
                    rows={5}
                    value={answers[q.id] || ''}
                    onChange={(e) => handleAnswer(q.id, e.target.value)}
                    placeholder="Write your answer here…"
                  />
                </div>
              )}
            </div>
          );
        })}

        <div className="ems-form__actions">
          <button type="submit" className="ems-btn ems-btn--primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit answers'}
          </button>
          <Link to="/student/exams" className="ems-btn ems-btn--secondary">
            Leave (your answers are saved)
          </Link>
        </div>
      </form>
    </div>
  );
}

export default TakeExamPage;
