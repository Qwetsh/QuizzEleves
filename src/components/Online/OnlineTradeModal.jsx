// Troc « jeu en ligne » — modale PC native (remplace l'onglet téléphone du
// tiroir). Deux colonnes symétriques (JE DONNE ↔ JE DEMANDE), clic sur les
// objets pour composer, offres reçues/envoyées en tête. Mêmes données que le
// téléphone : table quete_trades (createTrade/setTradeStatus), application
// atomique par le TradeConsumer de l'hôte à l'acceptation.
//
// v1 volontairement centrée sur l'échange (or / sac / équipement) + pacte de
// non-agression (extension Complots). La prestation de forgeage reste à venir.
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { createTrade, setTradeStatus } from '../../logic/sessionConfig';
import { extOn } from '../../extensions/registry';
import { ITEMS, SLOTS } from '../../data/items';
import { normalizeBag, cellKey, cellN } from '../../store/itemHandlers';
import { itemImg } from '../../logic/itemAssets';
import { locName } from '../../i18n/content';
import { PACT_DEFAULT_TURNS, PACT_MIN_TURNS, PACT_MAX_TURNS } from '../../logic/pacts';
import { soundClick } from '../../logic/sounds';
import TeamAvatar from '../TeamAvatar';
import { TemplePanel } from '../Modals/TempleDecor';
import { useT } from '../../i18n';
import '../../styles/inventory.css';
import '../../styles/shop.css';

const EMPTY = () => ({ gold: 0, bag: [], equip: [], pact: false, pactTurns: PACT_DEFAULT_TURNS });

// Petite puce cliquable pour un objet (sac ou équipement).
function ItemChip({ itemKey, count = 1, slotLabel, selected, onToggle }) {
  const item = ITEMS[itemKey];
  if (!item) return null;
  const img = itemImg(item);
  return (
    <button
      type="button"
      onClick={() => { soundClick(); onToggle(); }}
      title={locName(item)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
        borderRadius: 10, cursor: 'pointer', fontSize: 13, lineHeight: 1.1,
        border: selected ? '2px solid #2c7a4f' : '1px solid rgba(122,94,58,0.35)',
        background: selected ? 'rgba(44,122,79,0.14)' : '#fffdf6',
        color: '#3d2f1c', maxWidth: 170,
      }}
    >
      {img ? <img src={img} alt="" draggable={false} style={{ width: 22, height: 22 }} /> : <span>{item.icon}</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {locName(item)}{count > 1 ? ` ×${count}` : ''}{slotLabel ? ` (${slotLabel})` : ''}
      </span>
      {selected && <span style={{ color: '#2c7a4f', fontWeight: 800 }}>✓</span>}
    </button>
  );
}

// Colonne de composition : or + objets d'UNE équipe (la mienne ou la cible).
function SideColumn({ title, team, spec, setSpec, pactLabel, T }) {
  const bag = normalizeBag(team?.bag).filter(Boolean);
  const equipment = team?.equipment || {};
  const toggleBag = (key) => setSpec((s) => ({ ...s, bag: s.bag.includes(key) ? s.bag.filter((k) => k !== key) : [...s.bag, key] }));
  const toggleEquip = (slot) => setSpec((s) => ({ ...s, equip: s.equip.includes(slot) ? s.equip.filter((k) => k !== slot) : [...s.equip, slot] }));
  const maxGold = team?.money ?? 0;
  return (
    <div style={{ flex: 1, minWidth: 0, background: 'rgba(255,253,246,0.65)', border: '1px solid rgba(122,94,58,0.3)', borderRadius: 14, padding: 10 }}>
      <div style={{ fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: '#3d2f1c' }}>
        {team && <TeamAvatar team={team} size={20} />} {title}
      </div>
      {/* Or : saisie directe bornée par la cagnotte visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 14, color: '#3d2f1c' }}>
        <span className="coin" />
        <input
          type="number" min={0} max={maxGold} value={spec.gold}
          onChange={(e) => setSpec((s) => ({ ...s, gold: Math.max(0, Math.min(maxGold, Math.trunc(+e.target.value || 0))) }))}
          style={{ width: 80, padding: '4px 6px', borderRadius: 8, border: '1px solid rgba(122,94,58,0.4)', background: '#fff', fontSize: 14 }}
        />
        <span style={{ opacity: 0.65, fontSize: 12 }}>/ {maxGold}</span>
      </div>
      {/* Objets du sac + équipement portés (clic = ajouter/retirer du deal) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[...new Set(bag.map((c) => cellKey(c)))].map((key) => (
          <ItemChip key={`b-${key}`} itemKey={key} count={cellN(bag.find((c) => cellKey(c) === key))}
            selected={spec.bag.includes(key)} onToggle={() => toggleBag(key)} />
        ))}
        {Object.entries(equipment).filter(([, v]) => v).map(([slot, cell]) => (
          <ItemChip key={`e-${slot}`} itemKey={cellKey(cell)} slotLabel={locName(SLOTS[slot])}
            selected={spec.equip.includes(slot)} onToggle={() => toggleEquip(slot)} />
        ))}
        {bag.length === 0 && !Object.values(equipment).some(Boolean) && (
          <span style={{ fontSize: 12, opacity: 0.6 }}>—</span>
        )}
      </div>
      {/* Pacte de non-agression (Complots) */}
      {pactLabel && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 13, color: '#3d2f1c', cursor: 'pointer' }}>
          <input type="checkbox" checked={spec.pact} onChange={(e) => setSpec((s) => ({ ...s, pact: e.target.checked }))} />
          🕊️ {pactLabel}
          {spec.pact && (
            <input
              type="number" min={PACT_MIN_TURNS} max={PACT_MAX_TURNS} value={spec.pactTurns}
              onChange={(e) => setSpec((s) => ({ ...s, pactTurns: Math.max(PACT_MIN_TURNS, Math.min(PACT_MAX_TURNS, Math.trunc(+e.target.value || PACT_DEFAULT_TURNS))) }))}
              style={{ width: 54, padding: '2px 4px', borderRadius: 6, border: '1px solid rgba(122,94,58,0.4)' }}
            />
          )}
          {spec.pact && <span style={{ fontSize: 12, opacity: 0.7 }}>{T('modal.trade.turns')}</span>}
        </label>
      )}
    </div>
  );
}

