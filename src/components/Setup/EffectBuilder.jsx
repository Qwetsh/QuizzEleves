// Constructeur d'effets composables pour l'éditeur d'objets.
// Gère les déclencheurs `kind:'trigger'` (à l'usage / % chance / d6 / on:roll / en question)
// et l'édition de listes d'ACTIONS atomiques. Voir src/store/effectEngine.js.
import { SUBJECTS, SUBJECT_KEYS, FORCED_SUBJECT_KEYS } from '../../data/subjects';

const ACTIONS = [
  { key: 'move', label: 'Déplacer' },
  { key: 'money', label: 'Or (gagner/perdre/voler)' },
  { key: 'rerollQuestion', label: 'Changer la question' },
  { key: 'forceSubject', label: 'Forcer le thème de la question' },
  { key: 'challenge', label: 'Défi (forcer mon thème + pari)' },
  { key: 'placeTrap', label: 'Poser un piège' },
  { key: 'gainCharge', label: 'Recharger un pouvoir' },
  { key: 'shieldNext', label: 'Bouclier (annule 1 recul)' },
  { key: 'fumigene', label: 'Fumigène (anti-pouvoir)' },
  { key: 'extraTime', label: 'Temps en + (prochaine question)' },
];
const TARGETS = [
  { key: 'self', label: 'Moi' }, { key: 'target', label: 'Une cible (au choix)' },
  { key: 'randomOpponent', label: 'Un adversaire au hasard' }, { key: 'all', label: 'Toutes les équipes' },
];
// Dans un piège (ou une rune), « soi » = l'équipe qui marche dessus / déclenche.
const TRAP_TARGETS = [
  { key: 'self', label: 'Celui qui marche dessus' }, { key: 'target', label: 'Une autre équipe (au choix)' },
  { key: 'randomOpponent', label: 'Une autre équipe au hasard' }, { key: 'all', label: 'Toutes les équipes' },
];

const defaultAction = () => ({ action: 'money', mode: 'gain', target: 'self', n: 5, unit: 'flat' });

export function defaultTrigger(slot) {
  if (slot === 'consumable') return { kind: 'trigger', on: 'use', do: [defaultAction()] };
  // équipement : par défaut un déclencheur lié au dé
  return { kind: 'trigger', on: 'roll', values: [6], do: [{ action: 'money', mode: 'gain', target: 'self', n: 10, unit: 'flat' }] };
}

// Étiquette lisible d'une quantité ('d6' ⇒ '1D6', objet ⇒ 'f×série', 3 ⇒ '3').
const amountLabel = (n) => {
  if (typeof n === 'string') return `1${n.toUpperCase()}`;
  if (n != null && typeof n === 'object') return `${n.base ? `${n.base}+` : ''}${n.factor ?? 1}×${metricLabel(n.per)}`;
  return n;
};

// Résumé lisible d'une action (pour l'aperçu).
export function describeAction(a) {
  const who = TARGETS.find((t) => t.key === a.target)?.label.toLowerCase() || a.target;
  switch (a.action) {
    case 'move': return `${a.dir === 'back' ? 'reculer' : 'avancer'} ${who} de ${amountLabel(a.n)}`;
    case 'money': return `${a.mode === 'steal' ? 'voler' : a.mode === 'lose' ? 'retirer' : 'donner'} ${amountLabel(a.n)}${a.unit === 'percent' ? '%' : ''} d'or à ${who}`;
    case 'rerollQuestion': return `changer la question (${a.subject === 'choose' ? 'thème au choix' : a.subject === 'same' || !a.subject ? 'même thème' : SUBJECTS[a.subject]?.name || a.subject})`;
    case 'challenge': return `défi (${SUBJECTS[a.subject]?.name || a.subject}) : ${(a.do || []).map(describeAction).join(', ') || 'rien'}`;
    case 'placeTrap': return `poser un piège (${a.trap?.do?.length || 0} effet·s)`;
    case 'gainCharge': return 'recharger un pouvoir';
    case 'shieldNext': return 'bouclier (annule 1 recul)';
    case 'fumigene': return `fumigène${a.turns ? ` (${amountLabel(a.turns)} tours)` : ''}`;
    case 'extraTime': return `+${amountLabel(a.n)}s à la prochaine question`;
    default: return a.action;
  }
}

