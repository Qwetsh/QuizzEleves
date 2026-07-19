// « Duel éclair » — UI partagée d'un duel en ligne, pour UN duelliste.
// Présentationnel : reçoit le bloc `fight` (payload) + `myTeamIdx` et des
// callbacks (qui envoient les intents ou appellent le store). Aucune logique de
// jeu. Utilisé côté client online (participant) et côté hôte (équipe locale).
import { useEffect, useState } from 'react';
import TeamAvatar from '../TeamAvatar';

function useCountdown(deadline) {
  const calc = () => (deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    if (!deadline) return undefined;
    setLeft(calc());
    const iv = setInterval(() => setLeft(calc()), 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);
  return left;
}

const wrap = {
  position: 'fixed', inset: 0, zIndex: 340, display: 'grid', placeItems: 'center',
  background: 'rgba(6,9,12,0.9)', fontFamily: 'var(--font-ui)', color: '#eafff0', padding: 16,
  // Rendue depuis FightModal (fenêtre hôte), la vue vit SOUS le rg-root inerte
  // du mode en ligne : on ré-active explicitement les clics du duelliste.
  pointerEvents: 'auto',
};
const card = {
  width: 560, maxWidth: '96vw', background: '#0f1419', border: '2px solid #16351f', borderRadius: 16,
  padding: '20px 22px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
};

export default function DuelRaceView({ fight, teams = [], myTeamIdx, onBegin, onAnswer, onReward, onClose }) {
  const race = fight.race;
  const left = useCountdown(race?.deadline);
  const mySide = myTeamIdx === fight.attackerIndex ? 'attacker' : myTeamIdx === fight.defenderIndex ? 'defender' : null;
  const answered = !!(mySide && race?.answered?.[mySide]);
  const isWinner = fight.winnerIndex != null && fight.winnerIndex === myTeamIdx;
  // Duel silhouette (« Qui est ce Pokémon ?! ») : l'image est masquée en noir
  // jusqu'à la révélation (fight.wtp = clé du pool, race.reveal = bonne réponse).
  const wtp = !!fight.wtp;
  const reveal = race?.reveal || null;

  const att = teams[fight.attackerIndex] || { emoji: '🅰️', name: 'Attaquant' };
  const def = fight.defenderIndex === -1 ? (fight.boss ? { emoji: '👨‍🏫', name: 'Le Prof' } : { emoji: '🅱️', name: '?' })
    : (teams[fight.defenderIndex] || { emoji: '🅱️', name: 'Défenseur' });

  const header = (
    <div style={{ fontSize: 18, marginBottom: 10 }}>
      <span style={{ color: '#66ff8a' }}>⚔️ DUEL ÉCLAIR</span>
      {fight.wins && <span style={{ color: '#8b9096', marginLeft: 10, fontSize: 14 }}>{fight.wins.attacker}–{fight.wins.defender}</span>}
    </div>
  );
  const versus = (
    <div style={{ fontSize: 20, margin: '8px 0 16px', display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      <TeamAvatar team={att} size={24} /> {att.name} <span style={{ color: '#8b9096' }}>vs</span> <TeamAvatar team={def} size={24} /> {def.name}
    </div>
  );

  return (
    <div style={wrap}>
      <div style={card}>
        {header}

        {(fight.phase === 'versus' || fight.phase === 'briefing') && (
          <>
            {versus}
            {mySide === 'attacker'
              ? <button onClick={onBegin} style={btn('#2fb551')}>⚔️ Commencer le duel</button>
              : <div style={{ color: '#8b9096' }}>En attente du lancement…</div>}
          </>
        )}

        {fight.phase === 'minigame' && (
          <>
            {versus}
            {!race ? (
              <div style={{ color: '#8b9096' }}>Préparation de la question…</div>
            ) : (
              <>
                {!reveal && <div style={{ fontSize: 13, color: left <= 5 ? '#ff8a7a' : '#8b9096', marginBottom: 6 }}>⏱️ {left}s</div>}
                <div style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 14px' }}>{race.q?.q}</div>
                {/* Image de la question (silhouette masquée en noir jusqu'à la
                    révélation — mini plateau TV ; drapeau etc. affiché net). */}
                {race.q?.img && (
                  <div style={{
                    position: 'relative', display: 'grid', placeItems: 'center', height: 170,
                    borderRadius: 12, overflow: 'hidden', margin: '2px 0 12px',
                    background: wtp
                      ? 'repeating-conic-gradient(from 0deg at 50% 50%, #e8402c 0deg 12deg, #c92315 12deg 24deg)'
                      : 'rgba(255,255,255,0.06)',
                  }}>
                    {wtp && (
                      <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, #fff 34%, #cfe4ff 55%, rgba(207,228,255,0) 72%)' }} />
                    )}
                    <img
                      src={race.q.img} alt="" draggable={false}
                      style={{
                        position: 'relative', maxHeight: 140, maxWidth: '72%', objectFit: 'contain',
                        filter: wtp && !reveal ? 'brightness(0)' : 'brightness(1)',
                        transform: wtp && reveal ? 'scale(1.06)' : 'scale(1)',
                        transition: 'filter 0.5s ease, transform 0.45s cubic-bezier(.2,1.4,.4,1)',
                        userSelect: 'none', pointerEvents: 'none',
                      }}
                    />
                  </div>
                )}
                {reveal && (
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#ffcb05', marginBottom: 12 }}>
                    C'est… {race.q?.a?.[reveal.c]} !
                  </div>
                )}
                {mySide && !answered && !reveal ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {(race.q?.a || []).map((a, i) => (
                      <button key={i} onClick={() => onAnswer(i)} style={btn('#16351f', '#eafff0')}>{a}</button>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#66ff8a' }}>
                    {reveal ? (reveal.winner ? `🏆 ${(reveal.winner === 'attacker' ? att : def).name} remporte la manche !` : '❌ Personne n\'a trouvé…')
                      : answered ? '✅ Réponse envoyée — en attente…' : '👁️ Duel en cours…'}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {fight.phase === 'reward' && (
          isWinner && !fight.rewardChosen ? (
            <>
              <div style={{ fontSize: 20, margin: '6px 0 14px' }}>🏆 Tu as gagné le duel ! Choisis ta récompense :</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <button onClick={() => onReward('steal')} style={btn('#caa23a', '#1a1405')}>💰 Voler de l’or (2 dés)</button>
                <button onClick={() => onReward('knockback')} style={btn('#c9472f')}>💥 Faire reculer (1 dé)</button>
                <button onClick={() => onReward('loot')} style={btn('#5a2f8e')}>🎁 Voler un objet</button>
              </div>
            </>
          ) : (
            <div style={{ color: '#8b9096', fontSize: 18 }}>
              {isWinner ? 'Récompense en cours…' : `${(teams[fight.winnerIndex] || {}).name || 'L’adversaire'} a gagné le duel…`}
            </div>
          )
        )}

        {fight.phase === 'result' && (
          <>
            <div style={{ fontSize: 17, margin: '6px 0 14px' }}>{fight.resultMessage}</div>
            <button onClick={onClose} style={btn('#2fb551')}>Retour au plateau</button>
          </>
        )}
      </div>
    </div>
  );
}

function btn(bg, color = '#06210f') {
  return {
    cursor: 'pointer', padding: '11px 14px', borderRadius: 10, border: '2px solid #05070a',
    background: bg, color, fontWeight: 700, fontFamily: 'var(--font-ui)', fontSize: 15,
  };
}
