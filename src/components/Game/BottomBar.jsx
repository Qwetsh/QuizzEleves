import { useState, useEffect, useRef } from 'react';
import { POWERS } from '../../data/powers';
import { SUBJECTS } from '../../data/subjects';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { cellKey, cellN, cellEnchants } from '../../store/itemHandlers';
import { itemImg } from '../../logic/itemAssets';
import { getTeamEffects } from '../../logic/teamStatus';
import { useGameStore } from '../../store/gameStore';
import '../../styles/team-strip-hud.css';

const TILE_TYPES = {
  depart:   { icon: '\u{1F3F0}', label: 'Départ' },
  arrivee:  { icon: '\u{1F3C6}', label: 'Arrivée' },
  jonction: { icon: '\u{1F3B2}', label: 'Carrefour' },
  event:    { icon: '✨',    label: 'Événement' },
};

function biomeKey(subjectId) {
  return subjectId === 'geographie' ? 'geo' : subjectId;
}

// Liste des pouvoirs possédés d'une équipe (def, off, puis achats)
function powerKeysOf(team) {
  const powers = team.powers || {};
  const { powerDef: defKey, powerOff: offKey } = team;
  return [
    ...(defKey && powers[defKey] ? [defKey] : []),
    ...(offKey && offKey !== defKey && powers[offKey] ? [offKey] : []),
    ...Object.keys(powers).filter((k) => k !== defKey && k !== offKey && POWERS[k]),
  ];
}

// Badge détaillé (carte active + popover)
function PowerBadge({ powerKey, charges, level, kindLabel }) {
  const info = POWERS[powerKey];
  if (!info) return null;
  return (
    <div
      className={'power-badge ' + (charges <= 0 ? 'is-empty' : '')}
      style={{ '--power-color': info.color }}
      title={`${info.name} — Niv.${level} — ${charges} charge${charges > 1 ? 's' : ''}\n${info.desc}`}
    >
      <div className="power-badge-disc">
        <span className="power-badge-icon">{info.icon}</span>
        <span className="power-badge-count">{charges}</span>
        {level > 1 && <span className="power-badge-level">{level}</span>}
      </div>
      <div className="power-badge-meta">
        <div className="power-badge-kind">{kindLabel}</div>
        <div className="power-badge-name">{info.name}</div>
      </div>
    </div>
  );
}

// Disque seul (cartes inactives compactes)
function PowerDisc({ powerKey, charges, level }) {
  const info = POWERS[powerKey];
  if (!info) return null;
  return (
    <div
      className={'power-disc ' + (charges <= 0 ? 'is-empty' : '')}
      style={{ '--power-color': info.color }}
      title={`${info.name} — Niv.${level} — ${charges} charge${charges > 1 ? 's' : ''}`}
    >
      <span className="power-disc-icon">{info.icon}</span>
      <span className="power-disc-count">{charges}</span>
    </div>
  );
}

