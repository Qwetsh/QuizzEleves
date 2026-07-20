import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';
import { locName } from '../../i18n/content';
import { FIGHT_ROUNDS_TO_WIN } from '../../store/fightHandlers';
import { getMinigame, getDefaultMinigame } from './minigames';
import FightBriefing from './FightBriefing';
import CurioDuelStage from './CurioDuelStage';
import WtpDuelStage from './WtpDuelStage';
import MemoryDuelStage from './MemoryDuelStage';
import PkmnDuelStage from './PkmnDuelStage';
import ChessDuelStage from './ChessDuelStage';
import HackDuelStage from './HackDuelStage';
import TeamAvatar from '../TeamAvatar';
import { RewardCard } from './RewardChoices';
import DuelRaceView from '../Online/DuelRaceView';
import { onlineToken } from '../../logic/sessionConfig';
import { useT } from '../../i18n';

// Le simulateur dev peut forcer le duel generique via fight.forceDefault.
// `fight.round` est la graine du moteur « mix » (nature_g) : le mini-jeu tiré
// change d'une manche à l'autre mais reste STABLE au sein d'une manche.
function resolveMinigame(fight) {
  return fight.forceDefault ? getDefaultMinigame() : getMinigame(fight.subject, fight.round);
}
import { soundEvent } from '../../logic/sounds';

