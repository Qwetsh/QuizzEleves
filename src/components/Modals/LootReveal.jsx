// Révélation d'objet « visuel C » (porté du design « Carte d'équipement »,
// CardModale) : fond radial sombre, rayons en conic-gradient teintés par la
// rareté tournant derrière l'objet, halo sur l'objet, pastille de rareté,
// nom et description. Piloté par le store (lootReveal) — déclenché par les
// coffres, le butin de combat et le loot de bonne réponse.
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useGameStore } from '../../store/gameStore';
import { canDriveTurn } from '../../logic/onlineSelf';
import { useT } from '../../i18n';
import { locName, locDesc } from '../../i18n/content';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { itemImg } from '../../logic/itemAssets';
import { itemEffectLines } from '../../logic/effectText';
import { soundClick } from '../../logic/sounds';
import '../../styles/loot-reveal.css';

// Rayons : conic-gradient alterné dans la teinte de rareté (12 secteurs)
function raysGradient(hex) {
  const stops = [];
  for (let a = 0; a < 360; a += 30) {
    stops.push(`${hex}33 ${a}deg ${a + 10}deg`, `transparent ${a + 10}deg ${a + 30}deg`);
  }
  return `conic-gradient(${stops.join(', ')})`;
}

/* Carte présentationnelle réutilisable (modale globale + autres contextes) */
export function LootCard({ item, subtitle, compact = false }) {
  const T = useT();
  if (!item) return null;
  const r = RARITIES[item.rarity] || { color: '#888', soft: '#ddd', name: '' };
  const img = itemImg(item);
  const slotLabel = item.slot === 'consumable' ? T('modal.loot.consumable') : SLOTS[item.slot]?.name;

  return (
    <div className={'loot-card' + (compact ? ' is-compact' : '')}>
      {/* Rayons rotatifs */}
      <div className="loot-rays" style={{ background: raysGradient(r.color) }} />
      {/* Lueur radiale douce de la rareté */}
      <div className="loot-glow" style={{ background: `radial-gradient(circle at 50% 42%, ${r.color}55, transparent 70%)` }} />

      {/* Ancre de centrage statique : Framer Motion écrase le transform de
          l'élément animé, on ne peut donc PAS centrer l'objet via translate
          sur le motion lui-même — le centrage vit sur ce wrapper. */}
      <div className="loot-item-anchor">
        <motion.div
          className="loot-item-wrap"
          initial={{ scale: 0.3, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
        >
          {img ? (
            <img className="loot-item-img" src={img} alt={locName(item)}
              style={{ filter: `drop-shadow(0 0 22px ${r.color}aa) drop-shadow(0 6px 8px rgba(0,0,0,.5))` }} />
          ) : (
            <span className="loot-item-emoji" style={{ filter: `drop-shadow(0 0 18px ${r.color}aa)` }}>{item.icon}</span>
          )}
        </motion.div>
      </div>

      <motion.div
        className="loot-info"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <span className="loot-pill" style={{ background: r.color }}>{r.name} · {slotLabel}</span>
        <div className="loot-name">{locName(item)}</div>
        <p className="loot-desc">{locDesc(item)}</p>
        {subtitle && <div className="loot-subtitle">{subtitle}</div>}
      </motion.div>
    </div>
  );
}

/* Modale globale pilotée par le store */
export default function LootReveal() {
  const T = useT();
  const lootReveal = useGameStore((s) => s.lootReveal);
  const dismissLoot = useGameStore((s) => s.dismissLoot);
  // En ligne (portail hors du gating de GameLayout) : seul le joueur dont c'est
  // le tour referme le butin — miroir : dismissLoot → intent turnLootDismiss.
  const drive = useGameStore(canDriveTurn);
  const team = useGameStore((s) => s.teams[s.currentTeam]);
  const item = lootReveal ? ITEMS[lootReveal.itemKey] : null;
  // Effets mécaniques de l'objet gagné (pillage, coffre, butin…) : on montre
  // ce que l'objet FAIT, pas seulement son nom/description. Les ingrédients
  // d'alchimie non découverts restent « ??? » (règle knownIngredients).
  const effects = item
    ? itemEffectLines(item, { key: lootReveal.itemKey, knownIngredients: team?.knownIngredients || [] })
    : [];

  return createPortal(
    <AnimatePresence>
      {item && (
        <motion.div
          className="loot-overlay"
          style={!drive ? { pointerEvents: 'none' } : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) { soundClick(); dismissLoot(); } }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 240 }}
          >
            <div className="loot-modal">
              <div className="loot-banner">{lootReveal.title || T('modal.loot.title')}</div>
              <LootCard item={item} subtitle={lootReveal.subtitle} />
              {effects.length > 0 && (
                <div className="loot-fx">
                  <div className="loot-fx-title">{T('modal.loot.effects')}</div>
                  {effects.map((l, i) => (
                    <div key={i} className="loot-fx-row"><span className="loot-fx-ic">◆</span><span>{l}</span></div>
                  ))}
                </div>
              )}
              <button className="loot-btn" onClick={() => { soundClick(); dismissLoot(); }}>
                {T('modal.nice')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