// Mini-icônes d'équipement (3 slots) + compteur de sac
function EquipmentStrip({ team, className }) {
  const equipment = team.equipment || {};
  const bag = (team.bag || []).filter(Boolean);
  if (!Object.values(equipment).some(Boolean) && bag.length === 0) return null;

  return (
    <div className={'ts-eq ' + (className || '')}>
      {Object.keys(SLOTS).map((slot) => {
        const item = ITEMS[cellKey(equipment[slot])];
        const ench = cellEnchants(equipment[slot]).length;
        const color = item ? (RARITIES[item.rarity]?.color || '#888') : null;
        return (
          <span
            key={slot}
            className="ts-eq-slot"
            title={item ? `${SLOTS[slot].name} : ${item.name}${ench ? ` (✦ enchanté ×${ench})` : ''}\n${item.desc}` : `${SLOTS[slot].name} : vide`}
            style={{
              position: 'relative',
              background: item ? `linear-gradient(180deg, ${color}cc, ${color})` : 'rgba(122,94,58,0.1)',
              border: item ? `1px solid ${color}` : '1px dashed rgba(122,94,58,0.3)',
              opacity: item ? 1 : 0.5,
            }}
          >
            {item
              ? (itemImg(item)
                  ? <img src={itemImg(item)} alt="" style={{ width: '86%', height: '86%', objectFit: 'contain' }} />
                  : item.icon)
              : SLOTS[slot].icon}
            {item && ench > 0 && <span style={{ position: 'absolute', top: -5, right: -5, background: 'linear-gradient(180deg,#b07de0,#8a4fc0)', color: '#fff', fontSize: 9, fontWeight: 800, minWidth: 13, height: 13, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fffdf7' }}>✦</span>}
          </span>
        );
      })}
      {bag.length > 0 && (
        <span className="ts-eq-bag" title={`Sac : ${bag.map((c) => { const it = ITEMS[cellKey(c)]; return it ? it.name + (cellN(c) > 1 ? ` ×${cellN(c)}` : '') : null; }).filter(Boolean).join(', ')}`}>
          {'\u{1F9F3}'} {bag.reduce((s, c) => s + cellN(c), 0)}
        </span>
      )}
    </div>
  );
}

// Pastilles de stats (or, bonnes/mauvaises réponses, taux)
function StatChips({ team, withRate = true }) {
  const totalQ = (team.correct ?? 0) + (team.wrong ?? 0);
  const winRate = totalQ > 0 ? Math.round((team.correct / totalQ) * 100) : null;
  return (
    <div className="ts-card-stats">
      <div className="ts-stat ts-stat--coin" title="Pièces d'or">
        <span className="coin ts-stat-coin" /><span className="ts-stat-num">{team.money ?? 0}</span>
      </div>
      <div className="ts-stat ts-stat--good" title="Bonnes réponses">
        <span className="ts-stat-ico">{'✓'}</span><span className="ts-stat-num">{team.correct ?? 0}</span>
      </div>
      <div className="ts-stat ts-stat--bad" title="Erreurs">
        <span className="ts-stat-ico">{'✗'}</span><span className="ts-stat-num">{team.wrong ?? 0}</span>
      </div>
      {withRate && winRate !== null && (
        <div className="ts-stat ts-stat--rate" title="Taux de réussite">
          <span className="ts-stat-ico">{'◎'}</span><span className="ts-stat-num">{winRate}<small>%</small></span>
        </div>
      )}
    </div>
  );
}

// Buffs/protections actifs (bouclier, fumigène, +temps, rafale, défi) — pastilles
// compactes dans la bande. Source : getTeamEffects (tone 'buff').
function TeamBuffs({ team }) {
  const buffs = getTeamEffects(team).filter((e) => e.tone === 'buff');
  if (!buffs.length) return null;
  return (
    <div className="ts-buffs" style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {buffs.map((b) => (
        <span key={b.key} title={b.label} style={{
          display: 'inline-flex', alignItems: 'center', gap: 1,
          padding: '1px 6px', borderRadius: 999, fontSize: 13, lineHeight: 1.4,
          background: `${b.color}22`, border: `1px solid ${b.color}66`,
        }}>
          {b.icon}{b.n ? <small style={{ fontWeight: 700 }}>{b.n}</small> : ''}
        </span>
      ))}
    </div>
  );
}

// Malus en attente (question imposée, timer réduit, malédictions…) — affichés
// en ICÔNES seules (pastilles rouges) pour ne pas décaler la fiche quand il y
// en a beaucoup. Le détail (libellés) s'affiche dans un popover AU CLIC.
// Source : getTeamEffects (tone 'malus').
function TeamMalus({ team }) {
  const malus = getTeamEffects(team).filter((e) => e.tone === 'malus');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);
  if (!malus.length) return null;
  return (
    <div ref={ref} className="ts-malus" style={{ position: 'relative', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
      {malus.map((m) => (
        <button
          key={m.key}
          type="button"
          title={m.label}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            minWidth: 24, height: 24, padding: m.n ? '0 6px' : 0,
            borderRadius: 999, fontSize: 14, lineHeight: 1, cursor: 'pointer',
            color: '#7a1320', background: '#f7d7d2', border: '1.5px solid #c9472f',
            boxShadow: '0 1px 2px rgba(201,71,47,0.3)',
          }}
        >
          <span>{m.icon}</span>{m.n ? <small style={{ fontWeight: 700, fontSize: 11 }}>{m.n}</small> : ''}
        </button>
      ))}
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 130,
            minWidth: 170, maxWidth: 250, padding: '8px 10px', borderRadius: 10,
            background: '#fffaf7', border: '1.5px solid #c9472f',
            boxShadow: '0 8px 22px rgba(46,31,16,0.30)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#7a1320', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Malus actifs ({malus.length})
          </div>
          {malus.map((m) => (
            <div key={m.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, color: 'var(--ink-800)', lineHeight: 1.3 }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>{m.icon}</span>
              <span>{m.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamLocation({ team }) {
  const board = useGameStore((s) => s.board);
  const node = board?.[team.pos];
  const subject = node?.subject && node.subject !== 'multi' ? SUBJECTS[node.subject] : null;
  const tileType = node ? TILE_TYPES[node.type] : null;
  return (
    <div className="ts-card-location">
      {subject ? (
        <>
          <span className="ts-card-location-ico" style={{
            background: `var(--m-${biomeKey(node.subject)}-soft)`,
            color: `var(--m-${biomeKey(node.subject)}-deep)`,
          }}>{subject.icon}</span>
          <span className="ts-card-location-text">{subject.biome}</span>
        </>
      ) : tileType ? (
        <>
          <span className="ts-card-location-ico ts-card-location-ico--neutral">{tileType.icon}</span>
          <span className="ts-card-location-text">{tileType.label}</span>
        </>
      ) : (
        <span className="ts-card-location-text" style={{ opacity: 0.5 }}>En attente…</span>
      )}
    </div>
  );
}

function Blazon({ team, size }) {
  return (
    <div className="ts-card-blazon">
      <div className="ts-blazon-disc" style={{
        width: size, height: size, borderRadius: size * 0.28, fontSize: size * 0.5,
        background: `linear-gradient(135deg, ${team.color}, ${team.color}cc)`,
      }}>{team.emoji}</div>
    </div>
  );
}

// Détail complet (popover au tap d'une équipe inactive) — réutilisé en Phase 2 (mobile)
function TeamDetailPopover({ team, rank, total, onClose }) {
  const equipment = team.equipment || {};
  const bag = (team.bag || []).filter(Boolean);
  const pKeys = powerKeysOf(team);
  return (
    <div className="ts-pop" onClick={(e) => e.stopPropagation()}>
      <button className="ts-pop-close" onClick={onClose} aria-label="Fermer">{'✕'}</button>
      <div className="ts-pop-head">
        <span className="ts-pop-emoji" style={{ background: `linear-gradient(135deg, ${team.color}, ${team.color}cc)` }}>{team.emoji}</span>
        <div className="ts-pop-name" style={{ color: team.color }}>{team.name}</div>
        <div className="ts-pop-rank">{rank}/{total}</div>
      </div>
      <StatChips team={team} />
      <TeamBuffs team={team} />
      <TeamMalus team={team} />
      <div className="ts-pop-section">
        <div className="ts-pop-label">Équipement</div>
        {Object.keys(SLOTS).map((slot) => {
          const item = ITEMS[cellKey(equipment[slot])];
          const color = item ? (RARITIES[item.rarity]?.color || '#888') : null;
          return (
            <div key={slot} className="ts-pop-eq-row">
              <span className="ts-eq-slot" style={{
                background: item ? `linear-gradient(180deg, ${color}cc, ${color})` : 'rgba(122,94,58,0.1)',
                border: item ? `1px solid ${color}` : '1px dashed rgba(122,94,58,0.3)',
                opacity: item ? 1 : 0.5,
              }}>
                {item ? (itemImg(item) ? <img src={itemImg(item)} alt="" style={{ width: '86%', height: '86%', objectFit: 'contain' }} /> : item.icon) : SLOTS[slot].icon}
              </span>
              <span className="ts-pop-eq-name">{item ? item.name : <em style={{ opacity: 0.5 }}>{SLOTS[slot].name} : vide</em>}</span>
            </div>
          );
        })}
        {bag.length > 0 && (
          <div className="ts-pop-bag">{'\u{1F9F3}'} Sac : {bag.map((k) => ITEMS[k]?.name).filter(Boolean).join(', ')}</div>
        )}
      </div>
      <div className="ts-pop-section">
        <div className="ts-pop-label">Pouvoirs</div>
        <div className="ts-pop-powers">
          {pKeys.length ? pKeys.map((key) => (
            <PowerBadge key={key} powerKey={key} charges={team.powers[key]?.charges ?? 0}
              level={team.powers[key]?.level ?? 1}
              kindLabel={POWERS[key]?.category === 'off' ? 'Attaque' : 'Défense'} />
          )) : <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Aucun pouvoir.</span>}
        </div>
      </div>
    </div>
  );
}

// Carte de l'équipe ACTIVE — détaillée
function ActiveCard({ team, rank, total }) {
  const pKeys = powerKeysOf(team);
  return (
    <div className="ts-card ts-card--active is-active" style={{ '--team-accent': team.color }}>
      <div className="ts-card-tab"><span className="ts-card-tab-arrow">{'▶'}</span> {'À'} TOI DE JOUER</div>
      <div className="ts-card-stripe" aria-hidden="true" />
      <Blazon team={team} size={52} />
      <div className="ts-card-rank ts-card-rank--active">{rank}<span>/{total}</span></div>
      <div className="ts-card-body">
        <div className="ts-card-head">
          <div className="ts-card-name" style={{ color: team.color }}>{team.name}</div>
          <TeamLocation team={team} />
        </div>
        <StatChips team={team} />
        <EquipmentStrip team={team} />
        <TeamBuffs team={team} />
        <TeamMalus team={team} />
      </div>
      <div className="ts-card-powers scroll-hidden">
        {pKeys.map((key) => (
          <PowerBadge key={key} powerKey={key} charges={team.powers[key]?.charges ?? 0}
            level={team.powers[key]?.level ?? 1}
            kindLabel={POWERS[key]?.category === 'off' ? 'Attaque' : 'Défense'} />
        ))}
      </div>
    </div>
  );
}

// Carte d'une équipe INACTIVE — compacte, densité adaptative (container queries),
// détail complet au tap (popover).
function CompactCard({ team, rank, total, open, onToggle }) {
  const pKeys = powerKeysOf(team);
  return (
    <div
      className={'ts-card ts-card--mini' + (open ? ' is-open' : '')}
      style={{ '--team-accent': team.color }}
      onClick={onToggle}
    >
      <div className="ts-card-stripe" aria-hidden="true" />
      <Blazon team={team} size={38} />
      <div className="ts-card-rank">{rank}<span>/{total}</span></div>
      <div className="ts-mini-main">
        <div className="ts-card-name" style={{ color: team.color }}>{team.name}</div>
        <div className="ts-stat ts-stat--coin ts-mini-coin" title="Pièces d'or">
          <span className="coin ts-stat-coin" /><span className="ts-stat-num">{team.money ?? 0}</span>
        </div>
        <EquipmentStrip team={team} className="ts-mini-eq" />
        <TeamBuffs team={team} />
        <TeamMalus team={team} />
      </div>
      <div className="ts-mini-powers">
        {pKeys.map((key) => (
          <PowerDisc key={key} powerKey={key} charges={team.powers[key]?.charges ?? 0} level={team.powers[key]?.level ?? 1} />
        ))}
      </div>
      {open && <TeamDetailPopover team={team} rank={rank} total={total} onClose={onToggle} />}
    </div>
  );
}

export default function BottomBar() {
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const finished = useGameStore((s) => s.finished);
  const [openIdx, setOpenIdx] = useState(null);

  // Fermer le popover au clic en dehors d'une carte
  useEffect(() => {
    if (openIdx === null) return;
    const onDown = (e) => { if (!e.target.closest('.ts-card')) setOpenIdx(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openIdx]);

  return (
    <div className="team-strip">
      <div className="team-strip-inner">
        {teams.map((t, i) => {
          const active = i === currentTeam && !finished;
          return active ? (
            <ActiveCard key={`ts-${t.name}-${i}`} team={t} rank={i + 1} total={teams.length} />
          ) : (
            <CompactCard
              key={`ts-${t.name}-${i}`}
              team={t} rank={i + 1} total={teams.length}
              open={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? null : i)}
            />
          );
        })}
      </div>
    </div>
  );
}
