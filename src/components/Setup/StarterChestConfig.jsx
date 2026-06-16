// Configuration du COFFRE DE DÉPART (Setup, verrouillé en partie). Active/désactive
// le coffre et règle l'or (fixe ou aléatoire min–max), le nombre d'objets proposés
// et gardés, et la catégorie (consommables / équipements / les deux).
import { useGameStore } from '../../store/gameStore';

const CATEGORIES = [
  { id: 'consumable', label: 'Consommables' },
  { id: 'equipment', label: 'Équipements' },
  { id: 'all', label: 'Les deux' },
];

// Petit groupe de boutons-segments (choix exclusif).
function Segmented({ value, options, onChange }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, background: 'rgba(122,94,58,0.10)', padding: 3, borderRadius: 10 }}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{
              border: 'none', cursor: 'pointer', borderRadius: 8,
              padding: '6px 12px', fontSize: 12.5, fontWeight: 700,
              fontFamily: 'var(--font-ui)',
              background: on ? 'var(--gold-600)' : 'transparent',
              color: on ? '#fff' : 'var(--ink-600)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function NumberField({ label, value, min, max, onChange, suffix }) {
  const clamp = (v) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-700)' }}>
      <span style={{ minWidth: 0 }}>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))}
        style={{
          width: 58, padding: '5px 8px', borderRadius: 8, textAlign: 'center',
          border: '1px solid rgba(122,94,58,0.35)', background: '#fffefb',
          fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink-900)',
        }}
      />
      {suffix && <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>{suffix}</span>}
    </label>
  );
}

export default function StarterChestConfig() {
  const cfg = useGameStore((s) => s.starterChestConfig);
  const setCfg = useGameStore((s) => s.setStarterChestConfig);
  if (!cfg) return null;

  const enabled = cfg.enabled !== false;

  return (
    <div>
      {/* Ligne titre + interrupteur d'activation */}
      <div
        onClick={() => setCfg({ enabled: !enabled })}
        className="flex items-start gap-2.5 cursor-pointer select-none"
        style={{ padding: '2px 0', marginBottom: enabled ? 12 : 0 }}
      >
        <div
          style={{
            width: 20, height: 20, borderRadius: 6,
            background: enabled ? 'var(--gold-600)' : '#fffefb',
            border: `2px solid ${enabled ? 'var(--gold-700)' : 'var(--ink-400)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, flexShrink: 0, marginTop: 1,
          }}
        >
          {enabled ? '✓' : ''}
        </div>
        <div className="min-w-0">
          <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🧰</span> Coffre de départ
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.35, marginTop: 2 }}>
            Au 1er tour, chaque équipe ouvre un coffre (or + objets au choix).
          </div>
        </div>
      </div>

      {enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 30 }}>
          {/* Or */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="field-label" style={{ margin: 0 }}>Or offert</div>
            <Segmented
              value={cfg.goldMode === 'random' ? 'random' : 'fixed'}
              options={[{ id: 'fixed', label: 'Fixe' }, { id: 'random', label: 'Aléatoire' }]}
              onChange={(id) => setCfg({ goldMode: id })}
            />
            {cfg.goldMode === 'random' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <NumberField label="Min" value={cfg.goldMin ?? 10} min={0} max={cfg.goldMax ?? 30} onChange={(v) => setCfg({ goldMin: v })} suffix="🪙" />
                <NumberField label="Max" value={cfg.goldMax ?? 30} min={cfg.goldMin ?? 0} max={500} onChange={(v) => setCfg({ goldMax: v })} suffix="🪙" />
              </div>
            ) : (
              <NumberField label="Montant" value={cfg.gold ?? 20} min={0} max={500} onChange={(v) => setCfg({ gold: v })} suffix="🪙" />
            )}
            {cfg.goldMode === 'random' && (
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Un seul tirage, le même pour toutes les équipes.</div>
            )}
          </div>

          {/* Objets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="field-label" style={{ margin: 0 }}>Objets du coffre</div>
            <Segmented value={cfg.category || 'consumable'} options={CATEGORIES} onChange={(id) => setCfg({ category: id })} />
            <NumberField
              label="Proposés"
              value={cfg.propose ?? 3}
              min={0}
              max={6}
              onChange={(v) => setCfg({ propose: v, keep: Math.min(cfg.keep ?? 1, Math.max(1, v)) })}
            />
            <NumberField
              label="À garder"
              value={cfg.keep ?? 1}
              min={1}
              max={Math.max(1, cfg.propose ?? 3)}
              onChange={(v) => setCfg({ keep: v })}
            />
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>
              {(cfg.propose ?? 3) === 0
                ? 'Aucun objet : le coffre ne donne que de l’or.'
                : `L'équipe choisit ${Math.min(cfg.keep ?? 1, cfg.propose ?? 3)} objet(s) parmi ${cfg.propose ?? 3}.`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
