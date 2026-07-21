// Police « LCD » du bandeau TV rétro (auto-hébergée, comme l'écran cassettes).
import '@fontsource/vt323/400.css';
import { useGameStore } from '../../store/gameStore';
import { onlineToken } from '../../logic/sessionConfig';
import WizardBeam from './minigames/WizardBeam';
import WizardDuel from './minigames/WizardDuel';
import WizardDuelView from './WizardDuelView';
import { useT } from '../../i18n';

/**
 * Duel de SORTS (rythme) piloté par le STORE — rendu dans FightModal (phase minigame,
 * showFight.wizard) sur les TROIS surfaces :
 * - ÉCRAN PARTAGÉ (tactile) → les DEUX équipes jouent côte-à-côte ici (WizardDuel,
 *   deux pistes « Guitar Hero ») ;
 * - HÔTE EN LIGNE dont l'équipe est duelliste → il joue SA piste (WizardDuelView
 *   branché sur wizardHit) ;
 * - sinon (TV du mode « écran + téléphones », miroir en ligne, hôte non-duelliste)
 *   → vue SPECTATEUR : le rai partagé + le tableau des scores dans la TV CRT rétro,
 *   « Jouez sur vos appareils ! ». Les DEUX camps jouent la MÊME partition, rai PARTAGÉ.
 */
export default function WizardDuelStage({ fight, attacker, defender }) {
  const T = useT();
  const teams = useGameStore((s) => s.teams);
  const mirror = useGameStore((s) => !!s._mirror);
  const online = useGameStore((s) => s.connectionMode === 'online');
  const phoneController = useGameStore((s) => s.phoneController);
  const sessionCode = useGameStore((s) => s.sessionCode);
  const wizardHit = useGameStore((s) => s.wizardHit);

  const wz = fight.wizard;
  if (!wz) return null;

  // Hôte en ligne = joueur : si SON équipe est un des duellistes, il joue ici
  // (même résolution de jeton que ChessDuelStage / HackDuelStage).
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
      <WizardDuelView
        fight={{ ...fight, wizard: wz, winnerIndex: null }}
        teams={teams}
        myTeamIdx={myTeamIdx}
        onHit={(noteId, spellIndex, dt) => wizardHit && wizardHit(hostSide, noteId, spellIndex, dt)}
        onReward={() => {}}
        onClose={() => {}}
      />
    );
  }

  // Écran partagé (tactile) : les deux équipes jouent sur le même écran.
  if (!online && !phoneController) {
    return <WizardDuel attacker={attacker} defender={defender} />;
  }

  // --- Vue spectateur (TV « écran + téléphones » / miroir en ligne) : le rai partagé
  // en grand + le tableau des scores, « Jouez sur vos appareils ! ».
  const pos = typeof wz.pos === 'number' ? wz.pos : 50;
  const winner = wz.winner || null;
  const winTeam = winner === 'attacker' ? attacker : winner === 'defender' ? defender : null;
  const sc = wz.scores || { attacker: 0, defender: 0 };

  const scoreCard = (team, side) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 12,
      background: `linear-gradient(180deg, ${team.color}2e, ${team.color}12)`,
      border: `1px solid ${team.color}55`,
    }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: team.color }}>{team.name}</span>
      <span style={{ fontFamily: "'VT323', monospace", fontSize: 30, color: '#f4ecff', textShadow: '0 0 8px rgba(201,165,255,0.5)' }}>
        {sc[side] || 0}
      </span>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: 14, minHeight: 0 }}>
      {/* Bandeau : titre (LCD violet) + rappel appareils */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '7px 18px', borderRadius: 12,
        background: 'linear-gradient(180deg, #2a1e46 0%, #170f2a 100%)',
        boxShadow: 'inset 0 1px 0 rgba(190,160,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.4)',
      }}>
        <span style={{
          fontFamily: "'VT323', monospace", fontSize: 22, letterSpacing: 1, whiteSpace: 'nowrap',
          color: '#c9a5ff', textShadow: '0 0 7px rgba(201,165,255,0.5)',
        }}>
          {'✦'} {T('fight.mg.wizard.name')}
        </span>
        <span style={{
          flex: 1, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 18, color: '#e6d6ff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {T('fight.mg.wizard.goal')}
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'rgba(225,210,255,0.6)', whiteSpace: 'nowrap' }}>
          {'\u{1F4F1}'} {T('fight.wizard.phonesHint')}
        </span>
      </div>

      {/* La scène en grand : le rai partagé (incrusté dans un cadre CRT rétro) */}
      <div style={{
        flex: 1, minHeight: 0, position: 'relative', borderRadius: 16, overflow: 'hidden',
        padding: 10, background: 'linear-gradient(180deg, #1a1230, #0c0818)',
        border: '3px solid rgba(120,90,180,0.4)',
        boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.5)',
      }}>
        <WizardBeam attacker={attacker} defender={defender} pos={pos} push={wz.push || null} hit={wz.hit || null} />
        {winTeam && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 30, padding: '10px 28px', borderRadius: 999,
              color: '#25301a', background: 'rgba(155,230,127,0.97)', boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
            }}>
              {winTeam.name} 🏆
            </span>
          </div>
        )}
      </div>

      {/* Tableau des scores + « Jouez sur vos appareils ! » */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,
        padding: '10px 14px', borderRadius: 12,
        background: 'linear-gradient(180deg, rgba(40,30,70,0.6), rgba(20,14,40,0.6))',
        border: '1px solid rgba(140,110,200,0.25)',
      }}>
        {scoreCard(attacker, 'attacker')}
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: '#c9a5ff' }}>{'\u{1F4F1}'} {T('fight.wizard.phonesHint')}</span>
        {scoreCard(defender, 'defender')}
      </div>
    </div>
  );
}
