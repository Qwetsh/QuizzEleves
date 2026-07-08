import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';
import { locName } from '../../i18n/content';
import { FIGHT_ROUNDS_TO_WIN } from '../../store/fightHandlers';
import { getMinigame, getDefaultMinigame } from './minigames';
import FightBriefing from './FightBriefing';
import DuelRaceView from '../Online/DuelRaceView';
import { useT } from '../../i18n';

// Le simulateur dev peut forcer le duel generique via fight.forceDefault
function resolveMinigame(fight) {
  return fight.forceDefault ? getDefaultMinigame() : getMinigame(fight.subject);
}
import { soundEvent } from '../../logic/sounds';

const DICE_FACES = [null, '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export default function FightModal() {
  const showFight = useGameStore((s) => s.showFight);
  const teams = useGameStore((s) => s.teams);

  useEffect(() => {
    if (showFight) soundEvent();
  }, [!!showFight]);

  if (!showFight) return null;
  const attacker = teams[showFight.attackerIndex];
  // Boss : le défenseur n'est pas une équipe du plateau (defenderIndex = -1) →
  // adversaire virtuel porté par showFight.boss.
  const defender = teams[showFight.defenderIndex] ?? showFight.boss;
  if (!attacker || !defender) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="fight-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'radial-gradient(ellipse at 50% 40%, #3a2a14 0%, #1a1009 70%)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {showFight.phase === 'versus' && (
          <VersusScreen fight={showFight} attacker={attacker} defender={defender} />
        )}
        {showFight.phase === 'briefing' && (
          <FightBriefing fight={showFight} attacker={attacker} defender={defender} />
        )}
        {showFight.phase === 'minigame' && showFight.race && (
          <HostDuelRace fight={showFight} teams={teams} />
        )}
        {showFight.phase === 'minigame' && !showFight.race && (
          <MinigameStage fight={showFight} attacker={attacker} defender={defender} />
        )}
        {(showFight.phase === 'reward' || showFight.phase === 'result') && (
          <RewardScreen fight={showFight} attacker={attacker} defender={defender} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// --- Écran de présentation façon versus fighting ---

function VersusScreen({ fight, attacker, defender }) {
  const T = useT();
  const fightBegin = useGameStore((s) => s.fightBegin);
  const subjectInfo = SUBJECTS[fight.subject] || {};
  const minigame = resolveMinigame(fight);

  // Avance automatiquement apres la presentation
  useEffect(() => {
    const t = setTimeout(fightBegin, 4200);
    return () => clearTimeout(t);
  }, [fightBegin]);

  const panel = (team, side) => (
    <motion.div
      initial={{ x: side === 'left' ? '-100%' : '100%' }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 120, delay: 0.15 }}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12,
        background: side === 'left'
          ? `linear-gradient(105deg, ${team.color} 0%, ${team.color}cc 70%, transparent 100%)`
          : `linear-gradient(255deg, ${team.color} 0%, ${team.color}cc 70%, transparent 100%)`,
        clipPath: side === 'left'
          ? 'polygon(0 0, 100% 0, 86% 100%, 0 100%)'
          : 'polygon(14% 0, 100% 0, 100% 100%, 0 100%)',
      }}
    >
      <motion.div
        initial={{ scale: 0, rotate: side === 'left' ? -30 : 30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 12, stiffness: 160, delay: 0.5 }}
        style={{ fontSize: 110, filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.45))' }}
      >
        {team.emoji}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        style={{
          fontFamily: 'var(--font-display)', fontSize: 38, color: '#fff',
          textShadow: '0 3px 0 rgba(0,0,0,0.4), 0 6px 18px rgba(0,0,0,0.5)',
          textAlign: 'center', padding: '0 20px',
        }}
      >
        {team.name}
      </motion.div>
    </motion.div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }} onPointerDown={fightBegin}>
      <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
        {panel(attacker, 'left')}
        {panel(defender, 'right')}

        {/* VS qui claque au centre */}
        <motion.div
          initial={{ scale: 5, opacity: 0, rotate: -18 }}
          animate={{ scale: 1, opacity: 1, rotate: -8 }}
          transition={{ type: 'spring', damping: 11, stiffness: 220, delay: 0.95 }}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 150, height: 150, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(180deg, #f3c969, #b8862c)',
            border: '5px solid #fff3d4',
            boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.5), inset 0 -6px 0 rgba(0,0,0,0.25), 0 0 50px rgba(243,201,105,0.8), 0 12px 30px rgba(0,0,0,0.5)',
            fontFamily: 'var(--font-display)', fontSize: 64, color: '#fff',
            textShadow: '0 4px 0 rgba(110,78,16,0.8)',
            marginLeft: -75, marginTop: -75,
          }}
        >
          VS
        </motion.div>
      </div>

      {/* Bandeau matiere + mini-jeu */}
      <motion.div
        initial={{ y: 90 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 140, delay: 1.3 }}
        style={{
          padding: '16px 24px', textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(255,243,212,0.97), rgba(240,224,178,0.97))',
          borderTop: '3px solid var(--gold-600)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-900)' }}>
          {subjectInfo.icon} {T('fight.versus.duelOf', { subject: locName(subjectInfo) || fight.subject })} — {T(minigame.name)}
        </span>
        <div style={{ fontSize: 13, color: 'var(--ink-600)', marginTop: 4, fontFamily: 'var(--font-ui)' }}>
          {T(minigame.rules)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 6, fontFamily: 'var(--font-ui)' }}>
          {minigame.winLabel ? T(minigame.winLabel) : T('fight.versus.firstToRounds', { n: FIGHT_ROUNDS_TO_WIN })} — {T('fight.versus.touchForRules')}
        </div>
      </motion.div>
    </div>
  );
}

