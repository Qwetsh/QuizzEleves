import { useGameStore } from './store/gameStore';
import Setup from './components/Setup/Setup';
import PowerSetup from './components/Setup/PowerSetup';
import GameLayout from './components/Game/GameLayout';

export default function App() {
  const phase = useGameStore((s) => s.phase);

  return (
    <div className="min-h-screen">
      {phase === 'setup' && <Setup />}
      {phase === 'powerSelect' && <PowerSetup />}
      {phase === 'game' && <GameLayout />}
    </div>
  );
}
