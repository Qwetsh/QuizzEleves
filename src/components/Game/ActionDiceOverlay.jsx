import { useGameStore } from '../../store/gameStore';
import Dice3D from './Dice3D';

// Petit overlay : lancer de d6 « d'objet » (table de résultats d'un consommable).
export default function ActionDiceOverlay() {
  const showActionDice = useGameStore((s) => s.showActionDice);
  if (!showActionDice) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 240, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 45%, rgba(20,12,4,0.55), rgba(10,6,2,0.78))',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 18, color: '#f3c969',
        marginBottom: 18, letterSpacing: '0.06em', textShadow: '0 2px 8px rgba(0,0,0,0.6)',
      }}>
        {showActionDice.rolling ? "L'objet lance le dé…" : "Résultat !"}
      </div>
      <div style={{ filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.6))' }}>
        <Dice3D value={showActionDice.value || 1} rolling={!!showActionDice.rolling} size={150} />
      </div>
      {!showActionDice.rolling && (
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, color: '#fff', marginTop: 16, textShadow: '0 3px 0 rgba(110,78,16,0.7)' }}>
          {showActionDice.value}
        </div>
      )}
    </div>
  );
}
