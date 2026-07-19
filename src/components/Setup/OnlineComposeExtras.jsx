// Extras de l'écran de choix des thèmes en LIGNE (montés dans SelectionCassettes,
// gate `onlineMode`) :
//  - SurprisePanel  : mode « Surprise 🎲 » — l'hôte bannit des thèmes + règle le
//                     nombre de voies ; les thèmes sont tirés au hasard au lancement.
//  - SuggestionTray : tiroir flottant des cassettes proposées par les joueurs
//                     (« pourquoi pas celle-là ? »), que l'hôte peut « prendre ».
import React from 'react';

const FONT_DISPLAY = "'Archivo Black', system-ui, sans-serif";
const FONT_UI = "'Hanken Grotesk', system-ui, sans-serif";
const FONT_MONO = "'VT323', monospace";

// --- Panneau « Surprise » (hôte) -------------------------------------------
export function SurprisePanel({ groups, excluded, onToggle, count, setCount, poolCount }) {
  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, letterSpacing: 0.5, color: '#f4e7cc' }}>🎲 Mode Surprise</div>
          <div style={{ fontFamily: FONT_UI, fontSize: 13.5, color: '#cbb694', marginTop: 4, lineHeight: 1.45 }}>
            Les thèmes sont tirés au hasard au lancement (personne ne les choisit).
            Décoche ici ceux que tu ne veux <em>vraiment</em> pas voir tomber.
          </div>
        </div>
        {/* Nombre de voies (thèmes tirés) */}
        <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 1, color: '#e8a13a' }}>NOMBRE DE VOIES</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
            {[3, 4, 5, 6].map((n) => {
              const on = count === n;
              return (
                <button key={n} onClick={() => setCount(n)}
                  style={{ minWidth: 40, fontFamily: FONT_DISPLAY, fontSize: 16, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                    border: '2px solid ' + (on ? '#57c84d' : '#5a4023'), background: on ? '#16331a' : '#3a2c1a',
                    color: on ? '#9be88f' : '#e3d0aa', boxShadow: on ? '0 0 10px rgba(87,200,77,.45)' : 'inset 0 -2px 0 rgba(0,0,0,.4)' }}>
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bandeau récap du pool disponible */}
      <div style={{ flex: '0 0 auto', fontFamily: FONT_MONO, fontSize: 16, letterSpacing: 1,
        color: poolCount >= count ? '#57c84d' : '#e88f8f', border: '2px solid #2a4a22', background: '#162412',
        borderRadius: 8, padding: '8px 12px' }}>
        {poolCount} thème{poolCount > 1 ? 's' : ''} possible{poolCount > 1 ? 's' : ''} dans le tirage
        {poolCount < count && ' — trop d’exclusions pour ce nombre de voies !'}
      </div>

      {/* Grille des thèmes bannissables, par domaine */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
        {groups.map((g) => (
          <div key={g.domain}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: 0.5, color: g.color, marginBottom: 7, textTransform: 'uppercase' }}>
              {g.name}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {g.items.map((it) => {
                const banned = excluded.has(it.key);
                return (
                  <button key={it.key} onClick={() => onToggle(it.key)}
                    title={banned ? 'Réautoriser ce thème' : 'Bannir ce thème du tirage'}
                    style={{ fontFamily: FONT_UI, fontSize: 13, fontWeight: 600, padding: '6px 11px', borderRadius: 999, cursor: 'pointer',
                      border: '2px solid ' + (banned ? '#e14b3a' : '#5a7a4a'),
                      background: banned ? '#3a1713' : '#1c2a16',
                      color: banned ? '#e8a79a' : '#bfe0a8',
                      textDecoration: banned ? 'line-through' : 'none' }}>
                    {banned ? '✗ ' : '✓ '}{it.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Tiroir des suggestions des joueurs (hôte) -----------------------------
export function SuggestionTray({ suggestions, onTake, onDismiss }) {
  if (!suggestions.length) return null;
  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 330, width: 300, maxHeight: '52vh',
      display: 'flex', flexDirection: 'column', background: '#241a10', border: '3px solid #e8a13a',
      borderRadius: 14, boxShadow: '0 18px 46px rgba(0,0,0,.55)', fontFamily: FONT_UI, overflow: 'hidden' }}>
      <div style={{ flex: '0 0 auto', padding: '10px 14px', background: '#1a130b', borderBottom: '2px solid #3a2c1a',
        fontFamily: FONT_DISPLAY, fontSize: 14, letterSpacing: 0.5, color: '#f4e7cc' }}>
        💡 Suggestions des joueurs <span style={{ color: '#e8a13a' }}>({suggestions.length})</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggestions.map((s) => (
          <div key={s.uid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9,
            background: '#3a2e22', border: '2px solid #150f08' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#f4e7cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>« {s.label} »</span>
              {s.name && <span style={{ display: 'block', fontSize: 11.5, color: '#cbb694' }}>par {s.name}</span>}
            </span>
            <button onClick={() => onTake(s)} title="Insérer dans une voie"
              style={{ flex: '0 0 auto', fontFamily: FONT_DISPLAY, fontSize: 12, letterSpacing: 0.3, padding: '6px 9px', borderRadius: 7, cursor: 'pointer',
                border: '2px solid #150f08', background: '#57c84d', color: '#0c2a0a' }}>→ prendre</button>
            <button onClick={() => onDismiss(s.uid)} title="Ignorer"
              style={{ flex: '0 0 auto', width: 26, height: 26, borderRadius: 7, cursor: 'pointer', border: '2px solid #5a4023', background: '#3a1a1d', color: '#e88f8f', fontSize: 13 }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
