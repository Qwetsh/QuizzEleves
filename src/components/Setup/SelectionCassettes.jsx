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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import '@fontsource/vt323/400.css';
import '@fontsource/archivo-black/400.css';
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/500.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/hanken-grotesk/700.css';
import '@fontsource/hanken-grotesk/800.css';
import '../../styles/cassettes.css';
import { useGameStore } from '../../store/gameStore';
import { themesToCassetteModel, buildPerimeter, levelForCycle } from '../../logic/perimeter';
import { getQuestions } from '../../data/questions';

const FONT_DISPLAY = "'Archivo Black', system-ui, sans-serif";
const FONT_UI = "'Hanken Grotesk', system-ui, sans-serif";
const FONT_MONO = "'VT323', monospace";

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

const WORLD_MODES = ['Mini-monde', 'Serpentin', 'Ruban'];

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

export default function SelectionCassettes({ voies = 6, reperesRatio = true, live = false }) {
  // Source de données : arbre réel (mode live) ou mocks (preview ?cassettes).
  const model = live ? themesToCassetteModel() : { DOMAINS: MOCK_DOMAINS, GROUPS: MOCK_GROUPS };
  ACTIVE = model;
  const { DOMAINS, GROUPS } = model;
  // Actions store (toujours appelées ; utilisées seulement en mode live).
  const startGameFromPerimeter = useGameStore((s) => s.startGameFromPerimeter);
  const setPhase = useGameStore((s) => s.setPhase);
  const useBrevet = useGameStore((s) => s.useBrevet);
  const [cycle, setCycle] = useState('cycle4');

  const [slots, setSlots] = useState([]);
  const [revealed, setRevealed] = useState([]);
  const [drag, setDrag] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(-1);
  const [lastCard, setLastCard] = useState(null);
  const [boost, setBoost] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [full, setFull] = useState(false); // eslint-disable-line no-unused-vars
  const [scale, setScale] = useState(1);
  const [openDomain, setOpenDomain] = useState(DOMAINS[0]?.id ?? null);
  const [worldStyle, setWorldStyle] = useState('Mini-monde');

  const outerRef = useRef(null);
  // Map domaine → élément du tiroir. Clés DYNAMIQUES (mock 'div'/… ou arbre réel
  // 'scolaire'/…) : un objet à clés fixes casserait l'accordéon en mode live.
  const groupEls = useRef({});
  const appliedOpenRef = useRef(openDomain);

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

  // ---------- accordéon : état initial des tiroirs ----------
  useEffect(() => {
    for (const [id, el] of Object.entries(groupEls.current)) {
      if (!el) continue;
      if (id === appliedOpenRef.current) { el.style.maxWidth = 'none'; el.style.overflow = 'visible'; }
      else { el.style.maxWidth = '0px'; el.style.overflow = 'hidden'; }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animateGroup = useCallback((el, open) => {
    if (!el) return;
    const cards = [...el.querySelectorAll('[data-card]')];
    clearTimeout(el._drawerT);
    el.style.overflow = 'hidden';
    if (open) {
      el.style.maxWidth = '0px';
      void el.offsetWidth;
      el.style.animation = 'qm-drawer-open .5s cubic-bezier(.16,1,.3,1) forwards';
      cards.forEach((c, i) => {
        c.style.animation = 'none';
        void c.offsetWidth;
        c.style.animation = `qm-card-out .56s cubic-bezier(.16,1,.3,1) ${(0.05 + i * 0.075)}s backwards`;
      });
      el._drawerT = setTimeout(() => {
        el.style.animation = ''; el.style.maxWidth = 'none'; el.style.overflow = 'visible';
        cards.forEach((c) => { c.style.animation = ''; });
      }, 720);
    } else {
      el.style.maxWidth = '340px';
      void el.offsetWidth;
      el.style.animation = 'qm-drawer-close .32s cubic-bezier(.55,0,.68,.19) forwards';
      el._drawerT = setTimeout(() => { el.style.animation = ''; el.style.maxWidth = '0px'; }, 380);
    }
  }, []);

  // ---------- accordéon : animation au changement de rayon ouvert ----------
  useEffect(() => {
    const cur = openDomain;
    if (cur !== appliedOpenRef.current) {
      const old = appliedOpenRef.current;
      appliedOpenRef.current = cur;
      if (old) animateGroup(groupEls.current[old], false);
      if (cur) animateGroup(groupEls.current[cur], true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDomain, animateGroup]);

  const toggleDomain = (id) => setOpenDomain((cur) => (cur === id ? null : id));

  // ---------- modèle de voie ----------
  const makeVoie = (t) => {
    const dom = domainById(t.domain);
    return {
      uid: `${t.id}_${Math.random().toString(36).slice(2, 7)}`,
      themeId: t.id, label: t.label, type: t.type, domain: t.domain,
      domainName: dom.name, color: t.type === 'integrale' ? '#e2b43a' : dom.color, ink: dom.ink,
      subs: (t.sub || []).map((s) => (typeof s === 'string'
        ? { label: s, subjectKey: null, excluded: false }
        : { label: s.label, subjectKey: s.key ?? null, excluded: false })),
    };
  };
  const recomputeRevealed = (arr) => Array.from(new Set(arr.filter(Boolean).map((v) => v.domain)));
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
    const voie = makeVoie(t);
    setSlots((prev) => {
      const next = prev.slice();
      next[idx] = voie;
      setRevealed(recomputeRevealed(next));
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
      setRevealed(recomputeRevealed(next));
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

  const reset = () => { setSlots([]); setRevealed([]); setLastCard(null); };

  const loaded = slots.filter(Boolean);

  const launch = () => {
    if (!loaded.length) return;
    if (live) {
      // Sélection → périmètre → vraie partie (contourne FINE_MIX via startGameFromPerimeter).
      const selection = loaded.map((v) => ({
        themeKey: v.themeId,
        excludedSubjectKeys: (v.subs || []).filter((s) => s.excluded).map((s) => s.subjectKey).filter(Boolean),
      }));
      const level = levelForCycle(cycle);
      const questions = getQuestions(level, { brevet: useBrevet });
      const hasContent = (k) => !!questions[k]?.length;
      const perimeter = buildPerimeter(selection, { level, hasContent });
      if (!perimeter.boardSubjects.length) return;
      startGameFromPerimeter(perimeter);
      return;
    }
    setLaunching(true);
    clearTimeout(timers.current.launch);
    timers.current.launch = setTimeout(() => setLaunching(false), 1400);
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
    setRevealed(recomputeRevealed(sliced));
    setLastCard({ label: c.domainName, color: c.color });
    setBoost(true);
    clearTimeout(timers.current.boost);
    timers.current.boost = setTimeout(() => setBoost(false), 750);
  };

  // ---------- titre ----------
  const voieLabel = (v) => {
    if (v.type === 'integrale') {
      const ex = v.subs.filter((s) => s.excluded).map((s) => s.label);
      return v.domainName.charAt(0) + v.domainName.slice(1).toLowerCase() + (ex.length ? ` sauf ${ex.join(', ')}` : '');
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
  const mode = worldStyle;

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

  const biomesView = DOMAINS.map((d) => {
    const rev = revealed.includes(d.id);
    return { id: d.id, name: d.biome, color: d.color, sceneBg: d.sceneBg, emblem: d.emblem, revealed: rev, locked: !rev };
  });
  const revealedCount = revealed.length;
  const pathProgress = revealedCount <= 0 ? 0 : Math.min(100, (revealedCount / 5) * 100);

  const segView = loaded.map((v) => {
    const d = domainById(v.domain);
    return { color: v.color, emblem: d.emblem, short: d.id.toUpperCase(), label: voieLabel(v) };
  });

  const statusText = loadedCount === 0 ? '0 VOIE · PRÊT' : `${loadedCount}/${voiesCount} VOIES`;
  const launchOn = loadedCount > 0;
  const deckSpin = loadedCount > 0 ? 'running' : 'paused';
  const lcdText = lastCard ? lastCard.label.toUpperCase() : '— — — — —';
  const windowTint = lastCard ? lastCard.color : '#2c2419';
  const vuScale = boost ? 1.25 : 1;

  // ---------- rendu d'une cassette (tranche) selon son type ----------
  const renderCassette = (it, dom, idx) => {
    const isLoaded = slots.some((v) => v && v.themeId === it.id);
    const dim = (drag && drag.id === it.id) ? 0.22 : (isLoaded ? 0.4 : 1);
    const ml = idx === 0 ? 8 : -10;
    const common = {
      'data-card': '1',
      onPointerDown: (ev) => startDrag(it.id, ev),
      onClick: () => onTap(it.id),
    };

    if (it.type === 'integrale') {
      return (
        <button key={it.id} {...common} title={`${it.label} — glisse-moi dans le Sonorama`} className="qm-card qm-card--int"
          style={{ position: 'relative', flex: '0 0 auto', width: 56, height: 224, marginLeft: ml, border: 0, padding: 0, background: 'transparent', cursor: 'grab', touchAction: 'none', userSelect: 'none', opacity: dim, zIndex: 9 }}>
          <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', width: 30, height: 30, background: '#c0392b', clipPath: 'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 100%,50% 72%,21% 100%,32% 57%,2% 35%,39% 35%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 11, color: '#fff', transform: 'translateY(-1px)' }}>★</span>
          </div>
          <div style={{ position: 'absolute', inset: 0, background: '#e2b43a', border: '3px solid #241a10', borderRadius: '9px 9px 3px 3px', boxShadow: 'inset 4px 0 0 rgba(255,255,255,.5),inset -6px 0 0 rgba(120,80,0,.3),inset 0 -8px 0 rgba(120,80,0,.3)' }} />
          <div style={{ position: 'absolute', top: 15, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_DISPLAY, fontSize: 9, letterSpacing: '.5px', color: '#7a1f16' }}>INT.</div>
          <div style={{ position: 'absolute', top: 32, bottom: 28, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: FONT_DISPLAY, fontSize: 14, letterSpacing: 1, color: '#3a2600', whiteSpace: 'nowrap', maxHeight: 152, overflow: 'hidden' }}>{it.label}</span>
          </div>
          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_MONO, fontSize: 12, color: '#7a1f16' }}>★ BEST OF</div>
        </button>
      );
    }

    if (it.type === 'theme') {
      return (
        <button key={it.id} {...common} title={`${it.label} — glisse-moi dans le Sonorama`} className="qm-card"
          style={{ position: 'relative', flex: '0 0 auto', width: 46, height: 202, marginLeft: ml, border: 0, padding: 0, background: 'transparent', cursor: 'grab', touchAction: 'none', userSelect: 'none', opacity: dim, zIndex: 2 }}>
          <div style={{ position: 'absolute', inset: 0, background: dom.color, border: '3px solid #241a10', borderRadius: '7px 7px 3px 3px', boxShadow: 'inset 4px 0 0 rgba(255,255,255,.22),inset -5px 0 0 rgba(0,0,0,.2),inset 0 -6px 0 rgba(0,0,0,.16)' }} />
          <div style={{ position: 'absolute', top: 9, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_MONO, fontSize: 12, color: 'rgba(0,0,0,.45)' }}>●</div>
          <div style={{ position: 'absolute', top: 27, bottom: 27, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: 1, color: '#fff', textShadow: '0 1px 0 rgba(0,0,0,.35)', whiteSpace: 'nowrap', maxHeight: 146, overflow: 'hidden' }}>{it.label}</span>
          </div>
          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_MONO, fontSize: 11, color: 'rgba(0,0,0,.5)' }}>K7</div>
        </button>
      );
    }

    if (it.type === 'cartouche') {
      return (
        <button key={it.id} {...common} title={`${it.label} — cartouche scolaire`} className="qm-card"
          style={{ position: 'relative', flex: '0 0 auto', width: 60, height: 200, marginLeft: ml, border: 0, padding: 0, background: 'transparent', cursor: 'grab', touchAction: 'none', userSelect: 'none', opacity: dim, zIndex: 4 }}>
          <div style={{ position: 'absolute', left: 4, right: 4, top: 0, bottom: 0, background: dom.color, border: '3px solid #241a10', borderRadius: '6px 6px 8px 8px', boxShadow: 'inset 4px 0 0 rgba(255,255,255,.2),inset -5px 0 0 rgba(0,0,0,.22),inset 0 -7px 0 rgba(0,0,0,.22)' }} />
          <div style={{ position: 'absolute', left: 4, right: 4, top: 0, height: 20, background: 'repeating-linear-gradient(90deg,#241a10 0 4px,transparent 4px 11px)', opacity: .4, borderRadius: '6px 6px 0 0' }} />
          <div style={{ position: 'absolute', left: -3, top: 56, width: 11, height: 52, background: '#2a1f12', border: '2px solid #241a10', borderRadius: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '3px 0', zIndex: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', margin: '0 auto', background: '#3a322a' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', margin: '0 auto', background: '#57c84d' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', margin: '0 auto', background: '#3a322a' }} />
          </div>
          <div style={{ position: 'absolute', top: 30, bottom: 26, left: 6, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: FONT_DISPLAY, fontSize: 12, letterSpacing: 1, color: '#fff', textShadow: '0 1px 0 rgba(0,0,0,.35)', whiteSpace: 'nowrap', maxHeight: 140, overflow: 'hidden' }}>SCOLAIRE · {it.label}</span>
          </div>
          <div style={{ position: 'absolute', bottom: 8, left: 6, right: 0, textAlign: 'center', fontFamily: FONT_MONO, fontSize: 11, color: 'rgba(0,0,0,.55)' }}>CARTOUCHE</div>
        </button>
      );
    }

    // import / bootleg
    const tilt = (it.id.charCodeAt(4) % 5) - 2;
    return (
      <button key={it.id} {...common} title={`${it.label} — import communautaire`} className="qm-card qm-card--imp"
        style={{ position: 'relative', flex: '0 0 auto', width: 44, height: 190, marginLeft: ml, border: 0, padding: 0, background: 'transparent', cursor: 'grab', touchAction: 'none', userSelect: 'none', opacity: dim, zIndex: 3, '--tilt': `${tilt}deg` }}>
        <div style={{ position: 'absolute', inset: 0, background: '#ece3cf', border: '3px solid #241a10', borderRadius: '5px 5px 3px 3px', boxShadow: 'inset 0 0 0 2px #fff,inset 0 -6px 0 rgba(0,0,0,.1)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 9, background: dom.color, borderRight: '2px solid #241a10' }} />
        <div style={{ position: 'absolute', inset: '9px 4px 4px 13px', background: 'repeating-linear-gradient(0deg,rgba(0,0,0,.05) 0 2px,transparent 2px 5px)' }} />
        <div style={{ position: 'absolute', top: 25, bottom: 25, left: 9, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: FONT_DISPLAY, fontSize: 12, fontStyle: 'italic', letterSpacing: '.5px', color: '#241a10', whiteSpace: 'nowrap', maxHeight: 132, overflow: 'hidden' }}>{it.label}</span>
        </div>
        <div style={{ position: 'absolute', top: -7, left: 5, background: '#e8a13a', border: '2px solid #241a10', fontFamily: FONT_DISPLAY, fontSize: 8, color: '#241a10', padding: '1px 4px', transform: 'rotate(-7deg)', zIndex: 3 }}>IMP</div>
        <div style={{ position: 'absolute', bottom: 7, left: 9, right: 0, textAlign: 'center', fontFamily: FONT_MONO, fontSize: 11, color: '#9a3a4f' }}>◇</div>
      </button>
    );
  };

  const cycleWorld = () => setWorldStyle((w) => WORLD_MODES[(WORLD_MODES.indexOf(w) + 1) % WORLD_MODES.length]);

  return (
    <div ref={outerRef} className="qm-cassettes" style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#160f08', color: '#241a10', fontFamily: FONT_UI, WebkitFontSmoothing: 'antialiased' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(130% 130% at 50% 28%,#2a1d0c,#0d0703)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${scale})`, width: 1600, height: 900, display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) auto', background: '#e3d0aa', overflow: 'hidden', borderRadius: 8, boxShadow: '0 0 0 6px #120c06,0 40px 90px rgba(0,0,0,.7)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,rgba(210,98,43,.05) 0 22px,transparent 22px 44px),repeating-linear-gradient(45deg,rgba(22,153,140,.05) 0 22px,transparent 22px 44px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 0%,transparent 55%,rgba(70,40,16,.22) 100%)', pointerEvents: 'none' }} />

        {/* ============ HEADER ============ */}
        <header style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 20, padding: '14px 26px', background: '#241a10', borderBottom: '4px solid #120c06', boxShadow: '0 6px 0 rgba(70,40,16,.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, flex: '0 0 auto' }}>
            <div style={{ width: 50, height: 33, border: '3px solid #e8d9bb', borderRadius: 5, position: 'relative', background: '#d2622b', boxShadow: 'inset 0 0 0 2px #241a10' }}>
              <div style={{ position: 'absolute', top: '50%', left: 9, width: 9, height: 9, borderRadius: '50%', background: '#241a10', transform: 'translateY(-50%)' }} />
              <div style={{ position: 'absolute', top: '50%', right: 9, width: 9, height: 9, borderRadius: '50%', background: '#241a10', transform: 'translateY(-50%)' }} />
              <div style={{ position: 'absolute', top: '50%', left: 21, width: 8, height: 3, background: '#241a10', transform: 'translateY(-50%)' }} />
            </div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 3, color: '#e8a13a' }}>LA QUÊTE DES MATIÈRES</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: 1, color: '#7a6a4f' }}>COMPOSEUR DE PARTIE</div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 2, color: '#8a7656', marginBottom: 2 }}>TITRE DE LA PARTIE</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, lineHeight: 1, letterSpacing: '.3px', color: title ? '#f4e7cc' : '#6b5a3c', maxWidth: 820, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 2px 0 rgba(0,0,0,.35)' }}>{title || 'La Quête des …'}</div>
          </div>

          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 18, letterSpacing: 1, color: '#57c84d' }}>{statusText}</div>
              {live ? (
                <div style={{ marginTop: 4, display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: '#8a7656', letterSpacing: 1 }}>CYCLE</span>
                  {[['cycle3', '6e'], ['cycle4', '5e→3e']].map(([c, lab]) => (
                    <button key={c} onClick={() => setCycle(c)} style={{ fontFamily: FONT_MONO, fontSize: 13, letterSpacing: 1, padding: '1px 7px', borderRadius: 4, cursor: 'pointer', border: '2px solid ' + (cycle === c ? '#57c84d' : '#5a4023'), background: cycle === c ? '#16331a' : '#3a2c1a', color: cycle === c ? '#9be88f' : '#e3d0aa' }}>{lab}</button>
                  ))}
                  <button onClick={() => setPhase('setup')} style={{ fontFamily: FONT_MONO, fontSize: 13, letterSpacing: 1, padding: '1px 7px', borderRadius: 4, cursor: 'pointer', border: '2px solid #5a4023', background: '#3a2c1a', color: '#e3d0aa' }}>← RETOUR</button>
                </div>
              ) : (
                <button onClick={demo} style={{ marginTop: 3, fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 1, color: '#e3d0aa', background: '#3a2c1a', border: '2px solid #5a4023', borderRadius: 4, padding: '1px 8px', cursor: 'pointer' }}>▸ SCÉNARIO DÉMO</button>
              )}
            </div>
            <button onClick={launch} style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: FONT_DISPLAY, fontSize: 20, letterSpacing: 1, padding: '11px 24px', borderRadius: 9, border: '3px solid #150f08', cursor: launchOn ? 'pointer' : 'not-allowed', background: launchOn ? '#57c84d' : '#3a2e22', color: launchOn ? '#0c2a0a' : '#6b5f48', boxShadow: launchOn ? '0 0 18px rgba(87,200,77,.6),inset 0 2px 0 rgba(255,255,255,.4),inset 0 -4px 0 rgba(0,0,0,.3)' : 'inset 0 -3px 0 rgba(0,0,0,.3)' }}>
              <span style={{ display: 'inline-block', fontSize: 20, animation: 'qm-arrow 1s ease-in-out infinite' }}>▶</span>
              <span>LANCER</span>
            </button>
          </div>
        </header>

        {/* ============ MIDDLE : SHELF + MACHINE ============ */}
        <main style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 20, padding: '20px 22px 14px', minHeight: 0 }}>

          {/* ---- SHELF ---- */}
          <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, letterSpacing: 1, color: '#5a3a24' }}>LE BAC À CASSETTES — OUVRE UN RAYON</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: '#8a7656', letterSpacing: 1 }}>CLIQUE UN RAYON POUR L'OUVRIR · GLISSE UNE K7 →</div>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative', border: '4px solid #4a3019', borderRadius: 12, backgroundColor: '#6e4a2c', backgroundImage: 'repeating-linear-gradient(90deg,rgba(0,0,0,.09) 0 2px,transparent 2px 68px),repeating-linear-gradient(0deg,rgba(255,255,255,.028) 0 1px,transparent 1px 5px)', boxShadow: 'inset 0 4px 0 #875b36,inset 0 -16px 0 rgba(0,0,0,.28),0 14px 28px rgba(70,40,16,.3)' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 34, background: '#3a2616', borderTop: '3px solid #2a1b0e', borderRadius: '0 0 8px 8px', zIndex: 5, pointerEvents: 'none', boxShadow: 'inset 0 3px 0 rgba(255,255,255,.06)' }} />
              <div style={{ position: 'absolute', top: 9, left: 9, width: 9, height: 9, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#b98d5f,#5a3a20)', boxShadow: '0 1px 0 rgba(0,0,0,.4)', zIndex: 5, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#b98d5f,#5a3a20)', boxShadow: '0 1px 0 rgba(0,0,0,.4)', zIndex: 5, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: 44, right: 20, transform: 'rotate(-6deg)', background: '#e8d9bb', border: '2px solid #2a1b0e', fontFamily: FONT_MONO, fontSize: 13, letterSpacing: 1, color: '#7a1f16', padding: '1px 7px', zIndex: 5, pointerEvents: 'none', boxShadow: '1px 2px 0 rgba(0,0,0,.25)' }}>€1 / K7</div>
              <div style={{ position: 'absolute', top: 16, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_DISPLAY, fontSize: 30, letterSpacing: 8, color: 'rgba(255,236,200,.06)', pointerEvents: 'none', zIndex: 0 }}>★ BAC À CASSETTES ★</div>
              <div style={{ position: 'absolute', top: 50, left: 24, fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 2, color: 'rgba(255,236,200,.14)', pointerEvents: 'none', zIndex: 0 }}>OCCAZ' K7 · TOUT À 1 VOIE</div>
              <div style={{ position: 'absolute', inset: 0, overflowX: 'auto', overflowY: 'hidden', display: 'flex', alignItems: 'flex-end', padding: '52px 26px 44px' }}>
                {GROUPS.map((g, gi) => {
                  const dom = domainById(g.domain);
                  const open = openDomain === g.domain;
                  return (
                    <React.Fragment key={g.domain}>
                      {/* INTERCALAIRE (bouton accordéon) */}
                      <button onClick={() => toggleDomain(g.domain)} title="Ouvrir / fermer ce rayon" className="qm-drawer-btn"
                        style={{ position: 'relative', flex: '0 0 auto', alignSelf: 'stretch', width: 46, marginLeft: gi === 0 ? 0 : 6, border: 0, padding: 0, background: 'transparent', cursor: 'pointer', zIndex: 13 }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,#664324,#7d5330 46%,#573921)', border: '3px solid #2a1b0e', borderRadius: '8px 8px 0 0', boxShadow: 'inset 0 3px 0 rgba(255,255,255,.14),inset 0 -12px 0 rgba(0,0,0,.32)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }}>
                          <div style={{ width: '100%', height: 40, background: dom.color, borderBottom: '3px solid #2a1b0e', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 3px 0 ${open ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.26)'}` }}>
                            <div style={{ width: 26, height: 26, border: '2px solid #2a1b0e', borderRadius: 5, background: '#f3e6c9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: dom.color }}>{dom.emblem}</div>
                          </div>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
                            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: 2, color: '#f4e7cc', textShadow: '0 1px 0 rgba(0,0,0,.5)', whiteSpace: 'nowrap' }}>{dom.name}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, paddingBottom: 9 }}>
                            <div style={{ width: 20, height: 5, borderRadius: 3, background: 'rgba(0,0,0,.4)', boxShadow: 'inset 0 1px 0 rgba(0,0,0,.5)' }} />
                            <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: '#241a10', background: '#e8d9bb', border: '2px solid #2a1b0e', borderRadius: 9, minWidth: 20, textAlign: 'center', lineHeight: 1.35, padding: '0 3px' }}>{g.items.length}</span>
                            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: open ? '#2a1b0e' : '#f0deb8' }}>{open ? '▾' : '▸'}</span>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: open ? '#57c84d' : '#3a2a1a', boxShadow: `0 0 7px ${open ? '#57c84d' : 'transparent'}` }} />
                          </div>
                        </div>
                      </button>

                      {/* TIROIR (contenu du rayon) */}
                      <div ref={(el) => { groupEls.current[g.domain] = el; }} style={{ flex: '0 0 auto', alignSelf: 'stretch', display: 'flex', alignItems: 'flex-end', overflow: 'hidden', perspective: 1400, boxShadow: 'inset 24px 0 26px -18px rgba(0,0,0,.62)' }}>
                        {g.items.map((it, idx) => renderCassette(it, dom, idx))}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 34, width: 40, background: 'linear-gradient(to right,rgba(110,74,44,0),rgba(110,74,44,.5))', pointerEvents: 'none', zIndex: 4 }} />
            </div>
          </section>

          {/* ---- MACHINE / BOOMBOX ---- */}
          <section style={{ flex: '0 0 auto', width: 500, display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 20, margin: '0 auto', width: '42%', border: '5px solid #150f08', borderBottom: 0, borderRadius: '18px 18px 0 0', background: 'linear-gradient(#3a2e22,#241a10)' }} />
            <div data-dropzone="machine" style={{ flex: 1, minHeight: 0, border: '5px solid #150f08', borderRadius: 16, background: '#2a2117', padding: 12, display: 'flex', flexDirection: 'column', gap: 7, boxShadow: 'inset 0 3px 0 #4a3c2c,inset 0 -14px 0 rgba(0,0,0,.45),0 22px 40px rgba(40,20,4,.4)' }}>

              {/* brand plate */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: '0 0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, letterSpacing: 1, color: '#e8d9bb', textShadow: '0 2px 0 #000' }}>SONORAMA</span>
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
        </main>

        {/* ============ WORLD PREVIEW ============ */}
        <footer style={{ position: 'relative', zIndex: 2, padding: '4px 22px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, letterSpacing: 1, color: '#5a3a24' }}>LE MONDE QUE TU CONSTRUIS <span style={{ fontFamily: FONT_MONO, fontWeight: 400, color: '#8a7656', letterSpacing: 1 }}>— aperçu, pas la vraie carte</span></div>
            <button onClick={cycleWorld} title="Changer l'aperçu" style={{ fontFamily: FONT_MONO, fontSize: 16, color: '#8a7656', letterSpacing: 1, background: 'transparent', border: '2px solid #5a4023', borderRadius: 4, padding: '0 8px', cursor: 'pointer' }}>{mode.toUpperCase()} · {revealedCount}/5 BIOMES</button>
          </div>

          {/* MINI-MONDE */}
          {mode === 'Mini-monde' && (
            <div style={{ height: 124, border: '4px solid #4a3019', borderRadius: 12, overflow: 'hidden', display: 'flex', background: '#2a1b0e', boxShadow: 'inset 0 4px 10px rgba(0,0,0,.4)', position: 'relative' }}>
              {biomesView.map((b) => (
                <div key={b.id} style={{ flex: 1, position: 'relative', borderRight: '2px dashed rgba(255,255,255,.12)', overflow: 'hidden', background: b.sceneBg }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%', background: b.color, opacity: .5 }} />
                  {b.revealed ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                      <div style={{ width: 46, height: 46, border: '3px solid #241a10', borderRadius: 10, background: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', boxShadow: '0 4px 0 rgba(0,0,0,.25)' }}>{b.emblem}</div>
                      <div style={{ fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 1, color: '#241a10' }}>{b.name}</div>
                    </div>
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, background: '#15100a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: 'rgba(255,255,255,.2)' }}>?</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: 'rgba(255,255,255,.32)', letterSpacing: 1 }}>VERROUILLÉ</span>
                    </div>
                  )}
                </div>
              ))}
              <div style={{ position: 'absolute', left: 0, top: '50%', height: 5, width: `${pathProgress}%`, background: 'repeating-linear-gradient(90deg,#e8d9bb 0 9px,transparent 9px 18px)', transform: 'translateY(-50%)', pointerEvents: 'none', boxShadow: '0 0 8px rgba(232,217,187,.5)' }} />
            </div>
          )}

          {/* SERPENTIN */}
          {mode === 'Serpentin' && (
            <div style={{ height: 172, border: '4px solid #4a3019', borderRadius: 12, background: '#3a2616', display: 'flex', alignItems: 'center', padding: '0 30px', overflowX: 'auto' }}>
              {segView.map((g, i) => (
                <div key={i} style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', border: '4px solid #241a10', background: g.color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <span style={{ fontSize: 20 }}>{g.emblem}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 12 }}>{g.short}</span>
                  </div>
                  <div style={{ width: 46, height: 5, background: 'repeating-linear-gradient(90deg,#e8d9bb 0 8px,transparent 8px 16px)' }} />
                </div>
              ))}
              <div style={{ flex: '0 0 auto', width: 60, height: 60, borderRadius: '50%', border: '4px dashed #6b5a3c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_MONO, fontSize: 13, color: '#8a7656', textAlign: 'center' }}>SUITE…</div>
            </div>
          )}

          {/* RUBAN */}
          {mode === 'Ruban' && (
            <div style={{ height: 172, border: '4px solid #4a3019', borderRadius: 12, background: '#3a2616', display: 'flex', alignItems: 'center', padding: 14 }}>
              {segView.map((g, i) => (
                <div key={i} style={{ flex: 1, height: '100%', background: g.color, border: '3px solid #241a10', borderRightWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <span style={{ fontSize: 24 }}>{g.emblem}</span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 12, textTransform: 'uppercase', textAlign: 'center', padding: '0 4px' }}>{g.label}</span>
                </div>
              ))}
              <div style={{ flex: 1.4, height: '100%', border: '3px dashed #6b5a3c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_MONO, fontSize: 15, color: '#8a7656', letterSpacing: 1 }}>…LE RUBAN S'ALLONGE À CHAQUE VOIE</div>
            </div>
          )}
        </footer>
      </div>

      {/* drag ghost */}
      {drag && (
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
            <div style={{ position: 'absolute', right: -8, bottom: -12, background: '#241a10', color: '#57c84d', fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 1, padding: '2px 8px', borderRadius: 4, transform: 'rotate(3deg)', whiteSpace: 'nowrap' }}>▸ DÉPOSE DANS LE SONORAMA</div>
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
