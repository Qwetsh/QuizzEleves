// Atelier de Forge (TBI) — ouvert en cliquant le dé 3D du HUD. REPREND le visuel
// de l'atelier MOBILE (creuset en croix sur foyer de lave, réserve, vitrine,
// coulée à la pose, modale de détail) mais avec une disposition « grand écran »
// (creuset à gauche, réserve + vitrine à droite). Actions branchées en DIRECT
// sur le store (pas d'intents) ; forgeFace(…, fromIntent=true) saute la cérémonie
// plein écran TBI au profit de la coulée in-slot, comme sur le téléphone.
import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { tFor } from '../../i18n';
import { getDieFaces, isFaceForged, clampFaceValue, faceEffects } from '../../logic/forge';
import { FORGE_EFFECTS, FORGE_FAMILY_COLOR, faceEffectLabel, faceEffectDescriptions } from '../../logic/forgeEffects';
import FaceTile from '../Game/FaceTile';
import { soundClick, soundCast } from '../../logic/sounds';
import '../../styles/forge.css';
import '../../styles/forge-mobile.css';

const DESK_EMBERS = [
  ['18%', '12px', '5s', '0s'], ['34%', '-10px', '6.1s', '1s'], ['50%', '8px', '5.2s', '1.8s'],
  ['62%', '-7px', '5.8s', '.6s'], ['78%', '-5px', '6.4s', '2.4s'], ['44%', '10px', '4.7s', '1.4s'],
];
// Gouttes de lave projetées à la pose d'une face (directions précalculées, biais
// vers le haut pour un effet d'éclaboussure).
const SPLASH = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const dist = 30 + (i % 3) * 12;
  return { dx: `${Math.round(Math.cos(a) * dist)}px`, dy: `${Math.round(Math.sin(a) * dist - 16)}px`, d: `${(i % 5) * 26}ms` };
});

