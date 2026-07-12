// Manette téléphone : overlay plein écran affiché sur le téléphone de l'équipe
// ACTIVE quand l'option « manette » (Setup) est active. Chaque bouton envoie un
// intent `turn*` ; le TBI (maître) valide et applique — premier arrivé gagne,
// le tableau reste utilisable en parallèle. L'affichage est un MIROIR de
// `session.turn` (aucune logique de jeu locale) : les phases non couvertes
// renvoient vers le tableau, la manette ne bloque jamais la partie.
import { useState, useEffect, useRef } from 'react';
import { sendIntent, randomToken } from '../../logic/sessionConfig';
import { SUBJECTS, SUBJECT_KEYS } from '../../data/subjects';
import { POWERS } from '../../data/powers';
import { ITEMS } from '../../data/items';
import { itemImg } from '../../logic/itemAssets';
import { locName, locDesc } from '../../i18n/content';
import TeamAvatar from '../TeamAvatar';
import { merchantPrice } from '../../store/eventHandlers';

// Infos d'affichage d'une matière/thème (le mobile résout localement, comme
// pour ITEMS/POWERS). Thème inconnu (custom) → neutre doré.
function subjInfo(key, en) {
  const s = key ? SUBJECTS[key] : null;
  if (!s) return { name: key || '', icon: '🎲', color: '#e0a458' };
  return { name: (en && s.name_en) || s.name, icon: s.icon, color: s.color };
}

// Libellé d'une case du plateau (carte-direction / case d'arrivée).
function tileLabel(t, en, T) {
  if (!t) return { name: '…', icon: '❓', color: '#e0a458' };
  if (t.type === 'arrivee') return { name: en ? 'FINISH' : 'ARRIVÉE', icon: '🏁', color: '#e0a458' };
  if (t.type === 'depart') return { name: en ? 'START' : 'DÉPART', icon: '🚩', color: '#e0a458' };
  if (t.type === 'jonction') return { name: T('mobile.ctrlTileJunction'), icon: '❓', color: '#e0a458' };
  if (t.subject) return subjInfo(t.subject, en);
  return { name: t.label || t.type || '…', icon: '🎲', color: '#e0a458' };
}

// Compte à rebours local d'AFFICHAGE depuis la deadline publiée (l'horloge de
// référence est le TBI : à 0, c'est LUI qui révèle — le téléphone reflète).
function useCountdown(deadline, frozen) {
  const calc = () => (deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    if (!deadline || frozen) return undefined;
    setLeft(calc());
    const iv = setInterval(() => setLeft(calc()), 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, frozen]);
  return left;
}

// Rangée d'actions contextuelles (pouvoirs castables + consommables). Deux taps
// pour un consommable/pouvoir (armer puis confirmer) : évite les mauvais taps.
// Le TBI reste seul juge (usePower/useConsumable re-vérifient tout) — un tap
// hors contexte est simplement sans effet.
function ActionRow({ team, context, busy, act, T }) {
  const [armed, setArmed] = useState(null);
  const powers = Object.entries(team?.powers || {})
    .filter(([k, p]) => POWERS[k] && (p?.charges || 0) > 0)
    .filter(([k]) => POWERS[k].category === 'off' || (context === 'landing' && k === 'relance'));
  const keyOf = (c) => (c == null ? null : typeof c === 'string' ? c : c.key);
  const seen = new Set();
  const consoKeys = (team?.bag || []).map(keyOf)
    .filter((k) => k && ITEMS[k]?.slot === 'consumable')
    .filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
  if (!powers.length && !consoKeys.length) return null;

  const fire = (id, type, payload) => {
    if (armed !== id) { setArmed(id); return; }
    setArmed(null);
    act(type, payload);
  };

  return (
    <div className="mob-ctrl-actions">
      {powers.map(([k, p]) => (
        <button key={`pw-${k}`} className={`mob-ctrl-action${armed === `pw-${k}` ? ' is-armed' : ''}`} disabled={busy}
          style={{ '--opt-color': POWERS[k].color }}
          onClick={() => fire(`pw-${k}`, 'turnUsePower', { key: k })}>
          <span className="mob-ctrl-action-ic">{POWERS[k].icon}</span>
          <span>{armed === `pw-${k}` ? T('mobile.ctrlConfirm') : locName(POWERS[k])}</span>
          <span className="mob-ctrl-action-n">×{p.charges}</span>
        </button>
      ))}
      {consoKeys.map((k) => {
        const it = ITEMS[k];
        return (
          <button key={`it-${k}`} className={`mob-ctrl-action${armed === `it-${k}` ? ' is-armed' : ''}`} disabled={busy}
            onClick={() => fire(`it-${k}`, 'turnUseConsumable', { key: k })}>
            <span className="mob-ctrl-action-ic">
              {itemImg(it) ? <img src={itemImg(it)} alt="" /> : (it.icon || '🎒')}
            </span>
            <span>{armed === `it-${k}` ? T('mobile.ctrlConfirm') : locName(it)}</span>
          </button>
        );
      })}
    </div>
  );
}

