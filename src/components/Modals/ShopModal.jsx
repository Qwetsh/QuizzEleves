// Boutique « Temple moussu » — même langage visuel que l'inventaire :
// le chrome (cadre, plaque, feuillage, a11y) vient de TemplePanel ; ici,
// les étals de parchemin (arrivage d'objets, recharge, amélioration,
// déblocage de pouvoirs) à bannières de bois.
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { locName, locDesc } from '../../i18n/content';
import { POWERS } from '../../data/powers';
import { maxPowerLevel, powerUpgradeCost, describePowerScale, specSlotForLevel } from '../../logic/powerEffects';
import { extOn } from '../../extensions/registry';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { BAG_SIZE } from '../../store/itemHandlers';
import { soundClick } from '../../logic/sounds';
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

function ChargePips({ current, max = 5 }) {
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

/* ---------- Étal : recharger ---------- */
function RechargeStall({ ownedPowers, money, onBuyCharge }) {
  const T = useT();
  if (ownedPowers.length === 0) return null;
  return (
    <Stall banner={T('modal.shop.recharge')}>
      {ownedPowers.map(([key, teamPower]) => {
        const power = POWERS[key];
        const charges = teamPower?.charges || 0;
        const canBuy = money >= power.price;
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
                {T('modal.shop.addCharge')} <Price value={power.price} />
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
        // Mode Maîtrise : résumés générés (10 niveaux) ; sinon descriptions des `levels`.
        const currentDesc = masteryOn ? describePowerScale(key, level, true) : locDesc(power.levels[level - 1]);
        const nextDesc = masteryOn ? describePowerScale(key, level + 1, true) : locDesc(power.levels[level]);
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
  const shopStock = useGameStore((s) => s.shopStock);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const masteryOn = useGameStore((s) => extOn(s.extensions, 'mastery'));

  const [tab, setTab] = useState('objets'); // 'objets' | 'pouvoirs'

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
                </div>

                {tab === 'objets' ? (
                  <>
                    <ItemStall team={team} items={consoStock} onBuyItem={buyItem} banner={T('modal.shop.consumables')} />
                    <ItemStall team={team} items={equipStock} onBuyItem={buyItem} banner={T('modal.shop.equipment')} />
                    {consoStock.length === 0 && equipStock.length === 0 && (
                      <div className="shop-empty">{T('modal.shop.empty')}</div>
                    )}
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
