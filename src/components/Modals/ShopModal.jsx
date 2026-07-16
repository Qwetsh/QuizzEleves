// Boutique « Temple moussu » — même langage visuel que l'inventaire :
// le chrome (cadre, plaque, feuillage, a11y) vient de TemplePanel ; ici,
// les étals de parchemin (arrivage d'objets, recharge, amélioration,
// déblocage de pouvoirs) à bannières de bois.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { locName, locDesc, loc } from '../../i18n/content';
import { POWERS, MAX_CHARGES } from '../../data/powers';
import { maxPowerLevel, powerUpgradeCost, describePowerScale, specSlotForLevel } from '../../logic/powerEffects';
import { extOn } from '../../extensions/registry';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { BAG_SIZE } from '../../store/itemHandlers';
import { soundClick } from '../../logic/sounds';
import { TemplePanel, CoinRune } from './TempleDecor';
import { itemImg } from '../../logic/itemAssets';
import { itemEffectLines } from '../../logic/effectText';
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
        return (
          <ItemCard key={`${key}-${idx}`} item={item} itemKey={key} knownIngredients={team.knownIngredients || []}
            bag={bag} equipment={equipment} money={team.money}
            discount={discount} onBuy={() => { soundClick(); onBuyItem(key); }} T={T} />
        );
      })}
    </Stall>
  );
}

