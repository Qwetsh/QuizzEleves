import { useState, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import BoardSVG from './BoardSVG';
import Dice from './Dice';
import PowerButtons from './Sidebar/PowerButtons';
import TeamList from './Sidebar/TeamList';
import GameLog from './Sidebar/GameLog';
import QuestionModal from '../Modals/QuestionModal';
import EventModal from '../Modals/EventModal';
import TargetPickerModal from '../Modals/TargetPickerModal';
import VictoryModal from '../Modals/VictoryModal';
import ShopModal from '../Modals/ShopModal';

function useFullscreen() {
  const [isFs, setIsFs] = useState(false);
  const toggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFs(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFs(false)).catch(() => {});
    }
  }, []);
  return [isFs, toggle];
}

export default function GameLayout() {
  const reset = useGameStore((s) => s.reset);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const finished = useGameStore((s) => s.finished);
  const openShop = useGameStore((s) => s.openShop);
  const [isFs, toggleFs] = useFullscreen();

  const team = teams[currentTeam];

  return (
    <div className="flex h-screen">
      {/* Board area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-[var(--paper)] border-b border-[var(--border)] px-4 py-2 flex items-center gap-3">
          {team && (
            <>
              <span className="text-xl">{team.emoji}</span>
              <span className="font-bold" style={{ color: team.color }}>
                {team.name}
              </span>
              {finished && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">
                  {"\u{1F3C6} VICTOIRE !"}
                </span>
              )}
            </>
          )}
          <div className="flex-1" />
          <button
            onClick={openShop}
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition mr-3"
          >
            {"\u{1F6D2} Boutique"}
          </button>
          <button
            onClick={toggleFs}
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition mr-3"
            title={isFs ? 'Quitter le plein \u00e9cran' : 'Plein \u00e9cran'}
          >
            {isFs ? '\u2716 R\u00e9duire' : '\u26F6 Plein \u00e9cran'}
          </button>
          <button
            onClick={reset}
            className="text-xs text-[var(--muted)] hover:text-red-600 transition"
          >
            {"\u21A9\uFE0F Quitter"}
          </button>
        </div>

        {/* Board */}
        <BoardSVG />
      </div>

      {/* Sidebar */}
      <div className="w-72 bg-[var(--paper)] border-l border-[var(--border)] flex flex-col p-3 overflow-y-auto">
        <Dice />
        <PowerButtons />
        <TeamList />
        <GameLog />
      </div>

      {/* Modals */}
      <QuestionModal />
      <EventModal />
      <TargetPickerModal />
      <VictoryModal />
      <ShopModal />
    </div>
  );
}