// --- Scène du mini-jeu (header scores + jeu) ---

function WinStars({ count }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {Array.from({ length: FIGHT_ROUNDS_TO_WIN }, (_, i) => (
        <motion.span
          key={i}
          animate={i < count ? { scale: [1, 1.5, 1] } : {}}
          style={{ fontSize: 18, filter: i < count ? 'none' : 'grayscale(1) opacity(0.35)' }}
        >
          ⭐
        </motion.span>
      ))}
    </span>
  );
}

function MinigameStage({ fight, attacker, defender }) {
  const T = useT();
  const fightRoundWin = useGameStore((s) => s.fightRoundWin);
  const minigame = resolveMinigame(fight);
  const { Component, persistent, content } = minigame;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 14, gap: 10, minHeight: 0 }}>
      {/* Header scores (les jeux a points cumulatifs affichent le leur) */}
      {!minigame.pointsBased && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 18px', borderRadius: 14,
            background: 'rgba(255,254,251,0.12)',
            border: '1px solid rgba(243,201,105,0.35)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{attacker.emoji}</span>
            <span style={{ fontFamily: 'var(--font-display)', color: '#fff', fontSize: 16 }}>{attacker.name}</span>
            <WinStars count={fight.wins.attacker} />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--gold-400, #f3c969)',
              padding: '4px 14px', borderRadius: 999, border: '1px solid rgba(243,201,105,0.5)',
            }}
          >
            {T('fight.round', { n: fight.round })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <WinStars count={fight.wins.defender} />
            <span style={{ fontFamily: 'var(--font-display)', color: '#fff', fontSize: 16 }}>{defender.name}</span>
            <span style={{ fontSize: 24 }}>{defender.emoji}</span>
          </div>
        </div>
      )}

      {/* Mini-jeu (remonte a chaque manche sauf si persistant) */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Component
          key={persistent ? 'persistent' : `round-${fight.round}`}
          attacker={attacker}
          defender={defender}
          subject={fight.subject}
          round={fight.round}
          onRoundWin={fightRoundWin}
          content={content}
        />
      </div>
    </div>
  );
}

// --- Récompense du vainqueur + résultat ---

