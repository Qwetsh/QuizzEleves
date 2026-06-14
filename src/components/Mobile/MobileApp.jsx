// Companion mobile (lecture seule, Phase 2) : un élève ouvre l'URL d'appairage
// (QR), choisit son équipe, et suit en direct son or, son équipement, son sac
// et ses pouvoirs/charges — y compris pendant le tour adverse. Le TBI publie
// l'état ; ici on ne fait que lire (l'édition viendra en Phase 3).
import { useState, useEffect } from 'react';
import { fetchSession, subscribeSession } from '../../logic/sessionConfig';
import { POWERS } from '../../data/powers';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { itemImg } from '../../logic/itemAssets';
import { describeItemEffects } from '../../logic/effectText';
import '../../styles/mobile.css';

function readInitialCode() {
  const p = new URLSearchParams(window.location.search);
  return (p.get('join') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

const powerKeysOf = (t) => {
  const powers = t.powers || {};
  const { powerDef: d, powerOff: o } = t;
  return [
    ...(d && powers[d] ? [d] : []),
    ...(o && o !== d && powers[o] ? [o] : []),
    ...Object.keys(powers).filter((k) => k !== d && k !== o && POWERS[k]),
  ];
};

function Centered({ children }) {
  return <div className="mob-root mob-center">{children}</div>;
}

function CodeScreen({ code, setCode, error, connecting }) {
  const [val, setVal] = useState(code || '');
  return (
    <div className="mob-root mob-center">
      <div className="mob-logo">{'\u{1F3B2}'}</div>
      <h1 className="mob-title">Quête des Matières</h1>
      <p className="mob-sub">Entre le code affiché sur le tableau</p>
      <input
        className="mob-code-input"
        value={val}
        onChange={(e) => setVal(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
        placeholder="ABCD"
        autoCapitalize="characters"
        inputMode="text"
        maxLength={4}
      />
      <button className="mob-btn mob-btn--gold" disabled={val.length < 4 || connecting}
        onClick={() => setCode(val)}>
        {connecting ? 'Connexion…' : 'Rejoindre'}
      </button>
      {error && <p className="mob-error">{error}</p>}
    </div>
  );
}

function TeamPicker({ session, onPick }) {
  return (
    <div className="mob-root">
      <div className="mob-pick-head">Quelle équipe es-tu ?</div>
      <div className="mob-pick-list">
        {session.teams.map((t) => (
          <button key={t.idx} className="mob-pick-card" style={{ '--accent': t.color }} onClick={() => onPick(t.idx)}>
            <span className="mob-pick-emoji" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)` }}>{t.emoji}</span>
            <span className="mob-pick-name" style={{ color: t.color }}>{t.name}</span>
            <span className="mob-pick-coin">{'\u{1FA99}'} {t.money}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EquipSlot({ itemKey, slot, onTap }) {
  const item = ITEMS[itemKey];
  const color = item ? (RARITIES[item.rarity]?.color || '#888') : null;
  return (
    <div className="mob-eq" onClick={item ? () => onTap(itemKey) : undefined} style={item ? { cursor: 'pointer' } : undefined}>
      <span className="mob-eq-icon" style={{
        background: item ? `radial-gradient(circle at 50% 38%, ${color}33, ${color}1a 70%), linear-gradient(160deg,#efe8cf,#ded2ac)` : 'rgba(122,94,58,0.08)',
        border: item ? `1.5px solid ${color}` : '1.5px dashed rgba(122,94,58,0.3)',
      }}>
        {item ? (itemImg(item) ? <img src={itemImg(item)} alt="" /> : <span className="mob-eq-emoji">{item.icon}</span>) : <span className="mob-eq-emoji" style={{ opacity: 0.4 }}>{SLOTS[slot].icon}</span>}
      </span>
      <div className="mob-eq-text">
        <div className="mob-eq-slot">{SLOTS[slot].name}</div>
        <div className="mob-eq-name">{item ? item.name : <em>vide</em>}</div>
        {item && <div className="mob-eq-desc">{item.desc}{describeItemEffects(item).length > 0 ? ' · toucher pour les effets' : ''}</div>}
      </div>
    </div>
  );
}

// Panneau de détail (bottom sheet) au tap d'un objet : desc + EFFETS lisibles.
function ItemSheet({ itemKey, onClose }) {
  const item = ITEMS[itemKey];
  if (!item) return null;
  const color = RARITIES[item.rarity]?.color || '#888';
  const fx = describeItemEffects(item);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,12,4,0.5)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '16px 18px 26px', boxShadow: '0 -10px 30px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ width: 46, height: 46, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 26, flexShrink: 0, background: `radial-gradient(circle at 50% 38%, ${color}33, ${color}1a 70%), linear-gradient(160deg,#efe8cf,#ded2ac)`, border: `1.5px solid ${color}` }}>
            {itemImg(item) ? <img src={itemImg(item)} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} /> : item.icon}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-900)' }}>{item.name}</div>
            <div style={{ fontSize: 12, color }}>{RARITIES[item.rarity]?.name} · {item.slot === 'consumable' ? 'Consommable' : SLOTS[item.slot]?.name}</div>
          </div>
        </div>
        {item.desc && <div style={{ fontSize: 13.5, color: 'var(--ink-700)', marginBottom: 8 }}>{item.desc}</div>}
        {fx.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--ink-800)', lineHeight: 1.5 }}>
            {fx.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
        <button className="mob-btn mob-btn--gold" style={{ marginTop: 16 }} onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

function PowerRow({ powerKey, charges, level }) {
  const info = POWERS[powerKey];
  if (!info) return null;
  return (
    <div className={'mob-power ' + (charges <= 0 ? 'is-empty' : '')} style={{ '--accent': info.color }}>
      <span className="mob-power-disc">{info.icon}</span>
      <div className="mob-power-text">
        <div className="mob-power-name">{info.name} {level > 1 && <span className="mob-power-lvl">Niv.{level}</span>}</div>
        <div className="mob-power-desc">{info.category === 'off' ? 'Attaque' : 'Défense'} · {info.desc}</div>
      </div>
      <span className="mob-power-charges">{charges}</span>
    </div>
  );
}

function TeamView({ session, teamIdx, onSwitch }) {
  const [sheet, setSheet] = useState(null);
  const t = session.teams[teamIdx];
  const myTurn = session.currentTeam === teamIdx && session.status !== 'finished';
  const bagKeys = (t.bag || []).filter((k) => ITEMS[k]);
  const shopKeys = (session.shop || []).filter((k) => ITEMS[k]);
  const pKeys = powerKeysOf(t);
  const totalQ = (t.correct ?? 0) + (t.wrong ?? 0);
  const rate = totalQ ? Math.round((t.correct / totalQ) * 100) : null;

  return (
    <div className="mob-root mob-team" style={{ '--accent': t.color }}>
      <header className="mob-header" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)` }}>
        <span className="mob-header-emoji">{t.emoji}</span>
        <div className="mob-header-info">
          <div className="mob-header-name">{t.name}</div>
          <div className={'mob-turn ' + (myTurn ? 'is-mine' : '')}>
            {session.status === 'finished' ? '🏁 Partie terminée'
              : myTurn ? "▶ C'est ton tour !"
              : `Tour de ${session.teams[session.currentTeam]?.name || '…'}`}
          </div>
        </div>
        <button className="mob-switch" onClick={onSwitch} aria-label="Changer d'équipe">⇄</button>
      </header>

      <div className="mob-statbar">
        <div className="mob-stat mob-stat--coin">{'\u{1FA99}'} <b>{t.money}</b></div>
        <div className="mob-stat mob-stat--good">{'✓'} <b>{t.correct ?? 0}</b></div>
        <div className="mob-stat mob-stat--bad">{'✗'} <b>{t.wrong ?? 0}</b></div>
        {rate !== null && <div className="mob-stat mob-stat--rate">{'◎'} <b>{rate}%</b></div>}
      </div>

      <section className="mob-section">
        <h2 className="mob-section-title">Équipement</h2>
        {Object.keys(SLOTS).map((slot) => <EquipSlot key={slot} itemKey={t.equipment?.[slot]} slot={slot} onTap={setSheet} />)}
      </section>

      <section className="mob-section">
        <h2 className="mob-section-title">Sac {bagKeys.length > 0 && <span className="mob-count">{bagKeys.length}</span>}</h2>
        {bagKeys.length === 0 ? (
          <div className="mob-empty">Sac vide</div>
        ) : (
          <div className="mob-bag">
            {bagKeys.map((k, i) => {
              const item = ITEMS[k];
              return (
                <button key={i} className="mob-bag-item" onClick={() => setSheet(k)} style={{ cursor: 'pointer', border: 'none', font: 'inherit', textAlign: 'left' }}>
                  {itemImg(item) ? <img src={itemImg(item)} alt="" /> : <span className="mob-eq-emoji">{item.icon}</span>}
                  <span className="mob-bag-name">{item.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {shopKeys.length > 0 && (
        <section className="mob-section">
          <h2 className="mob-section-title">{'\u{1F6D2}'} Boutique <span className="mob-count">{shopKeys.length}</span></h2>
          <div className="mob-bag">
            {shopKeys.map((k, i) => {
              const item = ITEMS[k];
              return (
                <button key={i} className="mob-bag-item" onClick={() => setSheet(k)} style={{ cursor: 'pointer', border: 'none', font: 'inherit', textAlign: 'left' }}>
                  {itemImg(item) ? <img src={itemImg(item)} alt="" /> : <span className="mob-eq-emoji">{item.icon}</span>}
                  <span className="mob-bag-name">{item.name}</span>
                  <span className="mob-shop-price">{'\u{1FA99}'} {item.price}</span>
                </button>
              );
            })}
          </div>
          <div className="mob-foot" style={{ marginTop: 6 }}>Achats sur le tableau (lecture seule ici).</div>
        </section>
      )}

      <section className="mob-section">
        <h2 className="mob-section-title">Pouvoirs</h2>
        {pKeys.length === 0 ? <div className="mob-empty">Aucun pouvoir</div>
          : pKeys.map((k) => <PowerRow key={k} powerKey={k} charges={t.powers[k]?.charges ?? 0} level={t.powers[k]?.level ?? 1} />)}
      </section>

      <div className="mob-foot">Lecture seule · l'écran se met à jour en direct</div>

      {sheet && <ItemSheet itemKey={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

export default function MobileApp() {
  const [code, setCode] = useState(readInitialCode());
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [teamIdx, setTeamIdx] = useState(null);

  useEffect(() => {
    if (!code || code.length < 4) return;
    let alive = true;
    setConnecting(true); setError(null); setSession(null);
    fetchSession(code)
      .then((data) => {
        if (!alive) return;
        if (!data) setError('Aucune partie pour ce code.');
        else setSession(data);
        setConnecting(false);
      })
      .catch((e) => { if (alive) { setError(e.message || 'Connexion impossible.'); setConnecting(false); } });
    const unsub = subscribeSession(code, (data) => { if (alive && data) { setSession(data); setError(null); } });
    return () => { alive = false; unsub(); };
  }, [code]);

  useEffect(() => {
    if (!code) return;
    const saved = localStorage.getItem(`quete_mobile_team_${code}`);
    if (saved != null) setTeamIdx(Number(saved));
  }, [code]);

  const chooseTeam = (idx) => {
    setTeamIdx(idx);
    try { localStorage.setItem(`quete_mobile_team_${code}`, String(idx)); } catch { /* mode privé */ }
  };

  if (!code || code.length < 4 || (error && !session)) {
    return <CodeScreen code={code} setCode={setCode} error={error} connecting={connecting} />;
  }
  if (!session) return <Centered>Connexion à la partie {code}…</Centered>;
  if (teamIdx == null || !session.teams?.[teamIdx]) return <TeamPicker session={session} onPick={chooseTeam} />;
  return <TeamView session={session} teamIdx={teamIdx} onSwitch={() => setTeamIdx(null)} />;
}
