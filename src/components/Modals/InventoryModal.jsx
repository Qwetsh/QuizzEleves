// Inventaire « Temple moussu » — porté du design Claude Design
// (Inventaire — Explorations, variante B). Drag & drop pointer-based entre
// le SAC (grille 12 cases) et l'ÉQUIPEMENT (3 slots gravés) ; clic sans
// glisser = popover d'actions (Utiliser / Revendre).
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { sellPrice, isValidMove, normalizeBag } from '../../store/itemHandlers';
import { soundClick } from '../../logic/sounds';
import { itemImg, rarityRing } from '../../logic/itemAssets';
import { TemplePanel, Sprig as InvSprig, Rune as InvRune } from './TempleDecor';
import '../../styles/inventory.css';

// Silhouettes gravées des slots d'équipement vides (viewBox 0 0 64 64)
const SLOT_GLYPHS = {
  head: '<ellipse cx="32" cy="44" rx="27" ry="9"/><path d="M15 44 C15 22 22 9 32 9 C42 9 49 22 49 44 Z"/>',
  body: '<rect x="11" y="4" width="6" height="56" rx="3"/><path d="M17 8 C29 4 41 12 55 8 L55 26 C41 30 29 22 17 26 Z"/>',
  feet: '<path fill-rule="evenodd" d="M32 6 C16 6 8 20 8 34 C8 44 12 52 18 58 L26 51 C21 46 17 40 17 34 C17 24 23 14 32 14 C41 14 47 24 47 34 C47 40 43 46 38 51 L46 58 C52 52 56 44 56 34 C56 20 48 6 32 6 Z"/>',
};

const EQUIP_SLOTS = [
  { key: 'head', label: SLOTS.head.name },
  { key: 'body', label: SLOTS.body.name },
  { key: 'feet', label: SLOTS.feet.name },
];

/* ---------- Case (équipement ou sac) ---------- */
function InvSlot({ k, glyph, itemKey, refCb, onGrab, state, popStamp, away }) {
  const item = ITEMS[itemKey];
  const rarityColor = item ? RARITIES[item.rarity]?.color : null;
  const img = item ? itemImg(item) : null;
  // Liseré de rareté sur le slot interne (laisse les états de drag, portés par
  // le slotframe, intacts). Base = ombres internes du slot conservées dessous.
  const slotBase = 'inset 0 3px 9px rgba(80,55,20,0.38), inset 0 -2px 0 rgba(255,250,230,0.5)';
  return (
    <div className={'inv-slotframe' + (state ? ' is-' + state : '')}>
      <div
        className="inv-slot"
        ref={refCb}
        data-slot={k}
        style={item ? { boxShadow: rarityRing(item.rarity, rarityColor, { base: slotBase }) } : undefined}
      >
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
            title={`${item.name} — ${item.desc}`}
          >
            {img
              ? <img className="inv-item-img" src={img} alt={item.name} draggable={false} />
              : <span className="inv-emoji">{item.icon}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Popover d'actions ---------- */
function ActionPopover({ pop, onUse, onSell, onClose }) {
  const item = ITEMS[pop.itemKey];
  if (!item) return null;
  const rar = RARITIES[item.rarity];
  const canUse = pop.cellKey.startsWith('bag:') && item.slot === 'consumable';
  return createPortal(
    <div className="inv-popover" style={{ left: pop.x, top: pop.y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="inv-popover-name">
        {itemImg(item)
          ? <img src={itemImg(item)} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          : <span>{item.icon}</span>}
        <span>{item.name}</span>
      </div>
      <span className="inv-popover-rarity" style={{ color: rar?.color }}>
        ◆ {rar?.name} · {item.slot === 'consumable' ? 'Consommable' : SLOTS[item.slot]?.name}
      </span>
      <div className="inv-popover-desc">{item.desc}</div>
      <div className="inv-popover-actions">
        {canUse && (
          <button className="inv-btn-use" onClick={() => { soundClick(); onUse(pop); }}>
            Utiliser
          </button>
        )}
        <button className="inv-btn-sell" onClick={() => { soundClick(); onSell(pop); }}>
          ♻️ Revendre +{sellPrice(item)}
        </button>
        <button className="inv-btn-sell" style={{ flex: '0 0 auto', padding: '9px 12px' }} onClick={onClose}>
          ✕
        </button>
      </div>
    </div>,
    document.body
  );
}

/* ---------- Modale ---------- */
export default function InventoryModal() {
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

  useEffect(() => {
    if (!showInventory) { setDrag(null); setHoverKey(null); setPopover(null); }
  }, [showInventory]);

  const team = showInventory ? teams[currentTeam] : null;
  const equipment = team?.equipment || { head: null, body: null, feet: null };
  const bag = normalizeBag(team?.bag);

  const cellItem = (key) =>
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
    const itemKey = cellItem(key);
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
        setPopover({ cellKey: key, itemKey, x: r.left + r.width / 2, y: r.top });
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
    setPopover(null);
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
        <TemplePanel
          title="INVENTAIRE"
          team={team}
          onClose={closeInventory}
          medallion={<InvRune />}
          onBackdropPointerDown={(e) => {
            if (e.target === e.currentTarget) closeInventory();
            else setPopover(null);
          }}
        >
          <div className="inv-wood">

                  <div className="inv-equip">
                    <div className="inv-equip-banner">ÉQUIPEMENT</div>
                    {EQUIP_SLOTS.map((s) => {
                      const k = 'equip:' + s.key;
                      return (
                        <div className="inv-equip-cell" key={s.key}>
                          <InvSlot
                            k={k}
                            glyph={SLOT_GLYPHS[s.key]}
                            itemKey={equipment[s.key]}
                            refCb={(el) => { slotEls.current[k] = el; }}
                            onGrab={onGrab}
                            state={slotState(k)}
                            popStamp={pops[k]}
                            away={drag && !drag.flyback && drag.key === k}
                          />
                          <div className="inv-equip-label">{s.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="inv-sac">
                    <div className="inv-sac-head">
                      <InvSprig className="inv-pack-sprig" x="14px" y="34px" rot={-30} size={70} leaves={5} />
                      <div className="inv-pack">🎒</div>
                      <div className="inv-sac-plaque">
                        <span className="dia">◆</span>
                        <span>SAC</span>
                        <span className="dia">◆</span>
                      </div>
                    </div>
                    <div className="inv-grid">
                      {bag.map((itemKey, i) => {
                        const k = 'bag:' + i;
                        return (
                          <InvSlot
                            key={i}
                            k={k}
                            glyph={null}
                            itemKey={itemKey}
                            refCb={(el) => { slotEls.current[k] = el; }}
                            onGrab={onGrab}
                            state={slotState(k)}
                            popStamp={pops[k]}
                            away={drag && !drag.flyback && drag.key === k}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

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
            <ActionPopover pop={popover} onUse={onUse} onSell={onSell} onClose={() => setPopover(null)} />
          )}
        </TemplePanel>
      )}
    </AnimatePresence>
  );
}
