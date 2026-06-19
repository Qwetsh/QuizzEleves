// Encart « Set d'équipement » affiché dans le détail d'un objet (popover TBI +
// bottom-sheet mobile). Indique : à quel set l'objet appartient, combien de
// pièces l'équipe porte (pips X/3), et les bonus 2 / 3 pièces — chaque palier
// est mis en avant (actif) ou grisé (verrouillé) selon le nombre de pièces.
// Les libellés des bonus réutilisent describeEffect (source unique effectText).
import { SETS } from '../../data/sets';
import { ITEMS } from '../../data/items';
import { useT } from '../../i18n';
import { equippedSetCounts } from '../../logic/itemEffects';
import { describeEffect } from '../../logic/effectText';
import { setPieceImgs } from '../../logic/itemAssets';
import '../../styles/set-info.css';

// Pièce de set → slot d'équipement correspondant (ordre coiffe/armure/amulette).
const SLOT_OF_PIECE = { coiffe: 'head', armure: 'body', amulette: 'feet' };

function Tier({ n, count, lines }) {
  const T = useT();
  if (!lines.length) return null;
  const active = count >= n;
  const need = n - count;
  return (
    <div className={'setinfo-tier' + (active ? ' is-active' : '')}>
      <div className="setinfo-tier-head">
        <span className="setinfo-tier-badge">{T('modal.set.pieces', { n })}</span>
        <span className="setinfo-tier-state">
          {active ? T('modal.set.active') : T('modal.set.need', { n: need })}
        </span>
      </div>
      <ul className="setinfo-tier-lines">
        {lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </div>
  );
}

export default function SetBonusInfo({ item, team }) {
  const T = useT();
  const setKey = item?.set;
  const set = setKey ? SETS[setKey] : null;
  if (!set) return null; // l'objet n'appartient à aucun set : rien à afficher

  const count = equippedSetCounts(team)[setKey] || 0;
  const lines2 = (set.bonus2 || []).map(describeEffect).filter(Boolean);
  const lines3 = (set.bonus3 || []).map(describeEffect).filter(Boolean);
  const c = set.color || '#8a6d3a';
  // Les 3 pièces SÉPARÉES (détourées) ; chacune « obtenue » si l'équipe porte
  // dans le slot correspondant un objet de ce set.
  const pieces = setPieceImgs(setKey);
  const hasPiece = (piece) => {
    const v = team?.equipment?.[SLOT_OF_PIECE[piece]];
    const eqKey = typeof v === 'string' ? v : v?.key; // tolère une instance enchantée
    return !!(eqKey && ITEMS[eqKey]?.set === setKey);
  };

  return (
    <div
      className="setinfo"
      style={{ '--set-color': c, '--set-tint': c + '16', '--set-edge': c + '66', '--set-soft': c + '26' }}
    >
      {pieces.some((p) => p.url) && (
        <div className="setinfo-art">
          {pieces.map(({ piece, url }) => (
            <div key={piece} className={'setinfo-piece' + (hasPiece(piece) ? ' got' : ' missing')}>
              {url && <img src={url} alt={piece} draggable={false} />}
            </div>
          ))}
        </div>
      )}
      <div className="setinfo-head">
        <span className="setinfo-icon">{set.icon}</span>
        <span className="setinfo-name">{set.name}</span>
        <span className="setinfo-count">{count}<span className="setinfo-count-max">/3</span></span>
      </div>
      <div className="setinfo-pips" aria-label={T('modal.set.piecesEquipped', { n: count })}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={'setinfo-pip' + (i < count ? ' on' : '')} />
        ))}
      </div>
      <Tier n={2} count={count} lines={lines2} />
      <Tier n={3} count={count} lines={lines3} />
    </div>
  );
}
