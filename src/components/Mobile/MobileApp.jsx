// Companion mobile (lecture seule, Phase 2) : un élève ouvre l'URL d'appairage
// (QR), choisit son équipe, et suit en direct son or, son équipement, son sac
// et ses pouvoirs/charges — y compris pendant le tour adverse. Le TBI publie
// l'état ; ici on ne fait que lire (l'édition viendra en Phase 3).
import { useState, useEffect, useRef } from 'react';
import { fetchSession, subscribeSession, fetchLobbyTeams, upsertLobbyTeam, randomToken, sendIntent, createTrade, fetchTrades, setTradeStatus, deleteTrade, subscribeTrades } from '../../logic/sessionConfig';
import { POWERS, MAX_CHARGES } from '../../data/powers';
import { describePowerScale, specSlotForLevel, specOptionsFor, maxPowerLevel, powerUpgradeCost, resolvePowerEffect, tierLevelsFor } from '../../logic/powerEffects';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { SUBJECTS } from '../../data/subjects';
import { itemImg } from '../../logic/itemAssets';
import { itemEffectLines, enchantEffectLines } from '../../logic/effectText';
import { getTeamEffects } from '../../logic/teamStatus';
import AlchemyView from './AlchemyView';
import SpellTableView from './SpellTableView';
import CodexView from './CodexView';
import ControllerView from './ControllerView';
import CurioPlaceView from '../Fight/CurioPlaceView';
import DuelRaceView from '../Online/DuelRaceView';
import MemoryDuelView from '../Fight/MemoryDuelView';
import PkmnGameboyView from '../Fight/PkmnGameboyView';
import ChessDuelView from '../Fight/ChessDuelView';
import HackDuelView from '../Fight/HackDuelView';
import WizardDuelView from '../Fight/WizardDuelView';
import MapeventDuelView from '../Fight/MapeventDuelView';
import { extOn } from '../../extensions/registry';
import { craftEnabledFor, metierPending, METIERS, metierName, metierDesc } from '../../logic/metier';
import { WEATHER_KEYS, weatherName, weatherIcon } from '../../data/weather';
import { getDieFaces, isFaceForged, clampFaceValue, faceEffects, faceSig } from '../../logic/forge';
import { faceEffectLabel, faceEffectDescriptions, faceColor as sharedFaceColor } from '../../logic/forgeEffects';
import FaceTile from '../Game/FaceTile';
import HackCinematic from '../Game/HackCinematic';
import { isDiploTrade, PACT_DEFAULT_TURNS, PACT_MIN_TURNS, PACT_MAX_TURNS } from '../../logic/pacts';
import { tFor, setLang } from '../../i18n';
import { CHARACTERS, characterById } from '../../data/characters';
import TeamAvatar from '../TeamAvatar';
import { locName, locDesc, loc } from '../../i18n/content';
import SetBonusInfo from '../Modals/SetBonusInfo';
import ScribeView from './ScribeView';
import '../../styles/mobile.css';
import '../../styles/alchemy-mobile.css';
import '../../styles/forge-mobile.css';

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
// `initial` (optionnel) : ligne quete_lobby_teams déjà créée avec CE jeton —
// le formulaire se PRÉ-REMPLIT et repart de l'écran « prêt ✓ » (au lieu de
// proposer une création vierge alors que l'équipe existe, ex. aller-retour
// lobby ↔ console côté hôte en ligne).
export function LobbyCreateScreen({ code, token, onSubmitted, lv2Mode, englishMode = false, initial = null }) {
  const T = tFor(englishMode);
  const [name, setName] = useState(initial?.name || '');
  const [character, setCharacter] = useState(initial?.character || CHARACTERS[0].id);
  const emoji = characterById(character)?.badge || EMOJI_CHOICES[0];
  const [powerDef, setPowerDef] = useState(initial?.power_def || null);
  const [powerOff, setPowerOff] = useState(initial?.power_off || null);
  const [lv2, setLv2] = useState(initial?.lv2 || 'espagnol'); // langue LV2 (si le mode est actif)
  const [submitted, setSubmitted] = useState(!!initial?.ready);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const defPowers = Object.entries(POWERS).filter(([, p]) => p.category !== 'off');
  const offPowers = Object.entries(POWERS).filter(([, p]) => p.category === 'off');

  const incomplete = name.trim().length < 1 || !powerDef || !powerOff;
  const submit = async () => {
    if (busy || incomplete) return;
    setBusy(true); setErr(null);
    try {
      await upsertLobbyTeam(code, token, { name: name.trim(), emoji, character, power_def: powerDef, power_off: powerOff, lv2: lv2Mode ? lv2 : null, ready: true });
      setSubmitted(true);
      onSubmitted?.();
    } catch (e) { setErr(e.message || T('mobile.sendFailed')); }
    setBusy(false);
  };

  if (submitted) {
    return (
      <div className="mob-root mob-center">
        <div className="mob-pick-emoji" style={{ width: 84, height: 84, fontSize: 44, background: 'linear-gradient(135deg,#e8a958,#b8862c)', overflow: 'hidden' }}>
          {characterById(character)?.body
            ? <img src={characterById(character).body} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }} />
            : emoji}
        </div>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {CHARACTERS.map((c) => (
          <button key={c.id} type="button" onClick={() => setCharacter(c.id)} title={englishMode ? c.nameEn : c.name}
            style={{
              padding: 3, borderRadius: 10, cursor: 'pointer', aspectRatio: '3 / 4',
              border: `2px solid ${character === c.id ? 'var(--gold-600)' : 'rgba(122,94,58,0.2)'}`,
              background: character === c.id ? 'rgba(232,169,88,0.15)' : '#fffefb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <img src={c.body} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }} />
          </button>
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
            <span className="mob-pick-emoji" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TeamAvatar team={t} size={44} /></span>
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

// Enchants publiés par le TBI pour un emplacement équipé (specs complètes). Repli
// robuste : un ancien payload peut encore envoyer un simple compteur (nombre) →
// on renvoie alors une liste vide (pas de détail tant que le TBI n'a pas republié).
function slotEnchants(team, slot) {
  const e = slot ? team?.enchants?.[slot] : null;
  return Array.isArray(e) ? e : [];
}
function slotEnchantCount(team, slot) {
  const e = slot ? team?.enchants?.[slot] : null;
  return Array.isArray(e) ? e.length : (Number(e) || 0);
}

// Panneau de détail (bottom sheet) au tap d'un objet : desc + EFFETS lisibles,
// + actions d'édition (mode téléphone, sur SA propre équipe, hors verrou).
//   loc : { kind:'equip', slot } | { kind:'bag', key } | { kind:'shop' }
function ItemSheet({ itemKey, loc, team, owned, locked, onAction, onClose, enchants, T = tFor(false) }) {
  const item = ITEMS[itemKey];
  if (!item) return null;
  const canEdit = owned && !locked && loc && loc.kind !== 'shop';
  const isConsumable = item.slot === 'consumable';
  const color = RARITIES[item.rarity]?.color || '#888';
  // Effet d'un ingrédient caché tant que l'équipe ne l'a pas goûté.
  const fx = itemEffectLines(item, { key: itemKey, knownIngredients: team?.knownIngredients || [] });
  // Enchantement : specs ajoutées par un parchemin gravé. Source = prop explicite
  // sinon dérivé de la pièce équipée (team.enchants[slot]). Affichées à part pour
  // qu'on distingue ce que le parchemin a ajouté (utile au moment d'un troc).
  const enchList = enchants ?? slotEnchants(team, loc?.kind === 'equip' ? loc.slot : null);
  const enchantFx = enchantEffectLines(enchList);
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
        {enchantFx.length > 0 && (
          <div style={{
            background: 'rgba(141,92,214,0.1)', border: '1px solid rgba(141,92,214,0.34)',
            borderRadius: 12, padding: '10px 12px', marginTop: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7a4fc0', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
              {'✦'} {T('mobile.enchantEffects')}
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {enchantFx.map((l, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: 'var(--ink-800)', lineHeight: 1.4 }}>
                  <span style={{ color: '#8d5cd6', flexShrink: 0, fontWeight: 700 }}>{'✦'}</span><span>{l}</span>
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
  const tierLevels = tierLevelsFor(powerKey);
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
export function PowersView({ session, teamIdx, owned, code, token }) {
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
export function ShopView({ session, teamIdx, owned, code, token }) {
  const T = tFor(session?.englishMode);
  const en = !!session?.englishMode;
  const [sheet, setSheet] = useState(null);
  const t = session.teams[teamIdx];
  const itemsOn = extOn(session.extensions, 'equipment');
  // Faces de dé : visibles en boutique seulement si l'équipe peut forger (métier
  // forgeron, ou extension Métiers inactive).
  const forgeOn = craftEnabledFor(session.extensions, t, 'forge');
  const shopKeys = itemsOn ? (session.shop || []).filter((k) => ITEMS[k]) : [];
  const shopFaces = forgeOn ? (session.shopFaces || []) : [];
  // Achat bloqué seulement si c'est mon tour ET qu'une résolution est en cours.
  const locked = (session.currentTeam === teamIdx && !!session.locked) || session.status === 'finished';
  const buy = (type, payload) => {
    if (type === 'buy' && owned && code && token) sendIntent(code, token, 'buyItem', payload).catch(() => {});
    setSheet(null);
  };
  const buyFace = (i) => { if (owned && !locked && code && token) sendIntent(code, token, 'buyFace', { faceIndex: i }).catch(() => {}); };
  const faceColor = (f) => sharedFaceColor(f, '#9a8156');
  return (
    <div className="mob-root" style={{ '--accent': t.color, paddingBottom: 76 }}>
      <div className="mob-pick-head">{T('mobile.shop')}</div>

      {/* Objets (extension Équipement) */}
      {itemsOn && (
        <section className="mob-section">
          <div className="mob-section-title">{T('mobile.tabShop')}</div>
          {shopKeys.length === 0 ? (
            <div className="mob-empty">{T('mobile.emptyStall')}</div>
          ) : (
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
          )}
        </section>
      )}

      {/* Faces de dé (extension Forge) */}
      {forgeOn && (
        <section className="mob-section">
          <div className="mob-section-title">{T('mobile.forgeShop')}</div>
          {shopFaces.length === 0 ? (
            <div className="mob-empty">{T('mobile.facesEmpty')}</div>
          ) : (
            <div className="mob-face-list">
              {shopFaces.map((f, i) => {
                const eff = faceEffectLabel(f, en);
                const broke = (t.money ?? 0) < (f.price || 0);
                return (
                  <div key={i} className="mob-face-row" style={{ '--fam': faceColor(f) }}>
                    <FaceTile face={f} size={46} slotTag={f.slot} />
                    <div className="mob-face-info">
                      <div className="mob-face-slot">{T('mobile.faceSlotShort', { n: f.slot })}</div>
                      <div className="mob-face-eff">{eff || T('mobile.forgeDie')}</div>
                    </div>
                    <button className="forge-mob-buy" disabled={!owned || locked || broke} onClick={() => buyFace(i)}>
                      {T('mobile.buyFaceFor', { price: f.price || 0 })}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="mob-foot" style={{ marginTop: 10 }}>
        {owned ? T('mobile.shopHintOwned') : T('mobile.shopHintReadonly')}
      </div>
      {sheet && <ItemSheet itemKey={sheet.itemKey} loc={sheet.loc} team={t} owned={owned} locked={locked} onAction={buy} onClose={() => setSheet(null)} T={T} />}
    </div>
  );
}

// Atelier de forge mobile : acheter des faces (vitrine) puis les poser sur le dé.
// Refonte graphique « forge » (mur de pierre, foyer, creuset en croix) — le
// visuel des faces (FaceTile) reste tel quel ; on n'habille que l'atelier autour.
function ForgeView({ session, teamIdx, owned, code, token }) {
  const T = tFor(session?.englishMode);
  const en = !!session?.englishMode;
  const t = session.teams[teamIdx];
  const faces = getDieFaces(t);
  const reserve = t.faceStock || [];
  const locked = (session.currentTeam === teamIdx && !!session.locked) || session.status === 'finished';
  const canEdit = owned && !locked;
  const [fusion, setFusion] = useState(null);    // { slot, oldFace, newFace } animation de fusion
  const [optimistic, setOptimistic] = useState(null); // { slot, face } affichage anticipé
  const [drag, setDrag] = useState(null);        // { stockIndex, slot, face, x, y, moved }
  const [hoverSlot, setHoverSlot] = useState(null); // n° de slot survolé (1-indexé)
  const [badSlot, setBadSlot] = useState(null);  // n° de slot refusant le drop
  const [detail, setDetail] = useState(null);    // { face, stockIndex|null } modale de zoom
  const pendingRef = useRef(new Set());          // slots forgés localement (anti double-flash)

  const forge = (slot, stock) => { if (canEdit && code && token) sendIntent(code, token, 'forgeFace', { slotIndex: slot, stockIndex: stock }).catch(() => {}); };
  // Forge effective : joue l'animation de coulée de lave sur le TÉLÉPHONE ET affiche
  // tout de suite la face choisie de façon OPTIMISTE (maintenue jusqu'à ce que
  // l'état Realtime rattrape — sinon l'ancienne face « revient » le temps de
  // l'aller-retour via le TBI). oldFace = null si l'emplacement était vide.
  const runForge = (stockIndex) => {
    if (!canEdit) return;
    const f = reserve[stockIndex]; if (!f) return;
    const slot = (f.slot || 1) - 1;
    setFusion({ slot, oldFace: isFaceForged(faces[slot]) ? faces[slot] : null, newFace: f });
    setOptimistic({ slot, face: { value: clampFaceValue(f.value), effects: faceEffects(f) } });
    pendingRef.current.add(slot);
    forge(slot, stockIndex);
  };

  const colorOf = sharedFaceColor;

  // Flash de coulée : détecte l'emplacement qui vient d'être forgé (état Realtime).
  const forgedSig = faces.map((f) => (isFaceForged(f) ? '1' : '0')).join('');
  // Signature de contenu (valeur+effet) : sert à savoir quand l'état réel rattrape
  // l'affichage optimiste (vaut aussi pour un remplacement, où forgedSig ne change pas).
  const facesSig = faces.map(faceSig).join('|');
  const prevSig = useRef(forgedSig);
  const [flashSlot, setFlashSlot] = useState(null);
  useEffect(() => {
    if (prevSig.current !== forgedSig) {
      for (let i = 0; i < forgedSig.length; i++) {
        // saute le flash pour les slots qu'on vient de forger localement (anim. dédiée)
        if (forgedSig[i] === '1' && prevSig.current[i] === '0' && !pendingRef.current.has(i)) { setFlashSlot(i); break; }
      }
      prevSig.current = forgedSig;
    }
  }, [forgedSig]);
  // Libère l'affichage optimiste quand l'état réel reflète la face posée.
  useEffect(() => {
    if (!optimistic) return;
    const real = faces[optimistic.slot];
    if (faceSig(real) === faceSig(optimistic.face)) { pendingRef.current.delete(optimistic.slot); setOptimistic(null); }
  }, [facesSig, optimistic]);
  useEffect(() => {
    if (flashSlot == null) return undefined;
    const id = setTimeout(() => setFlashSlot(null), 800);
    return () => clearTimeout(id);
  }, [flashSlot]);
  useEffect(() => {
    if (!fusion) return undefined;
    const id = setTimeout(() => setFusion(null), 1000);
    return () => clearTimeout(id);
  }, [fusion]);

  // --- Glisser-déposer (réserve → emplacement) via POINTER CAPTURE : robuste au
  // tactile (les pointermove/up sont garantis sur la tuile, même hors d'elle).
  // Tap simple (sans déplacement) → ouvre la modale de détail (pas de forge). ---
  const dragRef = useRef({ id: null, stockIndex: null, offX: 0, offY: 0, startX: 0, startY: 0, moved: false });
  const badT = useRef(null);
  const resetDrag = () => { dragRef.current = { id: null, stockIndex: null, offX: 0, offY: 0, startX: 0, startY: 0, moved: false }; };

  const onTileDown = (e, stockIndex) => {
    const f = reserve[stockIndex]; if (!f) return;
    const r = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      id: e.pointerId, stockIndex, startX: e.clientX, startY: e.clientY, moved: false,
      offX: e.clientX - (r.left + r.width / 2), offY: e.clientY - (r.top + r.height / 2),
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onTileMove = (e) => {
    const d = dragRef.current;
    if (d.stockIndex == null || e.pointerId !== d.id) return;
    if (!d.moved) {
      if (!canEdit) return; // lecture seule : pas de drag, on garde le tap
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) <= 6) return;
      d.moved = true;
    }
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
    resetDrag();
    setDrag(null); setHoverSlot(null);
    const f = reserve[stockIndex]; if (!f) return;
    if (!moved) { setDetail({ face: f, stockIndex }); return; } // tap → modale de détail
    const targetSlot = f.slot || 1;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = el && el.closest && el.closest('[data-forge-slot]');
    const slot = slotEl ? Number(slotEl.dataset.forgeSlot) : null;
    if (canEdit && slot === targetSlot) { runForge(stockIndex); } // dépôt sur SON emplacement
    else if (slot && slot !== targetSlot) {
      setBadSlot(slot);
      clearTimeout(badT.current);
      badT.current = setTimeout(() => setBadSlot(null), 460);
    }
  };
  const onTileCancel = (e) => {
    if (e.pointerId !== dragRef.current.id) return;
    resetDrag(); setDrag(null); setHoverSlot(null);
  };
  useEffect(() => () => clearTimeout(badT.current), []);

  return (
    <div className="mob-root forge-mob" style={{ '--accent': t.color, paddingBottom: 84 }}>
      <div className="forge-mob-embers" aria-hidden="true">
        {[['22%', '14px', '5s', '0s'], ['40%', '-12px', '6.1s', '1s'], ['58%', '9px', '5.2s', '1.8s'],
          ['74%', '-8px', '5.8s', '.6s'], ['33%', '-6px', '6.4s', '2.4s'], ['66%', '11px', '4.7s', '1.4s']]
          .map(([left, drift, dur, delay], i) => (
            <span key={i} className="forge-mob-ember" style={{ left, '--drift': drift, animationDuration: dur, animationDelay: delay }} />
          ))}
      </div>

      {/* En-tête */}
      <div className="forge-mob-head">
        <span className="forge-mob-title">{en ? 'DIE FORGE' : 'FORGE DE DÉS'}</span>
      </div>

      {/* Le creuset : plaque-moule en croix (1 · 3-2-4 · 5 · 6) */}
      <div className="forge-mob-plate">
        <span className="forge-mob-bolt fmb-tl" /><span className="forge-mob-bolt fmb-tr" />
        <span className="forge-mob-bolt fmb-bl" /><span className="forge-mob-bolt fmb-br" />
        <div className="forge-mob-chan forge-mob-chan-v" />
        <div className="forge-mob-chan forge-mob-chan-h" />
        {faces.map((face, i) => {
          const slotNo = i + 1;
          // Affichage optimiste : montre la face posée même avant le retour Realtime.
          const opt = optimistic && optimistic.slot === i ? optimistic.face : null;
          const displayFace = opt || face;
          const forged = opt ? true : isFaceForged(face);
          const target = drag && drag.moved && drag.slot === slotNo;
          const hot = target && hoverSlot === slotNo;
          const bad = badSlot === slotNo;
          const fusing = fusion && fusion.slot === i;
          const inner = ['forge-mob-slot-inner']
            .concat(forged ? 'is-forged' : 'is-empty')
            .concat(flashSlot === i && !fusing ? 'is-flash' : []) // la fusion remplace le flash
            .concat(hot ? 'is-hot' : (target ? 'is-target' : []))
            .concat(bad ? (slotNo === 3 || slotNo === 4 ? 'is-bad is-bad-side' : 'is-bad') : [])
            .join(' ');
          return (
            <div key={i} className={`forge-mob-slot fms-${slotNo}`} data-forge-slot={slotNo}>
              <div
                className={inner}
                onClick={forged ? () => setDetail({ face: displayFace, stockIndex: null }) : undefined}
                role={forged ? 'button' : undefined}
              >
                {forged
                  ? <FaceTile face={displayFace} base={slotNo} size={58} title={faceEffectLabel(displayFace, en) || undefined} />
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
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* La réserve : touche une face → forge sur SON slot */}
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
                  className={`forge-mob-drag${dragging ? ' is-dragging' : ''}${canEdit ? '' : ' is-ro'}`}
                  onPointerDown={(e) => onTileDown(e, i)}
                  onPointerMove={onTileMove}
                  onPointerUp={onTileUp}
                  onPointerCancel={onTileCancel}
                >
                  <FaceTile
                    face={f}
                    size={52}
                    slotTag={f.slot}
                    clickable
                    title={faceEffectLabel(f, en) || undefined}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="forge-mob-foot">{owned ? T('mobile.forgeHintSlot') : T('mobile.forgeReadonly')}</div>
      </section>

      {/* Modale de détail : zoom sur la face + explication de son effet */}
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
              <div className="forge-mob-modal-move">
                {moveVal > 0 ? T('mobile.forgeMove', { n: moveVal, s: moveVal > 1 ? 's' : '' }) : T('mobile.forgeMoveSafe')}
              </div>
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
              {fromReserve && canEdit && (
                <>
                  {willReplace && <div className="forge-mob-modal-warn">{T('mobile.forgeWillReplace')}</div>}
                  <button
                    className="forge-mob-buy forge-mob-modal-forge"
                    onClick={() => { runForge(detail.stockIndex); setDetail(null); }}
                  >
                    🔨 {T('mobile.forgeForgeOn', { n: targetSlot })}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Fantôme suivant le doigt pendant le glisser */}
      {drag && drag.moved && (
        <div
          className="forge-mob-ghost"
          style={{ transform: `translate(${drag.x - dragRef.current.offX}px, ${drag.y - dragRef.current.offY}px) translate(-50%, -50%) rotate(-4deg) scale(1.1)` }}
          aria-hidden="true"
        >
          <FaceTile face={drag.face} size={56} />
        </div>
      )}
    </div>
  );
}

export function TeamView({ session, teamIdx, owned, code, token }) {
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
        <span className="mob-header-emoji" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TeamAvatar team={t} size={40} /></span>
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
        {Object.keys(SLOTS).map((slot) => <EquipSlot key={slot} itemKey={t.equipment?.[slot]} slot={slot} enchanted={slotEnchantCount(t, slot)} onTap={() => setSheet({ itemKey: t.equipment?.[slot], loc: { kind: 'equip', slot } })} T={T} />)}
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

// Objets concrets d'un côté d'offre (sac + équipement porté), résolus depuis
// l'équipe QUI LES POSSÈDE (`srcTeam`) pour récupérer la clé et, pour une pièce
// équipée, ses enchants. Sert à rendre chaque objet CLIQUABLE dans une offre.
function offerItemList(spec, srcTeam) {
  const out = [];
  for (const k of (spec?.bag || [])) { const key = typeof k === 'string' ? k : k?.key; if (ITEMS[key]) out.push({ itemKey: key, enchants: [] }); }
  for (const s of (spec?.equip || [])) {
    const v = srcTeam?.equipment?.[s];
    const key = typeof v === 'string' ? v : v?.key;
    if (key && ITEMS[key]) out.push({ itemKey: key, enchants: slotEnchants(srcTeam, s) });
  }
  return out;
}

// Pastilles d'objets d'une offre : chaque objet est un bouton qui ouvre sa fiche
// (effets + enchantement), pour que l'équipe DESTINATAIRE puisse inspecter ce
// qu'on lui propose. Marqueur ✦ si la pièce porte un enchantement.
function OfferItems({ spec, srcTeam, onInfo }) {
  const items = offerItemList(spec, srcTeam);
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {items.map((it, i) => {
        const item = ITEMS[it.itemKey];
        return (
          <button key={i} type="button" className="mob-offer-chip"
            onClick={() => onInfo({ itemKey: it.itemKey, team: srcTeam, enchants: it.enchants })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px',
              borderRadius: 999, border: '1px solid rgba(122,94,58,0.3)', background: '#fffefb',
              fontSize: 12.5, cursor: 'pointer', color: 'var(--ink-800,#3a2c16)',
            }}>
            <span>{item.icon}</span>
            <span style={{ fontWeight: 600 }}>{locName(item)}</span>
            {it.enchants.length > 0 && <span style={{ color: '#8d5cd6', fontWeight: 700 }}>✦</span>}
            <span style={{ opacity: 0.55, fontSize: 13 }}>ⓘ</span>
          </button>
        );
      })}
    </div>
  );
}

// Bandeau de confirmation « échange conclu », du point de vue de mon équipe.
function DealToast({ trade, teamIdx, teams, onClose, T = tFor(false) }) {
  const isTo = trade.to_idx === teamIdx;
  const received = isTo ? trade.give : trade.want;
  const gave = isTo ? trade.want : trade.give;
  const other = teams[isTo ? trade.from_idx : trade.to_idx];
  // Offre ÉCHOUÉE (or/objet manquant, ou forge occupée/sans réserve) : sans ce
  // bandeau l'offre s'évanouissait sans explication côté élève.
  if (trade.status === 'failed') {
    const isForge = !!(trade.give?.forge || trade.want?.forge);
    return (
      <div className="mob-deal-wrap" onClick={onClose}>
        <div className="mob-deal" onClick={(e) => e.stopPropagation()}>
          <div className="mob-deal-emoji">⚠️</div>
          <div className="mob-deal-title">{T('mobile.dealFailed')}</div>
          <div className="mob-deal-with">{T('mobile.dealWith', { who: other ? `${other.emoji} ${other.name}` : T('mobile.anotherTeam') })}</div>
          <div className="mob-deal-lines" style={{ textAlign: 'center' }}>{isForge ? T('mobile.dealFailedForge') : T('mobile.dealFailedTrade')}</div>
          <button className="mob-btn mob-btn--ghost" style={{ marginTop: 12 }} onClick={onClose}>{T('common.close')}</button>
        </div>
      </div>
    );
  }
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
  const [info, setInfo] = useState(null); // { itemKey, team, enchants? } : fiche d'objet ouverte
  const target = toIdx != null ? session.teams[toIdx] : null;
  // Prestation de forgeage — proposable dans les DEUX SENS :
  //  • si MOI je peux forger → je PROPOSE de forger le dé du client (give.forge) ;
  //  • sinon, si la CIBLE peut forger → je lui DEMANDE de forger mon dé (want.forge).
  // Modèle « réserve du forgeron » : le forgeron pose ses faces ACHETÉES à l'avance,
  // donc l'option n'apparaît que si le forgeron concerné a des faces en réserve.
  const hasFaces = (t) => ((t && t.faceStock) || []).length > 0;
  const meCanForge = craftEnabledFor(session.extensions, me, 'forge');
  const targetCanForge = !!target && craftEnabledFor(session.extensions, target, 'forge');
  const meProvidesForge = meCanForge && hasFaces(me);
  const someForgeronHasFaces = others.some((o) => craftEnabledFor(session.extensions, o.t, 'forge') && hasFaces(o.t));
  const canProposeForge = meProvidesForge || (!meCanForge && someForgeronHasFaces);
  const isForge = kind === 'forge';
  // Quand je propose un forgeage : si je peux forger, je fournis ; sinon je demande.
  const iProvideForge = isForge && meCanForge;
  const showKinds = hasDiplo || canProposeForge;
  const isFree = !showKinds || kind === 'free';
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
    ...(hasDiplo ? [
      { key: 'extort', label: T('mobile.extort'), desc: T('mobile.extortDesc') },
      { key: 'gift', label: T('mobile.gift'), desc: T('mobile.giftDesc') },
      { key: 'mutual', label: T('mobile.mutual'), desc: T('mobile.mutualDesc') },
      ...(canCoalition ? [{ key: 'coalition', label: T('mobile.coalition'), desc: T('mobile.coalitionDesc') }] : []),
    ] : []),
    ...(canProposeForge ? [{ key: 'forge', label: T('mobile.forgeDeal'), desc: T('mobile.forgeDealDesc') }] : []),
  ];

  const build = () => {
    const pact = { turns };
    // Forgeage (deux sens) : si JE fournis, je donne le service (give.forge) et je
    // veux un paiement ; sinon je DEMANDE (give = mon paiement, want.forge).
    if (isForge) {
      if (iProvideForge) {
        const w = {}; if (want.gold > 0) w.gold = want.gold; if (want.bag.length) w.bag = want.bag; if (want.equip.length) w.equip = want.equip;
        return { give: { forge: true }, want: w };
      }
      const g = {}; if (give.gold > 0) g.gold = give.gold; if (give.bag.length) g.bag = give.bag; if (give.equip.length) g.equip = give.equip;
      return { give: g, want: { forge: true } };
    }
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
  const valid = toIdx != null && (isForge
    ? (iProvideForge ? hasFaces(me) : (targetCanForge && hasFaces(target))) // forgeron AVEC des faces
    : ((kind !== 'coalition' || against != null) && (has(built.give) || has(built.want))));
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
          onToggle={() => toggle(spec, set, 'equip', s)} onInfo={() => setInfo({ itemKey: team.equipment[s], team, enchants: slotEnchants(team, s) })} />
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
          {others.map(({ t, i }) => {
            // Demande de forgeage (je ne suis pas forgeron) → seuls les forgerons
            // AYANT des faces en réserve sont des cibles valides.
            const forbid = isForge && !meCanForge && !(craftEnabledFor(session.extensions, t, 'forge') && hasFaces(t));
            return (
              <button key={i} disabled={forbid}
                className={'mob-trade-target' + (toIdx === i ? ' on' : '')}
                style={forbid ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                title={forbid ? T('mobile.forgeNeedsSmith') : undefined}
                onClick={() => { setToIdx(i); setWant({ gold: 0, bag: [], equip: [] }); }}>
                <TeamAvatar team={t} size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 5 }} />{t.name}{forbid ? ' 🚫' : ''}
              </button>
            );
          })}
        </div>
        {isForge && !meCanForge && (
          <div style={{ fontSize: 12, color: 'var(--ink-600)', marginTop: 4 }}>{T('mobile.forgeNeedsSmith')}</div>
        )}

        {/* Manœuvre (or/objets ou pacte) — seulement si l'extension Complots est active. */}
        {showKinds && (
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
                  <TeamAvatar team={t} size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 5 }} />{t.name}
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

        {/* Prestation de forgeage : le service s'ouvrira pour les 2 équipes une fois
            le deal accepté. Si JE fournis → je fixe le prix (objets du client) ;
            si je DEMANDE à un forgeron → je choisis ce que JE paie. */}
        {isForge && target && (iProvideForge
          ? (
            <>
              <div style={{ fontSize: 12.5, color: 'var(--ink-600)', margin: '10px 0 2px' }}>{T('mobile.forgePriceHint', { who: target.name })}</div>
              {panel(T('mobile.forgePrice'), target, want, setWant, false)}
            </>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: 'var(--ink-600)', margin: '10px 0 2px' }}>{T('mobile.forgePayHint', { who: target.name })}</div>
              {panel(T('mobile.forgePay'), me, give, setGive, true)}
            </>
          ))}

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
      <ItemSheet itemKey={info.itemKey} loc={null} team={info.team} enchants={info.enchants}
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
export function TradeView({ session, teamIdx, code, token, trades = [], hasTrade = true, hasDiplo = false }) {
  const T = tFor(session?.englishMode);
  const [deal, setDeal] = useState(false); // compositeur de deal (troc + pacte)
  const [counter, setCounter] = useState(null); // offre reçue qu'on contre (ou null)
  const [info, setInfo] = useState(null); // { itemKey, team, enchants } : fiche d'un objet d'offre
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
            <OfferItems spec={tr.give} srcTeam={session.teams[tr.from_idx]} onInfo={setInfo} />
            <div className="mob-trade-line"><b>{T('mobile.youGiveLine')}</b> {schemeText(tr.want, equipOfTeam(teamIdx), true, T, nameOf)}</div>
            <OfferItems spec={tr.want} srcTeam={me} onInfo={setInfo} />
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
            <OfferItems spec={tr.give} srcTeam={me} onInfo={setInfo} />
            <div className="mob-trade-line"><b>{T('mobile.youWantLine')}</b> {schemeText(tr.want, equipOfTeam(tr.to_idx), false, T, nameOf)}</div>
            <OfferItems spec={tr.want} srcTeam={session.teams[tr.to_idx]} onInfo={setInfo} />
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
      {info?.itemKey && (
        <ItemSheet itemKey={info.itemKey} loc={null} team={info.team} enchants={info.enchants}
          owned={false} locked={false} onAction={() => {}} onClose={() => setInfo(null)} T={T} />
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
  // Prestation de forgeage : le marqueur `forge` décrit un SERVICE (pas un objet).
  if (spec?.forge) parts.push(mine ? T('mobile.forgeLineMine') : T('mobile.forgeLineYours'));
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

      {/* Météo : le prof force une météo précise sur tout le plateau (spectacle). */}
      {extOn(session.extensions, 'weather') && (
        <div style={{ border: '2px solid #4a6da8', borderRadius: 14, padding: 12, marginBottom: 12, background: '#fffefb' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#34507e', marginBottom: 8 }}>{'🌦️'} {T('mobile.adminWeather')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {WEATHER_KEYS.map((id) => (
              <button key={id} onClick={() => send('adminWeather', { id })}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 999, border: '1.5px solid rgba(74,109,168,0.4)', background: '#eef4ff', color: '#34507e', fontWeight: 700, cursor: 'pointer', fontSize: 12.5 }}>
                {weatherIcon(id)} {weatherName(id, T.lang)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Secours prof : abandonner un duel coincé (téléphone muet, client
          déconnecté…) — aucun vainqueur, la partie reprend au tour suivant. */}
      {session.turn?.fight && (
        <div style={{ border: '2px solid #8a1f2e', borderRadius: 14, padding: 12, marginBottom: 12, background: '#fffefb' }}>
          <button
            onClick={() => send('adminFightSkip', {})}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(138,31,46,0.45)', background: '#f7d7d2', color: '#7a1320', fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 15 }}
          >
            {T('mobile.adminFightSkip')}
          </button>
          <div style={{ fontSize: 11.5, color: '#7a5e3a', marginTop: 6 }}>{T('mobile.adminFightSkipHint')}</div>
        </div>
      )}

      {teams.length === 0 && <div className="mob-empty">{T('mobile.noTeamYet')}</div>}

      {teams.map((t) => {
        const equipped = Object.keys(SLOTS).filter((s) => t.equipment?.[s]);
        const bagCells = (t.bag || []).map((c) => ({ key: cellKey(c), n: cellN(c) })).filter((c) => ITEMS[c.key]);
        return (
          <div key={t.idx} style={{ border: `2px solid ${t.color}`, borderRadius: 14, padding: 12, marginBottom: 12, background: '#fffefb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <TeamAvatar team={t} size={24} />
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
// Magie : conteneur de l'onglet ✨ — sous-onglets Table des sorts / Codex sur le
// fond nocturne .mgc-root. Les DONNÉES viennent du payload session (barre
// {stored,lastTs,regenPerMin,max} résolue au TBI, codex en clés) ; le cast part
// en intent `castSpell` — le TBI valide (coût, match, découverte, fizzle).
function MagicView({ session, teamIdx, code, token }) {
  const [sub, setSub] = useState('table');
  const team = session.teams[teamIdx];
  const en = !!session.englishMode;
  const T = tFor(en);
  // Anti-spam local : le cooldown lit lastCastAt (publié à côté de magic).
  const magic = { ...(team.magic || {}), lastCastAt: team.lastCastAt || 0 };
  return (
    // bottom = TabBar (≈60px) + encoche iOS. Le conteneur SCROLLE si le contenu
    // dépasse (petits écrans) — le bouton « Incanter » reste visible car il est
    // sticky en bas de SpellTableView.
    <div className="mgc-root" style={{ position: 'fixed', inset: 0, bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column' }}>
      <div className="mgc-seg" style={{ flex: 'none' }}>
        <button className={sub === 'table' ? 'is-on' : ''} onClick={() => setSub('table')}>{'\u{1FA84}'} {T('mobile.magic.table')}</button>
        <button className={sub === 'codex' ? 'is-on' : ''} onClick={() => setSub('codex')}>{'\u{1F4D6}'} {T('mobile.magic.codex')}</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {sub === 'table' ? (
          <SpellTableView
            magic={magic}
            knownRunes={team.knownRunes || []}
            knownSpells={team.knownSpells || []}
            teams={session.teams || []}
            myIdx={teamIdx}
            locked={!!session.locked || session.status === 'finished'}
            en={en}
            onCast={(payload) => sendIntent(code, token, 'castSpell', payload).catch(() => {})}
            bottomInset={10}
          />
        ) : (
          <CodexView knownRunes={team.knownRunes || []} knownSpells={team.knownSpells || []} faceMods={team.faceMods || {}} en={en} />
        )}
      </div>
    </div>
  );
}

function TabBar({ tab, setTab, hasShop, hasTrade, hasAlchemy, hasScribe, hasForge, hasMagic, tradeAlert = 0, T = tFor(false) }) {
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
      {hasMagic && <Tab id="magic" icon={'\u{2728}'} label={T('mobile.tabMagic')} />}
      <Tab id="history" icon={'\u{1F4DC}'} label={T('mobile.tabHistory')} />
    </nav>
  );
}

// Vue de PRESTATION DE FORGEAGE (troc + forge) : overlay collaboratif affiché sur
// les téléphones du forgeron (provider) et du client. Le forgeron pose ses faces
// (réserve mise en escrow) sur le dé du CLIENT ; double validation → pose + paiement.
function ForgeServiceView({ session, teamIdx, code, token, owned, T }) {
  const [drag, setDrag] = useState(null);        // { stockIndex, face, slot, x, y }
  const [hoverSlot, setHoverSlot] = useState(null); // n° de slot survolé (1-indexé)
  const [badSlot, setBadSlot] = useState(null);  // slot refusant le drop
  const dragRef = useRef({ id: null, stockIndex: null, moved: false, startX: 0, startY: 0, offX: 0, offY: 0 });
  const badT = useRef(null);
  const [detail, setDetail] = useState(null); // { face, kind:'reserve'|'die', slot, stockIndex }
  useEffect(() => () => clearTimeout(badT.current), []);
  const en = !!session?.englishMode;

  const fs = session.forgeService;
  const provider = fs && session.teams[fs.providerIdx];
  const customer = fs && session.teams[fs.customerIdx];
  if (!fs || !provider || !customer) return null;
  const isProvider = teamIdx === fs.providerIdx;
  const isCustomer = teamIdx === fs.customerIdx;
  if (!isProvider && !isCustomer) return null; // un tiers ne voit pas la session
  const canAct = owned && !!token;
  const placements = fs.placements || {};
  const placedStock = new Set(Object.values(placements).map(Number));
  const baseFaces = getDieFaces(customer);
  const draft = baseFaces.map((f, i) => {
    const si = placements[i];
    if (si == null) return { face: f, drafted: false };
    const sf = fs.providerStock[si];
    return { face: { base: i + 1, value: clampFaceValue(sf.value), effects: faceEffects(sf) }, drafted: true };
  });
  const available = (fs.providerStock || []).map((f, i) => ({ f, i })).filter(({ i }) => !placedStock.has(i));
  const placedCount = placedStock.size;

  const place = (stockIndex) => { if (isProvider && canAct) sendIntent(code, token, 'forgeServicePlace', { stockIndex }).catch(() => {}); };
  const remove = (slotIndex) => { if (isProvider && canAct) sendIntent(code, token, 'forgeServiceRemove', { slotIndex }).catch(() => {}); };
  const validate = () => { if (canAct) sendIntent(code, token, 'forgeServiceValidate', {}).catch(() => {}); };
  const cancel = () => { if (canAct) sendIntent(code, token, 'forgeServiceCancel', {}).catch(() => {}); };

  // --- Glisser-déposer (réserve → emplacement du dé) via pointer capture, robuste
  // au tactile. Tap simple (sans déplacement) = ouvre la fiche d'info de la face. ---
  const reset = () => { dragRef.current = { id: null, stockIndex: null, moved: false, startX: 0, startY: 0, offX: 0, offY: 0 }; };
  const onDown = (e, stockIndex) => {
    if (!isProvider || !canAct) return;
    const r = e.currentTarget.getBoundingClientRect();
    dragRef.current = { id: e.pointerId, stockIndex, moved: false, startX: e.clientX, startY: e.clientY,
      offX: e.clientX - (r.left + r.width / 2), offY: e.clientY - (r.top + r.height / 2) };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onMove = (e) => {
    const d = dragRef.current;
    if (d.stockIndex == null || e.pointerId !== d.id) return;
    if (!d.moved) { if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) <= 6) return; d.moved = true; }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = el && el.closest && el.closest('[data-fs-slot]');
    const f = fs.providerStock[d.stockIndex];
    setDrag({ stockIndex: d.stockIndex, face: f, slot: f.slot, x: e.clientX, y: e.clientY, moved: true });
    setHoverSlot(slotEl ? Number(slotEl.dataset.fsSlot) : null);
    if (e.cancelable) e.preventDefault();
  };
  const onUp = (e) => {
    const d = dragRef.current;
    if (d.stockIndex == null || e.pointerId !== d.id) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const { moved, stockIndex } = d;
    reset(); setDrag(null); setHoverSlot(null);
    const f = fs.providerStock[stockIndex]; if (!f) return;
    if (!moved) { setDetail({ face: f, kind: 'reserve', slot: f.slot, stockIndex }); return; } // tap → fiche d'info
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = el && el.closest && el.closest('[data-fs-slot]');
    const slot = slotEl ? Number(slotEl.dataset.fsSlot) : null;
    if (slot === f.slot) place(stockIndex);
    else if (slot) { setBadSlot(slot); clearTimeout(badT.current); badT.current = setTimeout(() => setBadSlot(null), 460); }
  };
  const onCancel = (e) => { if (e.pointerId !== dragRef.current.id) return; reset(); setDrag(null); setHoverSlot(null); };

  const myOk = isProvider ? fs.providerOk : fs.customerOk;
  const otherOk = isProvider ? fs.customerOk : fs.providerOk;

  // Rappel du prix (ce que le client paie).
  const price = fs.price || {};
  const priceBits = [];
  if (price.gold) priceBits.push(`🪙 ${price.gold}`);
  for (const k of (price.bag || [])) if (ITEMS[k]) priceBits.push(ITEMS[k].icon || '📦');
  for (const s of (price.equip || [])) { const k = customer.equipment?.[s]; if (k && ITEMS[k]) priceBits.push(ITEMS[k].icon || '🛡️'); }
  const priceText = priceBits.length ? priceBits.join('  ') : T('mobile.forgeFree');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 82, overflowY: 'auto', background: 'rgba(12,8,3,0.96)', backdropFilter: 'blur(3px)', padding: '20px 16px 28px', color: '#f3e9d3' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ fontSize: 34, textAlign: 'center' }}>🔨</div>
        <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 21, textAlign: 'center', color: '#ffe9b8' }}>
          {isProvider ? T('mobile.forgeSvcProviderTitle', { who: `${customer.emoji} ${customer.name}` })
                      : T('mobile.forgeSvcCustomerTitle', { who: `${provider.emoji} ${provider.name}` })}
        </div>
        <div style={{ fontSize: 13, textAlign: 'center', marginTop: 4, color: '#caa45f' }}>
          {isProvider ? T('mobile.forgeSvcProviderHint') : T('mobile.forgeSvcCustomerHint')}
        </div>

        {/* Dé du client (brouillon) — emplacements = cibles de drop */}
        <div style={{ fontSize: 13, fontWeight: 700, margin: '16px 0 6px' }}>{T('mobile.forgeSvcDie', { who: customer.name })}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, justifyItems: 'center' }}>
          {draft.map((d, i) => {
            const slotN = i + 1;
            const isBad = badSlot === slotN || (drag && hoverSlot === slotN && drag.slot !== slotN);
            const isGood = drag && hoverSlot === slotN && drag.slot === slotN;
            const ring = isBad ? '#d23b2f' : isGood ? '#7bd88f' : d.drafted ? '#ffcf6a' : null;
            return (
              <div key={`s${i}`} data-fs-slot={slotN}
                onClick={() => setDetail({ face: d.face, kind: 'die', slot: slotN })}
                style={{
                  padding: 4, borderRadius: 14, cursor: 'pointer',
                  boxShadow: ring ? `0 0 0 2px ${ring}, 0 0 12px ${ring}66` : 'none',
                  opacity: drag && drag.slot !== slotN ? 0.5 : 1, transition: 'opacity .15s, box-shadow .15s',
                }}>
                <FaceTile face={d.face} base={slotN} size={62} title={faceEffectLabel(d.face, en) || undefined} />
              </div>
            );
          })}
        </div>
        {isProvider && <div style={{ fontSize: 11, color: '#8a734f', textAlign: 'center', marginTop: 6 }}>{T('mobile.forgeSvcDrag')}</div>}

        {/* Réserve du forgeron (faces à glisser) — seulement côté forgeron */}
        {isProvider && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, margin: '16px 0 6px' }}>{T('mobile.forgeSvcReserve')}</div>
            {available.length === 0
              ? <div style={{ fontSize: 12, color: '#8a734f' }}>{T('mobile.forgeSvcReserveEmpty')}</div>
              : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {available.map(({ f, i }) => (
                    <div key={`r${i}`} style={{ touchAction: 'none', cursor: canAct ? 'grab' : 'default', opacity: drag && drag.stockIndex === i ? 0.3 : 1 }}
                      onPointerDown={(e) => onDown(e, i)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}>
                      <FaceTile face={f} size={56} slotTag={f.slot} title={faceEffectLabel(f, en) || undefined} />
                    </div>
                  ))}
                </div>}
          </>
        )}

        {/* Fantôme de glissement qui suit le doigt */}
        {drag && drag.moved && (
          <div style={{ position: 'fixed', left: drag.x - dragRef.current.offX, top: drag.y - dragRef.current.offY, transform: 'translate(-50%,-50%) rotate(-4deg) scale(1.1)', pointerEvents: 'none', zIndex: 95, filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.5))' }}>
            <FaceTile face={drag.face} size={56} />
          </div>
        )}

        {/* Prix */}
        <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,220,150,0.08)', border: '1px solid rgba(232,169,88,0.3)' }}>
          <div style={{ fontSize: 12, color: '#caa45f' }}>{T('mobile.forgeSvcPrice')}</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{priceText}</div>
        </div>

        {/* Erreur de paiement (client devenu insolvable) : on l'affiche en clair. */}
        {fs.error === 'payment' && (
          <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: 10, background: 'rgba(210,59,47,0.18)', border: '1px solid rgba(210,59,47,0.5)', color: '#ffd9d4', fontSize: 12.5, textAlign: 'center' }}>
            {T('mobile.forgeSvcPayFail')}
          </div>
        )}

        {/* Validation */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, margin: '14px 0 10px', fontSize: 13 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><TeamAvatar team={provider} size={22} /> {fs.providerOk ? '✅' : '⏳'}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><TeamAvatar team={customer} size={22} /> {fs.customerOk ? '✅' : '⏳'}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="mob-btn mob-btn--gold" style={{ flex: 2 }} disabled={!canAct || myOk || (isProvider && placedCount === 0)}
            onClick={validate}>
            {myOk ? T('mobile.forgeSvcValidated') : T('mobile.forgeSvcValidate')}
          </button>
          <button className="mob-btn mob-btn--ghost" style={{ flex: 1 }} disabled={!canAct} onClick={cancel}>{T('common.cancel')}</button>
        </div>
        {otherOk && !myOk && <div style={{ fontSize: 12, textAlign: 'center', marginTop: 8, color: '#ffd27a' }}>{T('mobile.forgeSvcWaitingYou')}</div>}
        {myOk && !otherOk && <div style={{ fontSize: 12, textAlign: 'center', marginTop: 8, color: '#caa45f' }}>{T('mobile.forgeSvcWaitingOther')}</div>}
      </div>

      {/* Fiche d'info d'une face (tap) : zoom + effets ; bouton poser/retirer (forgeron) */}
      {detail && (() => {
        const f = detail.face;
        const descs = faceEffectDescriptions(f, en);
        const moveVal = clampFaceValue(f.value);
        const fromReserve = detail.kind === 'reserve';
        const isDraftedDie = detail.kind === 'die' && placements[detail.slot - 1] != null;
        return (
          <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, zIndex: 96, background: 'rgba(8,5,2,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 320, background: 'linear-gradient(180deg,#2a2114,#1b150c)', border: '1px solid rgba(232,169,88,0.4)', borderRadius: 18, padding: 18, textAlign: 'center', color: '#f3e9d3' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <FaceTile face={f} size={120} slotTag={fromReserve ? f.slot : undefined} base={!fromReserve ? detail.slot : undefined} />
              </div>
              <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 16, color: '#ffe9b8' }}>
                {descs.length ? descs.map((d) => `${d.icon} ${d.name}`).join(' · ') : T('mobile.forgeNoEffect')}
              </div>
              <div style={{ fontSize: 13, color: '#caa45f', marginTop: 4 }}>
                {moveVal > 0 ? T('mobile.forgeMove', { n: moveVal, s: moveVal > 1 ? 's' : '' }) : T('mobile.forgeMoveSafe')}
              </div>
              {descs.length > 0 && (
                <div style={{ textAlign: 'left', marginTop: 10, fontSize: 12.5, lineHeight: 1.4 }}>
                  {descs.map((d, k) => (
                    <div key={k} style={{ marginBottom: 6 }}>
                      <div>{d.icon} {d.what}</div>
                      {d.when && <div style={{ color: '#8a734f', fontSize: 11.5 }}>{d.when}</div>}
                    </div>
                  ))}
                </div>
              )}
              {isProvider && canAct && fromReserve && (
                <button className="mob-btn mob-btn--gold" style={{ marginTop: 12, width: '100%' }}
                  onClick={() => { place(detail.stockIndex); setDetail(null); }}>
                  🔨 {T('mobile.forgeForgeOn', { n: detail.slot })}
                </button>
              )}
              {isProvider && canAct && isDraftedDie && (
                <button className="mob-btn mob-btn--ghost" style={{ marginTop: 10, width: '100%' }}
                  onClick={() => { remove(detail.slot - 1); setDetail(null); }}>
                  {T('mobile.forgeSvcRemove')}
                </button>
              )}
              <button className="mob-btn mob-btn--ghost" style={{ marginTop: 10, width: '100%' }} onClick={() => setDetail(null)}>{T('common.close')}</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Overlay bloquant « choisis ton métier » (extension « Métiers ») : affiché sur le
// téléphone du propriétaire au 1er tour tant que le métier n'est pas fixé. Envoie
// un intent `chooseMetier` ; l'overlay disparaît quand la session reflète le choix.
function MetierPickerMobile({ team, en, T, onPick }) {
  const lang = en ? 'en' : 'fr';
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, padding: 22,
      background: 'rgba(14,9,3,0.92)', backdropFilter: 'blur(3px)',
    }}>
      <div style={{ fontSize: 40 }}>⚒️</div>
      <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 22, color: '#ffe9b8', textAlign: 'center' }}>
        {T('mobile.metierTitle', { emoji: team.emoji, name: team.name })}
      </div>
      <div style={{ fontSize: 14, color: '#f3e9d3', textAlign: 'center', maxWidth: 360 }}>
        {T('mobile.metierChoose')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 380, marginTop: 6 }}>
        {METIERS.map((m) => (
          <button
            key={m.id}
            onClick={() => onPick(m.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', width: '100%',
              padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
              border: `2px solid ${m.color}`, background: `${m.color}1f`, color: '#fff',
            }}
          >
            <span style={{
              width: 50, height: 50, flexShrink: 0, borderRadius: 13, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 28,
              background: `linear-gradient(180deg, ${m.color}, ${m.color}cc)`,
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4)',
            }}>{m.icon}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-display, sans-serif)', fontSize: 18 }}>{metierName(m, lang)}</span>
              <span style={{ display: 'block', fontSize: 12.5, opacity: 0.92, lineHeight: 1.3 }}>{metierDesc(m, lang)}</span>
            </span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: '#caa45f', textAlign: 'center' }}>{T('mobile.metierLocked')}</div>
    </div>
  );
}

export default function MobileApp() {
  const [code, setCode] = useState(readInitialCode());
  const [session, setSession] = useState(null);
  // Horodatage local de la DERNIÈRE réception (fetch ou realtime) : la manette
  // affiche un bandeau « reconnexion » si l'état devient trop vieux (heartbeat
  // TBI toutes les ~15 s → silence prolongé = liaison morte).
  const [lastSync, setLastSync] = useState(0);
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
    let unsub = null;
    let retryId = null;
    let attempt = 0;
    let gen = 0; // ignore les statuts des canaux périmés (résiliation → CLOSED)
    setConnecting(true); setError(null); setSession(null);
    const receive = (data) => { if (alive && data) { setSession(data); setError(null); setLastSync(Date.now()); } };
    const refetch = () => fetchSession(code).then(receive).catch(() => {});
    // Canal auto-réparant : le WebSocket Realtime peut mourir (écran verrouillé,
    // réseau) — sur erreur/timeout on recrée le canal avec un léger backoff, et
    // à chaque (ré)abonnement réussi on refetch pour combler le trou.
    const connect = () => {
      if (!alive) return;
      const myGen = ++gen;
      unsub?.();
      unsub = subscribeSession(code, receive, (status) => {
        if (!alive || myGen !== gen) return;
        if (status === 'SUBSCRIBED') { attempt = 0; refetch(); return; }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          const delay = [1000, 3000, 10000][Math.min(attempt, 2)];
          attempt += 1;
          clearTimeout(retryId);
          retryId = setTimeout(connect, delay);
        }
      });
    };
    fetchSession(code)
      .then((data) => {
        if (!alive) return;
        if (!data) setError(tFor(false)('mobile.noGameForCode'));
        else receive(data);
        setConnecting(false);
      })
      .catch((e) => { if (alive) { setError(e.message || tFor(false)('mobile.connectFailed')); setConnecting(false); } });
    connect();
    return () => { alive = false; gen += 1; clearTimeout(retryId); unsub?.(); };
  }, [code]);

  // Rattrapage d'état : le WebSocket Realtime meurt SILENCIEUSEMENT quand le
  // téléphone verrouille l'écran ou perd le réseau — sans ceci, l'app resterait
  // figée sur un vieil état. Le payload étant un instantané complet, un simple
  // refetch au retour de visibilité / de connexion suffit à se resynchroniser.
  useEffect(() => {
    if (!code || code.length < 4) return;
    const refetch = () => { fetchSession(code).then((d) => { if (d) { setSession(d); setLastSync(Date.now()); } }).catch(() => {}); };
    const onVis = () => { if (document.visibilityState === 'visible') refetch(); };
    window.addEventListener('online', refetch);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('online', refetch);
      document.removeEventListener('visibilitychange', onVis);
    };
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
    const mineDone = trades.filter((t) => (t.status === 'applied' || t.status === 'failed') && !isDiploTrade(t) && (t.to_idx === teamIdx || t.from_idx === teamIdx));
    if (seenDeals.current === null) { seenDeals.current = new Set(mineDone.map((t) => t.id)); return; }
    const fresh = mineDone.find((t) => !seenDeals.current.has(t.id));
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
    const team = session.teams[teamIdx];
    // Crafts gatés PAR MÉTIER : avec l'extension « Métiers », l'équipe ne pratique
    // que son artisanat (sinon comportement historique : tout ouvert).
    const hasForge = craftEnabledFor(session.extensions, team, 'forge');
    // La Boutique réunit objets (extension Équipement) ET faces de dé (extension
    // Forge) : présente si l'une OU l'autre est active.
    const hasShop = extOn(session.extensions, 'equipment') || hasForge;
    // Troc : RÉSERVÉ au propriétaire de l'équipe (comme les achats). Valider ou
    // proposer un troc engage l'inventaire de l'équipe ; un téléphone qui a
    // seulement « sélectionné » une autre équipe (owned=false) ne peut pas
    // troquer à sa place (sinon il validerait le troc d'un autre groupe).
    const hasTrade = extOn(session.extensions, 'trade') && owned && !!token;
    const hasDiplo = extOn(session.extensions, 'diplomacy') && owned && !!token;
    const hasAlchemy = craftEnabledFor(session.extensions, team, 'alchemy') && owned && !!token;
    const hasScribe = craftEnabledFor(session.extensions, team, 'enchant') && owned && !!token;
    // Magie : table des sorts + codex, réservés au propriétaire (le cast engage
    // la magie de l'équipe). Pas de gating métier (la magie n'est pas un craft).
    const hasMagic = extOn(session.extensions, 'magic') && owned && !!token;
    // L'onglet « Troc » réunit trocs ouverts et complots : présent si l'une OU
    // l'autre extension est active.
    const hasExchange = hasTrade || hasDiplo;
    const view = tab === 'powers' ? <PowersView session={session} teamIdx={teamIdx} owned={owned} code={code} token={token} />
      : tab === 'shop' && hasShop ? <ShopView session={session} teamIdx={teamIdx} owned={owned} code={code} token={token} />
      : tab === 'trade' && hasExchange ? <TradeView session={session} teamIdx={teamIdx} code={code} token={token} trades={trades} hasTrade={hasTrade} hasDiplo={hasDiplo} />
      : tab === 'alchemy' && hasAlchemy ? <AlchemyView team={session.teams[teamIdx]} en={!!session?.englishMode} onCraft={(keys) => sendIntent(code, token, 'craft', { keys }).catch(() => {})} />
      : tab === 'scribe' && hasScribe ? <ScribeView team={session.teams[teamIdx]} en={!!session.englishMode} bottomInset={70} onInscribe={(parts) => { sendIntent(code, token, 'craftParchment', { parts }).catch(() => {}); }} />
      : tab === 'forge' && hasForge ? <ForgeView session={session} teamIdx={teamIdx} owned={owned} code={code} token={token} />
      : tab === 'magic' && hasMagic ? <MagicView session={session} teamIdx={teamIdx} code={code} token={token} />
      : tab === 'history' ? <HistoryView session={session} teamIdx={teamIdx} />
      : <TeamView session={session} teamIdx={teamIdx} owned={owned} code={code} token={token} />;
    // Choix de métier (extension « Métiers ») : overlay bloquant tant que le
    // propriétaire n'a pas choisi. Le TBI fait foi ; on envoie un intent.
    const metierToChoose = owned && !!token && metierPending(session.extensions, team);
    content = (
      <>
        {view}
        <TabBar tab={tab} setTab={setTab} hasShop={hasShop} hasTrade={hasExchange} hasAlchemy={hasAlchemy} hasScribe={hasScribe} hasForge={hasForge} hasMagic={hasMagic} tradeAlert={tradeAlert} T={T} />
        {metierToChoose && (
          <MetierPickerMobile
            team={team} en={!!session?.englishMode} T={T}
            onPick={(craft) => sendIntent(code, token, 'chooseMetier', { craft }).catch(() => {})}
          />
        )}
        {session.forgeService
          && (session.forgeService.providerIdx === teamIdx || session.forgeService.customerIdx === teamIdx)
          && <ForgeServiceView session={session} teamIdx={teamIdx} code={code} token={token} owned={owned} T={T} />}
        {/* Manette téléphone : overlay de pilotage du tour, UNIQUEMENT sur le
            téléphone PROPRIÉTAIRE de l'équipe active (toggle Setup `controller`).
            La cinématique de hack et le picker de métier gardent la priorité. */}
        {owned && !!token && session.controller && session.status === 'playing'
          && session.turn && session.turn.team === teamIdx && !team.hacked
          && <ControllerView session={session} teamIdx={teamIdx} code={code} token={token} T={T} lastSync={lastSync} />}
        {/* Duel Curioscope (guessr) : les DEUX duellistes placent leur pin sur
            leur téléphone — y compris le défenseur, qui n'est pas l'équipe
            active (l'écran partagé n'affiche que la photo + la révélation). */}
        {owned && !!token && session.controller && session.status === 'playing'
          && session.turn?.fight?.curio && session.turn.fight.phase === 'minigame'
          && (session.turn.fight.attackerIndex === teamIdx || session.turn.fight.defenderIndex === teamIdx)
          && !team.hacked
          && (
            <CurioPlaceView
              fight={session.turn.fight}
              teams={session.teams}
              mySide={session.turn.fight.attackerIndex === teamIdx ? 'attacker' : 'defender'}
              onValidate={(pos) => sendIntent(code, token, 'turnCurioValidate', { x: pos.x, y: pos.y }).catch(() => {})}
              onNext={() => sendIntent(code, token, 'turnCurioNext', {}).catch(() => {})}
            />
          )}
        {/* Duel silhouette (« Qui est ce Pokémon ?! ») : le plateau TV s'affiche
            sur l'écran partagé, les DEUX duellistes répondent ICI (le défenseur
            n'est pas l'équipe active). Récompense et fermeture aussi au
            téléphone — l'écran TV n'est pas forcément tactile. */}
        {owned && !!token && session.controller && session.status === 'playing'
          && (
            // TOUTE course à la question (duel éclair de repli, silhouette WTP…)
            session.turn?.fight?.race
            // … et l'écran récompense/résultat du Curioscope (le placement, lui,
            // vit dans CurioPlaceView) — zéro tap sur la TV.
            || (session.turn?.fight?.curio && ['reward', 'result'].includes(session.turn.fight.phase))
          )
          && !session.turn?.fight?.pkmn && !session.turn?.fight?.memory && !session.turn?.fight?.chess && !session.turn?.fight?.hack && !session.turn?.fight?.wizard && !session.turn?.fight?.mapevent
          && ['minigame', 'reward', 'result'].includes(session.turn.fight.phase)
          && (session.turn.fight.attackerIndex === teamIdx || session.turn.fight.defenderIndex === teamIdx)
          && !team.hacked
          && (
            <DuelRaceView
              fight={session.turn.fight}
              teams={session.teams}
              myTeamIdx={teamIdx}
              onBegin={() => sendIntent(code, token, 'turnFightBegin', {}).catch(() => {})}
              onAnswer={(i) => sendIntent(code, token, 'turnFightAnswer', { index: i }).catch(() => {})}
              onReward={(c) => sendIntent(code, token, 'turnFightReward', { choice: c }).catch(() => {})}
              onClose={() => sendIntent(code, token, 'turnFightClose', {}).catch(() => {})}
            />
          )}
        {/* Duel Memory (paires) : plateau TV en lecture seule sur l'écran
            partagé, les DEUX duellistes retournent les cartes ICI quand c'est
            leur tour. Récompense/fermeture aussi au téléphone. */}
        {owned && !!token && session.controller && session.status === 'playing'
          && session.turn?.fight?.memory
          && ['minigame', 'reward', 'result'].includes(session.turn.fight.phase)
          && (session.turn.fight.attackerIndex === teamIdx || session.turn.fight.defenderIndex === teamIdx)
          && !team.hacked
          && (
            <MemoryDuelView
              fight={session.turn.fight}
              teams={session.teams}
              myTeamIdx={teamIdx}
              onFlip={(i) => sendIntent(code, token, 'turnMemoryFlip', { index: i }).catch(() => {})}
              onReward={(c) => sendIntent(code, token, 'turnFightReward', { choice: c }).catch(() => {})}
              onClose={() => sendIntent(code, token, 'turnFightClose', {}).catch(() => {})}
            />
          )}
        {/* Duel d'échecs (mat en N) : les deux échiquiers en lecture seule sur
            l'écran partagé, chaque duelliste joue SON problème ICI (le défenseur
            n'est pas l'équipe active). Récompense/fermeture aussi au téléphone. */}
        {owned && !!token && session.controller && session.status === 'playing'
          && session.turn?.fight?.chess
          && ['minigame', 'reward', 'result'].includes(session.turn.fight.phase)
          && (session.turn.fight.attackerIndex === teamIdx || session.turn.fight.defenderIndex === teamIdx)
          && !team.hacked
          && (
            <ChessDuelView
              fight={session.turn.fight}
              teams={session.teams}
              myTeamIdx={teamIdx}
              onMove={(mv) => sendIntent(code, token, 'turnChessMove', { from: mv.from, to: mv.to, promotion: mv.promotion }).catch(() => {})}
              onReward={(c) => sendIntent(code, token, 'turnFightReward', { choice: c }).catch(() => {})}
              onClose={() => sendIntent(code, token, 'turnFightClose', {}).catch(() => {})}
            />
          )}
        {/* Cyber-duel (hacking) : les deux terminaux en lecture seule sur l'écran
            partagé, chaque duelliste choisit son langage puis complète l'exploit
            ICI (le défenseur n'est pas l'équipe active). Reward/close au téléphone. */}
        {owned && !!token && session.controller && session.status === 'playing'
          && session.turn?.fight?.hack
          && ['minigame', 'reward', 'result'].includes(session.turn.fight.phase)
          && (session.turn.fight.attackerIndex === teamIdx || session.turn.fight.defenderIndex === teamIdx)
          && !team.hacked
          && (
            <HackDuelView
              fight={session.turn.fight}
              teams={session.teams}
              myTeamIdx={teamIdx}
              onPickLang={(lang) => sendIntent(code, token, 'turnHackLang', { lang }).catch(() => {})}
              onPick={(tok) => sendIntent(code, token, 'turnHackPick', { token: tok }).catch(() => {})}
              onReward={(c) => sendIntent(code, token, 'turnFightReward', { choice: c }).catch(() => {})}
              onClose={() => sendIntent(code, token, 'turnFightClose', {}).catch(() => {})}
            />
          )}
        {/* Duel de sorciers (« Priori Incantatem ») : le rai partagé sur l'écran
            partagé, les DEUX duellistes répondent à la MÊME question ICI (le
            défenseur n'est pas l'équipe active). Reward/close au téléphone. */}
        {owned && !!token && session.controller && session.status === 'playing'
          && session.turn?.fight?.wizard
          && ['minigame', 'reward', 'result'].includes(session.turn.fight.phase)
          && (session.turn.fight.attackerIndex === teamIdx || session.turn.fight.defenderIndex === teamIdx)
          && !team.hacked
          && (
            <WizardDuelView
              fight={session.turn.fight}
              teams={session.teams}
              myTeamIdx={teamIdx}
              onHit={(noteId, spellIndex, dt) => sendIntent(code, token, 'turnWizardHit', { noteId, spellIndex, dt }).catch(() => {})}
              onReward={(c) => sendIntent(code, token, 'turnFightReward', { choice: c }).catch(() => {})}
              onClose={() => sendIntent(code, token, 'turnFightClose', {}).catch(() => {})}
            />
          )}
        {/* Duel « Chroniques de la Terre du Milieu » (lieu → événement) : la carte
            partagée sur l'écran partagé, les DEUX duellistes répondent à la carte
            ICI (le défenseur n'est pas l'équipe active). Reward/close au téléphone. */}
        {owned && !!token && session.controller && session.status === 'playing'
          && session.turn?.fight?.mapevent
          && ['minigame', 'reward', 'result'].includes(session.turn.fight.phase)
          && (session.turn.fight.attackerIndex === teamIdx || session.turn.fight.defenderIndex === teamIdx)
          && !team.hacked
          && (
            <MapeventDuelView
              fight={session.turn.fight}
              teams={session.teams}
              myTeamIdx={teamIdx}
              onAnswer={(choiceId) => sendIntent(code, token, 'turnMapeventAnswer', { choiceId }).catch(() => {})}
              onReward={(c) => sendIntent(code, token, 'turnFightReward', { choice: c }).catch(() => {})}
              onClose={() => sendIntent(code, token, 'turnFightClose', {}).catch(() => {})}
            />
          )}
        {/* Combat Pokémon : la TV n'affiche que la scène, le téléphone devient
            une GAME BOY (draft, choix secrets, remplaçants, récompense). */}
        {owned && !!token && session.controller && session.status === 'playing'
          && session.turn?.fight?.pkmn
          && ['minigame', 'reward', 'result'].includes(session.turn.fight.phase)
          && (session.turn.fight.attackerIndex === teamIdx || session.turn.fight.defenderIndex === teamIdx)
          && !team.hacked
          && (
            <PkmnGameboyView
              fight={session.turn.fight}
              teams={session.teams}
              myTeamIdx={teamIdx}
              onPick={(monId) => sendIntent(code, token, 'turnPkmnPick', { monId }).catch(() => {})}
              onValidate={() => sendIntent(code, token, 'turnPkmnValidate', {}).catch(() => {})}
              onChoose={(a) => sendIntent(code, token, 'turnPkmnChoose', a).catch(() => {})}
              onReplace={(i) => sendIntent(code, token, 'turnPkmnReplace', { index: i }).catch(() => {})}
              onReward={(c) => sendIntent(code, token, 'turnFightReward', { choice: c }).catch(() => {})}
              onClose={() => sendIntent(code, token, 'turnFightClose', {}).catch(() => {})}
            />
          )}
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
      {/* « Hacking » : cinématique plein écran en BOUCLE, UNIQUEMENT sur le
          téléphone du groupe piraté, dès le déclenchement et jusqu'à la
          résolution (l'app devient inutilisable). */}
      {teamIdx != null && session?.teams?.[teamIdx]?.hacked && (
        <HackCinematic en={!!session.englishMode}
          victim={session.teams[teamIdx].name} by={session.teams[teamIdx].hackedBy} />
      )}
    </>
  );
}
