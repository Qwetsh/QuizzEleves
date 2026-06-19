// Suivi longitudinal d'une classe sur plusieurs séances : évolution du taux de
// réussite, maîtrise par matière agrégée, questions/thèmes récurrents difficiles.
import { useMemo, useState } from 'react';
import { SUBJECTS } from '../../data/subjects';
import { computeClassTrends } from '../../logic/statsAggregate';
import { Bar, Card, Kpi, RateBadge, rateColor } from './parts';

const subjName = (k) => SUBJECTS[k]?.name || k || '—';
const subjIcon = (k) => SUBJECTS[k]?.icon || '•';

export default function ClassTrends({ rows }) {
  const trends = useMemo(() => computeClassTrends(rows), [rows]);
  const [openQ, setOpenQ] = useState(null);

  if (!trends.sessions.length) {
    return <p className="dash-empty" style={{ margin: 24 }}>Pas encore de partie pour ce filtre.</p>;
  }

  return (
    <div className="dash-report">
      <div className="dash-kpis">
        <Kpi value={trends.totals.games} label="Parties" />
        <Kpi value={trends.totals.answered} label="Questions au total" />
        <Kpi value={`${trends.totals.rate}%`} label="Taux global" color={rateColor(trends.totals.rate)} />
      </div>

      <div className="dash-grid">
        <Card title="Évolution du taux de réussite (par séance)" className="dash-card--wide">
          {trends.sessions.map((s, i) => (
            <Bar key={s.id || i}
              label={`${(s.endedAt || '').slice(0, 10)}${s.classLabel ? ` · ${s.classLabel}` : ''}`}
              value={s.rate} max={100} color={rateColor(s.rate)}
              right={<span><b>{s.rate}%</b> <span className="dash-subtle">({s.correct}/{s.answered})</span></span>} />
          ))}
        </Card>

        <Card title="Maîtrise par matière (toutes séances)">
          {trends.subjectMastery.map((s) => (
            <Bar key={s.subject} label={`${subjIcon(s.subject)} ${subjName(s.subject)}`}
              value={s.rate} max={100} color={rateColor(s.rate)}
              right={<span><b>{s.rate}%</b> <span className="dash-subtle">({s.correct}/{s.answered})</span></span>} />
          ))}
        </Card>
      </div>

      <Card title="Questions récurrentes difficiles" className="dash-card--wide">
        <ul className="dash-qlist">
          {trends.recurringHard.filter((q) => q.asked >= 2).slice(0, 30).map((q, i) => {
            const open = openQ === i;
            return (
              <li key={i} className="dash-qitem">
                <button className="dash-qrow" onClick={() => setOpenQ(open ? null : i)}>
                  <RateBadge rate={q.rate} />
                  <span className="dash-qtext">{subjIcon(q.subject)} {q.qText}</span>
                  <span className="dash-subtle">{q.correct}/{q.asked}</span>
                  <span className="dash-caret">{open ? '▾' : '▸'}</span>
                </button>
                {open && q.explanation && <div className="dash-qdetail"><div className="dash-qexpl"><b>Explication :</b> {q.explanation}</div></div>}
              </li>
            );
          })}
          {trends.recurringHard.filter((q) => q.asked >= 2).length === 0 && (
            <p className="dash-empty">Aucune question posée au moins 2 fois pour l'instant.</p>
          )}
        </ul>
      </Card>
    </div>
  );
}
