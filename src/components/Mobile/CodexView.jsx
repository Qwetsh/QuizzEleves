// Codex (extension « Magie ») — grimoire de l'équipe, RÉUTILISABLE (mobile +
// TBI, props pures, pas de store) : runes connues (glyphe SVG qui se dessine,
// point de départ + flèche = SENS du tracé, sensible pour la reco $1), sorts
// connus (icône, coût, séquence en mini-glyphes, effet) et marques actives du
// dé (faces bénies/maudites). ⚠️ SECRET : les entrées inconnues restent des
// silhouettes « ? » — le codex ne révèle JAMAIS ce qui n'a pas été appris
// (ni le nombre exact près : seuls les TOTAUX du catalogue sont visibles).
import { useState } from 'react';
import { RUNES, RUNE_KEYS, runeName } from '../../data/runes';
import { SPELLS, spellName } from '../../data/spells';
import { tFor } from '../../i18n';
import '../../styles/magic-mobile.css';

// Glyphe SVG d'une rune (variants[0] = gabarit 0..100 → polyline). `animate` =
// tracé qui se dessine (stroke-dashoffset) ; `dir` = point de départ (pulse
// doré) + flèche d'arrivée, pour montrer le SENS du tracé attendu.
export function RuneGlyph({ rune, size = 40, color = '#cdb4ff', strokeWidth = 6, animate = false, dir = false, className = '' }) {
  const pts = RUNES[rune]?.variants?.[0];
  if (!pts || !pts.length) return null;
  const d = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const p0 = pts[0];
  const pn = pts[pts.length - 1];
  const pp = pts[Math.max(0, pts.length - 4)]; // direction du dernier segment
  const ang = (Math.atan2(pn.y - pp.y, pn.x - pp.x) * 180) / Math.PI;
  return (
    <svg className={className} viewBox="-12 -12 124 124" width={size} height={size} aria-hidden="true" style={{ overflow: 'visible', display: 'block' }}>
      <polyline
        className={animate ? 'mgc-glyph-draw' : undefined}
        points={d} pathLength="100" fill="none"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      />
      {dir && <circle className="mgc-glyph-start" cx={p0.x} cy={p0.y} r="6.5" fill="#ffe9a8" />}
      {dir && (
        <g transform={`translate(${pn.x.toFixed(1)},${pn.y.toFixed(1)}) rotate(${ang.toFixed(1)})`}>
          <path d="M -1.5 -7 L 10 0 L -1.5 7 Z" fill={color} />
        </g>
      )}
    </svg>
  );
}

const capsStyle = { fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: '#9a8ac2' };
const countStyle = {
  background: 'rgba(120,90,220,.18)', border: '1px solid rgba(160,130,255,.35)', borderRadius: 12,
  padding: '1px 10px', fontWeight: 800, fontSize: 12, color: '#cdb4ff',
};

