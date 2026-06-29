// Atelier d'alchimie RÉUTILISABLE (mobile + TBI) — visuel « marmite & grimoire ».
// Sélection de 3 ingrédients du sac → distillation. La logique de craft est
// déléguée à `onCraft(keys)` : mobile → intent ; TBI → craftPotionFor direct.
// Les cérémonies (distillation/potion/découverte/échec) sont un APERÇU optimiste
// (matchRecipe local) ; l'autorité du résultat réel reste l'appelant.
import { useState, useRef, useEffect } from 'react';
import { ITEMS } from '../../data/items';
import { RECIPES, matchRecipe } from '../../data/recipes';
import { cellKey, cellN } from '../../store/itemHandlers';
import { itemImg } from '../../logic/itemAssets';
import { locName, locDesc } from '../../i18n/content';
import { itemEffectLines } from '../../logic/effectText';
import { alcColor, alcMix } from '../../logic/alchemyVisual';
import '../../styles/alchemy-mobile.css';

// Visuel d'un objet d'alchimie : image détourée si dispo, sinon repli emoji.
export function AlcVisual({ item, emojiSize = 24, glow = 'drop-shadow(0 2px 5px rgba(0,0,0,.3))' }) {
  const img = item && itemImg(item);
  if (img) return <img src={img} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: glow }} />;
  return <span style={{ fontSize: emojiSize }}>{item?.icon}</span>;
}

