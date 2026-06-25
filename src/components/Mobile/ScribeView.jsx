import { useState } from 'react';
import { ITEMS } from '../../data/items';
import { SUBJECTS } from '../../data/subjects';
import { cellKey, cellN } from '../../store/itemHandlers';
import { sendIntent } from '../../logic/sessionConfig';
import { tFor } from '../../i18n';
import { locName } from '../../i18n/content';
import {
  ENCHANT_EFFECTS, EFFECT_BY_ID, clampValue, effectPower, enchantCost,
  validateParchment, totalPower, MAX_EFFECTS_PER_PARCHMENT, MAX_TOTAL_POWER,
} from '../../data/enchantPalette';

// Autel du Scribe (app élève) — créateur d'enchantements OUVERT (façon Oblivion) :
// choisir ≤2 effets, régler leur valeur (bornée), choisir le déclencheur ; le coût
// en or se calcule en direct. Cérémonie optimiste : le TBI applique le vrai craft.
const PASSIVE_EFFECTS = ENCHANT_EFFECTS.filter((e) => e.kind === 'passive');
const TRIGGERED_EFFECTS = ENCHANT_EFFECTS.filter((e) => e.kind === 'triggered');
const SUBJECT_KEYS = Object.keys(SUBJECTS);

const ACCENT = '#7a4fae';
const PARCH = 'linear-gradient(180deg,#fbf3df,#efe0bd)';

