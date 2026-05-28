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

function PowerCard({ powerKey, power, teamPower, money, onBuyCharge, onUpgrade }) {
  const level = teamPower?.level || 1;
  const charges = teamPower?.charges || 0;
  const maxLevel = power.levels.length;
  const isMaxLevel = level >= maxLevel;
  const upgradeCost = !isMaxLevel ? power.upgradeCosts[level - 1] : null;
  const canBuyCharge = money >= power.price;
  const canUpgrade = !isMaxLevel && money >= upgradeCost;
  const currentDesc = power.levels[level - 1]?.desc;
  const nextDesc = !isMaxLevel ? power.levels[level]?.desc : null;

  return (
    <div
      style={{
        borderRadius: 16,
        border: `2px solid ${power.color}44`,
        background: `linear-gradient(135deg, ${power.color}0d 0%, ${power.color}18 100%)`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px 8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 40, height: 40, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
              background: `linear-gradient(180deg, ${power.color}cc, ${power.color})`,
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(0,0,0,0.12)',
            }}
          >
            {power.icon}
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-900)' }}>
            {power.name}
          </span>
        </div>
        <span
          style={{
            padding: '3px 10px', borderRadius: 8,
            background: `${power.color}25`,
            border: `1px solid ${power.color}40`,
            fontFamily: 'var(--font-display)', fontSize: 13,
            color: power.color,
          }}
        >
          Niveau {level}/{maxLevel}
        </span>
      </div>

      {/* Description */}
      <div style={{ padding: '0 16px 8px', fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.4 }}>
        &laquo; {currentDesc} &raquo;
      </div>

      {/* Charges + activation cost */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px 12px',
          fontSize: 13, color: 'var(--ink-600)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Charges : <ChargeIndicator current={charges} />
        </span>
        {power.activationCost > 0 && (
          <span>
            Activation : <strong>{power.activationCost}</strong> <span className="coin" />
          </span>
        )}
      </div>

      {/* Buttons */}
      <div
        style={{
          display: 'flex', gap: 8, padding: '0 16px 12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Buy charge */}
        <button
          onClick={() => { soundClick(); onBuyCharge(powerKey); }}
          disabled={!canBuyCharge}
          style={{
            flex: 1, minWidth: 120,
            padding: '8px 12px', borderRadius: 10, border: 'none',
            fontFamily: 'var(--font-display)', fontSize: 13,
            cursor: canBuyCharge ? 'pointer' : 'not-allowed',
            background: canBuyCharge
              ? 'linear-gradient(180deg, #f3c969, #b8862c)'
              : 'rgba(122, 94, 58, 0.15)',
            color: canBuyCharge ? '#fff' : 'var(--ink-400)',
            boxShadow: canBuyCharge
              ? 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 0 rgba(110,78,16,0.4)'
              : 'none',
            opacity: canBuyCharge ? 1 : 0.5,
            transition: 'all .15s',
          }}
          aria-label={`Acheter une charge de ${power.name} pour ${power.price} pieces`}
        >
          +1 Charge ({power.price} <span className="coin" style={{ filter: 'brightness(1.3)' }} />)
        </button>

        {/* Upgrade */}
        {!isMaxLevel && (
          <button
            onClick={() => { soundClick(); onUpgrade(powerKey); }}
            disabled={!canUpgrade}
            style={{
              flex: 1, minWidth: 120,
              padding: '8px 12px', borderRadius: 10, border: 'none',
              fontFamily: 'var(--font-display)', fontSize: 13,
              cursor: canUpgrade ? 'pointer' : 'not-allowed',
              background: canUpgrade
                ? 'linear-gradient(180deg, #a86cda, #7434b0)'
                : 'rgba(122, 94, 58, 0.15)',
              color: canUpgrade ? '#fff' : 'var(--ink-400)',
              boxShadow: canUpgrade
                ? 'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 0 rgba(80,30,120,0.4)'
                : 'none',
              opacity: canUpgrade ? 1 : 0.5,
              transition: 'all .15s',
            }}
            aria-label={`Ameliorer ${power.name} au niveau ${level + 1} pour ${upgradeCost} pieces`}
          >
            {"\u2B06"} Niveau {level + 1} ({upgradeCost} <span className="coin" style={{ filter: 'brightness(1.3)' }} />)
          </button>
        )}
      </div>

      {/* Next level preview */}
      {nextDesc && (
        <div
          style={{
            padding: '8px 16px 10px',
            borderTop: `1px solid ${power.color}20`,
            fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic',
          }}
        >
          Prochain niveau : &laquo; {nextDesc} &raquo;
        </div>
      )}
    </div>
  );
}

export default function ShopModal() {
  const showShop = useGameStore((s) => s.showShop);
  const closeShop = useGameStore((s) => s.closeShop);
  const buyPowerCharge = useGameStore((s) => s.buyPowerCharge);
  const upgradePowerLevel = useGameStore((s) => s.upgradePowerLevel);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);

  const team = showShop ? teams[currentTeam] : null;

  const buyNewPower = useGameStore((s) => s.buyNewPower);

  // Powers the team already owns
  const ownedPowers = team
    ? Object.entries(team.powers || {}).filter(([key]) => POWERS[key])
    : [];

  // Powers the team doesn't own yet
  const unownedPowers = team
    ? Object.entries(POWERS).filter(([key]) => !team.powers?.[key])
    : [];

  return (
    <AnimatePresence>
      {showShop && team && (
        <ModalOverlay onClose={closeShop} className="max-w-md">
          {/* Gold header */}
          <div
            style={{
              padding: '24px 26px 16px', textAlign: 'center',
              background: 'linear-gradient(180deg, #fff3d4 0%, #f0e0b2 100%)',
            }}
          >
            <div style={{ fontSize: 42, marginBottom: 6 }}>{"\u{1F6D2}"}</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>Boutique des pouvoirs</h2>
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
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

          <div style={{ padding: '16px 22px 22px', maxHeight: '60vh', overflowY: 'auto' }}>
            {/* Owned powers */}
            {ownedPowers.length > 0 && (
              <>
                <h3 style={{
                  fontFamily: 'var(--font-display)', fontSize: 14,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--ink-500)', marginBottom: 10,
                }}>
                  Vos pouvoirs
                </h3>
                <div className="flex flex-col gap-3">
                  {ownedPowers.map(([key, teamPower]) => (
                    <PowerCard
                      key={key}
                      powerKey={key}
                      power={POWERS[key]}
                      teamPower={teamPower}
                      money={team.money}
                      onBuyCharge={buyPowerCharge}
                      onUpgrade={upgradePowerLevel}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Unowned powers */}
            {unownedPowers.length > 0 && (
              <>
                <h3 style={{
                  fontFamily: 'var(--font-display)', fontSize: 14,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--ink-500)', marginTop: ownedPowers.length > 0 ? 20 : 0, marginBottom: 10,
                }}>
                  {ownedPowers.length > 0 ? 'Nouveaux pouvoirs' : 'Pouvoirs disponibles'}
                </h3>
                <div className="flex flex-col gap-3">
                  {unownedPowers.map(([key, power]) => {
                    const unlockPrice = power.price;
                    const canAfford = team.money >= unlockPrice;
                    return (
                      <div
                        key={key}
                        style={{
                          borderRadius: 16,
                          border: `2px solid ${power.color}33`,
                          background: `linear-gradient(135deg, ${power.color}08 0%, ${power.color}10 100%)`,
                          opacity: canAfford ? 1 : 0.6,
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 8px' }}>
                          <span
                            style={{
                              width: 40, height: 40, borderRadius: 10,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 22,
                              background: `linear-gradient(180deg, ${power.color}99, ${power.color}cc)`,
                              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -3px 0 rgba(0,0,0,0.1)',
                              filter: 'saturate(0.7)',
                            }}
                          >
                            {power.icon}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-800)' }}>
                              {power.name}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                              {power.category === 'def' ? 'D\u00e9fensif' : 'Offensif'} &middot; {power.desc}
                            </div>
                          </div>
                        </div>
                        <div style={{ padding: '4px 16px 12px' }}>
                          <button
                            onClick={() => { soundClick(); buyNewPower(key); }}
                            disabled={!canAfford}
                            style={{
                              width: '100%',
                              padding: '8px 12px', borderRadius: 10, border: 'none',
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
                            {`D\u00e9bloquer (${unlockPrice} `}<span className="coin" style={{ filter: 'brightness(1.3)' }} />{')'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <button
              className="btn btn--ghost"
              onClick={closeShop}
              style={{ width: '100%', marginTop: 16 }}
            >
              Fermer
            </button>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
