// Companion mobile (lecture seule, Phase 2) : un élève ouvre l'URL d'appairage
// (QR), choisit son équipe, et suit en direct son or, son équipement, son sac
// et ses pouvoirs/charges — y compris pendant le tour adverse. Le TBI publie
// l'état ; ici on ne fait que lire (l'édition viendra en Phase 3).
import { useState, useEffect, useRef } from 'react';
import { fetchSession, subscribeSession, fetchLobbyTeams, upsertLobbyTeam, randomToken, sendIntent, createTrade, fetchTrades, setTradeStatus, deleteTrade, subscribeTrades } from '../../logic/sessionConfig';
import { POWERS, MAX_CHARGES } from '../../data/powers';
import { describePowerScale, specSlotForLevel, specOptionsFor, maxPowerLevel, powerUpgradeCost, resolvePowerEffect } from '../../logic/powerEffects';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { SUBJECTS } from '../../data/subjects';
import { RECIPES } from '../../data/recipes';
import { itemImg } from '../../logic/itemAssets';
import { itemEffectLines } from '../../logic/effectText';
import { getTeamEffects } from '../../logic/teamStatus';
import { extOn } from '../../extensions/registry';
import { tFor, setLang } from '../../i18n';
import { locName, locDesc, loc } from '../../i18n/content';
import SetBonusInfo from '../Modals/SetBonusInfo';
import '../../styles/mobile.css';

// Une case de sac : "clé" (1) ou { key, n } (pile). Helpers locaux (mobile léger).
const cellKey = (c) => (c == null ? null : typeof c === 'string' ? c : c.key);
const cellN = (c) => (c == null ? 0 : typeof c === 'string' ? 1 : (c.n || 1));

function readInitialCode() {
  const p = new URLSearchParams(window.location.search);
  return (p.get('join') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

// Liens de test (générés par le TBI) : ?token=<jeton imposé>&claim=<idx> permet
// d'ouvrir une fenêtre déjà propriétaire d'une équipe donnée, sans le lobby.
function readTestParams() {
  const p = new URLSearchParams(window.location.search);
  const claim = p.get('claim');
  return { token: p.get('token') || '', claim: claim != null && claim !== '' ? Number(claim) : null };
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

function CodeScreen({ code, setCode, error, connecting, T = tFor(false) }) {
  const [val, setVal] = useState(code || '');
  return (
    <div className="mob-root mob-center">
      <div className="mob-logo">{'\u{1F3B2}'}</div>
      <h1 className="mob-title">{T('mobile.appTitle')}</h1>
      <p className="mob-sub">{T('mobile.enterCode')}</p>
      <input
        className="mob-code-input"
        value={val}
        onChange={(e) => setVal(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
        placeholder={T('mobile.codePlaceholder')}
        autoCapitalize="characters"
        inputMode="text"
        maxLength={4}
      />
      <button className="mob-btn mob-btn--gold" disabled={val.length < 4 || connecting}
        onClick={() => setCode(val)}>
        {connecting ? T('mobile.connecting') : T('mobile.join')}
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
function LobbyCreateScreen({ code, token, onSubmitted, lv2Mode, englishMode = false }) {
  const T = tFor(englishMode);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [powerDef, setPowerDef] = useState(null);
  const [powerOff, setPowerOff] = useState(null);
  const [lv2, setLv2] = useState('espagnol'); // langue LV2 (si le mode est actif)
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
      await upsertLobbyTeam(code, token, { name: name.trim(), emoji, power_def: powerDef, power_off: powerOff, lv2: lv2Mode ? lv2 : null, ready: true });
      setSubmitted(true);
      onSubmitted?.();
    } catch (e) { setErr(e.message || T('mobile.sendFailed')); }
    setBusy(false);
  };

  if (submitted) {
    return (
      <div className="mob-root mob-center">
        <div className="mob-pick-emoji" style={{ width: 84, height: 84, fontSize: 44, background: 'linear-gradient(135deg,#e8a958,#b8862c)' }}>{emoji}</div>
        <h1 className="mob-title" style={{ marginTop: 12 }}>{name}</h1>
        <p className="mob-sub">{T('mobile.waitingForTeacher')}</p>
        <div className="mob-spinner" style={{ margin: '8px 0 16px' }} />
        <button className="mob-btn mob-btn--ghost" onClick={() => setSubmitted(false)}>{T('mobile.editMyTeam')}</button>
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
            <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', gap: 5, alignItems: 'center' }}><span style={{ fontSize: 17 }}>{p.icon}</span>{locName(p)}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-500)', lineHeight: 1.25, marginTop: 2 }}>{locDesc(p)}</div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="mob-root" style={{ padding: '18px 16px 30px' }}>
      <h1 className="mob-title" style={{ textAlign: 'center' }}>{T('mobile.createTeam')}</h1>
      <p className="mob-sub" style={{ textAlign: 'center', marginBottom: 14 }}>{T('mobile.gameCode', { code })}</p>

      <label className="mob-field-label">{T('mobile.teamName')}</label>
      <input className="mob-text-input" value={name} maxLength={24}
        onChange={(e) => setName(e.target.value)} placeholder={T('mobile.teamNamePlaceholder')} />

      <label className="mob-field-label" style={{ marginTop: 14 }}>{T('mobile.logo')}</label>
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

      <label className="mob-field-label" style={{ marginTop: 16 }}>{T('mobile.defensePower')}</label>
      <PowerGrid list={defPowers} value={powerDef} onPick={setPowerDef} />
      <label className="mob-field-label" style={{ marginTop: 12 }}>{T('mobile.attackPower')}</label>
      <PowerGrid list={offPowers} value={powerOff} onPick={setPowerOff} />

      {lv2Mode && (
        <>
          <label className="mob-field-label" style={{ marginTop: 16 }}>{T('mobile.yourLv2')}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['allemand', T('mobile.german')], ['espagnol', T('mobile.spanish')]].map(([key, label]) => {
              const on = lv2 === key;
              return (
                <button key={key} type="button" onClick={() => setLv2(key)}
                  style={{
                    padding: '10px', borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                    border: `2px solid ${on ? 'var(--gold-600)' : 'rgba(122,94,58,0.25)'}`,
                    background: on ? 'rgba(232,169,88,0.18)' : '#fffefb',
                  }}>{label}</button>
              );
            })}
          </div>
        </>
      )}

      <button className="mob-btn mob-btn--gold" style={{ marginTop: 20 }} disabled={busy || incomplete} onClick={submit}>
        {busy ? T('mobile.sending') : T('mobile.joinGame')}
      </button>
      {incomplete && !busy && (
        <p className="mob-sub" style={{ textAlign: 'center', marginTop: 8, fontSize: 12.5 }}>
          {name.trim().length < 1 ? T('mobile.pickName') : !powerDef ? T('mobile.pickDefense') : T('mobile.pickAttack')}
        </p>
      )}
      {err && <p className="mob-error">{err}</p>}
    </div>
  );
}

function TeamPicker({ session, onPick }) {
  const T = tFor(session?.englishMode);
  return (
    <div className="mob-root">
      <div className="mob-pick-head">{T('mobile.whichTeam')}</div>
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

function EquipSlot({ itemKey, slot, onTap, enchanted = 0, T = tFor(false) }) {
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
        {item && enchanted > 0 && <span className="mob-ench-badge" title={T('mobile.enchantedTitle')}>✦{enchanted > 1 ? enchanted : ''}</span>}
      </span>
      <div className="mob-eq-text">
        <div className="mob-eq-slot">{SLOTS[slot].name}</div>
        <div className="mob-eq-name">{item ? locName(item) : <em>{T('mobile.empty')}</em>}{item && enchanted > 0 && <span style={{ color: '#9b59d0', marginLeft: 6, fontSize: 12 }}>{T('mobile.enchantedBadge')}</span>}</div>
        {item && <div className="mob-eq-desc">{locDesc(item)}{itemEffectLines(item).length > 0 ? T('mobile.tapForEffects') : ''}</div>}
      </div>
    </div>
  );
}

// Panneau de détail (bottom sheet) au tap d'un objet : desc + EFFETS lisibles,
// + actions d'édition (mode téléphone, sur SA propre équipe, hors verrou).
//   loc : { kind:'equip', slot } | { kind:'bag', key } | { kind:'shop' }
function ItemSheet({ itemKey, loc, team, owned, locked, onAction, onClose, T = tFor(false) }) {
  const item = ITEMS[itemKey];
  if (!item) return null;
  const canEdit = owned && !locked && loc && loc.kind !== 'shop';
  const isConsumable = item.slot === 'consumable';
  const color = RARITIES[item.rarity]?.color || '#888';
  // Effet d'un ingrédient caché tant que l'équipe ne l'a pas goûté.
  const fx = itemEffectLines(item, { key: itemKey, knownIngredients: team?.knownIngredients });
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,12,4,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, maxHeight: '82vh', overflowY: 'auto', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderRadius: 22, padding: '18px 18px 20px', boxShadow: '0 16px 44px rgba(0,0,0,0.45)', border: '1px solid rgba(122,94,58,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ width: 46, height: 46, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 26, flexShrink: 0, background: `radial-gradient(circle at 50% 38%, ${color}33, ${color}1a 70%), linear-gradient(160deg,#efe8cf,#ded2ac)`, border: `1.5px solid ${color}` }}>
            {itemImg(item) ? <img src={itemImg(item)} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} /> : item.icon}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-900)' }}>{locName(item)}</div>
            <div style={{ fontSize: 12, color }}>{RARITIES[item.rarity]?.name} · {item.slot === 'consumable' ? T('mobile.consumable') : SLOTS[item.slot]?.name}</div>
          </div>
        </div>
        {item.desc && (
          <div style={{
            fontSize: 14, color: 'var(--ink-600)', fontStyle: 'italic', lineHeight: 1.4,
            margin: '2px 0 12px', paddingLeft: 12, borderLeft: `3px solid ${color}66`,
          }}>{locDesc(item)}</div>
        )}
        {fx.length > 0 && (
          <div style={{
            background: `${color}12`, border: `1px solid ${color}40`,
            borderRadius: 12, padding: '10px 12px', marginTop: 2,
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
              {'⚙️'} {T('mobile.effects')}
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
                {'🛒'} {T('mobile.buyFor', { price: item.price })}
              </button>
              {broke && <div style={{ marginTop: 6, fontSize: 12, color: '#7a1320', textAlign: 'center' }}>{T('mobile.notEnoughGold')}</div>}
              {locked && !broke && <div style={{ marginTop: 6, fontSize: 12, color: '#7a1320', textAlign: 'center' }}>{T('mobile.waitResolution')}</div>}
            </div>
          );
        })()}

        {/* Parchemin (Enchantement) : choisir la pièce équipée à enchanter */}
        {canEdit && item.family === 'parchment' && loc.kind === 'bag' && (() => {
          const ek = (v) => (typeof v === 'string' ? v : v?.key);
          const slots = ['head', 'body', 'feet'].filter((s) => ITEMS[ek(team.equipment?.[s])]);
          return (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 6 }}>{T('mobile.enchantAPiece')}</div>
              {slots.length === 0 ? (
                <div className="mob-empty">{T('mobile.noPieceToEnchant')}</div>
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
              <button className="mob-btn mob-btn--gold" style={{ minWidth: 0, flex: 1 }} onClick={() => onAction('equip', { key: itemKey })}>{T('mobile.equipAction')}</button>
            )}
            {loc.kind === 'equip' && (
              <button className="mob-btn mob-btn--gold" style={{ minWidth: 0, flex: 1 }} onClick={() => onAction('unequip', { slot: loc.slot })}>{T('mobile.stowInBag')}</button>
            )}
            <button className="mob-btn mob-btn--ghost" style={{ minWidth: 0, flex: 1 }}
              onClick={() => (loc.kind === 'equip' ? onAction('sellEquip', { slot: loc.slot }) : onAction('sellBag', { key: itemKey }))}>
              {T('mobile.sellAction')}
            </button>
          </div>
        )}
        {owned && locked && loc && loc.kind !== 'shop' && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: '#7a1320', textAlign: 'center' }}>
            {T('mobile.editLockedTurn')}
          </div>
        )}

        <button className="mob-btn mob-btn--ghost" style={{ marginTop: 14 }} onClick={onClose}>{T('common.close')}</button>
      </div>
    </div>
  );
}