// Sélecteur de cible (pouvoir offensif ou interrupt du moteur d'effets) :
// mêmes règles que la modale TBI — immunité totale grisée, pacte = double tap
// de confirmation (trahison publique).
function TargetPickerPanel({ tp, session, teamIdx, busy, act, T }) {
  const [betray, setBetray] = useState(null);
  const p = tp.powerKey ? POWERS[tp.powerKey] : null;
  return (
    <div className="mob-ctrl-qwrap">
      <div className="mob-ctrl-subtitle" style={{ textAlign: 'center' }}>
        {p ? `${p.icon} ${locName(p)}` : `🎯 ${T('mobile.ctrlPickTarget')}`}
      </div>
      {p && <div className="mob-ctrl-hint" style={{ textAlign: 'center' }}>{locDesc(p)}</div>}
      <div className="mob-ctrl-opts" style={{ maxWidth: 'none' }}>
        {(session.teams || []).map((t, i) => {
          if (i === teamIdx && !tp.allowSelf) return null;
          const immune = (tp.immune || []).includes(i);
          const pact = (tp.pact || []).includes(i);
          const isBetray = betray === i;
          return (
            <button key={i} className="mob-ctrl-opt" disabled={busy || immune}
              style={{ '--opt-color': isBetray ? '#c9472f' : (t.color || '#e0a458'), opacity: immune ? 0.45 : 1 }}
              onClick={() => {
                if (pact && !isBetray) { setBetray(i); return; }
                setBetray(null);
                act('turnSelectTarget', { index: i });
              }}>
              <span className="mob-ctrl-opt-icon" style={{ background: 'rgba(255,255,255,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><TeamAvatar team={t} size={26} /></span>
              <span style={{ minWidth: 0, fontWeight: 700 }}>
                {t.name}
                {i === teamIdx && ` ${T('mobile.ctrlSelf')}`}
                {immune && <span style={{ display: 'block', fontSize: 12, opacity: 0.8 }}>{T('mobile.ctrlImmune')}</span>}
                {pact && <span style={{ display: 'block', fontSize: 12, color: '#e8a13a' }}>{isBetray ? T('mobile.ctrlBetray') : `🐍 ${T('mobile.ctrlPact')}`}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <button className="mob-btn mob-btn--ghost" style={{ color: '#f3e9d3' }} disabled={busy}
        onClick={() => act('turnCancelTarget')}>{T('mobile.ctrlCancel')}</button>
    </div>
  );
}

// Panneau QCM : la question complète se joue sur le téléphone. Anti-triche :
// la bonne réponse (correctIndex) n'arrive dans le payload qu'APRÈS révélation.
function QuestionPanel({ q, team, en, busy, act, T }) {
  const revealed = !!q.answerRevealed;
  const timeLeft = useCountdown(q.deadline, revealed);
  // Sélection optimiste : surlignage neutre du choix tapé, en attendant que le
  // TBI confirme (payload avec answerRevealed + correctIndex).
  const [pick, setPick] = useState(null);
  const qKey = q.q;
  useEffect(() => { setPick(null); }, [qKey]);

  const text = (en && q.q_en) ? q.q_en : q.q;
  const ansText = (i) => (en && q.a_en?.[i]) ? q.a_en[i] : q.a?.[i];
  const expl = (en && q.explanation_en) ? q.explanation_en : q.explanation;
  const info = subjInfo(q.subject, en);
  const isBurst = !!q.multiTotal && q.multiTotal > 1;
  const isCorrect = revealed && q.selected != null && q.selected === q.correctIndex;

  const tap = (i) => {
    if (revealed || busy || (q.hidden || []).includes(i)) return;
    setPick(i);
    act('turnAnswerSelect', { index: i });
  };

  return (
    <div className="mob-ctrl-qwrap">
      <div className="mob-ctrl-qhead" style={{ color: info.color }}>
        {info.icon} {info.name}
        {isBurst && <span className="mob-ctrl-qburst">💀 {q.multiIndex}/{q.multiTotal}</span>}
      </div>
      <div className="mob-ctrl-qtext">{text}</div>
      {q.img && (
        <div className="mob-ctrl-qmedia">
          {/* Silhouette (« Qui est ce Pokémon ? ») masquée en noir jusqu'à la
              révélation, comme sur le TBI (anti-spoiler côté téléphone). */}
          <img src={q.img} alt="" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, filter: q.render === 'silhouette' && !revealed ? 'brightness(0)' : 'brightness(1)', transition: 'filter 0.6s ease' }} />
        </div>
      )}
      {q.audio && (
        <div className="mob-ctrl-qmedia" style={{ textAlign: 'center' }}>
          <audio key={q.audio} src={q.audio} controls controlsList="nodownload" style={{ width: '100%' }} />
        </div>
      )}
      {!revealed && (
        <div className="mob-ctrl-qtimer">
          <div className="mob-ctrl-qtimer-fill" style={{ width: `${Math.min(100, (timeLeft / 30) * 100)}%`, background: timeLeft <= 5 ? '#e14b3a' : timeLeft <= 12 ? '#e8a13a' : '#57c84d' }} />
          <span className="mob-ctrl-qtimer-secs">{timeLeft}s</span>
        </div>
      )}
      <div className="mob-ctrl-qans">
        {(q.a || []).map((_, i) => {
          const hidden = (q.hidden || []).includes(i);
          let cls = 'mob-ctrl-ans';
          if (hidden) cls += ' is-hidden';
          else if (revealed && i === q.correctIndex) cls += ' is-correct';
          else if (revealed && i === q.selected && i !== q.correctIndex) cls += ' is-wrong';
          else if (revealed) cls += ' is-dim';
          else if (pick === i && busy) cls += ' is-picked';
          return (
            <button key={i} className={cls} disabled={hidden || revealed || busy} onClick={() => tap(i)}>
              <span className="mob-ctrl-ans-letter">{String.fromCharCode(65 + i)}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {q.a_img?.[i] && <img src={q.a_img[i]} alt="" style={{ maxHeight: 56, maxWidth: '100%', objectFit: 'contain', borderRadius: 5 }} />}
                {ansText(i) && <span>{ansText(i)}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {!revealed && (
        <div className="mob-ctrl-actions">
          {!q.indiceUsed && (team?.powers?.indice?.charges || 0) > 0 && (
            <button className="mob-ctrl-action" disabled={busy} style={{ '--opt-color': POWERS.indice?.color }}
              onClick={() => act('turnUsePower', { key: 'indice' })}>
              <span className="mob-ctrl-action-ic">💡</span>
              <span>{locName(POWERS.indice)}</span>
              <span className="mob-ctrl-action-n">×{team.powers.indice.charges}</span>
            </button>
          )}
          {(q.rerollOptions || []).map((o, i) => (
            <button key={i} className="mob-ctrl-action" disabled={busy}
              onClick={() => act('turnUseReroll', { optIndex: i })}>
              <span className="mob-ctrl-action-ic">🔄</span>
              <span>{T('mobile.ctrlReroll')} ({o.itemName})</span>
            </button>
          ))}
        </div>
      )}
      {!revealed && busy && <div className="mob-ctrl-hint">⏳ {T('mobile.ctrlAnswerSent')}</div>}
      {revealed && (
        <>
          <div className="mob-ctrl-verdict" style={{ color: isCorrect ? '#57c84d' : '#e8574b' }}>
            {isCorrect ? `✓ ${T('mobile.ctrlCorrect')}` : (q.selected != null ? `✕ ${T('mobile.ctrlWrong')}` : `✕ ${T('mobile.ctrlTimeout')}`)}
          </div>
          {expl && (
            <div className="mob-ctrl-explain">
              <strong>{T('mobile.ctrlExplanation')}</strong> {expl}
            </div>
          )}
          <button className="mob-btn mob-btn--gold" style={{ width: '100%', maxWidth: 320 }}
            disabled={busy} onClick={() => act('turnQuestionContinue')}>
            {busy ? T('mobile.ctrlSent') : T('mobile.ctrlContinue')}
          </button>
        </>
      )}
    </div>
  );
}

// Bouton-objet compact (coffres, marchand) : image + nom + prix éventuel.
function ItemBtn({ itemKey, priceLabel, disabled, onClick }) {
  const it = ITEMS[itemKey];
  if (!it) return null;
  return (
    <button className="mob-ctrl-opt" disabled={disabled} style={{ '--opt-color': '#e0a458', opacity: disabled ? 0.5 : 1 }} onClick={onClick}>
      <span className="mob-ctrl-opt-icon" style={{ background: 'rgba(255,255,255,0.12)' }}>
        {itemImg(it) ? <img src={itemImg(it)} alt="" style={{ width: '78%', height: '78%', objectFit: 'contain' }} /> : (it.icon || '🎁')}
      </span>
      <span style={{ minWidth: 0, fontWeight: 700, flex: 1 }}>{locName(it)}</span>
      {priceLabel != null && <span style={{ fontSize: 13.5, fontWeight: 800, color: '#f3c969' }}>{priceLabel}</span>}
    </button>
  );
}

// Liste de pouvoirs (recharge / marché noir / vol) → un intent par tap.
function PowerList({ entries, busy, onPick, price }) {
  return (
    <div className="mob-ctrl-opts" style={{ maxWidth: 'none' }}>
      {entries.map(([k, p]) => (
        <button key={k} className="mob-ctrl-opt" disabled={busy || (price && price(k) === null)}
          style={{ '--opt-color': POWERS[k]?.color || '#e0a458' }}
          onClick={() => onPick(k)}>
          <span className="mob-ctrl-opt-icon">{POWERS[k]?.icon}</span>
          <span style={{ minWidth: 0, fontWeight: 700, flex: 1 }}>
            {locName(POWERS[k])} <span style={{ opacity: 0.75 }}>×{p?.charges ?? 0}</span>
          </span>
          {price && price(k) != null && <span style={{ fontSize: 13.5, fontWeight: 800, color: '#f3c969' }}>{price(k)} 🪙</span>}
        </button>
      ))}
    </div>
  );
}

// Panneau événement : miroir de l'EventModal TBI, phase par phase. Les phases
// trop « plateau » (troc positionnel, pillage) renvoient vers le tableau.
function EventPanel({ evt, session, teamIdx, busy, act, T }) {
  const en = !!session.englishMode;
  const team = session.teams?.[teamIdx];
  const d = evt.data || {};
  // Vol de pouvoir : choix en 2 temps (voler quoi, recharger quoi) — local.
  const [stealKey, setStealKey] = useState(null);
  useEffect(() => { setStealKey(null); }, [evt.key, evt.phase]);

  const header = (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>{evt.icon || '❔'}</div>
      <div className="mob-ctrl-subtitle">{(en && evt.name_en) || evt.name || ''}</div>
    </div>
  );

  switch (evt.phase) {
    case 'roulette':
      return <>{header}<div className="mob-ctrl-hint">🎰 {T('mobile.ctrlWatchBoard')}</div></>;
    case 'intro':
      return (
        <>
          {header}
          <div className="mob-ctrl-hint" style={{ maxWidth: 360 }}>{(en && evt.desc_en) || evt.desc || ''}</div>
          <button className="mob-btn mob-btn--gold" style={{ width: '100%', maxWidth: 320 }} disabled={busy}
            onClick={() => act('turnEventAccept')}>{T('mobile.ctrlEventAccept')}</button>
          <button className="mob-btn mob-btn--ghost" style={{ color: '#f3e9d3' }} disabled={busy}
            onClick={() => act('turnEventDecline')}>{T('mobile.ctrlEventDecline')}</button>
        </>
      );
    case 'target':
      return (
        <>
          {header}
          <div className="mob-ctrl-hint">{T('mobile.ctrlPickTarget')}</div>
          <div className="mob-ctrl-opts" style={{ maxWidth: 'none' }}>
            {(session.teams || []).map((t, i) => i === teamIdx ? null : (
              <button key={i} className="mob-ctrl-opt" disabled={busy}
                style={{ '--opt-color': t.color || '#e0a458' }}
                onClick={() => act('turnEventTarget', { index: i })}>
                <span className="mob-ctrl-opt-icon" style={{ background: 'rgba(255,255,255,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><TeamAvatar team={t} size={26} /></span>
                <span style={{ minWidth: 0, fontWeight: 700 }}>{t.name}</span>
              </button>
            ))}
          </div>
        </>
      );
    case 'dice': {
      const rollingDie = d.diceRolling || d.diceValue == null;
      return (
        <>
          {header}
          <div className={`mob-ctrl-die${rollingDie ? ' is-rolling' : ''}`}>{rollingDie ? '🎲' : d.diceValue}</div>
          {!rollingDie && <div className="mob-ctrl-hint">{T('mobile.ctrlDiceResult', { n: d.diceValue })}</div>}
        </>
      );
    }
    case 'question': {
      const q = d.question;
      if (!q) return <>{header}<div className="mob-ctrl-hint">{T('mobile.ctrlWatchBoard')}</div></>;
      const info = subjInfo(q.subject, en);
      const isCorrect = q.revealed && !!q.result;
      return (
        <div className="mob-ctrl-qwrap">
          <div className="mob-ctrl-qhead" style={{ color: info.color }}>{info.icon} {info.name}</div>
          <div className="mob-ctrl-qtext">{(en && q.q_en) || q.q}</div>
          {q.img && (
            <div className="mob-ctrl-qmedia">
              <img src={q.img} alt="" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, filter: q.render === 'silhouette' && !q.revealed ? 'brightness(0)' : 'brightness(1)', transition: 'filter 0.6s ease' }} />
            </div>
          )}
          {q.audio && (
            <div className="mob-ctrl-qmedia" style={{ textAlign: 'center' }}>
              <audio key={q.audio} src={q.audio} controls controlsList="nodownload" style={{ width: '100%' }} />
            </div>
          )}
          <div className="mob-ctrl-qans">
            {(q.a || []).map((_, i) => {
              let cls = 'mob-ctrl-ans';
              if (q.revealed && i === q.correctIndex) cls += ' is-correct';
              else if (q.revealed && i === q.selected && i !== q.correctIndex) cls += ' is-wrong';
              else if (q.revealed) cls += ' is-dim';
              return (
                <button key={i} className={cls} disabled={q.revealed || busy}
                  onClick={() => act('turnEventAnswer', { index: i })}>
                  <span className="mob-ctrl-ans-letter">{String.fromCharCode(65 + i)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {q.a_img?.[i] && <img src={q.a_img[i]} alt="" style={{ maxHeight: 56, maxWidth: '100%', objectFit: 'contain', borderRadius: 5 }} />}
                    {((en && q.a_en?.[i]) || q.a[i]) && <span>{(en && q.a_en?.[i]) || q.a[i]}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {q.revealed && (
            <div className="mob-ctrl-verdict" style={{ color: isCorrect ? '#57c84d' : '#e8574b' }}>
              {isCorrect ? `✓ ${T('mobile.ctrlCorrect')}` : `✕ ${T('mobile.ctrlWrong')}`}
            </div>
          )}
        </div>
      );
    }
    case 'vaToutChoice': {
      const pot = d.vaToutPot || 0;
      const nextGain = ((d.vaToutStreak || 0) + 1) * 5;
      return (
        <>
          {header}
          <div className="mob-ctrl-subtitle" style={{ color: '#f3c969' }}>💰 {pot} 🪙</div>
          <button className="mob-btn mob-btn--gold" style={{ width: '100%', maxWidth: 320 }} disabled={busy}
            onClick={() => act('turnEventVaToutContinue')}>{T('mobile.ctrlVaToutContinue', { n: nextGain })}</button>
          <button className="mob-btn mob-btn--ghost" style={{ color: '#f3e9d3' }} disabled={busy}
            onClick={() => act('turnEventVaToutCashOut')}>{T('mobile.ctrlVaToutCashOut', { n: pot })}</button>
        </>
      );
    }
    case 'choice': {
      const money = team?.money ?? 0;
      if (evt.key === 'troisCoffres' && d.gifts) {
        return (
          <>
            {header}
            <div className="mob-ctrl-opts" style={{ maxWidth: 'none' }}>
              {d.gifts.map((k) => <ItemBtn key={k} itemKey={k} disabled={busy} onClick={() => act('turnEventGift', { itemKey: k })} />)}
            </div>
          </>
        );
      }
      if (evt.key === 'recharge') {
        const owned = Object.entries(team?.powers || {}).filter(([k]) => POWERS[k]);
        return <>{header}<PowerList entries={owned} busy={busy} onPick={(k) => act('turnEventRecharge', { key: k })} /></>;
      }
      if (evt.key === 'marcheNoir') {
        const owned = Object.entries(team?.powers || {}).filter(([k]) => POWERS[k]);
        return (
          <>
            {header}
            <PowerList entries={owned} busy={busy}
              price={(k) => (money >= Math.ceil(POWERS[k].price / 2) ? Math.ceil(POWERS[k].price / 2) : null)}
              onPick={(k) => act('turnEventMarcheNoir', { key: k })} />
            <button className="mob-btn mob-btn--ghost" style={{ color: '#f3e9d3' }} disabled={busy}
              onClick={() => act('turnEventDecline')}>{T('mobile.ctrlEventPass')}</button>
          </>
        );
      }
      if (evt.key === 'marchandAmbulant' && d.merchandise) {
        return (
          <>
            {header}
            <div className="mob-ctrl-opts" style={{ maxWidth: 'none' }}>
              {d.merchandise.map((k) => {
                const price = ITEMS[k] ? merchantPrice(ITEMS[k]) : 0;
                return (
                  <ItemBtn key={k} itemKey={k} priceLabel={`${price} 🪙`}
                    disabled={busy || money < price}
                    onClick={() => act('turnEventBuy', { itemKey: k })} />
                );
              })}
            </div>
            <button className="mob-btn mob-btn--ghost" style={{ color: '#f3e9d3' }} disabled={busy}
              onClick={() => act('turnEventDecline')}>{T('mobile.ctrlEventPass')}</button>
          </>
        );
      }
      if (evt.key === 'vol' && d.targetIndex != null) {
        const target = session.teams?.[d.targetIndex];
        if (!target) return <>{header}<div className="mob-ctrl-hint">{T('mobile.ctrlWatchBoard')}</div></>;
        if (!stealKey) {
          const stealable = Object.entries(target.powers || {}).filter(([k, p]) => POWERS[k] && (p?.charges || 0) > 0);
          return (
            <>
              {header}
              <div className="mob-ctrl-hint">{T('mobile.ctrlVolSteal', { name: target.name })}</div>
              <PowerList entries={stealable} busy={busy} onPick={(k) => setStealKey(k)} />
            </>
          );
        }
        const mine = Object.entries(team?.powers || {}).filter(([k]) => POWERS[k]);
        return (
          <>
            {header}
            <div className="mob-ctrl-hint">{T('mobile.ctrlVolGive', { power: locName(POWERS[stealKey]) })}</div>
            <PowerList entries={mine} busy={busy} onPick={(k) => act('turnEventVol', { stealKey, giveKey: k })} />
            <button className="mob-btn mob-btn--ghost" style={{ color: '#f3e9d3' }} onClick={() => setStealKey(null)}>{T('mobile.ctrlCancel')}</button>
          </>
        );
      }
      if (evt.key === 'bossProf') {
        return (
          <>
            {header}
            <div className="mob-ctrl-hint">{T('mobile.ctrlBossWeapon')}</div>
            <div className="mob-ctrl-opts" style={{ maxWidth: 'none' }}>
              {SUBJECT_KEYS.map((s) => {
                const info = subjInfo(s, en);
                return (
                  <button key={s} className="mob-ctrl-opt" disabled={busy} style={{ '--opt-color': info.color }}
                    onClick={() => act('turnEventBoss', { subject: s })}>
                    <span className="mob-ctrl-opt-icon">{info.icon}</span>
                    <span style={{ minWidth: 0, fontWeight: 700 }}>{info.name}</span>
                  </button>
                );
              })}
            </div>
          </>
        );
      }
      // troc, pillage… : choix positionnels — au tableau en v1.
      return <>{header}<div className="mob-ctrl-hint">{T('mobile.ctrlWatchBoard')}</div></>;
    }
    case 'result':
      return (
        <>
          {header}
          {d.message && <div className="mob-ctrl-hint" style={{ maxWidth: 360 }}>{d.message}</div>}
          <button className="mob-btn mob-btn--gold" style={{ width: '100%', maxWidth: 320 }} disabled={busy}
            onClick={() => act('turnEventClose')}>{T('mobile.ctrlContinue')}</button>
        </>
      );
    default:
      return <>{header}<div className="mob-ctrl-hint">{T('mobile.ctrlWatchBoard')}</div></>;
  }
}

// Coffre de départ : or + choix multiple (garder `keep` objets parmi `choices`).
function StarterChestPanel({ chest, busy, act, T }) {
  const [picked, setPicked] = useState([]);
  const toggle = (k) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : (p.length < chest.keep ? [...p, k] : p)));
  return (
    <div className="mob-ctrl-qwrap">
      <div className="mob-ctrl-subtitle" style={{ textAlign: 'center' }}>🎁 {T('mobile.ctrlChestTitle', { gold: chest.gold })}</div>
      <div className="mob-ctrl-hint" style={{ textAlign: 'center' }}>{T('mobile.ctrlChestPick', { n: chest.keep })}</div>
      <div className="mob-ctrl-opts" style={{ maxWidth: 'none' }}>
        {(chest.choices || []).map((k) => (
          <div key={k} style={{ position: 'relative' }}>
            <ItemBtn itemKey={k} disabled={busy} priceLabel={picked.includes(k) ? '✓' : null} onClick={() => toggle(k)} />
          </div>
        ))}
      </div>
      <button className="mob-btn mob-btn--gold" style={{ width: '100%', maxWidth: 320, alignSelf: 'center' }}
        disabled={busy || picked.length < Math.min(chest.keep, (chest.choices || []).length)}
        onClick={() => act('turnStarterChest', { keys: picked })}>
        {T('mobile.ctrlChestTake')}
      </button>
    </div>
  );
}

export default function ControllerView({ session, teamIdx, code, token, T, lastSync = 0 }) {
  const turn = session.turn;
  const en = !!session.englishMode;
  const team = session.teams?.[teamIdx];
  const [collapsed, setCollapsed] = useState(false);

  // Vibration au début de SON tour (la manette vient d'apparaître).
  useEffect(() => {
    try { navigator.vibrate?.(200); } catch { /* non supporté */ }
  }, []);

  // Liaison morte ? Le TBI publie un heartbeat toutes les ~15 s : un silence
  // prolongé pendant SON tour = bandeau « reconnexion » (l'auto-réabonnement et
  // le refetch au retour de visibilité tournent en parallèle dans MobileApp).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const stale = lastSync > 0 && now - lastSync > 40000;
  // Optimiste : bouton verrouillé après envoi, relâché quand le payload reflète
  // un changement d'état du tour (ou après un garde-fou si l'intent était no-op).
  const [busy, setBusy] = useState(false);
  const sig = JSON.stringify(turn);
  const prevSig = useRef(sig);
  useEffect(() => {
    if (sig !== prevSig.current) { prevSig.current = sig; setBusy(false); }
  }, [sig]);
  useEffect(() => {
    if (!busy) return;
    const id = setTimeout(() => setBusy(false), 4000);
    return () => clearTimeout(id);
  }, [busy]);

  const act = (type, payload = {}) => {
    if (busy) return;
    setBusy(true);
    sendIntent(code, token, type, { ...payload, uid: randomToken() }).catch(() => setBusy(false));
  };

  if (!turn) return null;

  if (collapsed) {
    return (
      <button className="mob-ctrl-banner" onClick={() => setCollapsed(false)}>
        <span>{T('mobile.ctrlTitle')}</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{T('mobile.ctrlExpand')} ▲</span>
      </button>
    );
  }

  let body;
  switch (turn.phase) {
    case 'idle':
      body = (
        <>
          <div className="mob-ctrl-hint">{T('mobile.ctrlRollHint')}</div>
          <button className="mob-ctrl-roll" disabled={busy} onClick={() => act('turnRoll')}>🎲</button>
          <div className="mob-ctrl-hint">{busy ? T('mobile.ctrlSent') : T('mobile.ctrlRoll')}</div>
          {turn.checkpoint && (
            <button className="mob-ctrl-opt" disabled={busy} style={{ '--opt-color': '#3b6cb3', maxWidth: 320, margin: '0 auto' }}
              onClick={() => act('turnCheckpoint')}>
              <span className="mob-ctrl-opt-icon">🚩</span>
              <span style={{ minWidth: 0, fontWeight: 700 }}>{T('mobile.ctrlCheckpointGo')}</span>
            </button>
          )}
          <ActionRow team={team} context="idle" busy={busy} act={act} T={T} />
        </>
      );
      break;
    case 'dice': {
      const v = turn.dice?.value;
      const rollingDie = turn.dice?.rolling || v == null;
      body = (
        <>
          <div className={`mob-ctrl-die${rollingDie ? ' is-rolling' : ''}`}>{rollingDie ? '🎲' : v}</div>
          <div className="mob-ctrl-hint">{rollingDie ? T('mobile.ctrlRolling') : T('mobile.ctrlDiceResult', { n: v })}</div>
        </>
      );
      break;
    }
    case 'junction': {
      const opts = turn.junction?.options || [];
      const remaining = turn.junction?.remaining ?? 1;
      body = (
        <>
          <div className="mob-ctrl-subtitle">{T('mobile.ctrlJunction')}</div>
          {remaining > 1 && <div className="mob-ctrl-hint">{T('mobile.ctrlStepsLeft', { n: remaining })}</div>}
          <div className="mob-ctrl-opts">
            {opts.map((o) => {
              const info = tileLabel(o, en, T);
              return (
                <button key={o.id} className="mob-ctrl-opt" disabled={busy}
                  style={{ '--opt-color': info.color }}
                  onClick={() => act('turnChooseJunction', { nodeId: o.id })}>
                  <span className="mob-ctrl-opt-icon">{info.icon}</span>
                  <span style={{ minWidth: 0, fontWeight: 700 }}>{info.name}</span>
                </button>
              );
            })}
          </div>
        </>
      );
      break;
    }
    case 'question':
      body = turn.question
        ? <QuestionPanel q={turn.question} team={team} en={en} busy={busy} act={act} T={T} />
        : <div className="mob-ctrl-hint">{T('mobile.ctrlWatchBoard')}</div>;
      break;
    case 'targetPicker':
      body = turn.targetPicker
        ? <TargetPickerPanel tp={turn.targetPicker} session={session} teamIdx={teamIdx} busy={busy} act={act} T={T} />
        : <div className="mob-ctrl-hint">{T('mobile.ctrlWatchBoard')}</div>;
      break;
    case 'subjectPicker':
      body = (
        <div className="mob-ctrl-qwrap">
          <div className="mob-ctrl-subtitle" style={{ textAlign: 'center' }}>🔄 {T('mobile.ctrlPickSubject')}</div>
          <div className="mob-ctrl-opts" style={{ maxWidth: 'none' }}>
            {SUBJECT_KEYS.map((key) => {
              const info = subjInfo(key, en);
              return (
                <button key={key} className="mob-ctrl-opt" disabled={busy}
                  style={{ '--opt-color': info.color }}
                  onClick={() => act('turnSelectSubject', { key })}>
                  <span className="mob-ctrl-opt-icon">{info.icon}</span>
                  <span style={{ minWidth: 0, fontWeight: 700 }}>{info.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
      break;
    case 'chargePicker': {
      const amount = turn.chargePicker?.amount ?? 1;
      const owned = Object.entries(team?.powers || {}).filter(([k]) => POWERS[k]);
      body = (
        <div className="mob-ctrl-qwrap">
          <div className="mob-ctrl-subtitle" style={{ textAlign: 'center' }}>⚡ {T('mobile.ctrlPickCharge', { n: amount })}</div>
          <div className="mob-ctrl-opts" style={{ maxWidth: 'none' }}>
            {owned.map(([k, p]) => (
              <button key={k} className="mob-ctrl-opt" disabled={busy}
                style={{ '--opt-color': POWERS[k].color }}
                onClick={() => act('turnChargePick', { key: k })}>
                <span className="mob-ctrl-opt-icon">{POWERS[k].icon}</span>
                <span style={{ minWidth: 0, fontWeight: 700 }}>{locName(POWERS[k])} <span style={{ opacity: 0.75 }}>×{p?.charges || 0}</span></span>
              </button>
            ))}
          </div>
          <button className="mob-btn mob-btn--ghost" style={{ color: '#f3e9d3' }} disabled={busy}
            onClick={() => act('turnChargeSkip')}>{T('mobile.ctrlSkip')}</button>
        </div>
      );
      break;
    }
    case 'tilePicker': {
      const tp = turn.tilePicker || {};
      const nodes = tp.nodes || [];
      body = (
        <div className="mob-ctrl-qwrap">
          <div className="mob-ctrl-subtitle" style={{ textAlign: 'center' }}>{tp.icon || '🪤'} {tp.label || T('mobile.ctrlTilePicker')}</div>
          <div className="mob-ctrl-hint">{T('mobile.ctrlTilePickHint')}</div>
          <div className="mob-ctrl-opts" style={{ maxWidth: 'none', maxHeight: '46vh', overflowY: 'auto' }}>
            {nodes.map((nd) => {
              const info = tileLabel(nd, en, T);
              return (
                <button key={nd.id} className="mob-ctrl-opt" disabled={busy}
                  style={{ '--opt-color': info.color }}
                  onClick={() => act('turnSelectTile', { nodeId: nd.id })}>
                  <span className="mob-ctrl-opt-icon">{info.icon}</span>
                  <span style={{ minWidth: 0, fontWeight: 700, flex: 1, textAlign: 'left' }}>
                    <span style={{ opacity: 0.55, marginRight: 4 }}>#{nd.order}</span>{info.name}{nd.trap ? ' 🪤' : ''}
                  </span>
                  {nd.occupants?.length > 0 && (
                    <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
                      {nd.occupants.map((ti) => (
                        <span key={ti} title={session.teams?.[ti]?.name}
                          style={{ width: 12, height: 12, borderRadius: 3, background: session.teams?.[ti]?.color || '#888', border: '1px solid rgba(0,0,0,0.3)' }} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button className="mob-btn mob-btn--ghost" style={{ color: '#f3e9d3' }} disabled={busy}
            onClick={() => act('turnCancelTile')}>{T('common.cancel')}</button>
        </div>
      );
      break;
    }
    case 'event':
      body = turn.event
        ? <EventPanel evt={turn.event} session={session} teamIdx={teamIdx} busy={busy} act={act} T={T} />
        : <div className="mob-ctrl-hint">{T('mobile.ctrlWatchBoard')}</div>;
      break;
    case 'duelChoice': {
      const duel = turn.duel || { defenders: [], blocked: [] };
      const subjInf = subjInfo(duel.subject, en);
      body = (
        <>
          <div style={{ fontSize: 44 }}>⚔️</div>
          <div className="mob-ctrl-subtitle">{T('mobile.ctrlDuelTitle')}</div>
          <div className="mob-ctrl-hint">{subjInf.icon} {subjInf.name}</div>
          <div className="mob-ctrl-opts">
            {[...duel.defenders, ...duel.blocked].map((i) => {
              const t = session.teams?.[i];
              if (!t) return null;
              const blocked = duel.blocked.includes(i);
              return (
                <button key={i} className="mob-ctrl-opt" disabled={busy || blocked}
                  style={{ '--opt-color': t.color || '#e0a458', opacity: blocked ? 0.45 : 1 }}
                  onClick={() => act('turnDuelChoose', { index: i })}>
                  <span className="mob-ctrl-opt-icon" style={{ background: 'rgba(255,255,255,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><TeamAvatar team={t} size={26} /></span>
                  <span style={{ minWidth: 0, fontWeight: 700 }}>
                    {t.name}
                    {blocked && <span style={{ display: 'block', fontSize: 12, opacity: 0.8 }}>{T('mobile.ctrlImmune')}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <button className="mob-btn mob-btn--ghost" style={{ color: '#f3e9d3' }} disabled={busy}
            onClick={() => act('turnDuelDecline')}>{T('mobile.ctrlDuelDecline')}</button>
        </>
      );
      break;
    }
    case 'loot': {
      const it = turn.loot?.itemKey ? ITEMS[turn.loot.itemKey] : null;
      body = (
        <>
          <div style={{ fontSize: 44 }}>🎁</div>
          {it && (
            <div className="mob-ctrl-tile" style={{ '--opt-color': '#e0a458' }}>
              {itemImg(it) ? <img src={itemImg(it)} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} /> : <span style={{ fontSize: 30 }}>{it.icon}</span>}
              <span style={{ fontWeight: 800 }}>{locName(it)}</span>
            </div>
          )}
          <button className="mob-btn mob-btn--gold" style={{ width: '100%', maxWidth: 320 }} disabled={busy}
            onClick={() => act('turnLootDismiss')}>{T('mobile.ctrlLootTake')}</button>
        </>
      );
      break;
    }
    case 'starterChest':
      body = turn.starterChest
        ? <StarterChestPanel chest={turn.starterChest} busy={busy} act={act} T={T} />
        : <div className="mob-ctrl-hint">{T('mobile.ctrlWatchBoard')}</div>;
      break;
    case 'shopPrompt':
      body = (
        <>
          <div style={{ fontSize: 44 }}>🛒</div>
          <div className="mob-ctrl-subtitle">{T('mobile.ctrlShopPrompt')}</div>
          <button className="mob-btn mob-btn--gold" style={{ width: '100%', maxWidth: 320 }} disabled={busy}
            onClick={() => act('turnShopAccept')}>{T('mobile.ctrlShopOpen')}</button>
          <button className="mob-btn mob-btn--ghost" style={{ color: '#f3e9d3' }} disabled={busy}
            onClick={() => act('turnShopDismiss')}>{T('mobile.ctrlShopLater')}</button>
        </>
      );
      break;
    case 'fight': {
      const f = turn.fight || {};
      const iWon = f.winnerIndex === teamIdx;
      body = (
        <>
          <div style={{ fontSize: 44 }}>⚔️</div>
          {f.phase === 'versus' && (
            <button className="mob-btn mob-btn--gold" style={{ width: '100%', maxWidth: 320 }} disabled={busy}
              onClick={() => act('turnFightBegin')}>{T('mobile.ctrlFightBegin')}</button>
          )}
          {f.phase === 'reward' && iWon && !f.rewardChosen && (
            <>
              <div className="mob-ctrl-subtitle">{T('mobile.ctrlFightReward')}</div>
              <div className="mob-ctrl-opts">
                {[['steal', '🪙', T('mobile.ctrlRewardSteal')], ['knockback', '⏪', T('mobile.ctrlRewardKnockback')], ['loot', '🎁', T('mobile.ctrlRewardLoot')]].map(([c, ic, label]) => (
                  <button key={c} className="mob-ctrl-opt" disabled={busy} style={{ '--opt-color': '#e0a458' }}
                    onClick={() => act('turnFightReward', { choice: c })}>
                    <span className="mob-ctrl-opt-icon">{ic}</span>
                    <span style={{ minWidth: 0, fontWeight: 700 }}>{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {f.phase === 'result' && (
            <>
              {f.resultMessage && <div className="mob-ctrl-hint" style={{ maxWidth: 360 }}>{f.resultMessage}</div>}
              <button className="mob-btn mob-btn--gold" style={{ width: '100%', maxWidth: 320 }} disabled={busy}
                onClick={() => act('turnFightClose')}>{T('mobile.ctrlContinue')}</button>
            </>
          )}
          {(f.phase === 'briefing' || f.phase === 'minigame' || (f.phase === 'reward' && (!iWon || f.rewardChosen))) && (
            <div className="mob-ctrl-subtitle">{T('mobile.ctrlWatchBoard')}</div>
          )}
        </>
      );
      break;
    }
    case 'landing': {
      const info = tileLabel(turn.landing, en, T);
      body = (
        <>
          <div className="mob-ctrl-hint">{T('mobile.ctrlLanding')}</div>
          <div className="mob-ctrl-tile" style={{ '--opt-color': info.color }}>
            <span style={{ fontSize: 34 }}>{info.icon}</span>
            <span style={{ fontWeight: 800 }}>{info.name}</span>
          </div>
          <button className="mob-btn mob-btn--gold" style={{ width: '100%', maxWidth: 320 }}
            disabled={busy} onClick={() => act('turnConfirmLanding')}>
            {busy ? T('mobile.ctrlSent') : T('mobile.ctrlContinue')}
          </button>
          <ActionRow team={team} context="landing" busy={busy} act={act} T={T} />
        </>
      );
      break;
    }
    default:
      // Phase non pilotable (combat, choix de case au plateau, animations…) ou
      // pas encore couverte : la manette s'efface, le tableau prend la main.
      body = (
        <>
          <div style={{ fontSize: 44 }}>👀</div>
          <div className="mob-ctrl-subtitle">{T('mobile.ctrlWatchBoard')}</div>
          <div className="mob-ctrl-hint">{T('mobile.ctrlFallback')}</div>
        </>
      );
  }

  return (
    <div className="mob-ctrl">
      <div className="mob-ctrl-head">
        <div className="mob-ctrl-title">{team ? `${team.emoji} ` : ''}{T('mobile.ctrlTitle')}</div>
        <button className="mob-btn mob-btn--ghost" style={{ padding: '6px 12px', fontSize: 13 }}
          onClick={() => setCollapsed(true)}>
          {T('mobile.ctrlHide')} ▼
        </button>
      </div>
      {stale && <div className="mob-ctrl-stale">⚠️ {T('mobile.ctrlReconnecting')}</div>}
      <div className="mob-ctrl-body">{body}</div>
    </div>
  );
}
