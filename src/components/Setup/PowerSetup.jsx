import { useGameStore } from '../../store/gameStore';
import { POWERS } from '../../data/powers';
import { lighten } from '../../utils/colors';

export default function PowerSetup() {
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

  const handleSelect = (key) => {
    selectPower(powerSetupIndex, powerSetupCategory, key);
    advancePowerSetup();
  };

  return (
    <div className="absolute inset-0 overflow-y-auto flex items-center justify-center" style={{ padding: '40px 20px' }}>
      <div style={{ width: 'min(820px, 100%)', textAlign: 'center' }}>
        {/* Step tag */}
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 18px', borderRadius: 999,
            background: isDef
              ? 'linear-gradient(180deg, #4d8aea, #2f6fd8)'
              : 'linear-gradient(180deg, #e85d6b, #c9472f)',
            color: '#fff',
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontSize: 13,
            boxShadow: isDef
              ? 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.2), 0 4px 0 rgba(28,61,110,0.4)'
              : 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.2), 0 4px 0 rgba(110,30,18,0.4)',
          }}
        >
          {isDef ? '\u{1F6E1} Pouvoir d\u00e9fensif' : '\u2694\uFE0F Pouvoir offensif'}
          {` \u00b7 \u00e9tape ${stepNum} / ${stepTotal}`}
        </div>

        {/* Team banner */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
            margin: '18px 0 28px',
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            color: 'var(--ink-900)',
          }}
        >
          <span className="text-4xl">{team.emoji}</span>
          <span style={{ color: team.color }}>{team.name}</span>
        </div>

        {/* Power cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {powers.map(([key, p]) => (
            <div
              key={key}
              onClick={() => handleSelect(key)}
              role="button"
              tabIndex={0}
              aria-label={`Choisir le pouvoir ${p.name}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(key); } }}
              className="cursor-pointer"
              style={{
                padding: '24px 18px 22px',
                borderRadius: 20,
                background: '#fffefb',
                border: '3px solid rgba(122, 94, 58, 0.18)',
                textAlign: 'center',
                boxShadow: '0 4px 0 rgba(46,31,16,0.10), 0 12px 24px rgba(46,31,16,0.10)',
                transition: 'all 160ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'var(--gold-500)';
                e.currentTarget.style.boxShadow = '0 8px 0 rgba(110,78,16,0.4), 0 16px 32px rgba(46,31,16,0.20)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.borderColor = 'rgba(122, 94, 58, 0.18)';
                e.currentTarget.style.boxShadow = '0 4px 0 rgba(46,31,16,0.10), 0 12px 24px rgba(46,31,16,0.10)';
              }}
            >
              <div
                style={{
                  width: 80, height: 80, borderRadius: 22,
                  margin: '0 auto 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 40,
                  background: `linear-gradient(180deg, ${lighten(p.color || '#888', 0.2)}, ${p.color || '#888'})`,
                  boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.5), inset 0 -5px 0 rgba(0,0,0,0.18)',
                }}
              >
                {p.icon}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink-900)', marginBottom: 6 }}>
                {p.name}
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink-600)', lineHeight: 1.4, minHeight: 56 }}>
                {p.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Team dots */}
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: 8 }}>
          {teams.map((t, i) => (
            <div
              key={`dot-${t.name}-${i}`}
              title={t.name}
              aria-label={`\u00c9quipe ${t.name}${i === powerSetupIndex ? ' (en cours)' : ''}`}
              style={{
                width: 16, height: 16, borderRadius: '50%',
                background: t.color,
                opacity: i === powerSetupIndex ? 1 : 0.35,
                boxShadow: i === powerSetupIndex ? '0 0 0 3px rgba(184, 134, 44, 0.5)' : 'none',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
