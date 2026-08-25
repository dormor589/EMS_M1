/**
 * SubmissionDetailPage — the teacher's marking screen for one submission.
 *
 * Milestone 1 offered a single 0–100 box for the whole submission. Marking is
 * now per question, and the overall grade is derived:
 *
 *     grade = sum(score x weight) / sum(weight)
 *
 * Multiple-choice questions are marked by the server from the answer key and
 * are shown read-only here — a teacher cannot accidentally mark a correct
 * answer wrong. Only open-text questions carry an editable score.
 *
 * Where the AI grading agent has already run, its proposal is displayed
 * alongside the teacher's value, so an override is visible rather than silently
 * overwriting what the model said.
 *
 * Saving has two outcomes:
 *   Save draft — kept for the teacher, invisible to the student
 *   Publish    — released; the student can now see the grade and feedback
 *
 * Source: the milestone brief §5.1 — Teacher: review submissions, grade, publish
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { submissionService, aiService, notify } from '../../services/index.js';

/**
 * Preview the grade the server will compute, so the total updates as the
 * teacher types rather than only after saving. Deliberately the same formula
 * as services/grading.js on the server.
 *
 * @param {object[]} questions
 * @param {Record<string, {score: string}>} marks
 * @returns {number}
 */
function previewGrade(questions, marks) {
  const totalWeight = questions.reduce((sum, q) => sum + (q.weight || 0), 0);
  if (!totalWeight) return 0;

  const earned = questions.reduce((sum, q) => {
    const raw = marks[q.id]?.score;
    const score = raw === '' || raw === undefined ? 0 : Number(raw);
    return sum + (Number.isFinite(score) ? score : 0) * (q.weight || 0);
  }, 0);

  return Math.round((earned / totalWeight) * 100) / 100;
}

