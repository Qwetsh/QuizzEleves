import { useState } from 'react';

// Section repliable uniforme du Setup (« Options de jeu »). Replié par défaut,
// affiche un résumé d'une ligne à droite du titre tant qu'il est fermé ; un
// `action` optionnel (ex. « Tout cocher ») n'apparaît qu'ouvert, dans l'en-tête.
// Remplace les `setOpen` réimplémentés dans chaque panneau (chevron : même style
// que l'ancien EventsChecklist).
export default function SetupSection({ title, summary, defaultOpen = false, action, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel">
      <div
        className="flex items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <div
          className="field-label"
          style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}
        >
          <span style={{ fontSize: 12, color: 'var(--ink-400)', transition: 'transform 150ms', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block', flexShrink: 0 }}>
            {'▶'}
          </span>
          <span style={{ flexShrink: 0 }}>{title}</span>
          {!open && summary != null && summary !== '' && (
            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 400, fontSize: 12.5, color: 'var(--ink-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {'—'} {summary}
            </span>
          )}
        </div>
        {open && action && (
          <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>{action}</div>
        )}
      </div>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}
