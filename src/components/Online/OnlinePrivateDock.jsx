// Dock PRIVÉ du joueur en ligne — remplace le tiroir « Mon équipe » (UX
// téléphone) : les interfaces de gestion s'ouvrent DIRECTEMENT à l'écran, en
// vraies modales PC (les mêmes que le TBI), pour MON équipe uniquement.
//
// Rangée de boutons en bas (même langage visuel que la rangée TBI hors ligne) :
// Boutique · Inventaire · Autel · Alchimie · Sorts · Forge · Troc — chacun gaté
// par les extensions actives (et le métier de MON équipe pour les artisanats).
// L'état d'ouverture est LOCAL (jamais broadcast) ; les mutations partent en
// intents d'équipe via teamDispatch (miroir → réseau, hôte → direct).
import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { onlineSelfIdx } from '../../logic/onlineSelf';
import { teamDispatch, useOnlineDock } from '../../logic/onlineDock';
import { fetchTrades, subscribeTrades } from '../../logic/sessionConfig';
import { extOn } from '../../extensions/registry';
import { craftEnabledFor } from '../../logic/metier';
import { bagUnitCount } from '../../store/itemHandlers';
import { useT } from '../../i18n';
import ShopModal from '../Modals/ShopModal';
import InventoryModal from '../Modals/InventoryModal';
import ScribeModal from '../Modals/ScribeModal';
import AlchemyModal from '../Modals/AlchemyModal';
import SpellTableModal from '../Modals/SpellTableModal';
import ForgeModal from '../Modals/ForgeWorkshop';
import OnlineTradeModal from './OnlineTradeModal';

export default function OnlinePrivateDock() {
  const T = useT();
  const selfIdx = useGameStore(onlineSelfIdx);
  const team = useGameStore((s) => (selfIdx >= 0 ? s.teams[selfIdx] : null));
  const itemsOn = useGameStore((s) => s.itemsEnabled());
  const scribeOn = useGameStore((s) => craftEnabledFor(s.extensions, s.teams[selfIdx], 'enchant'));
  const alchemyOn = useGameStore((s) => craftEnabledFor(s.extensions, s.teams[selfIdx], 'alchemy'));
  const forgeOn = useGameStore((s) => craftEnabledFor(s.extensions, s.teams[selfIdx], 'forge'));
  const magicOn = useGameStore((s) => extOn(s.extensions, 'magic'));
  const tradeOn = useGameStore((s) => extOn(s.extensions, 'trade') || extOn(s.extensions, 'diplomacy'));
  const modal = useOnlineDock((s) => s.modal);
  const openDock = useOnlineDock((s) => s.openDock);
  const closeDock = useOnlineDock((s) => s.closeDock);

  // Offres de troc de la session (badge d'alerte + contenu de la modale).
  const code = useGameStore((s) => s._onlineCode);
  const [trades, setTrades] = useState([]);
  useEffect(() => {
    if (!code || !tradeOn) return;
    let alive = true;
    const refresh = () => fetchTrades(code).then((r) => { if (alive) setTrades(r); }).catch(() => {});
    refresh();
    const unsub = subscribeTrades(code, refresh);
    return () => { alive = false; unsub(); };
  }, [code, tradeOn]);
  const tradeAlert = trades.filter((t) => t.to_idx === selfIdx && t.status === 'pending').length;

  // Clic sur le dé 3D (openForge, champ local jamais broadcast) : en ligne on
  // redirige vers MON atelier privé — l'instance TBI n'est pas montée.
  const showForge = useGameStore((s) => !!s.showForge);
  const closeForge = useGameStore((s) => s.closeForge);
  useEffect(() => {
    if (showForge && forgeOn) { closeForge(); openDock('forge'); }
  }, [showForge, forgeOn, closeForge, openDock]);

  // Spectateur pur (pas d'équipe possédée) : rien à gérer.
  if (selfIdx < 0 || !team) return null;

  const dockFor = (name) => ({
    open: modal === name,
    onClose: closeDock,
    teamIdx: selfIdx,
    dispatch: teamDispatch,
  });

  const buttons = [
    itemsOn && { key: 'shop', emoji: '\u{1F6D2}', label: T('game.shopBtn'), badge: <>{team.money ?? 0} <span className="coin" style={{ filter: 'brightness(1.3)' }} /></> },
    itemsOn && { key: 'inventory', emoji: '\u{1F392}', label: T('game.invBtn'), badge: bagUnitCount(team.bag) > 0 ? bagUnitCount(team.bag) : null },
    itemsOn && scribeOn && { key: 'scribe', emoji: '\u{2712}\u{FE0F}', label: T('game.scribeBtn'), border: '#5a2f8e' },
    itemsOn && alchemyOn && { key: 'alchemy', emoji: '\u{2697}\u{FE0F}', label: T('game.alchBtn'), border: '#2c7a4f' },
    magicOn && { key: 'spellTable', emoji: '\u{2728}', label: T('game.magicBtn'), border: '#6a2fd4' },
    forgeOn && { key: 'forge', emoji: '\u{1F528}', label: T('game.forgeBtn'), border: '#8a4a1f' },
    tradeOn && { key: 'trade', emoji: '\u{1F91D}', label: T('game.tradeBtn'), border: '#1f6a8a', badge: tradeAlert > 0 ? tradeAlert : null },
  ].filter(Boolean);

  return (
    <>
      {/* Rangée de boutons — même emplacement que la rangée TBI hors ligne */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 56,
          display: 'flex', alignItems: 'center', gap: 16,
          pointerEvents: 'auto',
        }}
      >
        {buttons.map((b) => (
          <button
            key={b.key}
            onClick={() => openDock(b.key)}
            aria-label={b.label}
            className="rg-btn"
            style={b.border ? { borderColor: b.border } : undefined}
          >
            <span className="rg-btn__emoji">{b.emoji}</span>{b.label}
            {b.badge != null && <span className="rg-btn__badge">{b.badge}</span>}
          </button>
        ))}
      </div>

      {/* Modales privées (état local, mutations par intents) */}
      <div style={{ pointerEvents: 'auto' }}>
        <ShopModal dock={dockFor('shop')} />
        <InventoryModal dock={dockFor('inventory')} />
        {scribeOn && <ScribeModal dock={dockFor('scribe')} />}
        {alchemyOn && <AlchemyModal dock={dockFor('alchemy')} />}
        {magicOn && <SpellTableModal dock={dockFor('spellTable')} />}
        {forgeOn && <ForgeModal dock={dockFor('forge')} />}
        {tradeOn && <OnlineTradeModal open={modal === 'trade'} onClose={closeDock} teamIdx={selfIdx} trades={trades} />}
      </div>
    </>
  );
}
