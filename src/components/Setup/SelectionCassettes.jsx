/**
 * SelectionCassettes — écran de sélection « Lecteur de cassettes ».
 *
 * Portage fidèle du prototype Claude Design "Lecteur de cassettes.dc.html"
 * (classe DCLogic) en composant fonctionnel React.
 *
 * ⚠️ Preview autonome (monté via ?cassettes) : données MOCK (DOMAINS/GROUPS),
 * non encore câblé au vrai modèle de thèmes ni au gameStore. La couture avec
 * l'arbre de thèmes + startGame se fera quand le modèle de données sera en place.
 * Voir DESIGN_SELECTION_CASSETTES.md et DESIGN_MODULES.md.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@fontsource/vt323/400.css';
import '@fontsource/archivo-black/400.css';
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/500.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/hanken-grotesk/700.css';
import '@fontsource/hanken-grotesk/800.css';
import '../../styles/cassettes.css';
import cassetteTop from '../../assets/cassette-top.png';
import separatorPlaque from '../../assets/separator-plaque.png';
import { useGameStore } from '../../store/gameStore';
import { useAudioStore } from '../../store/audioStore';
import { themesToCassetteModel, buildPerimeter } from '../../logic/perimeter';
import { getQuestions } from '../../data/questions';
// Composants Setup existants hébergés dans les panneaux de la console.
import TeamCount from './TeamCount';
import TeamCustomization from './TeamCustomization';
import LobbyPanel from './LobbyPanel';
import ExtensionsChecklist from './ExtensionsChecklist';
import BoardParams from './BoardParams';
import EventsChecklist from './EventsChecklist';
import ItemsChecklist, { equipmentItemKeys } from './ItemsChecklist';
import StarterChestConfig from './StarterChestConfig';
import RulesConfig from './RulesConfig';
import QuestionsEditor from './QuestionsEditor';
import BalanceEditor from './BalanceEditor';
import EventsEditor from './EventsEditor';
import { OFFLINE } from '../../logic/offline';
import { EXTENSIONS, extOn } from '../../extensions/registry';
import { EVENTS } from '../../data/events';

const FONT_DISPLAY = "'Archivo Black', system-ui, sans-serif";
const FONT_UI = "'Hanken Grotesk', system-ui, sans-serif";
const FONT_MONO = "'VT323', monospace";

// Pile « crate-digging » : chaque carte (bouton) fait EXACTEMENT la hauteur de sa
// tranche visible (STRIP) — la face déployée au survol vit en absolu dans __box et
// déborde librement. Ainsi la zone de survol = la zone visible : pas de « queue »
// invisible qui capterait la souris au-dessus du séparateur suivant.
// Dimensions en px du stage 1600×900 (mis à l'échelle uniformément → fiable).
const STRIP = 42;              // tranche visible au repos (= étiquette « vue du dessus »)
const FACE_CLEAR = 194;        // débord max de la face déployée sous sa tranche (ratio 1,33 + ombre)
// Glissement des cartes SOUS la K7 survolée : doit dégager la hauteur de la face
// révélée en entier (largeur colonne ≈ 288px / ratio 1,4 ≈ 206px, × cos(32°) ≈ 175px
// sous la charnière) pour que leurs tranches restent lisibles sous la cassette.
const SLIDE = 180;

// Visuels de cassette thématisés (vue de face) : 1 fichier par clé de thème dans
// src/assets/cassettes/<themeKey>.png. Map auto → déposer un PNG suffit à l'activer.
// Les thèmes sans visuel dédié gardent la cassette générique (vue du dessus).
const CASSETTE_ART = Object.entries(
  import.meta.glob('../../assets/cassettes/*.png', { eager: true, import: 'default' }),
).reduce((acc, [path, url]) => {
  const key = path.split('/').pop().replace(/\.png$/, '');
  acc[key] = url;
  return acc;
}, {});

// Les thèmes GÉNÉRAUX (carte intégrale/cartouche du rayon) n'ont pas de jaquette
// dédiée : on leur prête celle d'un sous-thème représentatif du rayon. Clés =
// clés racines de l'arbre quete_themes ; un PNG dédié déposé plus tard (ex.
// sport_g.png) reprend automatiquement la main.
const GENERAL_ART = {
  scolaire: 'francais',
  histoire_g: 'moyen_age',
  geographie_g: 'pays_capitales',
  sciences_g: 'astronomie_espace',
  nature_g: 'animaux',
  arts_g: 'peinture_sculpture',
  divertissement_g: 'cinema',
  sport_g: 'athletisme_jo',
  societe_g: 'politique_institutions',
};
for (const [gen, sub] of Object.entries(GENERAL_ART)) {
  if (!CASSETTE_ART[gen] && CASSETTE_ART[sub]) CASSETTE_ART[gen] = CASSETTE_ART[sub];
}

// --- Données mock (preview ?cassettes ; le mode `live` lit l'arbre réel) -----
const MOCK_DOMAINS = [
  { id: 'div', name: 'DIVERTISSEMENT', color: '#d2622b', ink: '#3a1c0e', emblem: '★', biome: 'Studio & Paillettes', sceneBg: '#f0c9a0' },
  { id: 'spo', name: 'SPORT', color: '#16998c', ink: '#06302c', emblem: '◈', biome: 'Stade Olympique', sceneBg: '#a8ddd5' },
  { id: 'sci', name: 'SCIENCES', color: '#5566b5', ink: '#1b2350', emblem: '✦', biome: 'Labo Cosmos', sceneBg: '#c3c9ee' },
  { id: 'sco', name: 'SCOLAIRE', color: '#4f7a4a', ink: '#16301a', emblem: '✎', biome: 'Cour de Récré', sceneBg: '#b8d3b2' },
  { id: 'imp', name: 'IMPORTS', color: '#b83a55', ink: '#3e0e1a', emblem: '☆', biome: 'Marché aux Puces', sceneBg: '#edb9c4' },
];

const MOCK_GROUPS = [
  { domain: 'div', items: [
    { id: 'div_int', label: 'Divertissement', type: 'integrale', sub: ['Séries', 'Cinéma', 'Musique', 'Télé-réalité'] },
    { id: 'div_series', label: 'Séries', type: 'theme' },
    { id: 'div_cine', label: 'Cinéma', type: 'theme' },
    { id: 'div_music', label: 'Musique', type: 'theme' },
    { id: 'div_jv', label: 'Jeux Vidéo', type: 'theme' },
  ] },
  { domain: 'spo', items: [
    { id: 'spo_int', label: 'Sport', type: 'integrale', sub: ['Football', 'Tennis', 'J.O.', 'Cyclisme'] },
    { id: 'spo_foot', label: 'Football', type: 'theme' },
    { id: 'spo_tennis', label: 'Tennis', type: 'theme' },
    { id: 'spo_jo', label: 'Jeux Olympiques', type: 'theme' },
  ] },
  { domain: 'sci', items: [
    { id: 'sci_int', label: 'Sciences', type: 'integrale', sub: ['Maths', 'Physique', 'SVT', 'Espace'] },
    { id: 'sci_espace', label: 'Espace', type: 'theme' },
    { id: 'sci_corps', label: 'Corps Humain', type: 'theme' },
    { id: 'sci_nat', label: 'Animaux', type: 'theme' },
  ] },
  { domain: 'sco', items: [
    { id: 'sco_prog', label: 'Programme', type: 'cartouche', sub: ['Français', 'Maths', 'Hist-Géo', 'SVT', 'Anglais'] },
    { id: 'sco_rev', label: 'Spécial Brevet', type: 'cartouche', sub: ['Brevet', 'Contrôle'] },
  ] },
  { domain: 'imp', items: [
    { id: 'imp_friends', label: 'Friends', type: 'import' },
    { id: 'imp_sw', label: 'Star Wars', type: 'import' },
    { id: 'imp_kpop', label: 'K-Pop', type: 'import' },
    { id: 'imp_pkmn', label: 'Pokémon', type: 'import' },
  ] },
];

const VU = Array.from({ length: 30 }, (_, i) => {
  const r = (i % 15) / 14;
  const color = r < 0.6 ? '#57c84d' : (r < 0.85 ? '#e8a13a' : '#e14b3a');
  return { color, dur: (0.7 + ((i * 37) % 50) / 100).toFixed(2), delay: ((i * 53) % 90) / 100 };
});

// Sélecteur de fonction de la console (onglets stylés « boutons illuminés »).
const CONSOLE_TABS = [
  { id: 'themes', label: 'THÈMES', emblem: '📼' },
  { id: 'mode', label: 'MODE DE JEU', emblem: '🎮' },
  { id: 'reglages', label: 'RÉGLAGES', emblem: '🎛' },
];

// Sous-catégories de l'onglet RÉGLAGES (rail vertical « façon menu d'options »).
// Une seule catégorie visible à la fois → fini la colonne fourre-tout.
const REGLAGES_CATS = [
  { id: 'extensions', emblem: '🧩', label: 'EXTENSIONS' },
  { id: 'plateau', emblem: '🗺️', label: 'PLATEAU' },
  { id: 'regles', emblem: '⚔️', label: 'RÈGLES' },
  { id: 'butin', emblem: '🎁', label: 'BUTIN & OBJETS' },
  { id: 'events', emblem: '✨', label: 'ÉVÉNEMENTS' },
];

// Catégorie RÉGLAGES « Outils/Éditeurs » : ajoutée au rail uniquement quand les
// outils sont déverrouillés (dev, ou triple-clic sur le logo + code, hors ligne exclu).
const OUTILS_CAT = { id: 'outils', emblem: '🛠️', label: 'OUTILS / ÉDITEURS' };
const TOOLS_UNLOCK_KEY = 'quete_tools_unlock';
const TOOLS_CODE = '54150';

// Modes de jeu. Les 3 premiers sont actifs : ils pilotent connectionMode
// (board/phone) + phoneController (manette téléphone — l'équipe active joue
// son tour depuis son mobile, le TBI reste maître et utilisable en parallèle).
const GAME_MODES = [
  { id: 'tbi', conn: 'board', controller: false, emblem: '🖥️', name: 'Surface tactile (TBI)', desc: 'Tout se joue sur l’écran tactile. Les équipes se créent ici.', ready: true },
  { id: 'companion', conn: 'phone', controller: false, emblem: '📱', name: 'Téléphone + TBI', desc: 'Les élèves rejoignent par QR ; on joue sur le TBI.', ready: true },
  { id: 'manette', conn: 'phone', controller: true, emblem: '🕹️', name: 'Téléphone-manette', desc: 'Les élèves rejoignent par QR ; l’équipe active joue son tour (dé, réponses, choix) sur son téléphone.', ready: true },
  { id: 'online', emblem: '🌐', name: 'Jeu en ligne', desc: 'Partie et connexion 100 % en ligne.', ready: false },
];

// Niveaux scolaires proposés au lancement (un par classe, choisis dans le menu
// de lancement — plus dans le header). Le Lycée est présent même sans contenu :
// le menu marque « 0 question » et désactive le lancement le cas échéant.
const LYCEE_LEVELS = ['2nde', '1ere', 'terminale'];
const SCHOOL_LEVELS = [
  { id: '6e', label: '6e' },
  { id: '5e', label: '5e' },
  { id: '4e', label: '4e' },
  { id: '3e', label: '3e' },
  { id: 'lycee', label: 'Lycée' },
];
// Valeur `level` (tableau à plat) passée à getQuestions/buildPerimeter pour un
// ou plusieurs id de niveau ('lycee' se déplie en ses 3 niveaux).
const levelArg = (ids) => {
  const arr = Array.isArray(ids) ? ids : [ids];
  return arr.flatMap((id) => (id === 'lycee' ? LYCEE_LEVELS : [id]));
};

// Modèle actif (mock en preview ?cassettes, arbre réel en mode live). Un seul
// écran SelectionCassettes est monté à la fois → variable de module sûre.
let ACTIVE = { DOMAINS: MOCK_DOMAINS, GROUPS: MOCK_GROUPS };

// --- Helpers (lisent le modèle actif) ---------------------------------------
const domainById = (id) => ACTIVE.DOMAINS.find((d) => d.id === id);
const themeById = (id) => {
  for (const g of ACTIVE.GROUPS) {
    const it = g.items.find((x) => x.id === id);
    if (it) return { domain: g.domain, ...it };
  }
  return null;
};

// Outils/éditeurs habillés « console » : boutons plastique foncé sur l'encart
// crème (panelInset), au lieu du panneau bleu générique de l'ancien Setup. Les
// éditeurs eux-mêmes s'ouvrent en plein écran (portail) — inchangés.
function ConsoleEditorTools() {
  const [showQuestionsEditor, setShowQuestionsEditor] = useState(false);
  const [showBalanceEditor, setShowBalanceEditor] = useState(false);
  const [showEventsEditor, setShowEventsEditor] = useState(false);
  const btn = {
    fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: 0.4, padding: '14px 14px',
    borderRadius: 9, cursor: 'pointer', border: '2px solid #150f08', background: '#3a2e22',
    color: '#f4e7cc', boxShadow: 'inset 0 2px 0 rgba(255,255,255,.12),inset 0 -3px 0 rgba(0,0,0,.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center',
  };
  const openAnalyse = () =>
    window.open(`${window.location.origin}${import.meta.env.BASE_URL || '/'}?analyse`, '_blank', 'noopener');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, letterSpacing: 0.5, color: '#3a2c1a' }}>🛠️ Outils d'édition</div>
        <div style={{ fontSize: 13, color: '#6b5f48', marginTop: 5, lineHeight: 1.45 }}>
          Questions, équilibrage (objets · pouvoirs · loot · alchimie) et événements. Les modifications sont écrites dans la base.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button style={btn} onClick={() => setShowQuestionsEditor(true)}>📚 Éditer les questions</button>
        <button style={btn} onClick={() => setShowBalanceEditor(true)}>⚖️ Éditer l'équilibrage</button>
        <button style={btn} onClick={() => setShowEventsEditor(true)}>✨ Éditer les événements</button>
        <button style={btn} onClick={openAnalyse}>📊 Analyse des parties</button>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: '#7a6a4f', borderTop: '1px solid rgba(122,94,58,.28)', paddingTop: 11, lineHeight: 1.4 }}>
        ⚗️ L'alchimie (ingrédients, potions, recettes) se règle dans l'éditeur d'équilibrage → onglet « Alchimie ».
      </div>
      {showQuestionsEditor && <QuestionsEditor onClose={() => setShowQuestionsEditor(false)} />}
      {showBalanceEditor && <BalanceEditor onClose={() => setShowBalanceEditor(false)} />}
      {showEventsEditor && <EventsEditor onClose={() => setShowEventsEditor(false)} />}
    </div>
  );
}

export default function SelectionCassettes({ voies = 6, reperesRatio = true, live = false, main = false }) {
  const liveData = live || main; // `main` (console de setup) implique les données réelles
  // Source de données : arbre réel (live/main) ou mocks (preview ?cassettes).
  const model = liveData ? themesToCassetteModel() : { DOMAINS: MOCK_DOMAINS, GROUPS: MOCK_GROUPS };
  ACTIVE = model;
  const { DOMAINS, GROUPS } = model;
  // Actions store (toujours appelées ; utilisées seulement en live/main).
  const startGameFromPerimeter = useGameStore((s) => s.startGameFromPerimeter);
  const setPhase = useGameStore((s) => s.setPhase);
  const useBrevet = useGameStore((s) => s.useBrevet);
  // Niveaux scolaires choisis au lancement — MULTI-sélection (ex. 6e + 5e).
  const [levels, setLevels] = useState(['6e', '5e', '4e', '3e']);
  const toggleLevel = (id) => setLevels((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const [showLaunch, setShowLaunch] = useState(false); // menu de lancement (niveaux + classe)
  const [tab, setTab] = useState('themes');
  const [reglSub, setReglSub] = useState('extensions'); // sous-onglet actif de RÉGLAGES
  // Accès aux outils/éditeurs hors dev : triple-clic sur le logo de la console + code.
  const [toolsUnlocked, setToolsUnlocked] = useState(() => {
    try { return localStorage.getItem(TOOLS_UNLOCK_KEY) === '1'; } catch { return false; }
  });
  const logoClicks = useRef({ n: 0, t: 0 });
  const showTools = import.meta.env.DEV || toolsUnlocked;
  const toolsAvailable = showTools && !OFFLINE; // éditeurs = écritures Supabase
  const handleLogoClick = () => {
    const now = Date.now();
    const c = logoClicks.current;
    if (now - c.t > 700) c.n = 0;
    c.t = now; c.n += 1;
    if (c.n < 3) return;
    c.n = 0;
    if (toolsUnlocked) return;
    const code = window.prompt('Code de déverrouillage des outils :');
    if (code == null) return;
    if (code.trim() === TOOLS_CODE) {
      try { localStorage.setItem(TOOLS_UNLOCK_KEY, '1'); } catch { /* quota */ }
      setToolsUnlocked(true);
      setTab('reglages'); setReglSub('outils');
    } else {
      window.alert('Code incorrect.');
    }
  };
  const englishMode = useGameStore((s) => s.englishMode);
  const setEnglishMode = useGameStore((s) => s.setEnglishMode);
  const audioMuted = useAudioStore((s) => s.muted);
  const toggleAudioMuted = useAudioStore((s) => s.toggleMuted);
  const classLabel = useGameStore((s) => s.classLabel);
  const setClassLabel = useGameStore((s) => s.setClassLabel);
  const connectionMode = useGameStore((s) => s.connectionMode);
  const setConnectionMode = useGameStore((s) => s.setConnectionMode);
  // Manette téléphone : piloté par la carte « Téléphone-manette » du MODE DE JEU.
  const phoneController = useGameStore((s) => s.phoneController);
  const setPhoneController = useGameStore((s) => s.setPhoneController);
  const extensions = useGameStore((s) => s.extensions);
  // Lectures pour les résumés du rail RÉGLAGES + le slider de fréquence d'événements.
  const boardParams = useGameStore((s) => s.boardParams);
  const setBoardParam = useGameStore((s) => s.setBoardParam);
  const forcedDuels = useGameStore((s) => s.forcedDuels);
  const enabledEvents = useGameStore((s) => s.enabledEvents);
  const enabledItems = useGameStore((s) => s.enabledItems);
  const starterChestConfig = useGameStore((s) => s.starterChestConfig);
  const phoneMode = connectionMode === 'phone';
  const itemsOn = extOn(extensions, 'equipment'); // coffre/objets dépendent de l'extension « Objets »

  const [slots, setSlots] = useState([]);
  const [drag, setDrag] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(-1);
  const [lastCard, setLastCard] = useState(null);
  const [boost, setBoost] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [full, setFull] = useState(false); // eslint-disable-line no-unused-vars
  const [scale, setScale] = useState(1);
  // Rayons ouverts : PLUSIEURS à la fois (Set d'ids) — la place se gère par le
  // scroll vertical du bac. Le 1er rayon démarre ouvert.
  const [openDomains, setOpenDomains] = useState(() => new Set(DOMAINS[0]?.id ? [DOMAINS[0].id] : []));
  // Rayons dont l'accordéon est stabilisé OUVERT (fin de transition) : on leur rend
  // overflow:visible pour que le pop-out 3D des cassettes ne soit pas rogné.
  // Pendant l'animation (repli/dépli) un rayon reste hidden → clip propre.
  const [settledDomains, setSettledDomains] = useState(() => new Set(DOMAINS[0]?.id ? [DOMAINS[0].id] : []));
  // Cassette survolée (crate-digging) : { domain, idx }. Sert à incliner la K7
  // ET à écarter ses voisines du même rayon pour lui faire de la place.
  const [hoverTape, setHoverTape] = useState(null);
  // Sous-thèmes (depth 1) dont on a déroulé les sous-sous-thèmes (mini-cassettes).
  // Repliés par défaut → l'étagère reste lisible ; la flèche discrète les ouvre.
  const [expandedSubs, setExpandedSubs] = useState(() => new Set());
  const toggleSubtree = (id) => setExpandedSubs((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const outerRef = useRef(null);

  // Refs transitoires pour le drag (évite les closures périmées des listeners window).
  const dragIdRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const suppressTapRef = useRef(0);
  const slotsRef = useRef(slots);
  const timers = useRef({});

  const voiesCount = Math.max(3, Math.min(6, voies || 6));
  const ratioOn = reperesRatio !== false;

  useEffect(() => { slotsRef.current = slots; }, [slots]);
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  // ---------- fit : mise à l'échelle du "stage" 1600×900 ----------
  const fit = useCallback(() => {
    const o = outerRef.current;
    if (!o) return;
    const s = Math.min(o.clientWidth / 1600, o.clientHeight / 900);
    if (s && Math.abs(s - scale) > 0.002) setScale(s);
  }, [scale]);

  useEffect(() => {
    fit();
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fit]);

  // Accordéon vertical : chaque plaque déplie/replie SON rayon indépendamment
  // (plusieurs rayons ouverts en même temps). Seul le rayon qui bouge est
  // « désettlé » (overflow hidden le temps de son animation), les autres gardent
  // leur pop-out 3D intact.
  const toggleDomain = (id) => {
    setOpenDomains((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSettledDomains((cur) => {
      if (!cur.has(id)) return cur;
      const next = new Set(cur);
      next.delete(id);
      return next;
    });
  };

  // ---------- modèle de voie ----------
  const makeVoie = (t) => {
    const dom = domainById(t.domain);
    return {
      uid: `${t.id}_${Math.random().toString(36).slice(2, 7)}`,
      themeId: t.id, label: t.label, type: t.type, domain: t.domain, depth: t.depth ?? 0,
      domainName: dom.name, color: t.type === 'integrale' ? '#e2b43a' : dom.color, ink: dom.ink,
      subs: (t.sub || []).map((s) => (typeof s === 'string'
        ? { label: s, subjectKey: null, excluded: false }
        : { label: s.label, subjectKey: s.key ?? null, excluded: false })),
    };
  };
  const firstEmpty = () => {
    for (let i = 0; i < voiesCount; i++) { if (!slotsRef.current[i]) return i; }
    return -1;
  };

  const flashFull = () => {
    setFull(true);
    clearTimeout(timers.current.full);
    timers.current.full = setTimeout(() => setFull(false), 900);
  };

  const commit = useCallback((id, idx) => {
    const t = themeById(id);
    if (!t) return;
    // Anti-doublon : un thème déjà inséré dans le Curioscope ne peut pas l'être une
    // 2e fois (garde ici = couvre tap ET drag, quel que soit le chemin d'entrée).
    if (slotsRef.current.some((v) => v && v.themeId === id)) return;
    const voie = makeVoie(t);
    setSlots((prev) => {
      const next = prev.slice();
      next[idx] = voie;
      return next;
    });
    setLastCard({ label: t.label, color: voie.color });
    setBoost(true);
    clearTimeout(timers.current.boost);
    timers.current.boost = setTimeout(() => setBoost(false), 750);
  }, []);

  // ---------- drag & drop ----------
  const slotAtPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el || !el.closest) return -1;
    const slot = el.closest('[data-slot]');
    if (!slot) return -1;
    const i = parseInt(slot.getAttribute('data-slot'), 10);
    return (!slotsRef.current[i]) ? i : -1;
  };
  const pointOverMachine = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return !!(el && el.closest && el.closest('[data-dropzone="machine"]'));
  };

  const onDragMove = useCallback((ev) => {
    if (dragIdRef.current == null) return;
    const dx = ev.clientX - startRef.current.x;
    const dy = ev.clientY - startRef.current.y;
    if (!movedRef.current && (Math.abs(dx) + Math.abs(dy) > 6)) {
      movedRef.current = true;
      const t = themeById(dragIdRef.current);
      const dom = domainById(t.domain);
      setDrag({ id: dragIdRef.current, type: t.type, label: t.label, color: t.type === 'integrale' ? '#e2b43a' : dom.color, x: ev.clientX, y: ev.clientY });
      setHoverSlot(-1);
    }
    if (movedRef.current) {
      const hs = slotAtPoint(ev.clientX, ev.clientY);
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
      setHoverSlot(hs);
    }
  }, []);

  const onDragUp = useCallback((ev) => {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    const id = dragIdRef.current;
    const moved = movedRef.current;
    dragIdRef.current = null;
    if (moved) {
      let idx = slotAtPoint(ev.clientX, ev.clientY);
      if (idx < 0 && pointOverMachine(ev.clientX, ev.clientY)) idx = firstEmpty();
      if (idx >= 0) commit(id, idx); else flashFull();
      suppressTapRef.current = Date.now() + 400;
    }
    movedRef.current = false;
    setDrag(null);
    setHoverSlot(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, onDragMove]);

  const startDrag = (id, ev) => {
    if (ev.button != null && ev.button !== 0) return;
    dragIdRef.current = id;
    startRef.current = { x: ev.clientX, y: ev.clientY };
    movedRef.current = false;
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
  };

  const onTap = (id) => {
    if (suppressTapRef.current && Date.now() < suppressTapRef.current) return;
    const i = firstEmpty();
    if (i < 0) { flashFull(); return; }
    commit(id, i);
  };

  const eject = (i) => {
    setSlots((prev) => {
      const next = prev.slice();
      next[i] = null;
      return next;
    });
  };

  const toggleSub = (i, si) => {
    setSlots((prev) => {
      const next = prev.slice();
      const v = { ...next[i] };
      v.subs = v.subs.map((s, idx) => (idx === si ? { label: s.label, excluded: !s.excluded } : s));
      next[i] = v;
      return next;
    });
  };

  const reset = () => { setSlots([]); setLastCard(null); };

  const loaded = slots.filter(Boolean);
  const hasScolaire = loaded.some((v) => v.domain === 'scolaire'); // cycle utile seulement si scolaire chargé

  // Sélection courante → format buildPerimeter (thème + sous-thèmes exclus).
  const selectionOf = (list) => list.map((v) => ({
    themeKey: v.themeId,
    excludedSubjectKeys: (v.subs || []).filter((s) => s.excluded).map((s) => s.subjectKey).filter(Boolean),
  }));
  const perimeterFor = (levelIds, list = loaded) => {
    const level = levelArg(levelIds);
    const questions = getQuestions(level, { brevet: useBrevet });
    const hasContent = (k) => !!questions[k]?.length;
    return buildPerimeter(selectionOf(list), { level, hasContent });
  };

  // Menu de lancement : nb de voies posables PAR niveau (marqueur « 0 question »,
  // ex. Lycée) + nb pour la sélection courante (bouton « C'EST PARTI »).
  const levelInfo = useMemo(() => {
    if (!showLaunch || !liveData) return { counts: {}, selected: 0 };
    const counts = {};
    for (const lv of SCHOOL_LEVELS) counts[lv.id] = perimeterFor([lv.id]).boardSubjects.length;
    const selected = levels.length ? perimeterFor(levels).boardSubjects.length : 0;
    return { counts, selected };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLaunch, liveData, slots, useBrevet, levels]);

  // Clic sur LANCER : en preview → flash direct ; en jeu réel → menu de lancement
  // UNIQUEMENT si une matière scolaire est chargée (choix des niveaux + nom de
  // classe). Sans matière scolaire (culture G…), lancement direct sans menu.
  const onLaunchClick = () => {
    if (!loaded.length) return;
    if (!liveData) {
      setLaunching(true);
      clearTimeout(timers.current.launch);
      timers.current.launch = setTimeout(() => setLaunching(false), 1400);
      return;
    }
    if (!hasScolaire) { doLaunch(); return; }
    setShowLaunch(true);
  };

  // Compose le périmètre pour les niveaux choisis et démarre (contourne FINE_MIX
  // via startGameFromPerimeter). Les voies non scolaires ignorent le niveau.
  const doLaunch = () => {
    if (!loaded.length) return;
    const perimeter = perimeterFor(levels);
    if (!perimeter.boardSubjects.length) return;
    setShowLaunch(false);
    startGameFromPerimeter(perimeter);
  };

  const demo = () => {
    const a = makeVoie(themeById('div_series'));
    const b = makeVoie(themeById('spo_int'));
    const c = makeVoie(themeById('sci_int'));
    c.subs = c.subs.map((s) => (s.label === 'Maths' ? { label: s.label, excluded: true } : s));
    const next = [a, b, c];
    while (next.length < voiesCount) next.push(null);
    const sliced = next.slice(0, voiesCount);
    setSlots(sliced);
    setLastCard({ label: c.domainName, color: c.color });
    setBoost(true);
    clearTimeout(timers.current.boost);
    timers.current.boost = setTimeout(() => setBoost(false), 750);
  };

  // ---------- titre ----------
  const voieLabel = (v) => {
    if (v.type === 'integrale') {
      const ex = v.subs.filter((s) => s.excluded).map((s) => s.label);
      // Intégrale de DOMAINE (depth 0) → nom du domaine « joliment casé » ; intégrale
      // plus profonde (Harry Potter, Jeux vidéo…) → son propre nom.
      const base = (v.depth ?? 0) === 0
        ? v.domainName.charAt(0) + v.domainName.slice(1).toLowerCase()
        : v.label;
      return base + (ex.length ? ` sauf ${ex.join(', ')}` : '');
    }
    return v.label;
  };
  const genTitle = () => {
    const labels = loaded.map((v) => voieLabel(v));
    if (!labels.length) return null;
    const uniq = [...new Set(labels)];
    const shown = uniq.slice(0, 3);
    const joined = shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} & ${shown[shown.length - 1]}`;
    return `La Quête de ${joined}${uniq.length > 3 ? ' …' : ''}`;
  };

  // ---------- vues dérivées ----------
  const loadedCount = loaded.length;
  const title = genTitle();

  const tagOf = (v) => (v.type === 'integrale' ? 'LARGE' : (v.type === 'import' ? 'POINTU' : (v.type === 'cartouche' ? 'SCOLAIRE' : 'THÈME')));

  const slotsView = [];
  for (let i = 0; i < voiesCount; i++) {
    const v = slots[i] || null;
    if (!v) {
      const tg = hoverSlot === i;
      slotsView.push({
        index: i, num: i + 1, empty: true, filled: false,
        bg: tg ? '#16331a' : '#231a10', led: tg ? '#57c84d' : '#3a2e1c', ledGlow: tg ? '#57c84d' : 'transparent',
        isIntegrale: false, subs: [],
        glow: tg ? '0 0 0 3px #57c84d, 0 0 20px rgba(87,200,77,.55)' : 'none',
        emptyText: tg ? '⬇ DÉPOSE LA CASSETTE ICI' : 'FENTE LIBRE — INSÈRE UNE CASSETTE',
        emptyColor: tg ? '#9be88f' : '#6b5f48',
      });
    } else {
      const subs = (v.subs || []).map((s, si) => ({
        text: s.excluded ? `EJECT ✕ ${s.label}` : s.label,
        excluded: s.excluded,
        border: s.excluded ? '#e14b3a' : 'rgba(255,255,255,.5)',
        bg: s.excluded ? '#c0392b' : 'rgba(255,255,255,.18)',
        fg: '#fff',
        deco: s.excluded ? 'line-through' : 'none',
        onToggle: () => toggleSub(i, si),
      }));
      slotsView.push({
        index: i, num: i + 1, empty: false, filled: true, bg: v.color, led: '#fff', ledGlow: 'rgba(255,255,255,.8)',
        label: voieLabel(v), tag: tagOf(v), isIntegrale: v.type === 'integrale', subs, glow: 'none',
        onEject: () => eject(i),
      });
    }
  }

  const statusText = loadedCount === 0 ? '0 VOIE · PRÊT' : `${loadedCount}/${voiesCount} VOIES`;
  const launchOn = loadedCount > 0;
  const deckSpin = loadedCount > 0 ? 'running' : 'paused';
  const lcdText = lastCard ? lastCard.label.toUpperCase() : '— — — — —';
  const windowTint = lastCard ? lastCard.color : '#2c2419';
  const vuScale = boost ? 1.25 : 1;

  // ---------- rendu d'une CASSETTE (carte de face, pile « crate-digging ») ----------
  // Chaque bouton = sa tranche visible (hauteur STRIP, empilement flush) ; au survol
  // la carte pivote vers soi et se révèle en entier (débord absolu via __box), tandis
  // que les cartes du dessous glissent vers le bas (éventail). Tout via `transform`
  // (jamais la marge) → pas de reflow.
  const renderCassette = (it, dom, idx, hIdx = -1, hasSub = false) => {
    const domId = dom?.id;
    const isLoaded = slots.some((v) => v && v.themeId === it.id);
    const dimBase = (drag && drag.id === it.id) ? 0.3 : (isLoaded ? 0.5 : 1);
    const front = CASSETTE_ART[it.id]; // jaquette illustrée (si dispo)
    const dragging = !!drag;
    const isFocus = !dragging && hIdx === idx; // carte déployée (même sans jaquette)
    const isInt = it.type === 'integrale';
    const faceColor = isInt ? '#e2b43a' : (dom?.color || '#8a6a3a');
    const faceInk = dom?.ink || '#2a1c0e';
    // Profondeur dans l'arbre : 0 = INTÉGRALE domaine, 1 = enfant direct,
    // 2+ = sous-sous-thème → mini-cassette (moitié, via --slab-k). L'indentation
    // est portée par le wrapper (cf. rendu de la pile).
    const depth = it.depth || 0;
    const mini = depth >= 2;
    const k = mini ? 0.5 : 1;               // facteur d'échelle (tranche + face 3D)
    const strip = Math.round(STRIP * k);
    const indent = depth >= 1 ? (depth - 1) * 20 : 0;
    const subOpen = expandedSubs.has(it.id);

    // Au repos : AUCUNE inclinaison → le bac se lit « vraiment vu du dessus » (pile
    // d'étiquettes à plat). Le volume 3D (bascule rigide tranche+face, voir CSS
    // .qm-slab__box) n'apparaît QUE sur la K7 survolée ; les cartes du dessous
    // glissent vers le bas pour que leurs tranches restent visibles sous la face révélée.
    // Le bouton, lui, ne subit que des translations 2D (la 3D vit dans __box).
    let transform;
    if (isFocus) transform = 'translateY(-4px)';
    else if (hIdx >= 0) transform = idx > hIdx ? `translateY(${SLIDE}px)` : 'translateY(-4px)';

    const enter = () => { if (!dragging) setHoverTape({ domain: domId, idx }); };
    const leave = () => setHoverTape((h) => (h && h.domain === domId && h.idx === idx ? null : h));

    return (
      <button key={it.id} data-card="1"
        onPointerDown={isLoaded ? undefined : (ev) => startDrag(it.id, ev)}
        onClick={isLoaded ? undefined : () => onTap(it.id)}
        onFocus={enter} onBlur={leave}
        title={isLoaded ? `${it.label} — déjà dans le Curioscope` : `${it.label} — glisse-moi dans le Curioscope`}
        className={`qm-slab${isFocus ? ' is-focus' : ''}${mini ? ' qm-slab--mini' : ''}`}
        style={{ '--slab-k': k, width: mini ? '48%' : undefined, height: strip, marginLeft: indent, opacity: dimBase, transform, zIndex: isFocus ? 60 : undefined, cursor: isLoaded ? 'not-allowed' : undefined }}>
        {/* Flèche de repli des sous-sous-thèmes : DANS le bouton (donc solidaire du
            translateY de la cassette au survol), posée dans la marge gauche, hors du
            groupe 3D (.qm-slab__box) pour ne pas basculer avec lui. */}
        {hasSub && depth >= 1 && (
          <span role="button" tabIndex={0} className="qm-subtoggle"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); toggleSubtree(it.id); }}
            title={subOpen ? 'Masquer les sous-thèmes' : 'Voir les sous-thèmes'}>
            {subOpen ? '▾' : '▸'}
          </span>
        )}
        {/* Volume rigide : face avant + tranche haute soudées dans un même groupe 3D
            (charnière à y=STRIP). Au repos le groupe est vu pile du dessus (seule la
            tranche se présente) ; au survol il bascule vers le spectateur (voir CSS). */}
        <span className="qm-slab__box">
          <span className="qm-slab__front">
            {front
              ? <img className="qm-slab__art" src={front} alt="" draggable={false} />
              : (<span className="qm-slab__shell" style={{ background: `linear-gradient(157deg, ${faceColor}, ${faceInk})` }}>
                  <span className="qm-slab__window" />
                </span>)}
          </span>
          {/* Tranche haute (cassette-top.png) = dessus de la boîte. Le titre s'y pose. */}
          <span className="qm-slab__label" style={{ height: strip }}>
            <img className="qm-slab__labelimg" src={cassetteTop} alt="" draggable={false} />
            <span className="qm-slab__title">{isInt ? `★ ${it.label}` : it.label}</span>
          </span>
        </span>
      </button>
    );
  };

  // Panneau central des onglets autres que « thèmes » : héberge les composants
  // Setup existants dans un encart clair (façon afficheur intégré à la machine).
  const panelInset = { border: '5px solid #150f08', borderRadius: 14, background: '#efe3c6', boxShadow: 'inset 0 0 0 3px #b79a63, inset 0 2px 8px rgba(0,0,0,.15)', padding: '18px 22px', fontFamily: 'var(--font-ui)', color: 'var(--ink-700, #241a10)' };

  // Carte « mode de jeu » (rétro, harmonisée avec la console).
  const selectedModeId = phoneMode ? (phoneController ? 'manette' : 'companion') : 'tbi';
  const renderModeCard = (m) => {
    const sel = m.ready && m.id === selectedModeId;
    return (
      <button key={m.id} type="button" disabled={!m.ready}
        onClick={() => { if (!m.ready) return; setConnectionMode(m.conn); setPhoneController(!!m.controller); }}
        style={{ flex: 1, textAlign: 'left', position: 'relative', padding: '14px 16px', borderRadius: 12, cursor: m.ready ? 'pointer' : 'not-allowed', border: '3px solid ' + (sel ? '#57c84d' : '#150f08'), background: sel ? '#16331a' : (m.ready ? '#2a2117' : '#211a12'), opacity: m.ready ? 1 : 0.75, boxShadow: sel ? '0 0 14px rgba(87,200,77,.4),inset 0 2px 0 rgba(255,255,255,.1)' : 'inset 0 -3px 0 rgba(0,0,0,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 22 }}>{m.emblem}</span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 15, letterSpacing: 0.5, color: sel ? '#9be88f' : (m.ready ? '#f4e7cc' : '#8a7656') }}>{m.name}</span>
          {sel && <span style={{ marginLeft: 'auto', width: 9, height: 9, borderRadius: '50%', background: '#9be88f', boxShadow: '0 0 8px #9be88f' }} />}
        </div>
        <div style={{ fontFamily: FONT_UI, fontSize: 12.5, marginTop: 6, lineHeight: 1.35, color: m.ready ? '#a89878' : '#6b5f48' }}>{m.desc}</div>
        {!m.ready && <div style={{ position: 'absolute', top: 10, right: 10, fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 1, color: '#e8a13a', border: '2px solid #5a4023', borderRadius: 4, padding: '1px 6px', background: '#1d160e' }}>🔒 PROCHAINEMENT</div>}
      </button>
    );
  };

  // Panneau central des onglets « mode de jeu » et « réglages ».
  const renderConsolePanel = () => {
    if (tab === 'mode') {
      return (
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12 }}>{GAME_MODES.map(renderModeCard)}</div>
          {/* Participants — contextuels au mode : TBI = création d'équipes, téléphone = lobby QR. */}
          <div className="qm-console-panel" style={{ flex: 1, minHeight: 0, overflow: 'auto', ...panelInset }}>
            {phoneMode ? <LobbyPanel /> : (<><TeamCount /><TeamCustomization /></>)}
          </div>
        </div>
      );
    }
    // Onglet RÉGLAGES : rail vertical de catégories (gauche) + panneau de la
    // catégorie active (droite). Une seule rubrique visible → fini le scroll fourre-tout.
    // Résumés d'une ligne affichés sous chaque catégorie du rail.
    const bp = boardParams || {};
    const extCount = EXTENSIONS.filter((e) => extOn(extensions, e.id)).length;
    const evTotal = Object.keys(EVENTS).length;
    const evOn = (enabledEvents || []).length;
    const evOff = (bp.eventEveryX ?? 0) < 1;
    const itemKeys = equipmentItemKeys();
    const itemsCount = (enabledItems || []).filter((k) => itemKeys.includes(k)).length;
    const chestOn = starterChestConfig ? starterChestConfig.enabled !== false : false;
    const REGL_SUMMARY = {
      extensions: `${extCount} module${extCount > 1 ? 's' : ''} actif${extCount > 1 ? 's' : ''}`,
      plateau: `${bp.casesParVoie ?? '?'} cases × ${bp.nbVoies ?? '?'} voies`,
      regles: forcedDuels ? 'Duels forcés' : 'Duels au choix',
      butin: itemsOn ? `${itemsCount} objets · coffre ${chestOn ? 'on' : 'off'}` : 'Extension requise',
      events: evOff ? 'Désactivés' : `1 tous les ${bp.eventEveryX} · ${evOn}/${evTotal}`,
      outils: 'Questions · Équilibrage · Événements',
    };
    const cats = toolsAvailable ? [...REGLAGES_CATS, OUTILS_CAT] : REGLAGES_CATS;
    return (
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', gap: 14 }}>
        {/* Rail de catégories */}
        <nav style={{ flex: '0 0 214px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', paddingRight: 2 }}>
          {cats.map((c) => {
            const on = reglSub === c.id;
            return (
              <button key={c.id} onClick={() => setReglSub(c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: 0.5, padding: '11px 13px', borderRadius: 8, cursor: 'pointer', border: '2px solid #150f08', background: on ? '#57c84d' : '#3a2e22', color: on ? '#0c2a0a' : '#cdbf9e', boxShadow: on ? '0 0 10px rgba(87,200,77,.5),inset 0 2px 0 rgba(255,255,255,.35)' : 'inset 0 -2px 0 rgba(0,0,0,.4)' }}>
                <span style={{ fontSize: 18, flex: '0 0 auto' }}>{c.emblem}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>{c.label}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 400, letterSpacing: 0.5, color: on ? 'rgba(12,42,10,.72)' : '#8a7656', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{REGL_SUMMARY[c.id]}</span>
                </span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flex: '0 0 auto', background: on ? '#0c2a0a' : '#241a10', boxShadow: on ? '0 0 6px #9be88f' : 'none' }} />
              </button>
            );
          })}
        </nav>

        {/* Panneau de la catégorie active */}
        <div className="qm-console-panel" style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', ...panelInset }}>
          {reglSub === 'extensions' && <div className="qm-ext-compact"><ExtensionsChecklist embedded /></div>}
          {reglSub === 'plateau' && <BoardParams />}
          {reglSub === 'regles' && <RulesConfig />}
          {reglSub === 'events' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>Fréquence des événements</div>
                <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 6 }}>
                  Un événement {evOff ? <strong>jamais (désactivés)</strong> : <>en moyenne <strong>tous les {bp.eventEveryX} tours</strong></>}
                </div>
                <input
                  type="range" min={0} max={6} value={bp.eventEveryX ?? 0}
                  onChange={(e) => setBoardParam('eventEveryX', Number(e.target.value))}
                  style={{ accentColor: '#b8862c', width: '100%' }}
                />
              </div>
              <div style={{ borderTop: '1px solid rgba(122,94,58,0.2)', paddingTop: 16 }}>
                <EventsChecklist embedded />
              </div>
            </div>
          )}
          {reglSub === 'butin' && (itemsOn ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <StarterChestConfig />
              <div style={{ borderTop: '1px solid rgba(122,94,58,0.2)', paddingTop: 16 }}>
                <ItemsChecklist embedded />
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '34px 20px', color: '#6b5f48' }}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>🎁</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: '#5a3a24', marginBottom: 8 }}>Objets désactivés</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.45, maxWidth: 360, margin: '0 auto 16px' }}>
                Le coffre de départ, le butin et l'équipement dépendent de l'extension « Objets ». Active-la pour régler cette rubrique.
              </div>
              <button onClick={() => setReglSub('extensions')}
                style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: 0.5, padding: '9px 16px', borderRadius: 8, cursor: 'pointer', border: '2px solid #150f08', background: '#3a2e22', color: '#f4e7cc', boxShadow: 'inset 0 2px 0 rgba(255,255,255,.12),inset 0 -3px 0 rgba(0,0,0,.4)' }}>
                🧩 → Aller aux EXTENSIONS
              </button>
            </div>
          ))}
          {reglSub === 'outils' && toolsAvailable && <ConsoleEditorTools />}
        </div>
      </div>
    );
  };

  return (
    <div ref={outerRef} className="qm-cassettes" style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#160f08', color: '#241a10', fontFamily: FONT_UI, WebkitFontSmoothing: 'antialiased' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(130% 130% at 50% 28%,#2a1d0c,#0d0703)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${scale})`, width: 1600, height: 900, display: 'grid', gridTemplateRows: main ? 'auto auto minmax(0,1fr)' : 'auto minmax(0,1fr)', background: '#e3d0aa', overflow: 'hidden', borderRadius: 8, boxShadow: '0 0 0 6px #120c06,0 40px 90px rgba(0,0,0,.7)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,rgba(210,98,43,.05) 0 22px,transparent 22px 44px),repeating-linear-gradient(45deg,rgba(22,153,140,.05) 0 22px,transparent 22px 44px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 0%,transparent 55%,rgba(70,40,16,.22) 100%)', pointerEvents: 'none' }} />

        {/* ============ HEADER ============ */}
        <header style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 20, padding: '14px 26px', background: '#241a10', borderBottom: '4px solid #120c06', boxShadow: '0 6px 0 rgba(70,40,16,.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, flex: '0 0 auto' }}>
            <div onClick={handleLogoClick} style={{ width: 50, height: 33, border: '3px solid #e8d9bb', borderRadius: 5, position: 'relative', background: '#d2622b', boxShadow: 'inset 0 0 0 2px #241a10' }}>
              <div style={{ position: 'absolute', top: '50%', left: 9, width: 9, height: 9, borderRadius: '50%', background: '#241a10', transform: 'translateY(-50%)' }} />
              <div style={{ position: 'absolute', top: '50%', right: 9, width: 9, height: 9, borderRadius: '50%', background: '#241a10', transform: 'translateY(-50%)' }} />
              <div style={{ position: 'absolute', top: '50%', left: 21, width: 8, height: 3, background: '#241a10', transform: 'translateY(-50%)' }} />
            </div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 3, color: '#e8a13a' }}>CURIOSCOPE</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: 1, color: '#7a6a4f' }}>COMPOSEUR DE PARTIE</div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 2, color: '#8a7656', marginBottom: 2 }}>TITRE DE LA PARTIE</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, lineHeight: 1, letterSpacing: '.3px', color: title ? '#f4e7cc' : '#6b5a3c', maxWidth: 820, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 2px 0 rgba(0,0,0,.35)' }}>{title || 'Nomme ta partie…'}</div>
          </div>

          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 18, letterSpacing: 1, color: '#57c84d' }}>{statusText}</div>
              {/* Le choix du niveau scolaire est désormais dans le menu de lancement
                  (clic sur LANCER). Ici on ne garde que le retour (mode live) et la
                  démo (preview). */}
              {live && !main ? (
                <div style={{ marginTop: 4, display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button onClick={() => setPhase('setup')} style={{ fontFamily: FONT_MONO, fontSize: 13, letterSpacing: 1, padding: '1px 7px', borderRadius: 4, cursor: 'pointer', border: '2px solid #5a4023', background: '#3a2c1a', color: '#e3d0aa' }}>← RETOUR</button>
                </div>
              ) : !liveData ? (
                <button onClick={demo} style={{ marginTop: 3, fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 1, color: '#e3d0aa', background: '#3a2c1a', border: '2px solid #5a4023', borderRadius: 4, padding: '1px 8px', cursor: 'pointer' }}>▸ SCÉNARIO DÉMO</button>
              ) : null}
            </div>
            {!(main && phoneMode) && (
              <button onClick={onLaunchClick} style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: FONT_DISPLAY, fontSize: 20, letterSpacing: 1, padding: '11px 24px', borderRadius: 9, border: '3px solid #150f08', cursor: launchOn ? 'pointer' : 'not-allowed', background: launchOn ? '#57c84d' : '#3a2e22', color: launchOn ? '#0c2a0a' : '#6b5f48', boxShadow: launchOn ? '0 0 18px rgba(87,200,77,.6),inset 0 2px 0 rgba(255,255,255,.4),inset 0 -4px 0 rgba(0,0,0,.3)' : 'inset 0 -3px 0 rgba(0,0,0,.3)' }}>
                <span style={{ display: 'inline-block', fontSize: 20, animation: 'qm-arrow 1s ease-in-out infinite' }}>▶</span>
                <span>LANCER</span>
              </button>
            )}
          </div>
        </header>

        {/* ============ SÉLECTEUR DE FONCTION (console de setup) ============ */}
        {main && (
          <div style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 22px', background: '#1d160e', borderBottom: '3px solid #120c06' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: '#8a7656', letterSpacing: 2 }}>FONCTION</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {CONSOLE_TABS.map((tb) => {
                const on = tab === tb.id;
                return (
                  <button key={tb.id} onClick={() => setTab(tb.id)} style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: 1, padding: '6px 13px', borderRadius: 6, cursor: 'pointer', border: '2px solid #150f08', display: 'flex', alignItems: 'center', gap: 7, background: on ? '#57c84d' : '#3a2e22', color: on ? '#0c2a0a' : '#cdbf9e', boxShadow: on ? '0 0 10px rgba(87,200,77,.5),inset 0 2px 0 rgba(255,255,255,.35)' : 'inset 0 -2px 0 rgba(0,0,0,.4)' }}>
                    <span>{tb.emblem}</span><span>{tb.label}</span>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: on ? '#0c2a0a' : '#241a10', boxShadow: on ? '0 0 6px #9be88f' : 'none' }} />
                  </button>
                );
              })}
            </div>
            <div style={{ flex: 1 }} />
            {/* Le nom de classe est demandé dans le menu de lancement (il ne sert
                qu'aux statistiques d'une partie jouée avec des élèves). */}
            <button onClick={toggleAudioMuted} title={audioMuted ? 'Rétablir le son' : 'Couper le son'} aria-label={audioMuted ? 'Rétablir le son' : 'Couper le son'} style={{ fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 1, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', border: '2px solid #5a4023', background: audioMuted ? '#3a1a1d' : '#3a2c1a', color: audioMuted ? '#e88f8f' : '#e3d0aa' }}>{audioMuted ? '🔇 SON' : '🔊 SON'}</button>
            <button onClick={() => setEnglishMode(!englishMode)} title="Langue des questions" style={{ fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 1, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', border: '2px solid #5a4023', background: englishMode ? '#16331a' : '#3a2c1a', color: englishMode ? '#9be88f' : '#e3d0aa' }}>{englishMode ? '🇬🇧 EN ✓' : '🇬🇧 FR'}</button>
          </div>
        )}

        {/* ============ MIDDLE : PANNEAU ACTIF ============ */}
        <main style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 20, padding: '20px 22px 14px', minHeight: 0 }}>
          {(!main || tab === 'themes') ? (<>

          {/* ---- SHELF ---- */}
          <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, letterSpacing: 1, color: '#5a3a24' }}>LE BAC À CASSETTES — FEUILLETTE ET SURVOLE</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: '#8a7656', letterSpacing: 1 }}>GLISSE UNE K7 DANS LE CURIOSCOPE →</div>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative', border: '4px solid #4a3019', borderRadius: 12, backgroundColor: '#6e4a2c', backgroundImage: 'repeating-linear-gradient(90deg,rgba(0,0,0,.09) 0 2px,transparent 2px 68px),repeating-linear-gradient(0deg,rgba(255,255,255,.028) 0 1px,transparent 1px 5px)', boxShadow: 'inset 0 4px 0 #875b36,inset 0 -16px 0 rgba(0,0,0,.28),0 14px 28px rgba(70,40,16,.3)' }}>
              {/* vis d'angle + filigrane (décor, sous le contenu) */}
              <div style={{ position: 'absolute', top: 9, left: 9, width: 9, height: 9, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#b98d5f,#5a3a20)', boxShadow: '0 1px 0 rgba(0,0,0,.4)', zIndex: 5, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#b98d5f,#5a3a20)', boxShadow: '0 1px 0 rgba(0,0,0,.4)', zIndex: 5, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 11, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_DISPLAY, fontSize: 22, letterSpacing: 7, color: 'rgba(255,236,200,.06)', pointerEvents: 'none', zIndex: 0 }}>★ BAC À CASSETTES ★</div>

              {/* CONTENU — 3 colonnes. Clic sur un séparateur (plaque rétro) =
                  déplie/replie ses cassettes « vue du dessus » à la verticale. */}
              <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', padding: '38px 16px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100%' }}>
                  {(() => {
                    const cols = [[], [], []];
                    GROUPS.forEach((g, i) => cols[i % 3].push(g));
                    // Tasseau de bois séparant deux compartiments de la caisse.
                    const divider = (k) => (
                      <div key={`div${k}`} aria-hidden="true" style={{ flex: '0 0 auto', width: 15, alignSelf: 'stretch', margin: '2px 0', position: 'relative', borderRadius: 7, border: '2px solid #2a1b0e', background: 'linear-gradient(90deg,#4a3019 0%,#7d5330 46%,#573921 100%)', boxShadow: 'inset 0 3px 0 rgba(255,255,255,.14), inset 0 -12px 0 rgba(0,0,0,.28), 2px 0 5px rgba(0,0,0,.28), -2px 0 5px rgba(0,0,0,.22)' }}>
                        <span style={{ position: 'absolute', top: 7, left: '50%', transform: 'translateX(-50%)', width: 7, height: 7, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#b98d5f,#5a3a20)', boxShadow: '0 1px 0 rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.35)' }} />
                        <span style={{ position: 'absolute', bottom: 7, left: '50%', transform: 'translateX(-50%)', width: 7, height: 7, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#b98d5f,#5a3a20)', boxShadow: '0 1px 0 rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.35)' }} />
                      </div>
                    );
                    const out = [];
                    cols.forEach((col, ci) => {
                      if (ci > 0) out.push(divider(ci));
                      out.push(
                      <div key={ci} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11, padding: '0 11px' }}>
                        {col.map((g) => {
                          const dom = domainById(g.domain);
                          const open = openDomains.has(g.domain);
                          return (
                            <div key={g.domain}>
                              {/* séparateur = plaque rétro cliquable */}
                              <button onClick={() => toggleDomain(g.domain)} title="Ouvrir / fermer ce rayon" className="qm-sep"
                                style={{ position: 'relative', display: 'block', width: '100%', border: 0, padding: 0, background: 'transparent', cursor: 'pointer', userSelect: 'none', lineHeight: 0 }}>
                                <img src={separatorPlaque} alt="" draggable={false} style={{ display: 'block', width: '100%', height: 'auto' }} />
                                {/* teinte douce du thème sur l'étiquette crème */}
                                <span style={{ position: 'absolute', top: '26%', bottom: '26%', left: '11%', right: '11%', background: dom.color, opacity: open ? 0.34 : 0.2, borderRadius: 2, pointerEvents: 'none' }} />
                                {/* contenu : emblème + nom + compteur + chevron
                                    (lineHeight rétabli : le bouton force lineHeight:0 pour l'image,
                                    ce qui, combiné à overflow:hidden, clippait le nom à 0 de haut) */}
                                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 7, padding: '0 10%', lineHeight: 1.15 }}>
                                  <span style={{ flex: '0 0 auto', fontSize: 14 }}>{dom.emblem}</span>
                                  <span style={{ flex: 1, minWidth: 0, fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: '.3px', color: '#3a2410', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 0 rgba(255,248,230,.55)' }}>{dom.name}</span>
                                  <span style={{ flex: '0 0 auto', fontFamily: FONT_MONO, fontSize: 12, color: '#5a3a1e' }}>{g.items.length}</span>
                                  <span style={{ flex: '0 0 auto', fontFamily: FONT_DISPLAY, fontSize: 12, color: '#5a3a1e' }}>{open ? '▾' : '▸'}</span>
                                </span>
                              </button>
                              {/* cassettes repliables (vertical) — repli doux via grid-rows
                                  (anime jusqu'à la hauteur réelle du contenu, sans à-coup). */}
                              <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .34s cubic-bezier(.4,0,.2,1)' }}
                                onTransitionEnd={(e) => {
                                  if (e.propertyName !== 'grid-template-rows' || !openDomains.has(g.domain)) return;
                                  setSettledDomains((cur) => (cur.has(g.domain) ? cur : new Set(cur).add(g.domain)));
                                }}>
                                <div style={{ overflow: (open && settledDomains.has(g.domain)) ? 'visible' : 'hidden', minHeight: 0 }}>
                                  {(() => {
                                    const hIdx = (hoverTape && hoverTape.domain === g.domain) ? hoverTape.idx : -1;
                                    // Repli des sous-sous-thèmes : un item de depth ≥ 2 n'est visible que
                                    // si toute sa chaîne de parents est dépliée (expandedSubs).
                                    const idToItem = {};
                                    for (const x of g.items) idToItem[x.id] = x;
                                    const hasKids = (id) => g.items.some((x) => x.parentId === id);
                                    const isVisible = (it) => {
                                      let p = it.parentId;
                                      while (p) { if (!expandedSubs.has(p)) return false; p = idToItem[p]?.parentId; }
                                      return true;
                                    };
                                    const vis = g.items.filter(isVisible);
                                    // Survol : le rayon s'agrandit du débord de la K7 révélée
                                    // (cartes glissées de SLIDE, ou face seule si dernière carte)
                                    // → la plaque du rayon suivant est POUSSÉE, pas recouverte.
                                    const extra = hIdx < 0 ? 0 : (hIdx < vis.length - 1 ? SLIDE : FACE_CLEAR);
                                    // Survol piloté par la POSITION du curseur (pas par mouseenter/leave
                                    // sur des cibles qui bougent → timing capricieux, cible qui « fuit »
                                    // en descendant). Chaque K7 possède sa tranche PUIS l'espace de sa
                                    // face déployée (SLIDE, comme l'éventail visible) : on résout
                                    // mathématiquement la cassette visée. Modèle continu → aucun saut,
                                    // stable dans les deux sens. L'updater fonctionnel lit l'état le plus
                                    // frais (pas de closure périmée en mouvement rapide).
                                    const stripH = (it) => (it.depth >= 2 ? Math.round(STRIP * 0.5) : STRIP);
                                    const tops = []; { let acc = 0; for (const it of vis) { tops.push(acc); acc += stripH(it); } }
                                    const domain = g.domain;
                                    const onStackMove = (e) => {
                                      if (drag) return;
                                      const el = e.currentTarget;
                                      const rect = el.getBoundingClientRect();
                                      const scale = (el.offsetHeight ? rect.height / el.offsetHeight : 1) || 1;
                                      const y = (e.clientY - rect.top) / scale - 12; // 12 = padding-top de la pile
                                      const n = vis.length;
                                      setHoverTape((prev) => {
                                        const cur = (prev && prev.domain === domain) ? prev.idx : -1;
                                        let next;
                                        if (cur < 0) { next = 0; for (let i = 0; i < n; i++) if (tops[i] <= y) next = i; }
                                        else if (y < tops[cur]) { next = 0; for (let i = 0; i < cur; i++) if (tops[i] <= y) next = i; }
                                        else if (y >= tops[cur] + stripH(vis[cur]) + SLIDE) { next = cur; for (let j = cur + 1; j < n; j++) if (tops[j] + SLIDE <= y) next = j; }
                                        else next = cur;
                                        if (next < 0 || next >= n) return prev;
                                        if (prev && prev.domain === domain && prev.idx === next) return prev;
                                        return { domain, idx: next };
                                      });
                                    };
                                    const clearHover = () => setHoverTape((h) => (h && h.domain === domain ? null : h));
                                    return (
                                      <div className="qm-stack" onMouseMove={onStackMove} onMouseLeave={clearHover}
                                        style={{ padding: '12px 6px 8px', paddingBottom: 8 + extra, transition: 'padding-bottom .3s cubic-bezier(.32,1.15,.5,1)' }}>
                                        {vis.map((it, idx) => renderCassette(it, dom, idx, hIdx, it.depth >= 1 && hasKids(it.id)))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      );
                    });
                    return out;
                  })()}
                </div>
              </div>
            </div>
          </section>

          {/* ---- MACHINE / BOOMBOX ---- */}
          <section style={{ flex: '0 0 auto', width: 500, display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 20, margin: '0 auto', width: '42%', border: '5px solid #150f08', borderBottom: 0, borderRadius: '18px 18px 0 0', background: 'linear-gradient(#3a2e22,#241a10)' }} />
            <div data-dropzone="machine" style={{ flex: 1, minHeight: 0, border: '5px solid #150f08', borderRadius: 16, background: '#2a2117', padding: 12, display: 'flex', flexDirection: 'column', gap: 7, boxShadow: 'inset 0 3px 0 #4a3c2c,inset 0 -14px 0 rgba(0,0,0,.45),0 22px 40px rgba(40,20,4,.4)' }}>

              {/* brand plate */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: '0 0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, letterSpacing: 1, color: '#e8d9bb', textShadow: '0 2px 0 #000' }}>CURIOSCOPE</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 15, color: '#16998c' }}>stéréo</span>
                </div>
                <span style={{ fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 1, color: '#e8a13a', border: '1px solid #5a4a2c', borderRadius: 3, padding: '0 6px' }}>QV-600 · {voiesCount} VOIES</span>
              </div>

              {/* speakers + transport */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', flex: '0 0 auto' }}>
                <div style={{ width: 78, flex: '0 0 auto', borderRadius: '50%', border: '4px solid #150f08', background: 'radial-gradient(circle at 50% 42%,#3a322a,#1b1610)', boxShadow: 'inset 0 0 0 6px #241c14,inset 0 0 14px rgba(0,0,0,.7)' }} />
                <div style={{ flex: 1, minWidth: 0, border: '3px solid #150f08', borderRadius: 8, background: '#15110c', padding: 8, display: 'flex', flexDirection: 'column', gap: 7, boxShadow: 'inset 0 0 18px rgba(0,0,0,.8)' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26, position: 'relative', border: '2px solid #2c2419', borderRadius: 5, background: 'repeating-linear-gradient(90deg,#0e0b07 0 3px,#161009 3px 6px)', minHeight: 46, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '50%', left: '18%', right: '18%', height: 13, background: '#3a2c1a', transform: 'translateY(-50%)', borderTop: '1px solid #5a4023', borderBottom: '1px solid #100a05' }} />
                    {[0, 1].map((k) => (
                      <div key={k} style={{ position: 'relative', width: 44, height: 44, borderRadius: '50%', border: '3px solid #6b5a3c', background: '#241a10', animation: 'qm-spin 1.9s linear infinite', animationPlayState: deckSpin, zIndex: 2 }}>
                        <div style={{ position: 'absolute', inset: 16, borderRadius: '50%', border: '2px solid #8a7656' }} />
                        <div style={{ position: 'absolute', top: 2, left: '50%', width: 3, height: 20, background: '#6b5a3c', transform: 'translateX(-50%)' }} />
                        <div style={{ position: 'absolute', bottom: 2, left: '50%', width: 3, height: 20, background: '#6b5a3c', transform: 'translateX(-50%)' }} />
                        <div style={{ position: 'absolute', left: 2, top: '50%', height: 3, width: 20, background: '#6b5a3c', transform: 'translateY(-50%)' }} />
                        <div style={{ position: 'absolute', right: 2, top: '50%', height: 3, width: 20, background: '#6b5a3c', transform: 'translateY(-50%)' }} />
                      </div>
                    ))}
                    <div style={{ position: 'absolute', inset: 0, border: `3px solid ${windowTint}`, borderRadius: 4, pointerEvents: 'none', opacity: .7 }} />
                  </div>
                  <div style={{ flex: '0 0 auto', height: 22, border: '2px solid #2c3a1a', borderRadius: 3, background: '#0a1206', display: 'flex', alignItems: 'center', padding: '0 8px', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 17, letterSpacing: 1, color: '#57c84d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>▸ {lcdText}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 17, color: '#57c84d', animation: 'qm-blink 1s step-end infinite' }}>_</span>
                  </div>
                </div>
                <div style={{ width: 78, flex: '0 0 auto', borderRadius: '50%', border: '4px solid #150f08', background: 'radial-gradient(circle at 50% 42%,#3a322a,#1b1610)', boxShadow: 'inset 0 0 0 6px #241c14,inset 0 0 14px rgba(0,0,0,.7)' }} />
              </div>

              {/* VU meters */}
              <div style={{ flex: '0 0 auto', border: '3px solid #150f08', borderRadius: 6, background: '#15110c', padding: '6px 8px', display: 'flex', alignItems: 'flex-end', gap: 3, height: 24, transformOrigin: 'bottom', transform: `scaleY(${vuScale})` }}>
                {VU.map((b, i) => (
                  <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', background: b.color, animation: `qm-vu ${b.dur}s ease-in-out infinite alternate`, animationDelay: `${b.delay}s`, height: '30%' }} />
                  </div>
                ))}
              </div>

              {/* 6-bay rack */}
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 3, border: '3px solid #150f08', borderRadius: 8, background: '#1d160e', padding: 7, overflow: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: '0 0 auto', padding: '0 2px 1px' }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 12, letterSpacing: 1, color: '#8a7656' }}>LES VOIES — RACK D'INSERTION</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: '#57c84d' }}>{statusText}</span>
                </div>
                {slotsView.map((s) => (
                  <div key={s.index} data-slot={s.index} style={{ flex: '0 0 auto', position: 'relative', border: '2px solid #0e0a06', borderRadius: 6, minHeight: 32, display: 'flex', alignItems: 'stretch', overflow: 'hidden', background: s.bg, boxShadow: s.glow }}>
                    <div style={{ width: 34, flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '2px solid #0e0a06', background: 'rgba(0,0,0,.22)' }}>
                      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: '#6b5f48' }}>{s.num}</span>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.led, boxShadow: `0 0 6px ${s.ledGlow}` }} />
                    </div>
                    {s.empty ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 11px' }}>
                        <span style={{ fontFamily: FONT_MONO, fontSize: 17, letterSpacing: 2, color: '#4a3f2c' }}>▮▮▮▮</span>
                        <span style={{ fontFamily: FONT_MONO, fontSize: 16, letterSpacing: 2, color: s.emptyColor }}>{s.emptyText}</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '5px 9px', gap: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 0 rgba(0,0,0,.4)' }}>{s.label}</span>
                            <span style={{ flex: '0 0 auto', fontFamily: FONT_MONO, fontSize: 12, color: 'rgba(0,0,0,.6)', background: 'rgba(255,255,255,.55)', padding: '0 5px', borderRadius: 2 }}>{s.tag}</span>
                          </div>
                          {s.isIntegrale && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {s.subs.map((sub, si) => (
                                <button key={si} onClick={sub.onToggle} style={{ fontFamily: FONT_MONO, fontSize: 13, letterSpacing: '.5px', padding: '0 6px', borderRadius: 3, cursor: 'pointer', border: `2px solid ${sub.border}`, background: sub.bg, color: sub.fg, textDecoration: sub.deco }}>{sub.text}</button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button onClick={s.onEject} className="qm-eject" style={{ flex: '0 0 auto', width: 38, border: 0, borderLeft: '2px solid rgba(0,0,0,.3)', background: 'rgba(0,0,0,.22)', color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⏏</button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* transport buttons */}
              <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['⏮', '⏯', '⏭'].map((t) => (
                    <div key={t} style={{ width: 38, height: 30, border: '2px solid #150f08', borderRadius: 5, background: '#3a2e22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cdbf9e', fontSize: 13, boxShadow: 'inset 0 2px 0 rgba(255,255,255,.12),inset 0 -3px 0 rgba(0,0,0,.4)' }}>{t}</div>
                  ))}
                </div>
                <button onClick={reset} className="qm-reset" style={{ flex: 1, height: 32, border: '2px solid #150f08', borderRadius: 5, background: '#5a2018', color: '#f4d9c0', fontFamily: FONT_DISPLAY, fontSize: 12, letterSpacing: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: 'inset 0 2px 0 rgba(255,255,255,.15),inset 0 -3px 0 rgba(0,0,0,.4)' }}>⏏ TOUT ÉJECTER</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT_MONO, fontSize: 14, color: '#8a7656' }}>PWR<span style={{ width: 11, height: 11, borderRadius: '50%', background: '#57c84d', boxShadow: '0 0 8px #57c84d' }} /></div>
              </div>

            </div>
          </section>
          </>) : renderConsolePanel()}
        </main>
      </div>

      {/* drag ghost — la vraie jaquette illustrée n'apparaît QU'ICI (pendant le drag). */}
      {drag && CASSETTE_ART[drag.id] && (
        <div style={{ position: 'fixed', left: drag.x, top: drag.y, zIndex: 400, pointerEvents: 'none', transform: 'translate(-120px,-86px) rotate(-4deg)' }}>
          <div style={{ position: 'relative', width: 240, filter: 'drop-shadow(0 22px 30px rgba(20,12,4,.55))' }}>
            <img src={CASSETTE_ART[drag.id]} alt="" draggable={false} style={{ display: 'block', width: '100%', height: 'auto' }} />
            <span style={{ position: 'absolute', top: '11.5%', left: '13%', right: '13%', height: '15%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14, letterSpacing: '.2px', color: '#2a1c0e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{drag.label}</span>
            </span>
            <div style={{ position: 'absolute', right: -10, bottom: -8, background: '#241a10', color: '#57c84d', fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 1, padding: '2px 8px', borderRadius: 4, transform: 'rotate(3deg)', whiteSpace: 'nowrap' }}>▸ DÉPOSE DANS LE CURIOSCOPE</div>
          </div>
        </div>
      )}
      {/* drag ghost générique (thèmes sans jaquette dédiée) */}
      {drag && !CASSETTE_ART[drag.id] && (
        <div style={{ position: 'fixed', left: drag.x, top: drag.y, zIndex: 400, pointerEvents: 'none', transform: 'translate(-44px,-58px) rotate(-4deg)' }}>
          <div style={{ position: 'relative', width: 238, height: 158, border: '3px solid #241a10', borderRadius: 10, background: drag.color, boxShadow: '0 24px 36px rgba(20,12,4,.55),inset 0 3px 0 rgba(255,255,255,.32),inset 0 -7px 0 rgba(0,0,0,.2)' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 46, borderRight: '3px solid #241a10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: FONT_DISPLAY, fontSize: 12, letterSpacing: 1, color: '#fff', textShadow: '0 1px 0 rgba(0,0,0,.35)', whiteSpace: 'nowrap' }}>{drag.label}</span>
            </div>
            <div style={{ position: 'absolute', left: 46, right: 7, top: 7, bottom: 7, border: '2px solid #241a10', borderRadius: 4, overflow: 'hidden', background: '#c4bdb0' }}>
              {ratioOn && (
                <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,#c4bdb0 0 11px,#bcb4a6 11px 22px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: '#6b6358', border: '1px dashed #6b6358', padding: '1px 6px', background: 'rgba(255,255,255,.45)' }}>JAQUETTE 3:2</span>
                </div>
              )}
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 30, background: 'rgba(20,14,8,.82)', display: 'flex', alignItems: 'center', padding: '0 9px' }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: '#f4e7cc', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{drag.label}</span>
              </div>
            </div>
            <div style={{ position: 'absolute', right: -8, bottom: -12, background: '#241a10', color: '#57c84d', fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 1, padding: '2px 8px', borderRadius: 4, transform: 'rotate(3deg)', whiteSpace: 'nowrap' }}>▸ DÉPOSE DANS LE CURIOSCOPE</div>
          </div>
        </div>
      )}

      {/* ============ MENU DE LANCEMENT (niveau + classe) ============ */}
      {showLaunch && (
        <div onClick={() => setShowLaunch(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,7,3,.74)' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: 580, maxWidth: '92vw', maxHeight: '90vh', overflow: 'auto', background: '#241a10', border: '5px solid #e8a13a', borderRadius: 18, padding: '26px 30px', boxShadow: '0 24px 70px rgba(0,0,0,.6)', fontFamily: FONT_UI }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 2, color: '#8a7656' }}>CURIOSCOPE</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 27, letterSpacing: '.5px', color: '#f4e7cc', textShadow: '0 2px 0 #000', marginTop: 2 }}>▶ Prêt à lancer</div>
            <div style={{ fontFamily: FONT_UI, fontSize: 14, color: '#a89878', marginTop: 6, lineHeight: 1.4 }}>
              {title || 'La Quête'} — {loadedCount} voie{loadedCount > 1 ? 's' : ''}
            </div>

            {/* Niveaux scolaires — multi-sélection (le menu ne s'ouvre que si une
                matière scolaire est chargée). */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 1, color: '#e8a13a' }}>NIVEAUX DES QUESTIONS SCOLAIRES</div>
              <div style={{ fontFamily: FONT_UI, fontSize: 12, color: '#8a7656', marginTop: 3 }}>Choisis un ou plusieurs niveaux — les questions seront mélangées.</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                {SCHOOL_LEVELS.map((lv) => {
                  const on = levels.includes(lv.id);
                  const empty = (levelInfo.counts[lv.id] || 0) === 0;
                  return (
                    <button key={lv.id} onClick={() => toggleLevel(lv.id)}
                      style={{ minWidth: 78, fontFamily: FONT_DISPLAY, fontSize: 16, letterSpacing: 1, padding: '10px 14px', borderRadius: 9, cursor: 'pointer',
                        border: '2px solid ' + (on ? '#57c84d' : '#5a4023'), background: on ? '#16331a' : '#3a2c1a',
                        color: on ? '#9be88f' : (empty ? '#8a7656' : '#e3d0aa'),
                        boxShadow: on ? '0 0 12px rgba(87,200,77,.45)' : 'inset 0 -2px 0 rgba(0,0,0,.4)' }}>
                      {on ? '✓ ' : ''}{lv.label}
                      {empty && <span style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '.5px', color: '#e08a3a', marginTop: 3 }}>0 question</span>}
                    </button>
                  );
                })}
              </div>
              {levels.length === 0 ? (
                <div style={{ fontFamily: FONT_UI, fontSize: 12.5, color: '#e14b3a', marginTop: 9 }}>
                  Choisis au moins un niveau.
                </div>
              ) : levelInfo.selected === 0 ? (
                <div style={{ fontFamily: FONT_UI, fontSize: 12.5, color: '#e14b3a', marginTop: 9 }}>
                  Aucune question scolaire pour ce choix — sélectionne d'autres niveaux.
                </div>
              ) : null}
            </div>

            {/* Nom de classe / séance — sert aux statistiques. */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 1, color: '#e8a13a' }}>CLASSE / SÉANCE</div>
              <div style={{ fontFamily: FONT_UI, fontSize: 12, color: '#8a7656', marginTop: 3 }}>Facultatif — sert à retrouver les statistiques d'une partie jouée avec des élèves.</div>
              <input value={classLabel || ''} onChange={(e) => setClassLabel(e.target.value)} placeholder="Ex. 6e B — mardi"
                style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', fontFamily: FONT_MONO, fontSize: 17, color: '#241a10', background: '#e8d9bb', border: '2px solid #5a4023', borderRadius: 7, padding: '9px 12px' }} />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 26 }}>
              <button onClick={() => setShowLaunch(false)}
                style={{ flex: '0 0 auto', fontFamily: FONT_DISPLAY, fontSize: 15, letterSpacing: 1, padding: '12px 20px', borderRadius: 10, cursor: 'pointer', border: '2px solid #5a4023', background: '#3a2c1a', color: '#e3d0aa' }}>ANNULER</button>
              {(() => {
                const canLaunch = loadedCount > 0 && levels.length > 0 && levelInfo.selected > 0;
                return (
                  <button onClick={doLaunch} disabled={!canLaunch}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: FONT_DISPLAY, fontSize: 20, letterSpacing: 1, padding: '12px 20px', borderRadius: 10,
                      cursor: canLaunch ? 'pointer' : 'not-allowed', border: '3px solid #150f08',
                      background: canLaunch ? '#57c84d' : '#3a2e22', color: canLaunch ? '#0c2a0a' : '#6b5f48',
                      boxShadow: canLaunch ? '0 0 18px rgba(87,200,77,.6),inset 0 2px 0 rgba(255,255,255,.4),inset 0 -4px 0 rgba(0,0,0,.3)' : 'inset 0 -3px 0 rgba(0,0,0,.3)' }}>
                    <span style={{ display: 'inline-block', fontSize: 20, animation: 'qm-arrow 1s ease-in-out infinite' }}>▶</span>
                    <span>C'EST PARTI</span>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* launch flash */}
      {launching && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', background: 'rgba(232,161,58,.26)' }}>
          <div style={{ background: '#241a10', border: '5px solid #e8a13a', borderRadius: 16, padding: '22px 44px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 22, color: '#57c84d', letterSpacing: 2 }}>▸ CHARGEMENT DU PLATEAU</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 34, color: '#f4e7cc', textShadow: '0 2px 0 #000' }}>C'EST PARTI !</div>
          </div>
        </div>
      )}
    </div>
  );
}
