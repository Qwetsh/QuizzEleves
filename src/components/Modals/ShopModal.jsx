// Boutique « Temple moussu » — même langage visuel que l'inventaire :
// le chrome (cadre, plaque, feuillage, a11y) vient de TemplePanel ; ici,
// les étals de parchemin (arrivage d'objets, recharge, amélioration,
// déblocage de pouvoirs) à bannières de bois.
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
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
  if (!items || items.length === 0) return null;
  const bag = team.bag || [];
  const equipment = team.equipment || {};

  return (
    <Stall banner={banner || '\u{1F4E6} Objets'} note={note}>
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
                  <div className="shop-card-name">{item.name}</div>
                  <div className="shop-card-sub" style={{ color: rarityColor }}>
                    {RARITIES[item.rarity]?.name} · {isConsumable ? 'Consommable' : SLOTS[item.slot]?.name}
                  </div>
                </div>
              </div>
              <div className="shop-card-desc">
                {item.desc}
                <EffectDetails item={item} compact />
                {slotTaken && !bagFull && (
                  <div className="shop-card-warn">
                    {SLOTS[item.slot]?.name} occupée {'→'} ira dans le sac
                  </div>
                )}
                {bagFull && <div className="shop-card-warn is-danger">Sac plein !</div>}
              </div>
              <button
                className="shop-buy"
                disabled={!canBuy}
                onClick={() => { soundClick(); onBuyItem(key); }}
              >
                {isConsumable || slotTaken ? 'Acheter' : 'Équiper'}{' '}
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
  if (ownedPowers.length === 0) return null;
  return (
    <Stall banner={'⚡ Recharger'}>
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
                  <div className="shop-card-name">{power.name}</div>
                </div>
                <ChargePips current={charges} />
              </div>
              <button
                className="shop-buy"
                disabled={!canBuy}
                onClick={() => { soundClick(); onBuyCharge(key); }}
              >
                +1 Charge <Price value={power.price} />
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
  const upgradeable = ownedPowers.filter(([key, tp]) => (tp?.level || 1) < maxPowerLevel(key, masteryOn));
  if (upgradeable.length === 0) return null;

  return (
    <Stall banner={'⬆️ Améliorer'}>
      {upgradeable.map(([key, teamPower]) => {
        const power = POWERS[key];
        const level = teamPower?.level || 1;
        const cost = powerUpgradeCost(key, level, masteryOn);
        const canUpgrade = cost != null && money >= cost;
        // Mode Maîtrise : résumés générés (10 niveaux) ; sinon descriptions des `levels`.
        const currentDesc = masteryOn ? describePowerScale(key, level, true) : power.levels[level - 1]?.desc;
        const nextDesc = masteryOn ? describePowerScale(key, level + 1, true) : power.levels[level]?.desc;
        const branchNext = masteryOn ? specSlotForLevel(level + 1) : null; // 5 ou 10 = embranchement

        return (
          <div className="shop-card shop-card--wide" key={key}>
            <div className="shop-card-inner">
              <div className="shop-card-head">
                <CardIcon icon={power.icon} color={power.color} />
                <div className="shop-card-titles">
                  <div className="shop-card-name">{power.name}</div>
                </div>
                <span className="shop-lvl" style={{ color: power.color }}>
                  Niv. {level} {'→'} {level + 1}
                </span>
              </div>
              <div className="shop-card-desc">
                <div>Actuel : {currentDesc}</div>
                <div className="shop-card-next">Suivant : {nextDesc}</div>
                {branchNext && <div className="shop-card-next" style={{ color: power.color, fontWeight: 700 }}>🌟 Choix de voie au niveau {level + 1} !</div>}
              </div>
              <button
                className="shop-buy shop-buy--purple"
                disabled={!canUpgrade}
                onClick={() => { soundClick(); onUpgrade(key); }}
              >
                Améliorer <Price value={cost} />
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
  if (unownedPowers.length === 0) return null;
  return (
    <Stall banner={'\u{1F513} Débloquer'}>
      {unownedPowers.map(([key, power]) => {
        const canAfford = money >= power.price;
        return (
          <div className="shop-card" key={key} style={{ opacity: canAfford ? 1 : 0.65 }}>
            <div className="shop-card-inner">
              <div className="shop-card-head">
                <CardIcon icon={power.icon} color={power.color} desaturate />
                <div className="shop-card-titles">
                  <div className="shop-card-name">{power.name}</div>
                  <div className="shop-card-sub" style={{ color: power.color }}>
                    {power.category === 'def' ? 'Défensif' : 'Offensif'}
                  </div>
                </div>
              </div>
              <div className="shop-card-desc">{power.desc}</div>
              <button
                className="shop-buy"
                disabled={!canAfford}
                style={canAfford ? { background: `linear-gradient(180deg, ${power.color}cc, ${power.color})` } : undefined}
                onClick={() => { soundClick(); onBuyNew(key); }}
              >
                Débloquer <Price value={power.price} />
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
          <TemplePanel title="MARCHÉ NOIR" team={team} onClose={closeShop} medallion={<span style={{ fontSize: 22 }}>🕯️</span>} className="shop shop--marche-noir">
            <div className="inv-wood">
              <div className="shop-scroll">
                <ItemStall
                  team={team}
                  items={showShop.stock}
                  onBuyItem={buyItem}
                  discount={showShop.discount ?? 1}
                  banner={'🕯️ Étals clandestins'}
                  note={`Marchandise « tombée du camion » — ${Math.round((1 - (showShop.discount ?? 1)) * 100)}% sur tout. Pars quand tu veux.`}
                />
              </div>
            </div>
          </TemplePanel>
        ) : (
          <TemplePanel title="BOUTIQUE" team={team} onClose={closeShop} medallion={<CoinRune />} className="shop">
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
                    {'\u{1F9F3}'} Objets
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'pouvoirs'}
                    className={'shop-tab' + (tab === 'pouvoirs' ? ' is-active' : '')}
                    onClick={() => { soundClick(); setTab('pouvoirs'); }}
                  >
                    {'⚡'} Pouvoirs
                  </button>
                </div>

                {tab === 'objets' ? (
                  <>
                    <ItemStall team={team} items={consoStock} onBuyItem={buyItem} banner={'🧪 Consommables'} />
                    <ItemStall team={team} items={equipStock} onBuyItem={buyItem} banner={'🛡️ Équipements'} />
                    {consoStock.length === 0 && equipStock.length === 0 && (
                      <div className="shop-empty">La boutique n'a plus rien à vendre pour le moment.</div>
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
