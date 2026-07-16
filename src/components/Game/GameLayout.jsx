import { useState, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import TeamAvatar from '../TeamAvatar';
import { useT } from '../../i18n';
import BoardSVG from './BoardSVG';
import Dice from './Dice';
import PowerButtons from './Sidebar/PowerButtons';
import ConsumableBar from './Sidebar/ConsumableBar';
import MagicGauge from './MagicGauge';
import GameLog from './Sidebar/GameLog';
import BottomBar from './BottomBar';
import InfoPopover from './InfoPopover';
import MobileSessionPanel from './MobileSessionPanel';
import IntentConsumer from './IntentConsumer';
import OnlinePrivateDock from '../Online/OnlinePrivateDock';
import VolumeControl from './VolumeControl';
import TradeConsumer from './TradeConsumer';
import ForgeServiceOverlay from './ForgeServiceOverlay';
import StatsArchiver from './StatsArchiver';
import TestLinksPanel from './TestLinksPanel';
import DevItemGiver from './DevItemGiver';
import DevFaceGiver from './DevFaceGiver';
import { OFFLINE } from '../../logic/offline';
import { onlineSelfIdx, canDriveTurn } from '../../logic/onlineSelf';
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
import SpellTableModal from '../Modals/SpellTableModal';
import ForgeModal from '../Modals/ForgeWorkshop';
import DiceRollModal from '../Modals/DiceRollModal';
import ForgeCeremony from './ForgeCeremony';
import SpellCeremony from './SpellCeremony';
import WeatherOverlay from './WeatherOverlay';
import WeatherBanner from './WeatherBanner';
import ChargePickerModal from '../Modals/ChargePickerModal';
import SpecPickerModal from '../Modals/SpecPickerModal';
import InvestPickerModal from '../Modals/InvestPickerModal';
import InvestResultModal from '../Modals/InvestResultModal';
import EnchantPickerModal from '../Modals/EnchantPickerModal';
import LootReveal from '../Modals/LootReveal';
import StarterChest from '../Modals/StarterChest';
import MetierPickerModal from '../Modals/MetierPickerModal';
import FightModal from '../Fight/FightModal';
import FlyingCoins from './FlyingCoins';
import LightningStrike from './LightningStrike';
import CurseStrike from './CurseStrike';
import PowerCinematic from './PowerCinematic';
import ActionDiceOverlay from './ActionDiceOverlay';
import SubjectPickerModal from '../Modals/SubjectPickerModal';
import TrapInspectModal from '../Modals/TrapInspectModal';
import EffectToast from './EffectToast';
import '@fontsource/vt323/400.css';
import '@fontsource/archivo-black/400.css';
import '../../styles/retro-game.css';

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
  // Magie : table des sorts TBI (repli sans téléphone + test DEV) — pas de
  // gating métier (la magie n'est pas un artisanat).
  const magicOn = useGameStore((s) => extOn(s.extensions, 'magic'));
  const openSpellTable = useGameStore((s) => s.openSpellTable);
  // Mode « jeu en ligne » : la diffusion est gérée par OnlineHost (instantané
  // complet) — on n'active pas le panneau mobile (payload manette) qui publierait
  // en concurrence sur le même code de session.
  const onlineMode = useGameStore((s) => s.connectionMode === 'online');
  // Client « miroir » (spectateur online) : rend le plateau mais N'EST PAS
  // l'autorité → on ne monte aucun consumer réseau (sinon il volerait/supprimerait
  // les intents/trades du vrai hôte).
  const mirror = useGameStore((s) => !!s._mirror);
  // En ligne, l'écran de CHAQUE joueur rend le plateau complet — mais seules
  // SES surfaces sont interactives : les modales/le dé du TOUR pour le joueur
  // dont c'est le tour (turnUi), le reste (journal, infos) pour tous. La base
  // reste inerte (décor, boutons DEV) — gating par surface, plus de blanket.
  // Hors ligne : tout reste interactif (TBI classe, comportement historique).
  const boardInert = mirror || onlineMode;
  const selfIdx = useGameStore(onlineSelfIdx);
  const driveTurn = useGameStore(canDriveTurn);
  // pointerEvents par surface : undefined hors ligne (aucun changement),
  // 'auto'/'none' en ligne selon que cette fenêtre pilote le tour ou non.
  const turnUi = onlineMode ? { pointerEvents: driveTurn ? 'auto' : 'none' } : undefined;
  const sharedUi = onlineMode ? { pointerEvents: 'auto' } : undefined;
  // Marché Noir (événement) : seule boutique PARTAGÉE en ligne.
  const marcheNoirOpen = useGameStore((s) => typeof s.showShop === 'object' && !!s.showShop?.marcheNoir);
  const triggerWeather = useGameStore((s) => s.triggerWeather);
  const [isFs, toggleFs] = useFullscreen();
  const T = useT();
  // Chaîne de la TV : COULEUR (normal) ou 8-BIT (trame pixel décorative).
  // Pur habillage — aucun effet sur le plateau ni le gameplay.
  const [pixelChannel, setPixelChannel] = useState(false);
  const turnCount = useGameStore((s) => s.turnCount);

  const team = teams[currentTeam];

  return (
    <div className="flex absolute inset-0 rg-root" style={boardInert ? { pointerEvents: 'none' } : undefined}>
      {/* Board area — leaves space for right HUD and bottom bar */}
      <div className="flex-1 relative" style={{ marginRight: 320, marginBottom: 148 }}>
        {/* Le plateau vit dans une TV CRT : coque grise, écran bombé, effets
            scanlines/8-bit en overlays non interactifs, bandeau de commandes. */}
        <section className="rg-tv">
          <div className="rg-tv-screen">
            {/* En ligne : le plateau (jonctions, checkpoint, pose de piège) se
                clique UNIQUEMENT pendant son propre tour. */}
            <div className="rg-tv-screen-inner" style={turnUi}>
              <BoardSVG />
              <div className="rg-tv-fx rg-tv-fx--vignette" />
              <div className="rg-tv-fx rg-tv-fx--glare" />
              <div className="rg-tv-fx rg-tv-fx--flicker" />
              <div className="rg-tv-fx rg-tv-fx--scan" />
              {pixelChannel && (<>
                <div className="rg-tv-fx rg-tv-fx--pixel" />
                <div className="rg-tv-fx rg-tv-fx--pixel2" />
                <div className="rg-tv-fx rg-tv-fx--pixel3" />
              </>)}
              <div className="rg-tv-badge">CH·{pixelChannel ? 2 : 1} {pixelChannel ? T('game.tvPixel') : T('game.tvColor')}</div>
            </div>
          </div>
          <div className="rg-tv-strip" style={sharedUi}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="rg-tv-brand">SONOVISION</span>
              <span className="rg-tv-sub">TRINI-VISION™</span>
            </div>
            <button className="rg-tv-switch" onClick={() => setPixelChannel((p) => !p)} title={T('game.tvSwitch')} aria-label={T('game.tvSwitch')}>
              <span className="rg-tv-switch-label" style={{ color: pixelChannel ? '#565b60' : '#66ff8a' }}>{T('game.tvColor')}</span>
              <span className="rg-tv-switch-track"><span className="rg-tv-switch-knob" style={{ transform: pixelChannel ? 'translateX(24px)' : 'none' }} /></span>
              <span className="rg-tv-switch-label" style={{ color: pixelChannel ? '#66ff8a' : '#565b60' }}>{T('game.tvPixel')}</span>
            </button>
            <VolumeControl />
            <div style={{ flex: 1 }} />
            <div className="rg-tv-dial" />
            <div className="rg-tv-dial" style={{ transform: 'rotate(120deg)' }} />
            <div className="rg-tv-pwr"><span className="rg-tv-pwr-led" /><span className="rg-tv-pwr-txt">PWR</span></div>
          </div>
        </section>

        {/* Bandeau météo (préavis / météo ambiante en cours) — pilule centrée */}
        {weatherOn && <WeatherBanner />}

        {/* Top bar overlay — current team. En ligne, le badge s'adresse à UN
            joueur : « C'est ton tour ! » seulement si l'équipe active est la
            sienne, sinon « "équipe" est en train de jouer… ». */}
        {team && (
          <div className="absolute top-4 left-5 z-50 rg-team-badge">
            <div className="rg-team-badge__tile" style={{ background: team.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TeamAvatar team={team} size={40} /></div>
            <div>
              <div className="rg-team-badge__name">{team.name}</div>
              <div className="rg-team-badge__sub">
                {!onlineMode || selfIdx === currentTeam ? T('game.yourTurn') : T('game.theirTurn')}
              </div>
            </div>
            <span className="rg-team-badge__led" />
          </div>
        )}

        {/* Boutons Boutique + Inventaire flottants — juste au-dessus du HUD des equipes.
            EN LIGNE : masqués — l'écran est un affichage partagé (plateau inerte),
            chaque joueur a SA boutique / SON inventaire dans son dock personnel. */}
        {team && !onlineMode && (
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
              <button onClick={openShop} aria-label={T('game.openShop')} className="rg-btn">
                <span className="rg-btn__emoji">{'\u{1F6D2}'}</span>{T('game.shopBtn')}
                <span className="rg-btn__badge">{team.money ?? 0} <span className="coin" style={{ filter: 'brightness(1.3)' }} /></span>
              </button>
            )}

            {itemsOn && (
              <button onClick={openInventory} aria-label={T('game.openInventory')} className="rg-btn">
                <span className="rg-btn__emoji">{'\u{1F392}'}</span>{T('game.invBtn')}
                {bagUnitCount(team.bag) > 0 && (
                  <span className="rg-btn__badge">{bagUnitCount(team.bag)}</span>
                )}
              </button>
            )}

            {/* Autel du Scribe (extension Enchantement) : créer un parchemin custom */}
            {itemsOn && scribeOn && (
              <button onClick={openScribe} aria-label={T('game.openScribe')} title={T('game.openScribe')} className="rg-btn" style={{ borderColor: '#5a2f8e' }}>
                <span className="rg-btn__emoji">{'\u{2712}\u{FE0F}'}</span>{T('game.scribeBtn')}
              </button>
            )}

            {/* Atelier d'alchimie (extension Alchimie) : distiller des potions sur le TBI */}
            {itemsOn && alchemyOn && (
              <button onClick={openAlchemy} aria-label={T('game.openAlchemy')} title={T('game.openAlchemy')} className="rg-btn" style={{ borderColor: '#2c7a4f' }}>
                <span className="rg-btn__emoji">{'\u{2697}\u{FE0F}'}</span>{T('game.alchBtn')}
              </button>
            )}

            {/* Table des sorts (extension Magie) : tracer/incanter sur le TBI */}
            {magicOn && (
              <button onClick={openSpellTable} aria-label={T('game.openMagic')} title={T('game.openMagic')} className="rg-btn" style={{ borderColor: '#6a2fd4' }}>
                <span className="rg-btn__emoji">{'\u{2728}'}</span>{T('game.magicBtn')}
              </button>
            )}

            {/* Boutons dev : pieces gratuites pour tester les achats (localhost uniquement) */}
            {import.meta.env.DEV && [10, 100, 1000].map((n) => (
              <button
                key={n}
                onClick={() => devAddMoney(n)}
                aria-label={`Dev : ajouter ${n} pièces`}
                title={`Dev — ajoute ${n} pièces à l'équipe active`}
                className="rg-pill"
              >
                {"\u{1F6E0}️"} +{n} <span className="coin" />
              </button>
            ))}
            {import.meta.env.DEV && itemsOn && <DevItemGiver />}
            {import.meta.env.DEV && forgeOn && <DevFaceGiver />}
            {import.meta.env.DEV && weatherOn && ['ventContraire', 'ventArriere', 'soleil', 'orage', 'pluieAcide', 'seisme', 'pluieMaudite'].map((id) => (
              <button key={id} onClick={() => triggerWeather(id, { forced: true })}
                title={`Dev — déclenche la météo « ${id} »`} aria-label={`Dev météo ${id}`}
                className="rg-pill" style={{ fontSize: 12 }}>
                🌦️ {id}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar — team cards (fiches d'info consultables par tous en ligne) */}
      <div style={sharedUi}>
        <BottomBar />
      </div>

      {/* HUD — right rail (colonne bois façon meuble hi-fi) */}
      <div
        className="absolute top-0 right-0 flex flex-col z-[60] rg-rail"
        style={{ width: 320, height: '100%', padding: '12px 12px 10px', gap: 11 }}
      >
        <span className="rg-screw" style={{ top: 8, left: 8 }} />
        <span className="rg-screw" style={{ top: 8, right: 8 }} />

        {/* Header — plaque crème titre + tour courant */}
        <div className="rg-plaque" style={{ position: 'relative', zIndex: 2, flex: '0 0 auto' }}>
          <div className="rg-plaque__tile">{"\u{1F3DD}\u{FE0F}"}</div>
          <div>
            <div className="rg-plaque__title">{T('game.title')}</div>
            <div className="rg-plaque__sub">{T('game.boardGame')} · {T('game.turnN', { n: (turnCount || 0) + 1 })}</div>
          </div>
        </div>

        {/* Dice area — plateau de dé en bois sombre. En ligne : dé, pouvoirs et
            consommables ne répondent qu'au joueur dont c'est le tour. */}
        <div className="rg-tray" style={{ position: 'relative', zIndex: 2, flex: '0 0 auto', padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, ...turnUi }}>
          <Dice />
          <MagicGauge team={team} detailed />
          <PowerButtons />
          <ConsumableBar />
        </div>

        {/* Journal section — fenêtre Win95 (consultable par tous en ligne) */}
        <div className="rg-win95" style={{ position: 'relative', zIndex: 2, flex: 1, minHeight: 0, ...sharedUi }}>
          <div className="rg-win95-bar">
            <div className="rg-win95-bar__title"><span style={{ fontSize: 12 }}>{"\u{1F4D3}"}</span>JOURNAL.EXE</div>
            <div style={{ display: 'flex', gap: 3 }}>
              <span className="rg-win95-bar__btn" style={{ alignItems: 'flex-end', lineHeight: 0.6 }}>_</span>
              <span className="rg-win95-bar__btn">□</span>
              <span className="rg-win95-bar__btn">✕</span>
            </div>
          </div>
          <div className="rg-win95-menu"><span><u>F</u>ichier</span><span><u>E</u>dition</span><span><u>?</u></span></div>
          <div className="rg-win95-body">
            <GameLog />
          </div>
        </div>

        {/* Bottom actions \u2014 en ligne : plein \u00E9cran pour tous ; \u00AB quitter \u00BB passe
            par le bandeau online (l'h\u00F4te y cl\u00F4t proprement la session). */}
        <div className="rg-rail-actions" style={{ position: 'relative', zIndex: 2, flex: '0 0 auto', display: 'flex', gap: 8, ...sharedUi }}>
          {!OFFLINE && !onlineMode && <MobileSessionPanel />}
          <button className="btn btn--ghost btn--sm" onClick={toggleFs} aria-label={T('game.fullscreen')} style={{ flex: 1 }}>
            {isFs ? `\u2716 ${T('game.exitFullscreen')}` : `\u26F6 ${T('game.fullscreen')}`}
          </button>
          {!onlineMode && (
            <button className="btn btn--ghost btn--sm" onClick={reset} aria-label={T('game.quit')}>
              {"\u2715"}
            </button>
          )}
        </div>
      </div>

      {/* Logique : applique les commandes d'équipement venues des téléphones.
          Hors ligne : pas de Realtime → composants non montés. */}
      {!OFFLINE && !mirror && <IntentConsumer />}
      {!OFFLINE && !mirror && <TradeConsumer />}
      {!OFFLINE && !mirror && <StatsArchiver />}
      {!OFFLINE && !mirror && <TestLinksPanel />}

      {/* Animations (spectacles non interactifs) */}
      <FlyingCoins />
      <LightningStrike />
      <CurseStrike />
      <PowerCinematic />
      <ActionDiceOverlay />
      <EffectToast />
      <ForgeCeremony />
      <SpellCeremony />
      <WeatherOverlay />

      {/* Modales de TOUR : rendues chez tout le monde (spectacle partagé), mais
          en ligne seuls les clics du joueur DONT C'EST LE TOUR comptent — sur
          le miroir ils partent en intents `turn*` (onlineMirror), chez l'hôte
          ils appliquent directement (autorité). Le wrapper ne porte que le
          pointer-events : les modales sont en position fixed, layout intact. */}
      <div style={turnUi}>
        <SubjectPickerModal />
        <DiceRollModal />
        <QuestionModal />
        <EventModal />
        <ChargePickerModal />
        <SpecPickerModal />
        <EnchantPickerModal />
        <TargetPickerModal />
        <InvestPickerModal />
        <InvestResultModal />
        <DuelChoiceModal />
        <LootReveal />
        <StarterChest />
        <MetierPickerModal />
        <ShopPromptModal />
        <TrapInspectModal />
        {/* Marché Noir (boutique louche d'événement) : spectacle partagé piloté
            par le joueur actif — la boutique NORMALE en ligne est privée (dock). */}
        {onlineMode && marcheNoirOpen && <ShopModal />}
      </div>
      {/* Victoire : boutons (rejouer/quitter) réservés à l'hôte en ligne. */}
      <div style={onlineMode ? { pointerEvents: mirror ? 'none' : 'auto' } : undefined}>
        <VictoryModal />
      </div>
      {/* Interfaces PERSO (boutique/inventaire/ateliers) : hors ligne = équipe
          active au TBI (historique). En ligne, chacun a les SIENNES via le dock
          privé (OnlinePrivateDock) — ces instances-ci restent hors ligne only. */}
      {!onlineMode && <ShopModal />}
      {!onlineMode && <InventoryModal />}
      {!onlineMode && <ScribeModal />}
      {!onlineMode && <AlchemyModal />}
      {!onlineMode && <SpellTableModal />}
      {forgeOn && !onlineMode && <ForgeModal />}
      {/* Duel : en ligne, les duellistes jouent via DuelRaceView (overlay dédié
          par-dessus) — FightModal reste le spectacle partagé, inerte. */}
      <FightModal />
      <ForgeServiceOverlay />

      {/* Dock PRIVÉ du joueur en ligne : SES boutique/inventaire/ateliers/troc,
          en vraies modales PC, mutations via intents d'équipe. */}
      {onlineMode && <OnlinePrivateDock />}

      {/* Fiche d'info flottante « façon BG3 » (effets HUD + mots-clés du journal) */}
      <div style={sharedUi}>
        <InfoPopover />
      </div>
    </div>
  );
}
