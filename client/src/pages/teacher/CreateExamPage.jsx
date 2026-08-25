/**
 * CreateExamPage — form to create a new exam with dynamic question editor.
 *
 * Form fields:
 *   • title (required)
 *   • description (optional)
 *   • durationMinutes (required, > 0)
 *   • questions — dynamic list; at least 1 question required on submit.
 *     Each question: type (MC | open-text), text, options list (MC only),
 *     correctAnswer, weight.
 *
 * No business logic in JSX: validation and persistence handled by
 * ExamService.createExam().
 *
 * Source: the milestone brief §5.1 — Must-Have: teacher can create exam
 * Source: the milestone brief §7 — Exam / Question entity fields
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, examService, notify, config } from '../../services/index.js';

// ── QuestionEditor sub-component (display only — no service calls) ──────────

/**
 * Renders the form fields for one question in the list.
 * Pure display: all state changes bubble up via onChange callbacks.
 *
 * @param {{ question: object, index: number, onChange: Function, onRemove: Function }} props
 */
function QuestionEditor({ question, index, onChange, onRemove }) {
  const questionTypes = config.getQuestionTypes(); // ['multiple-choice', 'open-text']

  // ── Field change helpers ──────────────────────────────────────────────────

  function field(name, value) {
    onChange(index, { ...question, [name]: value });
  }

  function addOption() {
    onChange(index, { ...question, options: [...question.options, ''] });
  }

  function removeOption(optIdx) {
    const updated = question.options.filter((_, i) => i !== optIdx);
    onChange(index, { ...question, options: updated });
  }

  function changeOption(optIdx, value) {
    const updated = question.options.map((o, i) => (i === optIdx ? value : o));
    onChange(index, { ...question, options: updated });
  }

  return (
    <div className="ems-question-card">
      <div className="ems-question-card__header">
        <span className="ems-question-card__title">Question {index + 1}</span>
        <button
          type="button"
          className="ems-btn ems-btn--danger ems-btn--sm"
          onClick={() => onRemove(index)}
          aria-label={`Remove question ${index + 1}`}
        >
          Remove
        </button>
      </div>

      {/* Type selector */}
      <div className="ems-form__group">
        <label className="ems-form__label">Type</label>
        <select
          className="ems-form__select"
          value={question.type}
          onChange={(e) => {
            // Switching away from MC clears options.
            const newType = e.target.value;
            onChange(index, {
              ...question,
              type:    newType,
              options: newType === 'multiple-choice' ? (question.options.length ? question.options : ['']) : [],
            });
          }}
        >
          {questionTypes.map((t) => (
            <option key={t} value={t}>
              {t === 'multiple-choice' ? 'Multiple Choice' : 'Open Text'}
            </option>
          ))}
        </select>
      </div>

      {/* Question text */}
      <div className="ems-form__group">
        <label className="ems-form__label">Question Text *</label>
        <textarea
          className="ems-form__textarea"
          value={question.text}
          onChange={(e) => field('text', e.target.value)}
          placeholder="Enter the question prompt…"
          rows={2}
        />
      </div>

      {/* MC options */}
      {question.type === 'multiple-choice' && (
        <div className="ems-form__group">
          <label className="ems-form__label">Answer Options *</label>
          <ul className="ems-options-list">
            {question.options.map((opt, oi) => (
              <li key={oi} className="ems-options-list__item">
                <input
                  className="ems-options-list__input"
                  value={opt}
                  onChange={(e) => changeOption(oi, e.target.value)}
                  placeholder={`Option ${oi + 1}`}
                />
                {question.options.length > 1 && (
                  <button
                    type="button"
                    className="ems-btn ems-btn--danger ems-btn--sm"
                    onClick={() => removeOption(oi)}
                    aria-label={`Remove option ${oi + 1}`}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="ems-btn ems-btn--secondary ems-btn--sm"
            onClick={addOption}
          >
            + Add Option
          </button>
        </div>
      )}

      {/* Correct answer + weight */}
      <div className="ems-form__row">
        {question.type === 'multiple-choice' && (
          <div className="ems-form__group">
            <label className="ems-form__label">Correct answer</label>
            {/* A dropdown over the options, not free text: the server stores the
                option INDEX, and picking from the list makes a mismatch between
                the key and the options impossible. */}
            <select
              className="ems-form__input"
              value={question.correctAnswer}
              onChange={(e) => field('correctAnswer', e.target.value)}
            >
              <option value="">Choose the correct option…</option>
              {(question.options || []).map((opt, oi) => (
                <option key={oi} value={String(oi)}>
                  {opt.trim() === '' ? `Option ${oi + 1}` : opt}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="ems-form__group ems-max-160">
          <label className="ems-form__label">Weight</label>
          <input
            className="ems-form__input"
            type="number"
            min={1}
            max={100}
            value={question.weight}
            onChange={(e) => field('weight', Number(e.target.value) || 1)}
          />
          <small className="ems-form__hint">share of the grade</small>
        </div>
      </div>
    </div>
  );
}

// ── CreateExamPage ────────────────────────────────────────────────────────────

/** Build a blank question for the initial state. */
function blankQuestion() {
  return { type: 'multiple-choice', text: '', options: ['', ''], correctAnswer: '', weight: 10 };
}

function CreateExamPage() {
  const navigate = useNavigate();

  // ── Form state ────────────────────────────────────────────────────────────
  const [title,           setTitle]           = useState('');
  const [description,     setDescription]     = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [questions,       setQuestions]       = useState([blankQuestion()]);
  const [error,           setError]           = useState('');
  const [submitting,      setSubmitting]       = useState(false);

  // ── Question list mutations ───────────────────────────────────────────────

  function addQuestion() {
    setQuestions((prev) => [...prev, blankQuestion()]);
  }

  function removeQuestion(index) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateQuestion(index, updated) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? updated : q)));
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Client-side guard: at least 1 question required.
    // (ExamService validates title + durationMinutes.)
    if (questions.length === 0) {
      setError('Please add at least one question before submitting.');
      return;
    }

    const user = auth.getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }

    setSubmitting(true);
    examService
      .createExam({
        title,
        description,
        durationMinutes: Number(durationMinutes),
        questions,
        createdBy: user.id,
      })
      .then(() => {
        notify.success('Exam created successfully!');
        navigate('/teacher/exams');
      })
      .catch((err) => {
        setError(err.message);
        setSubmitting(false);
      });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ems-page">
      <h1 className="ems-page__title">Create New Exam</h1>

      <form className="ems-form" onSubmit={handleSubmit} noValidate>
        {error && <div className="ems-form__error">{error}</div>}

        {/* Title */}
        <div className="ems-form__group">
          <label className="ems-form__label" htmlFor="title">
            Title *
          </label>
          <input
            id="title"
            className="ems-form__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Introduction to Web Development"
            required
          />
        </div>

        {/* Description */}
        <div className="ems-form__group">
          <label className="ems-form__label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="ems-form__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional exam description…"
          />
        </div>

        {/* Duration */}
        <div className="ems-form__group ems-max-200">
          <label className="ems-form__label" htmlFor="duration">
            Duration (minutes) *
          </label>
          <input
            id="duration"
            className="ems-form__input"
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            required
          />
        </div>

        {/* Questions */}
        <div className="ems-questions">
          <div className="ems-questions__heading">
            Questions ({questions.length})
          </div>

          {questions.map((q, idx) => (
            <QuestionEditor
              key={idx}
              question={q}
              index={idx}
              onChange={updateQuestion}
              onRemove={removeQuestion}
            />
          ))}

          <button
            type="button"
            className="ems-btn ems-btn--secondary ems-mt-sm"
            onClick={addQuestion}
          >
            + Add Question
          </button>
        </div>

        {/* Actions */}
        <div className="ems-form__actions">
          <button
            type="submit"
            className="ems-btn ems-btn--primary"
            disabled={submitting}
          >
            {submitting ? 'Creating…' : 'Create Exam'}
          </button>
          <Link to="/teacher/exams" className="ems-btn ems-btn--secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default CreateExamPage;