/* ---------- Carte d'un objet (visuel « carte à collectionner ») ---------- */
function ItemCard({ item, itemKey, knownIngredients, bag, equipment, money, discount, onBuy, T }) {
  const [fxOpen, setFxOpen] = useState(false);
  const rarityColor = RARITIES[item.rarity]?.color || '#888';
  const isConsumable = item.slot === 'consumable';
  const slotTaken = !isConsumable && !!equipment[item.slot];
  const needsBagRoom = isConsumable || slotTaken;
  const bagFull = needsBagRoom && bag.filter(Boolean).length >= BAG_SIZE;
  const price = discount < 1 ? Math.max(1, Math.round(item.price * discount)) : item.price;
  const canBuy = money >= price && !bagFull;
  // Ingrédient d'alchimie : effet caché (???) tant que l'équipe ne l'a pas découvert.
  const fx = itemEffectLines(item, { key: itemKey, knownIngredients });
  const img = itemImg(item);
  const slotName = isConsumable ? T('modal.item.consumable') : SLOTS[item.slot]?.name;

  return (
    <div className="shop-itemcard" style={{ '--rar': rarityColor }}>
      <div className="sic-banner-top">
        <div className="sic-name">{locName(item)}</div>
        <div className="sic-sub">{RARITIES[item.rarity]?.name} · {slotName}</div>
      </div>

      <div className="sic-art">
        <span className="sic-coin">{price}</span>
        {img
          ? <img className="sic-img" src={img} alt={locName(item)} draggable={false} />
          : <span className="sic-emoji">{item.icon}</span>}
        {fx.length > 0 && (
          <button type="button" className="sic-info" onClick={() => setFxOpen(true)} title={T('modal.shop.fxDetail')} aria-label={T('modal.shop.fxDetail')}>
            i
          </button>
        )}
      </div>

      <div className="sic-banner-bot">
        <div className="sic-desc">{locDesc(item)}</div>
        {bagFull
          ? <div className="shop-card-warn is-danger">{T('modal.shop.bagFull')}</div>
          : slotTaken && <div className="shop-card-warn">{T('modal.shop.slotTaken', { slot: slotName })}</div>}
      </div>

      <button className="shop-buy sic-buy" disabled={!canBuy} onClick={onBuy}>
        {isConsumable || slotTaken ? T('common.buy') : T('common.equip')}{' '}
        {discount < 1 && <s style={{ opacity: 0.6, marginRight: 4 }}>{item.price}</s>}
        <Price value={price} />
      </button>

      {/* Détail des effets : MODALE (portail) — n'altère plus la carte. */}
      {fxOpen && createPortal(
        <div className="inv-card-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) setFxOpen(false); }}>
          <div className="inv-card" style={{ '--rar': rarityColor }} onPointerDown={(e) => e.stopPropagation()}>
            <div className="inv-card-head">
              <div className="inv-card-img">
                {img ? <img src={img} alt="" draggable={false} /> : <span className="inv-card-emoji">{item.icon}</span>}
              </div>
              <div className="inv-card-name">{locName(item)}</div>
              <div className="inv-card-rar">◆ {RARITIES[item.rarity]?.name} · {slotName}</div>
            </div>
            <div className="inv-card-body">
              {item.desc && <div className="inv-card-desc">{locDesc(item)}</div>}
              {fx.length > 0 && (
                <>
                  <div className="inv-card-fxlabel">{T('modal.item.effects')}</div>
                  {fx.map((l, i) => <div key={i} className="inv-card-fxrow"><span className="ic">✦</span><span>{l}</span></div>)}
                </>
              )}
              <div className="inv-card-actions">
                <button className="inv-card-btn inv-card-btn--sell inv-card-btn--x" onClick={() => setFxOpen(false)}>✕</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
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
              {/* Pas de couleur inline : le doré rétro (retro-game.css) fait foi ;
                  l'identité du pouvoir reste portée par l'icône et le sous-titre. */}
              <button
                className="shop-buy"
                disabled={!canAfford}
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
// `dock` (mode « jeu en ligne ») : la boutique devient PRIVÉE — elle s'ouvre
// localement pour MON équipe (dock.teamIdx), et chaque achat part en intent
// d'équipe (dock.dispatch) au lieu de muter l'équipe active du TBI.
// Sans `dock` : comportement TBI historique (store showShop + équipe active).
export default function ShopModal({ dock = null }) {
  const T = useT();
  const showShopState = useGameStore((s) => s.showShop);
  const closeShop = useGameStore((s) => s.closeShop);
  const buyPowerCharge = useGameStore((s) => s.buyPowerCharge);
  const upgradePowerLevel = useGameStore((s) => s.upgradePowerLevel);
  const buyNewPower = useGameStore((s) => s.buyNewPower);
  const buyItem = useGameStore((s) => s.buyItem);
  const shopStock = useGameStore((s) => s.shopStock);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const masteryOn = useGameStore((s) => extOn(s.extensions, 'mastery'));

  const [tab, setTab] = useState('objets'); // 'objets' | 'pouvoirs'

  const showShop = dock ? dock.open : showShopState;
  const teamIdx = dock ? dock.teamIdx : currentTeam;
  const onClose = dock ? dock.onClose : closeShop;
  const doBuyItem = dock ? (key) => dock.dispatch('buyItem', { key }) : buyItem;
  const doBuyCharge = dock ? (key) => dock.dispatch('buyPowerCharge', { key }) : buyPowerCharge;
  const doUpgrade = dock ? (key) => dock.dispatch('upgradePower', { key }) : upgradePowerLevel;
  const doBuyNew = dock ? (key) => dock.dispatch('buyPower', { key }) : buyNewPower;

  const team = showShop ? teams[teamIdx] : null;

  const ownedPowers = team
    ? Object.entries(team.powers || {}).filter(([key]) => POWERS[key])
    : [];

  const unownedPowers = team
    ? Object.entries(POWERS).filter(([key]) => !team.powers?.[key])
    : [];

  const marcheNoir = !dock && typeof showShop === 'object' && showShop?.marcheNoir;

  // Vitrine normale : on sépare consommables et équipements.
  const consoStock = (shopStock || []).filter((k) => ITEMS[k]?.slot === 'consumable');
  const equipStock = (shopStock || []).filter((k) => ITEMS[k] && ITEMS[k].slot !== 'consumable');

  return (
    <AnimatePresence>
      {showShop && team && (
        marcheNoir ? (
          <TemplePanel title={T('modal.shop.marcheNoir.title')} team={team} onClose={onClose} medallion={<span style={{ fontSize: 22 }}>🕯️</span>} className="shop shop--marche-noir">
            <div className="inv-wood">
              <div className="shop-scroll">
                <ItemStall
                  team={team}
                  items={showShop.stock}
                  onBuyItem={doBuyItem}
                  discount={showShop.discount ?? 1}
                  banner={T('modal.shop.marcheNoir.banner')}
                  note={T('modal.shop.marcheNoir.note', { pct: Math.round((1 - (showShop.discount ?? 1)) * 100) })}
                />
              </div>
            </div>
          </TemplePanel>
        ) : (
          <TemplePanel title={T('modal.shop.title')} team={team} onClose={onClose} medallion={<CoinRune />} className="shop">
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
                </div>

                {tab === 'objets' ? (
                  <>
                    <ItemStall team={team} items={consoStock} onBuyItem={doBuyItem} banner={T('modal.shop.consumables')} />
                    <ItemStall team={team} items={equipStock} onBuyItem={doBuyItem} banner={T('modal.shop.equipment')} />
                    {consoStock.length === 0 && equipStock.length === 0 && (
                      <div className="shop-empty">{T('modal.shop.empty')}</div>
                    )}
                  </>
                ) : (
                  <>
                    <RechargeStall
                      ownedPowers={ownedPowers}
                      money={team.money}
                      onBuyCharge={doBuyCharge}
                    />
                    <UpgradeStall
                      ownedPowers={ownedPowers}
                      money={team.money}
                      onUpgrade={doUpgrade}
                      masteryOn={masteryOn}
                    />
                    <UnlockStall
                      unownedPowers={unownedPowers}
                      money={team.money}
                      onBuyNew={doBuyNew}
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
