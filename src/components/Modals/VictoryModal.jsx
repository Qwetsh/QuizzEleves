import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { soundVictory } from '../../logic/sounds';
import ModalOverlay from './ModalOverlay';

const CONFETTI_COLORS = [
  '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F',
  '#BB8FCE', '#FF8C00', '#00CED1', '#FF69B4', '#7FFF00',
];

function ConfettiPiece({ index }) {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const left = `${(index * 7.3 + 3) % 100}%`;
  const delay = `${(index * 0.17) % 2.5}s`;
  const duration = `${2.2 + (index % 5) * 0.4}s`;
  const size = 6 + (index % 4) * 3;

  return (
    <div
      className="confetti-piece"
      style={{
        position: 'absolute',
        bottom: '-10px',
        left,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: index % 3 === 0 ? '50%' : '2px',
        backgroundColor: color,
        animationDelay: delay,
        animationDuration: duration,
        opacity: 0,
      }}
    />
  );
}

export default function VictoryModal() {
  const finished = useGameStore((s) => s.finished);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const reset = useGameStore((s) => s.reset);

  const [dismissed, setDismissed] = useState(false);

  const winner = teams[currentTeam];

  useEffect(() => {
    if (finished && !dismissed) soundVictory();
  }, [finished]);

  const isOpen = finished && !dismissed && !!winner;

  const stats = isOpen
    ? teams.map((t) => {
        const total = t.correct + t.wrong;
        const accuracy = total > 0 ? Math.round((t.correct / total) * 100) : 0;
        return { ...t, total, accuracy };
      })
    : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalOverlay className="max-w-lg">
          {/* Confetti layer */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
            {Array.from({ length: 30 }, (_, i) => (
              <ConfettiPiece key={i} index={i} />
            ))}
          </div>

          <div
            className="relative overflow-hidden"
            style={{ border: '3px solid #FFD700', borderRadius: '1rem' }}
          >
            {/* Gold header */}
            <div
              className="text-center py-6 px-4"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
              }}
            >
              <div className="text-5xl mb-2">
                {"\uD83C\uDFC6"}
              </div>
              <h2 className="text-3xl font-extrabold text-white drop-shadow-lg tracking-wide">
                {"VICTOIRE !"}
              </h2>
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="text-4xl">{winner.emoji}</span>
                <span
                  className="text-2xl font-bold drop-shadow"
                  style={{ color: 'white' }}
                >
                  {winner.name}
                </span>
              </div>
              <div
                className="mt-1 inline-block px-3 py-1 rounded-full text-sm font-semibold"
                style={{ backgroundColor: winner.color, color: 'white' }}
              >
                {"remporte la partie !"}
              </div>
            </div>

            {/* Stats table */}
            <div className="px-5 py-4 bg-gradient-to-b from-yellow-50 via-white to-yellow-50">
              <h3 className="text-center text-lg font-bold text-gray-700 mb-3">
                {"\uD83D\uDCCA R\u00e9sultats"}
              </h3>
              <div className="overflow-hidden rounded-lg border border-yellow-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-yellow-100 text-gray-600">
                      <th className="text-left py-2 px-3 font-semibold">
                        {"\u00C9quipe"}
                      </th>
                      <th className="text-center py-2 px-2 font-semibold">
                        {"\u2705"}
                      </th>
                      <th className="text-center py-2 px-2 font-semibold">
                        {"\u274C"}
                      </th>
                      <th className="text-center py-2 px-2 font-semibold">
                        {"\uD83C\uDFAF %"}
                      </th>
                      <th className="text-center py-2 px-2 font-semibold">
                        {"\u{1F4B0}"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((t, i) => (
                      <tr
                        key={i}
                        className={`border-t border-yellow-100 ${
                          i === currentTeam ? 'bg-yellow-50 font-bold' : ''
                        }`}
                      >
                        <td className="py-2 px-3 flex items-center gap-2">
                          <span className="text-lg">{t.emoji}</span>
                          <span style={{ color: t.color }}>{t.name}</span>
                          {i === currentTeam && (
                            <span className="text-xs">{"\uD83C\uDFC6"}</span>
                          )}
                        </td>
                        <td className="text-center py-2 px-2 text-green-600">
                          {t.correct}
                        </td>
                        <td className="text-center py-2 px-2 text-red-500">
                          {t.wrong}
                        </td>
                        <td className="text-center py-2 px-2">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor:
                                t.accuracy >= 75
                                  ? '#d4edda'
                                  : t.accuracy >= 50
                                  ? '#fff3cd'
                                  : '#f8d7da',
                              color:
                                t.accuracy >= 75
                                  ? '#155724'
                                  : t.accuracy >= 50
                                  ? '#856404'
                                  : '#721c24',
                            }}
                          >
                            {`${t.accuracy}%`}
                          </span>
                        </td>
                        <td className="text-center py-2 px-2 text-yellow-600 font-semibold">
                          {t.money}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 px-5 pb-5 bg-yellow-50">
              <button
                onClick={() => setDismissed(true)}
                className="flex-1 py-2.5 px-4 rounded-lg border-2 border-yellow-400 text-yellow-700 font-semibold hover:bg-yellow-50 transition"
              >
                {"Revoir le plateau"}
              </button>
              <button
                onClick={reset}
                className="flex-1 py-2.5 px-4 rounded-lg font-semibold text-white transition hover:brightness-110"
                style={{
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                }}
              >
                {"Nouvelle partie"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
