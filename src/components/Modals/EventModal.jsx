import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { locName, locDesc, loc } from '../../i18n/content';
import { SUBJECTS, SUBJECT_KEYS } from '../../data/subjects';
import { getMinigame } from '../Fight/minigames';
import { POWERS } from '../../data/powers';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { merchantPrice } from '../../store/eventHandlers';
import { canReceiveItem, cellKey } from '../../store/itemHandlers';
import { EVENTS } from '../../data/events';
import { EVENT_IMG, EVENT_IMG_LIST } from '../../data/eventAssets';
import ItemIcon from './ItemIcon';
import { soundEvent, soundClick } from '../../logic/sounds';
import ModalOverlay from './ModalOverlay';
import TeamTargetButton from './TeamTargetButton';
import '../../styles/temple-modal.css';

// Pool d'icônes pour la roulette de révélation (variété visuelle)
const EVENT_ICONS = Object.values(EVENTS).map((e) => e.icon);

// Cadre de pierre (panelStyle de ModalOverlay) — rappelle l'inventaire
const STONE_PANEL = { background: 'transparent', border: 'none', boxShadow: 'none', borderRadius: 24, overflow: 'visible' };

const DICE_FACES = [null, '\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];

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

  useEffect(() => {
    if (showEvent) soundEvent();
  }, [showEvent?.key]);

  const isOpen = !!showEvent;
  const { event, key, phase, data } = showEvent || {};
  const team = teams?.[currentTeam];

  if (isOpen && !team) return null;

  // Phase « roulette » : suspense plein cadre, sans dévoiler l'icône/le nom
  if (isOpen && phase === 'roulette') {
    return (
      <AnimatePresence>
        <ModalOverlay className="max-w-md" panelStyle={STONE_PANEL}>
          <div className="tm-stone"><div className="tm-parch">
            <RoulettePhase event={event} eventKey={key} team={team} onDone={revealEvent} />
          </div></div>
        </ModalOverlay>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalOverlay className="max-w-md" panelStyle={STONE_PANEL}>
          <div className="tm-stone"><div className="tm-parch">
          <div style={{ padding: '26px 26px 4px', textAlign: 'center' }}>
            {/* M\u00e9daillon : asset dessin\u00e9 si dispo, sinon disque de pierre + emoji */}
            {EVENT_IMG[key] ? (
              <img src={EVENT_IMG[key]} alt="" className="tm-event-badge" />
            ) : (
              <div className="tm-medallion is-event">{event?.icon}</div>
            )}
            <div className="tm-banner" style={{ marginBottom: 12 }}>
              {T('modal.event.special')}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--ink-900)' }}>{locName(event)}</h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: '10px 0 4px', color: 'var(--ink-600)' }}>
              <span className="text-lg">{team?.emoji}</span>
              <span>{team?.name}</span>
            </div>
          </div>

          <div style={{ padding: '10px 32px 24px', textAlign: 'center' }}>
            {phase === 'intro' && (
              <IntroPhase event={event} onAccept={acceptEvent} onDecline={declineEvent} />
            )}
            {phase === 'target' && (
              <TargetPhase teams={teams} currentTeam={currentTeam} eventKey={key} onSelect={eventSelectTarget} />
            )}
            {phase === 'dice' && <DicePhase data={data} />}
            {phase === 'question' && (
              <QuestionPhase data={data} onAnswer={eventAnswerQuestion} />
            )}
            {phase === 'choice' && (
              <ChoicePhase
                eventKey={key}
                team={team}
                teams={teams}
                data={data}
                onChoice={eventRechargeChoice}
                onMarcheNoirBuy={eventMarcheNoirBuy}
                onVolApply={eventVolApply}
                onMerchantBuy={eventMerchantBuy}
                onChooseGift={eventChooseGift}
                onTrade={eventTrade}
                onPillageApply={eventPillageApply}
                onStartBoss={startBossFight}
                onSkip={declineEvent}
              />
            )}
            {phase === 'vaToutChoice' && (
              <VaToutChoicePhase data={data} onContinue={eventVaToutContinue} onCashOut={eventVaToutCashOut} />
            )}
            {phase === 'result' && <ResultPhase data={data} onClose={closeEvent} />}
          </div>
          </div></div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}

// Roulette de révélation : l'icône défile vite puis ralentit (ease-out) et
// s'arrête sur l'événement tiré. Ajoute de la tension avant de dévoiler.
function RoulettePhase({ event, eventKey, team, onDone }) {
  const T = useT();
  // Roulette en images si dispo, sinon emojis. Chaque « frame » = url image ou emoji.
  const useImg = EVENT_IMG_LIST.length > 0;
  const finalFrame = (useImg && EVENT_IMG[eventKey]) || event.icon;
  const pool = useImg ? EVENT_IMG_LIST : EVENT_ICONS;
  const [icon, setIcon] = useState(pool[0]);
  const [stopped, setStopped] = useState(false);
  const isImg = (v) => typeof v === 'string' && v.includes('/');

  useEffect(() => {
    let cancelled = false;
    let i = 0;
    const TOTAL = 26;
    const tick = () => {
      if (cancelled) return;
      i++;
      if (i < TOTAL) {
        setIcon(pool[Math.floor(Math.random() * pool.length)]);
        soundClick();
        // délai croissant -> ralentissement progressif
        const delay = 45 + Math.pow(i / TOTAL, 3) * 340;
        timer = setTimeout(tick, delay);
      } else {
        setIcon(finalFrame);
        setStopped(true);
        soundEvent();
        timer = setTimeout(() => { if (!cancelled) onDone(); }, 1000);
      }
    };
    let timer = setTimeout(tick, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  return (
    <div style={{ padding: '34px 26px 30px', textAlign: 'center' }}>
      <div style={{
        display: 'inline-block', padding: '4px 14px', marginBottom: 18,
        background: 'rgba(168, 62, 127, 0.15)', color: 'var(--m-anglais-deep)',
        fontSize: 11, fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
        textTransform: 'uppercase', borderRadius: 999,
      }}>
        {team?.emoji} {team?.name} — {T('modal.event.brewing')}
      </div>

      <motion.div
        animate={stopped
          ? { scale: [1, 1.18, 1], rotate: 0 }
          : { rotate: [-4, 4, -4] }}
        transition={stopped
          ? { duration: 0.5, ease: 'easeOut' }
          : { duration: 0.18, repeat: Infinity, ease: 'linear' }}
        style={{
          width: 130, height: 130, borderRadius: 32, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 70,
          background: 'linear-gradient(180deg, #a371e0, #7c3aed)',
          boxShadow: stopped
            ? 'inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -6px 0 rgba(0,0,0,0.18), 0 8px 0 rgba(60,25,110,0.5), 0 0 30px rgba(163,113,224,0.8)'
            : 'inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -6px 0 rgba(0,0,0,0.18), 0 8px 0 rgba(60,25,110,0.5)',
        }}
      >
        {isImg(icon)
          ? <img src={icon} alt="" style={{ width: '92%', height: '92%', objectFit: 'contain', filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.45))' }} />
          : icon}
      </motion.div>

      <div style={{
        marginTop: 22, fontFamily: 'var(--font-display)', fontSize: 18,
        color: 'var(--ink-600)', letterSpacing: '0.04em',
      }}>
        {stopped ? T('modal.event.reveal') : T('modal.event.spinning')}
      </div>
    </div>
  );
}

const IntroPhase = React.memo(function IntroPhase({ event, onAccept, onDecline }) {
  const T = useT();
  return (
    <>
      <p style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--ink-700)', margin: '12px 0 22px' }}>
        {locDesc(event)}
      </p>
      <div className="flex gap-3 justify-center">
        {event.optional ? (
          <>
            <button className="btn btn--green" onClick={onAccept}>{T('modal.event.accept')}</button>
            <button className="btn btn--ghost" onClick={onDecline}>{T('modal.event.decline')}</button>
          </>
        ) : (
          <button className="btn btn--purple btn--lg" onClick={onAccept}>{T('modal.ok')}</button>
        )}
      </div>
    </>
  );
});

const TargetPhase = React.memo(function TargetPhase({ teams, currentTeam, eventKey, onSelect }) {
  const T = useT();
  const labels = {
    decharge: T('modal.event.target.decharge'),
    sacrifice: T('modal.event.target.sacrifice'),
    duel: T('modal.event.target.duel'),
    don: T('modal.event.target.don'),
    vol: T('modal.event.target.vol'),
    echange: T('modal.event.target.echange'),
    pillage: T('modal.event.target.pillage'),
  };
  return (
    <>
      <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>{labels[eventKey] || T('modal.event.chooseTarget')}</p>
      <div className="space-y-2">
        {teams.map((t, i) => {
          if (i === currentTeam) return null;
          return (
            <TeamTargetButton
              key={i}
              team={t}
              onClick={() => onSelect(i)}
              hoverColor="#a83e7f"
              hoverBg="#faf0f5"
            />
          );
        })}
      </div>
    </>
  );
});

const DicePhase = React.memo(function DicePhase({ data }) {
  const T = useT();
  const dv = data?.diceValue;
  const rolling = data?.diceRolling;
  return (
    <div className="text-center py-4">
      <div className={`text-7xl select-none ${rolling ? 'anim-float' : ''}`}>
        {dv ? DICE_FACES[dv] : '\u{1F3B2}'}
      </div>
      {!rolling && dv && (
        <p style={{ fontSize: 18, fontFamily: 'var(--font-display)', marginTop: 12 }}>
          {T('modal.event.diceResult', { n: dv })}
        </p>
      )}
    </div>
  );
});

const QuestionPhase = React.memo(function QuestionPhase({ data, onAnswer }) {
  const T = useT();
  const question = data?.eventQuestion;
  const subject = data?.eventSubject;
  const revealed = data?.questionRevealed;
  const selected = data?.questionSelected;

  if (!question) return <p>{T('modal.loading')}</p>;
  const subjectInfo = SUBJECTS[subject] || {};

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 justify-center">
        <span className="text-xl">{subjectInfo.icon}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: subjectInfo.color }}>{locName(subjectInfo)}</span>
      </div>
      <p style={{ fontWeight: 600, marginBottom: 16 }}>{question.q}</p>
      <div className="space-y-2">
        {question.a.map((answer, idx) => {
          let style = { border: '2px solid rgba(122,94,58,0.22)', background: '#fffefb' };
          if (revealed) {
            if (idx === question.c) style = { border: '2px solid #5b8c3a', background: '#d1f0b8' };
            else if (idx === selected && idx !== question.c) style = { border: '2px solid #c9472f', background: '#f7c8c8' };
            else style = { ...style, opacity: 0.4 };
          }
          return (
            <button
              key={idx}
              onClick={() => !revealed && onAnswer(idx)}
              disabled={revealed}
              style={{
                width: '100%', textAlign: 'left', padding: 12, borderRadius: 14,
                cursor: revealed ? 'not-allowed' : 'pointer',
                fontSize: 14, transition: 'all 100ms ease',
                fontFamily: 'var(--font-ui)',
                ...style,
              }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--ink-400)', marginRight: 8 }}>
                {String.fromCharCode(65 + idx)}
              </span>
              {answer}
            </button>
          );
        })}
      </div>
      {revealed && question.e && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--parch-50)', borderRadius: 12, border: '1px solid rgba(122,94,58,0.16)', fontSize: 13 }}>
          <strong>{T('modal.explanation')}</strong> {question.e}
        </div>
      )}
    </div>
  );
});