export default function ForgeModal() {
  const showForge = useGameStore((s) => s.showForge);
  const closeForge = useGameStore((s) => s.closeForge);
  const buyFace = useGameStore((s) => s.buyFace);
  const forgeFace = useGameStore((s) => s.forgeFace);
  const shopFaces = useGameStore((s) => s.shopFaceStock) || [];
  const team = useGameStore((s) => s.teams[s.currentTeam]);
  const en = useGameStore((s) => s.englishMode);
  const T = tFor(en);

  const [fusion, setFusion] = useState(null);    // { slot, oldFace, newFace } coulée
  const [drag, setDrag] = useState(null);        // { stockIndex, slot, face, x, y }
  const [hoverSlot, setHoverSlot] = useState(null);
  const [badSlot, setBadSlot] = useState(null);
  const [detail, setDetail] = useState(null);    // { face, stockIndex|null }
  const dragRef = useRef({ id: null, stockIndex: null, offX: 0, offY: 0, startX: 0, startY: 0, moved: false });
  const badT = useRef(null);

  useEffect(() => () => clearTimeout(badT.current), []);
  useEffect(() => { if (!fusion) return undefined; const id = setTimeout(() => setFusion(null), 1000); return () => clearTimeout(id); }, [fusion]);
  useEffect(() => { if (!showForge) { setDetail(null); setDrag(null); setFusion(null); setHoverSlot(null); } }, [showForge]);

  if (!showForge || !team) return null;

  const faces = getDieFaces(team);
  const reserve = team.faceStock || [];
  const gold = team.money ?? 0;
  const colorOf = (f) => { const e = faceEffects(f)[0]; const m = e ? FORGE_EFFECTS[e.type] : null; return (m && FORGE_FAMILY_COLOR[m.family]) || '#7a5e3a'; };

  // Pose une face de la réserve sur SON slot + coulée in-slot (cérémonie TBI sautée).
  const doForge = (stockIndex) => {
    const f = reserve[stockIndex]; if (!f) return;
    const slot = (f.slot || 1) - 1;
    setFusion({ slot, oldFace: isFaceForged(faces[slot]) ? faces[slot] : null, newFace: f });
    try { soundCast(); } catch { /* audio indispo */ }
    forgeFace(slot, stockIndex, undefined, true);
  };

  // --- Glisser-déposer (réserve → emplacement) via pointer capture ---
  const resetDrag = () => { dragRef.current = { id: null, stockIndex: null, offX: 0, offY: 0, startX: 0, startY: 0, moved: false }; };
  const onTileDown = (e, stockIndex) => {
    const f = reserve[stockIndex]; if (!f) return;
    const r = e.currentTarget.getBoundingClientRect();
    dragRef.current = { id: e.pointerId, stockIndex, startX: e.clientX, startY: e.clientY, moved: false, offX: e.clientX - (r.left + r.width / 2), offY: e.clientY - (r.top + r.height / 2) };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onTileMove = (e) => {
    const d = dragRef.current;
    if (d.stockIndex == null || e.pointerId !== d.id) return;
    if (!d.moved) { if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) <= 6) return; d.moved = true; }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = el && el.closest && el.closest('[data-forge-slot]');
    const f = reserve[d.stockIndex];
    setDrag({ stockIndex: d.stockIndex, slot: f.slot || 1, face: f, x: e.clientX, y: e.clientY, moved: true });
    setHoverSlot(slotEl ? Number(slotEl.dataset.forgeSlot) : null);
    if (e.cancelable) e.preventDefault();
  };
  const onTileUp = (e) => {
    const d = dragRef.current;
    if (d.stockIndex == null || e.pointerId !== d.id) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const { moved, stockIndex } = d;
    resetDrag(); setDrag(null); setHoverSlot(null);
    const f = reserve[stockIndex]; if (!f) return;
    if (!moved) { setDetail({ face: f, stockIndex }); return; } // tap → modale
    const targetSlot = f.slot || 1;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = el && el.closest && el.closest('[data-forge-slot]');
    const slot = slotEl ? Number(slotEl.dataset.forgeSlot) : null;
    if (slot === targetSlot) { doForge(stockIndex); }
    else if (slot && slot !== targetSlot) { setBadSlot(slot); clearTimeout(badT.current); badT.current = setTimeout(() => setBadSlot(null), 460); }
  };
  const onTileCancel = (e) => { if (e.pointerId !== dragRef.current.id) return; resetDrag(); setDrag(null); setHoverSlot(null); };

  return (
    <div className="forge-desk-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) closeForge(); }}>
      <div className="forge-desk">
        <div className="forge-desk-embers" aria-hidden="true">
          {DESK_EMBERS.map(([left, drift, dur, delay], i) => (
            <span key={i} className="forge-mob-ember" style={{ left, '--drift': drift, animationDuration: dur, animationDelay: delay }} />
          ))}
        </div>
        <button className="forge-desk-x" onClick={() => { soundClick(); closeForge(); }} aria-label={T('common.close')}>✕</button>

        <div className="forge-desk-head">
          <span className="forge-desk-title">🔨 {T('modal.forge.title')}</span>
          <span className="forge-desk-gold">🪙 {gold}</span>
        </div>

        <div className="forge-desk-body">
          {/* Creuset en croix (1 · 3-2-4 · 5 · 6) */}
          <div className="forge-desk-left">
            <div className="forge-mob-plate">
              <span className="forge-mob-bolt fmb-tl" /><span className="forge-mob-bolt fmb-tr" />
              <span className="forge-mob-bolt fmb-bl" /><span className="forge-mob-bolt fmb-br" />
              <div className="forge-mob-chan forge-mob-chan-v" />
              <div className="forge-mob-chan forge-mob-chan-h" />
              {faces.map((face, i) => {
                const slotNo = i + 1;
                const forged = isFaceForged(face);
                const target = drag && drag.moved && drag.slot === slotNo;
                const hot = target && hoverSlot === slotNo;
                const bad = badSlot === slotNo;
                const fusing = fusion && fusion.slot === i;
                const inner = ['forge-mob-slot-inner']
                  .concat(forged ? 'is-forged' : 'is-empty')
                  .concat(hot ? 'is-hot' : (target ? 'is-target' : []))
                  .concat(bad ? (slotNo === 3 || slotNo === 4 ? 'is-bad is-bad-side' : 'is-bad') : [])
                  .join(' ');
                return (
                  <div key={i} className={`forge-mob-slot fms-${slotNo}`} data-forge-slot={slotNo}>
                    <div className={inner} onClick={forged ? () => setDetail({ face, stockIndex: null }) : undefined} role={forged ? 'button' : undefined}>
                      {forged
                        ? <FaceTile face={face} base={slotNo} size={58} title={faceEffectLabel(face, en) || undefined} />
                        : <span className="forge-mob-slotnum">{slotNo}</span>}
                      {fusing && (
                        <div className="forge-mob-fusion" aria-hidden="true">
                          {fusion.oldFace
                            ? <div className="ff-old"><FaceTile face={fusion.oldFace} size={58} /></div>
                            : <div className="ff-old ff-old-empty"><span className="forge-mob-slotnum">{slotNo}</span></div>}
                          <span className="ff-pour" />
                          <div className="ff-new"><FaceTile face={fusion.newFace} size={58} /></div>
                          <span className="ff-seam" />
                          <span className="ff-glow" />
                          <span className="forge-splash">
                            {SPLASH.map((s, k) => (
                              <span key={k} className="forge-splash-drop" style={{ '--dx': s.dx, '--dy': s.dy, animationDelay: s.d }} />
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Réserve + vitrine d'achat */}
          <div className="forge-desk-right">
            <section className="forge-mob-panel">
              <div className="forge-mob-panel-head">
                <span className="forge-mob-panel-title">{T('mobile.forgeReserve')}</span>
                <span className="forge-mob-panel-count">{reserve.length}</span>
              </div>
              {reserve.length === 0 ? (
                <div className="forge-mob-empty">{T('mobile.forgeReserveEmpty')}</div>
              ) : (
                <div className="forge-mob-reserve-grid">
                  {reserve.map((f, i) => {
                    const dragging = drag && drag.moved && drag.stockIndex === i;
                    return (
                      <div
                        key={i}
                        className={`forge-mob-drag${dragging ? ' is-dragging' : ''}`}
                        onPointerDown={(e) => onTileDown(e, i)}
                        onPointerMove={onTileMove}
                        onPointerUp={onTileUp}
                        onPointerCancel={onTileCancel}
                      >
                        <FaceTile face={f} size={52} slotTag={f.slot} clickable title={faceEffectLabel(f, en) || undefined} />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="forge-mob-foot">{T('mobile.forgeHintSlot')}</div>
            </section>

            <section>
              <div className="forge-desk-sec-title">{T('mobile.forgeShop')}</div>
              {shopFaces.length === 0 ? (
                <div className="forge-mob-empty">{T('mobile.facesEmpty')}</div>
              ) : (
                <div className="forge-desk-buy-list">
                  {shopFaces.map((f, i) => {
                    const eff = faceEffectLabel(f, en);
                    const broke = gold < (f.price || 0);
                    return (
                      <div key={i} className="forge-desk-buy-row" style={{ '--fam': colorOf(f) }}>
                        <FaceTile face={f} size={46} slotTag={f.slot} />
                        <div className="forge-desk-buy-info">
                          <div className="forge-desk-buy-slot">{T('mobile.faceSlotShort', { n: f.slot })}</div>
                          <div className="forge-desk-buy-eff">{eff || T('mobile.forgeDie')}</div>
                        </div>
                        <button className="forge-mob-buy" disabled={broke} onClick={() => { soundClick(); buyFace(i); }}>
                          {T('mobile.buyFaceFor', { price: f.price || 0 })}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Modale de détail (zoom + effets) */}
        {detail && (() => {
          const f = detail.face;
          const descs = faceEffectDescriptions(f, en);
          const moveVal = clampFaceValue(f.value);
          const accent = colorOf(f);
          const fromReserve = detail.stockIndex != null;
          const targetSlot = f.slot || 1;
          const willReplace = fromReserve && isFaceForged(faces[targetSlot - 1]);
          return (
            <div className="forge-mob-modal" onClick={() => setDetail(null)}>
              <div className="forge-mob-modal-card" style={{ '--fam': accent }} onClick={(e) => e.stopPropagation()}>
                <button className="forge-mob-modal-x" onClick={() => setDetail(null)} aria-label="×">×</button>
                <div className="forge-mob-modal-zoom">
                  <FaceTile face={f} size={132} slotTag={fromReserve ? f.slot : undefined} base={fromReserve ? undefined : targetSlot} />
                </div>
                <div className="forge-mob-modal-name">{descs.length ? descs.map((d) => `${d.icon} ${d.name}`).join(' · ') : T('mobile.forgeNoEffect')}</div>
                <div className="forge-mob-modal-move">{moveVal > 0 ? T('mobile.forgeMove', { n: moveVal, s: moveVal > 1 ? 's' : '' }) : T('mobile.forgeMoveSafe')}</div>
                {descs.length > 0 && (
                  <div className="forge-mob-modal-desc">
                    {descs.map((d, i) => (
                      <div key={i} style={{ marginBottom: i < descs.length - 1 ? 8 : 0 }}>
                        <p className="fmm-what">{d.icon} {d.what}</p>
                        {d.when && <p className="fmm-when">{d.when}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {fromReserve && (
                  <>
                    {willReplace && <div className="forge-mob-modal-warn">{T('mobile.forgeWillReplace')}</div>}
                    <button className="forge-mob-buy forge-mob-modal-forge" onClick={() => { doForge(detail.stockIndex); setDetail(null); }}>
                      🔨 {T('mobile.forgeForgeOn', { n: targetSlot })}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* Fantôme suivant le curseur pendant le glisser */}
        {drag && drag.moved && (
          <div className="forge-mob-ghost" style={{ transform: `translate(${drag.x - dragRef.current.offX}px, ${drag.y - dragRef.current.offY}px) translate(-50%, -50%) rotate(-4deg) scale(1.1)` }} aria-hidden="true">
            <FaceTile face={drag.face} size={56} />
          </div>
        )}
      </div>
    </div>
  );
}
