import { useState, useEffect } from 'react';
import { POWERS } from '../../data/powers';
import { SUBJECTS } from '../../data/subjects';
import { loc, locName, locDesc } from '../../i18n/content';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { cellKey, cellN, cellEnchants } from '../../store/itemHandlers';
import { itemImg } from '../../logic/itemAssets';
import { getTeamEffects } from '../../logic/teamStatus';
import { useGameStore } from '../../store/gameStore';
import { useInfoTrigger } from './useInfoTrigger';
import { useT } from '../../i18n';
import HackCinematic from './HackCinematic';
import '../../styles/team-strip-hud.css';

// Descripteur de fiche pour un effet : délègue à une entité si l'effet la cible
// (set, matière, terme), sinon fiche ad hoc « effect » porteuse de son texte.
const fxDescriptor = (fx) => fx.link || { type: 'effect', name: fx.name, desc: fx.desc, icon: fx.icon, color: fx.color };

// Type → icône + clé i18n du libellé de case (résolu via T au rendu).
const TILE_TYPES = {
  depart:   { icon: '\u{1F3F0}', labelKey: 'game.tile.depart' },
  arrivee:  { icon: '\u{1F3C6}', labelKey: 'game.tile.arrivee' },
  jonction: { icon: '\u{1F3B2}', labelKey: 'game.tile.jonction' },
  event:    { icon: '✨',    labelKey: 'game.tile.event' },
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
  const T = useT();
  const info = POWERS[powerKey];
  if (!info) return null;
  const chargesLabel = `${charges} ${T.plural('game.charge', charges)}`;
  return (
    <div
      className={'power-badge ' + (charges <= 0 ? 'is-empty' : '')}
      style={{ '--power-color': info.color }}
      title={T('game.powerTitleDesc', { name: locName(info), level, charges: chargesLabel, desc: locDesc(info) })}
    >
      <div className="power-badge-disc">
        <span className="power-badge-icon">{info.icon}</span>
        <span className="power-badge-count">{charges}</span>
        {level > 1 && <span className="power-badge-level">{level}</span>}
      </div>
      <div className="power-badge-meta">
        <div className="power-badge-kind">{kindLabel}</div>
        <div className="power-badge-name">{locName(info)}</div>
      </div>
    </div>
  );
}

// Disque seul (cartes inactives compactes)
function PowerDisc({ powerKey, charges, level }) {
  const T = useT();
  const info = POWERS[powerKey];
  if (!info) return null;
  const chargesLabel = `${charges} ${T.plural('game.charge', charges)}`;
  return (
    <div
      className={'power-disc ' + (charges <= 0 ? 'is-empty' : '')}
      style={{ '--power-color': info.color }}
      title={T('game.powerTitleLong', { name: locName(info), level, charges: chargesLabel })}
    >
      <span className="power-disc-icon">{info.icon}</span>
      <span className="power-disc-count">{charges}</span>
    </div>
  );
}

// Mini-icônes d'équipement (3 slots) + compteur de sac
function EquipmentStrip({ team, className }) {
  const T = useT();
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
            title={item
              ? `${T('game.slotItem', { slot: SLOTS[slot].name, item: locName(item) })}${ench ? ` ${T('game.enchanted', { n: ench })}` : ''}\n${locDesc(item)}`
              : T('game.slotEmpty', { slot: SLOTS[slot].name })}
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
        <span className="ts-eq-bag" title={`${T('game.bagLabel')} : ${bag.map((c) => { const it = ITEMS[cellKey(c)]; return it ? locName(it) + (cellN(c) > 1 ? ` ×${cellN(c)}` : '') : null; }).filter(Boolean).join(', ')}`}>
          {'\u{1F9F3}'} {bag.reduce((s, c) => s + cellN(c), 0)}
        </span>
      )}
    </div>
  );
}

