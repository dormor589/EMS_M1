/**
 * GenerateExamPage — draft an exam by describing it.
 *
 * The teacher writes what they want in plain language; the AI agent returns a
 * complete exam, which is shown for review and editing BEFORE anything is
 * saved. That order matters: a generated answer key can be confidently wrong in
 * a way no validation catches, so a person confirms every question.
 *
 * Source: the milestone brief §5.2 — AI API agents
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { aiService, examService, notify } from '../../services/index.js';

/** Ready-made prompts, so the page is usable without staring at a blank box. */
const EXAMPLES = [
  'Introduction to React hooks — useState, useEffect and custom hooks',
  'SQL joins and normalization for a second-year database course',
  'HTTP fundamentals: methods, status codes, headers and caching',
];

function GenerateExamPage() {
  const navigate = useNavigate();

  const [description, setDescription] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [status, setStatus] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(null);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    aiService.getStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  async function handleGenerate(e) {
    e?.preventDefault?.();
    if (description.trim().length < 10) return;
    setGenerating(true);
    setDraft(null);
    try {
      const result = await aiService.generateExam(description, questionCount);
      setDraft(result.exam);
      setMeta({ generatedBy: result.generatedBy, modelBacked: result.modelBacked });
    } catch (err) {
      notify.error(err.message);
    } finally {
      setGenerating(false);
    }
  }

  /** Save the draft as a real exam, then open it in the editor. */
  async function handleSave() {
    setSaving(true);
    try {
      const created = await examService.createExam({
        title: draft.title,
        description: draft.description,
        durationMinutes: draft.durationMinutes,
        passingGrade: draft.passingGrade,
        questions: draft.questions,
      });
      notify.success('Draft exam created — review the questions before publishing.');
      navigate(`/teacher/exams/${created.id}/edit`);
    } catch (err) {
      notify.error(err.message);
      setSaving(false);
    }
  }

  const totalWeight = draft?.questions.reduce((sum, q) => sum + q.weight, 0) ?? 0;

  return (
    <div className="ems-page">
      <h1 className="ems-page__title">Generate an exam</h1>
      <p className="ems-page__subtitle">
        Describe the exam you want and the AI agent will draft it. Nothing is saved
        until you review it.
      </p>

      {status && (
        <p className={`ems-provider ${status.modelBacked ? '' : 'ems-provider--fallback'}`}>
          {status.modelBacked
            ? <>Using <code>{status.provider}</code></>
            : <>No AI key configured — using the built-in generator (<code>{status.provider}</code>).
               Questions will be templates for you to fill in.</>}
        </p>
      )}

      <form onSubmit={handleGenerate} noValidate>
        <div className="ems-form__group">
          <label className="ems-form__label" htmlFor="description">
            What should the exam cover?
          </label>
          <textarea
            id="description"
            className="ems-form__textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Introduction to React hooks, 8 questions, mixed difficulty"
          />
          <div className="ems-examples">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="ems-examples__chip"
                onClick={() => setDescription(ex)}
              >
                {ex.slice(0, 40)}…
              </button>
            ))}
          </div>
        </div>

        <div className="ems-form__row">
          <div className="ems-form__group ems-max-160">
            <label className="ems-form__label" htmlFor="count">Questions</label>
            <input
              id="count"
              className="ems-form__input"
              type="number"
              min={1}
              max={20}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value) || 1)}
            />
          </div>
        </div>

        <div className="ems-form__actions">
          <button
            type="submit"
            className="ems-btn ems-btn--ai"
            disabled={generating || description.trim().length < 10}
          >
            {generating ? 'Generating…' : 'Generate draft'}
          </button>
          <Link to="/teacher/exams" className="ems-btn ems-btn--secondary">Cancel</Link>
        </div>
      </form>

      {generating && (
        <p className="ems-loading">
          Asking the model… this usually takes 10–45 seconds.
        </p>
      )}

      {draft && (
        <section className="ems-draft">
          <div className="ems-draft__header">
            <h2 className="ems-draft__title">{draft.title}</h2>
            <span className={`ems-badge ${meta?.modelBacked ? 'ems-badge--ai' : 'ems-badge--fallback'}`}>
              {meta?.modelBacked ? 'AI generated' : 'Template generated'}
            </span>
          </div>

          <p>{draft.description}</p>
          <p className="ems-exam-meta">
            {draft.durationMinutes} min · pass mark {draft.passingGrade} ·{' '}
            {draft.questions.length} questions · weights total {totalWeight}
          </p>

          <div className="ems-form__banner" role="note">
            ⚠️ Check every question and answer before publishing. A generated answer
            key can be plausible and still wrong.
          </div>

          {draft.questions.map((q, i) => (
            <div key={i} className="ems-question-card">
              <div className="ems-question-card__header">
                <span className="ems-question-card__title">
                  Question {i + 1}
                  <span className="ems-question-card__weight">({q.weight}% of the grade)</span>
                </span>
                <span className="ems-tag">{q.type}</span>
              </div>
              <p className="ems-question-card__text">{q.text}</p>
              {q.options.length > 0 && (
                <ul className="ems-options-review">
                  {q.options.map((opt, oi) => (
                    <li
                      key={oi}
                      className={`ems-options-review__item${oi === q.correctAnswer ? ' is-key' : ''}`}
                    >
                      {opt}
                      {oi === q.correctAnswer && <span className="ems-tag ems-tag--key">marked correct</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="ems-form__actions">
            <button
              type="button"
              className="ems-btn ems-btn--primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save as draft exam and edit'}
            </button>
            <button
              type="button"
              className="ems-btn ems-btn--secondary"
              onClick={() => handleGenerate()}
              disabled={generating || description.trim().length < 10}
            >
              Regenerate
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default GenerateExamPage;
