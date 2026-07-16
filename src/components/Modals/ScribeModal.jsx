import { useGameStore } from '../../store/gameStore';
import ScribeView from '../Mobile/ScribeView';

// Autel du Scribe sur le TBI : même créateur que l'app élève (ScribeView réutilisé),
// mais le craft est appliqué DIRECTEMENT (craftParchmentFor) pour l'équipe active.
// `dock` (jeu en ligne) : atelier PRIVÉ de MON équipe, gravure via l'intent
// `craftParchment` (dock.dispatch) — mêmes gardes que le téléphone.
export default function ScribeModal({ dock = null }) {
  const showScribe = useGameStore((s) => s.showScribe);
  const closeScribe = useGameStore((s) => s.closeScribe);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const en = useGameStore((s) => s.englishMode);
  const craftParchmentFor = useGameStore((s) => s.craftParchmentFor);

  const show = dock ? dock.open : showScribe;
  const close = dock ? dock.onClose : closeScribe;
  const teamIdx = dock ? dock.teamIdx : currentTeam;
  const onInscribe = dock
    ? (parts) => dock.dispatch('craftParchment', { parts })
    : (parts) => craftParchmentFor(currentTeam, parts);

  if (!show) return null;
  const team = teams[teamIdx];
  if (!team) return null;

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(20,12,30,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px,96vw)', height: 'min(86vh,780px)', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}>
        <button onClick={close} aria-label="✕" style={{ position: 'absolute', top: 8, right: 10, zIndex: 80, width: 32, height: 32, borderRadius: 16, border: 'none', background: 'rgba(110,63,174,0.12)', color: '#6e3fae', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <ScribeView team={team} en={en} onInscribe={onInscribe} />
      </div>
    </div>
  );
}
