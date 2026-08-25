/**
 * AnalyticsPage — how the cohort is doing.
 *
 * Two levels: a summary across every exam the teacher owns, and a drill-down
 * into one exam with a grade distribution and per-question difficulty. A row in
 * the overview is clickable anywhere, not just on its Details button.
 *
 * All figures come from SQL. The AI narrative is opt-in behind a button,
 * because it costs a model call and the numbers are useful without it — and if
 * the provider is unavailable the statistics are unaffected.
 *
 * Source: the milestone brief §5.2 — statistics and analytics
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsService, notify } from '../../services/index.js';

/** @param {number|null} v @returns {string} */
const orDash = (v) => (v === null || v === undefined ? '—' : String(v));

function AnalyticsPage() {
  const [overview, setOverview] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summarising, setSummarising] = useState(false);

  useEffect(() => {
    analyticsService
      .getOverview()
      .then((data) => {
        setOverview(data);
        // Open the exam with the most submissions — the one worth looking at.
        const busiest = [...data.exams].sort((a, b) => b.submissionCount - a.submissionCount)[0];
        if (busiest?.submissionCount) setSelected(busiest.id);
      })
      .catch((err) => notify.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return undefined;

    // `cancelled` guards against a slow response for an exam the user has
    // already navigated away from overwriting a newer one.
    let cancelled = false;
    analyticsService
      .getForExam(selected)
      .then((data) => { if (!cancelled) setDetail(data); })
      .catch((err) => { if (!cancelled) notify.error(err.message); });

    return () => { cancelled = true; };
  }, [selected]);

  async function handleSummarise() {
    setSummarising(true);
    try {
      setDetail(await analyticsService.getForExam(selected, { withSummary: true }));
    } catch (err) {
      notify.error(err.message);
    } finally {
      setSummarising(false);
    }
  }

  if (loading) {
    return (
      <div className="ems-page ems-page--analytics">
        <h1 className="ems-page__title">Analytics</h1>
        <p className="ems-loading">Loading…</p>
      </div>
    );
  }

  const t = overview?.totals;
  const peak = Math.max(1, ...(detail?.distribution.map((b) => b.count) ?? [1]));

  return (
    <div className="ems-page ems-page--analytics">
      <h1 className="ems-page__title">Analytics</h1>

      <div className="ems-stat-row">
        <div className="ems-stat"><span className="ems-stat__value">{t.examCount}</span><span className="ems-stat__label">Exams</span></div>
        <div className="ems-stat"><span className="ems-stat__value">{t.published}</span><span className="ems-stat__label">Published</span></div>
        <div className="ems-stat"><span className="ems-stat__value">{t.submissionCount}</span><span className="ems-stat__label">Submissions</span></div>
        <div className="ems-stat"><span className="ems-stat__value">{t.gradedCount}</span><span className="ems-stat__label">Graded</span></div>
        <div className={`ems-stat ${t.awaitingGrading ? 'ems-stat--attention' : ''}`}>
          <span className="ems-stat__value">{t.awaitingGrading}</span>
          <span className="ems-stat__label">Awaiting grading</span>
        </div>
        <div className="ems-stat"><span className="ems-stat__value">{orDash(t.averageGrade)}</span><span className="ems-stat__label">Average grade</span></div>
      </div>

      <h2 className="ems-section-title">Per exam</h2>
      <div className="ems-table-wrap">
        <table className="ems-table">
          <thead>
            <tr>
              <th>Exam</th><th>Status</th><th>Submissions</th><th>Graded</th>
              <th>Awaiting</th><th>Average</th><th>Pass rate</th><th></th>
            </tr>
          </thead>
          <tbody>
            {overview.exams.map((e) => (
              <tr
                key={e.id}
                className={[
                  e.id === selected ? 'is-selected' : '',
                  e.submissionCount ? 'is-clickable' : '',
                ].filter(Boolean).join(' ')}
                /* A pointer convenience only. The Details button below stays the
                   real control, because giving a <tr> role="button" would stop
                   it being announced as a table row. */
                onClick={e.submissionCount ? () => setSelected(e.id) : undefined}
              >
                <td>{e.title}</td>
                <td><span className={`ems-status ems-status--${e.status.toLowerCase()}`}>{e.status}</span></td>
                <td className="ems-num">{e.submissionCount}</td>
                <td className="ems-num">{e.gradedCount}</td>
                <td className="ems-num">{e.awaitingGrading || '—'}</td>
                <td className="ems-num">{orDash(e.averageGrade)}</td>
                <td className="ems-num">{e.passRate === null ? '—' : `${e.passRate}%`}</td>
                <td>
                  <button
                    type="button"
                    className="ems-btn ems-btn--secondary ems-btn--sm"
                    /* Stop the row handler firing a second time for one click. */
                    onClick={(ev) => { ev.stopPropagation(); setSelected(e.id); }}
                    disabled={!e.submissionCount}
                  >
                    {e.id === selected ? 'Viewing' : 'Details'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && detail && detail.exam.id === selected && (
        <>
          <h2 className="ems-section-title">{detail.exam.title}</h2>

          <div className="ems-stat-row">
            <div className="ems-stat"><span className="ems-stat__value">{orDash(detail.averageGrade)}</span><span className="ems-stat__label">Average</span></div>
            <div className="ems-stat"><span className="ems-stat__value">{orDash(detail.lowestGrade)}</span><span className="ems-stat__label">Lowest</span></div>
            <div className="ems-stat"><span className="ems-stat__value">{orDash(detail.highestGrade)}</span><span className="ems-stat__label">Highest</span></div>
            <div className="ems-stat"><span className="ems-stat__value">{detail.passRate === null ? '—' : `${detail.passRate}%`}</span><span className="ems-stat__label">Pass rate</span></div>
            <div className="ems-stat"><span className="ems-stat__value">{detail.publishedGrades}</span><span className="ems-stat__label">Published</span></div>
            <div className={`ems-stat ${detail.draftGraded ? 'ems-stat--attention' : ''}`}>
              <span className="ems-stat__value">{detail.draftGraded}</span>
              <span className="ems-stat__label">Draft grades</span>
            </div>
          </div>

          <h3 className="ems-subsection-title">Grade distribution</h3>
          <div className="ems-histogram">
            {detail.distribution.map((b) => (
              <div key={b.bucket} className="ems-histogram__col">
                <span className="ems-histogram__count">{b.count || ''}</span>
                <div
                  className={[
                    'ems-histogram__bar',
                    // An empty bucket stays neutral: colouring it red would
                    // imply failures in a band where nobody scored at all.
                    b.count === 0 ? 'is-empty' : '',
                    b.count > 0 && Number(b.bucket.split('-')[1]) < detail.exam.passingGrade
                      ? 'is-fail' : '',
                  ].filter(Boolean).join(' ')}
                  /* Scaled against the tallest bucket so a small cohort still
                     produces a readable chart. */
                  style={{ height: `${(b.count / peak) * 100}%` }}
                />
                <span className="ems-histogram__label">{b.bucket}</span>
              </div>
            ))}
          </div>
          <p className="ems-form__hint">
            Bars left of the pass mark ({detail.exam.passingGrade}) are shown in red.
          </p>

          <h3 className="ems-subsection-title">Per question</h3>
          <div className="ems-table-wrap">
            <table className="ems-table">
              <thead>
                <tr><th>#</th><th>Question</th><th>Type</th><th>Weight</th><th>Answered</th><th>Average</th><th>Correct</th></tr>
              </thead>
              <tbody>
                {detail.questions.map((q) => (
                  <tr
                    key={q.id}
                    className={detail.hardestQuestion?.position === q.position ? 'is-weakest' : ''}
                  >
                    <td className="ems-num">{q.position}</td>
                    <td>{q.text}</td>
                    <td>{q.type === 'multiple-choice' ? 'MC' : 'Open'}</td>
                    <td className="ems-num">{q.weight}%</td>
                    <td className="ems-num">{q.answeredCount}</td>
                    <td className="ems-num">{q.averageScore}</td>
                    <td className="ems-num">{q.correctRate === null ? '—' : `${q.correctRate}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail.hardestQuestion && (
            <p className="ems-form__hint">
              Question {detail.hardestQuestion.position} scored lowest — highlighted above.
            </p>
          )}

          <h3 className="ems-subsection-title">AI summary</h3>
          {detail.summary ? (
            <div className="ems-ai-note">
              {detail.summary}
              <div className="ems-form__hint">Written by {detail.summaryProvider}</div>
            </div>
          ) : (
            <p>
              <button
                type="button"
                className="ems-btn ems-btn--ai"
                onClick={handleSummarise}
                disabled={summarising}
              >
                {summarising ? 'Asking the model…' : 'Ask the AI what this means'}
              </button>
              <span className="ems-form__hint">
                The figures above are computed in SQL and do not depend on this.
              </span>
            </p>
          )}

          <div className="ems-form__actions">
            <Link to={`/teacher/exams/${detail.exam.id}/edit`} className="ems-btn ems-btn--secondary">
              Edit this exam
            </Link>
            <Link to="/teacher/submissions" className="ems-btn ems-btn--secondary">
              View submissions
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default AnalyticsPage;