// Pastilles de stats (or, bonnes/mauvaises réponses, taux)
function StatChips({ team, withRate = true }) {
  const T = useT();
  const totalQ = (team.correct ?? 0) + (team.wrong ?? 0);
  const winRate = totalQ > 0 ? Math.round((team.correct / totalQ) * 100) : null;
  return (
    <div className="ts-card-stats">
      <div className="ts-stat ts-stat--coin" title={T('game.stat.coins')}>
        <span className="coin ts-stat-coin" /><span className="ts-stat-num">{team.money ?? 0}</span>
      </div>
      <div className="ts-stat ts-stat--good" title={T('game.stat.correct')}>
        <span className="ts-stat-ico">{'✓'}</span><span className="ts-stat-num">{team.correct ?? 0}</span>
      </div>
      <div className="ts-stat ts-stat--bad" title={T('game.stat.wrong')}>
        <span className="ts-stat-ico">{'✗'}</span><span className="ts-stat-num">{team.wrong ?? 0}</span>
      </div>
      {withRate && winRate !== null && (
        <div className="ts-stat ts-stat--rate" title={T('game.stat.winRate')}>
          <span className="ts-stat-ico">{'◎'}</span><span className="ts-stat-num">{winRate}<small>%</small></span>
        </div>
      )}
    </div>
  );
}

// Un effet en chip (carte active) : icône + libellé court (+ compteur). Survol/
// tap → fiche d'info. Chaque chip est son propre composant (useId stable).
function FxChip({ fx }) {
  const trigger = useInfoTrigger(fxDescriptor(fx));
  return (
    <button type="button" className={`ts-fxchip ts-fxchip--${fx.tone}`} style={{ '--fx': fx.color }} {...trigger}>
      <span className="ts-fxchip-ico">{fx.icon}</span>
      <span className="ts-fxchip-name">{fx.name}</span>
      {fx.n ? <span className="ts-fxchip-n">×{fx.n}</span> : null}
    </button>
  );
}

// Un effet en pastille-icône (cartes inactives) : icône seule (+ compteur).
function FxDot({ fx }) {
  const trigger = useInfoTrigger(fxDescriptor(fx));
  return (
    <button type="button" className={`ts-fxdot ts-fxdot--${fx.tone}`} style={{ '--fx': fx.color }} {...trigger}>
      <span>{fx.icon}</span>{fx.n ? <small>{fx.n}</small> : null}
    </button>
  );
}

// Bande d'effets actifs (buffs + malus) — placée dans le « vide » central de la
// carte. variant 'active' = chips icône+libellé ; 'mini' = icônes seules.
function TeamEffects({ team, variant = 'active' }) {
  const T = useT();
  const fx = getTeamEffects(team, T.lang);
  if (!fx.length) return null;
  if (variant === 'mini') {
    return <div className="ts-fxband ts-fxband--mini">{fx.map((e) => <FxDot key={e.key} fx={e} />)}</div>;
  }
  return <div className="ts-fxband">{fx.map((e) => <FxChip key={e.key} fx={e} />)}</div>;
}

function TeamLocation({ team }) {
  const T = useT();
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
          <span className="ts-card-location-text">{loc(subject, 'biome')}</span>
        </>
      ) : tileType ? (
        <>
          <span className="ts-card-location-ico ts-card-location-ico--neutral">{tileType.icon}</span>
          <span className="ts-card-location-text">{T(tileType.labelKey)}</span>
        </>
      ) : (
        <span className="ts-card-location-text" style={{ opacity: 0.5 }}>{T('game.location.waiting')}</span>
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
  const T = useT();
  const equipment = team.equipment || {};
  const bag = (team.bag || []).filter(Boolean);
  const pKeys = powerKeysOf(team);
  return (
    <div className="ts-pop" onClick={(e) => e.stopPropagation()}>
      <button className="ts-pop-close" onClick={onClose} aria-label={T('common.close')}>{'✕'}</button>
      <div className="ts-pop-head">
        <span className="ts-pop-emoji" style={{ background: `linear-gradient(135deg, ${team.color}, ${team.color}cc)` }}>{team.emoji}</span>
        <div className="ts-pop-name" style={{ color: team.color }}>{team.name}</div>
        <div className="ts-pop-rank">{rank}/{total}</div>
      </div>
      <StatChips team={team} />
      <TeamEffects team={team} variant="active" />
      <div className="ts-pop-section">
        <div className="ts-pop-label">{T('game.section.equipment')}</div>
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
              <span className="ts-pop-eq-name">{item ? locName(item) : <em style={{ opacity: 0.5 }}>{T('game.slotEmpty', { slot: SLOTS[slot].name })}</em>}</span>
            </div>
          );
        })}
        {bag.length > 0 && (
          <div className="ts-pop-bag">{'\u{1F9F3}'} {T('game.bagLabel')} : {bag.map((k) => ITEMS[k] ? locName(ITEMS[k]) : null).filter(Boolean).join(', ')}</div>
        )}
      </div>
      <div className="ts-pop-section">
        <div className="ts-pop-label">{T('game.section.powers')}</div>
        <div className="ts-pop-powers">
          {pKeys.length ? pKeys.map((key) => (
            <PowerBadge key={key} powerKey={key} charges={team.powers[key]?.charges ?? 0}
              level={team.powers[key]?.level ?? 1}
              kindLabel={POWERS[key]?.category === 'off' ? T('game.kind.attack') : T('game.kind.defense')} />
          )) : <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>{T('game.noPower')}</span>}
        </div>
      </div>
    </div>
  );
}