// Bloc d'embranchement (L5/L10) : les 3 voies, la voie choisie mise en avant.
// `level` sert à afficher les renforts de voie (paliers L7/L9) atteints pour la
// voie choisie (slot spec5 uniquement).
function BranchBlock({ powerKey, slot, chosen, reached, level = 1, owned, locked, onChoose, T = tFor(false) }) {
  const options = specOptionsFor(powerKey, slot);
  if (!options.length) return null;
  const canPick = reached && !chosen && owned && !locked;
  const tierLevels = [7, 9];
  return (
    <div className="mob-tt-branch">
      <div className="mob-tt-branch-label">{reached ? (chosen ? T('mobile.pathChosen') : T('mobile.choosePath')) : T('mobile.branching')}</div>
      {options.map((o) => {
        const picked = chosen === o.key;
        const tiers = picked && slot === 'spec5' && o.tierDesc ? loc(o, 'tierDesc') : null;
        return (
          <div key={o.key} role={canPick ? 'button' : undefined}
            onClick={canPick ? () => onChoose(o.key) : undefined}
            style={canPick ? { cursor: 'pointer' } : undefined}
            className={'mob-tt-opt' + (picked ? ' is-picked' : '') + (reached && !chosen ? ' is-open' : '')}>
            <span className="mob-tt-opt-ic">{o.icon}</span>
            <div className="mob-tt-opt-body">
              <div className="mob-tt-opt-name">
                {locName(o)}
                {picked && <span className="mob-tt-tag mob-tt-tag--cur">{T('mobile.chosenTag')}</span>}
                {canPick && <span className="mob-tt-tag mob-tt-tag--cur">{T('mobile.chooseTag')}</span>}
              </div>
              <div className="mob-tt-opt-desc">{locDesc(o)}</div>
              {tiers && tiers.map((td, i) => (
                <div key={i} className={'mob-tt-tier' + (level >= tierLevels[i] ? ' is-on' : '')}>
                  {level >= tierLevels[i] ? '✓ ' : '🔒 '}{td}
                </div>
              ))}
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
function TalentBranch({ powerKey, entry, active, masteryOn, owned, money = 0, locked, onAction, T = tFor(false) }) {
  const info = POWERS[powerKey];
  if (!info) return null;
  const level = entry?.level ?? 1;
  const charges = entry?.charges ?? 0;
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
            {locName(info)}
            {active && <span className="mob-tt-active">{T('mobile.activeTag')}</span>}
          </div>
          <div className="mob-tt-cat">
            {info.category === 'off' ? T('mobile.attack') : T('mobile.defense')} · {T('mobile.levelShort', { level, count })}
          </div>
        </div>
      </div>
      {/* Rangée « charges » : jauge segmentée (max {MAX_CHARGES}) qui se remplit, et
          recharge soignée à droite (désactivée/masquée au max). L'amélioration de
          niveau est portée par le nœud « prochain niveau » plus bas. */}
      <div className="mob-tt-charge">
        <span className="mob-tt-gauge" title={`${charges}/${MAX_CHARGES}`}>
          {Array.from({ length: MAX_CHARGES }, (_, i) => (
            <span key={i} className={'mob-tt-seg' + (i < charges ? ' is-on' : '')} />
          ))}
          <span className="mob-tt-gauge-n">{charges}/{MAX_CHARGES}</span>
        </span>
        {owned && (charges >= MAX_CHARGES ? (
          <span className="mob-tt-charge-full">{T('mobile.chargesFull')}</span>
        ) : (
          <button className="mob-tt-charge-btn"
            disabled={locked || money < rechargePrice}
            onClick={() => onAction('buyPowerCharge', { key: powerKey })}>
            {T('mobile.rechargeBtn', { price: rechargePrice })}
          </button>
        ))}
      </div>
      <div className="mob-tt-track">
        {Array.from({ length: count }, (_, i) => {
          const n = i + 1;
          const state = n < level ? 'done' : n === level ? 'current' : n === level + 1 ? 'next' : 'locked';
          const cost = n >= 2 ? (costs?.[n - 2] ?? null) : null;
          // Description « élève » par niveau si la data en fournit une (incrémentale,
          // sans répéter les acquis), sinon repli sur le résumé d'effet générique.
          const scaleDesc = useTree ? loc(info.tree, 'scaleDesc') : null;
          const desc = useTree
            ? (Array.isArray(scaleDesc) && scaleDesc[i] ? scaleDesc[i] : describePowerScale(powerKey, n, true))
            : locDesc(info.levels[i]);
          const slot = useTree ? specSlotForLevel(n) : null;
          return (
            <div key={n} className={'mob-tt-node is-' + state}>
              <div className="mob-tt-bullet">{state === 'done' ? '✓' : n}</div>
              <div className="mob-tt-node-body">
                <div className="mob-tt-node-top">
                  <span className="mob-tt-lvl">{T('mobile.levelN', { n })}</span>
                  {state === 'current' && <span className="mob-tt-tag mob-tt-tag--cur">{T('mobile.currentLevel')}</span>}
                  {state === 'done' && <span className="mob-tt-tag mob-tt-tag--done">{T('mobile.acquired')}</span>}
                  {/* Prix : sur un niveau verrouillé (info), ou sur le prochain en
                      lecture seule. Quand on possède le pouvoir, le prochain niveau
                      porte un bouton d'amélioration cliquable (avec le prix). */}
                  {(state === 'locked' || (state === 'next' && !owned)) && cost != null && (
                    <span className="mob-tt-tag mob-tt-tag--cost">{'\u{1FA99}'} {cost}</span>
                  )}
                  {slot && <span className="mob-tt-tag mob-tt-tag--branch">{T('mobile.pathTag')}</span>}
                </div>
                <div className="mob-tt-desc">{desc}</div>
                {owned && state === 'next' && nextCost != null && (
                  <button className="mob-tt-upbtn"
                    disabled={locked || money < nextCost}
                    onClick={() => onAction('upgradePower', { key: powerKey })}>
                    {T('mobile.upgradeHere', { cost: nextCost })}
                  </button>
                )}
                {slot && <BranchBlock powerKey={powerKey} slot={slot} chosen={entry?.[slot]} reached={level >= n} level={level}
                  owned={owned} locked={locked} T={T}
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
  const T = tFor(session?.englishMode);
  const t = session.teams[teamIdx];
  const pKeys = powerKeysOf(t);
  const masteryOn = extOn(session.extensions, 'mastery');
  const activeKeys = new Set([t.powerDef, t.powerOff].filter(Boolean));
  const locked = (session.currentTeam === teamIdx && !!session.locked) || session.status === 'finished';
  const act = (type, payload) => { if (owned && code && token) sendIntent(code, token, type, payload).catch(() => {}); };
  // Pouvoirs non encore possédés (déblocables en boutique).
  const lockedPowers = Object.keys(POWERS).filter((k) => POWERS[k] && !t.powers?.[k]);
  // Onglet de pouvoir sélectionné : un onglet par pouvoir possédé, on n'affiche que
  // la branche choisie (plus lisible que la liste à la suite).
  const [selKey, setSelKey] = useState(pKeys[0] || null);
  const activeKey = pKeys.includes(selKey) ? selKey : pKeys[0] || null;
  // Modale « Acheter un nouveau pouvoir » (sélection + achat).
  const [buyOpen, setBuyOpen] = useState(false);
  return (
    <div className="mob-root" style={{ '--accent': t.color, paddingBottom: 76 }}>
      <div className="mob-pick-head">{T('mobile.talentTree')}</div>
      <div className="mob-tt-bank">
        {owned ? (
          <button className="mob-newpow-btn" disabled={lockedPowers.length === 0}
            onClick={() => setBuyOpen(true)}>
            {T('mobile.buyNewPower')}
          </button>
        ) : (
          <span className="mob-tt-hint">{T('mobile.powersReadonly')}</span>
        )}
      </div>
      {pKeys.length === 0 ? (
        <div className="mob-empty" style={{ margin: 14 }}>{T('mobile.noPowerYet')}</div>
      ) : (
        <>
          {pKeys.length > 1 && (
            <div className="mob-ptabs" role="tablist">
              {pKeys.map((k) => {
                const p = POWERS[k];
                if (!p) return null;
                const on = k === activeKey;
                return (
                  <button key={k} role="tab" aria-selected={on}
                    className={'mob-ptab' + (on ? ' is-on' : '')}
                    style={{ '--accent': p.color }} onClick={() => setSelKey(k)}>
                    <span className="mob-ptab-ic">{p.icon}</span>
                    <span className="mob-ptab-name">{locName(p)}</span>
                    {activeKeys.has(k) && <span className="mob-ptab-dot" title={T('mobile.activeTag')} />}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mob-tt">
            {activeKey && (
              <TalentBranch key={activeKey} powerKey={activeKey} entry={t.powers[activeKey]} active={activeKeys.has(activeKey)} masteryOn={masteryOn}
                owned={owned} money={t.money} locked={locked} onAction={act} T={T} />
            )}
            {/* Ultime actif « Échange de place » (Relance L10) : bouton d'intent,
                visible à son tour si la voie est prise et les charges suffisent. */}
            {activeKey === 'relance' && masteryOn && owned && (() => {
              const eff = resolvePowerEffect(t, 'relance', true);
              const cost = eff.swapCost || 5;
              if (!eff.swapWithLeader) return null;
              const myTurn = session.currentTeam === teamIdx;
              const enough = (t.powers.relance?.charges ?? 0) >= cost;
              return (
                <button className="mob-newpow-btn" style={{ marginTop: 4 }}
                  disabled={locked || !myTurn || !enough}
                  onClick={() => act('relanceSwap', {})}>
                  🔄 {T('mobile.relanceSwap', { cost })}
                </button>
              );
            })()}
            {/* Ultime actif « Immunité totale » (Bouclier L10). */}
            {activeKey === 'bouclier' && masteryOn && owned && (() => {
              const eff = resolvePowerEffect(t, 'bouclier', true);
              if (!eff.totalImmune) return null;
              const cost = eff.immuneCost || 5;
              const myTurn = session.currentTeam === teamIdx;
              const enough = (t.powers.bouclier?.charges ?? 0) >= cost;
              const already = (t.totalImmuneTurns ?? 0) > 0;
              return (
                <button className="mob-newpow-btn" style={{ marginTop: 4 }}
                  disabled={locked || !myTurn || !enough || already}
                  onClick={() => act('shieldImmunity', {})}>
                  🛡️ {T('mobile.shieldImmunity', { cost })}
                </button>
              );
            })()}
          </div>
        </>
      )}
      {owned && buyOpen && (
        <BuyPowerSheet powers={lockedPowers} money={t.money ?? 0} locked={locked}
          onBuy={(k) => act('buyPower', { key: k })} onClose={() => setBuyOpen(false)} T={T} />
      )}
    </div>
  );
}

// Modale « Acheter un nouveau pouvoir » : liste les pouvoirs non possédés + achat.
function BuyPowerSheet({ powers, money, locked, onBuy, onClose, T = tFor(false) }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,12,4,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, maxHeight: '82vh', overflowY: 'auto', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderRadius: 22, padding: '18px 18px 20px', boxShadow: '0 16px 44px rgba(0,0,0,0.45)', border: '1px solid rgba(122,94,58,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-900)' }}>{T('mobile.unlockPower')}</div>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#8a6418', whiteSpace: 'nowrap' }}>{money} {'\u{1FA99}'}</span>
        </div>
        {powers.length === 0 ? (
          <div className="mob-empty" style={{ margin: '8px 0' }}>{T('mobile.allPowersOwned')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {powers.map((k) => {
              const p = POWERS[k];
              const broke = money < p.price;
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fffefb', border: '1px solid rgba(122,94,58,0.25)', borderRadius: 12, padding: '8px 10px' }}>
                  <span style={{ fontSize: 24 }}>{p.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{locName(p)}</div>
                    <div style={{ fontSize: 11.5, opacity: 0.7 }}>{p.category === 'off' ? T('mobile.attack') : T('mobile.defense')}</div>
                  </div>
                  <button className="mob-btn mob-btn--gold" style={{ minWidth: 0 }} disabled={locked || broke}
                    onClick={() => onBuy(k)}>{p.price} {'\u{1FA99}'}</button>
                </div>
              );
            })}
          </div>
        )}
        <button className="mob-btn mob-btn--ghost" style={{ width: '100%', marginTop: 14 }} onClick={onClose}>{T('common.close')}</button>
      </div>
    </div>
  );
}

// Onglet « Boutique » : vitrine + achat direct (téléphone propriétaire).
function ShopView({ session, teamIdx, owned, code, token }) {
  const T = tFor(session?.englishMode);
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
      <div className="mob-pick-head">{T('mobile.shop')}</div>
      {!itemsOn ? (
        <div className="mob-empty" style={{ margin: 14 }}>{T('mobile.itemsDisabled')}</div>
      ) : shopKeys.length === 0 ? (
        <div className="mob-empty" style={{ margin: 14 }}>{T('mobile.emptyStall')}</div>
      ) : (
        <section className="mob-section">
          <div className="mob-bag">
            {shopKeys.map((k, i) => {
              const item = ITEMS[k];
              return (
                <button key={i} className="mob-bag-item" onClick={() => setSheet({ itemKey: k, loc: { kind: 'shop' } })} style={{ cursor: 'pointer', border: 'none', font: 'inherit', textAlign: 'left' }}>
                  {itemImg(item) ? <img src={itemImg(item)} alt="" /> : <span className="mob-eq-emoji">{item.icon}</span>}
                  <span className="mob-bag-name">{locName(item)}</span>
                  <span className="mob-shop-price">{'\u{1FA99}'} {item.price}</span>
                </button>
              );
            })}
          </div>
          <div className="mob-foot" style={{ marginTop: 10 }}>
            {owned ? T('mobile.shopHintOwned') : T('mobile.shopHintReadonly')}
          </div>
        </section>
      )}
      {sheet && <ItemSheet itemKey={sheet.itemKey} loc={sheet.loc} team={t} owned={owned} locked={locked} onAction={buy} onClose={() => setSheet(null)} T={T} />}
    </div>
  );
}

function TeamView({ session, teamIdx, owned, code, token }) {
  const T = tFor(session?.englishMode);
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
            {session.status === 'finished' ? T('mobile.gameOver')
              : myTurn ? T('mobile.yourTurn')
              : T('mobile.turnOf', { name: session.teams[session.currentTeam]?.name || '…' })}
          </div>
        </div>
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
              <span key={k} className={'mob-charge' + (ch <= 0 ? ' is-empty' : '')} style={{ '--accent': info.color }} title={`${locName(info)} · ${T.plural('mobile.charges', ch)}`}>
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
        <h2 className="mob-section-title">{T('mobile.equipment')}</h2>
        {Object.keys(SLOTS).map((slot) => <EquipSlot key={slot} itemKey={t.equipment?.[slot]} slot={slot} enchanted={t.enchants?.[slot] || 0} onTap={() => setSheet({ itemKey: t.equipment?.[slot], loc: { kind: 'equip', slot } })} T={T} />)}
      </section>
      )}

      {itemsOn && (
      <section className="mob-section">
        <h2 className="mob-section-title">{T('mobile.bag')} {bagUnits > 0 && <span className="mob-count">{bagUnits}</span>}</h2>
        {bagCells.length === 0 ? (
          <div className="mob-empty">{T('mobile.bagEmpty')}</div>
        ) : (
          <div className="mob-bag">
            {bagCells.map((c, i) => {
              const item = ITEMS[c.key];
              return (
                <button key={i} className="mob-bag-item" onClick={() => setSheet({ itemKey: c.key, loc: { kind: 'bag', key: c.key } })} style={{ cursor: 'pointer', border: 'none', font: 'inherit', textAlign: 'left' }}>
                  {itemImg(item) ? <img src={itemImg(item)} alt="" /> : <span className="mob-eq-emoji">{item.icon}</span>}
                  <span className="mob-bag-name">{locName(item)}{c.n > 1 ? ` ×${c.n}` : ''}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
      )}

      <div className="mob-foot">{owned ? T('mobile.teamFootOwned') : T('mobile.teamFootReadonly')}</div>

      {sheet && <ItemSheet itemKey={sheet.itemKey} loc={sheet.loc} team={t} owned={owned} locked={editLocked} onAction={sendAction} onClose={() => setSheet(null)} T={T} />}
    </div>
  );
}

// Résumé lisible d'un côté de troc (or + objets) — `equipOf(slot)` résout l'item porté.
function tradeSideText(spec, equipOf, T = tFor(false)) {
  const parts = [];
  if (spec?.gold) parts.push(`${spec.gold} 🪙`);
  for (const k of (spec?.bag || [])) if (ITEMS[k]) parts.push(`${ITEMS[k].icon} ${locName(ITEMS[k])}`);
  for (const s of (spec?.equip || [])) { const k = equipOf?.(s); if (k && ITEMS[k]) parts.push(`${ITEMS[k].icon} ${locName(ITEMS[k])}`); }
  return parts.length ? parts.join(' + ') : T('mobile.nothing');
}

// Résumé post-échange (l'équipement a déjà changé de main → on ne peut plus
// résoudre l'item porté ; on compte juste les pièces d'équipement).
function tradeDoneText(spec, T = tFor(false)) {
  const parts = [];
  if (spec?.gold) parts.push(`${spec.gold} 🪙`);
  for (const k of (spec?.bag || [])) if (ITEMS[k]) parts.push(`${ITEMS[k].icon} ${locName(ITEMS[k])}`);
  const eq = (spec?.equip || []).length;
  if (eq) parts.push(T.plural('mobile.equipmentCount', eq));
  return parts.length ? parts.join(' + ') : T('mobile.nothing');
}

// Bandeau de confirmation « échange conclu », du point de vue de mon équipe.
function DealToast({ trade, teamIdx, teams, onClose, T = tFor(false) }) {
  const isTo = trade.to_idx === teamIdx;
  const received = isTo ? trade.give : trade.want;
  const gave = isTo ? trade.want : trade.give;
  const other = teams[isTo ? trade.from_idx : trade.to_idx];
  return (
    <div className="mob-deal-wrap" onClick={onClose}>
      <div className="mob-deal" onClick={(e) => e.stopPropagation()}>
        <div className="mob-deal-emoji">🤝</div>
        <div className="mob-deal-title">{T('mobile.dealDone')}</div>
        <div className="mob-deal-with">{T('mobile.dealWith', { who: other ? `${other.emoji} ${other.name}` : T('mobile.anotherTeam') })}</div>
        <div className="mob-deal-lines">
          <div><span className="mob-deal-plus">{T('mobile.youReceive')}</span> {tradeDoneText(received, T)}</div>
          <div><span className="mob-deal-minus">{T('mobile.youGive')}</span> {tradeDoneText(gave, T)}</div>
        </div>
        <button className="mob-btn mob-btn--gold" style={{ marginTop: 12 }} onClick={onClose}>{T('mobile.great')}</button>
      </div>
    </div>
  );
}

// Ligne d'objet dans le compositeur de troc : bouton de sélection (icône + nom +
// aperçu d'effet en ligne, pour voir d'un coup d'œil ce que fait l'objet) et un
// bouton ⓘ qui ouvre la fiche complète (ItemSheet en lecture seule).
function TradeItemRow({ itemKey, on, worn, onToggle, onInfo, T = tFor(false) }) {
  const item = ITEMS[itemKey];
  if (!item) return null;
  const preview = locDesc(item) || itemEffectLines(item)[0] || '';
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', marginBottom: 6 }}>
      <button type="button" className={'mob-trade-it' + (on ? ' on' : '')} onClick={onToggle}
        style={{ flex: 1, minWidth: 0, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{item.icon}</span>
          <span style={{ fontWeight: 700 }}>{locName(item)}</span>
          {worn && <small style={{ opacity: 0.7 }}>{T('mobile.worn')}</small>}
        </span>
        {preview && (
          <span style={{ fontSize: 11.5, opacity: 0.78, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {preview}
          </span>
        )}
      </button>
      <button type="button" onClick={onInfo} aria-label={T('mobile.itemDetails')}
        style={{ flexShrink: 0, width: 40, borderRadius: 10, border: '1px solid rgba(122,94,58,0.3)', background: '#fffefb', fontSize: 17, cursor: 'pointer' }}>
        ⓘ
      </button>
    </div>
  );
}

// Compositeur de troc : cible + « je donne » (mon inventaire) / « je veux » (le sien).
function TradeComposer({ session, teamIdx, onClose, onSend, initial = null, title, sendLabel }) {
  const T = tFor(session?.englishMode);
  const titleText = title ?? T('mobile.proposeTrade');
  const sendText = sendLabel ?? T('mobile.send');
  const me = session.teams[teamIdx];
  const others = session.teams.map((t, i) => ({ t, i })).filter((x) => x.i !== teamIdx);
  const norm = (s) => ({ gold: s?.gold || 0, bag: [...(s?.bag || [])], equip: [...(s?.equip || [])] });
  const [toIdx, setToIdx] = useState(initial?.toIdx ?? others[0]?.i ?? null);
  const [give, setGive] = useState(norm(initial?.give));
  const [want, setWant] = useState(norm(initial?.want));
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
        <TradeItemRow key={`b${n}`} itemKey={k} on={spec.bag.includes(k)} T={T}
          onToggle={() => toggle(spec, set, 'bag', k)} onInfo={() => setInfo({ itemKey: k, team })} />
      ))}
      {equipSlots(team).map((s) => (
        <TradeItemRow key={`e${s}`} itemKey={team.equipment[s]} worn on={spec.equip.includes(s)} T={T}
          onToggle={() => toggle(spec, set, 'equip', s)} onInfo={() => setInfo({ itemKey: team.equipment[s], team })} />
      ))}
    </div>
  );

  const empty = (s) => !s.gold && !s.bag.length && !s.equip.length;
  return (
   <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,12,4,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, maxHeight: '86vh', overflowY: 'auto', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderRadius: 20, padding: 16, border: '1px solid rgba(122,94,58,0.25)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, textAlign: 'center', marginBottom: 8 }}>{titleText}</div>
        <div className="mob-trade-targets">
          {others.map(({ t, i }) => (
            <button key={i} className={'mob-trade-target' + (toIdx === i ? ' on' : '')} onClick={() => { setToIdx(i); setWant({ gold: 0, bag: [], equip: [] }); }}>
              {t.emoji} {t.name}
            </button>
          ))}
        </div>
        {target && <Panel title={T('mobile.iGive')} team={me} spec={give} set={setGive} />}
        {target && <Panel title={T('mobile.iWantFrom', { who: target.emoji })} team={target} spec={want} set={setWant} />}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="mob-btn mob-btn--gold" style={{ flex: 1, minWidth: 0 }} disabled={toIdx == null || (empty(give) && empty(want))}
            onClick={() => onSend(toIdx, give, want)}>{sendText}</button>
          <button className="mob-btn mob-btn--ghost" style={{ flex: 1, minWidth: 0 }} onClick={onClose}>{T('common.cancel')}</button>
        </div>
      </div>
    </div>
    {info?.itemKey && (
      <ItemSheet itemKey={info.itemKey} loc={null} team={info.team}
        owned={false} locked={false} onAction={() => {}} onClose={() => setInfo(null)} T={T} />
    )}
   </>
  );
}

// Onglet « Troc » : offres reçues / envoyées + compositeur (mode téléphone).
// `trades` est alimenté par l'abonnement partagé de MobileApp (badge + vue).
function TradeView({ session, teamIdx, code, token, trades = [] }) {
  const T = tFor(session?.englishMode);
  const [compose, setCompose] = useState(false);
  const [counter, setCounter] = useState(null); // offre reçue qu'on contre (ou null)
  const me = session.teams[teamIdx];

  const incoming = trades.filter((t) => t.to_idx === teamIdx && t.status === 'pending');
  const outgoing = trades.filter((t) => t.from_idx === teamIdx && t.status === 'pending');
  const nameOf = (i) => session.teams[i] ? `${session.teams[i].emoji} ${session.teams[i].name}` : `#${i}`;
  const equipOfTeam = (i) => (slot) => session.teams[i]?.equipment?.[slot];

  return (
    <div className="mob-root" style={{ '--accent': me.color, paddingBottom: 76 }}>
      <div className="mob-pick-head">{T('mobile.trade')}</div>

      <section className="mob-section">
        <h2 className="mob-section-title">{T('mobile.offersReceived')} {incoming.length > 0 && <span className="mob-count">{incoming.length}</span>}</h2>
        {incoming.length === 0 ? <div className="mob-empty">{T('mobile.noOffer')}</div> : incoming.map((tr) => (
          <div key={tr.id} className="mob-trade-card">
            <div className="mob-trade-from">{T('mobile.from', { who: nameOf(tr.from_idx) })}</div>
            <div className="mob-trade-line"><b>{T('mobile.youReceiveLine')}</b> {tradeSideText(tr.give, equipOfTeam(tr.from_idx), T)}</div>
            <div className="mob-trade-line"><b>{T('mobile.youGiveLine')}</b> {tradeSideText(tr.want, equipOfTeam(teamIdx), T)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="mob-btn mob-btn--gold" style={{ flex: 1, minWidth: 0 }} onClick={() => setTradeStatus(tr.id, 'accepted').catch(() => {})}>{T('mobile.accept')}</button>
              <button className="mob-btn mob-btn--ghost" style={{ flex: 1, minWidth: 0 }} onClick={() => setTradeStatus(tr.id, 'declined').catch(() => {})}>{T('mobile.decline')}</button>
            </div>
            <button className="mob-btn mob-btn--ghost" style={{ width: '100%', marginTop: 6 }} onClick={() => { setCounter(tr); setCompose(true); }}>{T('mobile.counterOffer')}</button>
          </div>
        ))}
      </section>

      <section className="mob-section">
        <h2 className="mob-section-title">{T('mobile.offersSent')} {outgoing.length > 0 && <span className="mob-count">{outgoing.length}</span>}</h2>
        {outgoing.length === 0 ? <div className="mob-empty">{T('mobile.none')}</div> : outgoing.map((tr) => (
          <div key={tr.id} className="mob-trade-card">
            <div className="mob-trade-from">{T('mobile.toWaiting', { who: nameOf(tr.to_idx) })}</div>
            <div className="mob-trade-line"><b>{T('mobile.youGiveLine')}</b> {tradeSideText(tr.give, equipOfTeam(teamIdx), T)}</div>
            <div className="mob-trade-line"><b>{T('mobile.youWantLine')}</b> {tradeSideText(tr.want, equipOfTeam(tr.to_idx), T)}</div>
            <button className="mob-btn mob-btn--ghost" style={{ marginTop: 8 }} onClick={() => deleteTrade(tr.id).catch(() => {})}>{T('common.cancel')}</button>
          </div>
        ))}
      </section>

      <div style={{ padding: '4px 14px 0' }}>
        <button className="mob-btn mob-btn--gold" style={{ width: '100%' }} onClick={() => setCompose(true)}>{T('mobile.proposeTradeBtn')}</button>
      </div>
      <div className="mob-foot">{T('mobile.tradeFoot')}</div>

      {compose && (
        <TradeComposer session={session} teamIdx={teamIdx}
          title={counter ? T('mobile.counterOffer') : T('mobile.proposeTrade')}
          sendLabel={counter ? T('mobile.sendCounterOffer') : T('mobile.send')}
          initial={counter ? { toIdx: counter.from_idx, give: counter.want, want: counter.give } : null}
          onClose={() => { setCompose(false); setCounter(null); }}
          onSend={(toIdx, give, want) => {
            createTrade(code, token, teamIdx, toIdx, give, want).catch(() => {});
            // Contre-proposition : l'offre d'origine est remplacée (refusée).
            if (counter) setTradeStatus(counter.id, 'declined').catch(() => {});
            setCompose(false); setCounter(null);
          }} />
      )}
    </div>
  );
}

// Onglet « Alchimie » : atelier (3 emplacements + distiller) + grimoire (recettes).
function AlchemyView({ session, teamIdx, code, token }) {
  const T = tFor(session?.englishMode);
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
  // Avertissement « sac plein » : la potion distillée va dans le sac. Si le sac
  // est plein ET qu'aucun ingrédient sélectionné n'est à 1 exemplaire (sa case
  // ne se libérera donc pas en le consommant), la potion risque d'être perdue.
  // Indicatif : le store reste l'autorité et annule proprement la fusion.
  const bagFull = (t.bag || []).filter(Boolean).length >= 12;
  const freesCell = slots.some((bi) => bi != null && cellN(t.bag[bi]) <= 1);
  const noRoomRisk = filled === 3 && bagFull && !freesCell;
  const distill = () => {
    if (filled !== 3 || busy) return;
    setBusy(true);
    sendIntent(code, token, 'craft', { bag: slots.filter((x) => x != null) }).catch(() => {});
    setTimeout(() => { setSlots([null, null, null]); setBusy(false); }, 1400);
  };

  return (
    <div className="mob-root" style={{ '--accent': t.color, paddingBottom: 76 }}>
      <div className="mob-pick-head">{T('mobile.alchemy')}</div>

      <section className="mob-section">
        <h2 className="mob-section-title">{T('mobile.workshop')}</h2>
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
          {busy ? T('mobile.distilling') : T('mobile.distill')}
        </button>
        {noRoomRisk && <div className="mob-alch-warn" style={{ marginTop: 8, fontSize: 13, color: '#c0392b', fontWeight: 600, textAlign: 'center' }}>{T('mobile.bagFull')}</div>}

        <div className="mob-alch-bag">
          {bagIngredients.length === 0
            ? <div className="mob-empty">{T('mobile.noIngredient')}</div>
            : bagIngredients.map(({ i, key }) => (
              <button key={i} className={'mob-alch-ing' + (slots.includes(i) ? ' picked' : '')} onClick={() => toggle(i)}>
                <span style={{ fontSize: 20 }}>{ITEMS[key].icon}</span>
                <span className="mob-alch-ing-name">{locName(ITEMS[key])}{cellN(t.bag[i]) > 1 ? ` ×${cellN(t.bag[i])}` : ''}</span>
                <small style={known.has(key) ? undefined : { opacity: 0.6, fontStyle: 'italic' }}>
                  {itemEffectLines(ITEMS[key], { key, knownIngredients: t.knownIngredients }).join(' · ')}
                </small>
              </button>
            ))}
        </div>
      </section>

      <section className="mob-section">
        <h2 className="mob-section-title">{T('mobile.grimoire')} <span className="mob-count">{knownRec.size}/{RECIPES.length}</span></h2>
        {/* Avec ~1140 recettes, on n'affiche QUE celles déjà découvertes. */}
        {knownRec.size === 0 && <div className="mob-empty">{T('mobile.noRecipe')}</div>}
        {RECIPES.filter((r) => knownRec.has(r.id)).map((r) => (
          <div key={r.id} className="mob-alch-recipe found">
            <span>{r.ingredients.map((k) => ITEMS[k]?.icon || '?').join(' + ')}</span>
            <span className="mob-alch-arrow">→</span>
            <span>{ITEMS[r.potion]?.icon} <b>{ITEMS[r.potion] ? locName(ITEMS[r.potion]) : ''}</b></span>
          </div>
        ))}
      </section>

      <div className="mob-foot">{T('mobile.alchemyFoot')}</div>
    </div>
  );
}

// Onglet Historique : le journal publié par le TBI, du plus récent au plus ancien.
// Onglet « Historique » : deux sous-onglets — « Journal d'info » (le log de partie)
// et « Questions » (mes anciennes questions). Réunit ce qui était deux onglets.
function HistoryView({ session, teamIdx }) {
  const T = tFor(session?.englishMode);
  const [sub, setSub] = useState('log');
  return (
    <div className="mob-root" style={{ paddingBottom: 76 }}>
      <div className="mob-pick-head">{T('mobile.history')}</div>
      <div className="mob-subtabs" role="tablist">
        <button role="tab" aria-selected={sub === 'log'} onClick={() => setSub('log')}
          className={'mob-subtab' + (sub === 'log' ? ' is-on' : '')}>{T('mobile.histLog')}</button>
        <button role="tab" aria-selected={sub === 'questions'} onClick={() => setSub('questions')}
          className={'mob-subtab' + (sub === 'questions' ? ' is-on' : '')}>{T('mobile.histQuestions')}</button>
      </div>
      {sub === 'log'
        ? <LogList session={session} T={T} />
        : <OldQuestionsList session={session} teamIdx={teamIdx} T={T} />}
    </div>
  );
}

// Sous-onglet « Journal d'info » : le log de partie publié par le TBI.
function LogList({ session, T = tFor(false) }) {
  const log = session.log || [];
  if (log.length === 0) return <div className="mob-empty" style={{ margin: 14 }}>{T('mobile.nothingYet')}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 14px' }}>
      {log.slice().reverse().map((line, i) => (
        <div key={i} style={{
          padding: '9px 12px', borderRadius: 10, fontSize: 13.5, lineHeight: 1.4,
          background: i === 0 ? 'rgba(232,177,23,0.14)' : 'rgba(122,94,58,0.06)',
          border: '1px solid rgba(122,94,58,0.14)', color: 'var(--ink-800, #4a3a1e)',
        }}>{line}</div>
      ))}
    </div>
  );
}

// Sous-onglet « Questions » : les questions passées de MON équipe (publiées par le
// TBI dans session.questionLog), avec ma réponse, la bonne réponse et l'explication.
function OldQuestionsList({ session, teamIdx, T = tFor(false) }) {
  const all = (session.questionLog && session.questionLog[teamIdx]) || [];
  const list = all.slice().reverse(); // plus récente d'abord
  if (list.length === 0) return <div className="mob-empty" style={{ margin: 14 }}>{T('mobile.noQuestionYet')}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 14px' }}>
          {list.map((q, i) => {
            const subj = SUBJECTS[q.subject] || {};
            const result = q.timedOut ? { txt: T('mobile.timedOut'), col: '#8a6418' }
              : q.correct ? { txt: T('mobile.right'), col: '#4f8f3a' }
                : { txt: T('mobile.wrong'), col: '#b5341f' };
            return (
              <div key={i} style={{
                borderRadius: 14, overflow: 'hidden',
                border: '1px solid rgba(122,94,58,0.2)', background: '#fffefb',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  background: (subj.colorSoft || 'rgba(122,94,58,0.1)'),
                  fontWeight: 700, fontSize: 13.5, color: 'var(--ink-800,#4a3a1e)',
                }}>
                  <span>{subj.icon || '•'}</span>
                  <span>{locName(subj) || q.subject}</span>
                  <span style={{ marginLeft: 'auto', color: result.col, fontSize: 13 }}>{result.txt}</span>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.35, marginBottom: 8 }}>{q.qText}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(q.answers || []).map((a, idx) => {
                      const isCorrect = idx === q.correctIndex;
                      const isMine = idx === q.chosenIndex;
                      const wrongMine = isMine && !isCorrect;
                      return (
                        <div key={idx} style={{
                          fontSize: 14, padding: '6px 10px', borderRadius: 8,
                          background: isCorrect ? 'rgba(79,143,58,0.16)' : wrongMine ? 'rgba(181,52,31,0.12)' : 'transparent',
                          border: isMine ? '1.5px solid rgba(122,94,58,0.4)' : '1px solid transparent',
                          color: isCorrect ? '#33691e' : wrongMine ? '#922' : 'var(--ink-700,#4a3618)',
                          fontWeight: isCorrect ? 700 : 500,
                        }}>
                          {isCorrect ? '✓ ' : wrongMine ? '✗ ' : '• '}{a}
                          {isMine && <span style={{ fontSize: 11, opacity: 0.7 }}> {T('mobile.yourAnswer')}</span>}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && (
                    <div style={{
                      marginTop: 8, fontSize: 13.5, lineHeight: 1.45, padding: '8px 10px',
                      background: 'rgba(199,145,32,0.1)', borderRadius: 8, color: 'var(--ink-700,#4a3618)',
                    }}><b>{T('mobile.explanation')}</b> {q.explanation}</div>
                  )}
                </div>
              </div>
            );
          })}
    </div>
  );
}

// Sélecteur d'objet (admin) : recherche + grille de tout le catalogue.
function AdminItemPicker({ onPick, onClose, T = tFor(false) }) {
  const [q, setQ] = useState('');
  const keys = Object.keys(ITEMS).filter((k) => !q || locName(ITEMS[k]).toLowerCase().includes(q.toLowerCase()) || ITEMS[k].name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,12,4,0.55)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '80vh', overflowY: 'auto', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '14px 16px 24px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#8a6418', marginBottom: 8 }}>{T('mobile.giveItem')}</div>
        <input className="mob-text-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T('mobile.searchPlaceholder')} style={{ marginBottom: 10 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {keys.map((k) => {
            const item = ITEMS[k];
            const color = RARITIES[item.rarity]?.color || '#888';
            return (
              <button key={k} onClick={() => onPick(k)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, border: `1.5px solid ${color}55`, background: '#fffefb', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 30, height: 30, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 18 }}>{itemImg(item) ? <img src={itemImg(item)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : item.icon}</span>
                <span style={{ fontSize: 12, lineHeight: 1.2, minWidth: 0 }}>{locName(item)}</span>
              </button>
            );
          })}
        </div>
        <button className="mob-btn mob-btn--ghost" style={{ marginTop: 14 }} onClick={onClose}>{T('common.cancel')}</button>
      </div>
    </div>
  );
}

// Interface ADMINISTRATEUR (prof) : contrôle total sur chaque équipe (or,
// équipement, sac). Envoie des intents 'admin*' que le TBI applique sans verrou.
function AdminPanel({ code, session, onClose }) {
  const T = tFor(session?.englishMode);
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
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#8a1f2e' }}>{T('mobile.adminTitle', { code })}</div>
        <button className="mob-btn mob-btn--ghost" style={{ minWidth: 0, padding: '8px 16px' }} onClick={onClose}>{T('common.close')}</button>
      </div>

      {teams.length === 0 && <div className="mob-empty">{T('mobile.noTeamYet')}</div>}

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
              <button onClick={() => { const v = window.prompt(T('mobile.editGoldPrompt')); const d = parseInt(v, 10); if (!Number.isNaN(d)) send('adminMoney', { teamIdx: t.idx, delta: d }); }}
                style={{ padding: '6px 10px', borderRadius: 9, border: '1.5px solid rgba(122,94,58,0.3)', background: '#fffdf7', cursor: 'pointer', fontFamily: 'var(--font-display)' }}>💰…</button>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', marginBottom: 4 }}>{T('mobile.equipmentCaps')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {equipped.length === 0 ? <span style={{ fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic' }}>{T('mobile.nothing')}</span>
                : equipped.map((s) => {
                  const it = ITEMS[t.equipment[s]];
                  return (
                    <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 999, background: 'rgba(122,94,58,0.08)', border: '1px solid rgba(122,94,58,0.25)', fontSize: 12 }}>
                      {it.icon} {locName(it)}
                      <button onClick={() => send('adminRemoveEquip', { teamIdx: t.idx, slot: s })} style={{ border: 'none', background: '#f7d7d2', color: '#7a1320', borderRadius: 6, cursor: 'pointer', fontWeight: 700, padding: '0 5px' }}>✕</button>
                    </span>
                  );
                })}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', marginBottom: 4 }}>{T('mobile.bagCaps')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {bagCells.length === 0 ? <span style={{ fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic' }}>{T('mobile.empty')}</span>
                : bagCells.map((c, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 999, background: 'rgba(122,94,58,0.08)', border: '1px solid rgba(122,94,58,0.25)', fontSize: 12 }}>
                    {ITEMS[c.key].icon} {locName(ITEMS[c.key])}{c.n > 1 ? ` ×${c.n}` : ''}
                    <button onClick={() => send('adminRemoveBag', { teamIdx: t.idx, key: c.key })} style={{ border: 'none', background: '#f7d7d2', color: '#7a1320', borderRadius: 6, cursor: 'pointer', fontWeight: 700, padding: '0 5px' }}>✕</button>
                  </span>
                ))}
            </div>

            <button className="mob-btn mob-btn--gold" style={{ minWidth: 0, padding: '8px 16px', fontSize: 14 }} onClick={() => setPicker(t.idx)}>{T('mobile.giveItemBtn')}</button>
          </div>
        );
      })}

      {picker != null && (
        <AdminItemPicker onPick={(key) => { send('adminGiveItem', { teamIdx: picker, key }); setPicker(null); }} onClose={() => setPicker(null)} T={T} />
      )}
    </div>
  );
}

