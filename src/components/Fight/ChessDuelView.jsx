// Duel ÉCHECS — écran du DUELLISTE sur les surfaces distantes : téléphone (mode
// « écran + téléphones ») et client en ligne (+ fenêtre de l'hôte-joueur en ligne,
// via ChessDuelStage). Présentationnel : reçoit le bloc `fight` (payload turn.fight,
// avec `chess`) + `myTeamIdx` et des callbacks (envoi d'intents). Aucune logique de
// partie : l'hôte (store) est l'autorité — je joue un coup, j'envoie from/to,
// l'hôte tranche (légalité / justesse / mat).
//
// Contrat lu : fight.chess.sides[mySide] = { fen, turn, step, solved, locked,
// shakeSeq, lastMove }. J'affiche MON échiquier, orienté à MON camp (sideToMove).
import TeamAvatar from '../TeamAvatar';
import ChessBoard from './minigames/ChessBoard';
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

export default function ChessDuelView({ fight, teams = [], myTeamIdx, onMove, onReward, onClose }) {
  const T = useT();
  const ch = fight?.chess;
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

  // --- Plateau (phase minigame) ---
  if (!ch || !mySide) {
    return <div style={{ ...wrap, justifyContent: 'center', alignItems: 'center' }}><div style={{ color: '#8b9096' }}>…</div></div>;
  }

  const me = mySide === 'attacker' ? att : def;
  const side = ch.sides?.[mySide] || {};
  const turn = side.turn || 'w'; // couleur au trait = mon camp = orientation
  const mateIn = ch.mateIn === 2 ? 2 : 1;
  const solved = !!side.solved;
  const locked = !!side.locked;

  const badge = {
    fontFamily: 'var(--font-display)', fontSize: 13, color: '#3a2c1a',
    background: '#f3c969', borderRadius: 999, padding: '2px 10px',
  };

  return (
    <div style={wrap}>
      {/* En-tête : moi + « MAT EN N » + trait */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: '4px 0' }}>
        <TeamAvatar team={me} size={26} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: me.color }}>{me.name}</span>
        <span style={badge}>{mateIn === 2 ? T('fight.chess.mateIn2') : T('fight.chess.mateIn1')}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
          {turn === 'w' ? T('fight.chess.whiteToMove') : T('fight.chess.blackToMove')}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          {T('fight.chess.round', { n: ch.roundNo || 1 })}
        </span>
      </div>

      {/* Bandeau d'état */}
      <div style={{ minHeight: 22, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 16 }}>
        {solved
          ? <span style={{ color: '#9be67f' }}>{T('fight.chess.win')}</span>
          : locked
            ? <span style={{ color: '#ff8a7a' }}>{T('fight.chess.wrong')}</span>
            : mateIn === 2 && (side.step || 0) >= 2
              ? <span style={{ color: '#f3c969' }}>{T('fight.chess.yourFinish')}</span>
              : <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'var(--font-ui)' }}>{T('fight.chess.hint')}</span>}
      </div>

      {/* MON échiquier, orienté à mon camp — interactif tant que non résolu/verrouillé */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChessBoard
          fen={side.fen}
          orientation={turn}
          myColor={turn}
          interactive={!solved && !locked}
          onMove={(mv) => onMove && onMove(mv)}
          locked={locked || solved}
          shakeSeq={side.shakeSeq || 0}
          lastMove={side.lastMove || null}
        />
      </div>

      {solved && (
        <div style={{ textAlign: 'center', fontSize: 13, color: '#8b9096' }}>{T('fight.chess.solvedWait')}</div>
      )}
    </div>
  );
}
