// Duel de SORTS (rythme) — écran du DUELLISTE sur les surfaces distantes : téléphone
// (mode « écran + téléphones ») et client en ligne (+ fenêtre de l'hôte-joueur en
// ligne, via WizardDuelStage). Présentationnel : reçoit le bloc `fight` (payload
// turn.fight, avec `wizard`) + `myTeamIdx` et des callbacks (envoi d'intents). Aucune
// logique de partie : l'hôte (store) est l'autorité — je tape un sort, j'émets
// { noteId, spellIndex, dt } (timing jugé EN LOCAL par la piste), l'hôte valide le
// bon sort (clé secrète) + convertit en points. Les DEUX camps jouent la MÊME
// partition (rai PARTAGÉ, pos unique = écart de score).
//
// Contrat lu (fight.wizard) : { chart, songStartAt, scores, combos, pos, last, push,
//   hit, winner }. mySide déduit comme ChessDuelView (attacker si myTeamIdx===attackerIndex).
import TeamAvatar from '../TeamAvatar';
import WizardBeam from './minigames/WizardBeam';
import SpellHeroTrack from './minigames/SpellHeroTrack';
import { useT } from '../../i18n';

const wrap = {
  position: 'fixed', inset: 0, zIndex: 340, display: 'flex', flexDirection: 'column',
  background: 'rgba(9,6,18,0.96)', fontFamily: 'var(--font-ui)', color: '#eee6ff',
  padding: 14, gap: 10, pointerEvents: 'auto',
};

function btn(bg, color = '#06210f') {
  return {
    cursor: 'pointer', padding: '11px 14px', borderRadius: 10, border: '2px solid #05070a',
    background: bg, color, fontWeight: 700, fontFamily: 'var(--font-ui)', fontSize: 15,
  };
}

export default function WizardDuelView({ fight, teams = [], myTeamIdx, onHit, onReward, onClose }) {
  const T = useT();
  const wz = fight?.wizard;
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
  if (!wz || !mySide) {
    return <div style={{ ...wrap, justifyContent: 'center', alignItems: 'center' }}><div style={{ color: '#8b9096' }}>…</div></div>;
  }

  const me = mySide === 'attacker' ? att : def;
  const winner = wz.winner || null;
  const iWon = winner === mySide;

  return (
    <div style={wrap}>
      {/* En-tête : moi + rappel de l'enjeu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: '2px 0' }}>
        <TeamAvatar team={me} size={26} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: me.color }}>{me.name}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{T('fight.mg.wizard.name')}</span>
      </div>

      {/* Le duel en grand : salle de Poudlard derrière les duellistes, orbe qui
          glisse selon l'écart de score */}
      <div style={{ flex: '0 0 42%', minHeight: 150 }}>
        <WizardBeam attacker={att} defender={def} pos={typeof wz.pos === 'number' ? wz.pos : 50} push={wz.push || null} hit={wz.hit || null} compact />
      </div>

      {/* Bandeau d'état : fin / consigne */}
      <div style={{ minHeight: 20, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 16 }}>
        {winner
          ? (iWon
            ? <span style={{ color: '#9be67f' }}>✨ {T('fight.wizard.youWin')}</span>
            : <span style={{ color: '#ff8a7a' }}>💥 {T('fight.wizard.youLose')}</span>)
          : <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'var(--font-ui)' }}>{T('fight.wizard.hint')}</span>}
      </div>

      {/* Ma piste de sorts (jugement du timing EN LOCAL → intent turnWizardHit) */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <SpellHeroTrack wizard={wz} mySide={mySide} me={me} onHit={onHit} compact />
      </div>
    </div>
  );
}
