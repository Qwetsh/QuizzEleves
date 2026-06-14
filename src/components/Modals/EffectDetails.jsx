// Détail MÉCANIQUE d'un objet (%, dés, stats…), masqué derrière un bouton pour
// ne pas surcharger les élèves : par défaut on n'affiche que la description
// « simple » (item.desc) ; ce composant ajoute un bouton « Détail de l'effet »
// qui déplie la traduction précise (effectText.describeItemEffects).
import { useState } from 'react';
import { describeItemEffects } from '../../logic/effectText';

export default function EffectDetails({ item, compact = false }) {
  const [open, setOpen] = useState(false);
  const fx = describeItemEffects(item);
  if (!fx.length) return null;
  return (
    <div style={{ marginTop: 5 }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: compact ? '2px 8px' : '3px 10px',
          fontSize: compact ? 11 : 12, fontFamily: 'var(--font-ui)',
          color: 'var(--ink-600, #5a4424)', cursor: 'pointer',
          background: 'transparent', border: '1px solid rgba(122,94,58,0.35)', borderRadius: 999,
        }}
      >
        {open ? '▾ Masquer le détail' : 'ℹ️ Détail de l’effet'}
      </button>
      {open && (
        <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px', fontSize: compact ? 11.5 : 12.5, color: 'var(--ink-700, #5a4424)', lineHeight: 1.45 }}>
          {fx.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
    </div>
  );
}
