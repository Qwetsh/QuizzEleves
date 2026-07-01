// Inventaire — habillage image (panneau « INVENTAIRE » illustré). Le décor
// (titre, colonne ÉQUIPEMENT, onglet SAC, fleurs, plaques) est peint dans
// panel.png ; on ne superpose QUE les zones interactives, positionnées en % du
// panneau : 3 cases d'équipement (eqframe.png) dans la colonne bois, la grille
// du sac (slot.png) sur le parchemin, et le bouton fermer (close.png).
// La mécanique de drag & drop est inchangée (rects des cases figés au grab).
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { locName, locDesc } from '../../i18n/content';
import { ITEMS, RARITIES } from '../../data/items';
import { isValidMove, normalizeBag, cellKey, cellN, cellEnchants } from '../../store/itemHandlers';
import { soundClick } from '../../logic/sounds';
import { itemImg } from '../../logic/itemAssets';
import ItemActionCard from './ItemActionCard';
import panelImg from '../../assets/inventory/panel.png';
import slotImg from '../../assets/inventory/slot.png';
import eqframeImg from '../../assets/inventory/eqframe.png';
import closeImg from '../../assets/inventory/close.png';
import '../../styles/inventory.css';

// Silhouettes gravées des slots d'équipement vides (viewBox 0 0 64 64)
const SLOT_GLYPHS = {
  head: '<ellipse cx="32" cy="44" rx="27" ry="9"/><path d="M15 44 C15 22 22 9 32 9 C42 9 49 22 49 44 Z"/>',
  body: '<rect x="11" y="4" width="6" height="56" rx="3"/><path d="M17 8 C29 4 41 12 55 8 L55 26 C41 30 29 22 17 26 Z"/>',
  feet: '<path fill-rule="evenodd" d="M32 6 C16 6 8 20 8 34 C8 44 12 52 18 58 L26 51 C21 46 17 40 17 34 C17 24 23 14 32 14 C41 14 47 24 47 34 C47 40 43 46 38 51 L46 58 C52 52 56 44 56 34 C56 20 48 6 32 6 Z"/>',
};

// Positions (en % du panneau) des 3 cases d'équipement dans la colonne bois.
const EQUIP_SLOTS = [
  { key: 'head', cy: '32%' },
  { key: 'body', cy: '53%' },
  { key: 'feet', cy: '74%' },
];

