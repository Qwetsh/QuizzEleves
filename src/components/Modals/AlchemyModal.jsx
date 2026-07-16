// Atelier d'alchimie sur le TBI : MÊME interface que l'app élève (AlchemyView
// réutilisé), juste présentée dans une modale au format écran. Le craft est
// appliqué DIRECTEMENT pour l'équipe active (craftPotionFor).
import { useGameStore } from '../../store/gameStore';
import AlchemyView from '../Mobile/AlchemyView';

// `dock` (jeu en ligne) : atelier PRIVÉ de MON équipe, distillation via l'intent
// `craft` (dock.dispatch) — mêmes gardes que le téléphone.
export default function AlchemyModal({ dock = null }) {
  const showAlchemy = useGameStore((s) => s.showAlchemy);
  const closeAlchemy = useGameStore((s) => s.closeAlchemy);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const en = useGameStore((s) => s.englishMode);
  const craftPotionFor = useGameStore((s) => s.craftPotionFor);

  const show = dock ? dock.open : showAlchemy;
  const close = dock ? dock.onClose : closeAlchemy;
  const teamIdx = dock ? dock.teamIdx : currentTeam;
  const onCraft = dock
    ? (keys) => dock.dispatch('craft', { keys })
    : (keys) => craftPotionFor(currentTeam, keys);

  if (!show) return null;
  const team = teams[teamIdx];
  if (!team) return null;

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(20,12,30,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px,96vw)', height: 'min(88vh,880px)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}>
        <button onClick={close} aria-label="✕" style={{ position: 'absolute', top: 8, right: 10, zIndex: 80, width: 32, height: 32, borderRadius: 16, border: 'none', background: 'rgba(120,90,28,0.18)', color: '#7c5a1c', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <AlchemyView team={team} en={en} onCraft={onCraft} />
      </div>
    </div>
  );
}