export default function ScribeView({ session, teamIdx, code, token }) {
  const en = !!session?.englishMode;
  const T = tFor(en);
  const L = (fr, eng) => (en ? eng : fr);
  const team = session.teams[teamIdx];

  const [parts, setParts] = useState([]);     // [{ id, value, trigger, dice, subject }]
  const [picking, setPicking] = useState(false);
  const [phase, setPhase] = useState('idle');  // idle | inscribing | done

  const gold = team?.money ?? 0;
  const blanks = (team?.bag || []).reduce((s, c) => {
    const it = ITEMS[cellKey(c)];
    return s + (it && it.family === 'parchment' && it.blank ? cellN(c) : 0);
  }, 0);

  const v = validateParchment(parts);
  const cost = parts.length ? enchantCost(parts) : 0;
  const power = totalPower(parts);
  const canInscribe = v.ok && blanks >= 1 && gold >= cost && phase === 'idle';

  const triggerLabel = (t) => ({
    correct: L('bonne réponse', 'correct answer'), wrong: L('erreur', 'wrong answer'),
    roll: L('dé = …', 'die = …'), questionSubject: L('question de …', 'question in …'),
  }[t] || t);

  const defaultPart = (e) => {
    const p = { id: e.id };
    if (!e.binary) p.value = e.min;
    if (e.kind === 'triggered') { p.trigger = e.triggers[0]; if (e.triggers[0] === 'roll') p.dice = [6]; }
    if (e.needsSubject) p.subject = SUBJECT_KEYS[0];
    return p;
  };
  const addEffect = (e) => { setParts((ps) => (ps.length < MAX_EFFECTS_PER_PARCHMENT ? [...ps, defaultPart(e)] : ps)); setPicking(false); };
  const updatePart = (i, patch) => setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const removePart = (i) => setParts((ps) => ps.filter((_, j) => j !== i));

  const inscribe = () => {
    if (!canInscribe) return;
    setPhase('inscribing');
    sendIntent(code, token, 'craftParchment', { parts }).catch(() => {});
    setTimeout(() => setPhase('done'), 1700);
  };
  const reset = () => { setParts([]); setPhase('idle'); };

  // ---- Rendu d'un effet configuré (carte) ----
  const renderPart = (p, i) => {
    const e = EFFECT_BY_ID[p.id];
    if (!e) return null;
    const pw = effectPower(e, p);
    return (
      <div key={i} style={{ background: '#fffdf7', border: '1.5px solid rgba(122,94,58,0.25)', borderRadius: 14, padding: '10px 12px', marginBottom: 8, position: 'relative' }}>
        <button onClick={() => removePart(i)} aria-label="x" style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, border: 'none', background: '#efe4cf', color: '#8a6a3a', fontSize: 15, cursor: 'pointer' }}>×</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>{e.icon}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: '#5a4424' }}>{L(e.fr, e.en)}</span>
          <span style={{ marginLeft: 'auto', marginRight: 26, fontSize: 11, color: ACCENT, fontWeight: 700 }}>⚡{pw.toFixed(1)}</span>
        </div>

        {/* Valeur (stepper) sauf binaire */}
        {!e.binary && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: e.kind === 'triggered' || e.needsSubject ? 8 : 0 }}>
            <Stepper value={p.value} min={e.min} max={e.max} step={e.step} unit={e.unitLabel} onChange={(value) => updatePart(i, { value: clampValue(e, value) })} />
          </div>
        )}

        {/* Déclencheur (effets déclenchés) */}
        {e.kind === 'triggered' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: p.trigger === 'roll' || p.trigger === 'questionSubject' ? 8 : 0 }}>
            {e.triggers.map((t) => (
              <Chip key={t} on={p.trigger === t} onClick={() => updatePart(i, { trigger: t, ...(t === 'roll' ? { dice: p.dice?.length ? p.dice : [6] } : {}), ...(t === 'questionSubject' ? { subject: p.subject || SUBJECT_KEYS[0] } : {}) })}>{triggerLabel(t)}</Chip>
            ))}
          </div>
        )}

        {/* Faces du dé (déclencheur 'roll') */}
        {e.kind === 'triggered' && p.trigger === 'roll' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6].map((d) => {
              const on = (p.dice || []).includes(d);
              return (
                <Chip key={d} on={on} small onClick={() => {
                  const cur = p.dice || [];
                  let next = on ? cur.filter((x) => x !== d) : [...cur, d].slice(0, 3);
                  if (!next.length) next = [d];
                  updatePart(i, { dice: next.sort((a, b) => a - b) });
                }}>🎲{d}</Chip>
              );
            })}
          </div>
        )}

        {/* Matière (questionSubject / lootBonusSubject) */}
        {((e.kind === 'triggered' && p.trigger === 'questionSubject') || e.needsSubject) && (
          <select value={p.subject || SUBJECT_KEYS[0]} onChange={(ev) => updatePart(i, { subject: ev.target.value })}
            style={{ marginTop: 6, width: '100%', padding: '6px 8px', borderRadius: 8, border: '1.5px solid rgba(122,94,58,0.3)', background: '#fffefb', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
            {SUBJECT_KEYS.map((k) => <option key={k} value={k}>{locName(SUBJECTS[k]) || k}</option>)}
          </select>
        )}
      </div>
    );
  };

  return (
    <div className="alc-scr" style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 96px', position: 'relative' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#6e4e8e' }}>✒️ {L("L'Autel du Scribe", "The Scribe's Altar")}</div>
        <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
          <span style={{ background: '#fff7e4', border: '1.5px solid #e8c878', borderRadius: 12, padding: '2px 10px', fontWeight: 700, color: '#7c5a1c' }}>🪙 {gold}</span>
          <span style={{ background: '#f1e8fb', border: '1.5px solid #c9b0ec', borderRadius: 12, padding: '2px 10px', fontWeight: 700, color: ACCENT }}>📜 {blanks}</span>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: '#9b7e4e', marginBottom: 10 }}>{L('Compose ton enchantement (1-2 effets), règle les valeurs, puis grave-le avec de l’or et un parchemin vierge.', 'Compose your enchantment (1-2 effects), set the values, then inscribe it with gold and a blank scroll.')}</div>

      {/* Parchemin en cours */}
      <div style={{ background: PARCH, borderRadius: 18, padding: '14px 14px 12px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px rgba(120,85,30,0.12)', border: '1px solid rgba(150,110,50,0.2)' }}>
        {parts.length === 0 && <div style={{ textAlign: 'center', color: '#a98c5c', fontStyle: 'italic', padding: '18px 0' }}>{L('Parchemin vierge — ajoute un premier effet.', 'Blank scroll — add a first effect.')}</div>}
        {parts.map(renderPart)}
        {parts.length < MAX_EFFECTS_PER_PARCHMENT && (
          <button onClick={() => setPicking(true)} style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: `2px dashed ${ACCENT}88`, background: 'transparent', color: ACCENT, fontFamily: 'var(--font-display)', fontSize: 15, cursor: 'pointer' }}>+ {L('Ajouter un effet', 'Add an effect')}</button>
        )}
      </div>

      {/* Puissance / plafond */}
      {parts.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#7a5e3a', marginBottom: 3 }}>
            <span>{L('Puissance', 'Power')}</span><span style={{ color: power > MAX_TOTAL_POWER ? '#c0392b' : '#7a5e3a' }}>{power.toFixed(1)} / {MAX_TOTAL_POWER}</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (power / MAX_TOTAL_POWER) * 100)}%`, background: power > MAX_TOTAL_POWER ? '#c0392b' : `linear-gradient(90deg,${ACCENT},#b98cff)` }} />
          </div>
          {!v.ok && v.reason === 'overpowered' && <div style={{ fontSize: 11.5, color: '#c0392b', marginTop: 4 }}>{L('Trop puissant — réduis un effet.', 'Too powerful — reduce an effect.')}</div>}
        </div>
      )}

      {/* Barre de gravure (fixe en bas du contenu) */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', background: 'linear-gradient(180deg,rgba(255,254,251,0),rgba(255,254,251,0.96) 30%)' }}>
        {blanks < 1 && <div style={{ fontSize: 12, color: '#c0392b', fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>{L('⚠️ Pas de parchemin vierge (achète-en en boutique).', '⚠️ No blank scroll (buy one in the shop).')}</div>}
        {blanks >= 1 && parts.length > 0 && gold < cost && <div style={{ fontSize: 12, color: '#c0392b', fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>{L('⚠️ Or insuffisant.', '⚠️ Not enough gold.')}</div>}
        <button onClick={inscribe} disabled={!canInscribe} style={{
          width: '100%', border: 'none', borderRadius: 16, padding: '14px 0', fontFamily: 'var(--font-display)', fontSize: 17, letterSpacing: 0.3,
          ...(canInscribe ? { background: `linear-gradient(180deg,#9b6fd0,#6e3fae)`, color: '#fff', cursor: 'pointer', boxShadow: '0 6px 16px rgba(110,63,174,0.4)' } : { background: 'linear-gradient(180deg,#e6dcc6,#d6c8a4)', color: '#a08a5e', cursor: 'default' }),
        }}>✒️ {parts.length ? L(`Graver (${cost} or)`, `Inscribe (${cost} gold)`) : L('Graver', 'Inscribe')}</button>
      </div>

      {/* Sélecteur d'effet */}
      {picking && <EffectPicker L={L} onPick={addEffect} onClose={() => setPicking(false)} />}

      {/* Cérémonie d'inscription */}
      {phase !== 'idle' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(30,20,45,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {phase === 'inscribing' ? (
            <>
              <div style={{ fontSize: 70, animation: 'alc-floaty 1.2s ease-in-out infinite' }}>✒️</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#e9d8ff', marginTop: 10 }}>{L('Gravure de l’enchantement…', 'Inscribing the enchantment…')}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 74, filter: 'drop-shadow(0 0 24px rgba(155,89,208,0.9))', animation: 'alc-riseShine .7s ease-out both' }}>📜</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#fff', marginTop: 8 }}>{L('Parchemin gravé !', 'Scroll inscribed!')}</div>
              <div style={{ fontSize: 13, color: '#cbb6e8', marginTop: 4, textAlign: 'center' }}>{L('Retrouve-le dans ton sac, puis applique-le sur une pièce.', 'Find it in your bag, then apply it to a piece.')}</div>
              <button onClick={reset} style={{ marginTop: 18, padding: '11px 26px', borderRadius: 14, border: 'none', background: 'linear-gradient(180deg,#9b6fd0,#6e3fae)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 16, cursor: 'pointer' }}>{L('Parfait !', 'Perfect!')}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stepper({ value, min, max, step = 1, unit, onChange }) {
  const dec = () => onChange(Math.max(min, (value ?? min) - step));
  const inc = () => onChange(Math.min(max, (value ?? min) + step));
  const btn = { width: 36, height: 36, borderRadius: 9, border: '1.5px solid rgba(122,94,58,0.4)', background: '#fffefb', fontSize: 20, fontWeight: 800, color: '#7a5e3a', cursor: 'pointer' };
  return (
    <>
      <button onClick={dec} disabled={value <= min} style={{ ...btn, opacity: value <= min ? 0.4 : 1 }}>−</button>
      <span style={{ minWidth: 56, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 18, color: '#5a4626' }}>{value}{unit ? ` ${unit}` : ''}</span>
      <button onClick={inc} disabled={value >= max} style={{ ...btn, opacity: value >= max ? 0.4 : 1 }}>+</button>
    </>
  );
}

function Chip({ on, small, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '4px 9px' : '6px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-ui)',
      fontSize: small ? 12 : 12.5, fontWeight: on ? 800 : 600,
      border: '1.5px solid ' + (on ? ACCENT : 'rgba(122,94,58,0.3)'),
      background: on ? ACCENT : '#fffefb', color: on ? '#fff' : '#7a5e3a',
    }}>{children}</button>
  );
}

function EffectPicker({ L, onPick, onClose }) {
  const Row = ({ e }) => (
    <button onClick={() => onPick(e)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(122,94,58,0.2)', background: '#fffefb', cursor: 'pointer', textAlign: 'left', marginBottom: 6 }}>
      <span style={{ fontSize: 22 }}>{e.icon}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#5a4424' }}>{L(e.fr, e.en)}</span>
      <span style={{ marginLeft: 'auto', fontSize: 18, color: ACCENT }}>+</span>
    </button>
  );
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 65, background: 'rgba(20,12,4,0.55)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(ev) => ev.stopPropagation()} style={{ width: '100%', maxHeight: '80vh', overflowY: 'auto', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '14px 16px calc(16px + env(safe-area-inset-bottom))' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#6e4e8e', marginBottom: 8 }}>{L('Choisir un effet', 'Choose an effect')}</div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#9b7e4e', margin: '6px 0 6px' }}>{L('PASSIFS', 'PASSIVE')}</div>
        {PASSIVE_EFFECTS.map((e) => <Row key={e.id} e={e} />)}
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#9b7e4e', margin: '10px 0 6px' }}>{L('DÉCLENCHÉS', 'TRIGGERED')}</div>
        {TRIGGERED_EFFECTS.map((e) => <Row key={e.id} e={e} />)}
      </div>
    </div>
  );
}
