import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import TeamAvatar from '../TeamAvatar';
import { FIGHT_ROUNDS_TO_WIN } from '../../store/fightHandlers';
import { WtpStage, useWtpIntro } from './minigames/WhosThatPokemon';
import { stopWtpJingle, soundReveal } from '../../logic/sounds';
import { useT } from '../../i18n';

// Compte à rebours local sur la deadline publiée (même mécanique que
// DuelRaceView) ; null quand la manche est figée (révélation).
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
  return deadline ? left : null;
}

/**
 * « Qui est ce Pokémon ?! » — scène TV du duel MULTI-SURFACE (mode « écran +
 * téléphones-manettes »). L'écran partagé n'affiche QUE le plateau (silhouette,
 * intro pokéball, révélation, jingle) + les scores : les deux duellistes
 * répondent sur leur téléphone (DuelRaceView monté par MobileApp, intents
 * turnFightAnswer → submitFightAnswer). Le store est l'autorité (fight.race).
 */
export default function WtpDuelStage({ fight, attacker, defender }) {
  const T = useT();
  const race = fight.race;
  const q = race?.q || null;
  const reveal = race?.reveal || null;
  // Sons d'intro (lancer de pokéball puis jingle) gérés par le hook.
  const intro = useWtpIntro(q?.img, !!reveal);
  const left = useCountdown(race?.deadline);

  // Révélation : jingle coupé, le sting « C'est … ! » prend le relais.
  // Démontage = silence.
  useEffect(() => {
    if (reveal) { stopWtpJingle(); soundReveal(); }
  }, [!!reveal]);
  useEffect(() => () => stopWtpJingle(), []);

  const scoreChip = (team, wins, answered) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <TeamAvatar team={team} size={34} />
      <span style={{ fontFamily: 'var(--font-display)', color: '#fff', fontSize: 16 }}>{team.name}</span>
      <span style={{ display: 'inline-flex', gap: 4 }}>
        {Array.from({ length: FIGHT_ROUNDS_TO_WIN }, (_, i) => (
          <span key={i} style={{ fontSize: 18, filter: i < wins ? 'none' : 'grayscale(1) opacity(0.35)' }}>⭐</span>
        ))}
      </span>
      {answered && !reveal && <span style={{ fontSize: 14, color: '#9be67f' }}>✓</span>}
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 14, gap: 10, minHeight: 0 }}>
      {/* Header scores (miroir de MinigameStage) + chrono de la manche */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 18px', borderRadius: 14,
          background: 'rgba(255,254,251,0.12)',
          border: '1px solid rgba(243,201,105,0.35)',
        }}
      >
        {scoreChip(attacker, fight.wins.attacker, !!race?.answers?.attacker)}
        <div
          style={{
            fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--gold-400, #f3c969)',
            padding: '4px 14px', borderRadius: 999, border: '1px solid rgba(243,201,105,0.5)',
          }}
        >
          {T('fight.round', { n: fight.round })}{left != null ? ` · ⏱️ ${left}s` : ''}
        </div>
        {scoreChip(defender, fight.wins.defender, !!race?.answers?.defender)}
      </div>

      {/* Plateau TV plein cadre */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'stretch' }}>
        {q ? (
          <WtpStage
            img={q.img}
            intro={intro}
            revealed={!!reveal}
            revealLabel={reveal ? `${T('fight.wtp.its')} ${q.a[reveal.c]} !` : null}
          />
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--font-display)' }}>
            …
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        {T('fight.wtp.phonesHint')}
      </div>
    </div>
  );
}
