// Panneau « Mode mobile » côté TBI : crée une session, publie en continu
// l'état des équipes vers Supabase, et affiche le QR + code d'appairage. Tout
// est optionnel — si on ne l'active pas, rien n'est publié et le jeu tourne seul.
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useGameStore } from '../../store/gameStore';
import { createSession, publishSession, buildSessionPayload, joinUrl } from '../../logic/sessionConfig';

export default function MobileSessionPanel() {
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const finished = useGameStore((s) => s.finished);
  const shopStock = useGameStore((s) => s.shopStock);
  const log = useGameStore((s) => s.log);
  const [code, setCode] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Tant que la session est active, republie à chaque changement pertinent
  // (débounce léger pour grouper les rafales de mise à jour).
  useEffect(() => {
    if (!code) return;
    const payload = buildSessionPayload({ teams, currentTeam, status: finished ? 'finished' : 'playing', shopStock, log });
    const id = setTimeout(() => { publishSession(code, payload).catch(() => {}); }, 250);
    return () => clearTimeout(id);
  }, [code, teams, currentTeam, finished, shopStock, log]);

  async function activate() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const payload = buildSessionPayload({ teams, currentTeam, status: finished ? 'finished' : 'playing', shopStock, log });
      setCode(await createSession(payload));
      setOpen(true);
    } catch (e) { setError(e.message || 'Connexion impossible'); }
    setBusy(false);
  }

  const url = code ? joinUrl(code) : '';

  return (
    <>
      <button
        className="btn btn--ghost btn--sm"
        onClick={code ? () => setOpen(true) : activate}
        disabled={busy}
        title={code ? 'Afficher le QR de connexion' : 'Activer le suivi sur téléphone'}
      >
        {busy ? '…' : code ? `📱 ${code}` : '📱 Mobile'}
      </button>

      {open && code && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center',
            background: 'rgba(28,18,6,0.6)', backdropFilter: 'blur(4px)' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: 340, maxWidth: '90vw', padding: '22px 24px 24px', borderRadius: 22, textAlign: 'center',
              background: 'linear-gradient(180deg, #fffefb, #f4e8cf)', border: '1.5px solid var(--gold-600)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#8a6418' }}>
              {'📱'} Suivi sur téléphone
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-600)', margin: '6px 0 16px' }}>
              Scanne le QR, ou va sur le lien et entre le code.
            </p>
            <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 16, boxShadow: 'inset 0 0 0 1px rgba(122,94,58,0.2)' }}>
              <QRCodeSVG value={url} size={196} level="M" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, letterSpacing: '0.3em', textIndent: '0.3em', color: 'var(--ink-900)', margin: '14px 0 4px' }}>
              {code}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)', wordBreak: 'break-all' }}>{url}</div>
            <button className="btn btn--ghost btn--sm" style={{ marginTop: 16 }} onClick={() => setOpen(false)}>Fermer</button>
          </div>
        </div>
      )}

      {error && <span style={{ fontSize: 11, color: '#b5341f' }}>{error}</span>}
    </>
  );
}
