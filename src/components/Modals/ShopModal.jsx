import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { POWERS } from '../../data/powers';
import { soundClick } from '../../logic/sounds';
import ModalOverlay from './ModalOverlay';

export default function ShopModal() {
  const showShop = useGameStore((s) => s.showShop);
  const closeShop = useGameStore((s) => s.closeShop);
  const buyPowerCharge = useGameStore((s) => s.buyPowerCharge);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);

  const team = showShop ? teams[currentTeam] : null;
  const allPowers = Object.entries(POWERS);

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

          <div style={{ padding: '16px 22px 22px' }}>
            <div className="flex flex-col gap-2.5">
              {allPowers.map(([key, power]) => {
                const currentCharges = team.powers?.[key]?.charges || 0;
                const canBuy = team.money >= power.price;

                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: 12, borderRadius: 14,
                      background: 'var(--parch-50)',
                      border: '1px solid rgba(122, 94, 58, 0.18)',
                    }}
                  >
                    <div
                      style={{
                        width: 48, height: 48, borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24,
                        background: power.color
                          ? `linear-gradient(180deg, ${power.color}cc, ${power.color})`
                          : 'var(--parch-200)',
                        boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(0,0,0,0.12)',
                        flexShrink: 0,
                      }}
                    >
                      {power.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-900)' }}>
                        {power.name}
                        <span
                          style={{
                            fontSize: 11, padding: '2px 6px', borderRadius: 4, marginLeft: 6,
                            background: power.category === 'def' ? 'rgba(59,108,179,0.15)' : 'rgba(201,71,47,0.15)',
                            color: power.category === 'def' ? 'var(--m-maths-deep)' : 'var(--m-francais-deep)',
                            fontFamily: 'var(--font-ui)', fontWeight: 600,
                          }}
                        >
                          {power.category === 'def' ? 'D\u00c9F' : 'OFF'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.4 }}>{power.desc}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-600)', marginTop: 4 }}>
                        {"Charges : "}<strong>{currentCharges}</strong>{" \u00b7 Prix : "}<strong>{power.price}</strong> <span className="coin" />
                      </div>
                    </div>
                    <button
                      onClick={() => { soundClick(); buyPowerCharge(key); }}
                      disabled={!canBuy}
                      className={`btn btn--sm ${canBuy ? '' : ''}`}
                      style={canBuy ? {} : { opacity: 0.4, cursor: 'not-allowed', filter: 'saturate(0.6)' }}
                      aria-label={`Acheter ${power.name} pour ${power.price} pièces`}
                    >
                      Acheter
                    </button>
                  </div>
                );
              })}
            </div>

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
