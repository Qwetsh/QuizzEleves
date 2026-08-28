/**
 * Nordlys — easter egg « escape game » (cadeau de voyage de noces).
 *
 * Chasse au trésor côté F12 : un indice en console au montage de l'écran des
 * cassettes, le mot de passe SKÅL encodé en base64 dans le DOM (data-voile),
 * et une commande window.lecteur.inserer('SKÅL') qui fait apparaître un rayon
 * secret ᚾᛟᚱᛞᛚᛇᛊ en bas du bac avec une cassette bleu nuit. La cassette ouvre
 * un mini-jeu autonome (lazy, aucune donnée Supabase ni store) qui se termine
 * sur les coordonnées du lieu d'arrivée — à rapporter au site de l'escape game.
 *
 * Hors de ce fichier (et du mini-jeu qu'il lazy-charge), le jeu n'est pas
 * affecté : pas de matière, pas d'entrée en base, pas d'interaction avec les
 * voies ni le drag-drop.
 */
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import NordlysWarp from './NordlysWarp';
// le CSS du déblocage (trou noir, matérialisation) doit être là AVANT tout
// lancement du mini-jeu — pas seulement dans le chunk lazy de NordlysMinigame
import '../../../styles/nordlys.css';

// Clac de la cassette qui s'insère dans la fente (joué au drop). Le fichier est
// une séquence complète de manipulation (7 s : on sort la K7, on l'insère, ça
// ronronne, on éjecte) — lu depuis 0 le clac n'arrivait qu'après 2,3 s. On
// attaque donc directement l'insertion (mesurée à 2,30 s) et on coupe juste
// après, avant le ronron.
const INSERT_SFX = Object.values(import.meta.glob('../../../assets/nordlys/cassette-insert.mp3', {
  eager: true, query: '?url', import: 'default',
}))[0] || null;
const INSERT_SFX_AT = 2.22;   // s — juste avant l'attaque du clac
const INSERT_SFX_LEN = 780;   // ms — le clac et sa queue, pas la suite

const NORDLYS_KEY = 'cassette:nordlys';
const NORDLYS_BLUE = '#0A1020';
const RUNES_TITLE = 'ᚾᛟᚱᛞᛚᛇᛊ';

const FONT_DISPLAY = "'Archivo Black', system-ui, sans-serif";
const FONT_MONO = "'VT323', monospace";

const isUnlocked = () => {
  try { return localStorage.getItem(NORDLYS_KEY) === '1'; } catch { return false; }
};

// « SKÅL » quelle que soit la casse / les accents (Å → A via NFD).
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
// atob() rend les octets UTF-8 en latin1 (« SKÃ…L ») : on répare ce décodage
// naïf avant de comparer — trouver l'énigme ne doit pas se solder par un
// « recraché » pour une subtilité d'encodage. Sur un mot déjà propre,
// decodeURIComponent échoue et on garde la chaîne telle quelle.
const utf8Repair = (s) => { try { return decodeURIComponent(escape(s)); } catch { return s; } };
const normalizeWord = (mot) => utf8Repair(String(mot ?? ''))
  .normalize('NFD')
  .replace(COMBINING_MARKS, '')
  .trim()
  .toUpperCase();

// Le mot ne s'écrit plus en clair ici : un `grep SKAL` dans le bundle livré
// sautait par-dessus toute la chasse. Ce n'est PAS une serrure — `data-voile`
// porte volontairement le mot en base64, c'est la piste, et elle doit rester
// déchiffrable. Juste de quoi ne pas le servir tout cuit.
const empreinte = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
};
const MOT_DE_LA_VOILE = '92d157f6';

// `*mot*` souligne le mot : les deux mots soulignés de l'indice SONT la piste
// (l'onglet Elements du F12, et l'attribut data-voile qui s'y cache).
const RUNE_STYLE = 'color:#5EE0A0;font-family:monospace;font-size:14px';
const logRune = (msg) => {
  const parts = String(msg).split('*');
  console.log(
    parts.map((p) => `%c${p}`).join(''),
    ...parts.map((_, i) => (i % 2 ? `${RUNE_STYLE};text-decoration:underline` : RUNE_STYLE)),
  );
};

