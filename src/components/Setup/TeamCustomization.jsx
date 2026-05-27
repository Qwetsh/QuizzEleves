import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { EMOJI_OPTIONS } from '../../data/teamPresets';

export default function TeamCustomization() {
  const setupTeams = useGameStore((s) => s.setupTeams);
  const updateSetupTeam = useGameStore((s) => s.updateSetupTeam);
  const [emojiPicker, setEmojiPicker] = useState(null); // index or null

  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold mb-2 text-[var(--muted)]">
        {"\u00c9quipes"}
      </label>
      <div className="space-y-2">
        {setupTeams.map((team, i) => (
          <div
            key={i}
            className="flex items-center gap-2 bg-white rounded-lg p-2 border border-[var(--border)]"
          >
            <div
              className="w-4 h-8 rounded"
              style={{ background: team.color }}
            />
            <button
              className="text-2xl w-10 h-10 flex items-center justify-center rounded hover:bg-gray-100 transition"
              onClick={() => setEmojiPicker(emojiPicker === i ? null : i)}
              title="Changer l'emoji"
            >
              {team.emoji}
            </button>
            <input
              type="text"
              value={team.name}
              onChange={(e) => updateSetupTeam(i, { name: e.target.value })}
              className="flex-1 px-3 py-1.5 border border-[var(--border)] rounded text-sm bg-[var(--bg)]"
              maxLength={20}
            />
          </div>
        ))}
      </div>

      {emojiPicker !== null && (
        <div className="mt-2 p-3 bg-white border border-[var(--border)] rounded-lg">
          <div className="text-xs text-[var(--muted)] mb-2">
            {`Emoji pour ${setupTeams[emojiPicker].name}`}
          </div>
          <div className="flex flex-wrap gap-1">
            {EMOJI_OPTIONS.map((em, j) => (
              <button
                key={j}
                className={`w-9 h-9 text-xl rounded hover:bg-blue-50 transition ${
                  setupTeams[emojiPicker].emoji === em ? 'bg-blue-100 ring-2 ring-blue-400' : ''
                }`}
                onClick={() => {
                  updateSetupTeam(emojiPicker, { emoji: em });
                  setEmojiPicker(null);
                }}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
