import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { EVENTS, eventTone } from '../../data/events';
import { EVENT_IMG } from '../../data/eventAssets';
import { useT } from '../../i18n';
import { locName, locDesc } from '../../i18n/content';

// `embedded` (refonte Setup) : rend uniquement la grille groupée, sans en-tête
// repliable ni bouton « tout cocher » global — c'est SetupSection qui fournit le
// pli, le résumé et l'action. Mode legacy (autonome) conservé pour compat.
//
// Les événements sont TRIÉS par « ton » (positif / négatif / pari) via eventTone().
// Le boss (« le Prof ») a sa propre section car il ne se déclenche qu'avec des
// matières scolaires. Chaque carte affiche un badge d'extension requise s'il y a
// lieu. Le classement est purement cosmétique (le tirage n'en dépend pas).

const GROUP_ORDER = ['positive', 'negative', 'gamble', 'boss', 'other'];
const GROUP_LABEL = {
  positive: 'setup.eventsGroupPositive',
  negative: 'setup.eventsGroupNegative',
  gamble: 'setup.eventsGroupGamble',
  boss: 'setup.eventsGroupBoss',
  other: 'setup.eventsGroupOther',
};
const GROUP_ACCENT = {
  positive: '#3f9d5a',
  negative: '#b5341f',
  gamble: '#a06a12',
  boss: '#6b46c1',
  other: 'var(--ink-400)',
};

// Extensions requises → badges. `requiresSchool` (boss) est porté par la section
// dédiée + la note, donc pas de badge redondant.
function eventBadges(ev, T) {
  const b = [];
  if (ev.needsItems) b.push({ label: T('setup.eventsBadgeItems'), color: '#8a6418' });
  const req = ev.requires || [];
  if (req.includes('alchemy')) b.push({ label: T('setup.eventsBadgeAlchemy'), color: '#3f9d5a' });
  if (req.includes('enchant')) b.push({ label: T('setup.eventsBadgeEnchant'), color: '#6b46c1' });
  if (ev.requiresPhone) b.push({ label: T('setup.eventsBadgePhone'), color: '#2c6fb5' });
  return b;
}

export default function EventsChecklist({ embedded = false }) {
  const T = useT();
  const enabledEvents = useGameStore((s) => s.enabledEvents);
  const toggleEvent = useGameStore((s) => s.toggleEvent);
  const setAllEvents = useGameStore((s) => s.setAllEvents);
  const setEventsFor = useGameStore((s) => s.setEventsFor);
  const [open, setOpen] = useState(false);

  const allKeys = Object.keys(EVENTS);
  const allChecked = enabledEvents.length === allKeys.length;

  // Répartition des clés par groupe (dans l'ordre du catalogue).
  const groups = {};
  allKeys.forEach((key) => { (groups[eventTone(key)] ||= []).push(key); });

  const linkBtn = { fontSize: 11.5, color: 'var(--gold-600)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 };

  const renderCard = (key) => {
    const ev = EVENTS[key];
    const on = enabledEvents.includes(key);
    const badges = eventBadges(ev, T);
    return (
      <div
        key={key}
        onClick={() => toggleEvent(key)}
        className="flex items-start gap-2.5 cursor-pointer select-none"
        style={{ padding: '6px 8px', borderRadius: 8 }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(232, 169, 88, 0.12)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div
          style={{
            width: 18, height: 18, borderRadius: 5,
            background: on ? 'var(--gold-600)' : '#fffefb',
            border: `2px solid ${on ? 'var(--gold-700)' : 'var(--ink-400)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, flexShrink: 0, marginTop: 1,
          }}
        >
          {on ? '✓' : ''}
        </div>
        <div className="min-w-0">
          <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {EVENT_IMG[key]
              ? <img src={EVENT_IMG[key]} alt="" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} />
              : <span>{ev.icon}</span>}
            <span>{locName(ev)}</span>
            {badges.map((bd) => (
              <span
                key={bd.label}
                style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
                  color: bd.color, background: `${bd.color}1a`, border: `1px solid ${bd.color}55`,
                  borderRadius: 999, padding: '1px 6px', lineHeight: 1.4,
                }}
              >
                {bd.label}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.35, marginTop: 1 }}>
            {locDesc(ev)}
          </div>
        </div>
      </div>
    );
  };

  const sections = (
    <div className="flex flex-col" style={{ gap: 16 }}>
      {GROUP_ORDER.filter((g) => groups[g]?.length).map((g) => {
        const keys = groups[g];
        const onCount = keys.filter((k) => enabledEvents.includes(k)).length;
        const allOn = onCount === keys.length;
        const accent = GROUP_ACCENT[g];
        return (
          <div key={g}>
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 6, borderLeft: `3px solid ${accent}`, paddingLeft: 8 }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>
                {T(GROUP_LABEL[g])}{' '}
                <span style={{ color: 'var(--ink-400)', fontWeight: 500 }}>
                  {T('setup.eventsGroupCount', { n: onCount, total: keys.length })}
                </span>
              </div>
              <button onClick={() => setEventsFor(keys, !allOn)} style={linkBtn}>
                {allOn ? T('setup.eventsUncheckAll') : T('setup.eventsCheckAll')}
              </button>
            </div>
            {g === 'boss' && (
              <div style={{ fontSize: 11, color: 'var(--ink-500)', fontStyle: 'italic', margin: '0 0 4px 11px' }}>
                {T('setup.eventsBossNote')}
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {keys.map(renderCard)}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (embedded) {
    return (
      <div>
        <div className="flex justify-end mb-2">
          <button onClick={() => setAllEvents(!allChecked)} style={linkBtn}>
            {allChecked ? T('setup.eventsUncheckAll') : T('setup.eventsCheckAll')}
          </button>
        </div>
        {sections}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
        <div className="field-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-400)', transition: 'transform 150ms', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>{'▶'}</span>
          {T('setup.eventsTitle', { n: enabledEvents.length, total: allKeys.length })}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setAllEvents(!allChecked); }}
          style={linkBtn}
        >
          {allChecked ? T('setup.eventsUncheckAll') : T('setup.eventsCheckAll')}
        </button>
      </div>
      {open && sections}
    </div>
  );
}
