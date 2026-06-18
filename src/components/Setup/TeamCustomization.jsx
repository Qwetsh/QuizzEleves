import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { EMOJI_OPTIONS } from '../../data/teamPresets';

export default function TeamCustomization() {
  const setupTeams = useGameStore((s) => s.setupTeams);
  const updateSetupTeam = useGameStore((s) => s.updateSetupTeam);
  const lv2Mode = useGameStore((s) => s.lv2Mode);
  // Index de l'equipe dont le picker d'avatar est ouvert (null = ferme)
  const [pickerOpen, setPickerOpen] = useState(null);

  return (
    <div className="flex flex-col gap-2">
      {setupTeams.map((team, i) => {
        const inputId = `team-name-${i}`;
        const isOpen = pickerOpen === i;
        return (
          <div
            key={`setup-team-${i}`}
            style={{
              padding: 10,
              borderRadius: 14,
              background: 'var(--parch-50)',
              border: '1px solid rgba(122, 94, 58, 0.16)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                aria-label={`Couleur de l'équipe ${team.name}: ${team.color}`}
                role="img"
                style={{
                  width: 18, height: 38, borderRadius: 5,
                  background: team.color,
                  boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.4)',
                }}
              />
              <button
                type="button"
                onClick={() => setPickerOpen(isOpen ? null : i)}
                aria-label={`Changer l'avatar de l'équipe ${i + 1}`}
                aria-expanded={isOpen}
                className="text-2xl"
                style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: isOpen ? 'rgba(232, 169, 88, 0.25)' : '#fffefb',
                  border: `2px solid ${isOpen ? 'var(--gold-600)' : 'rgba(122, 94, 58, 0.22)'}`,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 120ms ease',
                  flexShrink: 0,
                }}
              >
                {team.emoji}
              </button>
              <input
                id={inputId}
                type="text"
                value={team.name}
                onChange={(e) => updateSetupTeam(i, { name: e.target.value })}
                maxLength={20}
                aria-label={`Nom de l'équipe ${i + 1}`}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  padding: '8px 10px',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 16,
                  color: 'var(--ink-900)',
                  outline: 'none',
                }}
              />
            </div>

            {lv2Mode && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-600)', flexShrink: 0 }}>🗣️ LV2 :</span>
                {[['allemand', '🦅 Allemand'], ['espagnol', '☀️ Espagnol']].map(([key, label]) => {
                  const cur = (team.lv2 || 'espagnol') === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateSetupTeam(i, { lv2: key })}
                      style={{
                        flex: 1, minWidth: 0, padding: '6px 8px', borderRadius: 9, cursor: 'pointer',
                        fontSize: 12.5, fontWeight: 600,
                        border: `2px solid ${cur ? 'var(--gold-600)' : 'rgba(122,94,58,0.2)'}`,
                        background: cur ? 'rgba(232,169,88,0.15)' : '#fffefb',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {isOpen && (
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
                  marginTop: 10,
                  padding: 8,
                  borderRadius: 10,
                  background: '#fffefb',
                  border: '1px solid rgba(122, 94, 58, 0.16)',
                }}
              >
                {EMOJI_OPTIONS.map((emoji, ei) => {
                  const selected = team.emoji === emoji;
                  return (
                    <button
                      key={`emoji-${ei}`}
                      type="button"
                      onClick={() => { updateSetupTeam(i, { emoji }); setPickerOpen(null); }}
                      aria-label={`Avatar ${emoji}`}
                      className="text-xl"
                      style={{
                        height: 40, borderRadius: 8,
                        border: selected ? '2px solid var(--gold-600)' : '2px solid transparent',
                        background: selected ? 'rgba(232, 169, 88, 0.25)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 100ms ease',
                      }}
                      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'rgba(232, 169, 88, 0.12)'; }}
                      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
