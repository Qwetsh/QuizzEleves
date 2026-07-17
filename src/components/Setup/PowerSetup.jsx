import { useGameStore } from '../../store/gameStore';
import { POWERS } from '../../data/powers';
import TeamAvatar from '../TeamAvatar';
import { lighten } from '../../utils/colors';
import { useT } from '../../i18n';
import { locName, locDesc } from '../../i18n/content';

const FONT_DISPLAY = "'Archivo Black', system-ui, sans-serif";
const FONT_UI = "'Hanken Grotesk', system-ui, sans-serif";
const FONT_MONO = "'VT323', monospace";

// Écran de choix des pouvoirs, habillé « console Curioscope » : fond bois à
// lattes, panneau charbon, afficheur LCD d'étape, cartes-cartouches sombres
// qui s'allument en LED verte au survol (cohérent avec SelectionCassettes).
export default function PowerSetup() {
  const T = useT();
  const teams = useGameStore((s) => s.teams);
  const powerSetupIndex = useGameStore((s) => s.powerSetupIndex);
  const powerSetupCategory = useGameStore((s) => s.powerSetupCategory);
  const selectPower = useGameStore((s) => s.selectPower);
  const advancePowerSetup = useGameStore((s) => s.advancePowerSetup);

  const team = teams[powerSetupIndex];
  if (!team) return null;

  const isDef = powerSetupCategory === 'def';
  const powers = Object.entries(POWERS).filter(([, p]) => p.category === powerSetupCategory);

  const stepNum = powerSetupIndex * 2 + (isDef ? 1 : 2);
  const stepTotal = teams.length * 2;
  const catColor = isDef ? '#6aa8ff' : '#ff7b6b';

  // Tour d'un BOT (mode solo) : le driver choisit tout seul — l'écran reste
  // un spectacle, les cartes sont verrouillées le temps de la sélection.
  const botTurn = !!team.isBot;
  const handleSelect = (key) => {
    if (botTurn) return;
    selectPower(powerSetupIndex, powerSetupCategory, key);
    advancePowerSetup();
  };

  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: 'linear-gradient(#b98f4e, #8a6636)' }}>
      {/* Lattes de bois du fond (décor). */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,.05) 0 3px, transparent 3px 80px), repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 2px, transparent 2px 7px)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px 24px' }}>
        <div style={{ width: 'min(980px, 100%)', background: '#241a10', border: '4px solid #120c06', borderRadius: 18, boxShadow: '0 24px 60px rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.06)', padding: '22px 28px 24px' }}>

          {/* Bandeau haut : marque + afficheur LCD de l'étape */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '3px solid #120c06', paddingBottom: 14, marginBottom: 18 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 17, letterSpacing: 3, color: '#8a7656' }}>CURIOSCOPE</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 20, letterSpacing: 1, color: catColor, textShadow: `0 0 8px ${catColor}55`, background: '#120c06', border: '3px solid #5a4023', borderRadius: 6, padding: '3px 12px', whiteSpace: 'nowrap' }}>
              {(isDef ? T('setup.powerDef') : T('setup.powerOff')) + T('setup.powerStep', { n: stepNum, total: stepTotal })}
            </span>
          </div>

          {/* Bannière de l'équipe qui choisit */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '4px 0 22px' }}>
            <TeamAvatar team={team} size={48} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 30, letterSpacing: 0.5, color: team.color, textShadow: '0 2px 0 #000' }}>{team.name}</span>
            {botTurn && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 18, letterSpacing: 1, color: '#e8a13a', background: '#120c06', border: '2px solid #5a4023', borderRadius: 6, padding: '2px 10px' }}>
                🤖 choisit…
              </span>
            )}
          </div>

          {/* Cartes-cartouches des pouvoirs */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={botTurn ? { pointerEvents: 'none', opacity: 0.75 } : undefined}>
            {powers.map(([key, p]) => (
              <div
                key={key}
                onClick={() => handleSelect(key)}
                role="button"
                tabIndex={0}
                aria-label={T('setup.powerChooseAria', { name: locName(p) })}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(key); } }}
                className="cursor-pointer"
                style={{
                  padding: '22px 16px 18px',
                  borderRadius: 12,
                  background: '#2a2117',
                  border: '3px solid #150f08',
                  textAlign: 'center',
                  boxShadow: '0 4px 0 rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.07)',
                  transition: 'all 140ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = '#57c84d';
                  e.currentTarget.style.boxShadow = '0 8px 0 rgba(0,0,0,.45), 0 0 16px rgba(87,200,77,.45), inset 0 1px 0 rgba(255,255,255,.07)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.borderColor = '#150f08';
                  e.currentTarget.style.boxShadow = '0 4px 0 rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.07)';
                }}
              >
                <div
                  style={{
                    width: 78, height: 78, borderRadius: 12,
                    margin: '0 auto 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 38,
                    background: `linear-gradient(180deg, ${lighten(p.color || '#888', 0.2)}, ${p.color || '#888'})`,
                    border: '3px solid #150f08',
                    boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -5px 0 rgba(0,0,0,0.25)',
                  }}
                >
                  {p.icon}
                </div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, color: '#f4e7cc', marginBottom: 6, textShadow: '0 2px 0 rgba(0,0,0,.4)' }}>
                  {locName(p)}
                </div>
                <div style={{ fontFamily: FONT_UI, fontSize: 13.5, color: '#a89878', lineHeight: 1.4, minHeight: 56 }}>
                  {locDesc(p)}
                </div>
              </div>
            ))}
          </div>

          {/* File des équipes (voyants) */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            {teams.map((t, i) => (
              <div
                key={`dot-${t.name}-${i}`}
                title={t.name}
                aria-label={i === powerSetupIndex ? T('setup.powerTeamAriaCurrent', { name: t.name }) : T('setup.powerTeamAria', { name: t.name })}
                style={{
                  width: 15, height: 15, borderRadius: 4,
                  background: t.color,
                  border: '2px solid #120c06',
                  opacity: i === powerSetupIndex ? 1 : 0.35,
                  boxShadow: i === powerSetupIndex ? '0 0 0 2px #57c84d, 0 0 10px rgba(87,200,77,.5)' : 'none',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
