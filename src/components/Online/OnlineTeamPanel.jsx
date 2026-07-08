// Panneau « Mon équipe » du client online, ouvrable pendant le tour adverse :
// gérer son équipement, sa boutique et ses pouvoirs à distance. Réutilise
// directement les vues de l'app mobile (mêmes intents non-`turn` que le
// compagnon) — `ctrl` (payload manette diffusé par l'hôte) EST le `session`
// attendu par ces vues.
import { useState } from 'react';
import { extOn } from '../../extensions/registry';
import { TeamView, ShopView, PowersView, TradeView } from '../Mobile/MobileApp';

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
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '96vw', zIndex: 330,
      background: '#0e1319', borderLeft: '2px solid #16351f', boxShadow: '-12px 0 40px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: '1px solid #16351f' }}>
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
              border: '1px solid #16351f',
              background: tab === tb.id ? '#16351f' : '#111a15',
              color: tab === tb.id ? '#66ff8a' : '#bfeccb',
            }}
          >
            {tb.label}
          </button>
        ))}
        <button
          onClick={onClose}
          style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', border: '1px solid #16351f', background: '#111a15', color: '#8b9096' }}
          title="Fermer"
        >✕</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
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
