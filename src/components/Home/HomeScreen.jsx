// ============================================================
//  PAGE D'ACCUEIL — écran titre du jeu.
//
//  Le mode de jeu se choisit ICI, AVANT les thèmes (l'inverse d'avant) :
//    · Solo (contre des IA) — verrouillé pour l'instant
//    · Multi local (écran tactile OU écran + téléphones-manettes)
//    · Multi en ligne (héberger / rejoindre par code)
//  Plus les entrées hors-jeu : voir les thèmes (exploration), réglages
//  de partie, crédits — et REPRENDRE si une partie sauvegardée existe.
//
//  L'écran choisit le mode (connectionMode + phoneController) puis ouvre
//  la console CURIOSCOPE via openConsole(intent) — la console n'affiche
//  plus de sélecteur de mode.
// ============================================================
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { loadGame } from '../../store/persistence';
import { onlineJoinUrl } from '../../logic/sessionConfig';
import '../../styles/home.css';

const FONT_DISPLAY = "'Archivo Black', system-ui, sans-serif";
const FONT_MONO = "'VT323', monospace";

// Étoiles décoratives (positions fixes — pas de random au rendu).
const STARS = [
  { top: '8%', left: '12%', size: 14, delay: 0 }, { top: '16%', left: '78%', size: 11, delay: 1.1 },
  { top: '26%', left: '30%', size: 9, delay: 0.6 }, { top: '12%', left: '55%', size: 12, delay: 1.8 },
  { top: '38%', left: '88%', size: 13, delay: 0.3 }, { top: '58%', left: '7%', size: 11, delay: 1.4 },
  { top: '72%', left: '90%', size: 10, delay: 0.9 }, { top: '84%', left: '18%', size: 12, delay: 2.1 },
  { top: '66%', left: '70%', size: 8, delay: 0.2 }, { top: '90%', left: '52%', size: 13, delay: 1.6 },
  { top: '44%', left: '16%', size: 8, delay: 2.4 }, { top: '30%', left: '64%', size: 9, delay: 0.8 },
];

// Une entrée du menu (bouton plastique + libellé + sous-texte).
function MenuBtn({ emblem, label, sub, onClick, disabled, badge, primary }) {
  return (
    <button type="button" className={`home-btn ${primary ? 'home-btn--primary' : ''}`} onClick={onClick} disabled={disabled}>
      <span style={{ fontSize: 26, flex: '0 0 34px', textAlign: 'center' }}>{emblem}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: FONT_DISPLAY, fontSize: 17, letterSpacing: 0.8 }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 12.5, marginTop: 3, lineHeight: 1.3, color: disabled ? '#6b5f48' : '#a89878' }}>{sub}</span>}
      </span>
      {badge && (
        <span style={{ flex: '0 0 auto', fontFamily: FONT_MONO, fontSize: 13, letterSpacing: 1, color: '#e8a13a', border: '2px solid #5a4023', borderRadius: 4, padding: '1px 7px', background: '#1d160e' }}>{badge}</span>
      )}
    </button>
  );
}

// Bouton « ← Retour » des sous-menus.
function BackBtn({ onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ alignSelf: 'flex-start', fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 1, padding: '3px 10px', borderRadius: 4, cursor: 'pointer', border: '2px solid #5a4023', background: '#3a2c1a', color: '#e3d0aa' }}>
      ← RETOUR
    </button>
  );
}

