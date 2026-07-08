// Manette « jeu en ligne » côté joueur distant. Le client online mire le plateau
// (spectateur) ; ce composant lui donne en plus une ÉQUIPE à posséder et, pendant
// son tour, la manette (ControllerView) qui envoie les intents `turn*` à l'hôte.
// Réutilise intégralement le moteur manette existant (aucune logique de jeu ici).
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { sendIntent, randomToken } from '../../logic/sessionConfig';
import ControllerView from '../Mobile/ControllerView';
import { useT } from '../../i18n';

const tokenKey = (code) => `quete_online_token_${code}`;

// Jeton local persistant : identifie ce joueur (possession d'équipe) à travers
// les reloads, sans compte (même principe que le token du lobby téléphone).
function loadToken(code) {
  try {
    const ex = localStorage.getItem(tokenKey(code));
    if (ex) return ex;
    const t = randomToken();
    localStorage.setItem(tokenKey(code), t);
    return t;
  } catch { return randomToken(); }
}

function ClaimScreen({ teams, mine, onClaim, T }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 320, display: 'grid', placeItems: 'center',
      background: 'rgba(6,9,12,0.72)', backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        width: 360, maxWidth: '92vw', padding: '20px 22px', borderRadius: 16, textAlign: 'center',
        background: '#0f1419', border: '2px solid #16351f', color: '#bfeccb', fontFamily: 'var(--font-ui)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontSize: 22, color: '#66ff8a', marginBottom: 4 }}>🌐 Ton équipe</div>
        <p style={{ fontSize: 13, color: '#8b9096', margin: '0 0 14px' }}>
          Choisis l’équipe que tu pilotes. Tu joueras ton tour depuis cet écran.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(teams || []).map((t, i) => {
            const taken = !!t.token && t.token !== mine;
            return (
              <button
                key={i}
                onClick={() => !taken && onClaim(i)}
                disabled={taken}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                  border: `2px solid ${taken ? '#2a2f34' : (t.color || '#16351f')}`,
                  background: taken ? '#151a1f' : '#111a15', color: taken ? '#5b6169' : '#eafff0',
                  cursor: taken ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-ui)', fontSize: 15,
                }}
              >
                <span style={{ fontSize: 22 }}>{t.emoji || '🦁'}</span>
                <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>{t.name || `Équipe ${i + 1}`}</span>
                {taken && <span style={{ fontSize: 12 }}>🔒 pris</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function OnlineController({ code, ctrl, lastSync = 0 }) {
  const T = useT();
  const teams = useGameStore((s) => s.teams);
  const [token] = useState(() => loadToken(code));

  const ownedIdx = (teams || []).findIndex((t) => t && t.token === token);
  const claim = (idx) => { sendIntent(code, token, 'claimTeam', { idx }).catch(() => {}); };

  // Pas encore d'équipe → écran de choix (par-dessus le plateau).
  if (ownedIdx < 0) {
    return <ClaimScreen teams={teams} mine={token} onClaim={claim} T={T} />;
  }

  // C'est mon tour → manette plein écran ; sinon je spectate le plateau.
  const myTurn = !!(ctrl && ctrl.controller && ctrl.turn && ctrl.turn.team === ownedIdx);
  if (!myTurn) return null;
  return <ControllerView session={ctrl} teamIdx={ownedIdx} code={code} token={token} T={T} lastSync={lastSync} />;
}