const DICE_FACES = [null, '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export default function FightModal() {
  const showFight = useGameStore((s) => s.showFight);
  const teams = useGameStore((s) => s.teams);
  const connectionMode = useGameStore((s) => s.connectionMode);
  const mirror = useGameStore((s) => !!s._mirror);

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
          // En ligne, la fenêtre HÔTE rend le plateau inerte (rg-root
          // pointerEvents:none) mais l'hôte est un JOUEUR : s'il est duelliste
          // ou vainqueur, cet overlay doit rester cliquable (RewardScreen,
          // « Retour au plateau », carte curio…). Les MIROIRS restent inertes
          // (leurs vues interactives passent par OnlineController/intents).
          pointerEvents: mirror ? 'none' : 'auto',
        }}
      >
        {showFight.phase === 'versus' && (
          <VersusScreen fight={showFight} attacker={attacker} defender={defender} />
        )}
        {showFight.phase === 'briefing' && (
          <FightBriefing fight={showFight} attacker={attacker} defender={defender} />
        )}
        {/* Duel silhouette (« Qui est ce Pokémon ?! ») en mode « écran +
            téléphones » : l'écran partagé n'affiche QUE le plateau TV, les
            duellistes répondent au téléphone. En ligne, chacun joue sur son
            navigateur → vue course classique (enrichie silhouette). */}
        {showFight.phase === 'minigame' && showFight.race && showFight.wtp && connectionMode !== 'online' && (
          <WtpDuelStage fight={showFight} attacker={attacker} defender={defender} />
        )}
        {showFight.phase === 'minigame' && showFight.race && !(showFight.wtp && connectionMode !== 'online') && (
          <HostDuelRace fight={showFight} teams={teams} />
        )}
        {/* Duel Curioscope piloté par le store (téléphones / en ligne) : photo
            partagée + placement sur les écrans des duellistes. */}
        {showFight.phase === 'minigame' && showFight.curio && (
          <CurioDuelStage fight={showFight} attacker={attacker} defender={defender} />
        )}
        {/* Duel Memory piloté par le store (téléphones) : plateau TV en lecture
            seule, les duellistes retournent les cartes sur leur appareil. */}
        {showFight.phase === 'minigame' && showFight.memory && (
          <MemoryDuelStage fight={showFight} attacker={attacker} defender={defender} />
        )}
        {/* Combat Pokémon piloté par le store (téléphones) : la TV n'affiche que
            la scène — draft et choix se font sur les « Game Boy ». */}
        {showFight.phase === 'minigame' && showFight.pkmn && (
          <PkmnDuelStage fight={showFight} attacker={attacker} defender={defender} />
        )}
        {/* Duel d'échecs piloté par le store (téléphones / en ligne) : les deux
            échiquiers sur l'écran partagé en lecture seule, chaque duelliste
            joue sur son appareil. */}
        {showFight.phase === 'minigame' && showFight.chess && (
          <ChessDuelStage fight={showFight} attacker={attacker} defender={defender} />
        )}
        {/* Cyber-duel (hacking) piloté par le store (téléphones / en ligne) :
            les deux terminaux sur l'écran partagé en lecture seule, chaque
            duelliste complète l'exploit sur son appareil. */}
        {showFight.phase === 'minigame' && showFight.hack && (
          <HackDuelStage fight={showFight} attacker={attacker} defender={defender} />
        )}
        {showFight.phase === 'minigame' && !showFight.race && !showFight.curio && !showFight.memory && !showFight.pkmn && !showFight.chess && !showFight.hack && (
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
  const mirror = useGameStore((s) => !!s._mirror);
  const subjectInfo = SUBJECTS[fight.subject] || {};
  const minigame = resolveMinigame(fight);

  // Avance automatiquement apres la presentation. JAMAIS sur un miroir : l'état
  // du duel arrive par snapshot (l'hôte est l'autorité) — un fightBegin local
  // ferait diverger le miroir (tirage de question fantôme, timers concurrents).
  useEffect(() => {
    if (mirror) return undefined;
    const t = setTimeout(fightBegin, 4200);
    return () => clearTimeout(t);
  }, [fightBegin, mirror]);

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
        <TeamAvatar team={team} size={110} />
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
            <TeamAvatar team={attacker} size={34} />
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
            <TeamAvatar team={defender} size={34} />
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
          {...(minigame.props || {})}
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
  const reward = fight.reward;

  // Cartes de butin (Piller / Repousser / Butin) — le butin d'objet n'apparaît
  // que si l'extension objets est active.
  const rewardOpts = [
    { rw: 'steal', name: T('fight.reward.steal.name'), tag: T('fight.reward.steal.tag') },
    { rw: 'knockback', name: T('fight.reward.knockback.name'), tag: T('fight.reward.knockback.tag') },
    ...(itemsOn ? [{ rw: 'loot', name: T('fight.reward.loot.name'), tag: T('fight.reward.loot.tag') }] : []),
  ];

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 16 }}
        style={{
          position: 'relative',
          width: 'min(500px, 94vw)', borderRadius: 24, overflow: 'hidden',
          background: 'linear-gradient(180deg, #fffdf7, #f1e2c2)',
          boxShadow: '0 0 0 1px rgba(122,94,58,0.2), 0 28px 70px rgba(0,0,0,0.6)',
          textAlign: 'center',
        }}
      >
        {/* Bandeau vainqueur : halo tournant teinté équipe + trophée qui flotte */}
        <div
          style={{
            position: 'relative', overflow: 'hidden',
            padding: '26px 26px 20px',
            background: `radial-gradient(ellipse at 50% -10%, ${winner.color}55, transparent 70%), linear-gradient(180deg, ${winner.color}22, transparent)`,
            borderBottom: '1px solid rgba(122,94,58,0.16)',
          }}
        >
          <motion.div
            aria-hidden
            animate={{ rotate: 360 }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute', top: -40, left: '50%', width: 240, height: 240, marginLeft: -120,
              background: `conic-gradient(from 0deg, transparent, ${winner.color}44, transparent, ${winner.color}44, transparent)`,
              borderRadius: '50%', opacity: 0.55, pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative' }}>
            <motion.div
              animate={{ y: [0, -9, 0] }}
              transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: 68, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))' }}
            >
              {"\u{1F3C6}"}
            </motion.div>
            <motion.span
              aria-hidden
              animate={{ scale: [0.8, 1.25, 0.8], opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ position: 'absolute', top: 4, left: 'calc(50% - 66px)', fontSize: 22 }}
            >
              {"✨"}
            </motion.span>
            <motion.span
              aria-hidden
              animate={{ scale: [1.2, 0.8, 1.2], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
              style={{ position: 'absolute', top: 12, left: 'calc(50% + 46px)', fontSize: 18 }}
            >
              {"✨"}
            </motion.span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.16em', textTransform: 'uppercase', color: winner.color, opacity: 0.85, marginTop: 6 }}>
              {T('fight.reward.victory')}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink-900)', marginTop: 2, lineHeight: 1.1 }}>
              {T('fight.reward.winsDuel', { emoji: winner.emoji, name: winner.name })}
            </div>
          </div>
        </div>

        <div style={{ padding: '18px 20px 22px' }}>
          {fight.phase === 'reward' && !reward && (
            <>
              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 14, fontFamily: 'var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-500)' }}>
                {T('fight.reward.choose')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rewardOpts.map((o, i) => (
                  <RewardCard
                    key={o.rw} rw={o.rw} name={o.name} tag={o.tag} delay={0.05 * i}
                    onClick={() => fightChooseReward(o.rw)}
                  />
                ))}
              </div>
            </>
          )}

          {fight.phase === 'reward' && reward && (
            <div style={{ padding: '14px 0' }}>
              {reward.choice === 'loot' ? (
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} style={{ fontSize: 70 }}>
                  {"\u{1F392}"}
                </motion.div>
              ) : (
                <>
                  <div
                    className={reward.rolling ? 'anim-float' : ''}
                    style={{ fontSize: 66, letterSpacing: 8, color: reward.choice === 'steal' ? 'var(--gold-600)' : 'var(--rose-500)' }}
                  >
                    {reward.dice.map((d, i) => <span key={i}>{DICE_FACES[d]}</span>)}
                  </div>
                  {!reward.rolling && (
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginTop: 8, color: 'var(--ink-900)' }}>
                      {reward.dice.reduce((a, b) => a + b, 0)} !
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {fight.phase === 'result' && (
            <>
              <div
                style={{
                  fontSize: 16, fontFamily: 'var(--font-ui)', color: 'var(--ink-800)', lineHeight: 1.45,
                  background: '#fffdf7', border: '1px solid rgba(122,94,58,0.16)', borderRadius: 14,
                  padding: '14px 16px', marginBottom: 18, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
                }}
              >
                {fight.resultMessage}
              </div>
              <button className="btn btn--green btn--lg" onClick={closeFight} style={{ minWidth: 220 }}>
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
// phase « course à la question ». L'hôte répond pour SON équipe : celle qui
// porte son jeton local (l'hôte est un joueur comme les autres depuis le lobby
// dédié) ou, héritage, une équipe sans jeton. Les équipes distantes répondent
// depuis leur propre écran.
function HostDuelRace({ fight, teams }) {
  const fightBegin = useGameStore((s) => s.fightBegin);
  const submitFightAnswer = useGameStore((s) => s.submitFightAnswer);
  const fightChooseReward = useGameStore((s) => s.fightChooseReward);
  const closeFight = useGameStore((s) => s.closeFight);
  const sessionCode = useGameStore((s) => s.sessionCode);
  const mirror = useGameStore((s) => !!s._mirror);
  const itemsOn = useGameStore((s) => s.itemsEnabled());

  const norm = {
    phase: fight.phase,
    attackerIndex: fight.attackerIndex,
    defenderIndex: fight.defenderIndex,
    boss: !!(fight.boss || fight.bossFight),
    wins: fight.wins,
    winnerIndex: fight.winnerSide === 'attacker' ? fight.attackerIndex : fight.winnerSide === 'defender' ? fight.defenderIndex : null,
    rewardChosen: !!fight.reward?.choice,
    resultMessage: fight.resultMessage,
    // Duel silhouette : sans `wtp`, l'hôte-duelliste verrait l'image EN CLAIR
    // (avantage déloyal) et sans `reveal` jamais la révélation — mêmes champs
    // que le payload manette (sessionConfig, bloc race).
    wtp: fight.wtp || null,
    itemsOn,
    race: fight.race ? {
      q: fight.race.q,
      answered: { attacker: !!fight.race.answers?.attacker, defender: !!fight.race.answers?.defender },
      deadline: fight.race.deadline,
      reveal: fight.race.reveal ? { c: fight.race.reveal.c, winner: fight.race.reveal.winner || null } : null,
    } : null,
  };

  // Client miroir : les DUELLISTES ont leur vue interactive montée par
  // OnlineController (intents), rendue PAR-DESSUS celle-ci. Les SPECTATEURS
  // voient ici le duel en lecture seule (myTeamIdx = -1 → « Duel en cours… »)
  // au lieu d'un écran vide.
  if (mirror) {
    const noop = () => {};
    return (
      <DuelRaceView
        fight={norm} teams={teams} myTeamIdx={-1}
        onBegin={noop} onAnswer={noop} onReward={noop} onClose={noop}
      />
    );
  }

  const hostToken = sessionCode ? onlineToken(sessionCode) : null;
  const parts = [fight.attackerIndex, fight.defenderIndex].filter((i) => i >= 0);
  // « Mon équipe » = l'équipe locale : sans jeton OU portant le jeton de
  // l'hôte. Un BOT (solo) n'a pas de jeton mais n'est PAS l'équipe locale —
  // sinon l'humain répondrait à la course à sa place.
  const localIdx = parts.find((i) => teams[i] && !teams[i].isBot && (!teams[i].token || (hostToken && teams[i].token === hostToken)));
  const myTeamIdx = localIdx == null ? -1 : localIdx;

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