// Carte de l'équipe ACTIVE — détaillée
function ActiveCard({ team, rank, total }) {
  const T = useT();
  const pKeys = powerKeysOf(team);
  return (
    <div className="ts-card ts-card--active is-active" style={{ '--team-accent': team.color }}>
      {team.hackedTurns > 0 && (
        <div className="ts-hack-cell">
          <HackCinematic compact en={T.lang === 'en'} victim={team.name} by={team.hackedBy} />
        </div>
      )}
      <div className="ts-card-tab"><span className="ts-card-tab-arrow">{'▶'}</span> {T('game.yourMove')}</div>
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
      </div>
      <TeamEffects team={team} variant="active" />
      <div className="ts-card-powers scroll-hidden">
        {pKeys.map((key) => (
          <PowerBadge key={key} powerKey={key} charges={team.powers[key]?.charges ?? 0}
            level={team.powers[key]?.level ?? 1}
            kindLabel={POWERS[key]?.category === 'off' ? T('game.kind.attack') : T('game.kind.defense')} />
        ))}
      </div>
    </div>
  );
}

// Carte d'une équipe INACTIVE — compacte, densité adaptative (container queries),
// détail complet au tap (popover).
function CompactCard({ team, rank, total, open, onToggle }) {
  const T = useT();
  const pKeys = powerKeysOf(team);
  return (
    <div
      className={'ts-card ts-card--mini' + (open ? ' is-open' : '')}
      style={{ '--team-accent': team.color }}
      onClick={onToggle}
    >
      {team.hackedTurns > 0 && (
        <div className="ts-hack-cell">
          <HackCinematic compact en={T.lang === 'en'} victim={team.name} by={team.hackedBy} />
        </div>
      )}
      <div className="ts-card-stripe" aria-hidden="true" />
      <Blazon team={team} size={38} />
      <div className="ts-card-rank">{rank}<span>/{total}</span></div>
      <div className="ts-mini-main">
        <div className="ts-card-name" style={{ color: team.color }}>{team.name}</div>
        <div className="ts-stat ts-stat--coin ts-mini-coin" title={T('game.stat.coins')}>
          <span className="coin ts-stat-coin" /><span className="ts-stat-num">{team.money ?? 0}</span>
        </div>
        <EquipmentStrip team={team} className="ts-mini-eq" />
        <TeamEffects team={team} variant="mini" />
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
  // « Hacking » : la cinématique tourne en boucle sur la cellule du groupe piraté
  // dès le déclenchement (team.hackedTurns > 0). Quand c'est SON tour (résolution,
  // hackOverlay posé), on laisse un « beat » puis on passe le tour (tour perdu).
  const hackOverlay = useGameStore((s) => s.hackOverlay);
  const endHackedTurn = useGameStore((s) => s.endHackedTurn);
  const [openIdx, setOpenIdx] = useState(null);

  // Fermer le popover au clic en dehors d'une carte
  useEffect(() => {
    if (openIdx === null) return;
    const onDown = (e) => { if (!e.target.closest('.ts-card')) setOpenIdx(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openIdx]);

  // Résolution du tour piraté : ~4,5 s de « tour perdu » puis on enchaîne.
  useEffect(() => {
    if (!hackOverlay) return undefined;
    const id = setTimeout(() => endHackedTurn(), 4500);
    return () => clearTimeout(id);
  }, [hackOverlay, endHackedTurn]);

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