// Résumé lisible d'un côté d'offre (« 12 or · Casque · pacte 3 tours »).
function specText(spec, T) {
  const parts = [];
  if (spec?.gold) parts.push(`${spec.gold} 🪙`);
  for (const k of spec?.bag || []) parts.push(locName(ITEMS[k]) || k);
  // `equip` liste des NOMS DE SLOT (head/body/feet) — l'objet exact dépend de
  // l'équipe source ; on affiche le slot, comme le récap téléphone.
  for (const s of spec?.equip || []) parts.push(locName(SLOTS[s]) || s);
  if (spec?.pact) parts.push(T('modal.trade.pactShort', { n: spec.pact.turns ?? PACT_DEFAULT_TURNS }));
  if (spec?.forge) parts.push('🔨');
  if (spec?.coalition) parts.push('⚔️');
  return parts.length ? parts.join(' · ') : '—';
}

export default function OnlineTradeModal({ open, onClose, teamIdx, trades = [] }) {
  const T = useT();
  const teams = useGameStore((s) => s.teams);
  const code = useGameStore((s) => s._onlineCode);
  const token = useGameStore((s) => s._onlineToken);
  const hasDiplo = useGameStore((s) => extOn(s.extensions, 'diplomacy'));
  const [target, setTarget] = useState(null);
  const [give, setGive] = useState(EMPTY());
  const [want, setWant] = useState(EMPTY());
  const [sent, setSent] = useState(false);

  if (!open) return null;
  const me = teams[teamIdx];
  if (!me) return null;

  const received = trades.filter((t) => t.to_idx === teamIdx && t.status === 'pending');
  const mine = trades.filter((t) => t.from_idx === teamIdx && t.status === 'pending');
  const nameOf = (i) => teams[i] ? `${teams[i].emoji} ${teams[i].name}` : '?';

  const build = (s) => {
    const out = {};
    if (s.gold > 0) out.gold = s.gold;
    if (s.bag.length) out.bag = s.bag;
    if (s.equip.length) out.equip = s.equip;
    if (hasDiplo && s.pact) out.pact = { turns: s.pactTurns };
    return out;
  };
  const hasContent = (o) => !!(o.gold || o.bag?.length || o.equip?.length || o.pact);
  const builtGive = build(give);
  const builtWant = build(want);
  const canSend = target != null && (hasContent(builtGive) || hasContent(builtWant));

  const doSend = () => {
    soundClick();
    createTrade(code, token, teamIdx, target, builtGive, builtWant).catch(() => {});
    setGive(EMPTY()); setWant(EMPTY()); setTarget(null);
    setSent(true); setTimeout(() => setSent(false), 2500);
  };

  return (
    <TemplePanel title={T('modal.trade.title')} team={me} onClose={onClose} medallion={<span style={{ fontSize: 22 }}>🤝</span>} className="shop">
      <div className="inv-wood">
        <div className="shop-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 12 }}>

          {/* --- Offres reçues --- */}
          <section>
            <div style={{ fontWeight: 800, color: '#f4e8cf', marginBottom: 6 }}>📥 {T('mobile.offersReceived')} {received.length > 0 && `(${received.length})`}</div>
            {received.length === 0 && <div style={{ fontSize: 13, color: '#d8c9a8', opacity: 0.8 }}>{T('modal.trade.none')}</div>}
            {received.map((tr) => (
              <div key={tr.id} style={{ background: 'rgba(255,253,246,0.9)', borderRadius: 12, padding: 10, marginBottom: 8, color: '#3d2f1c' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{nameOf(tr.from_idx)}</div>
                <div style={{ fontSize: 13 }}><b>{T('mobile.youReceiveLine')}</b> {specText(tr.give, T)}</div>
                <div style={{ fontSize: 13 }}><b>{T('mobile.youGiveLine')}</b> {specText(tr.want, T)}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="shop-buy" style={{ width: 'auto', padding: '6px 14px' }}
                    onClick={() => { soundClick(); setTradeStatus(tr.id, 'accepted').catch(() => {}); }}>
                    ✓ {T('mobile.accept')}
                  </button>
                  <button className="shop-buy" style={{ width: 'auto', padding: '6px 14px', filter: 'saturate(0.4)' }}
                    onClick={() => { soundClick(); setTradeStatus(tr.id, 'declined').catch(() => {}); }}>
                    ✕ {T('mobile.decline')}
                  </button>
                </div>
              </div>
            ))}
          </section>

          {/* --- Mes offres en attente --- */}
          {mine.length > 0 && (
            <section>
              <div style={{ fontWeight: 800, color: '#f4e8cf', marginBottom: 6 }}>📤 {T('mobile.offersSent')}</div>
              {mine.map((tr) => (
                <div key={tr.id} style={{ background: 'rgba(255,253,246,0.75)', borderRadius: 12, padding: 10, marginBottom: 8, color: '#3d2f1c', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <b>{nameOf(tr.to_idx)}</b> — {T('mobile.youGiveLine')} {specText(tr.give, T)} · {T('mobile.youWantLine')} {specText(tr.want, T)}
                  </div>
                  <button className="shop-buy" style={{ width: 'auto', padding: '6px 12px', filter: 'saturate(0.4)' }}
                    onClick={() => { soundClick(); setTradeStatus(tr.id, 'cancelled').catch(() => {}); }}>
                    ✕ {T('modal.trade.cancel')}
                  </button>
                </div>
              ))}
            </section>
          )}

          {/* --- Compositeur --- */}
          <section>
            <div style={{ fontWeight: 800, color: '#f4e8cf', marginBottom: 6 }}>✍️ {T('modal.trade.compose')}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {teams.map((t, i) => i !== teamIdx && (
                <button key={i} type="button"
                  onClick={() => { soundClick(); setTarget(target === i ? null : i); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
                    border: target === i ? '2px solid #66ff8a' : '1px solid rgba(255,253,246,0.4)',
                    background: target === i ? 'rgba(102,255,138,0.15)' : 'rgba(255,253,246,0.12)', color: '#f4e8cf', fontSize: 13,
                  }}>
                  <TeamAvatar team={t} size={18} /> {t.name}
                </button>
              ))}
            </div>
            {target != null && (
              <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                  <SideColumn title={T('mobile.iGive')} team={me} spec={give} setSpec={setGive}
                    pactLabel={hasDiplo ? T('modal.trade.peaceGive', { who: teams[target].name }) : null} T={T} />
                  <div style={{ alignSelf: 'center', fontSize: 22, color: '#f4e8cf' }}>⇄</div>
                  <SideColumn title={T('mobile.iWantFrom', { who: teams[target].emoji })} team={teams[target]} spec={want} setSpec={setWant}
                    pactLabel={hasDiplo ? T('modal.trade.peaceWant', { who: teams[target].name }) : null} T={T} />
                </div>
                <button className="shop-buy" disabled={!canSend} style={{ marginTop: 10 }} onClick={doSend}>
                  🤝 {T('mobile.send')}
                </button>
              </>
            )}
            {sent && <div style={{ marginTop: 8, color: '#9fe8b0', fontSize: 13 }}>✓ {T('modal.trade.sentOk')}</div>}
            <div style={{ marginTop: 8, fontSize: 12, color: '#d8c9a8', opacity: 0.8 }}>{T('mobile.tradeFoot')}</div>
          </section>
        </div>
      </div>
    </TemplePanel>
  );
}