// Barre d'onglets fixe en bas (Équipe / Pouvoirs / Boutique / Troc / Historique).
function TabBar({ tab, setTab, hasShop, hasTrade, hasAlchemy, tradeAlert = 0, T = tFor(false) }) {
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
      <Tab id="team" icon={'\u{1F6E1}️'} label={T('mobile.tabTeam')} />
      <Tab id="powers" icon={'⚡'} label={T('mobile.tabPowers')} />
      {hasShop && <Tab id="shop" icon={'\u{1F6D2}'} label={T('mobile.tabShop')} />}
      {hasTrade && <Tab id="trade" icon={'🤝'} label={T('mobile.tabTrade')} badge={tradeAlert} />}
      {hasAlchemy && <Tab id="alchemy" icon={'⚗️'} label={T('mobile.tabAlchemy')} />}
      <Tab id="history" icon={'\u{1F4DC}'} label={T('mobile.tabHistory')} />
    </nav>
  );
}

export default function MobileApp() {
  const [code, setCode] = useState(readInitialCode());
  const [session, setSession] = useState(null);
  // Langue globale (getLang) synchronisée avec le mode anglais de la session, pour
  // que les helpers de contenu (effectText, noms) s'affichent dans la bonne langue.
  // SYNCHRONE pendant le rendu (et non dans un effet) : sinon locName/locDesc lus
  // pendant le rendu auraient un cran de retard.
  setLang(session?.englishMode ? 'en' : 'fr');
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [teamIdx, setTeamIdx] = useState(null);
  const [tab, setTab] = useState('team');
  const [token, setToken] = useState(''); // jeton « propriétaire » de l'équipe (mode téléphone)
  const [owned, setOwned] = useState(false); // l'équipe affichée est-elle CELLE du téléphone (édition autorisée)
  const [admin, setAdmin] = useState(false); // interface prof (contrôle total), déverrouillée au triple-tap + code
  const [trades, setTrades] = useState([]); // offres de troc de la session (badge + onglet Troc)
  const [dealToast, setDealToast] = useState(null); // confirmation visuelle d'un échange conclu
  const seenDeals = useRef(null); // ids de trocs déjà « appliqués » connus (évite de re-notifier)
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
    if (window.prompt(tFor(session?.englishMode)('mobile.adminCodePrompt')) === '54150') setAdmin(true);
  };

  // Jeton local par code : permet de retrouver SON équipe (reconnexion / lobby).
  // Lien de test : un jeton imposé par l'URL a priorité (identité distincte par
  // fenêtre, sans dépendre du localStorage partagé entre onglets).
  useEffect(() => {
    if (!code || code.length < 4) return;
    const tp = readTestParams();
    if (tp.token) { setToken(tp.token); return; }
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
        if (!data) setError(tFor(false)('mobile.noGameForCode'));
        else setSession(data);
        setConnecting(false);
      })
      .catch((e) => { if (alive) { setError(e.message || tFor(false)('mobile.connectFailed')); setConnecting(false); } });
    const unsub = subscribeSession(code, (data) => { if (alive && data) { setSession(data); setError(null); } });
    return () => { alive = false; unsub(); };
  }, [code]);

  useEffect(() => {
    if (!code) return;
    if (readTestParams().claim != null) return; // lien de test : l'équipe est réclamée plus bas
    const saved = localStorage.getItem(`quete_mobile_team_${code}`);
    if (saved != null) setTeamIdx(Number(saved));
  }, [code]);

  // Lien de test : réclame l'équipe (?claim=idx) une seule fois → propriété
  // immédiate (achats/troc/édition) sans passer par le lobby.
  const claimedRef = useRef(false);
  useEffect(() => {
    if (claimedRef.current) return;
    const { claim } = readTestParams();
    if (claim == null || !session || session.status === 'lobby' || !token || !code) return;
    if (!session.teams?.[claim]) return;
    claimedRef.current = true;
    sendIntent(code, token, 'claimTeam', { idx: claim }).catch(() => {});
    setTeamIdx(claim);
    setOwned(true);
  }, [session, token, code]);

  const chooseTeam = (idx) => {
    setTeamIdx(idx);
    setOwned(false); // choix manuel (mode tableau) = lecture seule
    try { localStorage.setItem(`quete_mobile_team_${code}`, String(idx)); } catch { /* mode privé */ }
  };

  // Mode téléphone : une fois la partie lancée, retrouve SON équipe via le token
  // (l'index a été écrit dans le lobby au démarrage par le TBI).
  //
  // Ce token est persisté dans localStorage : il reste la SOURCE DE VÉRITÉ de la
  // propriété de l'équipe après un rechargement de page. On NE sort donc PAS si
  // `teamIdx` est déjà connu (restauré depuis localStorage au rechargement) :
  // sinon `owned`, qui n'est jamais persisté, resterait à false et l'élève
  // perdrait l'accès au troc et aux achats. On ne re-dérive que tant que la
  // propriété n'est pas établie (`!owned`), et seulement si l'équipe affichée
  // est bien la sienne — pas une autre équipe choisie en mode tableau.
  useEffect(() => {
    if (!session || session.status === 'lobby' || !token || !code || owned) return;
    let alive = true;
    fetchLobbyTeams(code).then((rows) => {
      if (!alive) return;
      const mine = rows.find((r) => r.token === token && r.idx != null);
      if (!mine || session.teams?.[mine.idx] == null) return;
      // teamIdx == null  → première connexion : on adopte SON équipe.
      // teamIdx === mine → rechargement de SA propre équipe : on restaure l'édition.
      // teamIdx ≠ mine   → une AUTRE équipe est affichée (mode tableau) : on n'y touche pas.
      if (teamIdx == null || teamIdx === mine.idx) {
        setTeamIdx(mine.idx);
        setOwned(true); // équipe créée par CE téléphone → édition autorisée
        try { localStorage.setItem(`quete_mobile_team_${code}`, String(mine.idx)); } catch { /* mode privé */ }
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [session, teamIdx, token, code, owned]);

  // Suivi des trocs : alimente le badge de l'onglet Troc ET la vue Troc
  // (abonnement unique partagé). RÉSERVÉ au propriétaire de l'équipe (`owned`) :
  // accepter/refuser/proposer un troc engage les objets de l'équipe, c'est une
  // action de jeu — un téléphone qui a juste « sélectionné » une autre équipe
  // (mode tableau, owned=false) ne doit pas pouvoir valider à sa place.
  const canTrade = !!(session && session.status !== 'lobby' && teamIdx != null && owned && token && extOn(session.extensions, 'trade'));
  useEffect(() => {
    if (!canTrade || !code) { setTrades([]); return; }
    let alive = true;
    const refresh = () => fetchTrades(code).then((r) => { if (alive) setTrades(r); }).catch(() => {});
    refresh();
    const unsub = subscribeTrades(code, refresh);
    return () => { alive = false; unsub(); };
  }, [canTrade, code]);
  const tradeAlert = trades.filter((t) => t.to_idx === teamIdx && t.status === 'pending').length;

  // Confirmation visuelle : dès qu'un troc impliquant MON équipe passe « applied »,
  // on affiche un bandeau de succès. Au 1er chargement, on mémorise les deals déjà
  // appliqués sans notifier (sinon on rejouerait l'historique à la connexion).
  useEffect(() => {
    if (teamIdx == null) return;
    const mineApplied = trades.filter((t) => t.status === 'applied' && (t.to_idx === teamIdx || t.from_idx === teamIdx));
    if (seenDeals.current === null) { seenDeals.current = new Set(mineApplied.map((t) => t.id)); return; }
    const fresh = mineApplied.find((t) => !seenDeals.current.has(t.id));
    if (fresh) { seenDeals.current.add(fresh.id); setDealToast(fresh); }
  }, [trades, teamIdx]);

  // Auto-fermeture du bandeau de confirmation après quelques secondes.
  useEffect(() => {
    if (!dealToast) return;
    const id = setTimeout(() => setDealToast(null), 4500);
    return () => clearTimeout(id);
  }, [dealToast]);

  const T = tFor(session?.englishMode);
  let content;
  if (!code || code.length < 4 || (error && !session)) {
    content = <CodeScreen code={code} setCode={setCode} error={error} connecting={connecting} T={T} />;
  } else if (!session) {
    content = <Centered>{T('mobile.connectingTo', { code })}</Centered>;
  } else if (session.status === 'lobby') {
    // Lobby (mode téléphone) : l'élève crée son équipe et attend le démarrage.
    content = token ? <LobbyCreateScreen code={code} token={token} lv2Mode={!!session?.lv2Mode} englishMode={!!session?.englishMode} /> : <Centered>{T('mobile.connectingTo', { code })}</Centered>;
  } else if (teamIdx == null || !session.teams?.[teamIdx]) {
    content = <TeamPicker session={session} onPick={chooseTeam} />;
  } else {
    const hasShop = extOn(session.extensions, 'equipment');
    // Troc : RÉSERVÉ au propriétaire de l'équipe (comme les achats). Valider ou
    // proposer un troc engage l'inventaire de l'équipe ; un téléphone qui a
    // seulement « sélectionné » une autre équipe (owned=false) ne peut pas
    // troquer à sa place (sinon il validerait le troc d'un autre groupe).
    const hasTrade = extOn(session.extensions, 'trade') && owned && !!token;
    const hasAlchemy = extOn(session.extensions, 'alchemy') && owned && !!token;
    const view = tab === 'powers' ? <PowersView session={session} teamIdx={teamIdx} owned={owned} code={code} token={token} />
      : tab === 'shop' && hasShop ? <ShopView session={session} teamIdx={teamIdx} owned={owned} code={code} token={token} />
      : tab === 'trade' && hasTrade ? <TradeView session={session} teamIdx={teamIdx} code={code} token={token} trades={trades} />
      : tab === 'alchemy' && hasAlchemy ? <AlchemyView session={session} teamIdx={teamIdx} code={code} token={token} />
      : tab === 'history' ? <HistoryView session={session} teamIdx={teamIdx} />
      : <TeamView session={session} teamIdx={teamIdx} owned={owned} code={code} token={token} />;
    content = (
      <>
        {view}
        <TabBar tab={tab} setTab={setTab} hasShop={hasShop} hasTrade={hasTrade} hasAlchemy={hasAlchemy} tradeAlert={tradeAlert} T={T} />
      </>
    );
  }

  return (
    <>
      {content}
      {/* Zone discrète (coin haut-gauche) : triple-tap + code 54150 → admin. */}
      {code && code.length >= 4 && !admin && (
        <button onClick={onAdminTap} aria-label={T('mobile.adminAccess')}
          style={{ position: 'fixed', top: 0, left: 0, width: 84, height: 46, opacity: 0, zIndex: 70, border: 'none', background: 'transparent' }} />
      )}
      {admin && session && <AdminPanel code={code} session={session} onClose={() => setAdmin(false)} />}
      {dealToast && session?.teams && teamIdx != null && (
        <DealToast trade={dealToast} teamIdx={teamIdx} teams={session.teams} onClose={() => setDealToast(null)} T={T} />
      )}
    </>
  );
}
