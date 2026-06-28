// Carte de détail d'un objet (clic sur un objet) — réutilisée par l'inventaire
// (InventoryModal) ET par la rangée de consommables de la carte active
// (BottomBar), pour offrir le même geste « voir l'effet puis Utiliser ».
//
// Carte verticale façon RPG : visuel mis en avant (liseré coloré par rareté),
// effets TOUJOURS visibles, bonus de set, actions. Overlay centré dismissable.
import { createPortal } from 'react-dom';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { locName, locDesc } from '../../i18n/content';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { sellPrice } from '../../store/itemHandlers';
import { mergedItem } from '../../logic/itemEffects';
import { soundClick } from '../../logic/sounds';
import { itemImg } from '../../logic/itemAssets';
import { itemEffectLines } from '../../logic/effectText';
import SetBonusInfo from './SetBonusInfo';

// pop : { cellKey: 'bag:N' | 'equip:slot', itemKey, enchants? }
export default function ItemActionCard({ pop, onUse, onSell, onClose }) {
  const T = useT();
  const team = useGameStore((s) => s.teams[s.currentTeam]);
  if (!ITEMS[pop.itemKey]) return null;
  // Objet enchanté : on FUSIONNE les enchantements pour que la fiche affiche AUSSI
  // les effets ajoutés (✦), pas seulement ceux de l'objet de base.
  const item = pop.enchants?.length ? mergedItem({ key: pop.itemKey, enchants: pop.enchants }) : ITEMS[pop.itemKey];
  const rar = RARITIES[item.rarity];
  const img = itemImg(item);
  // Effet d'un ingrédient d'alchimie : caché (???) tant que l'équipe ne l'a pas
  // découvert (utilisé seul) — cohérent avec l'app mobile.
  const fx = itemEffectLines(item, { key: pop.itemKey, knownIngredients: team?.knownIngredients });
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
          <div className="inv-card-name">{locName(item)}</div>
          <div className="inv-card-rar">◆ {rar?.name} · {slotName}</div>
        </div>
        <div className="inv-card-body">
          {item.desc && <div className="inv-card-desc">{locDesc(item)}</div>}
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