const numInput = (value, onChange, { min = 0, max = 999 } = {}) => (
  <input type="number" className="qed-input" style={{ width: 72 }} value={value ?? 0}
    min={min} max={max} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} />
);

// Quantité d'effet : valeur FIXE (nombre) ou ALÉATOIRE (dé).
// La valeur aléatoire est stockée sous forme de chaîne ('d2'|'d3'|'d4'|'d6'|'d10')
// et tirée à l'exécution par le moteur (resolveAmount).
// `dice` adapte les faces proposées selon l'effet (ex. réponses éliminées :
// d2/d3 seulement, car il n'y a que 3 mauvaises réponses).
export const DEFAULT_DICE = ['d4', 'd6', 'd10'];
const diceFaceLabel = (d) => `🎲 1${d.toUpperCase()}`;
// Métriques d'équipe pour les valeurs « à l'échelle » (cf. itemEffects.teamMetric).
const SCALE_METRICS = [
  { key: 'streak', label: 'série' },
  { key: 'precision', label: 'précision %' },
  { key: 'imprecision', label: 'imprécision %' },
  { key: 'timeleft', label: '% temps restant' },
  { key: 'correct', label: 'bonnes rép.' },
  { key: 'wrong', label: 'ratées' },
];
const metricLabel = (per) => SCALE_METRICS.find((s) => s.key === per)?.label || per;

export function AmountInput({ value, onChange, min = 0, max = 999, dice = DEFAULT_DICE, scale = true }) {
  const isDice = typeof value === 'string';
  const isScale = value != null && typeof value === 'object';
  // garde le dé courant affichable même s'il n'est pas dans `dice`
  const faces = isDice && !dice.includes(value) ? [value, ...dice] : dice;
  const mode = isScale ? `scale:${value.per}` : (isDice ? value : 'fixed');
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <select className="qed-select" value={mode} onChange={(e) => {
        const m = e.target.value;
        if (m === 'fixed') onChange(Math.max(min, 1));
        else if (m.startsWith('scale:')) onChange({ per: m.slice(6), factor: 1, base: 0 });
        else onChange(m); // dé
      }}>
        <option value="fixed">fixe</option>
        {faces.map((d) => <option key={d} value={d}>{diceFaceLabel(d)}</option>)}
        {scale && SCALE_METRICS.map((s) => <option key={s.key} value={`scale:${s.key}`}>{`📈 × ${s.label}`}</option>)}
      </select>
      {!isDice && !isScale && numInput(value, onChange, { min, max })}
      {isScale && (
        <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', fontSize: 12, color: 'var(--ink-500)' }}>
          {numInput(value.factor ?? 1, (v) => onChange({ ...value, factor: v }), { min: 0, max: 99 })}
          <span>{`× ${metricLabel(value.per)} +`}</span>
          {numInput(value.base ?? 0, (v) => onChange({ ...value, base: v }), { min: 0, max })}
        </span>
      )}
    </span>
  );
}

