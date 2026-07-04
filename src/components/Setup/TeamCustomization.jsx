import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { EMOJI_OPTIONS } from '../../data/teamPresets';
import { useT } from '../../i18n';

const FONT_MONO = "'VT323', monospace";
const FONT_UI = "'Hanken Grotesk', system-ui, sans-serif";

// Fiches d'équipe façon « étiquettes de cassette » : carton crème, bordure
// charbon épaisse, bande de couleur d'équipe, nom écrit sur une ligne
// pointillée. Le picker d'emoji s'ouvre dans un tiroir sombre (console).
export default function TeamCustomization() {
  const T = useT();
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
              padding: '10px 12px',
              borderRadius: 10,
              background: '#f6ead0',
              border: '3px solid #150f08',
              boxShadow: '0 3px 0 rgba(21,15,8,.35), inset 0 1px 0 rgba(255,255,255,.5)',
            }}
          >
            <div className="flex items-center gap-3">
              <span style={{ fontFamily: FONT_MONO, fontSize: 20, color: '#8a7656', width: 24, flexShrink: 0 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div
                aria-label={T('setup.teamColorAria', { name: team.name, color: team.color })}
                role="img"
                style={{
                  width: 16, height: 40, borderRadius: 4, flexShrink: 0,
                  background: team.color,
                  border: '2px solid #150f08',
                  boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.35)',
                }}
              />
              <button
                type="button"
                onClick={() => setPickerOpen(isOpen ? null : i)}
                aria-label={T('setup.teamAvatarAria', { n: i + 1 })}
                aria-expanded={isOpen}
                className="text-2xl"
                style={{
                  width: 46, height: 46, borderRadius: 8,
                  background: isOpen ? '#16331a' : '#e3d0aa',
                  border: `3px solid ${isOpen ? '#57c84d' : '#150f08'}`,
                  boxShadow: isOpen
                    ? '0 0 10px rgba(87,200,77,.4)'
                    : '0 2px 0 rgba(21,15,8,.35), inset 0 1px 0 rgba(255,255,255,.4)',
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
                aria-label={T('setup.teamNameAria', { n: i + 1 })}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '2px dashed rgba(90,64,35,.5)',
                  borderRadius: 0,
                  padding: '6px 8px',
                  fontFamily: FONT_UI,
                  fontWeight: 700,
                  fontSize: 17,
                  color: '#241a10',
                  outline: 'none',
                }}
              />
            </div>

            {lv2Mode && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 1, color: '#5a4023', textTransform: 'uppercase', flexShrink: 0 }}>{T('setup.lv2Inline')}</span>
                {[['allemand', '🦅 Allemand'], ['espagnol', '☀️ Espagnol']].map(([key, label]) => {
                  const cur = (team.lv2 || 'espagnol') === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateSetupTeam(i, { lv2: key })}
                      style={{
                        flex: 1, minWidth: 0, padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                        fontFamily: FONT_UI, fontSize: 12.5, fontWeight: 700,
                        border: `2px solid ${cur ? '#57c84d' : '#150f08'}`,
                        background: cur ? '#16331a' : '#efe3c6',
                        color: cur ? '#9be88f' : '#5a4a2f',
                        boxShadow: cur ? '0 0 8px rgba(87,200,77,.3)' : '0 2px 0 rgba(21,15,8,.25)',
                        transition: 'all 120ms ease',
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
                  borderRadius: 8,
                  background: '#241a10',
                  border: '3px solid #150f08',
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,.5)',
                }}
              >
                {EMOJI_OPTIONS.map((emoji, ei) => {
                  const selected = team.emoji === emoji;
                  return (
                    <button
                      key={`emoji-${ei}`}
                      type="button"
                      onClick={() => { updateSetupTeam(i, { emoji }); setPickerOpen(null); }}
                      aria-label={T('setup.avatarAria', { emoji })}
                      className="text-xl"
                      style={{
                        height: 40, borderRadius: 6,
                        border: selected ? '2px solid #57c84d' : '2px solid transparent',
                        background: selected ? '#16331a' : 'transparent',
                        boxShadow: selected ? '0 0 8px rgba(87,200,77,.35)' : 'none',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 100ms ease',
                      }}
                      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'rgba(232,161,58,0.22)'; }}
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
