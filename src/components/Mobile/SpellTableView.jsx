// Table des sorts (extension « Magie ») — RÉUTILISABLE (mobile + modale TBI,
// props pures, pas de store). L'élève TRACE des runes au doigt sur le canvas
// (traînée lumineuse), la reconnaissance $1 tourne EN LOCAL au relâcher
// (gratuit : un tracé non reconnu ne coûte rien et ne part pas au TBI), la
// séquence s'empile en chips, puis « Incanter » envoie l'intent — le TBI reste
// l'AUTORITÉ (match du sort, coût, découverte, fizzle payant).
// ⚠️ SECRET : si la séquence correspond à un sort NON connu, on n'affiche RIEN
// (même bandeau « combinaison inconnue » qu'une séquence invalide) — c'est la
// cérémonie TBI qui révèle la découverte.
import { useEffect, useRef, useState } from 'react';
import { recognizeRune } from '../../logic/gestures';
import { MAGIC } from '../../logic/balanceConfig';
import { matchSpell, spellName } from '../../data/spells';
import { tFor } from '../../i18n';
import { soundClick } from '../../logic/sounds';
import { RuneGlyph } from './CodexView';
import '../../styles/magic-mobile.css';

const MAX_SEQ = 4;

// Valeur courante de la barre : accrual local depuis {stored, lastTs,
// regenPerMin, max} (résolus côté TBI) — AUCUN état serveur ne tick.
const magicNowLocal = (m) => {
  if (!m || typeof m.stored !== 'number') return 0;
  const perMin = m.regenPerMin || 0;
  return Math.max(0, Math.min(m.max || 0, m.stored + (Math.max(0, Date.now() - (m.lastTs || Date.now())) / 60000) * perMin));
};

