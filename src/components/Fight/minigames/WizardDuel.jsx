import { useGameStore } from '../../../store/gameStore';
import WizardBeam from './WizardBeam.jsx';
import SpellHeroTrack from './SpellHeroTrack.jsx';
import TeamAvatar from '../../TeamAvatar';
import { useT } from '../../../i18n';

/**
 * Duel de SORTS (rythme) — vue ÉCRAN PARTAGÉ (tactile). Les DEUX équipes jouent la
 * MÊME partition côte-à-côte : en haut le rai partagé (WizardBeam, poussé par l'écart
 * de score) ; en bas deux pistes « Guitar Hero » (SpellHeroTrack), une par camp. Le
 * store (wizardFightHandlers) est l'AUTORITÉ : chaque tap appelle wizardHit(side, …),
 * l'hôte valide le bon sort (clé secrète), convertit le timing en points et tranche.
 *
 * Reste l'ENGINES Component `wizard` (satisfait isPlayable + réutilisé par
 * WizardDuelStage pour la surface tactile). Les surfaces distantes rendent une SEULE
 * piste par appareil (WizardDuelView).
 */
export default function WizardDuel({ attacker, defender }) {
  const T = useT();
  const wz = useGameStore((s) => s.showFight?.wizard);
  const wizardHit = useGameStore((s) => s.wizardHit);
  if (!wz) return null;

  const winnerTeam = wz.winner === 'attacker' ? attacker : wz.winner === 'defender' ? defender : null;

  const sideHeader = (team) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '2px 0' }}>
      <TeamAvatar team={team} size={24} />
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: team.color }}>{team.name}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 0 }}>
      {/* La scène du duel EN GRAND : salle de Poudlard derrière les duellistes,
          rai partagé penché selon l'écart de score */}
      <div style={{ flex: '0 0 48%', minHeight: 180, position: 'relative' }}>
        <WizardBeam attacker={attacker} defender={defender} pos={wz.pos} push={wz.push || null} hit={wz.hit || null} />
        {winnerTeam && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 30, padding: '10px 28px', borderRadius: 999,
              color: '#25301a', background: 'rgba(155,230,127,0.97)', boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
            }}>
              {winnerTeam.name} 🏆
            </span>
          </div>
        )}
      </div>

      {/* Les deux pistes de sorts (une par camp) */}
      <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sideHeader(attacker)}
          <div style={{ flex: 1, minHeight: 0 }}>
            <SpellHeroTrack wizard={wz} mySide="attacker" me={attacker}
              onHit={(noteId, spellIndex, dt) => wizardHit('attacker', noteId, spellIndex, dt)} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sideHeader(defender)}
          <div style={{ flex: 1, minHeight: 0 }}>
            <SpellHeroTrack wizard={wz} mySide="defender" me={defender}
              onHit={(noteId, spellIndex, dt) => wizardHit('defender', noteId, spellIndex, dt)} />
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font-ui)' }}>
        {T('fight.wizard.hint')}
      </div>
    </div>
  );
}
