// Duel « Chroniques de la Terre du Milieu » (LIEU → ÉVÉNEMENT) — écran du
// DUELLISTE sur les surfaces distantes : téléphone (mode « écran + téléphones »)
// et client en ligne (+ fenêtre de l'hôte-joueur en ligne, via MapeventDuelStage).
// Présentationnel : reçoit le bloc `fight` (payload turn.fight, avec `mapevent`)
// + `myTeamIdx` et des callbacks (envoi d'intents). Aucune logique de partie :
// l'hôte (store) est l'autorité — je touche un choix, j'envoie son id, l'hôte
// tranche (justesse / vitesse). Les DEUX camps répondent (course).
//
// Contrat lu (fight.mapevent) :
//   { roundNo, universe, target:{ place, x, y },
//     choices:[{ id, event, eventEn }],       // 4 choix mélangés, SANS marquage
//     locked:{ attacker, defender },
//     reveal: null | { winner, correctId } }   // correctId à la révélation
// mySide déduit comme WizardDuelView (attacker si myTeamIdx===attackerIndex).
import TeamAvatar from '../TeamAvatar';
import LotrEventMap from './minigames/LotrEventMap';
import { useT } from '../../i18n';

const wrap = {
  position: 'fixed', inset: 0, zIndex: 340, display: 'flex', flexDirection: 'column',
  background: 'rgba(18,12,4,0.96)', fontFamily: 'var(--font-ui)', color: '#f3e8cf',
  padding: 14, gap: 10, pointerEvents: 'auto',
};

function btn(bg, color = '#06210f') {
  return {
    cursor: 'pointer', padding: '11px 14px', borderRadius: 10, border: '2px solid #05070a',
    background: bg, color, fontWeight: 700, fontFamily: 'var(--font-ui)', fontSize: 15,
  };
}

export default function MapeventDuelView({ fight, teams = [], myTeamIdx, onAnswer, onReward, onClose }) {
  const T = useT();
  const me2 = fight?.mapevent;
  const mySide = myTeamIdx === fight?.attackerIndex ? 'attacker'
    : myTeamIdx === fight?.defenderIndex ? 'defender' : null;
  const isWinner = fight?.winnerIndex != null && fight.winnerIndex === myTeamIdx;

  const att = teams[fight?.attackerIndex] || { emoji: '🅰️', name: 'A', color: '#c9472f' };
  const def = fight?.defenderIndex === -1 ? { emoji: '🅱️', name: '?', color: '#8b9096' }
    : (teams[fight?.defenderIndex] || { emoji: '🅱️', name: 'B', color: '#2f6fc9' });

  // --- Récompense / résultat (mêmes intents que les autres duels) ---
  if (fight?.phase === 'reward') {
    const itemsOn = fight.itemsOn !== false;
    return (
      <div style={{ ...wrap, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {isWinner && !fight.rewardChosen ? (
          <>
            <div style={{ fontSize: 20, margin: '6px 0 14px' }}>🏆 {T('fight.reward.choose')}</div>
            <div style={{ display: 'grid', gap: 8, width: 'min(460px, 92vw)' }}>
              <button onClick={() => onReward('steal')} style={btn('#caa23a', '#1a1405')}>💰 {T('fight.reward.steal')}</button>
              <button onClick={() => onReward('knockback')} style={btn('#c9472f')}>💥 {T('fight.reward.knockback')}</button>
              {itemsOn && <button onClick={() => onReward('loot')} style={btn('#5a2f8e')}>🎁 {T('fight.reward.loot')}</button>}
            </div>
          </>
        ) : (
          <div style={{ color: '#8b9096', fontSize: 18 }}>
            {isWinner ? '…' : `${(teams[fight.winnerIndex] || {}).name || ''} 🏆`}
          </div>
        )}
      </div>
    );
  }
  if (fight?.phase === 'result') {
    return (
      <div style={{ ...wrap, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 17, margin: '6px 0 14px' }}>{fight.resultMessage}</div>
        <button onClick={onClose} style={btn('#2fb551')}>{T('fight.reward.backToBoard')}</button>
      </div>
    );
  }

  // --- Phase minigame ---
  if (!me2 || !mySide) {
    return <div style={{ ...wrap, justifyContent: 'center', alignItems: 'center' }}><div style={{ color: '#8b9096' }}>…</div></div>;
  }

  const me = mySide === 'attacker' ? att : def;
  const target = me2.target || {};
  const choices = Array.isArray(me2.choices) ? me2.choices : [];
  const locked = !!(me2.locked && me2.locked[mySide]);
  const reveal = me2.reveal || null;
  const over = !!reveal;
  const iWon = reveal?.winner === mySide;
  const correctId = reveal?.correctId ?? null;
  // Interactif tant que le duel n'est pas résolu ET que ce camp n'est pas verrouillé.
  const canAnswer = !over && !locked;
  const label = (c) => (T.lang === 'en' ? (c.eventEn || c.event) : c.event);

  return (
    <div style={wrap}>
      {/* En-tête : moi + rappel de l'enjeu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: '4px 0' }}>
        <TeamAvatar team={me} size={26} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: me.color }}>{me.name}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
          {T('fight.mg.lotrevent.name')}
        </span>
      </div>

      {/* La carte, en réduit : je vois OÙ se situe le lieu qui pulse. */}
      <div style={{ position: 'relative', height: 170, minHeight: 170, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }}>
        <LotrEventMap universe={me2.universe} x={target.x} y={target.y} compact />
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          padding: '6px 16px', borderRadius: 10, textAlign: 'center', maxWidth: '92%',
          background: 'rgba(255,254,251,0.95)', zIndex: 4,
          fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink-900)',
          boxShadow: '0 3px 10px rgba(0,0,0,0.35)', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {T('fight.lotrevent.prompt')}
        </div>
      </div>

      {/* Bandeau d'état : fin / verrouillage / consigne */}
      <div style={{ minHeight: 22, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 16 }}>
        {over
          ? (iWon
            ? <span style={{ color: '#9be67f' }}>✨ {T('fight.lotrevent.youWin')}</span>
            : <span style={{ color: '#ff8a7a' }}>💥 {T('fight.lotrevent.youLose')}</span>)
          : locked
            ? <span style={{ color: '#ff8a7a' }}>⚡ {T('fight.lotrevent.wrong')}</span>
            : <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'var(--font-ui)' }}>{T('fight.lotrevent.hint')}</span>}
      </div>

      {/* Les 4 choix (event/eventEn) → intent turnMapeventAnswer { choiceId } */}
      {choices.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: canAnswer ? 1 : 0.75 }}>
          {choices.map((c) => {
            const isCorrect = over && correctId != null && c.id === correctId;
            return (
              <button
                key={c.id}
                onPointerDown={(e) => { if (!canAnswer) return; e.preventDefault(); onAnswer && onAnswer(c.id); }}
                disabled={!canAnswer}
                style={{
                  ...btn(isCorrect ? '#d1f0b8'
                    : canAnswer ? `linear-gradient(180deg, ${me.color}, ${me.color}cc)` : '#2a2418',
                    isCorrect ? '#25301a' : '#fff'),
                  cursor: canAnswer ? 'pointer' : 'default', textAlign: 'left',
                  border: `${isCorrect ? 3 : 2}px solid ${isCorrect ? '#5b8c3a' : canAnswer ? '#05070a' : '#3a3320'}`,
                  touchAction: 'manipulation', lineHeight: 1.25,
                }}
              >
                {label(c)}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 13, color: '#8b9096', padding: 12 }}>
          {over ? '…' : T('fight.lotrevent.waitNext')}
        </div>
      )}
    </div>
  );
}
