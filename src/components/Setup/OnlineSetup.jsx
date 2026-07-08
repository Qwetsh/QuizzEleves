// Entrée du mode « Jeu en ligne » : choisir HÉBERGER (ouvrir un lobby, partager
// un lien, lancer quand tout le monde est prêt) ou REJOINDRE (saisir un code →
// ouvrir le client en ligne, où l'on crée sa propre équipe). Réutilise le lobby
// du mode téléphone (LobbyPanel) en version « lien en ligne ».
import { useState } from 'react';
import LobbyPanel from './LobbyPanel';
import { onlineJoinUrl } from '../../logic/sessionConfig';

const FONT_DISPLAY = 'var(--font-display, sans-serif)';

export default function OnlineSetup() {
  const [mode, setMode] = useState(null); // null | 'host' | 'join'
  const [code, setCode] = useState('');

  if (mode === 'host') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={() => setMode(null)} style={backBtn}>← Retour</button>
        <div style={{ fontSize: 12.5, color: 'var(--ink-600,#5a4a30)', lineHeight: 1.5 }}>
          Partage le lien (ou le code) ci-dessous. Chaque joueur ouvre la partie, <b>crée son équipe</b> (nom + logo) et se met « prêt ».
          Tu pourras <b>lancer</b> quand tout le monde est prêt. Garde cet onglet ouvert : c’est lui qui fait tourner le jeu.
        </div>
        <LobbyPanel online />
      </div>
    );
  }

  if (mode === 'join') {
    const go = () => {
      const c = code.trim().toUpperCase();
      if (c.length >= 3) window.location.href = onlineJoinUrl(c);
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
        <button onClick={() => setMode(null)} style={backBtn}>← Retour</button>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: '#2c7a4f' }}>🔗 Rejoindre une partie</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-600,#5a4a30)' }}>Saisis le code donné par l’hôte (ou ouvre directement le lien qu’il a partagé).</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && go()}
            placeholder="CODE"
            maxLength={6}
            style={{ flex: 1, padding: '10px 12px', fontSize: 20, letterSpacing: 4, textAlign: 'center', borderRadius: 10, border: '2px solid #2c7a4f', background: '#fffefb' }}
          />
          <button onClick={go} disabled={code.trim().length < 3} style={{ ...cta('#2fb551'), opacity: code.trim().length < 3 ? 0.5 : 1 }}>Rejoindre</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'stretch', maxWidth: 560 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: '#2c7a4f' }}>🌐 Jeu en ligne</div>
      <div style={{ fontSize: 13, color: 'var(--ink-600,#5a4a30)', lineHeight: 1.5 }}>
        Joue à distance : chacun sur son écran. L’hôte héberge la partie, les autres rejoignent par un lien et créent leur propre équipe.
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setMode('host')} style={cardBtn}>
          <div style={{ fontSize: 30 }}>🖥️</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15 }}>Héberger</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-500,#7a6a4a)', lineHeight: 1.3 }}>J’ouvre la partie et je partage le lien. Je lance quand tout le monde est prêt.</div>
        </button>
        <button onClick={() => setMode('join')} style={cardBtn}>
          <div style={{ fontSize: 30 }}>🔗</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15 }}>Rejoindre</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-500,#7a6a4a)', lineHeight: 1.3 }}>J’ai un code / un lien. Je crée mon équipe et j’attends le lancement.</div>
        </button>
      </div>
    </div>
  );
}

const cardBtn = {
  flex: 1, minWidth: 200, cursor: 'pointer', textAlign: 'left', padding: '16px 18px', borderRadius: 14,
  border: '2px solid #2c7a4f', background: '#f3fbf6', display: 'flex', flexDirection: 'column', gap: 6,
  fontFamily: 'var(--font-ui)', color: 'var(--ink-800,#241a10)',
};
const cta = (bg) => ({ cursor: 'pointer', padding: '10px 18px', borderRadius: 10, border: '2px solid #05070a', background: bg, color: '#06210f', fontWeight: 700, fontFamily: 'var(--font-ui)', fontSize: 15 });
const backBtn = { alignSelf: 'flex-start', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--ink-500,#7a6a4a)', fontSize: 13, padding: 0 };
