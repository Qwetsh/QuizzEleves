// Duel Memory — UI TÉLÉPHONE d'un duelliste (mode « écran + téléphones-manettes »).
// Présentationnel : reçoit le bloc `fight` (payload turn.fight, avec `memory`) +
// `myTeamIdx` et des callbacks (envoi d'intents). Aucune logique de jeu : l'hôte
// (store) est l'autorité. Le camp ACTIF retourne les cartes ; l'autre regarde.
import TeamAvatar from '../TeamAvatar';
import MemoryBoard from './minigames/MemoryBoard';
import { useT } from '../../i18n';

const wrap = {
  position: 'fixed', inset: 0, zIndex: 340, display: 'flex', flexDirection: 'column',
  background: 'rgba(6,9,12,0.94)', fontFamily: 'var(--font-ui)', color: '#eafff0',
  padding: 14, gap: 10, pointerEvents: 'auto',
};

function btn(bg, color = '#06210f') {
  return {
    cursor: 'pointer', padding: '11px 14px', borderRadius: 10, border: '2px solid #05070a',
    background: bg, color, fontWeight: 700, fontFamily: 'var(--font-ui)', fontSize: 15,
  };
}

export default function MemoryDuelView({ fight, teams = [], myTeamIdx, onFlip, onReward, onClose }) {
  const T = useT();
  const m = fight.memory;
  const mySide = myTeamIdx === fight.attackerIndex ? 'attacker' : myTeamIdx === fight.defenderIndex ? 'defender' : null;
  const isWinner = fight.winnerIndex != null && fight.winnerIndex === myTeamIdx;

  const att = teams[fight.attackerIndex] || { emoji: '🅰️', name: 'A', color: '#c9472f' };
  const def = fight.defenderIndex === -1 ? { emoji: '🅱️', name: '?', color: '#8b9096' }
    : (teams[fight.defenderIndex] || { emoji: '🅱️', name: 'B', color: '#2f6fc9' });

  // --- Récompense / résultat (mêmes intents que le duel éclair) ---
  if (fight.phase === 'reward') {
    return (
      <div style={{ ...wrap, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {isWinner && !fight.rewardChosen ? (
          <>
            <div style={{ fontSize: 20, margin: '6px 0 14px' }}>🏆 {T('fight.reward.choose')}</div>
            <div style={{ display: 'grid', gap: 8, width: 'min(460px, 92vw)' }}>
              <button onClick={() => onReward('steal')} style={btn('#caa23a', '#1a1405')}>💰 {T('fight.reward.steal')}</button>
              <button onClick={() => onReward('knockback')} style={btn('#c9472f')}>💥 {T('fight.reward.knockback')}</button>
              <button onClick={() => onReward('loot')} style={btn('#5a2f8e')}>🎁 {T('fight.reward.loot')}</button>
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
  if (fight.phase === 'result') {
    return (
      <div style={{ ...wrap, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 17, margin: '6px 0 14px' }}>{fight.resultMessage}</div>
        <button onClick={onClose} style={btn('#2fb551')}>{T('fight.reward.backToBoard')}</button>
      </div>
    );
  }

  // --- Plateau (phase minigame) ---
  if (!m) {
    return <div style={{ ...wrap, justifyContent: 'center', alignItems: 'center' }}><div style={{ color: '#8b9096' }}>…</div></div>;
  }

  const myTurn = mySide === m.activeSide && !m.reveal && !m.busy && (m.flipped?.length || 0) < 2;
  const boardCards = (m.cards || []).map((c, idx) => ({
    key: c.key,
    text: c.text,
    owner: c.owner || null,
    faceUp: (m.flipped || []).includes(idx),
  }));

  const scoreChip = (side, tm) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: m.activeSide === side || m.reveal ? 1 : 0.5 }}>
      <TeamAvatar team={tm} size={22} />
      <span style={{ fontWeight: 700, fontSize: 13 }}>{tm.name}</span>
      <span style={{ minWidth: 22, textAlign: 'center', padding: '1px 8px', borderRadius: 999, background: '#0f1419', border: `1px solid ${tm.color}`, fontWeight: 800 }}>
        {m.scores?.[side] ?? 0}
      </span>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.06)' }}>
        {scoreChip('attacker', att)}
        <span style={{ fontSize: 12, fontWeight: 800, color: myTurn ? '#66ff8a' : '#8b9096', textAlign: 'center' }}>
          {m.reveal
            ? (m.reveal.winner === 'tie' ? T('fight.memory.tie') : '🏆')
            : (myTurn ? T('fight.memory.yourTurn') : T('fight.memory.waitTurn'))}
        </span>
        {scoreChip('defender', def)}
      </div>

      {/* Zone plateau : hauteur bornée pour garder des cartes carrées lisibles */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', maxHeight: '100%', margin: '0 auto', display: 'flex' }}>
          <MemoryBoard
            cards={boardCards}
            attacker={att}
            defender={def}
            onFlip={myTurn ? (idx) => onFlip(idx) : null}
            locked={!myTurn}
          />
        </div>
      </div>
    </div>
  );
}