/* ---------- Case (équipement ou sac), habillage image ---------- */
function ImgSlot({ k, variant, glyph, itemKey, count = 1, enchanted = 0, style, refCb, onGrab, state, popStamp, away }) {
  const item = ITEMS[itemKey];
  const rarityColor = item ? RARITIES[item.rarity]?.color : null;
  const legendary = item?.rarity === 'legendaire';
  const img = item ? itemImg(item) : null;
  const bg = variant === 'equip' ? eqframeImg : slotImg;
  return (
    <div
      className={'invimg-slot invimg-slot--' + variant + (state ? ' is-' + state : '')}
      style={{ ...style, backgroundImage: `url(${bg})` }}
      ref={refCb}
      data-slot={k}
    >
      {item && rarityColor && (
        <span
          className="invimg-glow"
          style={{ background: `radial-gradient(circle, ${rarityColor}${legendary ? '66' : '40'}, transparent 68%)` }}
        />
      )}
      {!item && glyph && (
        <svg
          className="inv-glyph glyph-carve"
          viewBox="0 0 64 64"
          dangerouslySetInnerHTML={{ __html: glyph }}
        />
      )}
      {item && (
        <div
          className={'inv-item' + (away ? ' is-away' : '')}
          key={popStamp || 0}
          onPointerDown={(e) => onGrab(e, k)}
          title={`${locName(item)} — ${locDesc(item)}`}
        >
          {img
            ? <img className="inv-item-img" src={img} alt={locName(item)} draggable={false} />
            : <span className="inv-emoji">{item.icon}</span>}
          {count > 1 && <span className="inv-stack-badge">×{count}</span>}
          {enchanted > 0 && <span className="inv-ench-badge" title="Enchanté">✦{enchanted > 1 ? enchanted : ''}</span>}
        </div>
      )}
    </div>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* ---------- Modale ---------- */
export default function InventoryModal() {
  const T = useT();
  const showInventory = useGameStore((s) => s.showInventory);
  const closeInventory = useGameStore((s) => s.closeInventory);
  const moveInventoryItem = useGameStore((s) => s.moveInventoryItem);
  const useConsumable = useGameStore((s) => s.useConsumable);
  const sellBagItem = useGameStore((s) => s.sellBagItem);
  const sellEquipment = useGameStore((s) => s.sellEquipment);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);

  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  dragRef.current = drag;
  const [hoverKey, setHoverKey] = useState(null);
  const [pops, setPops] = useState({});
  const [popover, setPopover] = useState(null);
  const slotEls = useRef({});
  // Rects des cases figés au début du drag : les cases ne bougent pas pendant
  // un glisser, inutile de forcer un layout (getBoundingClientRect x15) à
  // chaque pointermove
  const slotRects = useRef({});
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!showInventory) { setDrag(null); setHoverKey(null); setPopover(null); }
  }, [showInventory]);

  // Focus initial dans le panneau + restauration à la fermeture (parité a11y
  // avec TemplePanel, qui sert la Boutique).
  useEffect(() => {
    if (!showInventory) return;
    const prev = document.activeElement;
    const raf = requestAnimationFrame(() => {
      dialogRef.current?.querySelector(FOCUSABLE)?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      if (typeof prev?.focus === 'function') prev.focus();
    };
  }, [showInventory]);

  // Échap ferme ; Tab reste piégé dans le panneau.
  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { closeInventory(); return; }
    if (e.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) || []);
    if (!focusable.length) { e.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, [closeInventory]);

  const team = showInventory ? teams[currentTeam] : null;
  const equipment = team?.equipment || { head: null, body: null, feet: null };
  const bag = normalizeBag(team?.bag);

  // Valeur BRUTE d'une case (peut être une instance enchantée { key, enchants }).
  const cellRaw = (key) =>
    key.startsWith('equip:') ? equipment[key.slice(6)] : bag[+key.slice(4)];

  const hitTest = (x, y) => {
    for (const [k, b] of Object.entries(slotRects.current)) {
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return k;
    }
    return null;
  };

  const liveTeam = () => {
    const st = useGameStore.getState();
    return st.teams[st.currentTeam];
  };

  const onGrab = (e, key) => {
    if (dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const raw = cellRaw(key);
    const itemKey = cellKey(raw); // normalise les instances enchantées → clé string
    const item = ITEMS[itemKey];
    const el = slotEls.current[key];
    if (!item || !el) return;
    setPopover(null);
    // Fige les rects de toutes les cases pour la durée du drag
    slotRects.current = {};
    for (const [k, sEl] of Object.entries(slotEls.current)) {
      if (sEl) slotRects.current[k] = sEl.getBoundingClientRect();
    }
    const r = slotRects.current[key];
    const start = { x: e.clientX, y: e.clientY };
    let started = false;

    const move = (ev) => {
      if (!started && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
      started = true;
      const hk = hitTest(ev.clientX, ev.clientY);
      setHoverKey(hk && isValidMove(liveTeam(), key, hk) ? hk : null);
      setDrag({ key, item, x: ev.clientX, y: ev.clientY, w: r.width, h: r.height, flyback: null });
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setHoverKey(null);
      if (!started) {
        // Clic simple : popover d'actions au-dessus de la case
        setDrag(null);
        setPopover({ cellKey: key, itemKey, enchants: cellEnchants(raw), x: r.left + r.width / 2, y: r.top });
        return;
      }
      const hk = hitTest(ev.clientX, ev.clientY);
      if (hk && isValidMove(liveTeam(), key, hk)) {
        moveInventoryItem(key, hk);
        const stamp = Date.now();
        setPops((p) => ({ ...p, [hk]: stamp, [key]: stamp + 1 }));
        setDrag(null);
      } else {
        const b = slotRects.current[key];
        setDrag((d) => (d ? { ...d, flyback: { x: b.left + b.width / 2, y: b.top + b.height / 2 } } : null));
        setTimeout(() => setDrag(null), 250);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const slotState = (k) => {
    if (!drag || drag.flyback) return null;
    if (hoverKey === k) return 'over';
    if (isValidMove(team, drag.key, k)) return 'valid';
    return null;
  };

  const onUse = (pop) => {
    // Fermer la carte d'info AVANT d'ouvrir l'éventuel sélecteur de cible :
    // useConsumable peut ouvrir showTargetPicker de façon synchrone (moteur
    // d'effets), et la modale de ciblage (abonnée au store via
    // useSyncExternalStore) se rendrait sinon avant que ce setState local ne
    // soit appliqué — d'où une superposition visible. flushSync garantit
    // l'ordre : carte fermée, puis picker.
    flushSync(() => setPopover(null));
    useConsumable(+pop.cellKey.slice(4));
  };
  const onSell = (pop) => {
    setPopover(null);
    if (pop.cellKey.startsWith('bag:')) sellBagItem(+pop.cellKey.slice(4));
    else sellEquipment(pop.cellKey.slice(6));
  };

  return (
    <AnimatePresence>
      {showInventory && team && (
        <motion.div
          className="inv-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={T('modal.inv.title')}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closeInventory();
            else setPopover(null);
          }}
        >
          <motion.div
            initial={{ scale: 0.84, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 220 }}
          >
            <div ref={dialogRef} className="invimg-panel" style={{ backgroundImage: `url(${panelImg})` }}>
              {/* Cases d'équipement (colonne bois) */}
              {EQUIP_SLOTS.map((s) => {
                const k = 'equip:' + s.key;
                return (
                  <ImgSlot
                    key={s.key}
                    k={k}
                    variant="equip"
                    glyph={SLOT_GLYPHS[s.key]}
                    itemKey={cellKey(equipment[s.key])}
                    enchanted={cellEnchants(equipment[s.key]).length}
                    style={{ left: '21.3%', top: s.cy }}
                    refCb={(el) => { slotEls.current[k] = el; }}
                    onGrab={onGrab}
                    state={slotState(k)}
                    popStamp={pops[k]}
                    away={drag && !drag.flyback && drag.key === k}
                  />
                );
              })}

              {/* Grille du sac (parchemin) */}
              <div className="invimg-bag">
                {bag.map((cell, i) => {
                  const k = 'bag:' + i;
                  return (
                    <ImgSlot
                      key={i}
                      k={k}
                      variant="bag"
                      itemKey={cellKey(cell)}
                      count={cellN(cell)}
                      enchanted={cellEnchants(cell).length}
                      refCb={(el) => { slotEls.current[k] = el; }}
                      onGrab={onGrab}
                      state={slotState(k)}
                      popStamp={pops[k]}
                      away={drag && !drag.flyback && drag.key === k}
                    />
                  );
                })}
              </div>

              {/* Bouton fermer */}
              <button
                className="invimg-close"
                style={{ backgroundImage: `url(${closeImg})` }}
                onClick={() => { soundClick(); closeInventory(); }}
                aria-label={T('common.close')}
              />

              {/* Étiquette équipe + pièces */}
              <div className="invimg-team" style={{ '--team': team.color }}>
                <span className="invimg-team-emoji">{team.emoji}</span>
                <span className="invimg-team-name">{team.name}</span>
              </div>
              {/* La pièce est déjà peinte dans la plaque : on n'affiche que le nombre */}
              <div className="invimg-money">{team.money ?? 0}</div>
            </div>
          </motion.div>

          {/* Fantôme de drag */}
          {drag && createPortal(
            <div
              className={'inv-ghost' + (drag.flyback ? ' flyback' : '')}
              style={{
                left: drag.flyback ? drag.flyback.x : drag.x,
                top: drag.flyback ? drag.flyback.y : drag.y,
                width: drag.w,
                height: drag.h,
              }}
            >
              {itemImg(drag.item)
                ? <img className="inv-item-img" src={itemImg(drag.item)} alt="" draggable={false} />
                : <span className="inv-emoji">{drag.item.icon}</span>}
            </div>,
            document.body
          )}

          {/* Popover d'actions */}
          {popover && (
            <ItemActionCard pop={popover} onUse={onUse} onSell={onSell} onClose={() => setPopover(null)} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