export default function CodexView({ knownRunes = [], knownSpells = [], faceMods = {}, en = false }) {
  const T = tFor(en);
  const lang = en ? 'en' : 'fr';
  // Deux pages du grimoire : Runes / Sorts (compteurs sur les onglets).
  const [page, setPage] = useState('runes');

  // Runes : connues d'abord (dans l'ordre du catalogue), puis N silhouettes « ? »
  // — ne pas suivre l'ordre du catalogue pour les inconnues (leur position
  // révélerait leur identité).
  const runes = RUNE_KEYS.filter((k) => knownRunes.includes(k));
  const unknownRunes = Math.max(0, RUNE_KEYS.length - runes.length);

  // Sorts : mêmes règles (SPELLS = liste vive, DB fusionnée par-dessus).
  const activeSpells = SPELLS.filter((s) => s.enabled !== false);
  const spells = activeSpells.filter((s) => knownSpells.includes(s.key));
  const unknownSpells = Math.max(0, activeSpells.length - spells.length);

  // Marques du dé (faces bénies/maudites), triées par n° de face.
  const marks = Object.entries(faceMods || {})
    .map(([slot, m]) => ({ slot: Number(slot), ...m }))
    .filter((m) => m.slot >= 1 && m.slot <= 6)
    .sort((a, b) => a.slot - b.slot);

  const section = (label, known, total, extra = null) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 2px 8px' }}>
      <span style={capsStyle}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {extra}
        <span style={countStyle}>{known} / {total}</span>
      </span>
    </div>
  );

  return (
    <div style={{ padding: '4px 16px 22px' }}>
      {/* Bascule Runes / Sorts (compteurs connus/total sur chaque page) */}
      <div className="mgc-seg" style={{ margin: '6px 0 2px' }}>
        <button className={page === 'runes' ? 'is-on' : ''} onClick={() => setPage('runes')}>
          {'\u{1F58B}\u{FE0F}'} {T('mobile.magic.runesTab')} <span style={{ opacity: 0.75, fontWeight: 700 }}>({runes.length}/{RUNE_KEYS.length})</span>
        </button>
        <button className={page === 'spells' ? 'is-on' : ''} onClick={() => setPage('spells')}>
          {'\u{1FA84}'} {T('mobile.magic.spellsTab')} <span style={{ opacity: 0.75, fontWeight: 700 }}>({spells.length}/{activeSpells.length})</span>
        </button>
      </div>

      {page === 'runes' && (<>
      {/* ===== RUNES ===== */}
      {section(T('mobile.magic.runesCaps'), runes.length, RUNE_KEYS.length)}
      <div style={{ fontSize: 11.5, fontStyle: 'italic', color: 'rgba(190,175,230,.6)', margin: '-4px 2px 10px' }}>
        {T('mobile.magic.traceLegend')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {runes.map((k, i) => (
          <div key={k} className="mgc-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 8px 10px' }}>
            <RuneGlyph rune={k} size={64} animate dir className="mgc-cdx-glyph" strokeWidth={5.5} />
            <div style={{ fontFamily: "'Cormorant Garamond', var(--font-display), serif", fontWeight: 600, fontSize: 17, color: '#efe6ff', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>{RUNES[k]?.icon}</span>{runeName(k, lang)}
            </div>
            {/* Cascade discrète à l'ouverture du codex */}
            <style>{`.mgc-card:nth-child(${i + 1}) .mgc-glyph-draw{animation-delay:${(i * 0.08).toFixed(2)}s}`}</style>
          </div>
        ))}
        {Array.from({ length: unknownRunes }).map((_, i) => (
          <div key={`u${i}`} className="mgc-card mgc-card--unknown" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '14px 8px 10px', minHeight: 108 }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: 'rgba(150,125,210,.35)', fontFamily: "'Baloo 2', var(--font-display), sans-serif" }}>?</div>
            <div style={{ fontSize: 11.5, fontStyle: 'italic', color: 'rgba(150,125,210,.45)' }}>{T('mobile.magic.unknownRune')}</div>
          </div>
        ))}
      </div>
      </>)}

      {page === 'spells' && (<>
      {/* ===== SORTS ===== */}
      {section(T('mobile.magic.spellsCaps'), spells.length, activeSpells.length)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {spells.map((s) => (
          <div key={s.key} className="mgc-card" style={{ borderColor: `${s.color || '#8745d4'}66`, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 46, height: 46, flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: `radial-gradient(circle at 42% 36%, ${s.color || '#8745d4'}55, transparent 74%)`, boxShadow: `0 0 14px ${s.color || '#8745d4'}55`, border: `1px solid ${s.color || '#8745d4'}77` }}>{s.icon || '✨'}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: "'Cormorant Garamond', var(--font-display), serif", fontWeight: 600, fontSize: 19, color: '#efe6ff', lineHeight: 1.1 }}>{spellName(s, lang)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  {(s.runes || []).map((rk, i) => (
                    <span key={i} style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'rgba(20,12,40,.7)', border: '1px solid rgba(160,130,255,.3)' }}>
                      <RuneGlyph rune={rk} size={15} strokeWidth={9} color="#b79af2" />
                    </span>
                  ))}
                </div>
              </div>
              <span style={{ flex: 'none', fontWeight: 800, fontSize: 13, color: '#cdb4ff', background: 'rgba(120,90,220,.2)', border: '1px solid rgba(160,130,255,.35)', borderRadius: 999, padding: '3px 10px' }}>{s.cost ?? 0} ✨</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12.5, fontStyle: 'italic', color: 'rgba(215,200,245,.8)', lineHeight: 1.4 }}>{(en ? s.desc_en : s.desc) || s.desc || ''}</div>
          </div>
        ))}
        {Array.from({ length: unknownSpells }).map((_, i) => (
          <div key={`u${i}`} className="mgc-card mgc-card--unknown" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
            <div style={{ width: 46, height: 46, flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px dashed rgba(150,125,210,.3)', fontSize: 20, color: 'rgba(150,125,210,.4)' }}>?</div>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', var(--font-display), serif", fontWeight: 600, fontSize: 19, color: 'rgba(150,125,210,.45)', letterSpacing: 3 }}>???</div>
              <div style={{ fontSize: 11.5, fontStyle: 'italic', color: 'rgba(150,125,210,.4)' }}>{T('mobile.magic.unknownSpell')}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== DÉ : marques actives (faces bénies/maudites) — page Sorts ===== */}
      {marks.length > 0 && (
        <>
          {section(T('mobile.magic.dieCaps'), marks.length, 6)}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {marks.map((m) => {
              const curse = m.kind === 'curse';
              return (
                <div key={m.slot} className="mgc-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderColor: curse ? 'rgba(200,70,90,.45)' : 'rgba(232,195,74,.45)' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, color: '#0d081d', background: curse ? 'linear-gradient(180deg,#e88a9a,#b8455c)' : 'linear-gradient(180deg,#ffe9a8,#e0b34e)', boxShadow: curse ? '0 0 10px rgba(200,70,90,.5)' : '0 0 10px rgba(232,195,74,.5)' }}>{m.slot}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: curse ? '#f0a9b6' : '#ffe9a8' }}>
                      {curse ? '☠️' : '✨'} {T('mobile.magic.face', { n: m.slot })}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(215,200,245,.75)' }}>
                      {curse ? `−${m.gold || 0}` : `+${m.gold || 0}`} 🪙 {T('mobile.magic.whenItLands')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      </>)}
    </div>
  );
}
