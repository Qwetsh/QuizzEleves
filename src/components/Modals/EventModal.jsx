import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { locName, locDesc } from '../../i18n/content';
import { SUBJECTS, SUBJECT_KEYS } from '../../data/subjects';
import { getMinigame } from '../Fight/minigames';
import { POWERS } from '../../data/powers';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { merchantPrice } from '../../store/eventHandlers';
import { canReceiveItem, cellKey } from '../../store/itemHandlers';
import { EVENTS } from '../../data/events';
import { EVENT_IMG } from '../../data/eventAssets';
import ItemIcon from './ItemIcon';
import TeamAvatar from '../TeamAvatar';
import { soundClick, soundHyperspace } from '../../logic/sounds';
import '../../styles/event-modal.css';

const DICE_FACES = [null, '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const isImgSrc = (v) => typeof v === 'string' && v.includes('/');

// Bouton « case colorée » (asset peint). tone : green (accepter/bon) · yellow
// (neutre/spécial) · red (refuser/risqué). L'icône +/★/☠ est peinte dans l'asset.
function EvBtn({ tone = 'green', label, sub, onClick, disabled }) {
  return (
    <button className={`evm-btn evm-btn--${tone}`} onClick={onClick} disabled={disabled}>
      <span className="evm-btn-label">
        {label}
        {sub != null && <span className="evm-btn-sub">{sub}</span>}
      </span>
    </button>
  );
}

// Cadre HUD réutilisable : visuel à gauche, boutons au-dessus, contenu à droite.
function EventFrame({ leftSrc, leftEmoji, actions, children }) {
  const T = useT();
  return (
    <div className="evm-overlay">
      <motion.div
        className="evm-frame"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <div className="evm-header">{T('modal.event.tag')}</div>
        <div className="evm-left">
          {isImgSrc(leftSrc)
            ? <img src={leftSrc} alt="" />
            : <div className="evm-left-emoji">{leftEmoji}</div>}
        </div>
        {actions && actions.length > 0 && (
          <div className="evm-btns">
            {actions.map((a, i) => <EvBtn key={i} {...a} />)}
          </div>
        )}
        <div className="evm-panel">{children}</div>
      </motion.div>
    </div>
  );
}

export default function EventModal() {
  const T = useT();
  const showEvent = useGameStore((s) => s.showEvent);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const acceptEvent = useGameStore((s) => s.acceptEvent);
  const declineEvent = useGameStore((s) => s.declineEvent);
  const closeEvent = useGameStore((s) => s.closeEvent);
  const eventSelectTarget = useGameStore((s) => s.eventSelectTarget);
  const eventAnswerQuestion = useGameStore((s) => s.eventAnswerQuestion);
  const eventVaToutContinue = useGameStore((s) => s.eventVaToutContinue);
  const eventVaToutCashOut = useGameStore((s) => s.eventVaToutCashOut);
  const startBossFight = useGameStore((s) => s.startBossFight);
  const eventRechargeChoice = useGameStore((s) => s.eventRechargeChoice);
  const eventMarcheNoirBuy = useGameStore((s) => s.eventMarcheNoirBuy);
  const eventVolApply = useGameStore((s) => s.eventVolApply);
  const eventMerchantBuy = useGameStore((s) => s.eventMerchantBuy);
  const eventChooseGift = useGameStore((s) => s.eventChooseGift);
  const eventTrade = useGameStore((s) => s.eventTrade);
  const eventPillageApply = useGameStore((s) => s.eventPillageApply);
  const revealEvent = useGameStore((s) => s.revealEvent);

  const isOpen = !!showEvent;
  const { event, key, phase, data } = showEvent || {};
  const team = teams?.[currentTeam];
  if (isOpen && !team) return null;

  const leftSrc = EVENT_IMG[key];
  const leftEmoji = event?.icon;

  // Révélation : saut hyperspatial (cinématique plein écran) → puis l'événement.
  if (isOpen && phase === 'roulette') {
    return (
      <AnimatePresence>
        <HyperspacePhase onDone={revealEvent} />
      </AnimatePresence>
    );
  }

  // --- Contenu + boutons selon la phase ---
  let panelBody = null;
  let actions = [];

  if (phase === 'intro') {
    panelBody = <><div className="evm-title">{locName(event)}</div><p className="evm-desc">{locDesc(event)}</p></>;
    actions = event?.optional
      ? [
          { tone: 'green', label: T('modal.event.accept'), onClick: acceptEvent },
          { tone: 'red', label: T('modal.event.decline'), onClick: declineEvent },
        ]
      : [{ tone: 'green', label: T('modal.ok'), onClick: acceptEvent }];
  } else if (phase === 'dice') {
    panelBody = <DiceBody data={data} />;
  } else if (phase === 'question') {
    panelBody = <QuestionBody data={data} onAnswer={eventAnswerQuestion} />;
  } else if (phase === 'target') {
    panelBody = <TargetBody teams={teams} currentTeam={currentTeam} eventKey={key} onSelect={eventSelectTarget} />;
  } else if (phase === 'choice') {
    panelBody = (
      <ChoiceBody
        eventKey={key} team={team} teams={teams} data={data}
        onChoice={eventRechargeChoice} onMarcheNoirBuy={eventMarcheNoirBuy} onVolApply={eventVolApply}
        onMerchantBuy={eventMerchantBuy} onChooseGift={eventChooseGift} onTrade={eventTrade}
        onPillageApply={eventPillageApply} onStartBoss={startBossFight} onSkip={declineEvent}
      />
    );
  } else if (phase === 'vaToutChoice') {
    panelBody = <VaToutBody data={data} />;
    const step = EVENTS.vaTout?.params?.step ?? 5;
    const nextGain = ((data?.vaToutStreak || 0) + 1) * step;
    actions = [
      { tone: 'green', label: T('modal.event.vatout.continue', { n: nextGain }), onClick: eventVaToutContinue },
      { tone: 'yellow', label: T('modal.event.vatout.cashOut', { n: data?.vaToutPot || 0 }), onClick: eventVaToutCashOut },
    ];
  } else if (phase === 'result') {
    panelBody = <p className="evm-msg">{data?.message}</p>;
    actions = [{ tone: 'green', label: T('modal.ok'), onClick: closeEvent }];
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <EventFrame leftSrc={leftSrc} leftEmoji={leftEmoji} actions={actions}>
          {panelBody}
        </EventFrame>
      )}
    </AnimatePresence>
  );
}

