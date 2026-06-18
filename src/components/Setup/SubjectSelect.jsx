// Sélection des matières actives sur le plateau (sous-ensemble). Une matière
// sans question (au niveau choisi) est désactivée — on ne peut pas l'activer
// tant qu'elle n'a pas de contenu (ex. Allemand/Espagnol au début).
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS, SUBJECT_KEYS } from '../../data/subjects';
import { getQuestions } from '../../data/questions/index.js';

export default function SubjectSelect() {
  const level = useGameStore((s) => s.level);
  const useBrevet = useGameStore((s) => s.useBrevet);
  const selected = useGameStore((s) => s.selectedSubjects);
  const toggleSubject = useGameStore((s) => s.toggleSubject);
  // Re-render quand les questions sont (re)chargées depuis Supabase.
  useGameStore((s) => s.questionsVersion);

  const sel = Array.isArray(selected) ? selected : [];
  const pools = getQuestions(level, { brevet: useBrevet });

  return (
    <div>
      <div className="field-label">
        Matières <span style={{ fontWeight: 400, color: 'var(--ink-400)', fontSize: 12 }}>(au moins une)</span>
      </div>
      <div className="flex gap-2.5 flex-wrap items-stretch">
        {SUBJECT_KEYS.map((key) => {
          const s = SUBJECTS[key];
          const count = pools[key]?.length || 0;
          const on = sel.includes(key);
          const empty = count === 0;
          const disabled = empty && !on; // matière vide : non activable
          return (
            <button
              key={key}
              onClick={() => !disabled && toggleSubject(key)}
              disabled={disabled}
              className={`chip ${on ? 'is-active' : ''}`}
              style={{
                opacity: disabled ? 0.45 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
                borderColor: on ? s.color : undefined,
              }}
              title={empty ? 'Aucune question pour ce niveau' : `${count} questions`}
            >
              <span className="flex flex-col items-center">
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: on ? s.colorDeep : 'var(--ink-700)' }}>
                  {s.icon} {s.name}
                </strong>
                <small style={{ fontSize: 12, color: 'var(--ink-500)', fontWeight: 400 }}>
                  {empty ? 'bientôt' : `${count} questions`}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