export default function HomeScreen() {
  const setConnectionMode = useGameStore((s) => s.setConnectionMode);
  const setPhoneController = useGameStore((s) => s.setPhoneController);
  const openConsole = useGameStore((s) => s.openConsole);
  const resumeGame = useGameStore((s) => s.resumeGame);

  // null = menu principal | 'local' | 'online' | 'credits'
  const [sub, setSub] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  // Partie sauvegardée reprenable ? (lecture unique au montage)
  const [hasSave] = useState(() => {
    const s = loadGame();
    return !!(s && s.phase === 'game' && Array.isArray(s.teams) && s.teams.length);
  });

  const setPhase = useGameStore((s) => s.setPhase);
  // Choisit un mode et ouvre la console de composition (thèmes → LANCER).
  const play = (conn, controller) => {
    setConnectionMode(conn);
    setPhoneController(controller);
    openConsole('play');
  };
  // Héberger en ligne : direction l'écran LOBBY dédié (session auto, création
  // de MON équipe intégrée, lien à partager, LANCER là-bas).
  const hostOnline = () => {
    setConnectionMode('online');
    setPhoneController(true);
    setPhase('onlineLobby');
  };
  const joinOnline = () => {
    const c = joinCode.trim().toUpperCase();
    if (c.length >= 3) window.location.href = onlineJoinUrl(c);
  };

  const panel = { display: 'flex', flexDirection: 'column', gap: 12 };
  const subTitle = { fontFamily: FONT_MONO, fontSize: 17, letterSpacing: 2, color: '#e8a13a', margin: '2px 0 4px' };

  return (
    <div className="home-root">
      {STARS.map((st, i) => (
        <span key={i} className="home-star" style={{ top: st.top, left: st.left, fontSize: st.size, animationDelay: `${st.delay}s` }}>✦</span>
      ))}

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34, padding: 24 }}>
        {/* ---- Titre ---- */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 19, letterSpacing: 6, color: '#8a7656', marginBottom: 6 }}>CURIOSCOPE PRÉSENTE</div>
          <div className="home-title" style={{ fontFamily: FONT_DISPLAY, fontSize: 54, lineHeight: 1.05, letterSpacing: 1, color: '#f4e7cc' }}>
            LA QUÊTE<br />DES MATIÈRES
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 17, letterSpacing: 3, color: '#e8a13a', marginTop: 10 }}>
            ✦ COURSE SPATIALE À QUESTIONS ✦
          </div>
        </div>

        {/* ---- Cartouche menu ---- */}
        <div style={{ width: 470, maxWidth: '94vw', border: '5px solid #150f08', borderRadius: 16, background: '#241a10', boxShadow: '0 0 0 3px #b79a63 inset, 0 30px 70px rgba(0,0,0,.6)', padding: '20px 20px 16px' }}>
          {sub === null && (
            <div className="home-menu" style={panel}>
              {hasSave && (
                <MenuBtn primary emblem="▶" label="REPRENDRE LA PARTIE" sub="Une partie sauvegardée t'attend." onClick={resumeGame} />
              )}
              <MenuBtn emblem="🧑‍🚀" label="SOLO" sub="Affronte des adversaires pilotés par l'ordinateur." disabled badge="🔒 BIENTÔT" />
              <MenuBtn emblem="🎮" label="MULTI LOCAL" sub="Tout le monde dans la même pièce, autour d'un écran." onClick={() => setSub('local')} />
              <MenuBtn emblem="🌐" label="MULTI EN LIGNE" sub="Chacun chez soi : héberge une partie ou rejoins-en une." onClick={() => setSub('online')} />
              <MenuBtn emblem="📼" label="VOIR LES THÈMES" sub="Feuillette le bac à cassettes, sans lancer de partie." onClick={() => openConsole('browse')} />
              <MenuBtn emblem="🎛" label="RÉGLAGES" sub="Extensions, plateau, règles, butin, événements." onClick={() => openConsole('settings')} />
              <MenuBtn emblem="✨" label="CRÉDITS" onClick={() => setSub('credits')} />
            </div>
          )}

          {sub === 'local' && (
            <div className="home-menu" style={panel}>
              <div style={subTitle}>🎮 MULTI LOCAL — QUEL ÉCRAN ?</div>
              <MenuBtn emblem="🖥️" label="ÉCRAN TACTILE" sub="Tout se joue au doigt sur cet écran (table tactile, TBI). Les équipes se créent sur place." onClick={() => play('board', false)} />
              <MenuBtn emblem="🕹️" label="ÉCRAN + TÉLÉPHONES" sub="Cet écran affiche le plateau ; chaque joueur rejoint par QR code et pilote son tour depuis son téléphone." onClick={() => play('phone', true)} />
              <BackBtn onClick={() => setSub(null)} />
            </div>
          )}

          {sub === 'online' && (
            <div className="home-menu" style={panel}>
              <div style={subTitle}>🌐 MULTI EN LIGNE</div>
              <MenuBtn emblem="📡" label="HÉBERGER UNE PARTIE" sub="Tu ouvres un lobby, tu crées ton équipe et tu partages le lien ; chacun crée la sienne et joue depuis son écran." onClick={hostOnline} />
              <div className="home-btn" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 26, flex: '0 0 34px', textAlign: 'center' }}>🔗</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontFamily: FONT_DISPLAY, fontSize: 17, letterSpacing: 0.8 }}>REJOINDRE</span>
                    <span style={{ display: 'block', fontSize: 12.5, marginTop: 3, color: '#a89878' }}>Saisis le code donné par l'hôte (ou ouvre son lien).</span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && joinOnline()}
                    placeholder="CODE"
                    maxLength={6}
                    style={{ flex: 1, minWidth: 0, padding: '8px 10px', fontFamily: FONT_MONO, fontSize: 24, letterSpacing: 6, textAlign: 'center', borderRadius: 8, border: '2px solid #5a4023', background: '#120c06', color: '#9be88f', outline: 'none' }}
                  />
                  <button type="button" onClick={joinOnline} disabled={joinCode.trim().length < 3}
                    style={{ fontFamily: FONT_DISPLAY, fontSize: 14, letterSpacing: 0.5, padding: '8px 16px', borderRadius: 8, border: '2px solid #150f08', cursor: joinCode.trim().length < 3 ? 'not-allowed' : 'pointer', background: joinCode.trim().length < 3 ? '#3a2e22' : '#57c84d', color: joinCode.trim().length < 3 ? '#6b5f48' : '#0c2a0a' }}>
                    GO
                  </button>
                </div>
              </div>
              <BackBtn onClick={() => setSub(null)} />
            </div>
          )}

          {sub === 'credits' && (
            <div className="home-menu" style={{ ...panel, color: '#cdbf9e', fontSize: 13.5, lineHeight: 1.55 }}>
              <div style={subTitle}>✨ CRÉDITS</div>
              <div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: '#f4e7cc', marginBottom: 2 }}>La Quête des Matières</div>
                Un jeu de plateau à questions, né en classe et devenu course spatiale.
              </div>
              <div>
                <span style={{ color: '#e8a13a' }}>Conception & direction</span> — Charles Tomi<br />
                <span style={{ color: '#e8a13a' }}>Développement</span> — Charles Tomi, avec Claude (Anthropic)<br />
                <span style={{ color: '#e8a13a' }}>Illustrations & plateaux</span> — images générées par IA, retouchées maison<br />
                <span style={{ color: '#e8a13a' }}>Données & serveurs</span> — Supabase · React · Vite
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: '#7a6a4f' }}>
                Merci aux élèves testeurs de la première heure. 🚀
              </div>
              <BackBtn onClick={() => setSub(null)} />
            </div>
          )}
        </div>

        <div style={{ fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 2, color: '#5a4a30' }}>© 2026 · BÊTA</div>
      </div>
    </div>
  );
}