// Barre de magie animée localement (~2 ticks/s, transition CSS 0.5s = continu).
function MagicBar({ magic, T }) {
  const [val, setVal] = useState(() => magicNowLocal(magic));
  useEffect(() => {
    setVal(magicNowLocal(magic));
    const id = setInterval(() => setVal(magicNowLocal(magic)), 500);
    return () => clearInterval(id);
  }, [magic]);
  const max = magic?.max || 1;
  const pct = Math.max(0, Math.min(100, (val / max) * 100));
  return (
    <div style={{ margin: '10px 18px 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 800, fontSize: 14, color: '#cdb4ff' }}>
          {'\u{2728}'} {T('mobile.magic.bar')}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#9a8ac2' }}>
          {Math.floor(val)} / {max} <span style={{ opacity: 0.75 }}>· +{Math.round((magic?.regenPerMin || 0) * 10) / 10}/min</span>
        </span>
      </div>
      <div className="mgc-bar-track">
        <div className="mgc-bar-fill" style={{ width: pct + '%' }} />
        <div className="mgc-bar-shine" />
      </div>
    </div>
  );
}

// Cercle magique de fond de la table (SVG discret, rotations lentes).
function TableCircle() {
  return (
    <svg className="mgc-table-circle" viewBox="0 0 200 200" aria-hidden="true">
      <g className="mgc-rot">
        <circle className="mgc-tc-ring" cx="100" cy="100" r="88" />
        <circle className="mgc-tc-grads" cx="100" cy="100" r="80" pathLength="100" />
      </g>
      <g className="mgc-rot-rev">
        <circle className="mgc-tc-ring2" cx="100" cy="100" r="64" />
        <polygon className="mgc-tc-tri" points="100,40 152,130 48,130" />
        <polygon className="mgc-tc-tri" points="100,160 48,70 152,70" />
      </g>
    </svg>
  );
}

export default function SpellTableView({ magic, knownRunes = [], knownSpells = [], teams = [], myIdx = -1, locked = false, en = false, onCast, bottomInset = 0 }) {
  const T = tFor(en);
  const canvasRef = useRef(null);
  const zoneRef = useRef(null);
  const stroke = useRef(null);      // points du tracé en cours (coordonnées canvas)
  const [seq, setSeq] = useState([]);
  const [target, setTarget] = useState(null);
  const [face, setFace] = useState(null);
  const [note, setNote] = useState(null);     // pilule flottante (« signe non reconnu »…)
  const [shake, setShake] = useState(false);
  const [flying, setFlying] = useState(false); // envol des chips à l'incantation
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Canvas net sur écran haute densité + redimensionnement (rotation du tel).
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return undefined;
    const fit = () => {
      const r = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);

  // Compte à rebours anti-spam (MAGIC.castCooldownMs depuis le dernier cast TBI).
  useEffect(() => {
    const tick = () => {
      const until = (magic?.lastCastAt || 0) + (MAGIC.castCooldownMs || 0);
      setCooldownLeft(Math.max(0, until - Date.now()));
    };
    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [magic]);

  const flash = (text, ms = 1400) => {
    setNote(text);
    if (flash.t) clearTimeout(flash.t);
    flash.t = setTimeout(() => setNote(null), ms);
  };

  // --- Tracé au doigt : traînée lumineuse + reconnaissance au relâcher ---
  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e) => {
    if (flying) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    stroke.current = [pos(e)];
  };
  const onMove = (e) => {
    if (!stroke.current) return;
    const p = pos(e);
    const pts = stroke.current;
    const last = pts[pts.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 2) return;
    pts.push(p);
    // Traînée : trait externe diffus (glow) + cœur clair, en mode additif.
    const ctx = canvasRef.current.getContext('2d');
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(157,107,255,0.9)';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = 'rgba(130,80,230,0.55)';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(240,230,255,0.95)';
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  };
  // Efface la traînée en douceur (fondu CSS puis clear réel).
  const fadeCanvas = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.style.transition = 'opacity 0.35s ease';
    cv.style.opacity = '0';
    setTimeout(() => {
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      cv.style.transition = 'none';
      cv.style.opacity = '1';
    }, 360);
  };
  const onUp = () => {
    const pts = stroke.current;
    stroke.current = null;
    if (!pts || pts.length < 8) { fadeCanvas(); return; }
    const hit = recognizeRune(pts);
    fadeCanvas();
    if (!hit) {
      // Rejet LOCAL et GRATUIT : pas d'intent, pas de coût — juste un tremblement.
      setShake(true);
      setTimeout(() => setShake(false), 480);
      flash(T('mobile.magic.notRecognized'));
      return;
    }
    soundClick?.();
    setSeq((s) => (s.length >= MAX_SEQ ? s : [...s, hit.key]));
  };

  // --- Analyse de la séquence (SECRET préservé pour les sorts non connus) ---
  const spell = seq.length ? matchSpell(seq) : null;
  const known = !!spell && knownSpells.includes(spell.key);
  const others = teams.filter((t, i) => (t.idx ?? i) !== myIdx);
  const now = magicNowLocal(magic);
  const needTarget = known && spell.targeted && target == null;
  const needFace = known && spell.facePick && face == null;
  const cost = known ? (spell.cost || 0) : (MAGIC.fizzleCost || 0);
  const enough = now >= cost;
  const ready = !locked && !flying && seq.length >= 2 && cooldownLeft <= 0 && enough && !needTarget && !needFace;

  const clearSeq = () => { setSeq([]); setTarget(null); setFace(null); };
  const cast = () => {
    if (!ready || !onCast) return;
    onCast({
      runes: seq,
      ...(known && spell.targeted && target != null ? { target } : {}),
      ...(known && spell.facePick && face != null ? { face } : {}),
    });
    setFlying(true);
    flash(T('mobile.magic.sent'), 1800);
    setTimeout(() => { setFlying(false); clearSeq(); }, 520);
  };

  // Libellé du bouton (raison du blocage, la plus prioritaire d'abord).
  const castLabel = locked ? T('mobile.magic.lockedBtn')
    : cooldownLeft > 0 ? T('mobile.magic.cooldown', { s: Math.ceil(cooldownLeft / 1000) })
    : seq.length < 2 ? T('mobile.magic.needRunes')
    : !enough ? T('mobile.magic.needMagic', { n: cost })
    : needTarget ? T('mobile.magic.chooseTarget')
    : needFace ? T('mobile.magic.chooseFace')
    : `\u{2728} ${T('mobile.magic.cast')}${known ? ` · −${cost} \u{2728}` : ''}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', paddingBottom: bottomInset }}>
      <MagicBar magic={magic} T={T} />

      {/* Table des sorts (zone de tracé) */}
      <div ref={zoneRef} className={'mgc-zone' + (shake ? ' is-shake' : '')} style={{ margin: '10px 14px 0', flex: 1, minHeight: 240 }}>
        <span className="mgc-corner tl" /><span className="mgc-corner tr" /><span className="mgc-corner bl" /><span className="mgc-corner br" />
        <TableCircle />
        <canvas ref={canvasRef} className="mgc-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        {note
          ? <div className="mgc-note" key={note}>{note}</div>
          : <div className="mgc-zone-hint">{T('mobile.magic.hint')}</div>}
      </div>

      {/* Séquence de runes tracées (chips) + retirer/vider */}
      <div className={'mgc-chips' + (flying ? ' is-fly' : '')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, margin: '12px 14px 0' }}>
        {Array.from({ length: MAX_SEQ }).map((_, i) => (seq[i]
          ? <span key={`${seq[i]}-${i}`} className="mgc-chip" style={{ animationDelay: flying ? `${i * 0.07}s` : undefined }}><RuneGlyph rune={seq[i]} size={34} strokeWidth={8} color="#e3d5ff" /></span>
          : <span key={`e${i}`} className="mgc-chip mgc-chip--empty">{i + 1}</span>))}
        <button onClick={() => setSeq((s) => s.slice(0, -1))} disabled={!seq.length || flying} className="mgc-target" style={{ width: 40, height: 40, fontSize: 17, opacity: seq.length ? 1 : 0.4 }} aria-label={T('mobile.magic.undo')}>{'\u{21A9}'}</button>
        <button onClick={clearSeq} disabled={!seq.length || flying} className="mgc-target" style={{ width: 40, height: 40, fontSize: 15, opacity: seq.length ? 1 : 0.4 }} aria-label={T('mobile.magic.clear')}>{'\u{1F5D1}️'}</button>
      </div>

      {/* Sort reconnu ET connu → fiche + sélecteurs ; sinon bandeau neutre. */}
      <div style={{ margin: '10px 16px 0', minHeight: 64 }}>
        {known && (
          <div className="mgc-spell" style={{ '--sc': spell.color || '#8745d4', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 26 }}>{spell.icon || '\u{2728}'}</span>
              <span style={{ fontFamily: "'Cormorant Garamond', var(--font-display), serif", fontWeight: 600, fontSize: 20, color: '#f4edff', flex: 1 }}>{spellName(spell, en ? 'en' : 'fr')}</span>
              <span style={{ fontWeight: 800, fontSize: 13, color: '#cdb4ff' }}>{spell.cost || 0} {'\u{2728}'}</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 12.5, fontStyle: 'italic', color: 'rgba(220,205,250,.85)' }}>{(en ? spell.desc_en : spell.desc) || spell.desc || ''}</div>
            {spell.targeted && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                {others.map((t) => {
                  const idx = t.idx;
                  return (
                    <button key={idx} className={'mgc-target' + (target === idx ? ' is-on' : '')}
                      style={{ '--tc': t.color || '#9d6bff', padding: '7px 12px', fontSize: 13.5 }}
                      onClick={() => setTarget(target === idx ? null : idx)}>
                      {t.emoji} {t.name}
                    </button>
                  );
                })}
              </div>
            )}
            {spell.facePick && (
              <div style={{ display: 'flex', gap: 7, marginTop: 9, justifyContent: 'center' }}>
                {[1, 2, 3, 4, 5, 6].map((f) => (
                  <button key={f} className={'mgc-face' + (face === f ? ' is-on' : '')}
                    style={{ width: 40, height: 40, fontSize: 16 }}
                    onClick={() => setFace(face === f ? null : f)}>{f}</button>
                ))}
              </div>
            )}
          </div>
        )}
        {!known && seq.length >= 2 && (
          <div className="mgc-unknown" style={{ padding: '10px 14px', fontSize: 13, lineHeight: 1.45 }}>
            {'\u{1F52E}'} {T('mobile.magic.unknownCombo', { n: MAGIC.fizzleCost || 0 })}
          </div>
        )}
      </div>

      {/* Incanter */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 16px 16px' }}>
        <button className={'mgc-cast' + (ready ? ' is-ready' : '')} onClick={cast} disabled={!ready}>{castLabel}</button>
      </div>
    </div>
  );
}