/**
 * À monter une fois dans SelectionCassettes : indice console + window.lecteur
 * (exposé uniquement tant que cet écran est monté). Retourne { unlocked }.
 */
export function useNordlysEgg() {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  useEffect(() => {
    logRune("Une cassette n'est pas sur l'étagère. Konami ne marche pas ici :\n"
      + "pour la trouver, il faut être dans son *élément* — et y entrevoir la *voile*.");
    const lecteur = {
      inserer(mot) {
        if (empreinte(normalizeWord(mot)) === MOT_DE_LA_VOILE) {
          if (isUnlocked()) { logRune("Elle est déjà sur l'étagère."); return; }
          try { localStorage.setItem(NORDLYS_KEY, '1'); } catch { /* quota */ }
          logRune("La cassette s'insère.");
          // le trou noir avale le bac, puis recrache la cassette (NordlysShelf
          // écoute) — le rayon secret apparaît quand elle en ressort
          window.dispatchEvent(new CustomEvent('nordlys:warp'));
          setTimeout(() => setUnlocked(true), 2900);
        } else {
          logRune('Le lecteur la recrache.');
        }
      },
    };
    window.lecteur = lecteur;
    return () => { if (window.lecteur === lecteur) delete window.lecteur; };
  }, []);
  return { unlocked };
}

/**
 * La voile : le mot de passe en base64, invisible, à ne surtout pas « corriger ».
 * `data-fente` = le mode d'emploi, posé sur la div que le joueur inspecte déjà —
 * sans lui, rien n'indique que window.lecteur existe (trou dans la chaîne d'indices).
 */
export function NordlysVoile() {
  return <div data-voile="U0vDhUw=" data-fente="window.lecteur.inserer(mot)" hidden />;
}

const NordlysMinigame = lazy(() => import('./NordlysMinigame'));

// Jaquette illustrée optionnelle : déposer src/assets/nordlys/cassette.png
// (l'illustration mariage/fjord) suffit à l'activer — sinon, visuel dessiné.
const NORDLYS_ART = Object.values(
  import.meta.glob('../../../assets/nordlys/cassette.png', { eager: true, import: 'default' }),
)[0] || null;

/**
 * Rayon secret en bas du bac à cassettes. Rien tant que non débloqué ; sinon
 * une plaque bleu nuit repliable + la cassette Nordlys (clic → mini-jeu).
 */
