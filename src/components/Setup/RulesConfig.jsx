// Règles de partie (Setup). Pour l'instant : duels forcés on/off.
//  - OFF (défaut) : l'équipe qui arrive sur une case occupée CHOISIT de défier
//    (et qui) ou de jouer la case normalement.
//  - ON : duel automatique avec l'adversaire présent (comportement historique).
import { useGameStore } from '../../store/gameStore';

export default function RulesConfig() {
  const forcedDuels = useGameStore((s) => s.forcedDuels);
  const setForcedDuels = useGameStore((s) => s.setForcedDuels);

  return (
    <div>
      <div className="field-label" style={{ marginBottom: 8 }}>⚔️ Règles de duel</div>
      <div
        onClick={() => setForcedDuels(!forcedDuels)}
        className="flex items-start gap-2.5 cursor-pointer select-none"
        style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${forcedDuels ? 'var(--gold-600)' : 'rgba(122,94,58,0.18)'}`, background: forcedDuels ? 'rgba(232,169,88,0.08)' : 'transparent' }}
      >
        <div
          style={{
            width: 20, height: 20, borderRadius: 6,
            background: forcedDuels ? 'var(--gold-600)' : '#fffefb',
            border: `2px solid ${forcedDuels ? 'var(--gold-700)' : 'var(--ink-400)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, flexShrink: 0, marginTop: 1,
          }}
        >
          {forcedDuels ? '✓' : ''}
        </div>
        <div className="min-w-0">
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Duels forcés</div>
          <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.35, marginTop: 2 }}>
            {forcedDuels
              ? 'Activé : duel automatique dès qu’une équipe en rejoint une autre.'
              : 'Désactivé : l’équipe qui arrive choisit de défier (et qui) ou de jouer la case.'}
          </div>
        </div>
      </div>
    </div>
  );
}
