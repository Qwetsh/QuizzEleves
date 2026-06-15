// Constructeur d'effets composables — rendu en « PHRASE À TROUS » (façon no-code)
// pour être lisible par un prof : chaque action se lit comme une phrase dont les
// mots variables sont des champs. Schéma inchangé (cf. src/store/effectEngine.js) :
// déclencheurs kind:'trigger' (use / chance / d6 / roll / correct / wrong / question)
// + listes d'ACTIONS atomiques.
import { SUBJECTS, SUBJECT_KEYS, FORCED_SUBJECT_KEYS } from '../../data/subjects';

const ACTIONS = [
  { key: 'money', label: '💰 Or' },
  { key: 'move', label: '🏃 Déplacer' },
  { key: 'rerollQuestion', label: '🔄 Changer la question' },
  { key: 'forceSubject', label: '🎯 Imposer un thème' },
  { key: 'challenge', label: '🎲 Défi (mon thème + pari)' },
  { key: 'placeTrap', label: '🪤 Poser un piège' },
  { key: 'gainCharge', label: '⚡ Recharger un pouvoir' },
  { key: 'shieldNext', label: '🛡️ Bouclier' },
  { key: 'fumigene', label: '💨 Fumigène' },
  { key: 'extraTime', label: '⏳ Temps en +' },
  { key: 'buff', label: '🕒 Effet de durée (X tours)' },
  { key: 'loot', label: '🎁 Loot un objet' },
];

// Types d'effet de durée (buff) — voir gameStore (application) et teamStatus (affichage).
const BUFF_TYPES = [
  { k: 'themeBonus', label: 'gagne de l’or à chaque bonne réponse' },
  { k: 'advanceOnCorrect', label: 'avance à chaque bonne réponse' },
  { k: 'noRecul', label: 'ne recule pas en cas d’erreur' },
  { k: 'loseOnWrong', label: 'perd de l’or en cas d’erreur (malus)' },
  { k: 'randomPath', label: 'voie choisie au hasard' },
];
const TARGETS = [
  { key: 'self', label: 'moi' }, { key: 'target', label: 'une cible' },
  { key: 'randomOpponent', label: 'un adversaire au hasard' }, { key: 'all', label: 'toutes les équipes' },
];
const TRAP_TARGETS = [
  { key: 'self', label: 'celui qui marche dessus' }, { key: 'target', label: 'une autre équipe' },
  { key: 'randomOpponent', label: 'une autre équipe au hasard' }, { key: 'all', label: 'toutes les équipes' },
];

export const defaultAction = () => ({ action: 'money', mode: 'gain', target: 'self', n: 5, unit: 'flat' });

export function defaultTrigger(slot) {
  if (slot === 'consumable') return { kind: 'trigger', on: 'use', do: [defaultAction()] };
  return { kind: 'trigger', on: 'roll', values: [6], do: [{ action: 'money', mode: 'gain', target: 'self', n: 10, unit: 'flat' }] };
}

// Déplie une table d6 (clés « N » ou plages « a-b ») en 6 faces individuelles,
// pour que l'éditeur affiche correctement une table seedée par plages. Le moteur
// (rangeMatch) lit indifféremment les deux formats ; éditer une face écrit alors
// des clés individuelles.
export function expandD6Table(table) {
  const out = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const key of Object.keys(table || {})) {
    const acts = table[key] || [];
    if (String(key).includes('-')) { const [a, b] = String(key).split('-').map(Number); for (let f = a; f <= b; f++) if (out[f] !== undefined) out[f] = acts; }
    else if (out[key] !== undefined) out[key] = acts;
  }
  return out;
}

// Crée un déclencheur d'un type donné (utilisé par le menu « + Ajouter un effet »).
export function makeTrigger(on) {
  if (on === 'roll') return { kind: 'trigger', on: 'roll', values: [6], do: [defaultAction()] };
  if (on === 'question') return { kind: 'trigger', on: 'question', n: 1, do: [{ action: 'rerollQuestion', subject: 'same' }] };
  if (on === 'use') return { kind: 'trigger', on: 'use', do: [defaultAction()] };
  return { kind: 'trigger', on, do: [defaultAction()] }; // correct | wrong
}

const amountLabel = (n) => {
  if (typeof n === 'string') return `1${n.toUpperCase()}`;
  if (n != null && typeof n === 'object') return `${n.base ? `${n.base}+` : ''}${n.factor ?? 1}×${metricLabel(n.per)}`;
  return n;
};

