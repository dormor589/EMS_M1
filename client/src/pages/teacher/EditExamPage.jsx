/**
 * EditExamPage — pre-filled exam edit form loaded by :id route param.
 *
 * Loads the exam by ID from ExamService, pre-populates all fields and
 * the question list, then saves via ExamService.updateExam() on submit.
 *
 * Status policy (M1 simple choice):
 *   Editing is allowed regardless of current status. A banner is shown for
 *   Published / Closed exams to alert the teacher that the change is saved.
 *   Status itself can only be changed via Publish / Close on the list page
 *   — updateExam() strips any incoming status field.
 *
 * No business logic in JSX — data ops delegate to ExamService.
 *
 * Source: the milestone brief §5.1 — Must-Have: teacher can edit exam
 * Source: the milestone brief §7 — Exam / Question entity fields
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { examService, notify, config } from '../../services/index.js';

// ── QuestionEditor (identical to CreateExamPage — local copy keeps pages ──
// independent; extract to shared component in M2 if duplication grows)

function QuestionEditor({ question, index, onChange, onRemove }) {
  const questionTypes = config.getQuestionTypes();

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

      <div className="ems-form__group">
        <label className="ems-form__label">Type</label>
        <select
          className="ems-form__select"
          value={question.type}
          onChange={(e) => {
            const newType = e.target.value;
            onChange(index, {
              ...question,
              type:    newType,
              options: newType === 'multiple-choice'
                ? (question.options.length ? question.options : [''])
                : [],
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert a stored exam question plain-object into the editor's local shape.
 * Ensures `options` is always an array, `correctAnswer` always a string.
 */
function toEditorQuestion(q) {
  return {
    id:            q.id || undefined,
    examId:        q.examId || undefined,
    type:          q.type || 'open-text',
    text:          q.text || '',
    options:       Array.isArray(q.options) ? q.options : [],
    correctAnswer: q.correctAnswer != null ? String(q.correctAnswer) : '',
    weight:        typeof q.weight === 'number' ? q.weight : 10,
  };
}

function blankQuestion() {
  return { type: 'multiple-choice', text: '', options: ['', ''], correctAnswer: '', weight: 10 };
}

// ── EditExamPage ──────────────────────────────────────────────────────────────

function EditExamPage() {
  const { id }     = useParams();
  const navigate    = useNavigate();

  const [loading,         setLoading]         = useState(true);
  const [notFound,        setNotFound]        = useState(false);
  const [examStatus,      setExamStatus]      = useState('Draft');
  const [title,           setTitle]           = useState('');
  const [description,     setDescription]     = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [questions,       setQuestions]       = useState([]);
  const [error,           setError]           = useState('');
  const [submitting,      setSubmitting]      = useState(false);

  // ── Load exam on mount ────────────────────────────────────────────────────

  useEffect(() => {
    examService
      .getExamById(id)
      .then((exam) => {
        if (!exam) {
          setNotFound(true);
          return;
        }
        setExamStatus(exam.status);
        setTitle(exam.title);
        setDescription(exam.description || '');
        setDurationMinutes(exam.durationMinutes || 60);
        setQuestions((exam.questions || []).map(toEditorQuestion));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

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

    setSubmitting(true);
    examService
      .updateExam(id, {
        title,
        description,
        durationMinutes: Number(durationMinutes),
        questions,
      })
      .then(() => {
        notify.success('Exam saved successfully.');
        navigate('/teacher/exams');
      })
      .catch((err) => {
        setError(err.message);
        setSubmitting(false);
      });
  }

  // ── Early exits ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">Edit Exam</h1>
        <p className="ems-loading">Loading exam…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="ems-page">
        <h1 className="ems-page__title">Exam Not Found</h1>
        <p>The exam you are trying to edit does not exist.</p>
        <Link to="/teacher/exams" className="ems-btn ems-btn--secondary">
          Back to My Exams
        </Link>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ems-page">
      <h1 className="ems-page__title">Edit Exam</h1>

      <form className="ems-form" onSubmit={handleSubmit} noValidate>
        {/* Status banner for non-Draft exams */}
        {examStatus !== 'Draft' && (
          <div className="ems-form__banner">
            ⚠️ This exam is currently <strong>{examStatus}</strong>. All field
            edits are saved immediately. Status changes (Publish / Close) are
            only available from the{' '}
            <Link to="/teacher/exams">My Exams</Link> list.
          </div>
        )}

        {error && <div className="ems-form__error">{error}</div>}

        {/* Title */}
        <div className="ems-form__group">
          <label className="ems-form__label" htmlFor="edit-title">
            Title *
          </label>
          <input
            id="edit-title"
            className="ems-form__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Description */}
        <div className="ems-form__group">
          <label className="ems-form__label" htmlFor="edit-description">
            Description
          </label>
          <textarea
            id="edit-description"
            className="ems-form__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Duration */}
        <div className="ems-form__group ems-max-200">
          <label className="ems-form__label" htmlFor="edit-duration">
            Duration (minutes) *
          </label>
          <input
            id="edit-duration"
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
              key={q.id || idx}
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
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
          <Link to="/teacher/exams" className="ems-btn ems-btn--secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default EditExamPage;
