// Companion mobile (lecture seule, Phase 2) : un élève ouvre l'URL d'appairage
// (QR), choisit son équipe, et suit en direct son or, son équipement, son sac
// et ses pouvoirs/charges — y compris pendant le tour adverse. Le TBI publie
// l'état ; ici on ne fait que lire (l'édition viendra en Phase 3).
import { useState, useEffect } from 'react';
import { fetchSession, subscribeSession, fetchLobbyTeams, upsertLobbyTeam, randomToken } from '../../logic/sessionConfig';
import { POWERS } from '../../data/powers';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { itemImg } from '../../logic/itemAssets';
import { itemEffectLines } from '../../logic/effectText';
import { getTeamEffects } from '../../logic/teamStatus';
import { extOn } from '../../extensions/registry';
import SetBonusInfo from '../Modals/SetBonusInfo';
import '../../styles/mobile.css';

// Une case de sac : "clé" (1) ou { key, n } (pile). Helpers locaux (mobile léger).
const cellKey = (c) => (c == null ? null : typeof c === 'string' ? c : c.key);
const cellN = (c) => (c == null ? 0 : typeof c === 'string' ? 1 : (c.n || 1));

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

// Palette de logos proposés à la création d'équipe (téléphone).
const EMOJI_CHOICES = ['🦁', '🐯', '🦅', '🐺', '🦊', '🐻', '🐉', '🦄', '🐲', '🦈', '🐙', '🦂', '🐢', '🦉', '🐝', '🦋', '🐶', '🐱', '🐸', '🦖'];

