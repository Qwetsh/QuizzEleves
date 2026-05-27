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
          <div className="p-6">
            <div className="text-center mb-4">
              <div className="text-4xl mb-1">{"\u{1F6D2}"}</div>
              <h2 className="text-xl font-bold">Boutique</h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-lg">{team.emoji}</span>
                <span className="font-semibold" style={{ color: team.color }}>{team.name}</span>
                <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-sm font-bold rounded">
                  {team.money} {"\u{1F4B0}"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {allPowers.map(([key, power]) => {
                const currentCharges = team.powers?.[key]?.charges || 0;
                const canBuy = team.money >= power.price;

                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-white"
                  >
                    <span className="text-2xl">{power.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{power.name}</div>
                      <div className="text-xs text-[var(--muted)] truncate">{power.desc}</div>
                      <div className="text-xs mt-0.5">
                        {"Charges : "}<span className="font-bold">{currentCharges}</span>
                        {" \u2022 Prix : "}<span className="font-bold">{power.price} {"\u{1F4B0}"}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { soundClick(); buyPowerCharge(key); }}
                      disabled={!canBuy}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${
                        canBuy
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Acheter
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={closeShop}
              className="mt-4 w-full py-2 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600 transition"
            >
              Fermer
            </button>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