// Bouton generique de choix de pouvoir (recharge, vol)
function PowerChoiceButton({ powerKey, charges, onClick, disabled }) {
  const T = useT();
  const power = POWERS[powerKey];
  if (!power) return null;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: 12, borderRadius: 14,
        border: `2px solid ${disabled ? 'rgba(122,94,58,0.18)' : power.color + '66'}`,
        background: disabled ? 'rgba(122,94,58,0.06)' : '#fffefb',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        fontFamily: 'var(--font-ui)',
        transition: 'all 100ms ease',
      }}
    >
      <span className="text-2xl">{power.icon}</span>
      <span style={{ fontFamily: 'var(--font-display)', flex: 1, textAlign: 'left' }}>
        {locName(power)}
        {charges != null && (
          <span style={{ fontSize: 11, color: 'var(--ink-500)', marginLeft: 8 }}>
            {charges} {T.plural('modal.event.charges', charges)}
          </span>
        )}
      </span>
    </button>
  );
}

// Carte d'objet cliquable (marchand ambulant, pillage)
function ItemChoiceButton({ itemKey, priceLabel, disabled, onClick }) {
  const T = useT();
  const item = ITEMS[itemKey];
  if (!item) return null;
  const rarityColor = RARITIES[item.rarity]?.color || '#888';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: 12, borderRadius: 14,
        border: `2px solid ${disabled ? 'rgba(122,94,58,0.18)' : rarityColor + '88'}`,
        background: disabled ? 'rgba(122,94,58,0.06)' : '#fffefb',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        fontFamily: 'var(--font-ui)',
        transition: 'all 100ms ease',
        textAlign: 'left',
      }}
    >
      <ItemIcon item={item} size={38} ring />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-display)', display: 'block' }}>
          {locName(item)}
          <span style={{ fontSize: 11, color: rarityColor, marginLeft: 8 }}>
            {RARITIES[item.rarity]?.name} · {item.slot === 'consumable' ? T('modal.event.consumable') : SLOTS[item.slot]?.name}
          </span>
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>{locDesc(item)}</span>
      </span>
      {priceLabel != null && (
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, flexShrink: 0 }}>
          {priceLabel}
        </span>
      )}
    </button>
  );
}