function ActionEditor({ action, onChange, allowTrap, inTrap }) {
  const a = action;
  const upd = (patch) => onChange({ ...a, ...patch });
  const targetOpts = inTrap ? TRAP_TARGETS : TARGETS;
  return (
    <div className="bal-fx-action" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '6px 8px', background: 'rgba(122,94,58,0.06)', borderRadius: 8 }}>
      <select className="qed-select" value={a.action} onChange={(e) => {
        const k = e.target.value;
        const base = { action: k };
        if (k === 'move') Object.assign(base, { target: 'self', dir: 'forward', n: 2 });
        if (k === 'money') Object.assign(base, { mode: 'gain', target: 'self', n: 5, unit: 'flat' });
        if (k === 'shieldNext') base.n = 1;
        if (k === 'extraTime') base.n = 5;
        if (k === 'rerollQuestion') base.subject = 'same';
        if (k === 'forceSubject') Object.assign(base, { target: 'target', subject: 'hardcore' });
        if (k === 'challenge') Object.assign(base, { subject: 'hardcore', do: [{ action: 'money', mode: 'gain', target: 'self', n: 20, unit: 'flat' }], else: [] });
        if (k === 'placeTrap') base.trap = { label: 'Piège', icon: '🪤', do: [{ action: 'move', target: 'self', dir: 'back', n: 2 }] };
        onChange(base);
      }}>
        {ACTIONS.filter((opt) => allowTrap || (opt.key !== 'placeTrap' && opt.key !== 'challenge')).map((opt) => (
          <option key={opt.key} value={opt.key}>{opt.label}</option>
        ))}
      </select>

      {a.action === 'move' && (
        <>
          <select className="qed-select" value={a.dir} onChange={(e) => upd({ dir: e.target.value })}>
            <option value="forward">Avancer</option><option value="back">Reculer</option>
          </select>
          <select className="qed-select" value={a.target} onChange={(e) => upd({ target: e.target.value })}>
            {targetOpts.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <AmountInput value={a.n} onChange={(v) => upd({ n: v })} min={1} /><span className="bal-fx-unit">cases</span>
        </>
      )}

      {a.action === 'money' && (
        <>
          <select className="qed-select" value={a.mode} onChange={(e) => upd({ mode: e.target.value })}>
            <option value="gain">Donner</option><option value="lose">Retirer</option><option value="steal">Voler</option>
          </select>
          <select className="qed-select" value={a.target} onChange={(e) => upd({ target: e.target.value })}>
            {targetOpts.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <AmountInput value={a.n} onChange={(v) => upd({ n: v })} min={1} />
          <select className="qed-select" value={a.unit} onChange={(e) => upd({ unit: e.target.value })}>
            <option value="flat">pièces</option><option value="percent">%</option>
          </select>
        </>
      )}

      {a.action === 'rerollQuestion' && (
        <select className="qed-select" value={a.subject || 'same'} onChange={(e) => upd({ subject: e.target.value })}>
          <option value="same">Même thème</option>
          <option value="choose">Thème au choix</option>
          {SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
          <optgroup label="Thèmes spéciaux">
            {FORCED_SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
          </optgroup>
        </select>
      )}

      {a.action === 'forceSubject' && (
        <>
          <select className="qed-select" value={a.target} onChange={(e) => upd({ target: e.target.value })}>
            {targetOpts.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <span className="bal-fx-unit">→</span>
          <select className="qed-select" value={a.subject || 'hardcore'} onChange={(e) => upd({ subject: e.target.value })}>
            {[...SUBJECT_KEYS, ...FORCED_SUBJECT_KEYS].map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
          </select>
        </>
      )}

      {(a.action === 'shieldNext' || a.action === 'extraTime') && (
        <AmountInput value={a.n} onChange={(v) => upd({ n: v })} min={1} />
      )}

      {a.action === 'fumigene' && (
        <>
          <span className="bal-fx-unit">durée</span>
          <AmountInput value={a.turns ?? 0} onChange={(v) => upd({ turns: v })} min={0} />
          <span className="bal-fx-unit">tours (0 = jusqu'à utilisation)</span>
        </>
      )}

      {a.action === 'challenge' && (
        <div style={{ flexBasis: '100%', marginTop: 6, paddingLeft: 10, borderLeft: '2px solid #8a1f2e' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
            <span className="bal-fx-unit">Force ma prochaine question en</span>
            <select className="qed-select" value={a.subject || 'hardcore'} onChange={(e) => upd({ subject: e.target.value })}>
              {SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
              <optgroup label="Thèmes spéciaux">
                {FORCED_SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
              </optgroup>
            </select>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>{'\u{1F381}'} Récompense si bonne réponse :</div>
          <ActionList actions={a.do || []} onChange={(d) => upd({ do: d })} allowTrap={false} />
          <div style={{ fontSize: 12, color: 'var(--ink-500)', margin: '8px 0 4px' }}>{'\u{1F480}'} Malus si ratée (optionnel) :</div>
          <ActionList actions={a.else || []} onChange={(d) => upd({ else: d })} allowTrap={false} />
        </div>
      )}

      {a.action === 'placeTrap' && (
        <div style={{ flexBasis: '100%', marginTop: 6, paddingLeft: 10, borderLeft: '2px solid #c9472f' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <input className="qed-input" style={{ width: 110 }} placeholder="Nom du piège"
              value={a.trap?.label || ''} onChange={(e) => upd({ trap: { ...a.trap, label: e.target.value } })} />
            <input className="qed-input" style={{ width: 44, textAlign: 'center' }}
              value={a.trap?.icon || '🪤'} onChange={(e) => upd({ trap: { ...a.trap, icon: e.target.value } })} />
            <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Effets du piège (« celui qui marche dessus » = la victime) :</span>
          </div>
          <ActionList actions={a.trap?.do || []} onChange={(do2) => upd({ trap: { ...a.trap, do: do2 } })} allowTrap={false} inTrap />
        </div>
      )}
    </div>
  );
}

export function ActionList({ actions, onChange, allowTrap = true, inTrap = false }) {
  const upd = (i, v) => onChange(actions.map((a, j) => (j === i ? v : a)));
  return (
    <div className="bal-fx-list">
      {actions.map((a, i) => (
        <div key={i} className="bal-fx-row">
          <div style={{ flex: 1, minWidth: 0 }}><ActionEditor action={a} onChange={(v) => upd(i, v)} allowTrap={allowTrap} inTrap={inTrap} /></div>
          <button className="bal-fx-x" onClick={() => onChange(actions.filter((_, j) => j !== i))} title="Retirer">{'\u{1F5D1}'}</button>
        </div>
      ))}
      <button className="bal-fx-add" onClick={() => onChange([...actions, defaultAction()])}>+ action</button>
    </div>
  );
}

// Carte d'un déclencheur composable.
export function TriggerCard({ fx, onChange, onRemove, slot }) {
  const upd = (patch) => onChange({ ...fx, ...patch });
  const isConsumable = slot === 'consumable';
  // Sous-mode du déclencheur 'use'
  const useMode = fx.roll === 'd6' ? 'd6' : (typeof fx.chance === 'number' ? 'chance' : 'immediate');

  const setUseMode = (mode) => {
    if (mode === 'immediate') onChange({ kind: 'trigger', on: 'use', do: fx.do || [defaultAction()] });
    else if (mode === 'chance') onChange({ kind: 'trigger', on: 'use', chance: 0.5, do: fx.do || [defaultAction()], else: fx.else || [] });
    else onChange({ kind: 'trigger', on: 'use', roll: 'd6', table: fx.table || { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } });
  };

  const onOptions = isConsumable
    ? [{ k: 'use', label: "À l'utilisation" }, { k: 'question', label: 'Bouton « Changer la question »' }]
    : [
        { k: 'roll', label: 'Selon le dé (à mon tour)' },
        { k: 'correct', label: 'Quand je réponds bien' },
        { k: 'wrong', label: 'Quand je rate (ou temps écoulé)' },
        { k: 'question', label: 'Bouton « Changer la question »' },
      ];

  return (
    <div className="bal-fx-trigger" style={{ border: '2px solid var(--gold-500, #e8b117)', borderRadius: 10, padding: 10, background: 'rgba(255,250,240,0.6)', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13 }}>Déclencheur :</span>
        <select className="qed-select" value={fx.on} onChange={(e) => {
          const on = e.target.value;
          if (on === 'use') onChange({ kind: 'trigger', on: 'use', do: [defaultAction()] });
          else if (on === 'roll') onChange({ kind: 'trigger', on: 'roll', values: [6], do: [defaultAction()] });
          else if (on === 'question') onChange({ kind: 'trigger', on: 'question', n: 1, do: [{ action: 'rerollQuestion', subject: 'same' }] });
          else onChange({ kind: 'trigger', on, do: [defaultAction()] }); // correct | wrong
        }}>
          {onOptions.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
        </select>
        <button className="btn btn--ghost btn--sm" onClick={onRemove} style={{ marginLeft: 'auto', color: '#b5341f' }} title="Retirer ce déclencheur">{'\u{1F5D1}'}</button>
      </div>

      {fx.on === 'use' && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Condition :</span>
            <select className="qed-select" value={useMode} onChange={(e) => setUseMode(e.target.value)}>
              <option value="immediate">Toujours</option>
              <option value="chance">% de chance</option>
              <option value="d6">Lancer un dé (table)</option>
            </select>
            {useMode === 'chance' && (
              <>{numInput(Math.round((fx.chance ?? 0.5) * 100), (v) => upd({ chance: v / 100 }), { max: 100 })}<span className="bal-fx-unit">%</span></>
            )}
          </div>
          {useMode !== 'd6' && <ActionList actions={fx.do || []} onChange={(d) => upd({ do: d })} />}
          {useMode === 'chance' && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>Sinon (échec) :</div>
              <ActionList actions={fx.else || []} onChange={(d) => upd({ else: d })} />
            </div>
          )}
          {useMode === 'd6' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[1, 2, 3, 4, 5, 6].map((face) => (
                <div key={face} className="bal-fx-face">
                  <div className="bal-fx-face-label">{'\u{1F3B2}'} {face}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ActionList actions={fx.table?.[face] || []} onChange={(d) => upd({ table: { ...fx.table, [face]: d } })} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {fx.on === 'roll' && (
        <>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Si le dé fait :</span>
            {[1, 2, 3, 4, 5, 6].map((v) => {
              const on = (fx.values || []).includes(v);
              return (
                <button key={v} onClick={() => upd({ values: on ? fx.values.filter((x) => x !== v) : [...(fx.values || []), v] })}
                  style={{ width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontWeight: 700,
                    border: `2px solid ${on ? 'var(--gold-600)' : 'rgba(122,94,58,0.3)'}`,
                    background: on ? 'var(--gold-400)' : '#fff', color: on ? '#3a2a14' : 'var(--ink-500)' }}>{v}</button>
              );
            })}
          </div>
          <ActionList actions={fx.do || []} onChange={(d) => upd({ do: d })} />
        </>
      )}

      {(fx.on === 'correct' || fx.on === 'wrong') && (
        <>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 6 }}>
            {fx.on === 'correct'
              ? 'Effets déclenchés à CHAQUE bonne réponse de l’équipe :'
              : 'Effets déclenchés à chaque mauvaise réponse (ou temps écoulé) :'}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <span className="bal-fx-unit">Seulement si la question est en</span>
            <select className="qed-select" value={fx.subject || ''} onChange={(e) => upd({ subject: e.target.value || undefined })}>
              <option value="">toute matière</option>
              {SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
              <optgroup label="Thèmes spéciaux">
                {FORCED_SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
              </optgroup>
            </select>
          </div>
          <ActionList actions={fx.do || []} onChange={(d) => upd({ do: d })} />
        </>
      )}

      {fx.on === 'question' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flexBasis: '100%', fontSize: 11.5, color: 'var(--ink-500)', marginBottom: 2 }}>
            Pendant une question, l'objet ajoute un bouton « 🔄 Changer » qui relance la question sur le thème choisi.
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>{'\u{1F504}'} Bouton « Changer la question » →</span>
          <select className="qed-select" value={fx.do?.[0]?.subject || 'same'}
            onChange={(e) => upd({ do: [{ action: 'rerollQuestion', subject: e.target.value }] })}>
            <option value="same">Même thème (autre question)</option>
            <option value="choose">Thème au choix</option>
            {SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
            <optgroup label="Thèmes spéciaux">
              {FORCED_SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
            </optgroup>
          </select>
        </div>
      )}
    </div>
  );
}
