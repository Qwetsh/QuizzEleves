import { useGameStore } from '../../store/gameStore';
import ScribeView from '../Mobile/ScribeView';

// Autel du Scribe sur le TBI : même créateur que l'app élève (ScribeView réutilisé),
// mais le craft est appliqué DIRECTEMENT (craftParchmentFor) pour l'équipe active.
export default function ScribeModal() {
  const show = useGameStore((s) => s.showScribe);
  const closeScribe = useGameStore((s) => s.closeScribe);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const en = useGameStore((s) => s.englishMode);
  const craftParchmentFor = useGameStore((s) => s.craftParchmentFor);

  if (!show) return null;
  const team = teams[currentTeam];
  if (!team) return null;

  return (
    <div onClick={closeScribe} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(20,12,30,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px,96vw)', height: 'min(86vh,780px)', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}>
        <button onClick={closeScribe} aria-label="✕" style={{ position: 'absolute', top: 8, right: 10, zIndex: 80, width: 32, height: 32, borderRadius: 16, border: 'none', background: 'rgba(110,63,174,0.12)', color: '#6e3fae', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <ScribeView team={team} en={en} onInscribe={(parts) => craftParchmentFor(currentTeam, parts)} />
      </div>
    </div>
  );
}
