import { useState } from 'react';
import { ITEMS } from '../../data/items';
import { SUBJECTS } from '../../data/subjects';
import { cellKey, cellN } from '../../store/itemHandlers';
import { soundPower, soundCharge } from '../../logic/sounds';
import { locName } from '../../i18n/content';
import '../../styles/scribe.css';
import {
  ENCHANT_EFFECTS, EFFECT_BY_ID, clampValue, effectPower, enchantCost,
  validateParchment, totalPower, MAX_EFFECTS_PER_PARCHMENT, MAX_TOTAL_POWER,
} from '../../data/enchantPalette';

// Autel du Scribe (app élève + TBI) — créateur d'enchantements OUVERT (façon
// Oblivion) : choisir ≤2 effets, régler leur valeur (bornée), choisir le
// déclencheur ; le coût en or se calcule en direct. Chaque effet est décrit en
// CLAIR (phrase concrète), cérémonie optimiste (le TBI applique le vrai craft).
const PASSIVE_EFFECTS = ENCHANT_EFFECTS.filter((e) => e.kind === 'passive');
const TRIGGERED_EFFECTS = ENCHANT_EFFECTS.filter((e) => e.kind === 'triggered');
const SUBJECT_KEYS = Object.keys(SUBJECTS);

const subjName = (k) => locName(SUBJECTS[k]) || k;

// Fragment « quand » d'un effet déclenché (lisible).
function triggerWhen(p, L) {
  switch (p?.trigger) {
    case 'correct': return L('à chaque bonne réponse', 'on every correct answer');
    case 'wrong': return L('en cas d’erreur', 'on a wrong answer');
    case 'roll': return L(`quand le dé fait ${(p.dice || [6]).join(' / ')}`, `when the die shows ${(p.dice || [6]).join(' / ')}`);
    case 'questionSubject': return L(`sur une question de ${subjName(p.subject)}`, `on a ${subjName(p.subject)} question`);
    default: return '';
  }
}

// Description CONCRÈTE d'un effet configuré (valeur + déclencheur). C'est ce qui
// rend chaque effet explicite, à la sélection comme dans le parchemin.
function describeEffect(e, p, L) {
  const val = p?.value ?? e.min;
  const when = e.kind === 'triggered' ? ` ${triggerWhen(p, L)}` : '';
  const s = (n) => (n > 1 ? 's' : '');
  switch (e.id) {
    // Passifs
    case 'timerBonus': return L(`+${val} s au chrono des questions (en permanence)`, `+${val}s on the question timer (permanent)`);
    case 'reculReduction': return L(`Recul réduit de ${val} case${s(val)} en cas d’erreur`, `Setback reduced by ${val} space${s(val)} on a wrong answer`);
    case 'reflectChance': return L(`${val} % de chance de renvoyer un effet négatif à l’attaquant`, `${val}% chance to reflect a negative effect back`);
    case 'stealProtection': return L(`${val} % de ton or est protégé du vol`, `${val}% of your gold is protected from theft`);
    case 'lootBonusSubject': return L(`+${val} % de butin sur les questions de ${subjName(p.subject)}`, `+${val}% loot on ${subjName(p.subject)} questions`);
    case 'duelImmune': return L('Tu ne peux plus être défié·e en duel', 'You can no longer be challenged to a duel');
    case 'goldStealImmune': return L('Ton or ne peut plus être volé', 'Your gold can no longer be stolen');
    case 'itemStealImmune': return L('Tes objets ne peuvent plus être volés', 'Your items can no longer be stolen');
    // Déclenchés
    case 'gainGold': return L(`Gagne ${val} or${when}`, `Gain ${val} gold${when}`);
    case 'advance': return L(`Avance de ${val} case${s(val)}${when}`, `Advance ${val} space${s(val)}${when}`);
    case 'recharge': return L(`Recharge un pouvoir${when}`, `Recharge a power${when}`);
    case 'extraTime': return L(`+${val} s pour répondre${when}`, `+${val}s to answer${when}`);
    case 'shield': return L(`Gagne un bouclier (${val})${when}`, `Gain a shield (${val})${when}`);
    default: return L(e.fr, e.en);
  }
}