export default function NordlysShelf({ unlocked }) {
  const [open, setOpen] = useState(true);
  const [playing, setPlaying] = useState(false);
  // Déblocage console (SKÅL dans le F12) : la séquence « singularité » jouée
  // par NordlysWarp, sur la ZONE DU BAC uniquement (la machine à fentes reste
  // visible et utilisable à droite). `bay` = le conteneur du bac, cible du
  // portail — NordlysShelf vit dans le rack scrollable, qui n'est pas le bon
  // repère pour un overlay.
  const [bay, setBay] = useState(null);

  useEffect(() => {
    const startWarp = () => setBay((cur) => cur || document.querySelector('[data-nl-bay]'));
    window.addEventListener('nordlys:warp', startWarp);
    return () => window.removeEventListener('nordlys:warp', startWarp);
  }, []);
  // Drag & drop maison (autonome, sans toucher au drag des thèmes) : on INSÈRE
  // la cassette dans le Curioscope, comme les vraies. `drag` pilote le fantôme
  // (portail body : coordonnées client, hors du stage transformé).
  const [drag, setDrag] = useState(null); // { x, y, over }
  const [hint, setHint] = useState(false); // simple clic → apprend le geste
  const dragRef = useRef(null);
  const hintTimer = useRef(null);
  const rootRef = useRef(null);
  // Le clac est décodé d'avance : construire l'Audio au moment du drop ajoutait
  // le chargement du fichier au retard déjà causé par le silence de tête.
  const insertSfx = useRef(null);
  const insertStop = useRef(null);
  // NordlysShelf est monté en permanence dans le bac (seul son contenu dépend du
  // déblocage) : précharger sans condition faisait télécharger 160 ko de clac à
  // TOUTE classe qui ouvre l'écran des cassettes. On attend que la cassette
  // existe — au déblocage (`bay`) ou dans une session déjà débloquée.
  const besoinDuClac = unlocked || !!bay;
  useEffect(() => {
    if (!INSERT_SFX || !besoinDuClac) return undefined;
    const a = new Audio(INSERT_SFX);
    a.preload = 'auto';
    insertSfx.current = a;
    return () => { clearTimeout(insertStop.current); a.pause(); insertSfx.current = null; };
  }, [besoinDuClac]);
  const playInsert = () => {
    const a = insertSfx.current;
    if (!a) return;
    clearTimeout(insertStop.current);
    try { a.currentTime = INSERT_SFX_AT; } catch { /* métadonnées pas encore là */ }
    a.play().catch(() => {});
    insertStop.current = setTimeout(() => a.pause(), INSERT_SFX_LEN);
  };

  const overMachine = (e) => {
    const m = document.querySelector('[data-dropzone="machine"]');
    if (!m) return false;
    const r = m.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  };
  const startDrag = (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return;
    ev.preventDefault();
    const start = { x: ev.clientX, y: ev.clientY };
    dragRef.current = { active: false };
    const move = (e) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.active && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) d.active = true;
      if (d.active) setDrag({ x: e.clientX, y: e.clientY, over: overMachine(e) });
    };
    const end = (e) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (d?.active) {
        if (overMachine(e)) {
          // clac : la cassette entre dans la fente
          playInsert();
          setBay(null);          // referme l'écrin du déblocage s'il était ouvert
          setPlaying(true);
        }
      } else {
        // simple clic : on souffle le geste attendu
        setHint(true);
        clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(false), 2600);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  useEffect(() => () => clearTimeout(hintTimer.current), []);
  // Débloqué EN DIRECT (via la console) → on fait défiler le bac jusqu'au rayon
  // pour que l'apparition se voie ; au chargement d'une session déjà débloquée,
  // pas de défilement intempestif.
  const wasUnlocked = useRef(unlocked);
  useEffect(() => {
    if (unlocked && !wasUnlocked.current) {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    wasUnlocked.current = unlocked;
  }, [unlocked]);

  // L'écrin du déblocage joue AVANT que le rayon n'existe : son portail doit
  // être rendu dans les deux cas. La cassette qui naît de la singularité est
  // draggable (même startDrag que celle du rayon) vers les fentes du Curioscope.
  // L'atténuation pendant le drag est portée par la jaquette et non par son
  // cadre : celui-ci est piloté en JS par NordlysWarp (flottaison), un style
  // React dessus serait écrasé — ou l'écraserait.
  const warpOverlay = bay && createPortal(
    <NordlysWarp active
      cassetteProps={{ onPointerDown: startDrag, title: "Une cassette qui n'existe pas — glisse-moi dans le Curioscope" }}>
      {NORDLYS_ART ? (
        <img src={NORDLYS_ART} alt="" draggable={false}
          style={{ position: 'absolute', width: '106%', left: '-3%', top: '-23.5%', height: 'auto',
            opacity: drag ? 0.3 : 1 }} />
      ) : (
        <span style={{ position: 'absolute', inset: 0, background: NORDLYS_BLUE, border: '3px solid #050810',
          borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: FONT_DISPLAY, fontSize: 17, letterSpacing: 4, color: '#9fd8ff',
          opacity: drag ? 0.3 : 1 }}>{RUNES_TITLE}</span>
      )}
    </NordlysWarp>,
    bay,
  );

  // ⚠️ Le portail de l'écrin doit garder la MÊME place dans l'arbre React que
  // le rayon soit là ou non : `unlocked` bascule en plein milieu de la séquence
  // (le rayon naît sous le fond opaque). Un `if (!unlocked) return warpOverlay`
  // le déplacerait d'un cran → React démonte/remonte NordlysWarp, qui rejoue
  // toute sa timeline. D'où ce fragment à structure fixe.
  return (
    <>
    {unlocked && (
    <div ref={rootRef} style={{ margin: '14px 11px 4px' }}>
      {/* Plaque du rayon — même gabarit que les séparateurs, mais nuit polaire. */}
      <button onClick={() => setOpen((o) => !o)} title="Un rayon qui n'existe pas"
        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '7px 12px', cursor: 'pointer', userSelect: 'none', borderRadius: 6,
          border: '2px solid #1c2c4a', background: `linear-gradient(180deg, #101a30, ${NORDLYS_BLUE})`,
          boxShadow: 'inset 0 2px 0 rgba(120,200,255,.12), 0 3px 8px rgba(0,0,0,.35)' }}>
        <span style={{ flex: '0 0 auto', fontSize: 14, color: '#5EE0A0' }}>ᚾ</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontFamily: FONT_DISPLAY, fontSize: 13,
          letterSpacing: 3, color: '#9fd8ff', textShadow: '0 0 8px rgba(94,224,160,.45)' }}>{RUNES_TITLE}</span>
        <span style={{ flex: '0 0 auto', fontFamily: FONT_MONO, fontSize: 12, color: '#5EE0A0' }}>1</span>
        <span style={{ flex: '0 0 auto', fontFamily: FONT_DISPLAY, fontSize: 12, color: '#9fd8ff' }}>{open ? '▾' : '▸'}</span>
      </button>

      {/* La cassette — face visible directement (pas de crate-digging : elle est unique). */}
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .34s cubic-bezier(.4,0,.2,1)' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 6px 8px' }}>
            {NORDLYS_ART ? (
              // Jaquette illustrée : l'image (carrée, fond crème) est recadrée
              // sur la cassette dessinée qu'elle contient (ratio ≈ 1,38).
              <button onPointerDown={startDrag}
                title="Une cassette qui n'existe pas — glisse-moi dans le Curioscope"
                style={{ position: 'relative', width: 250, height: 181, padding: 0, cursor: 'grab', touchAction: 'none',
                  border: 0, background: 'transparent', overflow: 'hidden', borderRadius: 12,
                  opacity: drag ? 0.3 : 1,
                  filter: 'drop-shadow(0 12px 22px rgba(0,0,0,.6)) drop-shadow(0 0 14px rgba(94,224,160,.35))',
                  animation: 'qm-float 3.2s ease-in-out infinite',
                  transition: 'opacity .6s ease' }}>
                <img src={NORDLYS_ART} alt="" draggable={false}
                  style={{ position: 'absolute', width: '106%', left: '-3%', top: '-23.5%', height: 'auto' }} />
              </button>
            ) : (
            <button onPointerDown={startDrag}
              title="Une cassette qui n'existe pas — glisse-moi dans le Curioscope"
              style={{ position: 'relative', width: 238, height: 148, padding: 0, cursor: 'grab', touchAction: 'none',
                opacity: drag ? 0.3 : 1,
                border: '3px solid #050810', borderRadius: 10, background: NORDLYS_BLUE,
                boxShadow: '0 10px 26px rgba(0,0,0,.55), 0 0 18px rgba(94,224,160,.28), inset 0 3px 0 rgba(120,200,255,.18), inset 0 -7px 0 rgba(0,0,0,.4)',
                animation: 'qm-float 3.2s ease-in-out infinite',
                transition: 'opacity .6s ease' }}>
              {/* tranche latérale avec le titre en runes */}
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 44, borderRight: '3px solid #050810',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: FONT_DISPLAY,
                  fontSize: 13, letterSpacing: 4, color: '#9fd8ff', textShadow: '0 0 8px rgba(94,224,160,.6)', whiteSpace: 'nowrap' }}>
                  {RUNES_TITLE}
                </span>
              </span>
              {/* fenêtre : aurore boréale */}
              <span style={{ position: 'absolute', left: 44, right: 7, top: 7, bottom: 7, border: '2px solid #050810',
                borderRadius: 4, overflow: 'hidden',
                background: 'linear-gradient(200deg, rgba(94,224,160,.55) 0%, rgba(60,140,220,.4) 34%, rgba(10,16,32,.95) 62%), #0c1428' }}>
                <span style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 26, background: 'rgba(4,7,14,.85)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 3, color: '#5EE0A0' }}>NORDLYS</span>
                </span>
                <span style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center',
                  fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 2, color: '#cfe8ff', opacity: .85 }}>
                  ▶ FACE A — 45 MIN
                </span>
              </span>
            </button>
            )}
          </div>
          {/* simple clic : on apprend le geste sans lancer quoi que ce soit */}
          {hint && (
            <div style={{ textAlign: 'center', paddingBottom: 8, fontFamily: FONT_MONO, fontSize: 14,
              letterSpacing: 1.5, color: '#5EE0A0', textShadow: '0 0 8px rgba(94,224,160,.5)' }}>
              GLISSE-MOI DANS LE CURIOSCOPE →
            </div>
          )}
        </div>
      </div>
    </div>
    )}

      {/* Fantôme de drag — portail body : coordonnées client, hors du stage scalé. */}
      {drag && createPortal(
        <div style={{ position: 'fixed', left: drag.x, top: drag.y, zIndex: 520, pointerEvents: 'none',
          transform: `translate(-110px,-80px) rotate(${drag.over ? -1 : -5}deg) scale(${drag.over ? 1.06 : 1})`,
          transition: 'transform .15s ease' }}>
          {NORDLYS_ART ? (
            <div style={{ position: 'relative', width: 220, height: 159, overflow: 'hidden', borderRadius: 10,
              filter: `drop-shadow(0 22px 30px rgba(4,8,16,.6)) drop-shadow(0 0 ${drag.over ? 26 : 12}px rgba(94,224,160,${drag.over ? 0.75 : 0.35}))` }}>
              <img src={NORDLYS_ART} alt="" draggable={false}
                style={{ position: 'absolute', width: '106%', left: '-3%', top: '-23.5%', height: 'auto' }} />
            </div>
          ) : (
            <div style={{ width: 220, height: 138, border: '3px solid #050810', borderRadius: 10, background: NORDLYS_BLUE,
              boxShadow: `0 22px 30px rgba(4,8,16,.6), 0 0 ${drag.over ? 26 : 12}px rgba(94,224,160,${drag.over ? 0.75 : 0.35})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_DISPLAY,
              fontSize: 15, letterSpacing: 3, color: '#9fd8ff' }}>
              {RUNES_TITLE}
            </div>
          )}
          <div style={{ position: 'absolute', right: -10, bottom: -12, background: '#0a1020', color: '#5EE0A0',
            fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 1, padding: '2px 8px', borderRadius: 4,
            border: '1px solid #1c2c4a', transform: 'rotate(3deg)', whiteSpace: 'nowrap' }}>
            {drag.over ? '⏏ LÂCHE — ELLE S\'INSÈRE' : '▸ VERS LE CURIOSCOPE'}
          </div>
        </div>,
        document.body,
      )}

      {warpOverlay}

      {/* Portail body : l'écran des cassettes vit dans un stage transformé (scale)
          → un position:fixed y serait piégé et ne couvrirait pas tout l'écran. */}
      {playing && createPortal(
        <Suspense fallback={null}>
          <NordlysMinigame onClose={() => setPlaying(false)} />
        </Suspense>,
        document.body,
      )}
    </>
  );
}
