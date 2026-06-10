import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { POWERS } from '../../data/powers';
import { soundClick } from '../../logic/sounds';
import ModalOverlay from './ModalOverlay';

function ChargeIndicator({ current, max = 5 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          style={{
            width: 10, height: 10, borderRadius: '50%',
            background: i < current
              ? 'linear-gradient(180deg, #f3c969, #b8862c)'
              : 'rgba(122, 94, 58, 0.18)',
            border: '1px solid rgba(122, 94, 58, 0.25)',
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}

// --- Section: Recharger ---
function RechargeSection({ ownedPowers, money, onBuyCharge }) {
  if (ownedPowers.length === 0) return null;
  return (
    <div>
      <SectionHeader icon={"\u26A1"} label="Recharger" />
      <div className="scroll-hidden" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {ownedPowers.map(([key, teamPower]) => {
          const power = POWERS[key];
          const charges = teamPower?.charges || 0;
          const canBuy = money >= power.price;
          return (
            <div
              key={key}
              style={{
                flex: '0 0 220px',
                borderRadius: 14,
                border: `2px solid ${power.color}33`,
                background: `linear-gradient(135deg, ${power.color}0a, ${power.color}14)`,
                padding: '12px 16px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PowerIcon power={power} size={32} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink-900)', flex: 1 }}>
                  {power.name}
                </span>
                <ChargeIndicator current={charges} />
              </div>
              <button
                onClick={() => { soundClick(); onBuyCharge(key); }}
                disabled={!canBuy}
                style={{
                  ...goldBtnStyle(canBuy),
                  padding: '6px 10px', fontSize: 13,
                }}
              >
                +1 Charge ({power.price} <span className="coin" style={{ filter: 'brightness(1.3)' }} />)
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Section: Améliorer ---
function UpgradeSection({ ownedPowers, money, onUpgrade }) {
  const upgradeable = ownedPowers.filter(([key, tp]) => {
    const maxLevel = POWERS[key].levels.length;
    return (tp?.level || 1) < maxLevel;
  });
  if (upgradeable.length === 0) return null;

  return (
    <div>
      <SectionHeader icon={"\u2B06\uFE0F"} label="Améliorer" />
      <div className="scroll-hidden" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {upgradeable.map(([key, teamPower]) => {
          const power = POWERS[key];
          const level = teamPower?.level || 1;
          const cost = power.upgradeCosts[level - 1];
          const canUpgrade = money >= cost;
          const currentDesc = power.levels[level - 1]?.desc;
          const nextDesc = power.levels[level]?.desc;

          return (
            <div
              key={key}
              style={{
                flex: '0 0 300px',
                borderRadius: 14,
                border: `2px solid ${power.color}33`,
                background: `linear-gradient(135deg, ${power.color}0a, ${power.color}14)`,
                padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PowerIcon power={power} size={32} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink-900)' }}>
                    {power.name}
                  </span>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: 6,
                  background: `${power.color}20`, border: `1px solid ${power.color}35`,
                  fontFamily: 'var(--font-display)', fontSize: 12, color: power.color,
                }}>
                  Niv. {level} {"\u2192"} {level + 1}
                </span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.4 }}>
                <div>Actuel : {currentDesc}</div>
                <div style={{ color: 'var(--ink-700)', fontWeight: 600 }}>Suivant : {nextDesc}</div>
              </div>

              <button
                onClick={() => { soundClick(); onUpgrade(key); }}
                disabled={!canUpgrade}
                style={{
                  ...purpleBtnStyle(canUpgrade),
                  padding: '6px 10px', fontSize: 13,
                }}
              >
                Améliorer ({cost} <span className="coin" style={{ filter: 'brightness(1.3)' }} />)
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Section: Débloquer ---
function UnlockSection({ unownedPowers, money, onBuyNew }) {
  if (unownedPowers.length === 0) return null;
  return (
    <div>
      <SectionHeader icon={"\u{1F513}"} label="Débloquer" />
      <div className="scroll-hidden" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {unownedPowers.map(([key, power]) => {
          const canAfford = money >= power.price;
          return (
            <div
              key={key}
              style={{
                flex: '0 0 190px',
                borderRadius: 14,
                border: `2px solid ${power.color}22`,
                background: `linear-gradient(135deg, ${power.color}06, ${power.color}0d)`,
                padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 8,
                opacity: canAfford ? 1 : 0.55,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PowerIcon power={power} size={32} desaturate />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink-800)' }}>
                    {power.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>
                    {power.category === 'def' ? 'Défensif' : 'Offensif'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.3 }}>
                {power.desc}
              </div>
              <button
                onClick={() => { soundClick(); onBuyNew(key); }}
                disabled={!canAfford}
                style={{
                  padding: '6px 10px', borderRadius: 10, border: 'none',
                  fontFamily: 'var(--font-display)', fontSize: 13,
                  cursor: canAfford ? 'pointer' : 'not-allowed',
                  background: canAfford
                    ? `linear-gradient(180deg, ${power.color}cc, ${power.color})`
                    : 'rgba(122, 94, 58, 0.15)',
                  color: canAfford ? '#fff' : 'var(--ink-400)',
                  boxShadow: canAfford
                    ? 'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 0 rgba(0,0,0,0.2)'
                    : 'none',
                  transition: 'all .15s',
                }}
              >
                Débloquer ({power.price} <span className="coin" style={{ filter: 'brightness(1.3)' }} />)
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Shared components ---

function SectionHeader({ icon, label }) {
  return (
    <h3 style={{
      fontFamily: 'var(--font-display)', fontSize: 13,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--ink-500)', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span>{icon}</span> {label}
    </h3>
  );
}

function PowerIcon({ power, size = 36, desaturate = false }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: size * 0.25,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.55,
        background: `linear-gradient(180deg, ${power.color}cc, ${power.color})`,
        boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.12)',
        filter: desaturate ? 'saturate(0.6)' : 'none',
        flexShrink: 0,
      }}
    >
      {power.icon}
    </span>
  );
}

function goldBtnStyle(enabled) {
  return {
    borderRadius: 10, border: 'none',
    fontFamily: 'var(--font-display)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled
      ? 'linear-gradient(180deg, #f3c969, #b8862c)'
      : 'rgba(122, 94, 58, 0.15)',
    color: enabled ? '#fff' : 'var(--ink-400)',
    boxShadow: enabled
      ? 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 0 rgba(110,78,16,0.4)'
      : 'none',
    opacity: enabled ? 1 : 0.5,
    transition: 'all .15s',
  };
}

function purpleBtnStyle(enabled) {
  return {
    borderRadius: 10, border: 'none',
    fontFamily: 'var(--font-display)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled
      ? 'linear-gradient(180deg, #a86cda, #7434b0)'
      : 'rgba(122, 94, 58, 0.15)',
    color: enabled ? '#fff' : 'var(--ink-400)',
    boxShadow: enabled
      ? 'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 0 rgba(80,30,120,0.4)'
      : 'none',
    opacity: enabled ? 1 : 0.5,
    transition: 'all .15s',
  };
}

// --- Main modal ---

export default function ShopModal() {
  const showShop = useGameStore((s) => s.showShop);
  const closeShop = useGameStore((s) => s.closeShop);
  const buyPowerCharge = useGameStore((s) => s.buyPowerCharge);
  const upgradePowerLevel = useGameStore((s) => s.upgradePowerLevel);
  const buyNewPower = useGameStore((s) => s.buyNewPower);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);

  const team = showShop ? teams[currentTeam] : null;

  const ownedPowers = team
    ? Object.entries(team.powers || {}).filter(([key]) => POWERS[key])
    : [];

  const unownedPowers = team
    ? Object.entries(POWERS).filter(([key]) => !team.powers?.[key])
    : [];

  return (
    <AnimatePresence>
      {showShop && team && (
        <ModalOverlay onClose={closeShop} className="max-w-2xl">
          {/* Header */}
          <div
            style={{
              padding: '20px 26px 14px', textAlign: 'center',
              background: 'linear-gradient(180deg, #fff3d4 0%, #f0e0b2 100%)',
            }}
          >
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 6 }}>
              {"\u{1F6D2}"} Boutique des pouvoirs
            </h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="text-lg">{team.emoji}</span>
              <strong style={{ color: team.color, fontFamily: 'var(--font-display)' }}>{team.name}</strong>
              <span
                style={{
                  padding: '3px 10px', borderRadius: 999,
                  background: 'linear-gradient(180deg, #f3c969, #b8862c)',
                  color: '#fff', fontFamily: 'var(--font-display)', fontSize: 13,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 0 rgba(110,78,16,0.4)',
                }}
              >
                {team.money} <span className="coin" style={{ filter: 'brightness(1.2)' }} />
              </span>
            </div>
          </div>

          {/* Body — sections */}
          <div style={{ padding: '16px 22px 22px', maxHeight: '65vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <RechargeSection
              ownedPowers={ownedPowers}
              money={team.money}
              onBuyCharge={buyPowerCharge}
            />
            <UpgradeSection
              ownedPowers={ownedPowers}
              money={team.money}
              onUpgrade={upgradePowerLevel}
            />
            <UnlockSection
              unownedPowers={unownedPowers}
              money={team.money}
              onBuyNew={buyNewPower}
            />

            <button
              className="btn btn--ghost"
              onClick={closeShop}
              style={{ width: '100%' }}
            >
              Fermer
            </button>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
