// Testeur de mini-jeux — surfaces distantes : quand le bac à sable (devSandbox)
// tourne en mode « TV + téléphones » (phoneController) ou « en ligne »
// (connectionMode 'online'), ce panneau affiche un QR + lien PAR ÉQUIPE du duel
// pour ouvrir la vraie vue distante (manette mobile / client en ligne) déjà
// propriétaire de son équipe (?claim=idx&token=…, même convention que les liens
// de test dev). En mode manette il crée aussi la session Supabase (en ligne,
// c'est OnlineHost qui s'en charge) ; la publication continue reste assurée par
// MobileSessionPanel / OnlineHost. Disponible en prod (le testeur l'est).
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useGameStore } from '../../store/gameStore';
import { createSession, buildSessionPayload, joinUrl, onlineJoinUrl } from '../../logic/sessionConfig';

// Jeton stable et distinct par équipe (réutilisé si on rescanne le même QR).
const testLink = (base, code, i) => `${base}&claim=${i}&token=test-${code}-${i}`;

export default function SandboxSurfacePanel() {
  const devSandbox = useGameStore((s) => s.devSandbox);
  const online = useGameStore((s) => s.connectionMode === 'online');
  const phone = useGameStore((s) => s.phoneController);
  const code = useGameStore((s) => s.sessionCode);
  const setSessionCode = useGameStore((s) => s.setSessionCode);
  const teams = useGameStore((s) => s.teams);
  const showFight = useGameStore((s) => s.showFight);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState(null);
  const creatingRef = useRef(false);

  const active = devSandbox && (online || phone);

  // Mode manette : crée la session au montage (MobileSessionPanel, déjà monté,
  // prend le relais de la publication dès que le code existe).
  useEffect(() => {
    if (!active || online || code || creatingRef.current) return;
    creatingRef.current = true;
    const s = useGameStore.getState();
    const locked = !!(s.showQuestion || s.showEvent || s.showFight || s.showDuelChoice
      || s.rolling || s.showDiceModal || s.awaitingChoice || s.pendingActions || s.pendingLanding);
    const payload = buildSessionPayload({
      teams: s.teams, currentTeam: s.currentTeam, status: 'playing',
      shopStock: s.shopStock, shopFaceStock: s.shopFaceStock, log: s.log,
      extensions: s.extensions, locked, lv2Mode: s.lv2Mode, englishMode: s.englishMode,
      gameStats: s.gameStats, forgeService: s.forgeService, phoneController: true, turnState: s,
    });
    createSession(payload)
      .then((c) => setSessionCode(c))
      .catch((e) => { creatingRef.current = false; setError(e.message || 'Connexion impossible'); });
  }, [active, online, code, setSessionCode]);

  if (!active) return null;

  // Les deux camps du duel bac à sable (repli 0/1 tant que showFight n'est pas posé).
  const duelists = showFight
    ? [showFight.attackerIndex, showFight.defenderIndex]
    : [0, 1];
  const base = code ? (online ? onlineJoinUrl(code) : joinUrl(code)) : '';
  const title = online ? '🌐 Test en ligne' : '📺 Test TV + téléphones';
  const hint = online
    ? 'Scanne (ou partage le lien) : le navigateur devient le client en ligne de cette équipe. Cet écran reste l’hôte.'
    : 'Scanne avec un téléphone : il devient la manette de cette équipe. Cet écran reste le tableau.';

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ position: 'fixed', right: 10, bottom: 10, zIndex: 290, padding: '8px 12px',
          borderRadius: 10, border: '1px dashed rgba(122,94,58,0.6)', background: 'rgba(255,254,251,0.95)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--ink-700)', fontFamily: 'var(--font-ui)' }}>
        {'\u{1F9EA}'} QR test {code ? `· ${code}` : ''}
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 290, display: 'grid', placeItems: 'center',
      background: 'rgba(28,18,6,0.6)', backdropFilter: 'blur(4px)', fontFamily: 'var(--font-ui)' }}
      onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 620, maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 22px',
          borderRadius: 22, textAlign: 'center', background: 'linear-gradient(180deg, #fffefb, #f4e8cf)',
          border: '1.5px solid var(--gold-600)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#8a6418' }}>{title}</div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-600)', margin: '6px 0 14px', lineHeight: 1.45 }}>{hint}</p>

        {error && <div style={{ fontSize: 13, color: '#b5341f', marginBottom: 10 }}>{error}</div>}
        {!code && !error && (
          <div style={{ fontSize: 15, color: 'var(--ink-600)', padding: '24px 0' }}>Création de la session…</div>
        )}

        {code && (
          <>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {duelists.map((idx) => {
                const t = teams[idx];
                if (!t) return null;
                const url = testLink(base, code, idx);
                return (
                  <div key={idx} style={{ flex: '1 1 240px', maxWidth: 270, padding: '12px 10px 14px',
                    borderRadius: 16, background: '#fffefb', border: `2px solid ${t.color || 'rgba(122,94,58,0.3)'}` }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink-800)', marginBottom: 8,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.emoji} {t.name}
                    </div>
                    <div style={{ display: 'inline-block', padding: 8, background: '#fff', borderRadius: 12,
                      boxShadow: 'inset 0 0 0 1px rgba(122,94,58,0.2)' }}>
                      <QRCodeSVG value={url} size={168} level="M" />
                    </div>
                    <button className="btn btn--ghost btn--sm" style={{ marginTop: 10, width: '100%' }}
                      onClick={() => window.open(url, `qm-sandbox-${idx}`, 'width=430,height=880')}>
                      Ouvrir dans une fenêtre ↗
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: '0.3em',
              textIndent: '0.3em', color: 'var(--ink-900)', margin: '14px 0 2px' }}>
              {code}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>
              Chaque QR rend l’appareil propriétaire de son équipe (sans lobby).
            </div>
          </>
        )}

        <button className="btn btn--ghost btn--sm" style={{ marginTop: 14 }} onClick={() => setOpen(false)}>
          Réduire
        </button>
      </div>
    </div>
  );
}