/** @param {string} iso @returns {string} */
const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function SubmissionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [marks, setMarks] = useState({});   // { [questionId]: { score, feedback } }
  const [overallFeedback, setOverallFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiMeta, setAiMeta] = useState(null);
  const [error, setError] = useState('');

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const sub = await submissionService.getSubmissionById(id);
      if (!sub) {
        setError('Submission not found.');
        return;
      }

      const byQuestion = {};
      for (const q of sub.exam?.questions || []) {
        const answer = (sub.answers || []).find((a) => a.questionId === q.id);

        let score;
        if (q.type === 'multiple-choice') {
          // Multiple choice is already decided by the answer key, whether or not
          // the submission has been graded yet. Seeding it here means the total
          // reads correctly on arrival instead of showing 0 until the first save.
          score = answer ? (answer.isCorrect ? 100 : 0) : 0;
        } else {
          // An unmarked open-text question stays blank, so "not yet marked" is
          // distinguishable from "marked zero".
          score = answer?.score ?? answer?.aiScore ?? '';
        }

        byQuestion[q.id] = {
          score,
          feedback: answer?.feedback || answer?.aiFeedback || '',
        };
      }

      setSubmission(sub);
      setMarks(byQuestion);
      setOverallFeedback(sub.feedback || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // load() is async and awaits the API before touching state, so nothing is
  // set synchronously here. The rule cannot see through the async boundary.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // ── Derived ──────────────────────────────────────────────────────────────

  // Memoised because `?? []` would otherwise produce a new array identity on
  // every render, defeating the useMemo below that depends on it.
  const questions = useMemo(() => submission?.exam?.questions ?? [], [submission]);

  const answerByQuestion = useMemo(() => {
    const map = {};
    for (const a of submission?.answers || []) map[a.questionId] = a;
    return map;
  }, [submission]);

  const grade = useMemo(() => previewGrade(questions, marks), [questions, marks]);
  const passingGrade = submission?.exam?.passingGrade ?? 60;

  // ── Save ─────────────────────────────────────────────────────────────────

  /** @param {boolean} publish */
  async function save(publish) {
    setSaving(true);
    try {
      const payload = questions
        .filter((q) => answerByQuestion[q.id])
        .map((q) => ({
          questionId: q.id,
          // Multiple choice is marked server-side from the answer key; sending a
          // score for it would be ignored anyway.
          ...(q.type === 'open-text' && marks[q.id]?.score !== ''
            ? { score: Number(marks[q.id].score) }
            : {}),
          feedback: marks[q.id]?.feedback ?? '',
        }));

      await submissionService.gradeSubmission(id, {
        answers: payload,
        feedback: overallFeedback,
        publish,
      });

      notify.success(publish ? 'Grade published to the student.' : 'Draft saved.');
      if (publish) navigate('/teacher/submissions');
      else await load();
    } catch (err) {
      notify.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Run the AI marking pass.
   *
   * Multiple-choice is marked from the answer key server-side; only open-text
   * answers reach the model. The result is a DRAFT — the student sees nothing
   * until the teacher publishes it.
   */
  async function runAiGrading() {
    setAiRunning(true);
    try {
      const result = await aiService.gradeSubmission(id);
      setAiMeta({ gradedBy: result.gradedBy, modelBacked: result.modelBacked });
      notify.success(
        result.modelBacked
          ? 'AI grading complete — review the marks before publishing.'
          : 'Graded with the built-in scorer — review carefully before publishing.'
      );
      await load();
    } catch (err) {
      notify.error(err.message);
    } finally {
      setAiRunning(false);
    }
  }

  // ── Early exits ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">Submission</h1>
        <p className="ems-loading">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">Submission unavailable</h1>
        <p className="ems-form__error">{error}</p>
        <Link to="/teacher/submissions" className="ems-btn ems-btn--secondary">
          Back to submissions
        </Link>
      </div>
    );
  }

  const isPublished = submission.status === 'graded';

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="ems-page">
      <h1 className="ems-page__title">{submission.exam?.title}</h1>
      <p className="ems-page__subtitle">
        {submission.student?.name ?? 'Unknown student'} · {submission.student?.email}
      </p>

      {submission.needsRegrade && (
        <div className="ems-form__banner" role="alert">
          ⚠️ This exam was edited after the student submitted. The marks below may
          no longer be correct — please review before publishing.
        </div>
      )}

      <div className="ems-ai-bar">
        <button
          type="button"
          className="ems-btn ems-btn--ai"
          onClick={runAiGrading}
          disabled={aiRunning || saving}
        >
          {aiRunning ? 'Grading…' : '✨ Run AI grading'}
        </button>
        <span className="ems-form__hint">
          {aiMeta
            ? `Graded by ${aiMeta.gradedBy}. Edit anything below, then publish.`
            : 'Marks every answer and leaves the result as a draft for you to review.'}
        </span>
      </div>

      <div className="ems-grade-summary">
        <div className="ems-grade-summary__score">
          <span className="ems-grade-summary__value">{grade}</span>
          <span className="ems-grade-summary__max">/ 100</span>
          <span className={`ems-badge ${grade >= passingGrade ? 'ems-badge--pass' : 'ems-badge--fail'}`}>
            {grade >= passingGrade ? 'Pass' : 'Fail'}
          </span>
        </div>
        <dl className="ems-grade-summary__meta">
          <div><dt>Submitted</dt><dd>{formatDate(submission.submittedAt)}</dd></div>
          <div><dt>Status</dt><dd>{isPublished ? 'Published to student' : 'Not yet published'}</dd></div>
          <div><dt>Pass mark</dt><dd>{passingGrade}</dd></div>
          {submission.gradedBy && <div><dt>Graded by</dt><dd>{submission.gradedBy}</dd></div>}
        </dl>
      </div>

      {questions.map((q, idx) => {
        const answer = answerByQuestion[q.id];
        const isMultipleChoice = q.type === 'multiple-choice';
        const chosenIndex = answer ? Number(answer.value) : null;

        return (
          <div key={q.id} className="ems-question-card">
            <div className="ems-question-card__header">
              <span className="ems-question-card__title">
                Question {idx + 1}
                <span className="ems-question-card__weight">({q.weight}% of the grade)</span>
              </span>
              {isMultipleChoice && answer && (
                <span className={`ems-badge ${answer.isCorrect ? 'ems-badge--pass' : 'ems-badge--fail'}`}>
                  {answer.isCorrect ? 'Correct' : 'Incorrect'}
                </span>
              )}
            </div>

            <p className="ems-question-card__text">{q.text}</p>

            {!answer && <p className="ems-answer ems-answer--blank">No answer given.</p>}

            {answer && isMultipleChoice && (
              <ul className="ems-options-review">
                {(q.options || []).map((opt, oi) => {
                  const isChosen = oi === chosenIndex;
                  const isKey = oi === q.correctAnswer;
                  return (
                    <li
                      key={oi}
                      className={`ems-options-review__item${isChosen ? ' is-chosen' : ''}${isKey ? ' is-key' : ''}`}
                    >
                      {opt}
                      {isChosen && <span className="ems-tag">student's answer</span>}
                      {isKey && <span className="ems-tag ems-tag--key">correct</span>}
                    </li>
                  );
                })}
              </ul>
            )}

            {answer && !isMultipleChoice && (
              <>
                <blockquote className="ems-answer">{answer.value || <em>Left blank.</em>}</blockquote>

                {answer.aiScore !== null && answer.aiScore !== undefined && (
                  <p className="ems-ai-note">
                    <strong>AI proposed {answer.aiScore}/100.</strong>{' '}
                    {answer.aiFeedback}
                    {answer.wasOverridden && (
                      <em> You changed this to {answer.score}.</em>
                    )}
                  </p>
                )}

                <div className="ems-form__row">
                  <div className="ems-form__group ems-max-140">
                    <label className="ems-form__label" htmlFor={`score-${q.id}`}>
                      Score (0–100)
                    </label>
                    <input
                      id={`score-${q.id}`}
                      className="ems-form__input"
                      type="number"
                      min={0}
                      max={100}
                      value={marks[q.id]?.score ?? ''}
                      onChange={(e) =>
                        setMarks((m) => ({ ...m, [q.id]: { ...m[q.id], score: e.target.value } }))
                      }
                      placeholder="—"
                    />
                  </div>
                  <div className="ems-form__group">
                    <label className="ems-form__label" htmlFor={`fb-${q.id}`}>
                      Feedback on this answer
                    </label>
                    <input
                      id={`fb-${q.id}`}
                      className="ems-form__input"
                      value={marks[q.id]?.feedback ?? ''}
                      onChange={(e) =>
                        setMarks((m) => ({ ...m, [q.id]: { ...m[q.id], feedback: e.target.value } }))
                      }
                      placeholder="Optional…"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}

      <div className="ems-form__group">
        <label className="ems-form__label" htmlFor="overall-feedback">
          Overall feedback
        </label>
        <textarea
          id="overall-feedback"
          className="ems-form__textarea"
          rows={3}
          value={overallFeedback}
          onChange={(e) => setOverallFeedback(e.target.value)}
          placeholder="Optional comments for the student…"
        />
      </div>

      <div className="ems-form__actions">
        <button
          type="button"
          className="ems-btn ems-btn--secondary"
          onClick={() => save(false)}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          className="ems-btn ems-btn--primary"
          onClick={() => save(true)}
          disabled={saving}
        >
          {isPublished ? 'Update published grade' : 'Publish grade to student'}
        </button>
        <Link to="/teacher/submissions" className="ems-btn ems-btn--secondary">
          Back
        </Link>
      </div>

      {!isPublished && (
        <p className="ems-form__hint">
          The student cannot see this grade until you publish it.
        </p>
      )}
    </div>
  );
}

export default SubmissionDetailPage;