export function describeAction(a) {
  const who = TARGETS.find((t) => t.key === a.target)?.label || a.target;
  switch (a.action) {
    case 'move': return `${a.dir === 'back' ? 'reculer' : 'avancer'} ${who} de ${amountLabel(a.n)}`;
    case 'money': return `${a.mode === 'steal' ? 'voler' : a.mode === 'lose' ? 'retirer' : 'donner'} ${amountLabel(a.n)}${a.unit === 'percent' ? '%' : ''} d'or à ${who}`;
    case 'rerollQuestion': return `changer la question (${a.subject === 'choose' ? 'thème au choix' : a.subject === 'same' || !a.subject ? 'même thème' : SUBJECTS[a.subject]?.name || a.subject})`;
    case 'challenge': return `défi (${SUBJECTS[a.subject]?.name || a.subject}) : ${(a.do || []).map(describeAction).join(', ') || 'rien'}`;
    case 'placeTrap': return `poser un piège (${a.trap?.do?.length || 0} effet·s)`;
    case 'gainCharge': return 'recharger un pouvoir';
    case 'loot': return `loot un objet${a.category ? ` (${a.category})` : ''}`;
    case 'buff': { const b = a.buff || {}; return `effet ${b.turns ?? 3} tours : ${BUFF_TYPES.find((t) => t.k === b.type)?.label || b.type}`; }
    case 'shieldNext': return 'bouclier (annule 1 recul)';
    case 'fumigene': return `fumigène${a.turns ? ` (${amountLabel(a.turns)} tours)` : ''}`;
    case 'extraTime': return `+${amountLabel(a.n)}s à la prochaine question`;
    default: return a.action;
  }
}

// Mot fixe de la phrase (texte non éditable).
const W = ({ children }) => <span className="fx-word">{children}</span>;

const numInput = (value, onChange, { min = 0, max = 999 } = {}) => (
  <input type="number" className="qed-input fx-blank" style={{ width: 58 }} value={value ?? 0}
    min={min} max={max} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} />
);

export const DEFAULT_DICE = ['d4', 'd6', 'd10'];
const diceFaceLabel = (d) => `🎲 1${d.toUpperCase()}`;
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
  const faces = isDice && !dice.includes(value) ? [value, ...dice] : dice;
  const mode = isScale ? `scale:${value.per}` : (isDice ? value : 'fixed');
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <select className="qed-select fx-blank" value={mode} onChange={(e) => {
        const m = e.target.value;
        if (m === 'fixed') onChange(Math.max(min, 1));
        else if (m.startsWith('scale:')) onChange({ per: m.slice(6), factor: 1, base: 0 });
        else onChange(m);
      }}>
        <option value="fixed">valeur fixe</option>
        {faces.map((d) => <option key={d} value={d}>{diceFaceLabel(d)}</option>)}
        {scale && SCALE_METRICS.map((s) => <option key={s.key} value={`scale:${s.key}`}>{`📈 par ${s.label}`}</option>)}
      </select>
      {!isDice && !isScale && numInput(value, onChange, { min, max })}
      {isScale && (
        <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', fontSize: 12, color: 'var(--ink-500)' }}>
          {numInput(value.factor ?? 1, (v) => onChange({ ...value, factor: v }), { min: 0, max: 99 })}
          <W>{`× ${metricLabel(value.per)} +`}</W>
          {numInput(value.base ?? 0, (v) => onChange({ ...value, base: v }), { min: 0, max })}
        </span>
      )}
    </span>
  );
}

