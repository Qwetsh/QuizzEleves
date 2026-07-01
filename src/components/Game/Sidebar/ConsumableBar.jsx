// Section « Objets à utiliser » du HUD de droite (sous les pouvoirs) : un gros
// bouton par pile de consommables du sac de l'équipe active (image + nom + ×N).
// Tap → carte de détail (effet visible AVANT) + Utiliser, sans ouvrir
// l'inventaire. Les actions du store (useConsumable/sellBagItem) ciblent
// l'équipe active : OK ici puisqu'on n'affiche que la sienne.
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useGameStore } from '../../../store/gameStore';
import { ITEMS, RARITIES } from '../../../data/items';
import { cellKey, cellN } from '../../../store/itemHandlers';
import { itemImg } from '../../../logic/itemAssets';
import { useT } from '../../../i18n';
import { locName } from '../../../i18n/content';
import ItemActionCard from '../../Modals/ItemActionCard';

export default function ConsumableBar() {
  const T = useT();
  const team = useGameStore((s) => s.teams[s.currentTeam]);
  const useConsumable = useGameStore((s) => s.useConsumable);
  const sellBagItem = useGameStore((s) => s.sellBagItem);
  const itemsOn = useGameStore((s) => s.itemsEnabled());
  const [pop, setPop] = useState(null);

  if (!itemsOn || !team) return null;
  const bag = team.bag || [];
  const consumables = [];
  for (let i = 0; i < bag.length; i++) {
    const key = cellKey(bag[i]);
    const item = key ? ITEMS[key] : null;
    if (item && item.slot === 'consumable') consumables.push({ i, key, item, n: cellN(bag[i]) });
  }
  if (consumables.length === 0) return null;
  // Blocage des consommables : on grise et on signale (l'usage reste verrouillé
  // côté store ; la revente via la carte de détail reste possible).
  const blocked = (team.consumablesBlockedTurns ?? 0) > 0;

  return (
    <div className="hud-conso">
      <div className="hud-conso-label">{'\u{1F9EA}'} {T('game.itemsToUse')}</div>
      {blocked && (
        <div style={{ fontSize: 11.5, color: '#8a1f2e', fontWeight: 700, margin: '0 0 4px' }}>
          {'\u{1F6AB}'} {T('game.consumablesBlocked', { n: team.consumablesBlockedTurns })}
        </div>
      )}
      <div className="hud-conso-grid">
        {consumables.map(({ i, key, item, n }) => {
          const color = RARITIES[item.rarity]?.color || '#888';
          const img = itemImg(item);
          return (
            <button
              key={i}
              type="button"
              className="hud-conso-btn"
              style={{ '--rar': color, opacity: blocked ? 0.5 : 1 }}
              title={T('game.tapToUse', { name: locName(item) })}
              onClick={() => setPop({ cellKey: 'bag:' + i, itemKey: key })}
            >
              <span className="hud-conso-ico">
                {img
                  ? <img src={img} alt="" draggable={false} />
                  : <span className="hud-conso-emoji">{item.icon}</span>}
                {n > 1 && <span className="hud-conso-badge">×{n}</span>}
              </span>
              <span className="hud-conso-name">{locName(item)}</span>
            </button>
          );
        })}
      </div>
      {pop && (
        <ItemActionCard
          pop={pop}
          // flushSync : fermer la carte d'info AVANT que useConsumable n'ouvre
          // l'éventuel sélecteur de cible (sinon la modale de ciblage, abonnée
          // au store, s'afficherait par-dessus la carte encore visible).
          onUse={(p) => { flushSync(() => setPop(null)); useConsumable(+p.cellKey.slice(4)); }}
          onSell={(p) => { setPop(null); sellBagItem(+p.cellKey.slice(4)); }}
          onClose={() => setPop(null)}
        />
      )}
    </div>
  );
}
