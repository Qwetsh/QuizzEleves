import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { loadGame } from '../../store/persistence';
import LevelSelect from './LevelSelect';
import TeamCount from './TeamCount';
import TeamCustomization from './TeamCustomization';
import BoardParams from './BoardParams';
import EventsChecklist from './EventsChecklist';

export default function Setup() {
  const startGame = useGameStore((s) => s.startGame);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const [hasSave, setHasSave] = useState(false);

  useEffect(() => {
    const saved = loadGame();
    setHasSave(saved !== null);
  }, []);

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-center mb-2">
        {"\u{1F3B2} Qu\u00eate des Mati\u00e8res"}
      </h1>
      <p className="text-center text-sm text-[var(--muted)] mb-8">
        {"Jeu de plateau p\u00e9dagogique"}
      </p>

      {hasSave && (
        <button
          onClick={resumeGame}
          className="w-full py-3 mb-6 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 transition shadow-md"
        >
          {"\u25B6\uFE0F Reprendre la partie"}
        </button>
      )}

      <LevelSelect />
      <TeamCount />
      <TeamCustomization />
      <BoardParams />
      <EventsChecklist />

      <button
        onClick={startGame}
        className="w-full py-3 bg-green-600 text-white text-lg font-bold rounded-xl hover:bg-green-700 transition shadow-md"
      >
        {"\u{1F680} Lancer la partie"}
      </button>
    </div>
  );
}
