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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const team = teams[currentTeam];

  return (
    <div className="flex absolute inset-0">
      {/* Board area */}
      <div
        className={`flex-1 relative transition-[margin] duration-200 ${sidebarOpen ? 'mr-72 lg:mr-80' : ''}`}
      >
        {/* Board */}
        <BoardSVG />

        {/* Top bar overlay */}
        <div
          className="absolute z-50 flex items-center gap-3"
          style={{ top: 14, left: 14, right: 14, pointerEvents: 'none' }}
        >
          {team && (
            <div
              style={{
                pointerEvents: 'auto',
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#fffefb',
                borderRadius: 16,
                padding: '8px 16px 8px 8px',
                boxShadow: 'var(--sh-md)',
                border: '1px solid rgba(122, 94, 58, 0.2)',
              }}
            >
              <span className="text-2xl">{team.emoji}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: team.color }}>
                  {team.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: -2 }}>
                  {finished ? '\u{1F3C6} Victoire !' : '\u00e0 toi de jouer'}
                </div>
              </div>
            </div>
          )}

          {/* Sidebar toggle button */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="btn btn--ghost btn--sm ml-auto"
            style={{ pointerEvents: 'auto' }}
            aria-label={sidebarOpen ? 'Masquer le panneau lat\u00e9ral' : 'Afficher le panneau lat\u00e9ral'}
          >
            {sidebarOpen ? '\u25B6' : '\u25C0'}
          </button>
        </div>
      </div>

      {/* HUD Right Rail */}
      <div
        className={`absolute top-0 right-0 flex flex-col z-[60] w-72 lg:w-80 transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          height: '100%',
          background: 'linear-gradient(180deg, rgba(255,250,240,0.98), rgba(244,234,213,0.95))',
          borderLeft: '1px solid rgba(122, 94, 58, 0.22)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {/* HUD Top */}
        <div
          className="flex items-center gap-3.5"
          style={{
            padding: '18px 18px 14px',
            borderBottom: '1px solid rgba(122, 94, 58, 0.18)',
          }}
        >
          <div
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--gold-400), var(--gold-600))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(0,0,0,0.18)',
            }}
          >
            {"\u{1F3B2}"}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-900)', lineHeight: 1.05 }}>
              {"Qu\u00eate des Mati\u00e8res"}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Cycle 4</div>
          </div>
        </div>

        {/* Dice area */}
        <div style={{ padding: 18, borderBottom: '1px solid rgba(122, 94, 58, 0.14)' }}>
          <Dice />
          <PowerButtons />
        </div>

        {/* Teams */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(122, 94, 58, 0.14)' }}>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-500)', marginBottom: 8 }}>
            {"\u00c9quipes"}
          </h4>
          <TeamList />
        </div>

        {/* Journal */}
        <div style={{ flex: 1, minHeight: 0, padding: '14px 18px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-500)', marginBottom: 8 }}>
            Journal
          </h4>
          <GameLog />
        </div>

        {/* Bottom actions */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(122, 94, 58, 0.18)', display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost btn--sm" onClick={openShop} style={{ flex: 1 }}>
            {"\u{1F6D2} Boutique"}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={toggleFs}>
            {isFs ? '\u2716' : '\u26F6'}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={reset}>
            {"\u2715"}
          </button>
        </div>
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
