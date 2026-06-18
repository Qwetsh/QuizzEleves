// Companion mobile (lecture seule, Phase 2) : un élève ouvre l'URL d'appairage
// (QR), choisit son équipe, et suit en direct son or, son équipement, son sac
// et ses pouvoirs/charges — y compris pendant le tour adverse. Le TBI publie
// l'état ; ici on ne fait que lire (l'édition viendra en Phase 3).
import { useState, useEffect, useRef } from 'react';
import { fetchSession, subscribeSession, fetchLobbyTeams, upsertLobbyTeam, randomToken, sendIntent, createTrade, fetchTrades, setTradeStatus, deleteTrade, subscribeTrades } from '../../logic/sessionConfig';
import { POWERS } from '../../data/powers';
import { describePowerScale, specSlotForLevel, specOptionsFor, maxPowerLevel, powerUpgradeCost } from '../../logic/powerEffects';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { RECIPES } from '../../data/recipes';
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

  const incomplete = name.trim().length < 1 || !powerDef || !powerOff;
  const submit = async () => {
    if (busy || incomplete) return;
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

      <button className="mob-btn mob-btn--gold" style={{ marginTop: 20 }} disabled={busy || incomplete} onClick={submit}>
        {busy ? 'Envoi…' : 'Rejoindre la partie'}
      </button>
      {incomplete && !busy && (
        <p className="mob-sub" style={{ textAlign: 'center', marginTop: 8, fontSize: 12.5 }}>
          {name.trim().length < 1 ? 'Choisis un nom' : !powerDef ? 'Choisis ton pouvoir de défense 🛡️' : 'Choisis ton pouvoir d\'attaque ⚔️'}
        </p>
      )}
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

function EquipSlot({ itemKey, slot, onTap, enchanted = 0 }) {
  const item = ITEMS[itemKey];
  const color = item ? (RARITIES[item.rarity]?.color || '#888') : null;
  return (
    <div className="mob-eq" onClick={item ? () => onTap(itemKey) : undefined} style={item ? { cursor: 'pointer' } : undefined}>
      <span className="mob-eq-icon" style={{
        position: 'relative',
        background: item ? `radial-gradient(circle at 50% 38%, ${color}33, ${color}1a 70%), linear-gradient(160deg,#efe8cf,#ded2ac)` : 'rgba(122,94,58,0.08)',
        border: item ? `1.5px solid ${color}` : '1.5px dashed rgba(122,94,58,0.3)',
      }}>
        {item ? (itemImg(item) ? <img src={itemImg(item)} alt="" /> : <span className="mob-eq-emoji">{item.icon}</span>) : <span className="mob-eq-emoji" style={{ opacity: 0.4 }}>{SLOTS[slot].icon}</span>}
        {item && enchanted > 0 && <span className="mob-ench-badge" title="Enchanté">✦{enchanted > 1 ? enchanted : ''}</span>}
      </span>
      <div className="mob-eq-text">
        <div className="mob-eq-slot">{SLOTS[slot].name}</div>
        <div className="mob-eq-name">{item ? item.name : <em>vide</em>}{item && enchanted > 0 && <span style={{ color: '#9b59d0', marginLeft: 6, fontSize: 12 }}>✦ enchanté</span>}</div>
        {item && <div className="mob-eq-desc">{item.desc}{itemEffectLines(item).length > 0 ? ' · toucher pour les effets' : ''}</div>}
      </div>
    </div>
  );
}

// Panneau de détail (bottom sheet) au tap d'un objet : desc + EFFETS lisibles,
// + actions d'édition (mode téléphone, sur SA propre équipe, hors verrou).
//   loc : { kind:'equip', slot } | { kind:'bag', key } | { kind:'shop' }
function ItemSheet({ itemKey, loc, team, owned, locked, onAction, onClose }) {
  const item = ITEMS[itemKey];
  if (!item) return null;
  const canEdit = owned && !locked && loc && loc.kind !== 'shop';
  const isConsumable = item.slot === 'consumable';
  const color = RARITIES[item.rarity]?.color || '#888';
  const fx = itemEffectLines(item);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,12,4,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, maxHeight: '82vh', overflowY: 'auto', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderRadius: 22, padding: '18px 18px 20px', boxShadow: '0 16px 44px rgba(0,0,0,0.45)', border: '1px solid rgba(122,94,58,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ width: 46, height: 46, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 26, flexShrink: 0, background: `radial-gradient(circle at 50% 38%, ${color}33, ${color}1a 70%), linear-gradient(160deg,#efe8cf,#ded2ac)`, border: `1.5px solid ${color}` }}>
            {itemImg(item) ? <img src={itemImg(item)} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} /> : item.icon}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-900)' }}>{item.name}</div>
            <div style={{ fontSize: 12, color }}>{RARITIES[item.rarity]?.name} · {item.slot === 'consumable' ? 'Consommable' : SLOTS[item.slot]?.name}</div>
          </div>
        </div>
        {item.desc && (
          <div style={{
            fontSize: 14, color: 'var(--ink-600)', fontStyle: 'italic', lineHeight: 1.4,
            margin: '2px 0 12px', paddingLeft: 12, borderLeft: `3px solid ${color}66`,
          }}>{item.desc}</div>
        )}
        {fx.length > 0 && (
          <div style={{
            background: `${color}12`, border: `1px solid ${color}40`,
            borderRadius: 12, padding: '10px 12px', marginTop: 2,
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
              {'⚙️'} Effets
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fx.map((l, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: 'var(--ink-800)', lineHeight: 1.4 }}>
                  <span style={{ color, flexShrink: 0, fontWeight: 700 }}>{'▸'}</span><span>{l}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <SetBonusInfo item={item} team={team} />

        {/* Achat en boutique (téléphone propriétaire de l'équipe) */}
        {loc?.kind === 'shop' && owned && (() => {
          const broke = (team?.money ?? 0) < item.price;
          return (
            <div style={{ marginTop: 14 }}>
              <button className="mob-btn mob-btn--gold" style={{ width: '100%' }} disabled={locked || broke}
                onClick={() => onAction('buy', { key: itemKey })}>
                {'🛒'} Acheter — {item.price} {'\u{1FA99}'}
              </button>
              {broke && <div style={{ marginTop: 6, fontSize: 12, color: '#7a1320', textAlign: 'center' }}>Or insuffisant.</div>}
              {locked && !broke && <div style={{ marginTop: 6, fontSize: 12, color: '#7a1320', textAlign: 'center' }}>🔒 Attends la fin de la résolution.</div>}
            </div>
          );
        })()}

        {/* Parchemin (Enchantement) : choisir la pièce équipée à enchanter */}
        {canEdit && item.family === 'parchment' && loc.kind === 'bag' && (() => {
          const ek = (v) => (typeof v === 'string' ? v : v?.key);
          const slots = ['head', 'body', 'feet'].filter((s) => ITEMS[ek(team.equipment?.[s])]);
          return (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 6 }}>{'📜'} Enchanter une pièce :</div>
              {slots.length === 0 ? (
                <div className="mob-empty">Aucune pièce équipée à enchanter.</div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {slots.map((s) => {
                    const it = ITEMS[ek(team.equipment[s])];
                    return (
                      <button key={s} className="mob-btn mob-btn--gold" style={{ minWidth: 0, flex: 1 }} onClick={() => onAction('enchant', { key: itemKey, slot: s })}>
                        {it.icon} {SLOTS[s].name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Actions d'édition (sa propre équipe, hors résolution) */}
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {loc.kind === 'bag' && !isConsumable && (
              <button className="mob-btn mob-btn--gold" style={{ minWidth: 0, flex: 1 }} onClick={() => onAction('equip', { key: itemKey })}>🛡️ Équiper</button>
            )}
            {loc.kind === 'equip' && (
              <button className="mob-btn mob-btn--gold" style={{ minWidth: 0, flex: 1 }} onClick={() => onAction('unequip', { slot: loc.slot })}>🎒 Mettre au sac</button>
            )}
            <button className="mob-btn mob-btn--ghost" style={{ minWidth: 0, flex: 1 }}
              onClick={() => (loc.kind === 'equip' ? onAction('sellEquip', { slot: loc.slot }) : onAction('sellBag', { key: itemKey }))}>
              ♻️ Vendre
            </button>
          </div>
        )}
        {owned && locked && loc && loc.kind !== 'shop' && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: '#7a1320', textAlign: 'center' }}>
            🔒 Édition impossible pendant ton tour de jeu.
          </div>
        )}

        <button className="mob-btn mob-btn--ghost" style={{ marginTop: 14 }} onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

// Bloc d'embranchement (L5/L10) : les 3 voies, la voie choisie mise en avant.
function BranchBlock({ powerKey, slot, chosen, reached, owned, locked, onChoose }) {
  const options = specOptionsFor(powerKey, slot);
  if (!options.length) return null;
  const canPick = reached && !chosen && owned && !locked;
  return (
    <div className="mob-tt-branch">
      <div className="mob-tt-branch-label">{reached ? (chosen ? 'Voie choisie' : 'Choisis ta voie') : 'Embranchement'}</div>
      {options.map((o) => {
        const picked = chosen === o.key;
        return (
          <div key={o.key} role={canPick ? 'button' : undefined}
            onClick={canPick ? () => onChoose(o.key) : undefined}
            style={canPick ? { cursor: 'pointer' } : undefined}
            className={'mob-tt-opt' + (picked ? ' is-picked' : '') + (reached && !chosen ? ' is-open' : '')}>
            <span className="mob-tt-opt-ic">{o.icon}</span>
            <div className="mob-tt-opt-body">
              <div className="mob-tt-opt-name">
                {o.name}
                {picked && <span className="mob-tt-tag mob-tt-tag--cur"> choisie</span>}
                {canPick && <span className="mob-tt-tag mob-tt-tag--cur"> ✔ choisir</span>}
              </div>
              <div className="mob-tt-opt-desc">{o.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Une « branche » d'arbre de talent pour un pouvoir. Avec l'extension Maîtrise :
// 10 niveaux + embranchements L5/L10. Sinon : 3 niveaux classiques. Lecture seule
// (l'amélioration et le choix de voie se font au TBI).
function TalentBranch({ powerKey, entry, active, masteryOn, owned, money = 0, locked, onAction }) {
  const info = POWERS[powerKey];
  if (!info) return null;
  const level = entry?.level ?? 1;
  const useTree = masteryOn && info.tree;
  const count = useTree ? info.tree.scale.length : (info.levels?.length || 3);
  const costs = useTree ? info.tree.upgradeCosts : info.upgradeCosts;
  const rechargePrice = info.price || 15;
  const nextCost = level < count ? powerUpgradeCost(powerKey, level, masteryOn) : null;
  return (
    <div className="mob-tt-card" style={{ '--accent': info.color }}>
      <div className="mob-tt-head">
        <span className="mob-tt-disc">{info.icon}</span>
        <div className="mob-tt-headtxt">
          <div className="mob-tt-name">
            {info.name}
            {active && <span className="mob-tt-active">{'✦'} actif</span>}
          </div>
          <div className="mob-tt-cat">
            {info.category === 'off' ? `${'⚔️'} Attaque` : `${'\u{1F6E1}️'} Défense`} · Niv. {level}/{count}
          </div>
        </div>
      </div>
      {owned && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button className="mob-btn mob-btn--gold" style={{ flex: 1, minWidth: 0 }}
            disabled={locked || money < rechargePrice}
            onClick={() => onAction('buyPowerCharge', { key: powerKey })}>
            {'\u{1F50B}'} +1 · {rechargePrice} {'\u{1FA99}'}
          </button>
          {nextCost != null ? (
            <button className="mob-btn mob-btn--gold" style={{ flex: 1, minWidth: 0 }}
              disabled={locked || money < nextCost}
              onClick={() => onAction('upgradePower', { key: powerKey })}>
              {'⬆️'} Niv.{level + 1} · {nextCost} {'\u{1FA99}'}
            </button>
          ) : (
            <span style={{ flex: 1, textAlign: 'center', alignSelf: 'center', fontSize: 12, opacity: 0.6 }}>Niveau max</span>
          )}
        </div>
      )}
      <div className="mob-tt-track">
        {Array.from({ length: count }, (_, i) => {
          const n = i + 1;
          const state = n < level ? 'done' : n === level ? 'current' : n === level + 1 ? 'next' : 'locked';
          const cost = n >= 2 ? (costs?.[n - 2] ?? null) : null;
          const desc = useTree ? describePowerScale(powerKey, n, true) : info.levels[i]?.desc;
          const slot = useTree ? specSlotForLevel(n) : null;
          return (
            <div key={n} className={'mob-tt-node is-' + state}>
              <div className="mob-tt-bullet">{state === 'done' ? '✓' : n}</div>
              <div className="mob-tt-node-body">
                <div className="mob-tt-node-top">
                  <span className="mob-tt-lvl">Niv. {n}</span>
                  {state === 'current' && <span className="mob-tt-tag mob-tt-tag--cur">niveau actuel</span>}
                  {state === 'done' && <span className="mob-tt-tag mob-tt-tag--done">{'✓'} acquis</span>}
                  {(state === 'next' || state === 'locked') && cost != null && (
                    <span className="mob-tt-tag mob-tt-tag--cost">{'\u{1FA99}'} {cost}</span>
                  )}
                  {slot && <span className="mob-tt-tag mob-tt-tag--branch">🌟 voie</span>}
                </div>
                <div className="mob-tt-desc">{desc}</div>
                {slot && <BranchBlock powerKey={powerKey} slot={slot} chosen={entry?.[slot]} reached={level >= n}
                  owned={owned} locked={locked}
                  onChoose={(specKey) => onAction('chooseSpec', { key: powerKey, slot, specKey })} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Onglet « Pouvoirs » : arbre de talent par pouvoir + achats (recharge, niveau,
// voie, déblocage) pilotés par le téléphone propriétaire de l'équipe.
function PowersView({ session, teamIdx, owned, code, token }) {
  const t = session.teams[teamIdx];
  const pKeys = powerKeysOf(t);
  const masteryOn = extOn(session.extensions, 'mastery');
  const activeKeys = new Set([t.powerDef, t.powerOff].filter(Boolean));
  const locked = (session.currentTeam === teamIdx && !!session.locked) || session.status === 'finished';
  const act = (type, payload) => { if (owned && code && token) sendIntent(code, token, type, payload).catch(() => {}); };
  // Pouvoirs non encore possédés (déblocables en boutique).
  const lockedPowers = Object.keys(POWERS).filter((k) => POWERS[k] && !t.powers?.[k]);
  return (
    <div className="mob-root" style={{ '--accent': t.color, paddingBottom: 76 }}>
      <div className="mob-pick-head">{'⚡'} Arbre de talents</div>
      <div className="mob-tt-bank">
        <span className="mob-tt-hint">
          {owned ? `${'\u{1FA99}'} ${t.money} — recharge, améliore et débloque tes pouvoirs ici` : 'Achats depuis le téléphone de l’équipe'}
        </span>
      </div>
      {pKeys.length === 0 ? (
        <div className="mob-empty" style={{ margin: 14 }}>Aucun pouvoir pour l'instant…</div>
      ) : (
        <div className="mob-tt">
          {pKeys.map((k) => (
            <TalentBranch key={k} powerKey={k} entry={t.powers[k]} active={activeKeys.has(k)} masteryOn={masteryOn}
              owned={owned} money={t.money} locked={locked} onAction={act} />
          ))}
        </div>
      )}
      {owned && lockedPowers.length > 0 && (
        <section className="mob-section" style={{ marginTop: 8 }}>
          <h2 className="mob-section-title">Débloquer un pouvoir</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px' }}>
            {lockedPowers.map((k) => {
              const p = POWERS[k];
              const broke = (t.money ?? 0) < p.price;
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fffefb', border: '1px solid rgba(122,94,58,0.25)', borderRadius: 12, padding: '8px 10px' }}>
                  <span style={{ fontSize: 22 }}>{p.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, opacity: 0.7 }}>{p.category === 'off' ? `${'⚔️'} Attaque` : `${'\u{1F6E1}️'} Défense`}</div>
                  </div>
                  <button className="mob-btn mob-btn--gold" style={{ minWidth: 0 }} disabled={locked || broke}
                    onClick={() => act('buyPower', { key: k })}>{p.price} {'\u{1FA99}'}</button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// Onglet « Boutique » : vitrine + achat direct (téléphone propriétaire).
function ShopView({ session, teamIdx, owned, code, token }) {
  const [sheet, setSheet] = useState(null);
  const t = session.teams[teamIdx];
  const itemsOn = extOn(session.extensions, 'equipment');
  const shopKeys = itemsOn ? (session.shop || []).filter((k) => ITEMS[k]) : [];
  // Achat bloqué seulement si c'est mon tour ET qu'une résolution est en cours.
  const locked = (session.currentTeam === teamIdx && !!session.locked) || session.status === 'finished';
  const buy = (type, payload) => {
    if (type === 'buy' && owned && code && token) sendIntent(code, token, 'buyItem', payload).catch(() => {});
    setSheet(null);
  };
  return (
    <div className="mob-root" style={{ '--accent': t.color, paddingBottom: 76 }}>
      <div className="mob-pick-head">{'\u{1F6D2}'} Boutique</div>
      {!itemsOn ? (
        <div className="mob-empty" style={{ margin: 14 }}>Objets désactivés pour cette partie.</div>
      ) : shopKeys.length === 0 ? (
        <div className="mob-empty" style={{ margin: 14 }}>Étal vide pour l'instant…</div>
      ) : (
        <section className="mob-section">
          <div className="mob-bag">
            {shopKeys.map((k, i) => {
              const item = ITEMS[k];
              return (
                <button key={i} className="mob-bag-item" onClick={() => setSheet({ itemKey: k, loc: { kind: 'shop' } })} style={{ cursor: 'pointer', border: 'none', font: 'inherit', textAlign: 'left' }}>
                  {itemImg(item) ? <img src={itemImg(item)} alt="" /> : <span className="mob-eq-emoji">{item.icon}</span>}
                  <span className="mob-bag-name">{item.name}</span>
                  <span className="mob-shop-price">{'\u{1FA99}'} {item.price}</span>
                </button>
              );
            })}
          </div>
          <div className="mob-foot" style={{ marginTop: 10 }}>
            {owned ? 'Touche un objet pour voir ses effets et l’acheter.' : 'Lecture seule · achats depuis le téléphone de l’équipe.'}
          </div>
        </section>
      )}
      {sheet && <ItemSheet itemKey={sheet.itemKey} loc={sheet.loc} team={t} owned={owned} locked={locked} onAction={buy} onClose={() => setSheet(null)} />}
    </div>
  );
}

function TeamView({ session, teamIdx, onSwitch, owned, code, token }) {
  const [sheet, setSheet] = useState(null);
  const t = session.teams[teamIdx];
  const effects = getTeamEffects(t);
  const myTurn = session.currentTeam === teamIdx && session.status !== 'finished';
  // Édition (mode téléphone, sa propre équipe) : bloquée si la partie est finie
  // ou si c'est mon tour ET qu'une résolution est en cours (verrou publié).
  const editLocked = (myTurn && !!session.locked) || session.status === 'finished';
  const sendAction = (type, payload) => {
    if (code && token) sendIntent(code, token, type, payload).catch(() => {});
    setSheet(null);
  };
  const itemsOn = extOn(session.extensions, 'equipment');
  const bagCells = (t.bag || []).map((c) => ({ key: cellKey(c), n: cellN(c) })).filter((c) => ITEMS[c.key]);
  const bagUnits = bagCells.reduce((s, c) => s + c.n, 0);
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

      {pKeys.length > 0 && (
        <div className="mob-charges">
          {pKeys.map((k) => {
            const info = POWERS[k];
            const ch = t.powers[k]?.charges ?? 0;
            return (
              <span key={k} className={'mob-charge' + (ch <= 0 ? ' is-empty' : '')} style={{ '--accent': info.color }} title={`${info.name} · ${ch} charge${ch > 1 ? 's' : ''}`}>
                <span className="mob-charge-disc">{info.icon}</span><b>{ch}</b>
              </span>
            );
          })}
        </div>
      )}

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
        {Object.keys(SLOTS).map((slot) => <EquipSlot key={slot} itemKey={t.equipment?.[slot]} slot={slot} enchanted={t.enchants?.[slot] || 0} onTap={() => setSheet({ itemKey: t.equipment?.[slot], loc: { kind: 'equip', slot } })} />)}
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
                <button key={i} className="mob-bag-item" onClick={() => setSheet({ itemKey: c.key, loc: { kind: 'bag', key: c.key } })} style={{ cursor: 'pointer', border: 'none', font: 'inherit', textAlign: 'left' }}>
                  {itemImg(item) ? <img src={itemImg(item)} alt="" /> : <span className="mob-eq-emoji">{item.icon}</span>}
                  <span className="mob-bag-name">{item.name}{c.n > 1 ? ` ×${c.n}` : ''}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
      )}

      <div className="mob-foot">{owned ? "Touche un objet pour l'équiper, le ranger ou le vendre" : "Lecture seule · l'écran se met à jour en direct"}</div>

      {sheet && <ItemSheet itemKey={sheet.itemKey} loc={sheet.loc} team={t} owned={owned} locked={editLocked} onAction={sendAction} onClose={() => setSheet(null)} />}
    </div>
  );
}

// Résumé lisible d'un côté de troc (or + objets) — `equipOf(slot)` résout l'item porté.
function tradeSideText(spec, equipOf) {
  const parts = [];
  if (spec?.gold) parts.push(`${spec.gold} 🪙`);
  for (const k of (spec?.bag || [])) if (ITEMS[k]) parts.push(`${ITEMS[k].icon} ${ITEMS[k].name}`);
  for (const s of (spec?.equip || [])) { const k = equipOf?.(s); if (k && ITEMS[k]) parts.push(`${ITEMS[k].icon} ${ITEMS[k].name}`); }
  return parts.length ? parts.join(' + ') : 'rien';
}

// Ligne d'objet dans le compositeur de troc : bouton de sélection (icône + nom +
// aperçu d'effet en ligne, pour voir d'un coup d'œil ce que fait l'objet) et un
// bouton ⓘ qui ouvre la fiche complète (ItemSheet en lecture seule).
function TradeItemRow({ itemKey, on, worn, onToggle, onInfo }) {
  const item = ITEMS[itemKey];
  if (!item) return null;
  const preview = item.desc || itemEffectLines(item)[0] || '';
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', marginBottom: 6 }}>
      <button type="button" className={'mob-trade-it' + (on ? ' on' : '')} onClick={onToggle}
        style={{ flex: 1, minWidth: 0, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{item.icon}</span>
          <span style={{ fontWeight: 700 }}>{item.name}</span>
          {worn && <small style={{ opacity: 0.7 }}>(porté)</small>}
        </span>
        {preview && (
          <span style={{ fontSize: 11.5, opacity: 0.78, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {preview}
          </span>
        )}
      </button>
      <button type="button" onClick={onInfo} aria-label="Détails de l'objet"
        style={{ flexShrink: 0, width: 40, borderRadius: 10, border: '1px solid rgba(122,94,58,0.3)', background: '#fffefb', fontSize: 17, cursor: 'pointer' }}>
        ⓘ
      </button>
    </div>
  );
}

// Compositeur de troc : cible + « je donne » (mon inventaire) / « je veux » (le sien).
function TradeComposer({ session, teamIdx, onClose, onSend }) {
  const me = session.teams[teamIdx];
  const others = session.teams.map((t, i) => ({ t, i })).filter((x) => x.i !== teamIdx);
  const [toIdx, setToIdx] = useState(others[0]?.i ?? null);
  const [give, setGive] = useState({ gold: 0, bag: [], equip: [] });
  const [want, setWant] = useState({ gold: 0, bag: [], equip: [] });
  const [info, setInfo] = useState(null); // { itemKey, team } : fiche d'objet ouverte
  const target = toIdx != null ? session.teams[toIdx] : null;

  const bagKeys = (t) => (t?.bag || []).map((c) => cellKey(c)).filter((k) => ITEMS[k]);
  const equipSlots = (t) => Object.keys(SLOTS).filter((s) => t?.equipment?.[s] && ITEMS[t.equipment[s]]);
  const toggle = (spec, set, field, val) => {
    const arr = spec[field];
    const i = arr.indexOf(val);
    set({ ...spec, [field]: i >= 0 ? arr.filter((_, j) => j !== i) : [...arr, val] });
  };

  const Panel = ({ title, team, spec, set }) => (
    <div className="mob-trade-panel">
      <div className="mob-trade-panel-title">{title}</div>
      <label className="mob-trade-gold">🪙 <input type="number" min="0" max={team?.money ?? 0} value={spec.gold}
        onChange={(e) => set({ ...spec, gold: Math.max(0, Math.min(team?.money ?? 0, Number(e.target.value) || 0)) })} /> / {team?.money ?? 0}</label>
      {bagKeys(team).map((k, n) => (
        <TradeItemRow key={`b${n}`} itemKey={k} on={spec.bag.includes(k)}
          onToggle={() => toggle(spec, set, 'bag', k)} onInfo={() => setInfo({ itemKey: k, team })} />
      ))}
      {equipSlots(team).map((s) => (
        <TradeItemRow key={`e${s}`} itemKey={team.equipment[s]} worn on={spec.equip.includes(s)}
          onToggle={() => toggle(spec, set, 'equip', s)} onInfo={() => setInfo({ itemKey: team.equipment[s], team })} />
      ))}
    </div>
  );

  const empty = (s) => !s.gold && !s.bag.length && !s.equip.length;
  return (
   <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,12,4,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, maxHeight: '86vh', overflowY: 'auto', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderRadius: 20, padding: 16, border: '1px solid rgba(122,94,58,0.25)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, textAlign: 'center', marginBottom: 8 }}>🤝 Proposer un troc</div>
        <div className="mob-trade-targets">
          {others.map(({ t, i }) => (
            <button key={i} className={'mob-trade-target' + (toIdx === i ? ' on' : '')} onClick={() => { setToIdx(i); setWant({ gold: 0, bag: [], equip: [] }); }}>
              {t.emoji} {t.name}
            </button>
          ))}
        </div>
        {target && <Panel title="Je donne" team={me} spec={give} set={setGive} />}
        {target && <Panel title={`Je veux (de ${target.emoji})`} team={target} spec={want} set={setWant} />}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="mob-btn mob-btn--gold" style={{ flex: 1, minWidth: 0 }} disabled={toIdx == null || (empty(give) && empty(want))}
            onClick={() => onSend(toIdx, give, want)}>Envoyer</button>
          <button className="mob-btn mob-btn--ghost" style={{ flex: 1, minWidth: 0 }} onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
    {info?.itemKey && (
      <ItemSheet itemKey={info.itemKey} loc={null} team={info.team}
        owned={false} locked={false} onAction={() => {}} onClose={() => setInfo(null)} />
    )}
   </>
  );
}

// Onglet « Troc » : offres reçues / envoyées + compositeur (mode téléphone).
// `trades` est alimenté par l'abonnement partagé de MobileApp (badge + vue).
function TradeView({ session, teamIdx, code, token, trades = [] }) {
  const [compose, setCompose] = useState(false);
  const me = session.teams[teamIdx];

  const incoming = trades.filter((t) => t.to_idx === teamIdx && t.status === 'pending');
  const outgoing = trades.filter((t) => t.from_idx === teamIdx && t.status === 'pending');
  const nameOf = (i) => session.teams[i] ? `${session.teams[i].emoji} ${session.teams[i].name}` : `#${i}`;
  const equipOfTeam = (i) => (slot) => session.teams[i]?.equipment?.[slot];

  return (
    <div className="mob-root" style={{ '--accent': me.color, paddingBottom: 76 }}>
      <div className="mob-pick-head">{'🤝'} Troc</div>

      <section className="mob-section">
        <h2 className="mob-section-title">Offres reçues {incoming.length > 0 && <span className="mob-count">{incoming.length}</span>}</h2>
        {incoming.length === 0 ? <div className="mob-empty">Aucune offre.</div> : incoming.map((tr) => (
          <div key={tr.id} className="mob-trade-card">
            <div className="mob-trade-from">De {nameOf(tr.from_idx)}</div>
            <div className="mob-trade-line"><b>Tu reçois :</b> {tradeSideText(tr.give, equipOfTeam(tr.from_idx))}</div>
            <div className="mob-trade-line"><b>Tu donnes :</b> {tradeSideText(tr.want, equipOfTeam(teamIdx))}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="mob-btn mob-btn--gold" style={{ flex: 1, minWidth: 0 }} onClick={() => setTradeStatus(tr.id, 'accepted').catch(() => {})}>Accepter</button>
              <button className="mob-btn mob-btn--ghost" style={{ flex: 1, minWidth: 0 }} onClick={() => setTradeStatus(tr.id, 'declined').catch(() => {})}>Refuser</button>
            </div>
          </div>
        ))}
      </section>

      <section className="mob-section">
        <h2 className="mob-section-title">Offres envoyées {outgoing.length > 0 && <span className="mob-count">{outgoing.length}</span>}</h2>
        {outgoing.length === 0 ? <div className="mob-empty">Aucune.</div> : outgoing.map((tr) => (
          <div key={tr.id} className="mob-trade-card">
            <div className="mob-trade-from">À {nameOf(tr.to_idx)} · en attente…</div>
            <div className="mob-trade-line"><b>Tu donnes :</b> {tradeSideText(tr.give, equipOfTeam(teamIdx))}</div>
            <div className="mob-trade-line"><b>Tu veux :</b> {tradeSideText(tr.want, equipOfTeam(tr.to_idx))}</div>
            <button className="mob-btn mob-btn--ghost" style={{ marginTop: 8 }} onClick={() => deleteTrade(tr.id).catch(() => {})}>Annuler</button>
          </div>
        ))}
      </section>

      <div style={{ padding: '4px 14px 0' }}>
        <button className="mob-btn mob-btn--gold" style={{ width: '100%' }} onClick={() => setCompose(true)}>+ Proposer un troc</button>
      </div>
      <div className="mob-foot">Le troc s'applique automatiquement dès que l'autre équipe accepte.</div>

      {compose && (
        <TradeComposer session={session} teamIdx={teamIdx}
          onClose={() => setCompose(false)}
          onSend={(toIdx, give, want) => { createTrade(code, token, teamIdx, toIdx, give, want).catch(() => {}); setCompose(false); }} />
      )}
    </div>
  );
}

// Onglet « Alchimie » : atelier (3 emplacements + distiller) + grimoire (recettes).
function AlchemyView({ session, teamIdx, code, token }) {
  const t = session.teams[teamIdx];
  const [slots, setSlots] = useState([null, null, null]); // positions du sac
  const [busy, setBusy] = useState(false);
  const bagIngredients = (t.bag || []).map((c, i) => ({ i, key: cellKey(c) })).filter((x) => ITEMS[x.key]?.family === 'ingredient');
  const known = new Set(t.knownIngredients || []);
  const knownRec = new Set(t.knownRecipes || []);

  const toggle = (bagIdx) => {
    setSlots((s) => {
      if (s.includes(bagIdx)) return s.map((x) => (x === bagIdx ? null : x));
      const free = s.indexOf(null);
      if (free < 0) return s;
      const ns = [...s]; ns[free] = bagIdx; return ns;
    });
  };
  const filled = slots.filter((x) => x != null).length;
  const distill = () => {
    if (filled !== 3 || busy) return;
    setBusy(true);
    sendIntent(code, token, 'craft', { bag: slots.filter((x) => x != null) }).catch(() => {});
    setTimeout(() => { setSlots([null, null, null]); setBusy(false); }, 1400);
  };

  return (
    <div className="mob-root" style={{ '--accent': t.color, paddingBottom: 76 }}>
      <div className="mob-pick-head">{'⚗️'} Alchimie</div>

      <section className="mob-section">
        <h2 className="mob-section-title">Atelier</h2>
        <div className={'mob-alch-slots' + (busy ? ' is-busy' : '')}>
          {slots.map((bagIdx, n) => {
            const key = bagIdx != null ? cellKey(t.bag[bagIdx]) : null;
            return (
              <button key={n} className={'mob-alch-slot' + (key ? ' on' : '')} onClick={() => { if (bagIdx != null) toggle(bagIdx); }}>
                {key ? <span style={{ fontSize: 28 }}>{ITEMS[key].icon}</span> : <span className="mob-alch-plus">+</span>}
              </button>
            );
          })}
        </div>
        <button className="mob-btn mob-btn--gold" style={{ width: '100%', marginTop: 10 }} disabled={filled !== 3 || busy} onClick={distill}>
          {busy ? '✨ Distillation…' : 'Distiller'}
        </button>

        <div className="mob-alch-bag">
          {bagIngredients.length === 0
            ? <div className="mob-empty">Aucun ingrédient dans ton sac.</div>
            : bagIngredients.map(({ i, key }) => (
              <button key={i} className={'mob-alch-ing' + (slots.includes(i) ? ' picked' : '')} onClick={() => toggle(i)}>
                <span style={{ fontSize: 20 }}>{ITEMS[key].icon}</span>
                <span className="mob-alch-ing-name">{ITEMS[key].name}{cellN(t.bag[i]) > 1 ? ` ×${cellN(t.bag[i])}` : ''}</span>
                {known.has(key) && <small>{ITEMS[key].desc?.replace(/^Ingr[ée]dient\.\s*/i, '')}</small>}
              </button>
            ))}
        </div>
      </section>

      <section className="mob-section">
        <h2 className="mob-section-title">{'📖'} Grimoire <span className="mob-count">{knownRec.size}/{RECIPES.length}</span></h2>
        {RECIPES.map((r) => {
          const found = knownRec.has(r.id);
          return (
            <div key={r.id} className={'mob-alch-recipe' + (found ? ' found' : '')}>
              {found ? (
                <>
                  <span>{r.ingredients.map((k) => ITEMS[k]?.icon || '?').join(' + ')}</span>
                  <span className="mob-alch-arrow">→</span>
                  <span>{ITEMS[r.potion]?.icon} <b>{ITEMS[r.potion]?.name}</b></span>
                </>
              ) : (
                <span className="mob-alch-unknown">? + ? + ? &nbsp;→&nbsp; ?</span>
              )}
            </div>
          );
        })}
      </section>

      <div className="mob-foot">Goûte un ingrédient (carte active en jeu) pour révéler son effet. Combine 3 ingrédients pour découvrir une potion !</div>
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

// Sélecteur d'objet (admin) : recherche + grille de tout le catalogue.
function AdminItemPicker({ onPick, onClose }) {
  const [q, setQ] = useState('');
  const keys = Object.keys(ITEMS).filter((k) => !q || ITEMS[k].name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,12,4,0.55)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '80vh', overflowY: 'auto', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '14px 16px 24px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#8a6418', marginBottom: 8 }}>Donner un objet</div>
        <input className="mob-text-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" style={{ marginBottom: 10 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {keys.map((k) => {
            const item = ITEMS[k];
            const color = RARITIES[item.rarity]?.color || '#888';
            return (
              <button key={k} onClick={() => onPick(k)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, border: `1.5px solid ${color}55`, background: '#fffefb', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 30, height: 30, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 18 }}>{itemImg(item) ? <img src={itemImg(item)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : item.icon}</span>
                <span style={{ fontSize: 12, lineHeight: 1.2, minWidth: 0 }}>{item.name}</span>
              </button>
            );
          })}
        </div>
        <button className="mob-btn mob-btn--ghost" style={{ marginTop: 14 }} onClick={onClose}>Annuler</button>
      </div>
    </div>
  );
}

// Interface ADMINISTRATEUR (prof) : contrôle total sur chaque équipe (or,
// équipement, sac). Envoie des intents 'admin*' que le TBI applique sans verrou.
function AdminPanel({ code, session, onClose }) {
  const [picker, setPicker] = useState(null); // index d'équipe pour le choix d'objet
  const send = (type, payload) => sendIntent(code, 'admin', type, payload).catch(() => {});
  const teams = session.teams || [];

  const MoneyBtn = ({ idx, delta }) => (
    <button onClick={() => send('adminMoney', { teamIdx: idx, delta })}
      style={{ padding: '6px 10px', borderRadius: 9, border: '1.5px solid rgba(122,94,58,0.3)', background: delta >= 0 ? '#e6f3d6' : '#f7d7d2', color: delta >= 0 ? '#2f5a18' : '#7a1320', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)' }}>
      {delta >= 0 ? `+${delta}` : delta}
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'linear-gradient(180deg,#fff7e6,#f0e2c4)', overflowY: 'auto', padding: '14px 14px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#8a1f2e' }}>🛠️ Admin — {code}</div>
        <button className="mob-btn mob-btn--ghost" style={{ minWidth: 0, padding: '8px 16px' }} onClick={onClose}>Fermer</button>
      </div>

      {teams.length === 0 && <div className="mob-empty">Aucune équipe pour l'instant.</div>}

      {teams.map((t) => {
        const equipped = Object.keys(SLOTS).filter((s) => t.equipment?.[s]);
        const bagCells = (t.bag || []).map((c) => ({ key: cellKey(c), n: cellN(c) })).filter((c) => ITEMS[c.key]);
        return (
          <div key={t.idx} style={{ border: `2px solid ${t.color}`, borderRadius: 14, padding: 12, marginBottom: 12, background: '#fffefb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>{t.emoji}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: t.color, flex: 1 }}>{t.name}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{'\u{1FA99}'} {t.money}</span>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <MoneyBtn idx={t.idx} delta={-10} /><MoneyBtn idx={t.idx} delta={-5} />
              <MoneyBtn idx={t.idx} delta={5} /><MoneyBtn idx={t.idx} delta={10} />
              <button onClick={() => { const v = window.prompt("Modifier l'or (ex. 25 ou -15) :"); const d = parseInt(v, 10); if (!Number.isNaN(d)) send('adminMoney', { teamIdx: t.idx, delta: d }); }}
                style={{ padding: '6px 10px', borderRadius: 9, border: '1.5px solid rgba(122,94,58,0.3)', background: '#fffdf7', cursor: 'pointer', fontFamily: 'var(--font-display)' }}>💰…</button>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', marginBottom: 4 }}>ÉQUIPEMENT</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {equipped.length === 0 ? <span style={{ fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic' }}>rien</span>
                : equipped.map((s) => {
                  const it = ITEMS[t.equipment[s]];
                  return (
                    <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 999, background: 'rgba(122,94,58,0.08)', border: '1px solid rgba(122,94,58,0.25)', fontSize: 12 }}>
                      {it.icon} {it.name}
                      <button onClick={() => send('adminRemoveEquip', { teamIdx: t.idx, slot: s })} style={{ border: 'none', background: '#f7d7d2', color: '#7a1320', borderRadius: 6, cursor: 'pointer', fontWeight: 700, padding: '0 5px' }}>✕</button>
                    </span>
                  );
                })}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', marginBottom: 4 }}>SAC</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {bagCells.length === 0 ? <span style={{ fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic' }}>vide</span>
                : bagCells.map((c, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 999, background: 'rgba(122,94,58,0.08)', border: '1px solid rgba(122,94,58,0.25)', fontSize: 12 }}>
                    {ITEMS[c.key].icon} {ITEMS[c.key].name}{c.n > 1 ? ` ×${c.n}` : ''}
                    <button onClick={() => send('adminRemoveBag', { teamIdx: t.idx, key: c.key })} style={{ border: 'none', background: '#f7d7d2', color: '#7a1320', borderRadius: 6, cursor: 'pointer', fontWeight: 700, padding: '0 5px' }}>✕</button>
                  </span>
                ))}
            </div>

            <button className="mob-btn mob-btn--gold" style={{ minWidth: 0, padding: '8px 16px', fontSize: 14 }} onClick={() => setPicker(t.idx)}>🎁 Donner un objet</button>
          </div>
        );
      })}

      {picker != null && (
        <AdminItemPicker onPick={(key) => { send('adminGiveItem', { teamIdx: picker, key }); setPicker(null); }} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}

// Barre d'onglets fixe en bas (Équipe / Pouvoirs / Boutique / Troc / Historique).
function TabBar({ tab, setTab, hasShop, hasTrade, hasAlchemy, tradeAlert = 0 }) {
  const Tab = ({ id, icon, label, badge = 0 }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '8px 0 10px', border: 'none', cursor: 'pointer', font: 'inherit',
        background: 'transparent', color: tab === id ? 'var(--accent, #b8862c)' : '#9a8a6a',
        fontWeight: tab === id ? 800 : 600, fontSize: 12,
        borderTop: tab === id ? '2px solid var(--accent, #b8862c)' : '2px solid transparent',
      }}
    >
      <span style={{ fontSize: 20, position: 'relative' }}>
        {icon}
        {badge > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -10, minWidth: 16, height: 16, padding: '0 4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#d23b2f', color: '#fff', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
            border: '1.5px solid #fffefb', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}>{badge > 9 ? '9+' : badge}</span>
        )}
      </span>{label}
    </button>
  );
  return (
    <nav style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex',
      background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderTop: '1px solid rgba(122,94,58,0.2)',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
    }}>
      <Tab id="team" icon={'\u{1F6E1}️'} label="Équipe" />
      <Tab id="powers" icon={'⚡'} label="Pouvoirs" />
      {hasShop && <Tab id="shop" icon={'\u{1F6D2}'} label="Boutique" />}
      {hasTrade && <Tab id="trade" icon={'🤝'} label="Troc" badge={tradeAlert} />}
      {hasAlchemy && <Tab id="alchemy" icon={'⚗️'} label="Alchi" />}
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
  const [owned, setOwned] = useState(false); // l'équipe affichée est-elle CELLE du téléphone (édition autorisée)
  const [admin, setAdmin] = useState(false); // interface prof (contrôle total), déverrouillée au triple-tap + code
  const [trades, setTrades] = useState([]); // offres de troc de la session (badge + onglet Troc)
  const adminTap = useRef({ n: 0, t: 0 });

  // Triple-tap (< 700 ms) puis code 54150 → ouvre l'interface admin (même code
  // que les outils d'édition du tableau).
  const onAdminTap = () => {
    const now = Date.now();
    const c = adminTap.current;
    if (now - c.t > 700) c.n = 0;
    c.t = now; c.n += 1;
    if (c.n < 3) return;
    c.n = 0;
    if (window.prompt('Code administrateur :') === '54150') setAdmin(true);
  };

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
    setOwned(false); // choix manuel (mode tableau) = lecture seule
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
        setOwned(true); // équipe créée par CE téléphone → édition autorisée
        try { localStorage.setItem(`quete_mobile_team_${code}`, String(mine.idx)); } catch { /* mode privé */ }
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [session, teamIdx, token, code]);

  // Suivi des trocs : alimente le badge de l'onglet Troc ET la vue Troc
  // (abonnement unique partagé). Dès qu'une équipe est sélectionnée (créée au
  // lobby OU choisie à la main), le téléphone peut troquer pour elle — l'appli
  // côté TBI (applyTrade) ne valide que from_idx/to_idx, jamais le jeton.
  const canTrade = !!(session && session.status !== 'lobby' && teamIdx != null && token && extOn(session.extensions, 'trade'));
  useEffect(() => {
    if (!canTrade || !code) { setTrades([]); return; }
    let alive = true;
    const refresh = () => fetchTrades(code).then((r) => { if (alive) setTrades(r); }).catch(() => {});
    refresh();
    const unsub = subscribeTrades(code, refresh);
    return () => { alive = false; unsub(); };
  }, [canTrade, code]);
  const tradeAlert = trades.filter((t) => t.to_idx === teamIdx && t.status === 'pending').length;

  let content;
  if (!code || code.length < 4 || (error && !session)) {
    content = <CodeScreen code={code} setCode={setCode} error={error} connecting={connecting} />;
  } else if (!session) {
    content = <Centered>Connexion à la partie {code}…</Centered>;
  } else if (session.status === 'lobby') {
    // Lobby (mode téléphone) : l'élève crée son équipe et attend le démarrage.
    content = token ? <LobbyCreateScreen code={code} token={token} /> : <Centered>Connexion à la partie {code}…</Centered>;
  } else if (teamIdx == null || !session.teams?.[teamIdx]) {
    content = <TeamPicker session={session} onPick={chooseTeam} />;
  } else {
    const hasShop = extOn(session.extensions, 'equipment');
    // Troc : pour toute équipe sélectionnée (possédée au lobby ou choisie à la
    // main), tant que l'extension est active. Ne dépend plus de `owned` —
    // l'application du troc côté TBI revérifie or/objets, pas le jeton.
    const hasTrade = extOn(session.extensions, 'trade') && !!token;
    const hasAlchemy = extOn(session.extensions, 'alchemy') && owned && !!token;
    const view = tab === 'powers' ? <PowersView session={session} teamIdx={teamIdx} owned={owned} code={code} token={token} />
      : tab === 'shop' && hasShop ? <ShopView session={session} teamIdx={teamIdx} owned={owned} code={code} token={token} />
      : tab === 'trade' && hasTrade ? <TradeView session={session} teamIdx={teamIdx} code={code} token={token} trades={trades} />
      : tab === 'alchemy' && hasAlchemy ? <AlchemyView session={session} teamIdx={teamIdx} code={code} token={token} />
      : tab === 'history' ? <HistoryView session={session} />
      : <TeamView session={session} teamIdx={teamIdx} onSwitch={() => setTeamIdx(null)} owned={owned} code={code} token={token} />;
    content = (
      <>
        {view}
        <TabBar tab={tab} setTab={setTab} hasShop={hasShop} hasTrade={hasTrade} hasAlchemy={hasAlchemy} tradeAlert={tradeAlert} />
      </>
    );
  }

  return (
    <>
      {content}
      {/* Zone discrète (coin haut-gauche) : triple-tap + code 54150 → admin. */}
      {code && code.length >= 4 && !admin && (
        <button onClick={onAdminTap} aria-label="Accès administrateur"
          style={{ position: 'fixed', top: 0, left: 0, width: 84, height: 46, opacity: 0, zIndex: 70, border: 'none', background: 'transparent' }} />
      )}
      {admin && session && <AdminPanel code={code} session={session} onClose={() => setAdmin(false)} />}
    </>
  );
}
