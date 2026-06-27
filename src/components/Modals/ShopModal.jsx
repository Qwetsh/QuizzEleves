// Boutique « Temple moussu » — même langage visuel que l'inventaire :
// le chrome (cadre, plaque, feuillage, a11y) vient de TemplePanel ; ici,
// les étals de parchemin (arrivage d'objets, recharge, amélioration,
// déblocage de pouvoirs) à bannières de bois.
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { locName, locDesc, loc } from '../../i18n/content';
import { POWERS, MAX_CHARGES } from '../../data/powers';
import { maxPowerLevel, powerUpgradeCost, describePowerScale, specSlotForLevel } from '../../logic/powerEffects';
import { extOn } from '../../extensions/registry';
import { faceEffectLabel, faceShortLabel, FACE_STOCK_MAX } from '../../logic/forgeEffects';
import { getDieFaces, isFaceForged } from '../../logic/forge';
import FaceTile from '../Game/FaceTile';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { BAG_SIZE } from '../../store/itemHandlers';
import { soundClick, soundCast } from '../../logic/sounds';
import EffectDetails from './EffectDetails';
import { TemplePanel, CoinRune } from './TempleDecor';
import ItemIcon from './ItemIcon';
import '../../styles/inventory.css';
import '../../styles/shop.css';

/* ---------- Briques partagées ---------- */

function Stall({ banner, note, children }) {
  return (
    <section className="shop-stall">
      <div className="shop-stall-banner">{banner}</div>
      {note && <div className="shop-stall-note">{note}</div>}
      <div className="shop-row scroll-hidden">{children}</div>
    </section>
  );
}

function CardIcon({ icon, color, desaturate = false }) {
  return (
    <span
      className="shop-card-icon"
      style={{
        background: `linear-gradient(180deg, ${color}cc, ${color})`,
        filter: desaturate ? 'saturate(0.6)' : undefined,
      }}
    >
      {icon}
    </span>
  );
}

function ChargePips({ current, max = MAX_CHARGES }) {
  return (
    <span className="shop-pips">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={'shop-pip' + (i < current ? ' on' : '')} />
      ))}
    </span>
  );
}

function Price({ value }) {
  return (
    <>
      ({value} <span className="coin" style={{ filter: 'brightness(1.2)' }} />)
    </>
  );
}

/* ---------- Étal : objets (liste de clés fournie) ---------- */
function ItemStall({ team, items, onBuyItem, discount = 1, banner, note }) {
  const T = useT();
  if (!items || items.length === 0) return null;
  const bag = team.bag || [];
  const equipment = team.equipment || {};

  return (
    <Stall banner={banner || T('modal.shop.items')} note={note}>
      {items.map((key, idx) => {
        const item = ITEMS[key];
        if (!item) return null;
        const rarityColor = RARITIES[item.rarity]?.color || '#888';
        const isConsumable = item.slot === 'consumable';
        const slotTaken = !isConsumable && !!equipment[item.slot];
        // Va dans le sac si consommable ou slot occupé -> il faut une case libre
        const needsBagRoom = isConsumable || slotTaken;
        const bagFull = needsBagRoom && bag.filter(Boolean).length >= BAG_SIZE;
        const price = discount < 1 ? Math.max(1, Math.round(item.price * discount)) : item.price;
        const canBuy = team.money >= price && !bagFull;

        return (
          <div className="shop-card" key={`${key}-${idx}`}>
            <div className="shop-card-inner">
              <div className="shop-card-head">
                <ItemIcon item={item} size={38} ring />
                <div className="shop-card-titles">
                  <div className="shop-card-name">{locName(item)}</div>
                  <div className="shop-card-sub" style={{ color: rarityColor }}>
                    {RARITIES[item.rarity]?.name} · {isConsumable ? T('modal.shop.consumable') : SLOTS[item.slot]?.name}
                  </div>
                </div>
              </div>
              <div className="shop-card-desc">
                {locDesc(item)}
                <EffectDetails item={item} compact />
                {slotTaken && !bagFull && (
                  <div className="shop-card-warn">
                    {T('modal.shop.slotTaken', { slot: SLOTS[item.slot]?.name })}
                  </div>
                )}
                {bagFull && <div className="shop-card-warn is-danger">{T('modal.shop.bagFull')}</div>}
              </div>
              <button
                className="shop-buy"
                disabled={!canBuy}
                onClick={() => { soundClick(); onBuyItem(key); }}
              >
                {isConsumable || slotTaken ? T('common.buy') : T('common.equip')}{' '}
                {discount < 1 && <s style={{ opacity: 0.6, marginRight: 4 }}>{item.price}</s>}
                <Price value={price} />
              </button>
            </div>
          </div>
        );
      })}
    </Stall>
  );
}

