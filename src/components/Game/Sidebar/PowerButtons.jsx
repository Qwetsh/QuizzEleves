import { useGameStore } from '../../../store/gameStore';
import { getAvailablePowers, canUsePowerInContext } from '../../../logic/powerActivator';
import { relanceSwapInfo, shieldImmunityInfo, clairvoyanceInfo, foudreBanishInfo, sablierBrokenInfo } from '../../../store/powerHandlers';
import { POWERS } from '../../../data/powers';
import { useT } from '../../../i18n';
import { locName } from '../../../i18n/content';
import '../../../styles/power-cast.css';

export default function PowerButtons() {
  const T = useT();
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const usePower = useGameStore((s) => s.usePower);
  const confirmLanding = useGameStore((s) => s.confirmLanding);
  const rolling = useGameStore((s) => s.rolling);
  const finished = useGameStore((s) => s.finished);
  const diceValue = useGameStore((s) => s.diceValue);
  const showQuestion = useGameStore((s) => s.showQuestion);
  const showEvent = useGameStore((s) => s.showEvent);
  const awaitingChoice = useGameStore((s) => s.awaitingChoice);
  const pendingLanding = useGameStore((s) => s.pendingLanding);
  const showChargePicker = useGameStore((s) => s.showChargePicker);
  const showTargetPicker = useGameStore((s) => s.showTargetPicker);

  const team = teams[currentTeam];
  if (!team?.powers) return null;

  const ctx = { diceValue, showQuestion, rolling, showEvent, awaitingChoice, finished, pendingLanding };

  // Blocage des pouvoirs (objet/effet adverse) : aucun bouton de cast ce tour-ci.
  const powersBlocked = (team.powersBlockedTurns ?? 0) > 0;

  // Pouvoirs OFFENSIFS utilisables MAINTENANT (fenetre de cast).
  // Le Bouclier (passif) et l'Indice (reserve aux questions) ne s'affichent pas ici ;
  // la Relance a son propre bouton sous le de.
  const castable = powersBlocked ? [] : getAvailablePowers(team).filter(
    (p) => p.category === 'off' && canUsePowerInContext(p.key, ctx)
  );

  // Show "Continuer" when waiting for player action after dice roll
  const showContinue = pendingLanding && !rolling && !showChargePicker && !showTargetPicker && !showQuestion && !showEvent;

  // Ultime « Échange de place » (Relance L10) : bouton actif, dispo à son tour hors
  // modale/lancer, si l'équipe a la voie et assez de charges, et qu'un leader existe.
  const swap = relanceSwapInfo(useGameStore.getState, currentTeam);
  const showSwap = swap?.canUse && !powersBlocked && !rolling && !showQuestion && !showEvent && !showChargePicker && !showTargetPicker && !finished;
  const relColor = POWERS.relance?.color || '#8745d4';
  // Ultime « Immunité totale » (Bouclier L10) : bouton actif, mêmes conditions de fenêtre.
  const immune = shieldImmunityInfo(useGameStore.getState, currentTeam);
  const showImmune = immune?.canUse && !powersBlocked && (team.totalImmuneTurns ?? 0) <= 0 && !rolling && !showQuestion && !showEvent && !showChargePicker && !showTargetPicker && !finished;
  const shieldColor = POWERS.bouclier?.color || '#3b6cb3';
  // Ultime « Clairvoyance » (Indice L10) : actif PENDANT une question (révèle la
  // bonne réponse de tout le tour). Dispo si voie + 5 charges et pas déjà actif.
  const clair = clairvoyanceInfo(useGameStore.getState, currentTeam);
  const showClair = clair?.canUse && !powersBlocked && !!showQuestion && !team.clairvoyanceTurn && !finished;
  const indiceColor = POWERS.indice?.color || '#e8b117';
  // Ultimes offensifs actifs (5 charges) : mêmes conditions de fenêtre que les
  // autres offensifs (à son tour, hors question/lancer/picker).
  const offWindow = !powersBlocked && !rolling && !showQuestion && !showEvent && !showChargePicker && !showTargetPicker && !finished;
  const banish = foudreBanishInfo(useGameStore.getState, currentTeam);
  const showBanish = banish?.canUse && offWindow;
  const foudreColor = POWERS.foudre?.color || '#e85d6b';
  const broken = sablierBrokenInfo(useGameStore.getState, currentTeam);
  const showBroken = broken?.canUse && offWindow;
  const sablierColor = POWERS.sablier?.color || '#a83e7f';

  return (
    <div className="flex flex-col items-center gap-3 mt-3">
      {showSwap && (
        <button onClick={() => useGameStore.getState().useRelanceSwap()}
          className="power-cast-btn" style={{ '--cast-color': relColor }}
          title={T('game.relanceSwapHint', { cost: swap.cost })}>
          <span className="power-cast-disc">
            <span className="power-cast-icon">🔄</span>
            <span className="power-cast-count">{swap.cost}</span>
          </span>
          <span className="power-cast-name">{T('game.relanceSwap')}</span>
        </button>
      )}
      {showImmune && (
        <button onClick={() => useGameStore.getState().useShieldImmunity()}
          className="power-cast-btn" style={{ '--cast-color': shieldColor }}
          title={T('game.shieldImmunityHint', { cost: immune.cost, turns: immune.turns })}>
          <span className="power-cast-disc">
            <span className="power-cast-icon">🛡️</span>
            <span className="power-cast-count">{immune.cost}</span>
          </span>
          <span className="power-cast-name">{T('game.shieldImmunity')}</span>
        </button>
      )}
      {showBanish && (
        <button onClick={() => useGameStore.getState().openFoudreBanish()}
          className="power-cast-btn" style={{ '--cast-color': foudreColor }}
          title={T('game.foudreBanishHint', { cost: banish.cost })}>
          <span className="power-cast-disc">
            <span className="power-cast-icon">⏮️</span>
            <span className="power-cast-count">{banish.cost}</span>
          </span>
          <span className="power-cast-name">{T('game.foudreBanish')}</span>
        </button>
      )}
      {showBroken && (
        <button onClick={() => useGameStore.getState().useSablierBroken()}
          className="power-cast-btn" style={{ '--cast-color': sablierColor }}
          title={T('game.sablierBrokenHint', { cost: broken.cost, floor: broken.floor })}>
          <span className="power-cast-disc">
            <span className="power-cast-icon">⏱️</span>
            <span className="power-cast-count">{broken.cost}</span>
          </span>
          <span className="power-cast-name">{T('game.sablierBroken')}</span>
        </button>
      )}
      {showClair && (
        <button onClick={() => useGameStore.getState().useClairvoyance()}
          className="power-cast-btn" style={{ '--cast-color': indiceColor }}
          title={T('game.clairvoyanceHint', { cost: clair.cost })}>
          <span className="power-cast-disc">
            <span className="power-cast-icon">🔮</span>
            <span className="power-cast-count">{clair.cost}</span>
          </span>
          <span className="power-cast-name">{T('game.clairvoyance')}</span>
        </button>
      )}
      {castable.length > 0 && (
        <div className="power-cast-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', width: '100%' }}>
          {castable.map((p) => {
            const { key, icon, charges, color } = p;
            const name = locName(p);
            return (
            <button
              key={key}
              onClick={() => usePower(key)}
              className="power-cast-btn"
              style={{ '--cast-color': color }}
              title={T('game.powerCharges', { name, charges: `${charges} ${T.plural('game.charge', charges)}` })}
            >
              <span className="power-cast-disc">
                <span className="power-cast-icon">{icon}</span>
                <span className="power-cast-count">{charges}</span>
              </span>
              <span className="power-cast-name">{name}</span>
            </button>
            );
          })}
        </div>
      )}

      {showContinue && (
        <button
          onClick={confirmLanding}
          style={{
            padding: '10px 28px',
            borderRadius: 14,
            background: 'linear-gradient(180deg, var(--gold-400), var(--gold-600))',
            border: 'none',
            color: '#fff',
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -3px 0 rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.15)',
            animation: 'btn-pulse 2s ease-in-out infinite',
            transition: 'all 100ms ease',
          }}
        >
          {T('common.continue')}
        </button>
      )}
    </div>
  );
}
