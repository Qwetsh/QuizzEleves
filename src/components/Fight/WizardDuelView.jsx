// Duel de sorciers (« Priori Incantatem ») — écran du DUELLISTE sur les surfaces
// distantes : téléphone (mode « écran + téléphones ») et client en ligne (+
// fenêtre de l'hôte-joueur en ligne, via WizardDuelStage). Présentationnel :
// reçoit le bloc `fight` (payload turn.fight, avec `wizard`) + `myTeamIdx` et des
// callbacks (envoi d'intents). Aucune logique de partie : l'hôte (store) est
// l'autorité — je touche une réponse, j'envoie son index, l'hôte tranche
// (justesse / vitesse / poussée / K.O.). Les DEUX camps répondent à la MÊME
// question ; le rai est PARTAGÉ (pos unique).
//
// Contrat lu (fight.wizard) :
//   { pos, q:{ question, a:[...] }, locked:{ attacker, defender },
//     push:{ side, seq }|null, hit:{ side, seq }|null,
//     winner:'attacker'|'defender'|null }
// mySide déduit comme ChessDuelView (attacker si myTeamIdx===attackerIndex).
import TeamAvatar from '../TeamAvatar';
import WizardBeam from './minigames/WizardBeam';
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

export default function WizardDuelView({ fight, teams = [], myTeamIdx, onAnswer, onReward, onClose }) {
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
  const pos = typeof wz.pos === 'number' ? wz.pos : 50;
  const q = wz.q || null;
  const locked = !!(wz.locked && wz.locked[mySide]);
  const winner = wz.winner || null;
  const iWon = winner === mySide;
  const over = !!winner;
  // Interactif tant que le duel n'est pas fini ET que ma baguette n'est pas enrayée.
  const canAnswer = !!q && !locked && !over;

  return (
    <div style={wrap}>
      {/* En-tête : moi + rappel de l'enjeu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: '4px 0' }}>
        <TeamAvatar team={me} size={26} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: me.color }}>{me.name}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
          {T('fight.mg.wizard.name')}
        </span>
      </div>

      {/* Le rai partagé, en réduit : je vois l'orbe glisser + les poussées / le K.O. */}
      <div style={{ height: 150, minHeight: 150 }}>
        <WizardBeam attacker={att} defender={def} pos={pos} push={wz.push || null} hit={wz.hit || null} compact />
      </div>

      {/* Bandeau d'état : fin / baguette enrayée / consigne */}
      <div style={{ minHeight: 22, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 16 }}>
        {over
          ? (iWon
            ? <span style={{ color: '#9be67f' }}>✨ {T('fight.wizard.youWin')}</span>
            : <span style={{ color: '#ff8a7a' }}>💥 {T('fight.wizard.youLose')}</span>)
          : locked
            ? <span style={{ color: '#ff8a7a' }}>⚡ {T('fight.wizard.locked')}</span>
            : <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'var(--font-ui)' }}>{T('fight.wizard.hint')}</span>}
      </div>

      {/* Question partagée + 4 réponses (PointerEvents → intent turnWizardAnswer) */}
      {q ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: canAnswer ? 1 : 0.55 }}>
          <div style={{
            textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 18, lineHeight: 1.25,
            padding: '2px 6px', color: '#f4ecff',
          }}>
            {q.question}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {(q.a || []).map((ans, i) => (
              <button
                key={i}
                onPointerDown={(e) => { if (!canAnswer) return; e.preventDefault(); onAnswer && onAnswer(i); }}
                disabled={!canAnswer}
                style={{
                  ...btn(canAnswer ? `linear-gradient(180deg, ${me.color}, ${me.color}cc)` : '#2a2438', '#fff'),
                  cursor: canAnswer ? 'pointer' : 'default', textAlign: 'left',
                  border: `2px solid ${canAnswer ? '#05070a' : '#3a3350'}`,
                  touchAction: 'manipulation',
                }}
              >
                {ans}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 13, color: '#8b9096', padding: 12 }}>
          {over ? '…' : T('fight.wizard.waitNext')}
        </div>
      )}
    </div>
  );
}