// Sélecteur de thème réutilisable (matières + thèmes spéciaux), avec options en tête.
function SubjectSelect({ value, onChange, extra }) {
  return (
    <select className="qed-select fx-blank" value={value} onChange={(e) => onChange(e.target.value)}>
      {extra}
      {SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
      <optgroup label="Thèmes spéciaux">
        {FORCED_SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
      </optgroup>
    </select>
  );
}

function TargetSelect({ value, onChange, opts }) {
  return (
    <select className="qed-select fx-blank" value={value} onChange={(e) => onChange(e.target.value)}>
      {opts.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
    </select>
  );
}

// Une ACTION rendue en phrase à trous.
function ActionEditor({ action, onChange, allowTrap, inTrap }) {
  const a = action;
  const upd = (patch) => onChange({ ...a, ...patch });
  const targetOpts = inTrap ? TRAP_TARGETS : TARGETS;
  return (
    <div className="fx-sentence">
      <select className="qed-select fx-blank fx-blank--verb" value={a.action} onChange={(e) => {
        const k = e.target.value;
        const base = { action: k };
        if (k === 'move') Object.assign(base, { target: 'self', dir: 'forward', n: 2 });
        if (k === 'money') Object.assign(base, { mode: 'gain', target: 'self', n: 5, unit: 'flat' });
        if (k === 'shieldNext') base.n = 1;
        if (k === 'extraTime') base.n = 5;
        if (k === 'rerollQuestion') base.subject = 'same';
        if (k === 'forceSubject') Object.assign(base, { target: 'target', subject: 'hardcore' });
        if (k === 'challenge') Object.assign(base, { subject: 'hardcore', do: [{ action: 'money', mode: 'gain', target: 'self', n: 20, unit: 'flat' }], else: [] });
        if (k === 'buff') Object.assign(base, { target: 'self', buff: { type: 'themeBonus', turns: 3, n: 5 } });
        if (k === 'loot') base.category = '';
        if (k === 'placeTrap') base.trap = { label: 'Piège', icon: '🪤', do: [{ action: 'move', target: 'self', dir: 'back', n: 2 }] };
        onChange(base);
      }}>
        {ACTIONS.filter((opt) => allowTrap || (opt.key !== 'placeTrap' && opt.key !== 'challenge')).map((opt) => (
          <option key={opt.key} value={opt.key}>{opt.label}</option>
        ))}
      </select>

      {a.action === 'move' && (
        <>
          <select className="qed-select fx-blank" value={a.dir} onChange={(e) => upd({ dir: e.target.value })}>
            <option value="forward">avancer</option><option value="back">reculer</option>
          </select>
          <TargetSelect value={a.target} onChange={(v) => upd({ target: v })} opts={targetOpts} />
          <W>de</W>
          <AmountInput value={a.n} onChange={(v) => upd({ n: v })} min={1} />
          <W>cases</W>
        </>
      )}

      {a.action === 'money' && (
        <>
          <select className="qed-select fx-blank" value={a.mode} onChange={(e) => upd({ mode: e.target.value })}>
            <option value="gain">donner</option><option value="lose">retirer</option><option value="steal">voler</option>
          </select>
          <AmountInput value={a.n} onChange={(v) => upd({ n: v })} min={1} />
          <select className="qed-select fx-blank" value={a.unit} onChange={(e) => upd({ unit: e.target.value })}>
            <option value="flat">pièces</option><option value="percent">% d'or</option>
          </select>
          <W>à</W>
          <TargetSelect value={a.target} onChange={(v) => upd({ target: v })} opts={targetOpts} />
        </>
      )}

      {a.action === 'rerollQuestion' && (
        <>
          <W>pour</W>
          <SubjectSelect value={a.subject || 'same'} onChange={(v) => upd({ subject: v })}
            extra={<><option value="same">le même thème</option><option value="choose">un thème au choix</option></>} />
        </>
      )}

      {a.action === 'forceSubject' && (
        <>
          <W>à</W>
          <TargetSelect value={a.target} onChange={(v) => upd({ target: v })} opts={targetOpts} />
          <W>une question</W>
          <SubjectSelect value={a.subject || 'hardcore'} onChange={(v) => upd({ subject: v })} />
        </>
      )}

      {(a.action === 'shieldNext') && (<><W>annule</W><AmountInput value={a.n} onChange={(v) => upd({ n: v })} min={1} /><W>recul(s)</W></>)}
      {(a.action === 'extraTime') && (<><AmountInput value={a.n} onChange={(v) => upd({ n: v })} min={1} /><W>s à la prochaine question</W></>)}
      {a.action === 'gainCharge' && <W>au choix du joueur</W>}

      {a.action === 'fumigene' && (
        <>
          <W>pendant</W>
          <AmountInput value={a.turns ?? 0} onChange={(v) => upd({ turns: v })} min={0} />
          <W>tours (0 = jusqu'à utilisation)</W>
        </>
      )}

      {a.action === 'loot' && (
        <>
          <W>un objet</W>
          <select className="qed-select fx-blank" value={a.category || ''} onChange={(e) => upd({ category: e.target.value || undefined })}>
            <option value="">au hasard</option>
            <option value="consumable">consommable</option>
            <option value="equipment">équipement</option>
          </select>
        </>
      )}

      {a.action === 'buff' && (() => {
        const b = a.buff || {};
        const setB = (patch) => upd({ buff: { ...b, ...patch } });
        return (
          <div className="fx-nest" style={{ borderColor: '#8745d4' }}>
            <div className="fx-sentence">
              <W>pendant</W>
              <input type="number" className="qed-input fx-blank" style={{ width: 56 }} min={1} max={20}
                value={b.turns ?? 3} onChange={(e) => setB({ turns: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
              <W>tours, sur</W>
              <TargetSelect value={a.target || 'self'} onChange={(v) => upd({ target: v })} opts={targetOpts} />
            </div>
            <div className="fx-sentence">
              <W>l'équipe</W>
              <select className="qed-select fx-blank" value={b.type || 'themeBonus'} onChange={(e) => setB({ type: e.target.value })}>
                {BUFF_TYPES.map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}
              </select>
              {b.type === 'themeBonus' && (<><W>de</W><AmountInput value={b.n ?? 5} onChange={(v) => setB({ n: v })} min={1} scale={false} /><W>or, en</W>
                <select className="qed-select fx-blank" value={b.subject || ''} onChange={(e) => setB({ subject: e.target.value || undefined })}>
                  <option value="">toute matière</option>
                  {SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
                  <optgroup label="Thèmes spéciaux">{FORCED_SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}</optgroup>
                </select></>)}
              {b.type === 'loseOnWrong' && (<><W>de</W><AmountInput value={b.n ?? 5} onChange={(v) => setB({ n: v })} min={1} scale={false} /><W>or</W></>)}
              {b.type === 'advanceOnCorrect' && (<><W>de</W><AmountInput value={b.n ?? 'd4'} onChange={(v) => setB({ n: v })} min={1} scale={false} /><W>case(s)</W></>)}
            </div>
          </div>
        );
      })()}

      {a.action === 'challenge' && (
        <div className="fx-nest" style={{ borderColor: '#8a1f2e' }}>
          <div className="fx-sentence">
            <W>force ma prochaine question en</W>
            <SubjectSelect value={a.subject || 'hardcore'} onChange={(v) => upd({ subject: v })} />
          </div>
          <div className="fx-nest-label">{'\u{1F381}'} Si bonne réponse :</div>
          <ActionList actions={a.do || []} onChange={(d) => upd({ do: d })} allowTrap={false} />
          <div className="fx-nest-label">{'\u{1F480}'} Si ratée (optionnel) :</div>
          <ActionList actions={a.else || []} onChange={(d) => upd({ else: d })} allowTrap={false} />
        </div>
      )}

      {a.action === 'placeTrap' && (
        <div className="fx-nest" style={{ borderColor: '#c9472f' }}>
          <div className="fx-sentence">
            <W>nommé</W>
            <input className="qed-input fx-blank" style={{ width: 120 }} placeholder="Nom du piège"
              value={a.trap?.label || ''} onChange={(e) => upd({ trap: { ...a.trap, label: e.target.value } })} />
            <input className="qed-input fx-blank" style={{ width: 44, textAlign: 'center' }}
              value={a.trap?.icon || '🪤'} onChange={(e) => upd({ trap: { ...a.trap, icon: e.target.value } })} />
          </div>
          <div className="fx-nest-label">Effets sur « celui qui marche dessus » :</div>
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
          <button className="bal-fx-x" onClick={() => onChange(actions.filter((_, j) => j !== i))} title="Retirer cette action">{'\u{1F5D1}'}</button>
        </div>
      ))}
      <button className="bal-fx-add" onClick={() => onChange([...actions, defaultAction()])}>+ action</button>
    </div>
  );
}

// Libellés (fragments de phrase) des déclencheurs : la carte préfixe « Quand ».
const ON_FRAGMENTS_EQUIP = [
  { k: 'roll', label: 'le dé fait… (à mon tour)' },
  { k: 'correct', label: 'je réponds bien' },
  { k: 'wrong', label: 'je rate (ou temps écoulé)' },
  { k: 'fightWin', label: 'je gagne un duel' },
  { k: 'fightLose', label: 'je perds un duel' },
  { k: 'question', label: "j'appuie sur « Changer la question »" },
];
const ON_FRAGMENTS_CONSUM = [
  { k: 'use', label: "je l'utilise" },
  { k: 'question', label: "j'appuie sur « Changer la question »" },
];

// Carte d'un déclencheur composable — en-tête en phrase « Quand … : ».
export function TriggerCard({ fx, onChange, onRemove, slot }) {
  const upd = (patch) => onChange({ ...fx, ...patch });
  const isConsumable = slot === 'consumable';
  const useMode = fx.roll === 'd6' ? 'd6' : (typeof fx.chance === 'number' ? 'chance' : 'immediate');
  const onOptions = isConsumable ? ON_FRAGMENTS_CONSUM : ON_FRAGMENTS_EQUIP;

  const setUseMode = (mode) => {
    if (mode === 'immediate') onChange({ kind: 'trigger', on: 'use', do: fx.do || [defaultAction()] });
    else if (mode === 'chance') onChange({ kind: 'trigger', on: 'use', chance: 0.5, do: fx.do || [defaultAction()], else: fx.else || [] });
    else onChange({ kind: 'trigger', on: 'use', roll: 'd6', table: fx.table || { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } });
  };

  return (
    <div className="bal-fx-trigger">
      <div className="fx-trigger-head">
        <W>Quand</W>
        <select className="qed-select fx-blank fx-blank--verb" value={fx.on} onChange={(e) => onChange(makeTrigger(e.target.value))}>
          {onOptions.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
        </select>
        {(fx.on === 'correct' || fx.on === 'wrong') && (
          <>
            <W>en</W>
            <select className="qed-select fx-blank" value={fx.subject || ''} onChange={(e) => upd({ subject: e.target.value || undefined })}>
              <option value="">toute matière</option>
              {SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
              <optgroup label="Thèmes spéciaux">
                {FORCED_SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
              </optgroup>
            </select>
          </>
        )}
        <W>{fx.on === 'question' ? ' →' : ' :'}</W>
        <button className="btn btn--ghost btn--sm" onClick={onRemove} style={{ marginLeft: 'auto', color: '#b5341f' }} title="Retirer ce déclencheur">{'\u{1F5D1}'}</button>
      </div>

      {fx.on === 'use' && (
        <>
          <div className="fx-sentence" style={{ marginBottom: 6 }}>
            <W>Condition :</W>
            <select className="qed-select fx-blank" value={useMode} onChange={(e) => setUseMode(e.target.value)}>
              <option value="immediate">toujours</option>
              <option value="chance">% de chance</option>
              <option value="d6">lancer un dé (table)</option>
            </select>
            {useMode === 'chance' && (<>{numInput(Math.round((fx.chance ?? 0.5) * 100), (v) => upd({ chance: v / 100 }), { max: 100 })}<W>%</W></>)}
          </div>
          {useMode !== 'd6' && <ActionList actions={fx.do || []} onChange={(d) => upd({ do: d })} />}
          {useMode === 'chance' && (
            <div style={{ marginTop: 6 }}>
              <div className="fx-nest-label">Sinon (échec) :</div>
              <ActionList actions={fx.else || []} onChange={(d) => upd({ else: d })} />
            </div>
          )}
          {useMode === 'd6' && (() => {
            const d6 = expandD6Table(fx.table); // affiche correctement les tables par plages
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[1, 2, 3, 4, 5, 6].map((face) => (
                  <div key={face} className="bal-fx-face">
                    <div className="bal-fx-face-label">{'\u{1F3B2}'} {face}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <ActionList actions={d6[face]} onChange={(d) => upd({ table: { ...d6, [face]: d } })} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}

      {fx.on === 'roll' && (
        <>
          <div className="fx-sentence" style={{ marginBottom: 8 }}>
            <W>Si le dé fait :</W>
            {[1, 2, 3, 4, 5, 6].map((v) => {
              const on = (fx.values || []).includes(v);
              return (
                <button key={v} onClick={() => upd({ values: on ? fx.values.filter((x) => x !== v) : [...(fx.values || []), v] })}
                  className={'fx-die' + (on ? ' is-on' : '')}>{v}</button>
              );
            })}
          </div>
          <ActionList actions={fx.do || []} onChange={(d) => upd({ do: d })} />
        </>
      )}

      {(fx.on === 'correct' || fx.on === 'wrong' || fx.on === 'fightWin' || fx.on === 'fightLose') && (
        <ActionList actions={fx.do || []} onChange={(d) => upd({ do: d })} />
      )}

      {fx.on === 'question' && (
        <>
          <div className="fx-nest-label">Pendant une question, l'objet ajoute un bouton « 🔄 Changer » qui relance la question sur :</div>
          <div className="fx-sentence">
            <SubjectSelect value={fx.do?.[0]?.subject || 'same'} onChange={(v) => upd({ do: [{ action: 'rerollQuestion', subject: v }] })}
              extra={<><option value="same">le même thème (autre question)</option><option value="choose">un thème au choix</option></>} />
          </div>
        </>
      )}
    </div>
  );
}