/* ---------- Vitrine de faces (Forge) : cartes par bande de rareté ---------- */
const FACE_RARITY = [
  { label: 'Commune', color: '#7c9a5a' },
  { label: 'Commune', color: '#7c9a5a' },
  { label: 'Peu commune', color: '#3b8ea5' },
  { label: 'Rare', color: '#7a5ad4' },
  { label: 'Rare', color: '#7a5ad4' },
  { label: 'Très rare', color: '#d4762e' },
];
const faceRarity = (power) => FACE_RARITY[Math.min(5, Math.max(0, Math.floor((((power) || 1) - 1) / 2)))];

function FaceStall({ team, faces, onBuyFace, en }) {
  const T = useT();
  const reserve = team.faceStock?.length || 0;
  const stockFull = reserve >= FACE_STOCK_MAX;
  return (
    <section className="shop-stall">
      <div className="shop-stall-banner">{T('modal.shop.faces')}</div>
      {!faces || faces.length === 0 ? (
        <div className="forge-shop-empty">{T('modal.shop.facesEmpty')}</div>
      ) : (
        <div className="forge-shop-grid">
          {faces.map((f, idx) => {
            const slot = f.slot || (idx + 1);
            const rar = faceRarity(f.power);
            const price = f.price || 0;
            const canBuy = team.money >= price && !stockFull;
            const effLabel = faceEffectLabel(f, en);
            return (
              <div className="forge-shop-card" key={idx} style={{ '--rar': rar.color }}>
                <span className="forge-shop-slot">{T('modal.shop.faceSlot', { n: slot })}</span>
                <FaceTile face={f} size={62} slotTag={slot} />
                <span className="forge-shop-rarity">{rar.label}</span>
                <div className="forge-shop-card-eff">{effLabel || T('modal.shop.facePure')}</div>
                <button className="shop-buy" disabled={!canBuy} onClick={() => { soundClick(); onBuyFace(idx); }}>
                  {T('common.buy')} <Price value={price} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- Banc de forge : creuset (drag-and-drop d'un lingot vers son moule) ---------- */
// Directions fixes des étincelles à la coulée (réparties autour du moule).
const MOLD_SPARKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { x: `${Math.cos(a) * 36}px`, y: `${Math.sin(a) * 36}px` };
});
// Braises qui montent du foyer (positions/cadences fixes).
const FORGE_EMBERS = Array.from({ length: 9 }, (_, i) => ({
  left: `${6 + i * 10 + (i % 2 ? 3 : -2)}%`,
  dur: `${2.4 + (i % 4) * 0.6}s`,
  delay: `${(i * 0.5) % 3}s`,
  drift: `${(i % 2 ? 1 : -1) * (6 + (i % 3) * 6)}px`,
}));

function ForgeBench({ team, onForge }) {
  const T = useT();
  const faces = getDieFaces(team);
  const reserve = team.faceStock || [];
  const [drag, setDrag] = useState(null);       // { stockIndex, slot, sx, sy, x, y }
  const [confirm, setConfirm] = useState(null); // { stockIndex, slot }
  const [burst, setBurst] = useState(null);     // index de slot qui « coule »

  const doForge = (slot, stockIndex) => {
    onForge(slot, stockIndex);
    soundCast();
    setBurst(slot);
    setTimeout(() => setBurst((b) => (b === slot ? null : b)), 1200);
  };
  const tryForge = (stockIndex, slot) => {
    if (isFaceForged(faces[slot])) { setConfirm({ stockIndex, slot }); return; }
    doForge(slot, stockIndex);
  };
  const doConfirm = () => { doForge(confirm.slot, confirm.stockIndex); setConfirm(null); };

  // --- Drag-and-drop (pointer : compatible souris + tactile TBI) ---
  const onPointerDown = (e, stockIndex) => {
    const f = reserve[stockIndex];
    if (!f) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setConfirm(null);
    setDrag({ stockIndex, slot: (f.slot || 1) - 1, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e) => { setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d)); };
  const onPointerUp = (e) => {
    setDrag((d) => {
      if (!d) return null;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const mold = el && el.closest ? el.closest('[data-mold]') : null;
      const overSlot = mold ? Number(mold.dataset.mold) : -1;
      const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8;
      if (overSlot === d.slot) { tryForge(d.stockIndex, d.slot); }
      else if (!moved) { tryForge(d.stockIndex, d.slot); } // simple tap = forge sur son slot
      return null; // drop hors cible → annulé
    });
  };

  const dragFace = drag ? reserve[drag.stockIndex] : null;

  return (
    <section className="shop-stall">
      <div className="forge-bench">
        {/* LE CREUSET — 6 moules de pierre */}
        <div>
          <div className="forge-zone-title">{T('modal.shop.forgeBench')}</div>
          <div className="forge-tray">
            <div className="forge-embers" aria-hidden="true">
              {FORGE_EMBERS.map((e, k) => (
                <span key={k} className="forge-ember" style={{ left: e.left, animationDuration: e.dur, animationDelay: e.delay, '--drift': e.drift }} />
              ))}
            </div>
            {faces.map((face, i) => {
              const cls = 'forge-mold'
                + (drag && drag.slot === i ? ' is-target' : '')
                + (drag && drag.slot !== i ? ' is-locked' : '')
                + (burst === i ? ' is-placed' : '');
              return (
                <div key={i} className={cls} data-mold={i}>
                  <FaceTile face={face} base={i + 1} title={faceEffectLabel(face) || undefined} />
                  {burst === i && <span className="forge-pour" />}
                  {burst === i && (
                    <span className="forge-mold-burst">
                      {MOLD_SPARKS.map((s, k) => (
                        <span key={k} className="forge-mold-spark" style={{ '--x': s.x, '--y': s.y, animationDelay: `${300 + k * 12}ms` }} />
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* L'ÉTABLI — lingots à faire glisser vers leur moule */}
        <div>
          <div className="forge-zone-title">{T('modal.shop.forgeReserve')}<span className="cnt">{reserve.length}/{FACE_STOCK_MAX}</span></div>
          <div className="forge-hint">{T('modal.shop.forgeHintDrag')}</div>
          {reserve.length === 0 ? (
            <div className="forge-empty">{T('modal.shop.forgeReserveEmpty')}</div>
          ) : (
            <div className="forge-reserve-zone">
              <div className="forge-reserve-grid">
                {reserve.map((f, i) => (
                  <div
                    key={i}
                    onPointerDown={(e) => onPointerDown(e, i)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    style={{ touchAction: 'none' }}
                  >
                    <FaceTile face={f} slotTag={f.slot} dim={drag?.stockIndex === i} title={faceEffectLabel(f) || undefined} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {confirm && (
            <div className="forge-confirm">
              <span className="forge-confirm-text">{T('modal.shop.forgeOverwriteSlot', { n: confirm.slot + 1, label: faceShortLabel(faces[confirm.slot]) })}</span>
              <button className="shop-buy" style={{ padding: '6px 14px' }} onClick={doConfirm}>{T('modal.shop.forgeConfirm')}</button>
              <button className="shop-buy" style={{ padding: '6px 14px', background: '#8a7a5e' }} onClick={() => setConfirm(null)}>{T('modal.shop.forgeCancel')}</button>
            </div>
          )}
        </div>
      </div>
      {/* Lingot fantôme suivant le curseur pendant le drag. */}
      {drag && dragFace && (
        <div className="forge-drag-clone" style={{ left: drag.x, top: drag.y }}>
          <FaceTile face={dragFace} size={58} slotTag={dragFace.slot} />
        </div>
      )}
    </section>
  );
}

/* ---------- Étal : recharger ---------- */
function RechargeStall({ ownedPowers, money, onBuyCharge }) {
  const T = useT();
  if (ownedPowers.length === 0) return null;
  return (
    <Stall banner={T('modal.shop.recharge')}>
      {ownedPowers.map(([key, teamPower]) => {
        const power = POWERS[key];
        const charges = teamPower?.charges || 0;
        const full = charges >= MAX_CHARGES;
        const canBuy = money >= power.price && !full;
        return (
          <div className="shop-card" key={key}>
            <div className="shop-card-inner">
              <div className="shop-card-head">
                <CardIcon icon={power.icon} color={power.color} />
                <div className="shop-card-titles">
                  <div className="shop-card-name">{locName(power)}</div>
                </div>
                <ChargePips current={charges} />
              </div>
              <button
                className="shop-buy"
                disabled={!canBuy}
                onClick={() => { soundClick(); onBuyCharge(key); }}
              >
                {full ? T('modal.shop.chargeFull') : <>{T('modal.shop.addCharge')} <Price value={power.price} /></>}
              </button>
            </div>
          </div>
        );
      })}
    </Stall>
  );
}

/* ---------- Étal : améliorer ---------- */
function UpgradeStall({ ownedPowers, money, onUpgrade, masteryOn }) {
  const T = useT();
  const upgradeable = ownedPowers.filter(([key, tp]) => (tp?.level || 1) < maxPowerLevel(key, masteryOn));
  if (upgradeable.length === 0) return null;

  return (
    <Stall banner={T('modal.shop.upgrade')}>
      {upgradeable.map(([key, teamPower]) => {
        const power = POWERS[key];
        const level = teamPower?.level || 1;
        const cost = powerUpgradeCost(key, level, masteryOn);
        const canUpgrade = cost != null && money >= cost;
        // Mode Maîtrise : description « élève » par niveau si la data en fournit une
        // (incrémentale), sinon résumé d'effet générique ; hors Maîtrise = `levels`.
        const treeScaleDesc = masteryOn ? loc(power.tree, 'scaleDesc') : null;
        const lvlDesc = (lv) => {
          if (!masteryOn) return locDesc(power.levels[lv - 1]);
          return (Array.isArray(treeScaleDesc) && treeScaleDesc[lv - 1]) || describePowerScale(key, lv, true);
        };
        const currentDesc = lvlDesc(level);
        const nextDesc = lvlDesc(level + 1);
        const branchNext = masteryOn ? specSlotForLevel(level + 1) : null; // 5 ou 10 = embranchement

        return (
          <div className="shop-card shop-card--wide" key={key}>
            <div className="shop-card-inner">
              <div className="shop-card-head">
                <CardIcon icon={power.icon} color={power.color} />
                <div className="shop-card-titles">
                  <div className="shop-card-name">{locName(power)}</div>
                </div>
                <span className="shop-lvl" style={{ color: power.color }}>
                  {T('modal.shop.level', { a: level, b: level + 1 })}
                </span>
              </div>
              <div className="shop-card-desc">
                <div>{T('modal.shop.current', { desc: currentDesc })}</div>
                <div className="shop-card-next">{T('modal.shop.next', { desc: nextDesc })}</div>
                {branchNext && <div className="shop-card-next" style={{ color: power.color, fontWeight: 700 }}>{T('modal.shop.branchAt', { n: level + 1 })}</div>}
              </div>
              <button
                className="shop-buy shop-buy--purple"
                disabled={!canUpgrade}
                onClick={() => { soundClick(); onUpgrade(key); }}
              >
                {T('modal.shop.upgradeBtn')} <Price value={cost} />
              </button>
            </div>
          </div>
        );
      })}
    </Stall>
  );
}

/* ---------- Étal : débloquer ---------- */
function UnlockStall({ unownedPowers, money, onBuyNew }) {
  const T = useT();
  if (unownedPowers.length === 0) return null;
  return (
    <Stall banner={T('modal.shop.unlock')}>
      {unownedPowers.map(([key, power]) => {
        const canAfford = money >= power.price;
        return (
          <div className="shop-card" key={key} style={{ opacity: canAfford ? 1 : 0.65 }}>
            <div className="shop-card-inner">
              <div className="shop-card-head">
                <CardIcon icon={power.icon} color={power.color} desaturate />
                <div className="shop-card-titles">
                  <div className="shop-card-name">{locName(power)}</div>
                  <div className="shop-card-sub" style={{ color: power.color }}>
                    {power.category === 'def' ? T('modal.shop.defensive') : T('modal.shop.offensive')}
                  </div>
                </div>
              </div>
              <div className="shop-card-desc">{locDesc(power)}</div>
              <button
                className="shop-buy"
                disabled={!canAfford}
                style={canAfford ? { background: `linear-gradient(180deg, ${power.color}cc, ${power.color})` } : undefined}
                onClick={() => { soundClick(); onBuyNew(key); }}
              >
                {T('modal.shop.unlockBtn')} <Price value={power.price} />
              </button>
            </div>
          </div>
        );
      })}
    </Stall>
  );
}

/* ---------- Modale ---------- */
export default function ShopModal() {
  const T = useT();
  const showShop = useGameStore((s) => s.showShop);
  const closeShop = useGameStore((s) => s.closeShop);
  const buyPowerCharge = useGameStore((s) => s.buyPowerCharge);
  const upgradePowerLevel = useGameStore((s) => s.upgradePowerLevel);
  const buyNewPower = useGameStore((s) => s.buyNewPower);
  const buyItem = useGameStore((s) => s.buyItem);
  const buyFace = useGameStore((s) => s.buyFace);
  const forgeFace = useGameStore((s) => s.forgeFace);
  const shopStock = useGameStore((s) => s.shopStock);
  const shopFaceStock = useGameStore((s) => s.shopFaceStock);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const masteryOn = useGameStore((s) => extOn(s.extensions, 'mastery'));
  const forgeOn = useGameStore((s) => extOn(s.extensions, 'forge'));
  const englishMode = useGameStore((s) => s.englishMode);

  const [tab, setTab] = useState('objets'); // 'objets' | 'pouvoirs' | 'faces'

  const team = showShop ? teams[currentTeam] : null;

  const ownedPowers = team
    ? Object.entries(team.powers || {}).filter(([key]) => POWERS[key])
    : [];

  const unownedPowers = team
    ? Object.entries(POWERS).filter(([key]) => !team.powers?.[key])
    : [];

  const marcheNoir = typeof showShop === 'object' && showShop?.marcheNoir;

  // Vitrine normale : on sépare consommables et équipements.
  const consoStock = (shopStock || []).filter((k) => ITEMS[k]?.slot === 'consumable');
  const equipStock = (shopStock || []).filter((k) => ITEMS[k] && ITEMS[k].slot !== 'consumable');

  return (
    <AnimatePresence>
      {showShop && team && (
        marcheNoir ? (
          <TemplePanel title={T('modal.shop.marcheNoir.title')} team={team} onClose={closeShop} medallion={<span style={{ fontSize: 22 }}>🕯️</span>} className="shop shop--marche-noir">
            <div className="inv-wood">
              <div className="shop-scroll">
                <ItemStall
                  team={team}
                  items={showShop.stock}
                  onBuyItem={buyItem}
                  discount={showShop.discount ?? 1}
                  banner={T('modal.shop.marcheNoir.banner')}
                  note={T('modal.shop.marcheNoir.note', { pct: Math.round((1 - (showShop.discount ?? 1)) * 100) })}
                />
              </div>
            </div>
          </TemplePanel>
        ) : (
          <TemplePanel title={T('modal.shop.title')} team={team} onClose={closeShop} medallion={<CoinRune />} className="shop">
            <div className="inv-wood">
              <div className="shop-scroll">
                <div className="shop-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'objets'}
                    className={'shop-tab' + (tab === 'objets' ? ' is-active' : '')}
                    onClick={() => { soundClick(); setTab('objets'); }}
                  >
                    {T('modal.shop.tab.items')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'pouvoirs'}
                    className={'shop-tab' + (tab === 'pouvoirs' ? ' is-active' : '')}
                    onClick={() => { soundClick(); setTab('pouvoirs'); }}
                  >
                    {T('modal.shop.tab.powers')}
                  </button>
                  {forgeOn && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === 'faces'}
                      className={'shop-tab' + (tab === 'faces' ? ' is-active' : '')}
                      onClick={() => { soundClick(); setTab('faces'); }}
                    >
                      {T('modal.shop.tab.faces')}
                    </button>
                  )}
                </div>

                {tab === 'objets' ? (
                  <>
                    <ItemStall team={team} items={consoStock} onBuyItem={buyItem} banner={T('modal.shop.consumables')} />
                    <ItemStall team={team} items={equipStock} onBuyItem={buyItem} banner={T('modal.shop.equipment')} />
                    {consoStock.length === 0 && equipStock.length === 0 && (
                      <div className="shop-empty">{T('modal.shop.empty')}</div>
                    )}
                  </>
                ) : tab === 'faces' ? (
                  <>
                    <FaceStall team={team} faces={shopFaceStock} onBuyFace={buyFace} en={englishMode} />
                    <ForgeBench team={team} onForge={forgeFace} />
                  </>
                ) : (
                  <>
                    <RechargeStall
                      ownedPowers={ownedPowers}
                      money={team.money}
                      onBuyCharge={buyPowerCharge}
                    />
                    <UpgradeStall
                      ownedPowers={ownedPowers}
                      money={team.money}
                      onUpgrade={upgradePowerLevel}
                      masteryOn={masteryOn}
                    />
                    <UnlockStall
                      unownedPowers={unownedPowers}
                      money={team.money}
                      onBuyNew={buyNewPower}
                    />
                  </>
                )}
              </div>
            </div>
          </TemplePanel>
        )
      )}
    </AnimatePresence>
  );
}