export default function AlchemyView({ team, en = false, onCraft }) {
  const t = team;
  const L = (fr, eng) => (en ? eng : fr);

  const [view, setView] = useState('atelier');
  const [slots, setSlots] = useState([null, null, null]); // positions du sac
  const [phase, setPhase] = useState('idle'); // idle|distilling|known|discovery|fail
  const [result, setResult] = useState(null); // recette matchée (optimiste)
  const [inscribed, setInscribed] = useState(false);
  const [info, setInfo] = useState(null); // bagIndex de l'ingrédient inspecté
  const [drag, setDrag] = useState(null); // { bagIdx, from, slotPos, x, y }
  const [filters, setFilters] = useState([]);
  const [filterMode, setFilterMode] = useState('and');
  const [pageIndex, setPageIndex] = useState(0);
  const [turn, setTurn] = useState(null);
  const [turnGo, setTurnGo] = useState(false);
  const [potionId, setPotionId] = useState(null);

  const pend = useRef(null);
  const cauldRef = useRef(null);
  // Filet de sécurité : si on démonte EN PLEIN drag (changement d'onglet), retire
  // les listeners exacts encore attachés (stockés dans pend.current).
  useEffect(() => () => { const pd = pend.current; if (pd) { window.removeEventListener('pointermove', pd.onMove); window.removeEventListener('pointerup', pd.onUp); } }, []);

  const bagIngredients = (t.bag || []).map((c, i) => ({ i, key: cellKey(c) })).filter((x) => ITEMS[x.key]?.family === 'ingredient');
  const known = new Set(t.knownIngredients || []);
  const knownRec = new Set(t.knownRecipes || []);
  const keyOf = (bi) => (bi != null ? cellKey(t.bag[bi]) : null);
  const filled = slots.filter((x) => x != null).length;
  const cauldronList = slots.map((bi, idx) => ({ bi, idx })).filter((x) => x.bi != null);
  const liquid = alcMix(cauldronList.map((c) => alcColor(keyOf(c.bi))));

  // Garde-fou « sac plein » (inchangé) : la potion va dans le sac ; si plein et
  // qu'aucun ingrédient choisi n'est à 1 exemplaire, elle risque d'être perdue.
  const bagFull = (t.bag || []).filter(Boolean).length >= 12;
  const freesCell = slots.some((bi) => bi != null && cellN(t.bag[bi]) <= 1);
  const noRoomRisk = filled === 3 && bagFull && !freesCell;

  const addSlot = (bagIdx) => {
    if (phase !== 'idle') return;
    setSlots((s) => { if (s.includes(bagIdx)) return s; const free = s.indexOf(null); if (free < 0) return s; const ns = [...s]; ns[free] = bagIdx; return ns; });
    setInfo(null);
  };
  const removeSlot = (slotPos) => setSlots((s) => s.map((x, i) => (i === slotPos ? null : x)));

  // Drag-and-drop pointeur : tap (sans bouger) = inspecter (étagère) / retirer
  // (marmite) ; glisser un ingrédient sur la marmite = l'ajouter, l'en sortir =
  // le retirer. Seuil de 9px pour distinguer tap et glisser.
  const overCauldron = (x, y) => {
    const el = cauldRef.current; if (!el) return false;
    const r = el.getBoundingClientRect(); const p = 34;
    return x > r.left - p && x < r.right + p && y > r.top - p && y < r.bottom + p;
  };
  const onMove = (e) => {
    const pd = pend.current; if (!pd) return;
    const dx = e.clientX - pd.x, dy = e.clientY - pd.y;
    if (!pd.moved && Math.hypot(dx, dy) > 9) { pd.moved = true; setInfo(null); setDrag({ bagIdx: pd.bagIdx, from: pd.from, slotPos: pd.slotPos, x: e.clientX, y: e.clientY }); }
    if (pd.moved) setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : null));
  };
  const onUp = (e) => {
    const pd = pend.current; pend.current = null;
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
    if (!pd) { setDrag(null); return; }
    if (!pd.moved) {
      if (pd.from === 'shelf') setInfo((cur) => (cur === pd.bagIdx ? null : pd.bagIdx));
      else if (pd.from === 'cauldron') removeSlot(pd.slotPos);
      setDrag(null); return;
    }
    const over = overCauldron(e.clientX, e.clientY);
    if (pd.from === 'shelf' && over) addSlot(pd.bagIdx);
    else if (pd.from === 'cauldron' && !over) removeSlot(pd.slotPos);
    setDrag(null);
  };
  const onDown = (e, bagIdx, from, slotPos) => {
    if (phase !== 'idle') return;
    e.preventDefault();
    // On mémorise les handlers attachés pour pouvoir les retirer (onUp + démontage).
    pend.current = { bagIdx, from, slotPos, x: e.clientX, y: e.clientY, moved: false, onMove, onUp };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  };

  const distill = () => {
    if (filled !== 3 || phase !== 'idle') return;
    // CLÉS (pas index) : le sac mobile est compacté, le TBI résout par clés.
    const keys = slots.filter((x) => x != null).map((bi) => cellKey(t.bag[bi]));
    onCraft?.(keys);
    setPhase('distilling');
    setTimeout(() => {
      const recipe = matchRecipe(keys);
      if (!recipe || !ITEMS[recipe.potion]) { setResult(null); setPhase('fail'); return; }
      setResult(recipe);
      if (knownRec.has(recipe.id)) setPhase('known');
      else { setInscribed(false); setPhase('discovery'); setTimeout(() => setInscribed(true), 650); }
    }, 1900);
  };
  const closeResult = () => { setPhase('idle'); setResult(null); setInscribed(false); setSlots([null, null, null]); };

  const potionEffect = (k) => { const it = ITEMS[k]; if (!it) return ''; const lines = itemEffectLines(it); return lines.length ? lines.join(' · ') : (locDesc(it) || ''); };

  // — Grimoire : recettes connues, filtrées par ingrédient (ET/OU), paginées 6.
  const knownRecipes = RECIPES.filter((r) => knownRec.has(r.id) && ITEMS[r.potion]);
  const chipKeys = [...new Set(knownRecipes.flatMap((r) => r.ingredients))].filter((k) => ITEMS[k]);
  const filtered = filters.length
    ? knownRecipes.filter((r) => (filterMode === 'and' ? filters.every((f) => r.ingredients.includes(f)) : filters.some((f) => r.ingredients.includes(f))))
    : knownRecipes;
  const cellOf = (r) => ({ id: r.id, potion: r.potion, name: locName(ITEMS[r.potion]), emoji: ITEMS[r.potion].icon, color: alcColor(r.potion), ingEmojis: r.ingredients.map((k) => ITEMS[k]?.icon || '?').join(' ') });
  const pages = []; for (let i = 0; i < filtered.length; i += 6) pages.push(filtered.slice(i, i + 6).map(cellOf));
  if (!pages.length) pages.push([]);
  const safe = Math.min(pageIndex, pages.length - 1);
  const baseItems = pages[Math.min(turn ? turn.inIndex : safe, pages.length - 1)] || [];
  const flipItems = turn ? (pages[turn.outIndex] || []) : [];
  const toggleFilter = (k) => { setFilters((fs) => (fs.includes(k) ? fs.filter((x) => x !== k) : [...fs, k])); setPageIndex(0); setTurn(null); setTurnGo(false); };
  const flipTo = (dir) => {
    if (turn) return;
    const out = safe, inp = dir === 'next' ? out + 1 : out - 1;
    if (inp < 0 || inp > pages.length - 1) return;
    setTurn({ dir, outIndex: out, inIndex: inp }); setTurnGo(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setTurnGo(true)));
    setTimeout(() => { setPageIndex(inp); setTurn(null); setTurnGo(false); }, 720);
  };

  const OP = [{ left: '34%', top: '40%' }, { left: '63%', top: '42%' }, { left: '48%', top: '66%' }];
  // Bulles de la marmite (vue de dessus) : position dispersée, taille, durée, délai.
  const BUBBLES = [
    { l: '30%', t: '34%', s: 7, d: 3.0, delay: 0 },
    { l: '58%', t: '30%', s: 10, d: 3.8, delay: 0.6 },
    { l: '46%', t: '50%', s: 6, d: 2.6, delay: 1.2 },
    { l: '66%', t: '56%', s: 8, d: 3.4, delay: 1.8 },
    { l: '34%', t: '62%', s: 5, d: 3.1, delay: 0.9 },
    { l: '52%', t: '70%', s: 7, d: 2.9, delay: 2.3 },
    { l: '70%', t: '40%', s: 5, d: 3.6, delay: 1.5 },
    { l: '40%', t: '44%', s: 6, d: 2.7, delay: 2.8 },
  ];
  const tabStyle = (active) => ({ flex: 1, border: 'none', cursor: 'pointer', borderRadius: 12, padding: '9px 0', fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 700, fontSize: 14, transition: 'all .2s', ...(active ? { background: '#fffaef', color: '#7c5a1c', boxShadow: '0 2px 6px rgba(120,80,20,.18)' } : { background: 'transparent', color: '#a98c5c' }) });
  const modeStyle = (active) => ({ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '3px 9px', fontSize: 10, fontWeight: 800, ...(active ? { background: '#7c5a1c', color: '#fff' } : { background: 'transparent', color: '#9b7e4e' }) });
  const ceremonyBtn = (bg, col) => ({ marginTop: 26, border: 'none', borderRadius: 14, padding: '13px 34px', fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 800, fontSize: 15, cursor: 'pointer', background: bg, color: col });

  const canDistill = filled === 3 && phase === 'idle';
  const infoIng = info != null ? keyOf(info) : null;
  const infoCanAdd = info != null && !slots.includes(info) && filled < 3 && phase === 'idle';
  const potion = potionId ? knownRecipes.find((r) => r.id === potionId) : null;
  const overlay = (extra) => ({ position: 'fixed', inset: 0, zIndex: 120, animation: 'alc-scrimIn .25s ease', ...extra });

  return (
    <div className="alc-scr" style={{ minHeight: '100%', paddingBottom: 76, display: 'flex', flexDirection: 'column', fontFamily: "'Nunito', var(--font-ui), system-ui, sans-serif", background: 'linear-gradient(180deg,#f8edd2 0%,#f1dcae 48%,#e7cd97 100%)', overflowY: 'auto' }}>
      {/* En-tête : titre + or */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 22px 6px', flex: 'none' }}>
        <div style={{ fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 800, fontSize: 22, color: '#7c5a1c', display: 'flex', alignItems: 'center', gap: 7 }}>⚗️ {L('Alchimie', 'Alchemy')}</div>
        <div style={{ position: 'absolute', right: 16, display: 'flex', alignItems: 'center', gap: 5, background: '#fff7e4', border: '1.5px solid #e8c878', borderRadius: 20, padding: '3px 10px 3px 4px', boxShadow: '0 2px 5px rgba(150,110,30,.18)' }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%,#ffe79e,#e0a93a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>🪙</span>
          <span style={{ fontWeight: 800, color: '#9a6f1d', fontSize: 14 }}>{t.money ?? 0}</span>
        </div>
      </div>

      {/* Bascule Atelier / Grimoire */}
      <div style={{ display: 'flex', gap: 5, margin: '2px 18px 8px', padding: 4, background: 'rgba(150,110,40,.14)', borderRadius: 16, flex: 'none' }}>
        <button onClick={() => { setView('atelier'); setInfo(null); }} style={tabStyle(view === 'atelier')}>🜂 {L('Atelier', 'Workshop')}</button>
        <button onClick={() => { setView('grimoire'); setInfo(null); }} style={tabStyle(view === 'grimoire')}>📖 {L('Grimoire', 'Grimoire')}</button>
      </div>

      {/* ===== ATELIER ===== */}
      {view === 'atelier' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 18px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: '#9b7e4e', alignSelf: 'flex-start' }}>{L('LA MARMITE', 'THE CAULDRON')}</div>
          <div style={{ fontSize: 12.5, color: '#9b7e4e', alignSelf: 'flex-start', marginBottom: 6 }}>{L('Glisse ou touche 3 composants à distiller.', 'Drag or tap 3 components to distill.')}</div>

          {/* Marmite */}
          <div ref={cauldRef} style={{ position: 'relative', width: 236, height: 236, margin: '4px 0 2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: 206, height: 206, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,170,80,.20),transparent 64%)', animation: 'alc-floaty 5s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', top: 2, left: 0, right: 0, height: 50, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}>
              <span style={{ position: 'absolute', left: '42%', bottom: 0, width: 13, height: 13, borderRadius: '50%', background: 'rgba(255,255,255,.4)', filter: 'blur(5px)', animation: 'alc-steamRise 3.6s ease-in infinite' }} />
              <span style={{ position: 'absolute', left: '54%', bottom: 0, width: 11, height: 11, borderRadius: '50%', background: 'rgba(255,255,255,.35)', filter: 'blur(5px)', animation: 'alc-steamRise 4.2s ease-in 1.2s infinite' }} />
            </div>
            <div style={{ position: 'relative', width: 214, height: 214, borderRadius: '50%', background: 'radial-gradient(circle at 36% 30%,#574d63,#2c2535 60%,#15101d)', boxShadow: '0 18px 34px rgba(40,25,55,.5), inset 0 4px 8px rgba(170,158,196,.45), inset 0 -10px 22px rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'alc-potWobble 8s ease-in-out infinite' }}>
              <div style={{ position: 'absolute', width: 186, height: 186, borderRadius: '50%', background: 'linear-gradient(150deg,#1d1727,#0d0916)', boxShadow: 'inset 0 8px 18px rgba(0,0,0,.65)' }} />
              <div style={{ position: 'relative', width: 176, height: 176, zIndex: 3, borderRadius: '50%', background: `radial-gradient(circle at 40% 34%, ${liquid}ee, ${liquid} 60%, rgba(0,0,0,.5))`, boxShadow: 'inset 0 8px 22px rgba(0,0,0,.5), inset 0 -4px 12px rgba(255,255,255,.07)' }}>
                <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', overflow: 'hidden', pointerEvents: 'none' }}>
                  {/* Reflet statique de la surface (léger éclat en haut, vue de dessus) */}
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(ellipse 60% 38% at 50% 22%, rgba(255,255,255,.16), transparent 70%)' }} />
                  {/* Bulles qui surgissent et éclatent à la surface */}
                  {BUBBLES.map((b, bi) => (
                    <span key={bi} style={{ position: 'absolute', left: b.l, top: b.t, width: b.s, height: b.s, marginLeft: -b.s / 2, marginTop: -b.s / 2, borderRadius: '50%', background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,.95), rgba(255,255,255,.18) 58%, transparent 78%)', border: '1px solid rgba(255,255,255,.28)', boxShadow: '0 0 4px rgba(255,255,255,.35)', animation: `alc-bubblePop ${b.d}s ease-out ${b.delay}s infinite` }} />
                  ))}
                </div>
                {cauldronList.map((c, k) => (
                  <div key={c.idx} style={{ position: 'absolute', left: OP[k].left, top: OP[k].top, marginLeft: -19, marginTop: -19, width: 38, height: 38, zIndex: 5, animation: 'alc-ingFloat 4.5s ease-in-out infinite', animationDelay: `${k * 0.6}s` }}>
                    <div onPointerDown={(e) => onDown(e, c.bi, 'cauldron', c.idx)} style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'grab', touchAction: 'none', animation: 'alc-ingDrop .45s cubic-bezier(.3,1.5,.5,1) both', boxShadow: '0 4px 12px rgba(0,0,0,.45), inset 0 2px 4px rgba(255,255,255,.45)', border: '2px solid rgba(255,255,255,.6)', background: alcColor(keyOf(c.bi)), padding: 3 }}><AlcVisual item={ITEMS[keyOf(c.bi)]} emojiSize={20} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 4px', fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 700, color: '#7c5a1c', fontSize: 14 }}>
            <span style={{ opacity: .6 }}>{L('Composants', 'Components')}</span>
            <span style={{ background: '#fff7e4', border: '1.5px solid #e8c878', borderRadius: 12, padding: '1px 10px' }}>{filled} / 3</span>
          </div>

          <button onClick={distill} disabled={!canDistill} style={{ width: '100%', maxWidth: 330, border: 'none', borderRadius: 18, padding: '14px 0', margin: '6px 0 12px', fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: .4, ...(canDistill ? { background: 'linear-gradient(180deg,#f0c463,#d99a30)', color: '#5a3c0c', cursor: 'pointer', animation: 'alc-glowPulse 1.8s ease-in-out infinite' } : { background: 'linear-gradient(180deg,#e9dcc0,#d8c69e)', color: '#a08a5e', cursor: 'default' }) }}>⚗️ {L('Distiller la potion', 'Distill the potion')}</button>
          {noRoomRisk && <div style={{ marginBottom: 10, fontSize: 13, color: '#c0392b', fontWeight: 700, textAlign: 'center' }}>{L('⚠️ Sac plein : la potion risque d’être perdue.', '⚠️ Bag full: the potion may be lost.')}</div>}

          {/* Étagère des composants */}
          <div style={{ width: '100%', background: 'linear-gradient(180deg,rgba(255,250,238,.7),rgba(247,236,212,.55))', border: '1px solid rgba(150,110,50,.18)', borderRadius: 20, padding: '14px 12px 16px', boxShadow: '0 6px 16px rgba(120,85,30,.1), inset 0 1px 0 rgba(255,255,255,.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 2px' }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.5, color: '#9b7e4e' }}>{L('TES COMPOSANTS', 'YOUR COMPONENTS')}</span>
              <span style={{ fontSize: 10, color: '#b39a6c', fontStyle: 'italic' }}>{L('glisse vers la marmite', 'drag to the cauldron')}</span>
            </div>
            {bagIngredients.length === 0
              ? <div style={{ textAlign: 'center', color: '#a98c5c', fontStyle: 'italic', padding: '14px 0' }}>{L('Aucun ingrédient dans ton sac.', 'No ingredient in your bag.')}</div>
              : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px 4px' }}>
                  {bagIngredients.map(({ i, key }, idx) => {
                    const picked = slots.includes(i);
                    return (
                      <div key={i} onPointerDown={(e) => onDown(e, i, 'shelf')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'grab', touchAction: 'none', opacity: picked ? 0.4 : 1 }}>
                        <div style={{ position: 'relative' }}>
                          <div style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 27, background: `radial-gradient(circle at 38% 30%, #ffffffcc, ${alcColor(key)} 78%)`, boxShadow: `0 5px 12px ${alcColor(key)}55, inset 0 2px 5px rgba(255,255,255,.55)`, border: '2px solid rgba(255,255,255,.65)', animation: `alc-floaty 3.6s ease-in-out ${(idx % 8) * 0.22}s infinite`, padding: 5 }}><AlcVisual item={ITEMS[key]} emojiSize={27} /></div>
                          <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, background: 'linear-gradient(180deg,#f6d684,#dca63c)', color: '#5a3c0c', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', boxShadow: '0 2px 4px rgba(120,80,20,.35)', border: '1.5px solid #fff5dc' }}>{cellN(t.bag[i])}</span>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#7a5d34', textAlign: 'center', lineHeight: 1.1, height: 22, overflow: 'hidden' }}>{locName(ITEMS[key])}</span>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
          <div style={{ fontSize: 11, color: '#a98c5c', fontStyle: 'italic', textAlign: 'center', marginTop: 12, lineHeight: 1.4 }}>{L('Touche un composant pour son essence · glisse-le dans la marmite ou ressors-le.', 'Tap a component for its essence · drag it into the cauldron or back out.')}</div>
        </div>
      )}

      {/* ===== GRIMOIRE ===== */}
      {view === 'grimoire' && (
        <div style={{ padding: '6px 16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 700, fontSize: 16, color: '#7c5a1c', display: 'flex', alignItems: 'center', gap: 6 }}>📖 {L('Recettes connues', 'Known recipes')}</div>
            <span style={{ background: '#fff7e4', border: '1.5px solid #e8c878', borderRadius: 12, padding: '2px 10px', fontWeight: 800, fontSize: 12, color: '#9a6f1d' }}>{knownRecipes.length}</span>
          </div>

          {chipKeys.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: '#9b7e4e' }}>{L('FILTRER PAR COMPOSANT', 'FILTER BY COMPONENT')}</span>
                <div style={{ display: 'flex', background: 'rgba(150,110,40,.16)', borderRadius: 10, padding: 2 }}>
                  <button onClick={() => { setFilterMode('and'); setPageIndex(0); }} style={modeStyle(filterMode === 'and')}>{L('ET', 'AND')}</button>
                  <button onClick={() => { setFilterMode('or'); setPageIndex(0); }} style={modeStyle(filterMode === 'or')}>{L('OU', 'OR')}</button>
                </div>
              </div>
              <div className="alc-scr" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 0 8px' }}>
                {chipKeys.map((k) => {
                  const active = filters.includes(k);
                  return (
                    <button key={k} onClick={() => toggleFilter(k)} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, border: '1.5px solid', borderRadius: 16, padding: '5px 10px 5px 7px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', ...(active ? { background: alcColor(k), color: '#fff', borderColor: alcColor(k), boxShadow: `0 2px 8px ${alcColor(k)}66` } : { background: 'rgba(255,253,245,.85)', color: '#7a5d34', borderColor: 'rgba(120,90,40,.22)' }) }}><span style={{ fontSize: 13 }}>{ITEMS[k].icon}</span>{locName(ITEMS[k])}</button>
                  );
                })}
              </div>
            </>
          )}

          {/* Livre */}
          <div style={{ position: 'relative', perspective: 1700, marginTop: 4 }}>
            <div style={{ position: 'relative', borderRadius: '8px 16px 16px 8px', background: 'linear-gradient(135deg,#6b4a24,#4a3216)', padding: '10px 10px 10px 16px', boxShadow: '0 16px 34px rgba(50,30,10,.4)' }}>
              <div style={{ position: 'absolute', left: 6, top: 10, bottom: 10, width: 6, borderRadius: 3, background: 'linear-gradient(180deg,#3a2610,#5a3c1c,#3a2610)', boxShadow: '0 0 6px rgba(0,0,0,.5)' }} />
              <div style={{ position: 'relative', minHeight: 392 }}>
                <div style={{ position: 'relative', borderRadius: '4px 12px 12px 4px', background: 'linear-gradient(180deg,#fdf6e3,#f4e8c8)', boxShadow: 'inset 0 0 24px rgba(150,110,50,.18), inset 14px 0 22px rgba(120,85,35,.16)', padding: '14px 12px', minHeight: 392 }}>
                  <div style={{ position: 'absolute', inset: 6, border: '1.5px solid rgba(150,110,50,.28)', borderRadius: 6, pointerEvents: 'none' }} />
                  {baseItems.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, textAlign: 'center', color: '#a98c5c' }}>
                      <div style={{ fontSize: 34, opacity: .5, marginBottom: 8 }}>🔍</div>
                      <div style={{ fontFamily: "'Cormorant Garamond', var(--font-display), serif", fontSize: 19, color: '#8a6535' }}>{knownRecipes.length === 0 ? L('Aucune recette découverte.', 'No recipe discovered yet.') : L('Aucune recette ne contient ces composants.', 'No recipe contains these components.')}</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, padding: '6px 2px' }}>
                      {baseItems.map((cell) => (
                        <div key={cell.id} onClick={() => setPotionId(cell.id)} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 6px 8px', borderRadius: 12, cursor: 'pointer', background: 'rgba(255,255,255,.4)', boxShadow: 'inset 0 0 0 1px rgba(150,110,50,.16)', minHeight: 122, justifyContent: 'center' }}>
                          <div style={{ position: 'relative', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: 'inset 0 2px 8px rgba(255,255,255,.4)', background: `radial-gradient(circle at 38% 30%, #fff, ${cell.color}55 75%)`, padding: 4 }}><AlcVisual item={ITEMS[cell.potion]} emojiSize={28} /></div>
                          <div style={{ fontFamily: "'Cormorant Garamond', var(--font-display), serif", fontWeight: 600, fontSize: 15.5, lineHeight: 1.05, color: '#5b3d18', textAlign: 'center' }}>{cell.name}</div>
                          <div style={{ fontSize: 13, letterSpacing: 1, opacity: .85 }}>{cell.ingEmojis}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {turn && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '4px 12px 12px 4px', background: 'linear-gradient(180deg,#fdf6e3,#f4e8c8)', padding: '14px 12px', transformOrigin: turn.dir === 'next' ? 'left center' : 'right center', transition: 'transform .72s cubic-bezier(.42,.04,.3,1)', transform: turnGo ? `rotateY(${turn.dir === 'next' ? -168 : 168}deg)` : 'rotateY(0deg)', backfaceVisibility: 'hidden', zIndex: 6, boxShadow: '0 8px 30px rgba(60,40,15,.28), inset 0 0 24px rgba(150,110,50,.18)' }}>
                    <div style={{ position: 'absolute', inset: 6, border: '1.5px solid rgba(150,110,50,.28)', borderRadius: 6, pointerEvents: 'none' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, padding: '6px 2px' }}>
                      {flipItems.map((cell) => (
                        <div key={cell.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 6px 8px', borderRadius: 12, background: 'rgba(255,255,255,.4)', minHeight: 122, justifyContent: 'center' }}>
                          <div style={{ width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: 'inset 0 2px 8px rgba(255,255,255,.4)', background: `radial-gradient(circle at 38% 30%, #fff, ${cell.color}55 75%)`, padding: 4 }}><AlcVisual item={ITEMS[cell.potion]} emojiSize={28} /></div>
                          <div style={{ fontFamily: "'Cormorant Garamond', var(--font-display), serif", fontWeight: 600, fontSize: 15.5, color: '#5b3d18', textAlign: 'center' }}>{cell.name}</div>
                          <div style={{ fontSize: 13, opacity: .85 }}>{cell.ingEmojis}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 12 }}>
              <button onClick={() => flipTo('prev')} disabled={!(safe > 0 && !turn)} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid #d8b873', background: '#fffaef', color: '#7c5a1c', fontSize: 18, cursor: 'pointer', boxShadow: '0 3px 7px rgba(120,80,20,.2)', opacity: safe > 0 && !turn ? 1 : .28 }}>‹</button>
              <span style={{ fontFamily: "'Cormorant Garamond', var(--font-display), serif", fontStyle: 'italic', fontSize: 16, color: '#8a6535', minWidth: 48, textAlign: 'center' }}>{safe + 1} / {pages.length}</span>
              <button onClick={() => flipTo('next')} disabled={!(safe < pages.length - 1 && !turn)} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid #d8b873', background: '#fffaef', color: '#7c5a1c', fontSize: 18, cursor: 'pointer', boxShadow: '0 3px 7px rgba(120,80,20,.2)', opacity: safe < pages.length - 1 && !turn ? 1 : .28 }}>›</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Bottom-sheet : essence d'un ingrédient ===== */}
      {infoIng && (
        <div onClick={() => setInfo(null)} style={overlay({ background: 'rgba(40,28,12,.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' })}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'linear-gradient(180deg,#fffaef,#f6ead0)', borderRadius: '22px 22px 0 0', padding: '18px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -10px 30px rgba(60,35,10,.3)', animation: 'alc-fadeUp .28s ease' }}>
            <div style={{ width: 42, height: 4, borderRadius: 2, background: 'rgba(120,90,40,.25)', margin: '0 auto 14px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 58, height: 58, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, boxShadow: 'inset 0 2px 6px rgba(255,255,255,.5)', background: `radial-gradient(circle at 38% 30%, #ffffffcc, ${alcColor(infoIng)}88)`, padding: 6 }}><AlcVisual item={ITEMS[infoIng]} emojiSize={30} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 700, fontSize: 18, color: '#5b3d18' }}>{locName(ITEMS[infoIng])}</div>
                <div style={{ fontSize: 12.5, color: '#9b7e4e', fontStyle: 'italic', marginTop: 2 }}>{itemEffectLines(ITEMS[infoIng], { key: infoIng, knownIngredients: t.knownIngredients || [] }).join(' · ') || (known.has(infoIng) ? '' : L('Essence inconnue.', 'Unknown essence.'))}</div>
              </div>
            </div>
            <button onClick={() => { if (infoCanAdd) addSlot(info); }} disabled={!infoCanAdd} style={{ width: '100%', marginTop: 16, border: 'none', borderRadius: 14, padding: '13px 0', fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 800, fontSize: 15, ...(infoCanAdd ? { cursor: 'pointer', background: 'linear-gradient(180deg,#f0c463,#d99a30)', color: '#5a3c0c', boxShadow: '0 5px 14px rgba(200,150,40,.4)' } : { cursor: 'default', background: '#e9dcc0', color: '#a08a5e' }) }}>{filled >= 3 ? L('Marmite pleine (3/3)', 'Cauldron full (3/3)') : slots.includes(info) ? L('Déjà dans la marmite', 'Already in the cauldron') : `➕ ${L('Ajouter à la marmite', 'Add to the cauldron')}`}</button>
          </div>
        </div>
      )}

      {/* ===== Distillation ===== */}
      {phase === 'distilling' && (
        <div style={overlay({ background: 'radial-gradient(circle at 50% 44%,rgba(70,40,90,.85),rgba(18,11,26,.96))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' })}>
          <div style={{ position: 'relative', width: 232, height: 232, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: 210, height: 210, borderRadius: '50%', background: 'radial-gradient(circle at 36% 30%,#574d63,#2c2535 60%,#15101d)', boxShadow: '0 18px 36px rgba(40,25,55,.55), inset 0 4px 8px rgba(170,158,196,.45)' }} />
            <div style={{ position: 'absolute', width: 178, height: 178, borderRadius: '50%', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle at 42% 36%, ${liquid}ee, ${liquid} 58%, rgba(0,0,0,.55))` }} />
              <div style={{ position: 'absolute', inset: '-32%', background: 'conic-gradient(from 0deg,rgba(255,255,255,.22),transparent 22%,rgba(0,0,0,.32) 50%,transparent 74%,rgba(255,255,255,.18))', animation: 'alc-spinFast .65s linear infinite' }} />
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 46, height: 46, margin: '-23px 0 0 -23px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,0,0,.65),transparent 70%)', animation: 'alc-drainPulse 1s ease-in-out infinite' }} />
            </div>
            <div style={{ position: 'absolute', width: 0, height: 0, animation: 'alc-ringSwirl 1.75s cubic-bezier(.45,0,.7,1) forwards' }}>
              {cauldronList.map((c, i) => (
                <div key={c.idx} style={{ position: 'absolute', left: 0, top: 0, marginLeft: -20, marginTop: -20, width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, background: alcColor(keyOf(c.bi)), boxShadow: '0 3px 10px rgba(0,0,0,.45), inset 0 2px 4px rgba(255,255,255,.5)', border: '2px solid rgba(255,255,255,.6)', transform: `rotate(${i * 120}deg) translateX(56px)`, padding: 3 }}><AlcVisual item={ITEMS[keyOf(c.bi)]} emojiSize={21} /></div>
              ))}
            </div>
            <div style={{ position: 'absolute', width: 210, height: 210, borderRadius: '50%', background: 'radial-gradient(circle,#fff,rgba(255,235,180,.6),transparent 68%)', animation: 'alc-flashUp 1.75s ease-in forwards', pointerEvents: 'none' }} />
          </div>
          <div style={{ marginTop: 26, fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 700, fontSize: 18, color: '#ffe9c8' }}>{L('On mélange les essences…', 'Blending the essences…')}</div>
        </div>
      )}

      {/* ===== Potion créée (recette connue) ===== */}
      {phase === 'known' && result && (
        <div onClick={closeResult} style={overlay({ background: 'radial-gradient(circle at 50% 42%,rgba(60,40,80,.85),rgba(18,10,26,.96))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 })}>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'alc-riseShine .7s cubic-bezier(.2,1.2,.4,1) both' }}>
            <div style={{ position: 'absolute', top: -10, width: 160, height: 160, borderRadius: '50%', boxShadow: `0 0 60px ${alcColor(result.potion)}aa, 0 0 120px ${alcColor(result.potion)}55` }} />
            <div style={{ position: 'relative', width: 108, height: 108, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50, marginTop: 12, boxShadow: `0 0 50px ${alcColor(result.potion)}88, inset 0 3px 10px rgba(255,255,255,.5)`, background: `radial-gradient(circle at 50% 45%, ${alcColor(result.potion)}55, transparent 72%)`, padding: 8 }}><AlcVisual item={ITEMS[result.potion]} emojiSize={50} glow={`drop-shadow(0 6px 16px ${alcColor(result.potion)}cc)`} /></div>
            <div style={{ marginTop: 18, fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 2, color: '#ffe9c8' }}>{L('POTION CRÉÉE', 'POTION CREATED')}</div>
            <div style={{ marginTop: 4, fontFamily: "'Cormorant Garamond', var(--font-display), serif", fontWeight: 600, fontSize: 27, color: '#fff', textAlign: 'center' }}>{locName(ITEMS[result.potion])}</div>
            <div style={{ marginTop: 10, maxWidth: 280, textAlign: 'center', fontSize: 14, color: 'rgba(255,245,225,.9)', lineHeight: 1.45 }}>{potionEffect(result.potion)}</div>
          </div>
          <button onClick={closeResult} style={ceremonyBtn('linear-gradient(180deg,#f0c463,#d99a30)', '#5a3c0c')}>{L('Récupérer', 'Collect')}</button>
        </div>
      )}

      {/* ===== Nouvelle recette (découverte) ===== */}
      {phase === 'discovery' && result && (
        <div style={overlay({ background: 'radial-gradient(circle at 50% 40%,rgba(90,60,120,.92),rgba(14,8,22,.97))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 22 })}>
          <div style={{ position: 'absolute', top: '34%', left: '50%', width: 120, height: 120, margin: '-60px 0 0 -60px', borderRadius: '50%', background: 'radial-gradient(circle,#fff,rgba(255,230,160,.5),transparent 70%)', animation: 'alc-burstIn 1s ease-out both' }} />
          <div style={{ position: 'absolute', top: '34%', left: '50%', width: 90, height: 90, margin: '-45px 0 0 -45px', borderRadius: '50%', border: '3px solid rgba(255,240,200,.8)', animation: 'alc-ringPulse 1.4s ease-out .15s both' }} />
          <span style={{ position: 'absolute', top: '24%', left: '30%', fontSize: 20, animation: 'alc-sparkle 1.6s ease-in-out infinite' }}>✦</span>
          <span style={{ position: 'absolute', top: '50%', left: '74%', fontSize: 18, animation: 'alc-sparkle 2s ease-in-out .2s infinite' }}>✦</span>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'alc-fadeUp .6s ease .3s both' }}>
            <div style={{ fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 3, color: '#ffe79e', textShadow: '0 0 14px rgba(255,210,110,.7)' }}>✨ {L('NOUVELLE RECETTE', 'NEW RECIPE')} ✨</div>
            <div style={{ position: 'relative', width: 108, height: 108, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50, marginTop: 12, boxShadow: `0 0 50px ${alcColor(result.potion)}88, inset 0 3px 10px rgba(255,255,255,.5)`, background: `radial-gradient(circle at 50% 45%, ${alcColor(result.potion)}55, transparent 72%)`, padding: 8 }}><AlcVisual item={ITEMS[result.potion]} emojiSize={50} glow={`drop-shadow(0 6px 16px ${alcColor(result.potion)}cc)`} /></div>
          </div>
          <div style={{ position: 'relative', marginTop: 22, width: '100%', maxWidth: 320, borderRadius: 8, background: 'linear-gradient(180deg,#fdf6e3,#f1e3c0)', padding: '16px 18px', boxShadow: '0 14px 34px rgba(0,0,0,.45)', animation: 'alc-fadeUp .6s ease .5s both' }}>
            <div style={{ position: 'absolute', inset: 5, border: '1.5px solid rgba(150,110,50,.3)', borderRadius: 5, pointerEvents: 'none' }} />
            <div style={{ fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontSize: 9.5, letterSpacing: 2, color: '#a98c5c', textAlign: 'center' }}>{L('INSCRIT AU GRIMOIRE', 'INSCRIBED IN THE GRIMOIRE')}</div>
            <div style={{ overflow: 'hidden', marginTop: 4 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', var(--font-display), serif", fontWeight: 600, fontSize: 26, color: '#5b3d18', textAlign: 'center', whiteSpace: 'nowrap', clipPath: inscribed ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)', transition: 'clip-path 1s cubic-bezier(.5,0,.2,1)' }}>{locName(ITEMS[result.potion])}</div>
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', var(--font-display), serif", fontStyle: 'italic', fontSize: 15, color: '#8a6535', textAlign: 'center', marginTop: 6, lineHeight: 1.4 }}>{potionEffect(result.potion)}</div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(150,110,50,.35)', display: 'flex', justifyContent: 'center', gap: 18 }}>
              {result.ingredients.map((k, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}><span style={{ width: 30, height: 30, display: 'inline-flex' }}><AlcVisual item={ITEMS[k]} emojiSize={20} /></span><span style={{ fontSize: 8.5, color: '#8a6535', textAlign: 'center', maxWidth: 54 }}>{ITEMS[k] ? locName(ITEMS[k]) : k}</span></div>
              ))}
            </div>
          </div>
          <button onClick={closeResult} style={{ ...ceremonyBtn('linear-gradient(180deg,#ffe79e,#e0b34e)', '#5a3c0c'), animation: 'alc-fadeUp .6s ease .8s both' }}>{L('Magnifique !', 'Wonderful!')}</button>
        </div>
      )}

      {/* ===== Échec ===== */}
      {phase === 'fail' && (
        <div onClick={closeResult} style={overlay({ background: 'rgba(20,14,24,.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 })}>
          <div style={{ fontSize: 60, animation: 'alc-failShake .5s ease' }}>💨</div>
          <div style={{ marginTop: 14, fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 800, fontSize: 19, color: '#e8d8c0' }}>{L('Distillation ratée', 'Distillation failed')}</div>
          <div style={{ marginTop: 6, fontFamily: "'Cormorant Garamond', var(--font-display), serif", fontStyle: 'italic', fontSize: 16, color: 'rgba(220,200,175,.7)', textAlign: 'center', maxWidth: 260 }}>{L('Aucune recette ne correspond à ce mélange… les essences se dissipent.', 'No recipe matches this blend… the essences dissipate.')}</div>
          <button onClick={closeResult} style={ceremonyBtn('#fffaef', '#7c5a1c')}>{L('Réessayer', 'Try again')}</button>
        </div>
      )}

      {/* ===== Détail d'une potion (grimoire) ===== */}
      {potion && (
        <div onClick={() => setPotionId(null)} style={overlay({ background: 'rgba(40,28,12,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 })}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 330, background: 'linear-gradient(180deg,#fdf6e3,#f3e6c6)', borderRadius: 18, padding: '20px 20px 22px', boxShadow: '0 20px 44px rgba(50,30,10,.4)', animation: 'alc-fadeUp .3s ease', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 7, border: '1.5px solid rgba(150,110,50,.3)', borderRadius: 12, pointerEvents: 'none' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 84, height: 84, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, boxShadow: 'inset 0 3px 9px rgba(255,255,255,.5)', background: `radial-gradient(circle at 50% 45%, ${alcColor(potion.potion)}44, transparent 72%)`, padding: 6 }}><AlcVisual item={ITEMS[potion.potion]} emojiSize={40} /></div>
              <div style={{ marginTop: 12, fontFamily: "'Cormorant Garamond', var(--font-display), serif", fontWeight: 600, fontSize: 25, color: '#5b3d18', textAlign: 'center' }}>{locName(ITEMS[potion.potion])}</div>
              <div style={{ marginTop: 8, background: 'rgba(124,90,28,.1)', borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#5b3d18', textAlign: 'center', lineHeight: 1.45, fontWeight: 600 }}>{potionEffect(potion.potion)}</div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed rgba(150,110,50,.35)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#9b7e4e', textAlign: 'center', marginBottom: 8 }}>{L('COMPOSANTS', 'COMPONENTS')}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
                {potion.ingredients.map((k, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><div style={{ width: 42, height: 42, borderRadius: 12, background: '#fff8ec', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(120,80,20,.2)', padding: 4 }}><AlcVisual item={ITEMS[k]} emojiSize={21} /></div><span style={{ fontSize: 9, color: '#7a5d34', textAlign: 'center', maxWidth: 58, lineHeight: 1.1 }}>{ITEMS[k] ? locName(ITEMS[k]) : k}</span></div>
                ))}
              </div>
            </div>
            <button onClick={() => setPotionId(null)} style={{ width: '100%', marginTop: 18, border: 'none', borderRadius: 13, padding: '12px 0', fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer', background: '#7c5a1c', color: '#fff' }}>{L('Fermer', 'Close')}</button>
          </div>
        </div>
      )}

      {/* Fantôme de drag */}
      {drag && (
        <div style={{ position: 'fixed', left: drag.x, top: drag.y, transform: 'translate(-50%,-52%) scale(1.12)', pointerEvents: 'none', zIndex: 9999, width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 8px 18px rgba(0,0,0,.4), inset 0 2px 5px rgba(255,255,255,.4)', border: '2px solid rgba(255,255,255,.6)', background: alcColor(keyOf(drag.bagIdx)), padding: 4 }}><AlcVisual item={ITEMS[keyOf(drag.bagIdx)]} emojiSize={24} /></div>
      )}
    </div>
  );
}
