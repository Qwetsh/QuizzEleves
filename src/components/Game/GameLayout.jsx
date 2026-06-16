import { useState, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import BoardSVG from './BoardSVG';
import Dice from './Dice';
import PowerButtons from './Sidebar/PowerButtons';
import GameLog from './Sidebar/GameLog';
import BottomBar from './BottomBar';
import MobileSessionPanel from './MobileSessionPanel';
import DevItemGiver from './DevItemGiver';
import { bagUnitCount } from '../../store/itemHandlers';
import QuestionModal from '../Modals/QuestionModal';
import EventModal from '../Modals/EventModal';
import TargetPickerModal from '../Modals/TargetPickerModal';
import VictoryModal from '../Modals/VictoryModal';
import ShopModal from '../Modals/ShopModal';
import InventoryModal from '../Modals/InventoryModal';
import DiceRollModal from '../Modals/DiceRollModal';
import ChargePickerModal from '../Modals/ChargePickerModal';
import LootReveal from '../Modals/LootReveal';
import StarterChest from '../Modals/StarterChest';
import FightModal from '../Fight/FightModal';
import FlyingCoins from './FlyingCoins';
import LightningStrike from './LightningStrike';
import ActionDiceOverlay from './ActionDiceOverlay';
import SubjectPickerModal from '../Modals/SubjectPickerModal';
import TrapInspectModal from '../Modals/TrapInspectModal';
import EffectToast from './EffectToast';
import btnBoutique from '../../assets/inventory/btn-boutique.png';
import btnInventaire from '../../assets/inventory/btn-inventaire.png';

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
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const reset = useGameStore((s) => s.reset);
  const openShop = useGameStore((s) => s.openShop);
  const openInventory = useGameStore((s) => s.openInventory);
  const devAddMoney = useGameStore((s) => s.devAddMoney);
  const itemsOn = useGameStore((s) => s.itemsEnabled());
  const [isFs, toggleFs] = useFullscreen();

  const team = teams[currentTeam];

  return (
    <div className="flex absolute inset-0">
      {/* Board area — leaves space for right HUD and bottom bar */}
      <div className="flex-1 relative" style={{ marginRight: 320, marginBottom: 148 }}>
        <BoardSVG />

        {/* Top bar overlay — current team */}
        {team && (
          <div
            className="absolute top-3 left-3 flex items-center gap-3 z-50"
            style={{
              background: 'var(--surface-card)',
              borderRadius: 16,
              padding: '8px 16px 8px 8px',
              boxShadow: 'var(--sh-md)',
              border: '1px solid rgba(122, 94, 58, 0.2)',
            }}
          >
            <span className="text-3xl">{team.emoji}</span>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: team.color }}>
                {team.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: -2 }}>
                C'est ton tour !
              </div>
            </div>
          </div>
        )}

        {/* Boutons Boutique + Inventaire flottants — juste au-dessus du HUD des equipes */}
        {team && (
          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 56,
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            {itemsOn && (
              <button onClick={openShop} aria-label="Ouvrir la boutique" className="hud-imgbtn">
                <img src={btnBoutique} alt="Boutique" draggable={false} />
                <span className="hud-imgbtn-badge">
                  {team.money ?? 0} <span className="coin" style={{ filter: 'brightness(1.3)' }} />
                </span>
              </button>
            )}

            {itemsOn && (
              <button onClick={openInventory} aria-label="Ouvrir l'inventaire" className="hud-imgbtn">
                <img src={btnInventaire} alt="Inventaire" draggable={false} />
                {bagUnitCount(team.bag) > 0 && (
                  <span className="hud-imgbtn-badge">{bagUnitCount(team.bag)}</span>
                )}
              </button>
            )}

            {/* Bouton dev : pieces gratuites pour tester les achats (localhost uniquement) */}
            {import.meta.env.DEV && (
              <button
                onClick={() => devAddMoney(10)}
                aria-label="Dev : ajouter 10 pièces"
                title="Dev — ajoute 10 pièces à l'équipe active"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 16px',
                  borderRadius: 999,
                  border: '2px dashed rgba(110, 78, 16, 0.5)',
                  background: 'rgba(255, 250, 240, 0.85)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  color: 'var(--ink-700)',
                  cursor: 'pointer',
                }}
              >
                {"\u{1F6E0}️"} +10 <span className="coin" />
              </button>
            )}
            {import.meta.env.DEV && itemsOn && <DevItemGiver />}
          </div>
        )}
      </div>

      {/* Bottom bar — team cards */}
      <BottomBar />

      {/* HUD — right rail */}
      <div
        className="absolute top-0 right-0 flex flex-col z-[60]"
        style={{
          width: 320,
          height: '100%',
          background: 'linear-gradient(180deg, rgba(255, 250, 240, 0.98), rgba(244, 234, 213, 0.95))',
          borderLeft: '1px solid rgba(122, 94, 58, 0.22)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 18px 14px',
            display: 'flex', alignItems: 'center', gap: 14,
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
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>
              Jeu de plateau
            </div>
          </div>
        </div>

        {/* Dice area */}
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Dice />
          <PowerButtons />
        </div>

        {/* Journal section */}
        <div style={{
          padding: '14px 18px', flex: 1, minHeight: 0,
          display: 'flex', flexDirection: 'column',
          borderTop: '1px solid rgba(122, 94, 58, 0.14)',
        }}>
          <h4 style={{
            fontFamily: 'var(--font-display)', fontSize: 12,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--ink-500)', marginBottom: 8,
          }}>
            Journal
          </h4>
          <GameLog />
        </div>

        {/* Bottom actions */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(122, 94, 58, 0.18)',
          display: 'flex', gap: 8,
        }}>
          <MobileSessionPanel />
          <button className="btn btn--ghost btn--sm" onClick={toggleFs} aria-label="Plein ecran" style={{ flex: 1 }}>
            {isFs ? "\u2716 Quitter le plein \u00E9cran" : "\u26F6 Plein \u00E9cran"}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={reset} aria-label="Quitter">
            {"\u2715"}
          </button>
        </div>
      </div>

      {/* Animations */}
      <FlyingCoins />
      <LightningStrike />
      <ActionDiceOverlay />
      <SubjectPickerModal />
      <EffectToast />

      {/* Modals */}
      <DiceRollModal />
      <QuestionModal />
      <EventModal />
      <ChargePickerModal />
      <TargetPickerModal />
      <VictoryModal />
      <ShopModal />
      <InventoryModal />
      <FightModal />
      <LootReveal />
      <StarterChest />
      <TrapInspectModal />
    </div>
  );
}