function RewardScreen({ fight, attacker, defender }) {
  const T = useT();
  const fightChooseReward = useGameStore((s) => s.fightChooseReward);
  const closeFight = useGameStore((s) => s.closeFight);
  // Extension objets coupée : pas de butin d'objet en duel.
  const itemsOn = useGameStore((s) => s.itemsEnabled());

  const winner = fight.winnerSide === 'attacker' ? attacker : defender;
  const loser = fight.winnerSide === 'attacker' ? defender : attacker;
  const reward = fight.reward;

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 16 }}
        style={{
          width: 'min(560px, 94vw)', borderRadius: 22, overflow: 'hidden',
          background: 'linear-gradient(180deg, #fffefb, #f4ead5)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            padding: '22px 26px 16px',
            background: `linear-gradient(135deg, ${winner.color}33, transparent)`,
            borderBottom: '1px solid rgba(122,94,58,0.18)',
          }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontSize: 64 }}
          >
            {"\u{1F3C6}"}
          </motion.div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: winner.color, marginTop: 4 }}>
            {T('fight.reward.winsDuel', { emoji: winner.emoji, name: winner.name })}
          </div>
        </div>

        <div style={{ padding: '18px 26px 26px' }}>
          {fight.phase === 'reward' && !reward && (
            <>
              <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, fontFamily: 'var(--font-ui)', color: 'var(--ink-700)' }}>
                {T('fight.reward.choose')}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn--green btn--lg" onClick={() => fightChooseReward('steal')}>
                  {T('fight.reward.steal')}
                </button>
                <button className="btn btn--purple btn--lg" onClick={() => fightChooseReward('knockback')}>
                  {T('fight.reward.knockback')}
                </button>
                {itemsOn && (
                  <button className="btn btn--lg" onClick={() => fightChooseReward('loot')}>
                    {T('fight.reward.loot')}
                  </button>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 12, fontFamily: 'var(--font-ui)' }}>
                {T('fight.reward.stealDesc', { emoji: loser.emoji, name: loser.name })}<br />
                {T('fight.reward.knockbackDesc', { emoji: loser.emoji, name: loser.name })}
                {itemsOn && <><br />{T('fight.reward.lootDesc', { emoji: loser.emoji, name: loser.name })}</>}
              </p>
            </>
          )}

          {fight.phase === 'reward' && reward && (
            <div style={{ padding: '10px 0' }}>
              {reward.choice === 'loot' ? (
                <div className="anim-float" style={{ fontSize: 64 }}>{"\u{1F392}"}</div>
              ) : (
                <>
                  <div className={reward.rolling ? 'anim-float' : ''} style={{ fontSize: 64, letterSpacing: 8 }}>
                    {reward.dice.map((d, i) => <span key={i}>{DICE_FACES[d]}</span>)}
                  </div>
                  {!reward.rolling && (
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginTop: 8 }}>
                      {reward.dice.reduce((a, b) => a + b, 0)} !
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {fight.phase === 'result' && (
            <>
              <p style={{ fontSize: 17, fontFamily: 'var(--font-display)', color: 'var(--ink-900)', marginBottom: 18 }}>
                {fight.resultMessage}
              </p>
              <button className="btn btn--lg" onClick={closeFight} style={{ minWidth: 220 }}>
                {T('fight.reward.backToBoard')}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Duel éclair (mode en ligne) rendu côté HÔTE : réutilise DuelRaceView pour la
// phase « course à la question ». L'hôte répond pour son équipe LOCALE (celle
// sans jeton — les équipes distantes répondent depuis leur propre écran).
function HostDuelRace({ fight, teams }) {
  const fightBegin = useGameStore((s) => s.fightBegin);
  const submitFightAnswer = useGameStore((s) => s.submitFightAnswer);
  const fightChooseReward = useGameStore((s) => s.fightChooseReward);
  const closeFight = useGameStore((s) => s.closeFight);

  const parts = [fight.attackerIndex, fight.defenderIndex].filter((i) => i >= 0);
  const localIdx = parts.find((i) => teams[i] && !teams[i].token);
  const myTeamIdx = localIdx == null ? -1 : localIdx;

  const norm = {
    phase: fight.phase,
    attackerIndex: fight.attackerIndex,
    defenderIndex: fight.defenderIndex,
    boss: !!(fight.boss || fight.bossFight),
    wins: fight.wins,
    winnerIndex: fight.winnerSide === 'attacker' ? fight.attackerIndex : fight.winnerSide === 'defender' ? fight.defenderIndex : null,
    rewardChosen: !!fight.reward?.choice,
    resultMessage: fight.resultMessage,
    race: fight.race ? {
      q: fight.race.q,
      answered: { attacker: !!fight.race.answers?.attacker, defender: !!fight.race.answers?.defender },
      deadline: fight.race.deadline,
    } : null,
  };

  return (
    <DuelRaceView
      fight={norm} teams={teams} myTeamIdx={myTeamIdx}
      onBegin={fightBegin}
      onAnswer={(i) => submitFightAnswer(myTeamIdx, i)}
      onReward={fightChooseReward}
      onClose={closeFight}
    />
  );
}
