// Panneau « Mon équipe » du client online, ouvrable pendant le tour adverse :
// gérer son équipement, sa boutique et ses pouvoirs à distance. Réutilise
// directement les vues de l'app mobile (mêmes intents non-`turn` que le
// compagnon) — `ctrl` (payload manette diffusé par l'hôte) EST le `session`
// attendu par ces vues.
import { useState } from 'react';
import { extOn } from '../../extensions/registry';
import { TeamView, ShopView, PowersView, TradeView } from '../Mobile/MobileApp';
import '../../styles/online-game.css';

export default function OnlineTeamPanel({ code, token, ctrl, ownedIdx, trades = [], hasTrade = false, hasDiplo = false, tradeAlert = 0, onClose }) {
  const [tab, setTab] = useState('team');
  const hasShop = extOn(ctrl?.extensions, 'equipment');
  const hasExchange = hasTrade || hasDiplo;
  const common = { session: ctrl, teamIdx: ownedIdx, owned: true, code, token };

  const tabs = [
    { id: 'team', label: '🎽 Équipe' },
    ...(hasShop ? [{ id: 'shop', label: '🛒 Boutique' }] : []),
    { id: 'powers', label: '⚡ Pouvoirs' },
    ...(hasExchange ? [{ id: 'trade', label: `🤝 Troc${tradeAlert ? ` (${tradeAlert})` : ''}` }] : []),
  ];

  return (
    <div className="olc-panel">
      <div className="olc-panel-tabs">
        {tabs.map((tb) => (
          <button key={tb.id} className={`olc-tab ${tab === tb.id ? 'is-on' : ''}`} onClick={() => setTab(tb.id)}>
            {tb.label}
          </button>
        ))}
        <button className="olc-tab olc-tab--close" onClick={onClose} title="Fermer">✕</button>
      </div>
      <div className="olc-panel-body">
        {tab === 'team' && <TeamView {...common} />}
        {tab === 'shop' && hasShop && <ShopView {...common} />}
        {tab === 'powers' && <PowersView {...common} />}
        {tab === 'trade' && hasExchange && (
          <TradeView session={ctrl} teamIdx={ownedIdx} code={code} token={token} trades={trades} hasTrade={hasTrade} hasDiplo={hasDiplo} />
        )}
      </div>
    </div>
  );
}
