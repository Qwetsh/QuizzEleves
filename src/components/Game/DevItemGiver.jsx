// Outil DEV (localhost) : pendant une partie, donne n'importe quel équipement /
// consommable à l'équipe active pour le tester. Monté uniquement si
// import.meta.env.DEV (cf. GameLayout). Réutilise grantItem via devGiveItem.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { locName, locDesc } from '../../i18n/content';
import ItemIcon from '../Modals/ItemIcon';
import { useGameStore } from '../../store/gameStore';

const GROUPS = [
  { slot: 'head', label: '\u{1F3A9} Coiffes' },
  { slot: 'body', label: '\u{1F6E1}️ Armures' },
  { slot: 'feet', label: '\u{1F4FF} Amulettes' },
  { slot: 'consumable', label: '\u{1F9F3} Consommables' },
];

const BTN_STYLE = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px',
  borderRadius: 999, border: '2px dashed rgba(110, 78, 16, 0.5)',
  background: 'rgba(255, 250, 240, 0.85)', fontFamily: 'var(--font-display)',
  fontSize: 14, color: 'var(--ink-700)', cursor: 'pointer',
};

export default function DevItemGiver() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [given, setGiven] = useState(null); // clé donnée récemment (feedback visuel)
  const devGiveItem = useGameStore((s) => s.devGiveItem);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const team = teams[currentTeam];

  const give = (key) => { devGiveItem(key); setGiven(key); setTimeout(() => setGiven((g) => (g === key ? null : g)), 900); };
  const matches = (it) => !q || locName(it).toLowerCase().includes(q.toLowerCase());

  return (
    <>
      <button onClick={() => setOpen(true)} style={BTN_STYLE} title="Donner un objet à l'équipe active (test)">
        {'\u{1F6E0}️'} 🎁 Objets
      </button>
      {open && createPortal(
        <div onPointerDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,18,6,0.55)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', padding: 18 }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', background: 'var(--parch-100, #f6efdd)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'linear-gradient(180deg,#b8862c,#8a6418)', color: '#fff6e2' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{'\u{1F6E0}️'} [dev] Donner un objet — {team ? `${team.emoji} ${team.name}` : '—'}</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Rechercher…" autoFocus
                style={{ flex: 1, maxWidth: 280, padding: '7px 12px', borderRadius: 10, border: 'none', fontSize: 14 }} />
              <button onClick={() => setOpen(false)} className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }}>{'✕'} Fermer</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 10 }}>
                Clique un objet pour le donner à l'équipe active (équipé si le slot est libre, sinon dans le sac).
              </div>
              {GROUPS.map((g) => {
                const list = Object.entries(ITEMS).filter(([, it]) => it.slot === g.slot && matches(it));
                if (!list.length) return null;
                return (
                  <div key={g.slot} style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-700)', margin: '6px 2px 8px' }}>
                      {g.label} <span style={{ color: 'var(--ink-500)', fontSize: 11 }}>({list.length})</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                      {list.map(([key, it]) => {
                        const rar = RARITIES[it.rarity] || { color: '#888' };
                        return (
                          <button key={key} onClick={() => give(key)} title={locDesc(it) || locName(it)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', textAlign: 'left',
                              borderRadius: 10, cursor: 'pointer',
                              border: given === key ? '2px solid #2f9d5a' : `1.5px solid ${rar.color}55`,
                              background: given === key ? 'rgba(47,157,90,0.14)' : 'rgba(255,255,255,0.75)',
                            }}>
                            <ItemIcon item={it} size={30} ring />
                            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {given === key ? '✓ donné !' : locName(it)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