// Écran « crée ton équipe » (mode téléphone, statut lobby). L'élève saisit un
// nom + un logo, et peut choisir ses 2 pouvoirs. À l'envoi, sa fiche est
// poussée dans le lobby (upsert par token) ; il attend que le prof démarre.
function LobbyCreateScreen({ code, token, onSubmitted }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [powerDef, setPowerDef] = useState(null);
  const [powerOff, setPowerOff] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const defPowers = Object.entries(POWERS).filter(([, p]) => p.category !== 'off');
  const offPowers = Object.entries(POWERS).filter(([, p]) => p.category === 'off');

  const submit = async () => {
    if (busy || name.trim().length < 1) return;
    setBusy(true); setErr(null);
    try {
      await upsertLobbyTeam(code, token, { name: name.trim(), emoji, power_def: powerDef, power_off: powerOff, ready: true });
      setSubmitted(true);
      onSubmitted?.();
    } catch (e) { setErr(e.message || 'Envoi impossible'); }
    setBusy(false);
  };

  if (submitted) {
    return (
      <div className="mob-root mob-center">
        <div className="mob-pick-emoji" style={{ width: 84, height: 84, fontSize: 44, background: 'linear-gradient(135deg,#e8a958,#b8862c)' }}>{emoji}</div>
        <h1 className="mob-title" style={{ marginTop: 12 }}>{name}</h1>
        <p className="mob-sub">En attente du prof pour lancer la partie…</p>
        <div className="mob-spinner" style={{ margin: '8px 0 16px' }} />
        <button className="mob-btn mob-btn--ghost" onClick={() => setSubmitted(false)}>Modifier mon équipe</button>
      </div>
    );
  }

  const PowerGrid = ({ list, value, onPick }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {list.map(([key, p]) => {
        const on = value === key;
        return (
          <button key={key} type="button" onClick={() => onPick(on ? null : key)}
            style={{
              textAlign: 'left', padding: '8px 10px', borderRadius: 12, cursor: 'pointer',
              border: `2px solid ${on ? p.color : 'rgba(122,94,58,0.25)'}`,
              background: on ? `${p.color}1f` : '#fffefb',
            }}>
            <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', gap: 5, alignItems: 'center' }}><span style={{ fontSize: 17 }}>{p.icon}</span>{p.name}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-500)', lineHeight: 1.25, marginTop: 2 }}>{p.desc}</div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="mob-root" style={{ padding: '18px 16px 30px' }}>
      <h1 className="mob-title" style={{ textAlign: 'center' }}>Crée ton équipe</h1>
      <p className="mob-sub" style={{ textAlign: 'center', marginBottom: 14 }}>Partie {code}</p>

      <label className="mob-field-label">Nom de l'équipe</label>
      <input className="mob-text-input" value={name} maxLength={24}
        onChange={(e) => setName(e.target.value)} placeholder="Les Lions…" />

      <label className="mob-field-label" style={{ marginTop: 14 }}>Logo</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
        {EMOJI_CHOICES.map((e) => (
          <button key={e} type="button" onClick={() => setEmoji(e)}
            style={{
              fontSize: 24, padding: '6px 0', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${emoji === e ? 'var(--gold-600)' : 'rgba(122,94,58,0.2)'}`,
              background: emoji === e ? 'rgba(232,169,88,0.15)' : '#fffefb',
            }}>{e}</button>
        ))}
      </div>

      <label className="mob-field-label" style={{ marginTop: 16 }}>🛡️ Pouvoir de défense</label>
      <PowerGrid list={defPowers} value={powerDef} onPick={setPowerDef} />
      <label className="mob-field-label" style={{ marginTop: 12 }}>⚔️ Pouvoir d'attaque</label>
      <PowerGrid list={offPowers} value={powerOff} onPick={setPowerOff} />

      <button className="mob-btn mob-btn--gold" style={{ marginTop: 20 }} disabled={busy || name.trim().length < 1} onClick={submit}>
        {busy ? 'Envoi…' : 'Rejoindre la partie'}
      </button>
      {err && <p className="mob-error">{err}</p>}
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
        {item && <div className="mob-eq-desc">{item.desc}{itemEffectLines(item).length > 0 ? ' · toucher pour les effets' : ''}</div>}
      </div>
    </div>
  );
}

// Panneau de détail (bottom sheet) au tap d'un objet : desc + EFFETS lisibles.
function ItemSheet({ itemKey, team, onClose }) {
  const item = ITEMS[itemKey];
  if (!item) return null;
  const color = RARITIES[item.rarity]?.color || '#888';
  const fx = itemEffectLines(item);
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
        <SetBonusInfo item={item} team={team} />
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
  const effects = getTeamEffects(t);
  const myTurn = session.currentTeam === teamIdx && session.status !== 'finished';
  const itemsOn = extOn(session.extensions, 'equipment');
  const bagCells = (t.bag || []).map((c) => ({ key: cellKey(c), n: cellN(c) })).filter((c) => ITEMS[c.key]);
  const bagUnits = bagCells.reduce((s, c) => s + c.n, 0);
  const shopKeys = itemsOn ? (session.shop || []).filter((k) => ITEMS[k]) : [];
  const pKeys = powerKeysOf(t);
  const totalQ = (t.correct ?? 0) + (t.wrong ?? 0);
  const rate = totalQ ? Math.round((t.correct / totalQ) * 100) : null;

  return (
    <div className="mob-root mob-team" style={{ '--accent': t.color, paddingBottom: 76 }}>
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

      {effects.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 14px', marginBottom: 4 }}>
          {effects.map((e) => {
            const malus = e.tone === 'malus';
            return (
              <div key={e.key} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                color: malus ? '#7a1320' : '#3a2e10',
                background: malus ? '#f7d7d2' : `${e.color}22`,
                border: `1.5px solid ${malus ? '#c9472f' : e.color}`,
              }}>
                <span style={{ fontSize: 18 }}>{e.icon}</span>
                <span>{e.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {itemsOn && (
      <section className="mob-section">
        <h2 className="mob-section-title">Équipement</h2>
        {Object.keys(SLOTS).map((slot) => <EquipSlot key={slot} itemKey={t.equipment?.[slot]} slot={slot} onTap={setSheet} />)}
      </section>
      )}

      {itemsOn && (
      <section className="mob-section">
        <h2 className="mob-section-title">Sac {bagUnits > 0 && <span className="mob-count">{bagUnits}</span>}</h2>
        {bagCells.length === 0 ? (
          <div className="mob-empty">Sac vide</div>
        ) : (
          <div className="mob-bag">
            {bagCells.map((c, i) => {
              const item = ITEMS[c.key];
              return (
                <button key={i} className="mob-bag-item" onClick={() => setSheet(c.key)} style={{ cursor: 'pointer', border: 'none', font: 'inherit', textAlign: 'left' }}>
                  {itemImg(item) ? <img src={itemImg(item)} alt="" /> : <span className="mob-eq-emoji">{item.icon}</span>}
                  <span className="mob-bag-name">{item.name}{c.n > 1 ? ` ×${c.n}` : ''}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
      )}

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

      {sheet && <ItemSheet itemKey={sheet} team={t} onClose={() => setSheet(null)} />}
    </div>
  );
}

// Onglet Historique : le journal publié par le TBI, du plus récent au plus ancien.
function HistoryView({ session }) {
  const log = session.log || [];
  return (
    <div className="mob-root" style={{ paddingBottom: 76 }}>
      <div className="mob-pick-head">{'\u{1F4DC}'} Historique</div>
      {log.length === 0 ? (
        <div className="mob-empty" style={{ margin: 14 }}>Rien pour l'instant…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 14px' }}>
          {log.slice().reverse().map((line, i) => (
            <div key={i} style={{
              padding: '9px 12px', borderRadius: 10, fontSize: 13.5, lineHeight: 1.4,
              background: i === 0 ? 'rgba(232,177,23,0.14)' : 'rgba(122,94,58,0.06)',
              border: '1px solid rgba(122,94,58,0.14)', color: 'var(--ink-800, #4a3a1e)',
            }}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// Barre d'onglets fixe en bas (Mon équipe / Historique).
function TabBar({ tab, setTab }) {
  const Tab = ({ id, icon, label }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '8px 0 10px', border: 'none', cursor: 'pointer', font: 'inherit',
        background: 'transparent', color: tab === id ? 'var(--accent, #b8862c)' : '#9a8a6a',
        fontWeight: tab === id ? 800 : 600, fontSize: 12,
        borderTop: tab === id ? '2px solid var(--accent, #b8862c)' : '2px solid transparent',
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>{label}
    </button>
  );
  return (
    <nav style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex',
      background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderTop: '1px solid rgba(122,94,58,0.2)',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
    }}>
      <Tab id="team" icon={'\u{1F6E1}️'} label="Mon équipe" />
      <Tab id="history" icon={'\u{1F4DC}'} label="Historique" />
    </nav>
  );
}

export default function MobileApp() {
  const [code, setCode] = useState(readInitialCode());
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [teamIdx, setTeamIdx] = useState(null);
  const [tab, setTab] = useState('team');
  const [token, setToken] = useState(''); // jeton « propriétaire » de l'équipe (mode téléphone)

  // Jeton local par code : permet de retrouver SON équipe (reconnexion / lobby).
  useEffect(() => {
    if (!code || code.length < 4) return;
    const k = `quete_team_token_${code}`;
    let t = '';
    try { t = localStorage.getItem(k) || ''; } catch { /* mode privé */ }
    if (!t) { t = randomToken(); try { localStorage.setItem(k, t); } catch { /* mode privé */ } }
    setToken(t);
  }, [code]);

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

  // Mode téléphone : une fois la partie lancée, retrouve SON équipe via le token
  // (l'index a été écrit dans le lobby au démarrage par le TBI).
  useEffect(() => {
    if (!session || session.status === 'lobby' || teamIdx != null || !token || !code) return;
    let alive = true;
    fetchLobbyTeams(code).then((rows) => {
      if (!alive) return;
      const mine = rows.find((r) => r.token === token && r.idx != null);
      if (mine && session.teams?.[mine.idx]) {
        setTeamIdx(mine.idx);
        try { localStorage.setItem(`quete_mobile_team_${code}`, String(mine.idx)); } catch { /* mode privé */ }
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [session, teamIdx, token, code]);

  if (!code || code.length < 4 || (error && !session)) {
    return <CodeScreen code={code} setCode={setCode} error={error} connecting={connecting} />;
  }
  if (!session) return <Centered>Connexion à la partie {code}…</Centered>;
  // Lobby (mode téléphone) : l'élève crée son équipe et attend le démarrage.
  if (session.status === 'lobby') {
    return token ? <LobbyCreateScreen code={code} token={token} /> : <Centered>Connexion à la partie {code}…</Centered>;
  }
  if (teamIdx == null || !session.teams?.[teamIdx]) return <TeamPicker session={session} onPick={chooseTeam} />;
  return (
    <>
      {tab === 'team'
        ? <TeamView session={session} teamIdx={teamIdx} onSwitch={() => setTeamIdx(null)} />
        : <HistoryView session={session} />}
      <TabBar tab={tab} setTab={setTab} />
    </>
  );
}