// Révélation d'événement : SAUT HYPERSPATIAL plein écran (starfield qui file en
// vitesse-lumière + son) durant ~2,2 s, flash de sortie, puis onDone → l'événement.
const HYPER_MS = 2200;
function HyperspacePhase({ onDone }) {
  const T = useT();
  const canvasRef = useRef(null);

  useEffect(() => {
    soundHyperspace(HYPER_MS / 1000);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W, H, cx, cy;
    const resize = () => {
      W = canvas.width = Math.floor(window.innerWidth * dpr);
      H = canvas.height = Math.floor(window.innerHeight * dpr);
      cx = W / 2; cy = H / 2;
    };
    resize();
    const N = 420;
    const rnd = () => ({ x: (Math.random() - 0.5) * W, y: (Math.random() - 0.5) * H, z: Math.random() * W });
    const stars = Array.from({ length: N }, rnd);
    let raf, start = null, done = false;

    const frame = (ts) => {
      if (start == null) start = ts;
      const t = ts - start;
      const prog = Math.min(t / HYPER_MS, 1);
      const speed = (6 + prog * prog * 90) * dpr; // accélération vers la lumière

      // Traînée (motion blur) : on assombrit progressivement au lieu d'effacer.
      ctx.fillStyle = 'rgba(3,6,16,0.30)';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(cx, cy);
      for (const s of stars) {
        const pz = s.z;
        s.z -= speed;
        if (s.z < 1) { Object.assign(s, rnd(), { z: W }); continue; }
        const k = 140 / s.z, pk = 140 / pz;
        const a = Math.min(1, (W - s.z) / W + 0.15);
        const g = 200 + ((Math.random() * 55) | 0);
        ctx.strokeStyle = `rgba(${150 + ((Math.random() * 80) | 0)},${g},255,${a})`;
        ctx.lineWidth = Math.max(dpr, (1 - s.z / W) * 3 * dpr);
        ctx.beginPath();
        ctx.moveTo(s.x * pk, s.y * pk);
        ctx.lineTo(s.x * k, s.y * k);
        ctx.stroke();
      }
      ctx.restore();

      // Flash de sortie d'hyperespace sur la fin.
      if (prog > 0.84) {
        ctx.fillStyle = `rgba(230,246,255,${(prog - 0.84) / 0.16 * 0.95})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (t < HYPER_MS) raf = requestAnimationFrame(frame);
      else if (!done) { done = true; onDone(); }
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <motion.div className="evm-hyper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <canvas ref={canvasRef} className="evm-hyper-canvas" />
      <div className="evm-hyper-label">{T('modal.event.hyperspace')}</div>
    </motion.div>
  );
}

function DiceBody({ data }) {
  const T = useT();
  const dv = data?.diceValue;
  const rolling = data?.diceRolling;
  return (
    <div style={{ textAlign: 'center', width: '100%' }}>
      <div className={`evm-dice ${rolling ? 'anim-float' : ''}`}>{dv ? DICE_FACES[dv] : '\u{1F3B2}'}</div>
      {!rolling && dv && <p className="evm-msg" style={{ marginTop: 8 }}>{T('modal.event.diceResult', { n: dv })}</p>}
    </div>
  );
}

function QuestionBody({ data, onAnswer }) {
  const T = useT();
  const question = data?.eventQuestion;
  const subject = data?.eventSubject;
  const revealed = data?.questionRevealed;
  const selected = data?.questionSelected;
  if (!question) return <p className="evm-hint">{T('modal.loading')}</p>;
  const subjectInfo = SUBJECTS[subject] || {};
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 18 }}>{subjectInfo.icon}</span>
        <span className="evm-title" style={{ fontSize: 15, color: subjectInfo.color }}>{locName(subjectInfo)}</span>
      </div>
      <p className="evm-desc" style={{ fontWeight: 600, color: '#eaf6ff' }}>{question.q}</p>
      {question.a.map((answer, idx) => {
        let cls = 'evm-opt';
        if (revealed) {
          if (idx === question.c) cls += ' is-correct';
          else if (idx === selected) cls += ' is-wrong';
        }
        return (
          <button key={idx} className={cls} disabled={revealed} onClick={() => !revealed && onAnswer(idx)}
            style={revealed && idx !== question.c && idx !== selected ? { opacity: 0.4 } : undefined}>
            <span className="evm-optkey">{String.fromCharCode(65 + idx)}</span>
            <span style={{ flex: 1 }}>{answer}</span>
          </button>
        );
      })}
      {revealed && question.e && (
        <div style={{ fontSize: 12.5, color: '#a9d6e6', borderTop: '1px solid rgba(120,190,220,0.25)', paddingTop: 6 }}>
          <strong>{T('modal.explanation')}</strong> {question.e}
        </div>
      )}
    </>
  );
}

function TargetBody({ teams, currentTeam, eventKey, onSelect }) {
  const T = useT();
  const labels = {
    decharge: T('modal.event.target.decharge'), sacrifice: T('modal.event.target.sacrifice'),
    duel: T('modal.event.target.duel'), don: T('modal.event.target.don'),
    vol: T('modal.event.target.vol'), echange: T('modal.event.target.echange'),
    pillage: T('modal.event.target.pillage'),
  };
  return (
    <>
      <div className="evm-title" style={{ fontSize: 15 }}>{labels[eventKey] || T('modal.event.chooseTarget')}</div>
      {teams.map((t, i) => (i === currentTeam ? null : (
        <button key={i} className="evm-opt" onClick={() => { soundClick(); onSelect(i); }}>
          <TeamAvatar team={t} size={44} />
          <span style={{ flex: 1 }}>{t.name}</span>
        </button>
      )))}
    </>
  );
}

function VaToutBody({ data }) {
  const T = useT();
  const pot = data?.vaToutPot || 0;
  const lastGain = data?.lastGain || 0;
  const step = EVENTS.vaTout?.params?.step ?? 5;
  const nextGain = ((data?.vaToutStreak || 0) + 1) * step;
  return (
    <>
      <p className="evm-desc">{T('modal.event.vatout.goodAnswer')}<strong style={{ color: '#eaf6ff' }}>+{lastGain}</strong> {'\u{1FA99}'}</p>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: '#ffcf5a' }}>{T('modal.event.vatout.pot', { n: pot })}{'\u{1FA99}'}</div>
      <p className="evm-hint">{T('modal.event.vatout.warn', { n: nextGain })}</p>
    </>
  );
}

// Boutons de choix (pouvoir / objet) en thème sombre.
function PowerOpt({ powerKey, charges, priceLabel, disabled, onClick }) {
  const T = useT();
  const power = POWERS[powerKey];
  if (!power) return null;
  return (
    <button className="evm-opt" onClick={onClick} disabled={disabled}>
      <span style={{ fontSize: 20 }}>{power.icon}</span>
      <span style={{ flex: 1 }}>
        {locName(power)}
        {charges != null && <em style={{ opacity: 0.7, fontSize: 11, marginLeft: 6, fontStyle: 'normal' }}>{charges} {T.plural('modal.event.charges', charges)}</em>}
      </span>
      {priceLabel != null && <span style={{ flexShrink: 0 }}>{priceLabel}</span>}
    </button>
  );
}

function ItemOpt({ itemKey, priceLabel, disabled, onClick }) {
  const T = useT();
  const item = ITEMS[itemKey];
  if (!item) return null;
  const rc = RARITIES[item.rarity]?.color || '#8fd0e6';
  return (
    <button className="evm-opt" onClick={onClick} disabled={disabled}>
      <ItemIcon item={item} size={34} ring />
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ color: '#eaf6ff' }}>{locName(item)}</b>
        <span style={{ display: 'block', fontSize: 11, color: rc }}>
          {RARITIES[item.rarity]?.name} · {item.slot === 'consumable' ? T('modal.event.consumable') : SLOTS[item.slot]?.name}
        </span>
      </span>
      {priceLabel != null && <span style={{ flexShrink: 0, fontFamily: 'var(--font-display)' }}>{priceLabel}</span>}
    </button>
  );
}

function ChoiceBody({ eventKey, team, teams, data, onChoice, onMarcheNoirBuy, onVolApply, onMerchantBuy, onChooseGift, onTrade, onPillageApply, onStartBoss, onSkip }) {
  const T = useT();
  const [stealKey, setStealKey] = useState(null);

  if (eventKey === 'bossProf') {
    return (
      <>
        <div className="evm-title" style={{ fontSize: 15 }}>{T('modal.event.boss.chooseWeapon')}</div>
        {SUBJECT_KEYS.map((s) => (
          <button key={s} className="evm-opt" onClick={() => { soundClick(); onStartBoss(s); }}>
            <span style={{ fontSize: 20 }}>{SUBJECTS[s]?.icon}</span>
            <span style={{ flex: 1 }}>{getMinigame(s).name}</span>
          </button>
        ))}
      </>
    );
  }

  if (eventKey === 'recharge') {
    const owned = Object.entries(team.powers || {}).filter(([k]) => POWERS[k]);
    return (
      <>
        <div className="evm-title" style={{ fontSize: 15 }}>{T('modal.event.recharge.which')}</div>
        {owned.map(([k, entry]) => (
          <PowerOpt key={k} powerKey={k} charges={entry?.charges ?? 0} onClick={() => { soundClick(); onChoice(k); }} />
        ))}
      </>
    );
  }

  if (eventKey === 'vol') {
    const target = teams?.[data?.targetIndex];
    if (!target) return null;
    if (!stealKey) {
      const stealable = Object.entries(target.powers || {}).filter(([k, p]) => POWERS[k] && p?.charges > 0);
      return (
        <>
          <div className="evm-title" style={{ fontSize: 15 }}>{T('modal.event.vol.whichSteal', { team: `${target.emoji} ${target.name}` })}</div>
          {stealable.map(([k, entry]) => (
            <PowerOpt key={k} powerKey={k} charges={entry.charges} onClick={() => { soundClick(); setStealKey(k); }} />
          ))}
        </>
      );
    }
    const mine = Object.entries(team.powers || {}).filter(([k]) => POWERS[k]);
    return (
      <>
        <div className="evm-title" style={{ fontSize: 15 }}>{T('modal.event.vol.whichRecharge', { power: locName(POWERS[stealKey]) })}</div>
        {mine.map(([k, entry]) => (
          <PowerOpt key={k} powerKey={k} charges={entry?.charges ?? 0} onClick={() => { soundClick(); onVolApply(stealKey, k); }} />
        ))}
        <button className="evm-linkbtn" onClick={() => setStealKey(null)}>{T('modal.event.vol.changeTarget')}</button>
      </>
    );
  }

  if (eventKey === 'marcheNoir') {
    const owned = Object.entries(team.powers || {}).filter(([k]) => POWERS[k]);
    const money = team.money ?? 0;
    return (
      <>
        <div className="evm-title" style={{ fontSize: 15 }}>{T('modal.event.marcheNoir.title', { n: money })}<span className="coin" /></div>
        {owned.map(([k, entry]) => {
          const power = POWERS[k];
          const price = Math.ceil(power.price / 2);
          const canBuy = money >= price;
          return (
            <PowerOpt key={k} powerKey={k} charges={entry?.charges ?? 0} disabled={!canBuy}
              onClick={() => { if (canBuy) { soundClick(); onMarcheNoirBuy(k); } }}
              priceLabel={<span><s style={{ opacity: 0.5, marginRight: 5 }}>{power.price}</s>{price} <span className="coin" /></span>} />
          );
        })}
        <button className="evm-linkbtn" onClick={onSkip}>{T('modal.event.passMyWay')}</button>
      </>
    );
  }

  if (eventKey === 'marchandAmbulant') {
    const merchandise = data?.merchandise || [];
    const money = team.money ?? 0;
    return (
      <>
        <div className="evm-title" style={{ fontSize: 15 }}>{T('modal.event.merchant.title', { n: money })}<span className="coin" /></div>
        {merchandise.map((k) => {
          const item = ITEMS[k];
          if (!item) return null;
          const price = merchantPrice(item);
          const noRoom = !canReceiveItem(team, k);
          const canBuy = money >= price && !noRoom;
          return (
            <ItemOpt key={k} itemKey={k} disabled={!canBuy}
              onClick={() => { if (canBuy) { soundClick(); onMerchantBuy(k); } }}
              priceLabel={<span>{noRoom && <em style={{ color: '#e05a44', marginRight: 6, fontSize: 11 }}>{T('modal.event.bagFull')}</em>}<s style={{ opacity: 0.5, marginRight: 5 }}>{item.price}</s>{price} <span className="coin" /></span>} />
          );
        })}
        <button className="evm-linkbtn" onClick={onSkip}>{T('modal.event.passMyWay')}</button>
      </>
    );
  }

  if (eventKey === 'troisCoffres') {
    const gifts = data?.gifts || [];
    return (
      <>
        <div className="evm-title" style={{ fontSize: 15 }}>{T('modal.event.chests.title')}</div>
        {gifts.map((k) => <ItemOpt key={k} itemKey={k} onClick={() => { soundClick(); onChooseGift(k); }} />)}
      </>
    );
  }

  if (eventKey === 'troc') {
    const equipmentEntries = Object.entries(team.equipment || {}).filter(([, k]) => k && ITEMS[k]);
    const bagEntries = (team.bag || []).map((c, i) => [i, cellKey(c)]).filter(([, k]) => k && ITEMS[k]);
    return (
      <>
        <div className="evm-title" style={{ fontSize: 15 }}>{T('modal.event.trade.which')}</div>
        {equipmentEntries.map(([slot, k]) => <ItemOpt key={`eq-${slot}`} itemKey={k} onClick={() => { soundClick(); onTrade({ kind: 'equipment', slot }); }} />)}
        {bagEntries.map(([index, k]) => <ItemOpt key={`bag-${index}`} itemKey={k} onClick={() => { soundClick(); onTrade({ kind: 'bag', index }); }} />)}
        <button className="evm-linkbtn" onClick={onSkip}>{T('modal.event.trade.cancel')}</button>
      </>
    );
  }

  if (eventKey === 'pillage') {
    const target = teams?.[data?.targetIndex];
    if (!target) return null;
    const equipmentEntries = Object.entries(target.equipment || {}).filter(([, k]) => k);
    const bagEntries = (target.bag || []).map((c, i) => [i, cellKey(c)]).filter(([, k]) => k && ITEMS[k]);
    return (
      <>
        <div className="evm-title" style={{ fontSize: 15 }}>{T('modal.event.pillage.which', { team: `${target.emoji} ${target.name}` })}</div>
        {equipmentEntries.map(([slot, k]) => <ItemOpt key={`eq-${slot}`} itemKey={k} onClick={() => { soundClick(); onPillageApply({ kind: 'equipment', slot }); }} />)}
        {bagEntries.map(([index, k]) => <ItemOpt key={`bag-${index}`} itemKey={k} onClick={() => { soundClick(); onPillageApply({ kind: 'bag', index }); }} />)}
      </>
    );
  }

  return null;
}
