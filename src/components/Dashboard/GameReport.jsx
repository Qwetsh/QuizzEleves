// Rapport détaillé d'UNE partie archivée : taux global, par matière/thème/niveau,
// par équipe, questions les plus ratées (avec explication), objets/pouvoirs utilisés.
import { useMemo, useState } from 'react';
import { SUBJECTS } from '../../data/subjects';
import { ITEMS } from '../../data/items';
import { POWERS } from '../../data/powers';
import { computeGameReport } from '../../logic/statsAggregate';
import { Bar, Card, Kpi, RateBadge, rateColor } from './parts';

const subjName = (k) => SUBJECTS[k]?.name || k || '—';
const subjIcon = (k) => SUBJECTS[k]?.icon || '•';
const subjColor = (k) => SUBJECTS[k]?.color || '#5b6cc4';

function exportCsv(report, meta) {
  const lines = [['Section', 'Clé', 'Posées', 'Justes', 'Taux %']];
  lines.push(['Global', 'Total', report.totals.answered, report.totals.correct, report.totals.rate]);
  for (const s of report.bySubject) lines.push(['Matière', subjName(s.subject), s.answered, s.correct, s.rate]);
  for (const t of report.byTheme) lines.push(['Thème', t.theme, t.answered, t.correct, t.rate]);
  for (const t of report.byTeam) lines.push(['Équipe', t.teamName, t.answered, t.correct, t.rate]);
  for (const q of report.hardestQuestions) lines.push(['Question', q.qText, q.asked, q.correct, q.rate]);
  const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `analyse-${meta.classLabel || 'partie'}-${(meta.endedAt || '').slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function GameReport({ row, onBack }) {
  const stats = row?.data || {};
  const report = useMemo(() => computeGameReport(stats), [stats]);
  const [openQ, setOpenQ] = useState(null);

  const maxSubj = Math.max(1, ...report.bySubject.map((s) => s.answered));
  const meta = { classLabel: row?.class_label, endedAt: row?.ended_at || stats.endedAt };

  return (
    <div className="dash-report">
      <div className="dash-report-head">
        <button className="dash-btn" onClick={onBack}>← Retour</button>
        <div className="dash-report-title">
          {row?.class_label ? <span className="dash-chip">{row.class_label}</span> : null}
          <span>{(meta.endedAt || '').replace('T', ' ').slice(0, 16)}</span>
          <span className="dash-subtle">· {(stats.subjects || []).map(subjIcon).join(' ')}</span>
        </div>
        <div className="dash-report-actions">
          <button className="dash-btn" onClick={() => exportCsv(report, meta)}>⬇ CSV</button>
          <button className="dash-btn" onClick={() => window.print()}>🖨 Imprimer</button>
        </div>
      </div>

      <div className="dash-kpis">
        <Kpi value={report.totals.answered} label="Questions posées" />
        <Kpi value={`${report.totals.rate}%`} label="Taux de réussite" color={rateColor(report.totals.rate)} />
        <Kpi value={report.totals.wrong} label="Mauvaises" color="#b5341f" />
        <Kpi value={report.totals.timedOut} label="Temps écoulé" color="#8a6418" />
        <Kpi value={`${report.totals.avgTimeLeft}%`} label="Temps restant moyen" />
      </div>

      <div className="dash-grid">
        <Card title="Réussite par matière">
          {report.bySubject.length === 0 && <p className="dash-empty">Aucune donnée.</p>}
          {report.bySubject.map((s) => (
            <Bar key={s.subject} label={`${subjIcon(s.subject)} ${subjName(s.subject)}`}
              value={s.rate} max={100} color={rateColor(s.rate)}
              right={<span><b>{s.rate}%</b> <span className="dash-subtle">({s.correct}/{s.answered})</span></span>} />
          ))}
        </Card>

        <Card title="Volume par matière">
          {report.bySubject.map((s) => (
            <Bar key={s.subject} label={`${subjIcon(s.subject)} ${subjName(s.subject)}`}
              value={s.answered} max={maxSubj} color={subjColor(s.subject)} right={s.answered} />
          ))}
        </Card>

        <Card title="Classement des équipes">
          {report.byTeam.map((t) => (
            <Bar key={t.teamIdx} label={t.teamName} value={t.rate} max={100} color={rateColor(t.rate)}
              right={<span><b>{t.rate}%</b> <span className="dash-subtle">({t.correct}/{t.answered})</span></span>} />
          ))}
        </Card>

        {report.byLevel.length > 1 && (
          <Card title="Réussite par niveau">
            {report.byLevel.map((l) => (
              <Bar key={l.level} label={String(l.level)} value={l.rate} max={100} color={rateColor(l.rate)}
                right={<span><b>{l.rate}%</b> <span className="dash-subtle">({l.correct}/{l.answered})</span></span>} />
            ))}
          </Card>
        )}

        {report.byTheme.length > 0 && (
          <Card title="Réussite par thème (les plus faibles en premier)" className="dash-card--wide">
            {report.byTheme.slice(0, 12).map((t) => (
              <Bar key={t.theme} label={`${subjIcon(t.subject)} ${t.theme}`} value={t.rate} max={100} color={rateColor(t.rate)}
                right={<span><b>{t.rate}%</b> <span className="dash-subtle">({t.correct}/{t.answered})</span></span>} />
            ))}
          </Card>
        )}

        {(report.itemUses.length > 0 || report.powerUses.length > 0) && (
          <Card title="Objets & pouvoirs utilisés">
            <div className="dash-uses">
              {report.powerUses.map((p) => (
                <span key={p.powerKey} className="dash-use-pill">⚡ {POWERS[p.powerKey]?.name || p.powerKey} <b>×{p.count}</b></span>
              ))}
              {report.itemUses.map((it) => (
                <span key={it.itemKey} className="dash-use-pill">{ITEMS[it.itemKey]?.icon || '🎒'} {ITEMS[it.itemKey]?.name || it.itemKey} <b>×{it.count}</b></span>
              ))}
            </div>
            {report.itemUses.length === 0 && report.powerUses.length === 0 && <p className="dash-empty">Aucun usage.</p>}
          </Card>
        )}
      </div>

      <Card title="Questions les plus ratées" className="dash-card--wide">
        {report.hardestQuestions.length === 0 && <p className="dash-empty">Aucune question.</p>}
        <ul className="dash-qlist">
          {report.hardestQuestions.slice(0, 30).map((q, i) => {
            const open = openQ === i;
            return (
              <li key={i} className="dash-qitem">
                <button className="dash-qrow" onClick={() => setOpenQ(open ? null : i)}>
                  <RateBadge rate={q.rate} />
                  <span className="dash-qtext">{subjIcon(q.subject)} {q.qText}</span>
                  <span className="dash-subtle">{q.correct}/{q.asked}</span>
                  <span className="dash-caret">{open ? '▾' : '▸'}</span>
                </button>
                {open && (
                  <div className="dash-qdetail">
                    {Array.isArray(q.answers) && (
                      <div className="dash-qanswers">
                        {q.answers.map((a, idx) => (
                          <div key={idx} className={'dash-qans' + (idx === q.correctIndex ? ' is-correct' : '')}>
                            {idx === q.correctIndex ? '✓ ' : '• '}{a}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.explanation && <div className="dash-qexpl"><b>Explication :</b> {q.explanation}</div>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
