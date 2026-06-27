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
import { RECIPES, matchRecipe } from '../../data/recipes';
import { itemImg } from '../../logic/itemAssets';
import { itemEffectLines } from '../../logic/effectText';
import { getTeamEffects } from '../../logic/teamStatus';
import { extOn } from '../../extensions/registry';
import { getDieFaces, isFaceForged } from '../../logic/forge';
import { FORGE_EFFECTS, FORGE_FAMILY_COLOR, faceEffectLabel } from '../../logic/forgeEffects';
import FaceTile from '../Game/FaceTile';
import { isDiploTrade, PACT_DEFAULT_TURNS, PACT_MIN_TURNS, PACT_MAX_TURNS } from '../../logic/pacts';
import { tFor, setLang } from '../../i18n';
import { locName, locDesc, loc } from '../../i18n/content';
import SetBonusInfo from '../Modals/SetBonusInfo';
import ScribeView from './ScribeView';
import '../../styles/mobile.css';
import '../../styles/alchemy-mobile.css';

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

// Atelier de forge mobile : acheter des faces (vitrine) puis les poser sur le dé.
function ForgeView({ session, teamIdx, owned, code, token }) {
  const T = tFor(session?.englishMode);
  const en = !!session?.englishMode;
  const t = session.teams[teamIdx];
  const faces = getDieFaces(t);
  const reserve = t.faceStock || [];
  const shopFaces = session.shopFaces || [];
  const locked = (session.currentTeam === teamIdx && !!session.locked) || session.status === 'finished';
  const [sel, setSel] = useState(null);       // index réserve sélectionné
  const [confirm, setConfirm] = useState(null); // { slot } à écraser

  const buy = (i) => { if (owned && !locked && code && token) sendIntent(code, token, 'buyFace', { faceIndex: i }).catch(() => {}); };
  const forge = (slot, stock) => { if (owned && !locked && code && token) sendIntent(code, token, 'forgeFace', { slotIndex: slot, stockIndex: stock }).catch(() => {}); };
  const place = (slot) => {
    if (sel == null || !reserve[sel]) return;
    if (isFaceForged(faces[slot])) { setConfirm({ slot }); return; }
    forge(slot, sel); setSel(null);
  };
  const doConfirm = () => { forge(confirm.slot, sel); setConfirm(null); setSel(null); };

  const colorOf = (f) => { const m = f?.effect?.type ? FORGE_EFFECTS[f.effect.type] : null; return (m && FORGE_FAMILY_COLOR[m.family]) || '#7a5e3a'; };
  const iconOf = (f) => (f?.effect?.type ? FORGE_EFFECTS[f.effect.type]?.icon : null);

  return (
    <div className="mob-root" style={{ '--accent': t.color, paddingBottom: 76 }}>
      <div className="mob-pick-head">{T('mobile.forge')}</div>

      {/* Le dé : 6 slots */}
      <section className="mob-section">
        <div className="mob-section-title">{T('mobile.forgeDie')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {faces.map((face, i) => (
            <FaceTile
              key={i}
              face={face}
              base={i + 1}
              size={54}
              clickable={owned && !locked && sel != null}
              onClick={(owned && !locked && sel != null) ? () => place(i) : undefined}
              title={faceEffectLabel(face, en) || undefined}
            />
          ))}
        </div>
        {confirm && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ color: '#c0392b', fontWeight: 700, fontSize: 12.5 }}>{T('mobile.forgeOverwrite')}</span>
            <button className="mob-btn mob-btn--gold" onClick={doConfirm}>{T('mobile.forgeConfirm')}</button>
            <button className="mob-btn" onClick={() => setConfirm(null)}>{T('mobile.forgeCancel')}</button>
          </div>
        )}
      </section>

      {/* La réserve : faces achetées non posées */}
      <section className="mob-section">
        <div className="mob-section-title">{T('mobile.forgeReserve')} ({reserve.length})</div>
        {reserve.length === 0 ? (
          <div className="mob-empty">{T('mobile.forgeReserveEmpty')}</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {reserve.map((f, i) => (
              <FaceTile
                key={i}
                face={f}
                size={50}
                selected={sel === i}
                clickable={owned && !locked}
                onClick={(owned && !locked) ? () => { setSel(sel === i ? null : i); setConfirm(null); } : undefined}
                title={faceEffectLabel(f, en) || undefined}
              />
            ))}
          </div>
        )}
        <div className="mob-foot" style={{ marginTop: 8 }}>{owned ? T('mobile.forgeHint') : T('mobile.forgeReadonly')}</div>
      </section>

      {/* La vitrine : faces à acheter */}
      <section className="mob-section">
        <div className="mob-section-title">{T('mobile.forgeShop')}</div>
        {shopFaces.length === 0 ? (
          <div className="mob-empty">{T('mobile.facesEmpty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shopFaces.map((f, i) => {
              const color = colorOf(f);
              const eff = faceEffectLabel(f, en);
              const broke = (t.money ?? 0) < (f.price || 0);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, border: `1px solid ${color}55`, background: '#fffefb' }}>
                  <FaceTile face={f} size={46} />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{eff || T('mobile.forgeDie')}</span>
                  <button className="mob-btn mob-btn--gold" disabled={!owned || locked || broke} onClick={() => buy(i)}>
                    {T('mobile.buyFaceFor', { price: f.price || 0 })}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
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

// Compositeur unique de « deal » entre équipes (mode téléphone). Couvre les deux
// mondes en un seul écran :
//   • échange libre d'or et d'objets (= le troc, avec fiche objet ⓘ) ;
//   • si l'extension Complots est active : manœuvres de PACTE de non-agression
//     (rançon / cadeau / mutuel) et promesse de paix greffée sur un échange.
// Produit { give, want } pour la table quete_trades. `initial` pré-remplit un
// échange (contre-proposition). Remplace les anciens TradeComposer + SchemeComposer
// (le « deal libre » du complot ÉTAIT déjà un troc).
function DealComposer({ session, teamIdx, hasDiplo = false, initial = null, onClose, onSend }) {
  const T = tFor(session?.englishMode);
  const me = session.teams[teamIdx];
  const others = session.teams.map((t, i) => ({ t, i })).filter((x) => x.i !== teamIdx);
  const norm = (s) => ({ gold: s?.gold || 0, bag: [...(s?.bag || [])], equip: [...(s?.equip || [])] });
  const [toIdx, setToIdx] = useState(initial?.toIdx ?? others[0]?.i ?? null);
  // Manœuvre — pertinente seulement avec Complots. Défaut « free » = échange (troc).
  const [kind, setKind] = useState('free');
  const [turns, setTurns] = useState(PACT_DEFAULT_TURNS);
  const [demand, setDemand] = useState(10); // or réclamé (rançon)
  const [give, setGive] = useState(norm(initial?.give));
  const [want, setWant] = useState(norm(initial?.want));
  const [peace, setPeace] = useState(false); // échange libre : + promesse de paix
  const [againstIdx, setAgainstIdx] = useState(null); // coalition : cible commune
  const [info, setInfo] = useState(null); // { itemKey, team } : fiche d'objet ouverte
  const target = toIdx != null ? session.teams[toIdx] : null;
  const isFree = !hasDiplo || kind === 'free';
  const isCounter = !!initial;
  // Coalition : la cible commune est une 3ᵉ équipe (ni moi, ni l'allié `toIdx`).
  const canCoalition = session.teams.length >= 3;
  const victims = others.filter((x) => x.i !== toIdx);
  const against = againstIdx != null && victims.some((v) => v.i === againstIdx) ? againstIdx : (victims[0]?.i ?? null);

  const bagKeys = (t) => (t?.bag || []).map((c) => cellKey(c)).filter((k) => ITEMS[k]);
  const equipSlots = (t) => Object.keys(SLOTS).filter((s) => t?.equipment?.[s] && ITEMS[t.equipment[s]]);
  const toggle = (spec, set, field, val) => {
    const arr = spec[field];
    const i = arr.indexOf(val);
    set({ ...spec, [field]: i >= 0 ? arr.filter((_, j) => j !== i) : [...arr, val] });
  };

  // Avec Complots : « Échange » d'abord (= le troc), puis les manœuvres de pacte,
  // et l'attaque commune (coalition) s'il existe une 3ᵉ équipe à viser.
  const KINDS = [
    { key: 'free', label: T('mobile.freeDeal'), desc: T('mobile.freeDealDesc') },
    { key: 'extort', label: T('mobile.extort'), desc: T('mobile.extortDesc') },
    { key: 'gift', label: T('mobile.gift'), desc: T('mobile.giftDesc') },
    { key: 'mutual', label: T('mobile.mutual'), desc: T('mobile.mutualDesc') },
    ...(canCoalition ? [{ key: 'coalition', label: T('mobile.coalition'), desc: T('mobile.coalitionDesc') }] : []),
  ];

  const build = () => {
    const pact = { turns };
    if (hasDiplo && kind === 'extort') return { give: { pact }, want: { gold: Math.max(0, demand) } };
    if (hasDiplo && kind === 'gift') return { give: { pact }, want: {} };
    if (hasDiplo && kind === 'mutual') return { give: { pact }, want: { pact } };
    // Attaque commune : les DEUX côtés s'engagent à viser `against` (objets neufs).
    if (hasDiplo && kind === 'coalition') {
      const mk = () => ({ coalition: { against, turns } });
      return { give: mk(), want: mk() };
    }
    // Échange libre (= troc), + promesse de paix optionnelle (si Complots actif).
    const g = {}; if (give.gold > 0) g.gold = give.gold; if (give.bag.length) g.bag = give.bag; if (give.equip.length) g.equip = give.equip; if (hasDiplo && peace) g.pact = pact;
    const w = {}; if (want.gold > 0) w.gold = want.gold; if (want.bag.length) w.bag = want.bag; if (want.equip.length) w.equip = want.equip;
    return { give: g, want: w };
  };
  const built = build();
  const has = (s) => !!(s.pact || s.coalition || s.gold || s.bag?.length || s.equip?.length);
  const valid = toIdx != null && (kind !== 'coalition' || against != null) && (has(built.give) || has(built.want));
  const usesPact = hasDiplo && (kind !== 'free' || peace);

  // `cap` = plafond DUR (l'or que JE donne : on ne peut pas donner ce qu'on n'a
  // pas). `hint` = simple repère affiché (l'or de la cible). On ne borne PAS une
  // demande au solde — mouvant — de la cible (sinon une cible sans or bloque le
  // champ à 0). Si elle ne peut pas payer à l'acceptation, l'échange échoue
  // proprement (applyTrade → 'failed').
  const goldInput = (label, value, set, { cap = null, hint = null } = {}) => (
    <label className="mob-trade-gold" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
      🪙 {label} <input type="number" min="0" max={cap ?? undefined} value={value}
        onChange={(e) => { const v = Math.max(0, Number(e.target.value) || 0); set(cap != null ? Math.min(cap, v) : v); }}
        style={{ width: 80 }} />{hint != null ? ` / ${hint}` : ''}
    </label>
  );

  // Panneau d'un côté de l'échange. FONCTION (pas un composant inline) pour ne pas
  // remonter les <input> à chaque frappe — ce qui leur ferait perdre le focus.
  // `own` = c'est MON côté (je donne) → plafond dur à mon or ; sinon (la cible) =
  // simple repère sans clamp.
  const panel = (title, team, spec, set, own) => (
    <div className="mob-trade-panel">
      <div className="mob-trade-panel-title">{title}</div>
      {goldInput('', spec.gold, (v) => set({ ...spec, gold: v }), own ? { cap: team?.money ?? 0, hint: team?.money ?? 0 } : { hint: team?.money ?? 0 })}
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

  return (
   <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,12,4,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, maxHeight: '88vh', overflowY: 'auto', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderRadius: 20, padding: 16, border: '1px solid rgba(122,94,58,0.25)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, textAlign: 'center', marginBottom: 8 }}>{isCounter ? T('mobile.counterOffer') : T('mobile.newDeal')}</div>

        <div style={{ fontSize: 13, fontWeight: 700, margin: '6px 0 4px' }}>{T('mobile.schemeTarget')}</div>
        <div className="mob-trade-targets">
          {others.map(({ t, i }) => (
            <button key={i} className={'mob-trade-target' + (toIdx === i ? ' on' : '')}
              onClick={() => { setToIdx(i); setWant({ gold: 0, bag: [], equip: [] }); }}>
              {t.emoji} {t.name}
            </button>
          ))}
        </div>

        {/* Manœuvre (or/objets ou pacte) — seulement si l'extension Complots est active. */}
        {hasDiplo && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, margin: '10px 0 4px' }}>{T('mobile.schemeType')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {KINDS.map((k) => (
                <button key={k.key} className={'mob-trade-target' + (kind === k.key ? ' on' : '')} onClick={() => setKind(k.key)} style={{ textAlign: 'left' }}>
                  {k.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-600)', marginTop: 6, minHeight: 30 }}>{KINDS.find((k) => k.key === kind)?.desc}</div>
          </>
        )}

        {hasDiplo && kind === 'extort' && target && goldInput(T('mobile.demandGold'), demand, setDemand, { hint: target.money ?? 0 })}

        {/* Attaque commune : choix de la cible commune (3ᵉ équipe). */}
        {hasDiplo && kind === 'coalition' && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, margin: '6px 0 4px' }}>{T('mobile.coalitionTarget')}</div>
            <div className="mob-trade-targets">
              {victims.map(({ t, i }) => (
                <button key={i} className={'mob-trade-target' + (against === i ? ' on' : '')} onClick={() => setAgainstIdx(i)}>
                  {t.emoji} {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {isFree && (
          <>
            {target && panel(T('mobile.iGive'), me, give, setGive, true)}
            {target && panel(T('mobile.iWantFrom', { who: target.emoji }), target, want, setWant, false)}
            {hasDiplo && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 14, fontWeight: 600 }}>
                <input type="checkbox" checked={peace} onChange={(e) => setPeace(e.target.checked)} /> {T('mobile.addPeace')}
              </label>
            )}
          </>
        )}

        {usesPact && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{kind === 'coalition' ? T('mobile.coalitionDuration') : T('mobile.pactDuration')}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {Array.from({ length: PACT_MAX_TURNS - PACT_MIN_TURNS + 1 }, (_, n) => PACT_MIN_TURNS + n).map((n) => (
                <button key={n} className={'mob-trade-target' + (turns === n ? ' on' : '')} style={{ flex: 1, textAlign: 'center' }} onClick={() => setTurns(n)}>
                  {T('mobile.turnsN', { n })}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="mob-btn mob-btn--gold" style={{ flex: 1, minWidth: 0 }} disabled={!valid}
            onClick={() => onSend(toIdx, built.give, built.want)}>{isCounter ? T('mobile.sendCounterOffer') : T('mobile.send')}</button>
          <button className="mob-btn mob-btn--ghost" style={{ flex: 1, minWidth: 0 }} onClick={onClose}>{T('common.cancel')}</button>
        </div>
        {hasDiplo && <div className="mob-foot" style={{ marginTop: 8 }}>{T('mobile.schemeFoot')}</div>}
      </div>
    </div>
    {info?.itemKey && (
      <ItemSheet itemKey={info.itemKey} loc={null} team={info.team}
        owned={false} locked={false} onAction={() => {}} onClose={() => setInfo(null)} T={T} />
    )}
   </>
  );
}

// Onglet « Troc » (mode téléphone) : guichet unique des échanges entre équipes.
// Réunit les trocs OUVERTS et les complots SECRETS (pactes) — deux faces d'un même
// flux d'offres (table quete_trades). On affiche chaque type seulement si son
// extension est active : troc ouvert (`hasTrade`), complot/pacte (`hasDiplo`).
// `trades` est alimenté par l'abonnement partagé de MobileApp (badge + vue).
function TradeView({ session, teamIdx, code, token, trades = [], hasTrade = true, hasDiplo = false }) {
  const T = tFor(session?.englishMode);
  const [deal, setDeal] = useState(false); // compositeur de deal (troc + pacte)
  const [counter, setCounter] = useState(null); // offre reçue qu'on contre (ou null)
  const me = session.teams[teamIdx];

  // Une offre n'est visible que si l'extension correspondante est active : les
  // complots (offres secrètes : pacte OU coalition) sous `diplomacy`, les trocs
  // ouverts sous `trade`.
  const visible = (t) => (isDiploTrade(t) ? hasDiplo : hasTrade);
  const incoming = trades.filter((t) => t.to_idx === teamIdx && t.status === 'pending' && visible(t));
  const outgoing = trades.filter((t) => t.from_idx === teamIdx && t.status === 'pending' && visible(t));
  const pacts = hasDiplo ? (me.promises || []).filter((p) => p && p.turns > 0) : [];
  const coalitions = hasDiplo ? (me.coalitions || []).filter((c) => c && c.turns > 0) : [];
  const nameOf = (i) => session.teams[i] ? `${session.teams[i].emoji} ${session.teams[i].name}` : `#${i}`;
  const equipOfTeam = (i) => (slot) => session.teams[i]?.equipment?.[slot];

  return (
    <div className="mob-root" style={{ '--accent': me.color, paddingBottom: 76 }}>
      <div className="mob-pick-head">{T('mobile.trade')}</div>

      {/* Engagements secrets en cours (complot) : pactes de non-agression et
          coalitions (attaques communes). Mes engagements actifs uniquement. */}
      {hasDiplo && (
        <section className="mob-section">
          <h2 className="mob-section-title">{T('mobile.diploActive')}</h2>
          {pacts.length === 0 && coalitions.length === 0 ? (
            <div className="mob-empty">{T('mobile.noDiploActive')}</div>
          ) : (
            <>
              {pacts.map((p, n) => (
                <div key={`p${n}`} className="mob-trade-line">{T('mobile.pactActive', { who: nameOf(p.to), n: p.turns })}</div>
              ))}
              {coalitions.map((c, n) => (
                <div key={`c${n}`} className="mob-trade-line">{T('mobile.coalitionActive', { ally: nameOf(c.with), who: nameOf(c.against), n: c.turns })}</div>
              ))}
            </>
          )}
        </section>
      )}

      <section className="mob-section">
        <h2 className="mob-section-title">{T('mobile.offersReceived')} {incoming.length > 0 && <span className="mob-count">{incoming.length}</span>}</h2>
        {incoming.length === 0 ? <div className="mob-empty">{T('mobile.noOffer')}</div> : incoming.map((tr) => (
          <div key={tr.id} className="mob-trade-card">
            <div className="mob-trade-from">{T('mobile.from', { who: nameOf(tr.from_idx) })}</div>
            <div className="mob-trade-line"><b>{T('mobile.youReceiveLine')}</b> {schemeText(tr.give, equipOfTeam(tr.from_idx), false, T, nameOf)}</div>
            <div className="mob-trade-line"><b>{T('mobile.youGiveLine')}</b> {schemeText(tr.want, equipOfTeam(teamIdx), true, T, nameOf)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="mob-btn mob-btn--gold" style={{ flex: 1, minWidth: 0 }} onClick={() => setTradeStatus(tr.id, 'accepted').catch(() => {})}>{T('mobile.accept')}</button>
              <button className="mob-btn mob-btn--ghost" style={{ flex: 1, minWidth: 0 }} onClick={() => setTradeStatus(tr.id, 'declined').catch(() => {})}>{T('mobile.decline')}</button>
            </div>
            {/* Contre-proposition réservée aux trocs ouverts : on ne contre pas un
                engagement secret (pacte / coalition). */}
            {!isDiploTrade(tr) && (
              <button className="mob-btn mob-btn--ghost" style={{ width: '100%', marginTop: 6 }} onClick={() => { setCounter(tr); setDeal(true); }}>{T('mobile.counterOffer')}</button>
            )}
          </div>
        ))}
      </section>

      <section className="mob-section">
        <h2 className="mob-section-title">{T('mobile.offersSent')} {outgoing.length > 0 && <span className="mob-count">{outgoing.length}</span>}</h2>
        {outgoing.length === 0 ? <div className="mob-empty">{T('mobile.none')}</div> : outgoing.map((tr) => (
          <div key={tr.id} className="mob-trade-card">
            <div className="mob-trade-from">{T('mobile.toWaiting', { who: nameOf(tr.to_idx) })}</div>
            <div className="mob-trade-line"><b>{T('mobile.youGiveLine')}</b> {schemeText(tr.give, equipOfTeam(teamIdx), true, T, nameOf)}</div>
            <div className="mob-trade-line"><b>{T('mobile.youWantLine')}</b> {schemeText(tr.want, equipOfTeam(tr.to_idx), false, T, nameOf)}</div>
            <button className="mob-btn mob-btn--ghost" style={{ marginTop: 8 }} onClick={() => deleteTrade(tr.id).catch(() => {})}>{T('common.cancel')}</button>
          </div>
        ))}
      </section>

      <div style={{ padding: '4px 14px 0' }}>
        <button className="mob-btn mob-btn--gold" style={{ width: '100%' }} onClick={() => { setCounter(null); setDeal(true); }}>{T('mobile.proposeDeal')}</button>
      </div>
      {hasTrade && <div className="mob-foot">{T('mobile.tradeFoot')}</div>}
      {hasDiplo && <div className="mob-foot">{T('mobile.complotFoot')}</div>}

      {deal && (
        <DealComposer session={session} teamIdx={teamIdx} hasDiplo={hasDiplo}
          initial={counter ? { toIdx: counter.from_idx, give: counter.want, want: counter.give } : null}
          onClose={() => { setDeal(false); setCounter(null); }}
          onSend={(toIdx, give, want) => {
            createTrade(code, token, teamIdx, toIdx, give, want).catch(() => {});
            // Contre-proposition : l'offre d'origine est remplacée (refusée).
            if (counter) setTradeStatus(counter.id, 'declined').catch(() => {});
            setDeal(false); setCounter(null);
          }} />
      )}
    </div>
  );
}

// Résumé lisible d'un côté d'offre diplomatique : or/objets (tradeSideText) +
// éventuel terme de PACTE ou de COALITION. `mine` = l'obligation de pacte
// m'incombe (je promets). `nameOf(idx)` résout le nom d'une équipe (cible de
// coalition).
function schemeText(spec, equipOf, mine, T = tFor(false), nameOf = null) {
  const parts = [];
  if (spec?.gold || spec?.bag?.length || spec?.equip?.length) parts.push(tradeSideText(spec, equipOf, T));
  if (spec?.pact) parts.push(mine
    ? T('mobile.pactLineGive', { n: spec.pact.turns ?? PACT_DEFAULT_TURNS })
    : T('mobile.pactLineWant', { n: spec.pact.turns ?? PACT_DEFAULT_TURNS }));
  if (spec?.coalition) parts.push(T('mobile.coalitionLine', {
    who: nameOf ? nameOf(spec.coalition.against) : `#${spec.coalition.against}`,
    n: spec.coalition.turns ?? PACT_DEFAULT_TURNS,
  }));
  return parts.length ? parts.join(' • ') : T('mobile.nothing');
}

// Couleur déterministe (teinte stable) d'un ingrédient/potion d'après sa clé —
// donne au visuel « potion » ses couleurs (orbes, liquide mélangé, fioles).
function alcHslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function alcColor(key) {
  let h = 0; const s = key || '';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return alcHslToHex(h % 360, 56 + (h >> 8) % 20, 54 + (h >> 16) % 12);
}
function alcMix(colors) {
  if (!colors.length) return '#3b3050';
  let r = 0, g = 0, b = 0;
  for (const c of colors) { r += parseInt(c.slice(1, 3), 16); g += parseInt(c.slice(3, 5), 16); b += parseInt(c.slice(5, 7), 16); }
  const f = (v) => Math.round((v / colors.length) * 0.82).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}
// Visuel d'un objet d'alchimie : image détourée (src/assets/items/alc-*.png via
// item.img) si dispo, sinon repli emoji. Remplit son conteneur (objectFit contain).
function AlcVisual({ item, emojiSize = 24, glow = 'drop-shadow(0 2px 5px rgba(0,0,0,.3))' }) {
  const img = item && itemImg(item);
  if (img) return <img src={img} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: glow }} />;
  return <span style={{ fontSize: emojiSize }}>{item?.icon}</span>;
}

// Onglet « Alchimie » — visuel « marmite & grimoire » (design Claude Design).
// La LOGIQUE est inchangée : sélection de 3 ingrédients du sac → intent `craft`
// (par CLÉS), garde-fou « sac plein », grimoire = recettes DÉCOUVERTES seulement
// (1140 recettes en base). Les cérémonies (distillation/potion/découverte/échec)
// sont un APERÇU optimiste : le TBI reste l'autorité du résultat réel.
function AlchemyView({ session, teamIdx, code, token }) {
  const t = session.teams[teamIdx];
  const en = !!session?.englishMode;
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
    sendIntent(code, token, 'craft', { keys }).catch(() => {});
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
                <div style={{ fontSize: 12.5, color: '#9b7e4e', fontStyle: 'italic', marginTop: 2 }}>{itemEffectLines(ITEMS[infoIng], { key: infoIng, knownIngredients: t.knownIngredients }).join(' · ') || (known.has(infoIng) ? '' : L('Essence inconnue.', 'Unknown essence.'))}</div>
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

// Catégorie d'un objet pour le filtre admin (composant/potion/consommable/équipement).
// `slot !== 'consumable'` = pièce d'équipement (tête/torse/pieds). Sinon on
// distingue par `family` ; les parchemins et consommables simples → « consommable ».
function adminItemCat(item) {
  if (item.slot !== 'consumable') return 'equipment';
  if (item.family === 'ingredient') return 'ingredient';
  if (item.family === 'potion') return 'potion';
  return 'consumable';
}

// Sélecteur d'objet (admin) : catégories + recherche, puis PANIER — on ajuste la
// quantité de chaque objet directement dans la grille (stepper en face), on en
// empile plusieurs, puis on valide tout d'un coup (un don par entrée du panier).
function AdminItemPicker({ onGive, onClose, teamName, T = tFor(false) }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [cart, setCart] = useState({}); // { key: qty }
  const [sent, setSent] = useState(0);  // nb d'unités du dernier envoi (retour visuel)

  const CATS = [
    ['all', T('mobile.catAll')],
    ['ingredient', T('mobile.catIngredients')],
    ['potion', T('mobile.catPotions')],
    ['consumable', T('mobile.catConsumables')],
    ['equipment', T('mobile.catEquipment')],
  ];
  const keys = Object.keys(ITEMS).filter((k) => {
    const item = ITEMS[k];
    if (cat !== 'all' && adminItemCat(item) !== cat) return false;
    if (!q) return true;
    const ql = q.toLowerCase();
    return locName(item).toLowerCase().includes(ql) || item.name.toLowerCase().includes(ql);
  });

  const setQty = (k, n) => setCart((c) => {
    const next = { ...c };
    const v = Math.max(0, Math.min(9, n));
    if (v === 0) delete next[k]; else next[k] = v;
    return next;
  });
  const add = (k) => { setSent(0); setQty(k, (cart[k] || 0) + 1); };
  const totalUnits = Object.values(cart).reduce((s, n) => s + n, 0);
  const send = () => {
    if (!totalUnits) return;
    Object.entries(cart).forEach(([k, n]) => onGive(k, n));
    setSent(totalUnits);
    setCart({});
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,12,4,0.55)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
        {/* En-tête fixe : titre + catégories + recherche */}
        <div style={{ padding: '14px 16px 8px', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#8a6418', marginBottom: 8 }}>
            {teamName ? T('mobile.giveToTeam', { name: teamName }) : T('mobile.giveItem')}
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 8 }}>
            {CATS.map(([id, label]) => (
              <button key={id} onClick={() => setCat(id)} style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                fontSize: 12.5, fontWeight: cat === id ? 800 : 600, fontFamily: 'var(--font-ui)',
                border: '1.5px solid ' + (cat === id ? '#8a6418' : 'rgba(122,94,58,0.3)'),
                background: cat === id ? '#8a6418' : '#fffefb', color: cat === id ? '#fff' : '#7a5e3a',
              }}>{label}</button>
            ))}
          </div>
          <input className="mob-text-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T('mobile.searchPlaceholder')} />
        </div>

        {/* Grille défilante — chaque carte porte son propre stepper de quantité */}
        <div style={{ flex: 1, minHeight: 80, overflowY: 'auto', padding: '4px 16px 8px' }}>
          {keys.length === 0
            ? <div className="mob-empty" style={{ margin: '14px 0' }}>{T('mobile.noItemInCat')}</div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {keys.map((k) => {
                  const item = ITEMS[k];
                  const color = RARITIES[item.rarity]?.color || '#888';
                  const qty = cart[k] || 0;
                  const on = qty > 0;
                  return (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column', borderRadius: 10, border: on ? '2px solid #8a6418' : `1.5px solid ${color}55`, background: on ? '#fff7e0' : '#fffefb', overflow: 'hidden' }}>
                      <button onClick={() => add(k)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 6px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ width: 30, height: 30, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 18 }}>{itemImg(item) ? <img src={itemImg(item)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : item.icon}</span>
                        <span style={{ fontSize: 12, lineHeight: 1.2, minWidth: 0 }}>{locName(item)}</span>
                      </button>
                      {on ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '0 8px 8px' }}>
                          <button onClick={() => setQty(k, qty - 1)} style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid rgba(122,94,58,0.4)', background: '#fffefb', fontSize: 18, fontWeight: 800, color: '#7a5e3a', cursor: 'pointer' }}>−</button>
                          <span style={{ minWidth: 22, textAlign: 'center', fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-display)', color: '#5a4626' }}>{qty}</span>
                          <button onClick={() => setQty(k, qty + 1)} disabled={qty >= 9} style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid rgba(122,94,58,0.4)', background: '#fffefb', fontSize: 18, fontWeight: 800, color: '#7a5e3a', cursor: 'pointer', opacity: qty >= 9 ? 0.4 : 1 }}>+</button>
                        </div>
                      ) : (
                        <button onClick={() => add(k)} style={{ margin: '0 8px 8px', padding: '4px 0', borderRadius: 8, border: '1px dashed rgba(122,94,58,0.4)', background: 'transparent', fontSize: 11.5, fontWeight: 700, color: '#9b7e4e', cursor: 'pointer' }}>+ {T('mobile.cartAdd')}</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Pied fixe : récap du panier + envoi groupé, ou fermeture */}
        <div style={{ flexShrink: 0, padding: '10px 16px calc(16px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(122,94,58,0.2)', background: 'rgba(255,255,255,0.6)' }}>
          {totalUnits > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#5a4626' }}>🧺 {T('mobile.cartCount', { n: totalUnits, s: totalUnits > 1 ? 's' : '' })}</span>
                <button onClick={() => setCart({})} style={{ border: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 700, color: '#a05a2c', cursor: 'pointer', textDecoration: 'underline' }}>{T('mobile.cartClear')}</button>
              </div>
              <button className="mob-btn mob-btn--gold" style={{ width: '100%' }} onClick={send}>{T('mobile.cartSend', { n: totalUnits })}</button>
            </>
          ) : (
            <>
              {sent > 0
                ? <div style={{ fontSize: 13, fontWeight: 700, color: '#2f5a18', textAlign: 'center', marginBottom: 8 }}>{T('mobile.cartSent', { n: sent, s: sent > 1 ? 's' : '' })}</div>
                : <div style={{ fontSize: 12.5, color: 'var(--ink-400)', fontStyle: 'italic', textAlign: 'center', marginBottom: 8 }}>{T('mobile.cartEmpty')}</div>}
              <button className="mob-btn mob-btn--ghost" style={{ width: '100%' }} onClick={onClose}>{T('common.close')}</button>
            </>
          )}
        </div>
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
        <AdminItemPicker
          teamName={teams.find((t) => t.idx === picker)?.name}
          onGive={(key, n) => send('adminGiveItem', { teamIdx: picker, key, n })}
          onClose={() => setPicker(null)}
          T={T}
        />
      )}
    </div>
  );
}

// Barre d'onglets fixe en bas (Équipe / Pouvoirs / Boutique / Troc / Historique).
// L'onglet « Troc » réunit désormais trocs ouverts ET complots (cf. TradeView) :
// il s'affiche dès que l'une OU l'autre extension est active (`hasTrade`).
function TabBar({ tab, setTab, hasShop, hasTrade, hasAlchemy, hasScribe, hasForge, tradeAlert = 0, T = tFor(false) }) {
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
      {hasScribe && <Tab id="scribe" icon={'\u{2712}️'} label={T('mobile.tabScribe')} />}
      {hasForge && <Tab id="forge" icon={'🔨'} label={T('mobile.tabForge')} />}
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
  // « Complots » réutilise le même flux d'offres (quete_trades) ; l'abonnement doit
  // donc aussi tourner quand seule la diplomatie est active (sans le Troc).
  const canDiplo = !!(session && session.status !== 'lobby' && teamIdx != null && owned && token && extOn(session.extensions, 'diplomacy'));
  useEffect(() => {
    if ((!canTrade && !canDiplo) || !code) { setTrades([]); return; }
    let alive = true;
    const refresh = () => fetchTrades(code).then((r) => { if (alive) setTrades(r); }).catch(() => {});
    refresh();
    const unsub = subscribeTrades(code, refresh);
    return () => { alive = false; unsub(); };
  }, [canTrade, canDiplo, code]);
  // Badge de l'onglet « Troc » (qui réunit trocs ouverts et complots) : toutes les
  // offres en attente qui me sont adressées, à pacte ou non.
  const tradeAlert = trades.filter((t) => t.to_idx === teamIdx && t.status === 'pending').length;

  // Confirmation visuelle : dès qu'un troc impliquant MON équipe passe « applied »,
  // on affiche un bandeau de succès. Au 1er chargement, on mémorise les deals déjà
  // appliqués sans notifier (sinon on rejouerait l'historique à la connexion).
  useEffect(() => {
    if (teamIdx == null) return;
    // Les engagements secrets (pacte / coalition) ne déclenchent pas de bandeau
    // « affaire conclue » (il révélerait le complot).
    const mineApplied = trades.filter((t) => t.status === 'applied' && !isDiploTrade(t) && (t.to_idx === teamIdx || t.from_idx === teamIdx));
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
    const hasForge = extOn(session.extensions, 'forge');
    // Troc : RÉSERVÉ au propriétaire de l'équipe (comme les achats). Valider ou
    // proposer un troc engage l'inventaire de l'équipe ; un téléphone qui a
    // seulement « sélectionné » une autre équipe (owned=false) ne peut pas
    // troquer à sa place (sinon il validerait le troc d'un autre groupe).
    const hasTrade = extOn(session.extensions, 'trade') && owned && !!token;
    const hasDiplo = extOn(session.extensions, 'diplomacy') && owned && !!token;
    const hasAlchemy = extOn(session.extensions, 'alchemy') && owned && !!token;
    const hasScribe = extOn(session.extensions, 'enchant') && owned && !!token;
    // L'onglet « Troc » réunit trocs ouverts et complots : présent si l'une OU
    // l'autre extension est active.
    const hasExchange = hasTrade || hasDiplo;
    const view = tab === 'powers' ? <PowersView session={session} teamIdx={teamIdx} owned={owned} code={code} token={token} />
      : tab === 'shop' && hasShop ? <ShopView session={session} teamIdx={teamIdx} owned={owned} code={code} token={token} />
      : tab === 'trade' && hasExchange ? <TradeView session={session} teamIdx={teamIdx} code={code} token={token} trades={trades} hasTrade={hasTrade} hasDiplo={hasDiplo} />
      : tab === 'alchemy' && hasAlchemy ? <AlchemyView session={session} teamIdx={teamIdx} code={code} token={token} />
      : tab === 'scribe' && hasScribe ? <ScribeView team={session.teams[teamIdx]} en={!!session.englishMode} onInscribe={(parts) => { sendIntent(code, token, 'craftParchment', { parts }).catch(() => {}); }} />
      : tab === 'forge' && hasForge ? <ForgeView session={session} teamIdx={teamIdx} owned={owned} code={code} token={token} />
      : tab === 'history' ? <HistoryView session={session} teamIdx={teamIdx} />
      : <TeamView session={session} teamIdx={teamIdx} owned={owned} code={code} token={token} />;
    content = (
      <>
        {view}
        <TabBar tab={tab} setTab={setTab} hasShop={hasShop} hasTrade={hasExchange} hasAlchemy={hasAlchemy} hasScribe={hasScribe} hasForge={hasForge} tradeAlert={tradeAlert} T={T} />
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