function ChoicePhase({ eventKey, team, teams, data, onChoice, onMarcheNoirBuy, onVolApply, onMerchantBuy, onChooseGift, onTrade, onPillageApply, onStartBoss, onSkip }) {
  const T = useT();
  // Vol en 2 etapes : pouvoir vole chez la cible, puis pouvoir recharge chez soi
  const [stealKey, setStealKey] = useState(null);

  if (eventKey === 'bossProf') {
    return (
      <>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
          {T('modal.event.boss.chooseWeapon')}
        </p>
        <div className="space-y-2">
          {SUBJECT_KEYS.map((s) => (
            <button
              key={s}
              onClick={() => { soundClick(); onStartBoss(s); }}
              className="btn btn--ghost btn--lg"
              style={{ width: '100%', justifyContent: 'flex-start', gap: 10 }}
            >
              <span style={{ fontSize: 22 }}>{SUBJECTS[s]?.icon}</span>
              <span>{getMinigame(s).name}</span>
            </button>
          ))}
        </div>
      </>
    );
  }

  if (eventKey === 'recharge') {
    const owned = Object.entries(team.powers || {}).filter(([k]) => POWERS[k]);
    return (
      <>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
          {T('modal.event.recharge.which')}
        </p>
        <div className="space-y-2">
          {owned.map(([key, entry]) => (
            <PowerChoiceButton
              key={key}
              powerKey={key}
              charges={entry?.charges ?? 0}
              onClick={() => { soundClick(); onChoice(key); }}
            />
          ))}
        </div>
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
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
            {T('modal.event.vol.whichSteal', { team: `${target.emoji} ${target.name}` })}
          </p>
          <div className="space-y-2">
            {stealable.map(([key, entry]) => (
              <PowerChoiceButton
                key={key}
                powerKey={key}
                charges={entry.charges}
                onClick={() => { soundClick(); setStealKey(key); }}
              />
            ))}
          </div>
        </>
      );
    }

    const mine = Object.entries(team.powers || {}).filter(([k]) => POWERS[k]);
    return (
      <>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
          {T('modal.event.vol.whichRecharge', { power: locName(POWERS[stealKey]) })}
        </p>
        <div className="space-y-2">
          {mine.map(([key, entry]) => (
            <PowerChoiceButton
              key={key}
              powerKey={key}
              charges={entry?.charges ?? 0}
              onClick={() => { soundClick(); onVolApply(stealKey, key); }}
            />
          ))}
        </div>
        <button
          onClick={() => setStealKey(null)}
          style={{
            marginTop: 12, width: '100%',
            fontSize: 13, color: 'var(--ink-500)',
            cursor: 'pointer', background: 'none', border: 'none',
            fontFamily: 'var(--font-ui)', padding: 6,
          }}
        >
          {T('modal.event.vol.changeTarget')}
        </button>
      </>
    );
  }

  if (eventKey === 'marcheNoir') {
    const owned = Object.entries(team.powers || {}).filter(([k]) => POWERS[k]);
    const money = team.money ?? 0;
    return (
      <>
        <p style={{ fontSize: 19, fontWeight: 700, marginBottom: 4, textAlign: 'center', color: 'var(--ink-800)' }}>
          {T('modal.event.marcheNoir.title', { n: money })}<span className="coin" />
        </p>
        <div className="space-y-2" style={{ marginTop: 12 }}>
          {owned.map(([key, entry]) => {
            const power = POWERS[key];
            const price = Math.ceil(power.price / 2);
            const canBuy = money >= price;
            return (
              <button
                key={key}
                onClick={() => { if (canBuy) { soundClick(); onMarcheNoirBuy(key); } }}
                disabled={!canBuy}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: 12, borderRadius: 14,
                  border: `2px solid ${canBuy ? power.color + '66' : 'rgba(122,94,58,0.18)'}`,
                  background: canBuy ? '#fffefb' : 'rgba(122,94,58,0.06)',
                  cursor: canBuy ? 'pointer' : 'not-allowed',
                  opacity: canBuy ? 1 : 0.55,
                  fontFamily: 'var(--font-ui)',
                  transition: 'all 100ms ease',
                }}
              >
                <span className="text-2xl">{power.icon}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-900)', flex: 1, textAlign: 'left' }}>
                  {locName(power)}
                  <span style={{ fontSize: 13, color: 'var(--ink-600)', marginLeft: 8 }}>
                    {entry?.charges ?? 0} {T.plural('modal.event.charges', entry?.charges ?? 0)}
                  </span>
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-900)' }}>
                  <s style={{ color: 'var(--ink-400)', marginRight: 6 }}>{power.price}</s>
                  {price} <span className="coin" />
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onSkip}
          style={{
            marginTop: 14, width: '100%',
            fontSize: 14, color: 'var(--ink-500)',
            cursor: 'pointer', background: 'none', border: 'none',
            fontFamily: 'var(--font-ui)', padding: 8,
          }}
        >
          {T('modal.event.passMyWay')}
        </button>
      </>
    );
  }

  if (eventKey === 'marchandAmbulant') {
    const merchandise = data?.merchandise || [];
    const money = team.money ?? 0;
    return (
      <>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, textAlign: 'center' }}>
          {T('modal.event.merchant.title', { n: money })}<span className="coin" />
        </p>
        <div className="space-y-2" style={{ marginTop: 12 }}>
          {merchandise.map((key) => {
            const item = ITEMS[key];
            if (!item) return null;
            const price = merchantPrice(item);
            // Pas de place (slot occupé ET sac plein) : l'achat serait converti
            // en revente à perte — on désactive
            const noRoom = !canReceiveItem(team, key);
            const canBuy = money >= price && !noRoom;
            return (
              <ItemChoiceButton
                key={key}
                itemKey={key}
                disabled={!canBuy}
                onClick={() => { if (canBuy) { soundClick(); onMerchantBuy(key); } }}
                priceLabel={(
                  <>
                    {noRoom && (
                      <span style={{ color: '#c9472f', fontStyle: 'italic', marginRight: 8, fontSize: 12 }}>
                        {T('modal.event.bagFull')}
                      </span>
                    )}
                    <s style={{ color: 'var(--ink-400)', marginRight: 6 }}>{item.price}</s>
                    {price} <span className="coin" />
                  </>
                )}
              />
            );
          })}
        </div>
        <button
          onClick={onSkip}
          style={{
            marginTop: 14, width: '100%',
            fontSize: 14, color: 'var(--ink-500)',
            cursor: 'pointer', background: 'none', border: 'none',
            fontFamily: 'var(--font-ui)', padding: 8,
          }}
        >
          {T('modal.event.passMyWay')}
        </button>
      </>
    );
  }

  if (eventKey === 'troisCoffres') {
    const gifts = data?.gifts || [];
    return (
      <>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
          {T('modal.event.chests.title')}
        </p>
        <div className="space-y-2">
          {gifts.map((key) => (
            <ItemChoiceButton
              key={key}
              itemKey={key}
              onClick={() => { soundClick(); onChooseGift(key); }}
            />
          ))}
        </div>
      </>
    );
  }

  if (eventKey === 'troc') {
    const equipmentEntries = Object.entries(team.equipment || {}).filter(([, k]) => k && ITEMS[k]);
    const bagEntries = (team.bag || []).map((c, i) => [i, cellKey(c)]).filter(([, k]) => k && ITEMS[k]);
    return (
      <>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
          {T('modal.event.trade.which')}
        </p>
        <div className="space-y-2">
          {equipmentEntries.map(([slot, key]) => (
            <ItemChoiceButton key={`eq-${slot}`} itemKey={key}
              onClick={() => { soundClick(); onTrade({ kind: 'equipment', slot }); }} />
          ))}
          {bagEntries.map(([index, key]) => (
            <ItemChoiceButton key={`bag-${index}`} itemKey={key}
              onClick={() => { soundClick(); onTrade({ kind: 'bag', index }); }} />
          ))}
        </div>
        <button
          onClick={onSkip}
          style={{ marginTop: 14, width: '100%', fontSize: 14, color: 'var(--ink-500)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'var(--font-ui)', padding: 8 }}
        >
          {T('modal.event.trade.cancel')}
        </button>
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
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
          {T('modal.event.pillage.which', { team: `${target.emoji} ${target.name}` })}
        </p>
        <div className="space-y-2">
          {equipmentEntries.map(([slot, key]) => (
            <ItemChoiceButton
              key={`eq-${slot}`}
              itemKey={key}
              onClick={() => { soundClick(); onPillageApply({ kind: 'equipment', slot }); }}
            />
          ))}
          {bagEntries.map(([index, key]) => (
            <ItemChoiceButton
              key={`bag-${index}`}
              itemKey={key}
              onClick={() => { soundClick(); onPillageApply({ kind: 'bag', index }); }}
            />
          ))}
        </div>
      </>
    );
  }

  return null;
}

// Va-tout : après une bonne réponse, choisir de continuer (mise croissante) ou
// d'encaisser la mise accumulée.
function VaToutChoicePhase({ data, onContinue, onCashOut }) {
  const T = useT();
  const pot = data?.vaToutPot || 0;
  const streak = data?.vaToutStreak || 0;
  const lastGain = data?.lastGain || 0;
  const nextGain = (streak + 1) * 5; // prochaine bonne réponse
  return (
    <>
      <p style={{ fontSize: 16, marginBottom: 6 }}>
        {T('modal.event.vatout.goodAnswer')}<strong>+{lastGain}</strong> {'\u{1FA99}'}
      </p>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: '#b8862c', margin: '4px 0 10px' }}>
        {T('modal.event.vatout.pot', { n: pot })}{'\u{1FA99}'}
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 18 }}>
        {T('modal.event.vatout.warn', { n: nextGain })}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn--green btn--lg" onClick={onContinue}>{T('modal.event.vatout.continue', { n: nextGain })}</button>
        <button className="btn btn--purple btn--lg" onClick={onCashOut}>{T('modal.event.vatout.cashOut', { n: pot })}</button>
      </div>
    </>
  );
}

function ResultPhase({ data, onClose }) {
  const T = useT();
  // Le loot conservé (coffre) passe désormais par la révélation « visuel C »
  // (LootReveal) ; ici on n'affiche que le message textuel des autres effets.
  return (
    <>
      <p style={{ fontSize: 18, fontFamily: 'var(--font-display)', marginBottom: 22 }}>{data?.message}</p>
      <button className="btn btn--purple btn--lg" onClick={onClose}>{T('modal.ok')}</button>
    </>
  );
}
