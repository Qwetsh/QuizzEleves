// Carte de détail d'un objet (clic sur un objet) — réutilisée par l'inventaire
// (InventoryModal) ET par la rangée de consommables de la carte active
// (BottomBar), pour offrir le même geste « voir l'effet puis Utiliser ».
//
// Carte verticale façon RPG : visuel mis en avant (liseré coloré par rareté),
// effets TOUJOURS visibles, bonus de set, actions. Overlay centré dismissable.
import { createPortal } from 'react-dom';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { sellPrice } from '../../store/itemHandlers';
import { soundClick } from '../../logic/sounds';
import { itemImg } from '../../logic/itemAssets';
import { itemEffectLines } from '../../logic/effectText';
import SetBonusInfo from './SetBonusInfo';

// pop : { cellKey: 'bag:N' | 'equip:slot', itemKey }
export default function ItemActionCard({ pop, onUse, onSell, onClose }) {
  const T = useT();
  const team = useGameStore((s) => s.teams[s.currentTeam]);
  const item = ITEMS[pop.itemKey];
  if (!item) return null;
  const rar = RARITIES[item.rarity];
  const img = itemImg(item);
  const fx = itemEffectLines(item);
  const canUse = pop.cellKey.startsWith('bag:') && item.slot === 'consumable';
  const slotName = item.slot === 'consumable' ? T('modal.item.consumable') : SLOTS[item.slot]?.name;
  return createPortal(
    <div className="inv-card-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="inv-card" style={{ '--rar': rar?.color || '#969182' }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="inv-card-head">
          <div className="inv-card-img">
            {img
              ? <img src={img} alt="" draggable={false} />
              : <span className="inv-card-emoji">{item.icon}</span>}
          </div>
          <div className="inv-card-name">{item.name}</div>
          <div className="inv-card-rar">◆ {rar?.name} · {slotName}</div>
        </div>
        <div className="inv-card-body">
          {item.desc && <div className="inv-card-desc">{item.desc}</div>}
          {fx.length > 0 && (
            <>
              <div className="inv-card-fxlabel">{T('modal.item.effects')}</div>
              {fx.map((l, i) => (
                <div key={i} className="inv-card-fxrow"><span className="ic">✦</span><span>{l}</span></div>
              ))}
            </>
          )}
          <SetBonusInfo item={item} team={team} />
          <div className="inv-card-actions">
            {canUse && onUse && (
              <button className="inv-card-btn inv-card-btn--use" onClick={() => { soundClick(); onUse(pop); }}>
                {T('modal.item.use')}
              </button>
            )}
            {onSell && (
              <button className="inv-card-btn inv-card-btn--sell" onClick={() => { soundClick(); onSell(pop); }}>
                {T('modal.item.sell', { n: sellPrice(item) })}
              </button>
            )}
            <button className="inv-card-btn inv-card-btn--sell inv-card-btn--x" onClick={onClose}>✕</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