// `team` = équipe qui grave · `en` = mode anglais · `onInscribe(parts)` = action
// d'inscription : mobile → sendIntent (optimiste, undefined) ; TBI → craftParchmentFor
// (synchrone, renvoie { ok }). Si elle renvoie { ok:false }, on annule la cérémonie.
// `bottomInset` (px) = hauteur d'une barre fixe sous le composant à laisser libre
// (barre d'onglets mobile) ; 0 sur le TBI où la modale n'en a pas.
export default function ScribeView({ team, en = false, onInscribe, bottomInset = 0 }) {
  const L = (fr, eng) => (en ? eng : fr);

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
    correct: L('bonne réponse', 'correct'), wrong: L('erreur', 'wrong'),
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
    const res = onInscribe?.(parts);
    if (res && res.ok === false) return; // refus synchrone (TBI) : on ne lance pas la cérémonie
    try { soundPower(); } catch { /* audio indispo */ }
    setPhase('inscribing');
    setTimeout(() => { try { soundCharge(); } catch { /* audio indispo */ } setPhase('done'); }, 1700);
  };
  const reset = () => { setParts([]); setPhase('idle'); };

  // ---- Rendu d'un effet configuré (carte de parchemin) ----
  const renderPart = (p, i) => {
    const e = EFFECT_BY_ID[p.id];
    if (!e) return null;
    const pw = effectPower(e, p);
    return (
      <div key={i} className="scribe-part">
        <button onClick={() => removePart(i)} aria-label={L('retirer', 'remove')} className="scribe-x">×</button>
        <div className="scribe-part-head">
          <span className="scribe-part-icon">{e.icon}</span>
          <span className="scribe-part-name">{L(e.fr, e.en)}</span>
          <span className="scribe-part-pw" title={L('Puissance', 'Power')}>⚡{pw.toFixed(1)}</span>
        </div>

        {/* Phrase claire de ce que fait l'effet, à jour en direct */}
        <div className="scribe-part-desc">« {describeEffect(e, p, L)} »</div>

        {/* Valeur (stepper) sauf binaire */}
        {!e.binary && (
          <Stepper value={p.value} min={e.min} max={e.max} step={e.step} unit={e.unitLabel}
            onChange={(value) => updatePart(i, { value: clampValue(e, value) })} />
        )}

        {/* Déclencheur (effets déclenchés) */}
        {e.kind === 'triggered' && (
          <div className="scribe-chips">
            {e.triggers.map((t) => (
              <button key={t} className={'scribe-chip' + (p.trigger === t ? ' on' : '')}
                onClick={() => updatePart(i, { trigger: t, ...(t === 'roll' ? { dice: p.dice?.length ? p.dice : [6] } : {}), ...(t === 'questionSubject' ? { subject: p.subject || SUBJECT_KEYS[0] } : {}) })}>
                {triggerLabel(t)}
              </button>
            ))}
          </div>
        )}

        {/* Faces du dé (déclencheur 'roll') */}
        {e.kind === 'triggered' && p.trigger === 'roll' && (
          <div className="scribe-chips">
            {[1, 2, 3, 4, 5, 6].map((d) => {
              const on = (p.dice || []).includes(d);
              return (
                <button key={d} className={'scribe-chip sm' + (on ? ' on' : '')} onClick={() => {
                  const cur = p.dice || [];
                  let next = on ? cur.filter((x) => x !== d) : [...cur, d].slice(0, 3);
                  if (!next.length) next = [d];
                  updatePart(i, { dice: next.sort((a, b) => a - b) });
                }}>🎲{d}</button>
              );
            })}
          </div>
        )}

        {/* Matière (questionSubject / lootBonusSubject) */}
        {((e.kind === 'triggered' && p.trigger === 'questionSubject') || e.needsSubject) && (
          <select className="scribe-select" value={p.subject || SUBJECT_KEYS[0]} onChange={(ev) => updatePart(i, { subject: ev.target.value })}>
            {SUBJECT_KEYS.map((k) => <option key={k} value={k}>{subjName(k)}</option>)}
          </select>
        )}
      </div>
    );
  };

  return (
    <div className="scribe-root" style={{ '--scribe-inset': `${bottomInset}px` }}>
      <div className="scribe-body">
        {/* En-tête */}
        <div className="scribe-head">
          <div className="scribe-title">✒️ {L("L'Autel du Scribe", "The Scribe's Altar")}</div>
          <div className="scribe-stats">
            <span className="scribe-stat gold">🪙 {gold}</span>
            <span className="scribe-stat scroll">📜 {blanks}</span>
          </div>
        </div>
        <div className="scribe-intro">{L('Compose ton enchantement (1 à 2 effets), règle ses valeurs, puis grave-le avec de l’or sur un parchemin vierge.', 'Compose your enchantment (1-2 effects), set its values, then inscribe it with gold on a blank scroll.')}</div>

        {/* Le parchemin en cours (se déroule à l'ouverture) */}
        <div className="scribe-sheet">
          <span className="scribe-roll" aria-hidden="true" />
          {parts.length === 0 && <div className="scribe-empty">{L('Parchemin vierge — ajoute un premier effet.', 'Blank scroll — add a first effect.')}</div>}
          {parts.map(renderPart)}
          {parts.length < MAX_EFFECTS_PER_PARCHMENT && (
            <button className="scribe-add" onClick={() => setPicking(true)}>+ {L('Ajouter un effet', 'Add an effect')}</button>
          )}
        </div>

        {/* Puissance / plafond */}
        {parts.length > 0 && (
          <div>
            <div className="scribe-power-row">
              <span>{L('Puissance', 'Power')}</span>
              <span style={{ color: power > MAX_TOTAL_POWER ? '#c0392b' : 'inherit' }}>{power.toFixed(1)} / {MAX_TOTAL_POWER}</span>
            </div>
            <div className={'scribe-bar' + (power > MAX_TOTAL_POWER ? ' over' : '')}>
              <i style={{ width: `${Math.min(100, (power / MAX_TOTAL_POWER) * 100)}%` }} />
            </div>
            {!v.ok && v.reason === 'overpowered' && <div className="scribe-warn">{L('Trop puissant — réduis un effet.', 'Too powerful — reduce an effect.')}</div>}
          </div>
        )}
      </div>

      {/* Barre de gravure (pied de l'Autel) */}
      <div className="scribe-foot">
        {blanks < 1 && <div className="scribe-foot-warn">{L('⚠️ Pas de parchemin vierge (achète-en en boutique).', '⚠️ No blank scroll (buy one in the shop).')}</div>}
        {blanks >= 1 && parts.length > 0 && gold < cost && <div className="scribe-foot-warn">{L('⚠️ Or insuffisant.', '⚠️ Not enough gold.')}</div>}
        <button className={'scribe-ink ' + (canInscribe ? 'ready' : 'off')} onClick={inscribe} disabled={!canInscribe}>
          ✒️ {parts.length ? L(`Graver (${cost} or)`, `Inscribe (${cost} gold)`) : L('Graver', 'Inscribe')}
        </button>
      </div>

      {/* Sélecteur d'effet */}
      {picking && <EffectPicker L={L} onPick={addEffect} onClose={() => setPicking(false)} />}

      {/* Cérémonie d'inscription (animée) */}
      {phase !== 'idle' && (
        <div className="scribe-cer">
          {phase === 'inscribing' ? (
            <>
              <div style={{ position: 'relative', marginBottom: 18 }}>
                <div className="scribe-parch">
                  <div className="ink" style={{ top: '30%', animationDelay: '.1s' }} />
                  <div className="ink" style={{ top: '50%', width: '60%', animationDelay: '.4s' }} />
                  <div className="ink" style={{ top: '70%', width: '70%', animationDelay: '.7s' }} />
                </div>
                <div className="scribe-quill">✒️</div>
                <span className="scribe-spark" style={{ top: -10, left: -16 }}>✦</span>
                <span className="scribe-spark" style={{ bottom: -6, right: -12, animationDelay: '.5s' }}>✦</span>
                <span className="scribe-spark" style={{ top: '40%', right: -22, animationDelay: '.9s' }}>✨</span>
              </div>
              <div style={{ fontFamily: 'var(--font-title, Cinzel, serif)', fontSize: 22, color: '#e9d8ff' }}>{L('Gravure de l’enchantement…', 'Inscribing the enchantment…')}</div>
            </>
          ) : (
            <>
              <div style={{ position: 'relative', display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                <span className="scribe-ring" />
                <span className="scribe-spark" style={{ top: -18, left: -4 }}>✦</span>
                <span className="scribe-spark" style={{ top: 4, right: -28, animationDelay: '.3s' }}>✨</span>
                <span className="scribe-spark" style={{ bottom: -14, left: -22, animationDelay: '.6s' }}>✦</span>
                <div className="scribe-scroll" style={{ animation: 'scribe-rise .7s ease-out both, scribe-float 2.4s ease-in-out .7s infinite' }}>📜</div>
              </div>
              <div style={{ fontFamily: 'var(--font-title, Cinzel, serif)', fontSize: 24, color: '#fff' }}>{L('Parchemin gravé !', 'Scroll inscribed!')}</div>
              <div style={{ fontSize: 15, color: '#cbb6e8', marginTop: 4, textAlign: 'center', maxWidth: 320, fontStyle: 'italic' }}>{L('Retrouve-le dans ton sac, puis applique-le sur une pièce.', 'Find it in your bag, then apply it to a piece.')}</div>
              <button onClick={reset} className="scribe-ink ready" style={{ marginTop: 18, width: 'auto', padding: '11px 26px', fontSize: 17 }}>{L('Parfait !', 'Perfect!')}</button>
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
  return (
    <div className="scribe-stepper">
      <button className="scribe-step-btn" onClick={dec} disabled={value <= min}>−</button>
      <span className="scribe-step-val">{value}{unit ? ` ${unit}` : ''}</span>
      <button className="scribe-step-btn" onClick={inc} disabled={value >= max}>+</button>
    </div>
  );
}

function EffectPicker({ L, onPick, onClose }) {
  const Row = ({ e }) => (
    <button className="scribe-pick-row" onClick={() => onPick(e)}>
      <span className="scribe-pick-ico">{e.icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="scribe-pick-name" style={{ display: 'block' }}>{L(e.fr, e.en)}</span>
        <span className="scribe-pick-desc">{describeEffect(e, defaultCfg(e), L)}</span>
      </span>
      <span className="scribe-pick-plus">+</span>
    </button>
  );
  return (
    <div className="scribe-picker-bg" onClick={onClose}>
      <div className="scribe-picker" onClick={(ev) => ev.stopPropagation()}>
        <div className="scribe-picker-title">{L('Choisir un effet', 'Choose an effect')}</div>
        <div className="scribe-picker-cat">{L('PASSIFS — toujours actifs', 'PASSIVE — always on')}</div>
        {PASSIVE_EFFECTS.map((e) => <Row key={e.id} e={e} />)}
        <div className="scribe-picker-cat">{L('DÉCLENCHÉS — selon un moment', 'TRIGGERED — on an event')}</div>
        {TRIGGERED_EFFECTS.map((e) => <Row key={e.id} e={e} />)}
      </div>
    </div>
  );
}

// Config représentative d'un effet pour décrire un exemple dans le sélecteur.
function defaultCfg(e) {
  const p = {};
  if (!e.binary) p.value = e.min;
  if (e.kind === 'triggered') { p.trigger = e.triggers[0]; if (e.triggers[0] === 'roll') p.dice = [6]; }
  if (e.needsSubject) p.subject = SUBJECT_KEYS[0];
  return p;
}
