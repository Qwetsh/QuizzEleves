// Boutique « Temple moussu » — même langage visuel que l'inventaire :
// le chrome (cadre, plaque, feuillage, a11y) vient de TemplePanel ; ici,
// les étals de parchemin (arrivage d'objets, recharge, amélioration,
// déblocage de pouvoirs) à bannières de bois.
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { POWERS } from '../../data/powers';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { BAG_SIZE } from '../../store/itemHandlers';
import { soundClick } from '../../logic/sounds';
import { describeItemEffects } from '../../logic/effectText';
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

/* ---------- Étal : objets (stock rotatif ou marché noir) ---------- */
function ItemStall({ team, shopStock, shopStockTurns, onBuyItem, discount = 1, banner, note }) {
  if (!shopStock || shopStock.length === 0) return null;
  const bag = team.bag || [];
  const equipment = team.equipment || {};

  return (
    <Stall
      banner={banner || '\u{1F4E6} Arrivage du moment'}
      note={note != null ? note : `Nouvel arrivage dans ${shopStockTurns} tour${shopStockTurns > 1 ? 's' : ''}`}
    >
      {shopStock.map((key, idx) => {
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
                {describeItemEffects(item).length > 0 && (
                  <ul style={{ margin: '5px 0 0', padding: '0 0 0 15px', fontSize: 11.5, color: 'var(--ink-600)', lineHeight: 1.4 }}>
                    {describeItemEffects(item).map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                )}
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
function UpgradeStall({ ownedPowers, money, onUpgrade }) {
  const upgradeable = ownedPowers.filter(([key, tp]) => {
    const maxLevel = POWERS[key].levels.length;
    return (tp?.level || 1) < maxLevel;
  });
  if (upgradeable.length === 0) return null;

  return (
    <Stall banner={'⬆️ Améliorer'}>
      {upgradeable.map(([key, teamPower]) => {
        const power = POWERS[key];
        const level = teamPower?.level || 1;
        const cost = power.upgradeCosts[level - 1];
        const canUpgrade = money >= cost;
        const currentDesc = power.levels[level - 1]?.desc;
        const nextDesc = power.levels[level]?.desc;

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
  const shopStockTurns = useGameStore((s) => s.shopStockTurns);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);

  const team = showShop ? teams[currentTeam] : null;

  const ownedPowers = team
    ? Object.entries(team.powers || {}).filter(([key]) => POWERS[key])
    : [];

  const unownedPowers = team
    ? Object.entries(POWERS).filter(([key]) => !team.powers?.[key])
    : [];

  const marcheNoir = typeof showShop === 'object' && showShop?.marcheNoir;

  return (
    <AnimatePresence>
      {showShop && team && (
        marcheNoir ? (
          <TemplePanel title="MARCHÉ NOIR" team={team} onClose={closeShop} medallion={<span style={{ fontSize: 22 }}>🕯️</span>} className="shop shop--marche-noir">
            <div className="inv-wood">
              <div className="shop-scroll">
                <ItemStall
                  team={team}
                  shopStock={showShop.stock}
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
                <ItemStall
                  team={team}
                  shopStock={shopStock}
                  shopStockTurns={shopStockTurns}
                  onBuyItem={buyItem}
                />
                <RechargeStall
                  ownedPowers={ownedPowers}
                  money={team.money}
                  onBuyCharge={buyPowerCharge}
                />
                <UpgradeStall
                  ownedPowers={ownedPowers}
                  money={team.money}
                  onUpgrade={upgradePowerLevel}
                />
                <UnlockStall
                  unownedPowers={unownedPowers}
                  money={team.money}
                  onBuyNew={buyNewPower}
                />
              </div>
            </div>
          </TemplePanel>
        )
      )}
    </AnimatePresence>
  );
}
