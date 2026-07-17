// Panneau de TEST (dev) : un lien par équipe pour ouvrir une fenêtre companion
// déjà PROPRIÉTAIRE de cette équipe (?claim=idx&token=…). Permet de jouer
// plusieurs équipes en fenêtres séparées sur un seul PC, sans refaire le lobby.
//
// Visible uniquement en DEV local (jamais sur le site déployé — même outils
// déverrouillés), et seulement si une session mobile est active (sessionCode).
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { joinUrl } from '../../logic/sessionConfig';
import TeamAvatar from '../TeamAvatar';

const devOn = () => import.meta.env.DEV;

// Jeton stable et distinct par équipe (réutilisé si on rouvre le même lien).
const testLink = (code, i) => `${joinUrl(code)}&claim=${i}&token=test-${code}-${i}`;

export default function TestLinksPanel() {
  const code = useGameStore((s) => s.sessionCode);
  const teams = useGameStore((s) => s.teams);
  const [open, setOpen] = useState(false);
  if (!devOn() || !code) return null;

  return (
    <div style={{ position: 'fixed', left: 10, bottom: 10, zIndex: 70, fontFamily: 'var(--font-ui)' }}>
      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{ padding: '6px 10px', borderRadius: 10, border: '1px dashed rgba(122,94,58,0.5)', background: 'rgba(255,254,251,0.95)', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--ink-700)' }}>
          {'\u{1F9EA}'} Liens de test
        </button>
      ) : (
        <div style={{ width: 230, background: 'rgba(255,254,251,0.98)', border: '1px solid rgba(122,94,58,0.3)', borderRadius: 12, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink-800)' }}>{'\u{1F9EA}'} Test · une fenêtre / équipe</span>
            <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {teams.map((t, i) => (
              <button key={i}
                onClick={() => window.open(testLink(code, i), `qm-test-${i}`, 'width=430,height=880')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 9, border: '1px solid rgba(122,94,58,0.25)', background: '#fffefb', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                <TeamAvatar team={t} size={22} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                <span style={{ fontSize: 13 }}>↗</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--ink-500)', lineHeight: 1.3 }}>
            Chaque fenêtre possède son équipe (achats, troc). Autoriser les pop-ups si bloqué.
          </div>
        </div>
      )}
    </div>
  );
}
