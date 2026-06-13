// Vignette d'objet réutilisable : visuel d'équipement (ou emoji pour les
// consommables) posé sur une pastille teintée par la rareté, avec liseré
// coloré optionnel. Utilisé par la boutique, les événements, le combat,
// le LootReveal et la checklist du Setup.
import { ITEMS, RARITIES } from '../../data/items';
import { itemImg, rarityRing } from '../../logic/itemAssets';

export default function ItemIcon({ itemKey, item: itemProp, size = 44, radius, ring = false, style, className }) {
  const item = itemProp || ITEMS[itemKey];
  if (!item) return null;
  const rar = RARITIES[item.rarity];
  const color = rar?.color || '#888';
  const img = itemImg(item);
  const r = radius != null ? radius : Math.round(size * 0.24);

  const base = 'inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.15)';
  return (
    <span
      className={className}
      style={{
        width: size, height: size, flex: 'none',
        borderRadius: r,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // Pastille teintée par la rareté ; emoji = dégradé plein, image = fond doux
        background: img
          ? `radial-gradient(circle at 50% 38%, ${color}33, ${color}1a 70%), linear-gradient(160deg, #efe8cf, #ded2ac)`
          : `linear-gradient(180deg, ${color}cc, ${color})`,
        boxShadow: ring ? rarityRing(item.rarity, color, { base }) : base,
        ...style,
      }}
    >
      {img ? (
        <img
          src={img}
          alt={item.name}
          style={{ maxWidth: '82%', maxHeight: '84%', objectFit: 'contain', filter: 'drop-shadow(0 2px 2px rgba(50,32,8,0.35))' }}
        />
      ) : (
        <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{item.icon}</span>
      )}
    </span>
  );
}
