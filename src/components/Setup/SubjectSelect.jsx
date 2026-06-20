// Sélection des sous-thèmes (matières) actifs, REGROUPÉS PAR THÈME (module).
// Avec un seul thème (Collège), aucun en-tête → look historique. Dès qu'un 2e
// thème existe (ex. Film), chaque groupe a son en-tête (icône + nom du thème).
// Une matière sans question (au niveau choisi) est désactivée.
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS, SUBJECT_KEYS, MODULES, MODULE_KEYS } from '../../data/subjects';
import { getQuestions } from '../../data/questions/index.js';
import { useT } from '../../i18n';
import { loc, locName } from '../../i18n/content';

export default function SubjectSelect() {
  const T = useT();
  const level = useGameStore((s) => s.level);
  const useBrevet = useGameStore((s) => s.useBrevet);
  const selected = useGameStore((s) => s.selectedSubjects);
  const toggleSubject = useGameStore((s) => s.toggleSubject);
  const lv2Mode = useGameStore((s) => s.lv2Mode);
  const setLv2Mode = useGameStore((s) => s.setLv2Mode);
  // Re-render quand les questions/catégories sont (re)chargées depuis Supabase.
  useGameStore((s) => s.questionsVersion);

  const sel = Array.isArray(selected) ? selected : [];
  const pools = getQuestions(level, { brevet: useBrevet });
  const bothLv2 = ['allemand', 'espagnol'].every((k) => sel.includes(k) && (pools[k]?.length || 0) > 0);

  // Regroupe les sous-thèmes par THÈME (module), dans l'ordre des modules.
  const order = (Array.isArray(MODULE_KEYS) && MODULE_KEYS.length) ? MODULE_KEYS : ['college'];
  const seen = new Set();
  const groups = [];
  for (const mod of order) {
    const keys = SUBJECT_KEYS.filter((k) => (SUBJECTS[k]?.module || 'college') === mod);
    keys.forEach((k) => seen.add(k));
    if (keys.length) groups.push({ mod, keys });
  }
  const orphans = SUBJECT_KEYS.filter((k) => !seen.has(k));
  if (orphans.length) groups.push({ mod: null, keys: orphans });
  const showHeaders = groups.length > 1;

  const renderChip = (key) => {
    const s = SUBJECTS[key];
    if (!s) return null;
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
        title={empty ? T('setup.subjectEmpty') : T('setup.questionsCount', { n: count })}
      >
        <span className="flex flex-col items-center">
          <strong style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: on ? s.colorDeep : 'var(--ink-700)' }}>
            {s.icon} {s.name}
          </strong>
          <small style={{ fontSize: 12, color: 'var(--ink-500)', fontWeight: 400 }}>
            {/* Matière choisie : on montre le « royaume » (biome) ; sinon le nb de questions. */}
            {empty ? T('setup.subjectSoon') : (on ? loc(s, 'biome') : T('setup.questionsCount', { n: count }))}
          </small>
        </span>
      </button>
    );
  };

  return (
    <div>
      <div className="field-label">
        {T('setup.subjectsLabel')} <span style={{ fontWeight: 400, color: 'var(--ink-400)', fontSize: 12 }}>{T('setup.subjectsHint')}</span>
      </div>

      {groups.map(({ mod, keys }) => (
        <div key={mod || '_orphans'} style={{ marginBottom: showHeaders ? 12 : 0 }}>
          {showHeaders && mod && MODULES[mod] && (
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '8px 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{MODULES[mod].icon}</span>{locName(MODULES[mod])}
            </div>
          )}
          <div className="flex gap-2.5 flex-wrap items-stretch">
            {keys.map(renderChip)}
          </div>
        </div>
      ))}

      {bothLv2 && (
        <button
          type="button"
          onClick={() => setLv2Mode(!lv2Mode)}
          aria-pressed={lv2Mode}
          style={{
            marginTop: 10, width: '100%', textAlign: 'left', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
            border: `2px solid ${lv2Mode ? 'var(--gold-600)' : 'rgba(122,94,58,0.22)'}`,
            background: lv2Mode ? 'rgba(232,169,88,0.12)' : '#fffefb',
          }}
        >
          <span style={{ fontSize: 22 }}>🗣️</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--ink-800)' }}>
              {lv2Mode ? '✓ ' : ''}{T('setup.lv2Title')}
            </span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-500)', lineHeight: 1.3 }}>
              {T('setup.lv2Desc')}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
