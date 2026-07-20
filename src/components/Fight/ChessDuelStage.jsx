// Police « LCD » du bandeau TV rétro (auto-hébergée, comme l'écran cassettes).
import '@fontsource/vt323/400.css';
import { useGameStore } from '../../store/gameStore';
import { onlineToken } from '../../logic/sessionConfig';
import TeamAvatar from '../TeamAvatar';
import ChessBoard from './minigames/ChessBoard';
import ChessDuelView from './ChessDuelView';
import { useT } from '../../i18n';

/**
 * Duel ÉCHECS piloté par le STORE — rendu dans FightModal (phase minigame,
 * showFight.chess). Comme le Curioscope, ce duel tourne sur les 3 surfaces :
 * - fenêtre de l'HÔTE EN LIGNE dont l'équipe est duelliste → il joue son
 *   échiquier (ChessDuelView branché sur chessDuelMove) ;
 * - sinon (écran partagé du mode « écran + téléphones », hôte non-duelliste,
 *   miroir en ligne) → vue SPECTATEUR : les DEUX échiquiers en lecture seule,
 *   incrustés dans la TV CRT rétro, + statut de chaque camp.
 *
 * Pas de draft pour les échecs : la scène s'affiche dès le début de la manche.
 */
export default function ChessDuelStage({ fight, attacker, defender }) {
  const T = useT();
  const teams = useGameStore((s) => s.teams);
  const mirror = useGameStore((s) => !!s._mirror);
  const online = useGameStore((s) => s.connectionMode === 'online');
  const sessionCode = useGameStore((s) => s.sessionCode);
  const chessDuelMove = useGameStore((s) => s.chessDuelMove);

  const ch = fight.chess;
  if (!ch) return null;

  // Hôte en ligne = joueur : si SON équipe est un des duellistes, il joue ici
  // (même résolution de jeton que CurioDuelStage).
  let hostSide = null;
  if (online && !mirror) {
    const hostToken = sessionCode ? onlineToken(sessionCode) : null;
    for (const [side, idx] of [['attacker', fight.attackerIndex], ['defender', fight.defenderIndex]]) {
      const t = teams[idx];
      if (t && !t.isBot && (!t.token || (hostToken && t.token === hostToken))) { hostSide = side; break; }
    }
  }
  if (hostSide) {
    const myTeamIdx = hostSide === 'attacker' ? fight.attackerIndex : fight.defenderIndex;
    return (
      <ChessDuelView
        fight={{ ...fight, chess: ch, winnerIndex: null }}
        teams={teams}
        myTeamIdx={myTeamIdx}
        onMove={(mv) => chessDuelMove(hostSide, mv)}
        onReward={() => {}}
        onClose={() => {}}
      />
    );
  }

  // --- Vue spectateur (écran partagé / miroir) : les deux échiquiers en lecture
  // seule, chacun orienté à SON camp. Habillage sobre rétro.
  const reveal = ch.reveal;
  const mateIn = ch.mateIn === 2 ? 2 : 1;

  const panel = (side, team) => {
    const s = ch.sides?.[side] || {};
    const turn = s.turn || 'w';
    const won = reveal?.winner === side;
    const lost = reveal && reveal.winner !== side;
    return (
      <div style={{
        flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', gap: 8,
        padding: '10px 12px', borderRadius: 16,
        background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
        borderTop: `4px solid ${team.color}`,
        opacity: lost ? 0.7 : 1, transition: 'opacity 200ms ease',
      }}>
        {/* En-tête : équipe + « MAT EN N » + trait */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <TeamAvatar team={team} size={26} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: team.color }}>{team.name}</span>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 13, color: '#3a2c1a',
            background: '#f3c969', borderRadius: 999, padding: '2px 10px',
          }}>
            {mateIn === 2 ? T('fight.chess.mateIn2') : T('fight.chess.mateIn1')}
          </span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
            {turn === 'w' ? T('fight.chess.whiteToMove') : T('fight.chess.blackToMove')}
          </span>
        </div>

        {/* Bandeau d'état par-dessus l'échiquier */}
        {(s.solved || s.locked || won) && (
          <div style={{ position: 'absolute', top: 44, left: 0, right: 0, zIndex: 4, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 18, padding: '6px 18px', borderRadius: 999,
              color: s.locked && !s.solved ? '#fff' : '#25301a',
              background: s.locked && !s.solved ? 'rgba(201,71,47,0.95)' : 'rgba(155,230,127,0.97)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
            }}>
              {s.solved || won ? T('fight.chess.win') : T('fight.chess.wrong')}
            </span>
          </div>
        )}

        {/* Échiquier LECTURE SEULE, orienté au camp */}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center' }}>
          <ChessBoard
            fen={s.fen}
            orientation={turn}
            interactive={false}
            locked={s.locked || s.solved}
            shakeSeq={s.shakeSeq || 0}
            lastMove={s.lastMove || null}
          />
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: 14, minHeight: 0 }}>
      {/* Bandeau : manche (LCD vert) + rappel téléphones */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '7px 18px', borderRadius: 12,
        background: 'linear-gradient(180deg, #463e30 0%, #2a2317 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.4)',
      }}>
        <span style={{
          fontFamily: "'VT323', monospace", fontSize: 22, letterSpacing: 1, whiteSpace: 'nowrap',
          color: '#7dffa5', textShadow: '0 0 7px rgba(125,255,165,0.5)',
        }}>
          {'♞'} {T('fight.chess.round', { n: ch.roundNo || 1 })}
        </span>
        <span style={{
          flex: 1, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 20, color: '#f3c969',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {mateIn === 2 ? T('fight.chess.mateIn2') : T('fight.chess.mateIn1')}
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>
          {'\u{1F4F1}'} {T('fight.chess.phonesHint')}
        </span>
      </div>

      {/* Les deux échiquiers, côte à côte */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
        {panel('attacker', attacker)}
        {panel('defender', defender)}
      </div>
    </div>
  );
}
