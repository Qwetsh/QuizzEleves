import { useState, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import BoardSVG from './BoardSVG';
import Dice from './Dice';
import PowerButtons from './Sidebar/PowerButtons';
import ConsumableBar from './Sidebar/ConsumableBar';
import GameLog from './Sidebar/GameLog';
import BottomBar from './BottomBar';
import InfoPopover from './InfoPopover';
import MobileSessionPanel from './MobileSessionPanel';
import IntentConsumer from './IntentConsumer';
import TradeConsumer from './TradeConsumer';
import ForgeServiceOverlay from './ForgeServiceOverlay';
import StatsArchiver from './StatsArchiver';
import TestLinksPanel from './TestLinksPanel';
import DevItemGiver from './DevItemGiver';
import DevFaceGiver from './DevFaceGiver';
import { OFFLINE } from '../../logic/offline';
import { bagUnitCount } from '../../store/itemHandlers';
import { extOn } from '../../extensions/registry';
import { craftEnabledFor } from '../../logic/metier';
import QuestionModal from '../Modals/QuestionModal';
import EventModal from '../Modals/EventModal';
import TargetPickerModal from '../Modals/TargetPickerModal';
import VictoryModal from '../Modals/VictoryModal';
import ShopModal from '../Modals/ShopModal';
import ShopPromptModal from '../Modals/ShopPromptModal';
import DuelChoiceModal from '../Modals/DuelChoiceModal';
import InventoryModal from '../Modals/InventoryModal';
import ScribeModal from '../Modals/ScribeModal';
import AlchemyModal from '../Modals/AlchemyModal';
import ForgeModal from '../Modals/ForgeWorkshop';
import DiceRollModal from '../Modals/DiceRollModal';
import ForgeCeremony from './ForgeCeremony';
import WeatherOverlay from './WeatherOverlay';
import WeatherBanner from './WeatherBanner';
import ChargePickerModal from '../Modals/ChargePickerModal';
import SpecPickerModal from '../Modals/SpecPickerModal';
import EnchantPickerModal from '../Modals/EnchantPickerModal';
import LootReveal from '../Modals/LootReveal';
import StarterChest from '../Modals/StarterChest';
import MetierPickerModal from '../Modals/MetierPickerModal';
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
  const openScribe = useGameStore((s) => s.openScribe);
  const openAlchemy = useGameStore((s) => s.openAlchemy);
  const devAddMoney = useGameStore((s) => s.devAddMoney);
  const itemsOn = useGameStore((s) => s.itemsEnabled());
  // Crafts gatés PAR ÉQUIPE ACTIVE : avec l'extension « Métiers », chaque équipe
  // ne pratique que son artisanat (sinon comportement historique : tout ouvert).
  const scribeOn = useGameStore((s) => craftEnabledFor(s.extensions, s.teams[s.currentTeam], 'enchant'));
  const alchemyOn = useGameStore((s) => craftEnabledFor(s.extensions, s.teams[s.currentTeam], 'alchemy'));
  const forgeOn = useGameStore((s) => craftEnabledFor(s.extensions, s.teams[s.currentTeam], 'forge'));
  const weatherOn = useGameStore((s) => extOn(s.extensions, 'weather'));
  const triggerWeather = useGameStore((s) => s.triggerWeather);
  const [isFs, toggleFs] = useFullscreen();
  const T = useT();

  const team = teams[currentTeam];

  return (
    <div className="flex absolute inset-0">
      {/* Board area — leaves space for right HUD and bottom bar */}
      <div className="flex-1 relative" style={{ marginRight: 320, marginBottom: 148 }}>
        <BoardSVG />

        {/* Bandeau météo (préavis / météo ambiante en cours) — pilule centrée */}
        {weatherOn && <WeatherBanner />}

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
                {T('game.yourTurn')}
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
              display: 'flex', alignItems: 'center', gap: 16,
            }}
          >
            {itemsOn && (
              <button onClick={openShop} aria-label={T('game.openShop')} className="hud-imgbtn">
                <img src={btnBoutique} alt="Boutique" draggable={false} />
                <span className="hud-imgbtn-badge">
                  {team.money ?? 0} <span className="coin" style={{ filter: 'brightness(1.3)' }} />
                </span>
              </button>
            )}

            {itemsOn && (
              <button onClick={openInventory} aria-label={T('game.openInventory')} className="hud-imgbtn">
                <img src={btnInventaire} alt="Inventaire" draggable={false} />
                {bagUnitCount(team.bag) > 0 && (
                  <span className="hud-imgbtn-badge">{bagUnitCount(team.bag)}</span>
                )}
              </button>
            )}

            {/* Autel du Scribe (extension Enchantement) : créer un parchemin custom */}
            {itemsOn && scribeOn && (
              <button onClick={openScribe} aria-label={T('game.openScribe')} title={T('game.openScribe')}
                style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 18px', borderRadius: 18, border: '2px solid #b98cff', background: 'linear-gradient(180deg,#7a4fae,#5a2f8e)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 16, cursor: 'pointer', boxShadow: '0 6px 16px rgba(90,47,142,0.45), inset 0 1px 0 rgba(255,255,255,0.25)' }}>
                <span style={{ fontSize: 26 }}>{'\u{2712}\u{FE0F}'}</span>{T('game.scribeBtn')}
              </button>
            )}

            {/* Atelier d'alchimie (extension Alchimie) : distiller des potions sur le TBI */}
            {itemsOn && alchemyOn && (
              <button onClick={openAlchemy} aria-label={T('game.openAlchemy')} title={T('game.openAlchemy')}
                style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 18px', borderRadius: 18, border: '2px solid #6fbf8c', background: 'linear-gradient(180deg,#3f9d6b,#2c7a4f)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 16, cursor: 'pointer', boxShadow: '0 6px 16px rgba(44,122,79,0.45), inset 0 1px 0 rgba(255,255,255,0.25)' }}>
                <span style={{ fontSize: 26 }}>{'\u{2697}\u{FE0F}'}</span>{T('game.alchBtn')}
              </button>
            )}

            {/* Boutons dev : pieces gratuites pour tester les achats (localhost uniquement) */}
            {import.meta.env.DEV && [10, 100, 1000].map((n) => (
              <button
                key={n}
                onClick={() => devAddMoney(n)}
                aria-label={`Dev : ajouter ${n} pièces`}
                title={`Dev — ajoute ${n} pièces à l'équipe active`}
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
                {"\u{1F6E0}️"} +{n} <span className="coin" />
              </button>
            ))}
            {import.meta.env.DEV && itemsOn && <DevItemGiver />}
            {import.meta.env.DEV && forgeOn && <DevFaceGiver />}
            {import.meta.env.DEV && weatherOn && ['ventContraire', 'ventArriere', 'soleil', 'orage', 'pluieAcide', 'seisme', 'pluieMaudite'].map((id) => (
              <button key={id} onClick={() => triggerWeather(id, { forced: true })}
                title={`Dev — déclenche la météo « ${id} »`} aria-label={`Dev météo ${id}`}
                style={{ padding: '8px 12px', borderRadius: 999, border: '2px dashed rgba(70,100,150,0.5)', background: 'rgba(240,246,255,0.85)', fontSize: 13, color: 'var(--ink-700)', cursor: 'pointer' }}>
                🌦️ {id}
              </button>
            ))}
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
              {T('game.title')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>
              {T('game.boardGame')}
            </div>
          </div>
        </div>

        {/* Dice area */}
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Dice />
          <PowerButtons />
          <ConsumableBar />
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
            {T('game.journal')}
          </h4>
          <GameLog />
        </div>

        {/* Bottom actions */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(122, 94, 58, 0.18)',
          display: 'flex', gap: 8,
        }}>
          {!OFFLINE && <MobileSessionPanel />}
          <button className="btn btn--ghost btn--sm" onClick={toggleFs} aria-label={T('game.fullscreen')} style={{ flex: 1 }}>
            {isFs ? `\u2716 ${T('game.exitFullscreen')}` : `\u26F6 ${T('game.fullscreen')}`}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={reset} aria-label={T('game.quit')}>
            {"\u2715"}
          </button>
        </div>
      </div>

      {/* Logique : applique les commandes d'équipement venues des téléphones.
          Hors ligne : pas de Realtime → composants non montés. */}
      {!OFFLINE && <IntentConsumer />}
      {!OFFLINE && <TradeConsumer />}
      {!OFFLINE && <StatsArchiver />}
      {!OFFLINE && <TestLinksPanel />}

      {/* Animations */}
      <FlyingCoins />
      <LightningStrike />
      <ActionDiceOverlay />
      <SubjectPickerModal />
      <EffectToast />

      {/* Modals */}
      <ForgeCeremony />
      <WeatherOverlay />
      <DiceRollModal />
      <QuestionModal />
      <EventModal />
      <ChargePickerModal />
      <SpecPickerModal />
      <EnchantPickerModal />
      <TargetPickerModal />
      <VictoryModal />
      <ShopModal />
      <ShopPromptModal />
      <InventoryModal />
      <ScribeModal />
      <AlchemyModal />
      {forgeOn && <ForgeModal />}
      <FightModal />
      <DuelChoiceModal />
      <LootReveal />
      <StarterChest />
      <MetierPickerModal />
      <ForgeServiceOverlay />
      <TrapInspectModal />

      {/* Fiche d'info flottante « façon BG3 » (effets HUD + mots-clés du journal) */}
      <InfoPopover />
    </div>
  );
}
