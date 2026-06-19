// Liste des parties archivées : une carte cliquable par partie → ouvre le rapport.
import { SUBJECTS } from '../../data/subjects';
import { RateBadge } from './parts';

const subjIcon = (k) => SUBJECTS[k]?.icon || '•';

export default function GameList({ rows, onOpen }) {
  if (!rows.length) {
    return <p className="dash-empty" style={{ margin: 24 }}>Aucune partie archivée pour ce filtre. Termine une partie pour la voir apparaître ici.</p>;
  }
  return (
    <div className="dash-list">
      {rows.map((r) => {
        const answers = r.data?.answers || [];
        const correct = answers.filter((a) => a.correct).length;
        const rate = answers.length ? Math.round((correct / answers.length) * 100) : 0;
        const teams = r.data?.teams || [];
        return (
          <button key={r.id} className="dash-list-item" onClick={() => onOpen(r)}>
            <div className="dash-list-main">
              <div className="dash-list-when">
                {r.class_label && <span className="dash-chip">{r.class_label}</span>}
                {(r.ended_at || '').replace('T', ' ').slice(0, 16)}
              </div>
              <div className="dash-subtle">
                {(r.subjects || []).map(subjIcon).join(' ')} · {teams.length} équipe{teams.length > 1 ? 's' : ''} · {answers.length} question{answers.length > 1 ? 's' : ''}
              </div>
            </div>
            <RateBadge rate={rate} />
          </button>
        );
      })}
    </div>
  );
}
