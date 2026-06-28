// Outil DEV (localhost) : pendant une partie, donne n'importe quelle FACE du
// catalogue à la réserve de l'équipe active pour la tester (puis on la forge).
// Monté uniquement si import.meta.env.DEV && extension forge active (cf. GameLayout).
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FORGE } from '../../logic/balanceConfig';
import { faceEffectLabel } from '../../logic/forgeEffects';
import FaceTile from './FaceTile';
import { useGameStore } from '../../store/gameStore';

const BTN_STYLE = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px',
  borderRadius: 999, border: '2px dashed rgba(110, 78, 16, 0.5)',
  background: 'rgba(255, 250, 240, 0.85)', fontFamily: 'var(--font-display)',
  fontSize: 14, color: 'var(--ink-700)', cursor: 'pointer',
};
const RAR_FILTERS = [['all', 'Toutes'], ['commun', 'Commun'], ['rare', 'Rare'], ['legendaire', 'Légendaire']];
const chipStyle = (on) => ({
  padding: '4px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5,
  border: on ? '2px solid #8a6418' : '1.5px solid rgba(110,78,16,0.3)',
  background: on ? 'rgba(184,134,44,0.18)' : 'rgba(255,255,255,0.7)',
  color: 'var(--ink-800)', fontWeight: on ? 700 : 500,
});

export default function DevFaceGiver() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [rar, setRar] = useState('all');
  const [slot, setSlot] = useState('all'); // 'all' | 1..6
  const [given, setGiven] = useState(null);
  const devGiveFace = useGameStore((s) => s.devGiveFace);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const team = teams[currentTeam];

  const catalog = FORGE.catalog || [];
  const matches = (f) => (!q || (f.name || '').toLowerCase().includes(q.toLowerCase()))
    && (rar === 'all' || f.rarity === rar)
    && (slot === 'all' || f.slot === slot);
  const give = (f) => { devGiveFace(f); setGiven(f.key); setTimeout(() => setGiven((g) => (g === f.key ? null : g)), 900); };

  return (
    <>
      <button onClick={() => setOpen(true)} style={BTN_STYLE} title="Donner une face de dé à l'équipe active (test)">
        {'\u{1F6E0}️'} 🎲 Faces
      </button>
      {open && createPortal(
        <div onPointerDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,18,6,0.55)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', padding: 18 }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', background: 'var(--parch-100, #f6efdd)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'linear-gradient(180deg,#b8862c,#8a6418)', color: '#fff6e2' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{'\u{1F6E0}️'} [dev] Donner une face — {team ? `${team.emoji} ${team.name}` : '—'}</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Rechercher…" autoFocus
                style={{ flex: 1, maxWidth: 240, padding: '7px 12px', borderRadius: 10, border: 'none', fontSize: 14 }} />
              <button onClick={() => setOpen(false)} className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }}>{'✕'} Fermer</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '10px 16px', borderBottom: '1px solid rgba(110,78,16,0.18)', background: 'rgba(255,250,240,0.6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Rareté</span>
                {RAR_FILTERS.map(([k, lbl]) => <button key={k} onClick={() => setRar(k)} style={chipStyle(rar === k)}>{lbl}</button>)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Slot</span>
                <button onClick={() => setSlot('all')} style={chipStyle(slot === 'all')}>Tous</button>
                {[1, 2, 3, 4, 5, 6].map((s) => <button key={s} onClick={() => setSlot(s)} style={chipStyle(slot === s)}>{s}</button>)}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 10 }}>
                Clique une face pour l'ajouter à la réserve de l'équipe active (à forger ensuite sur son slot).
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                {catalog.filter(matches).map((f) => {
                  const eff = faceEffectLabel(f, false);
                  const on = given === f.key;
                  return (
                    <button key={f.key} onClick={() => give(f)} title={eff || 'Face de course'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', textAlign: 'left',
                        borderRadius: 10, cursor: 'pointer',
                        border: on ? '2px solid #2f9d5a' : '1.5px solid rgba(110,78,16,0.25)',
                        background: on ? 'rgba(47,157,90,0.14)' : 'rgba(255,255,255,0.75)',
                        opacity: f.enabled === false ? 0.55 : 1,
                      }}>
                      <FaceTile face={f} size={40} slotTag={f.slot} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink-900)' }}>
                        <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {on ? '✓ donné !' : (f.name || '(sans nom)')}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--ink-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          slot {f.slot} · {eff || 'course pure'}{f.enabled === false ? ' · off' : ''}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {catalog.filter(matches).length === 0 && <div style={{ color: 'var(--ink-500)' }}>Aucune face ne correspond.</div>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
