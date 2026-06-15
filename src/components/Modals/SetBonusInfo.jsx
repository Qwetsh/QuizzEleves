// Encart « Set d'équipement » affiché dans le détail d'un objet (popover TBI +
// bottom-sheet mobile). Indique : à quel set l'objet appartient, combien de
// pièces l'équipe porte (pips X/3), et les bonus 2 / 3 pièces — chaque palier
// est mis en avant (actif) ou grisé (verrouillé) selon le nombre de pièces.
// Les libellés des bonus réutilisent describeEffect (source unique effectText).
import { SETS } from '../../data/sets';
import { equippedSetCounts } from '../../logic/itemEffects';
import { describeEffect } from '../../logic/effectText';
import { setImg } from '../../logic/itemAssets';
import '../../styles/set-info.css';

function Tier({ n, count, lines }) {
  if (!lines.length) return null;
  const active = count >= n;
  const need = n - count;
  return (
    <div className={'setinfo-tier' + (active ? ' is-active' : '')}>
      <div className="setinfo-tier-head">
        <span className="setinfo-tier-badge">{n} pièces</span>
        <span className="setinfo-tier-state">
          {active ? '✓ actif' : `encore ${need} pièce${need > 1 ? 's' : ''}`}
        </span>
      </div>
      <ul className="setinfo-tier-lines">
        {lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </div>
  );
}

export default function SetBonusInfo({ item, team }) {
  const setKey = item?.set;
  const set = setKey ? SETS[setKey] : null;
  if (!set) return null; // l'objet n'appartient à aucun set : rien à afficher

  const count = equippedSetCounts(team)[setKey] || 0;
  const lines2 = (set.bonus2 || []).map(describeEffect).filter(Boolean);
  const lines3 = (set.bonus3 || []).map(describeEffect).filter(Boolean);
  const c = set.color || '#8a6d3a';
  const art = setImg(setKey);

  return (
    <div
      className="setinfo"
      style={{ '--set-color': c, '--set-tint': c + '16', '--set-edge': c + '66', '--set-soft': c + '26' }}
    >
      {art && (
        <div className="setinfo-art">
          <img src={art} alt={set.name} draggable={false} />
        </div>
      )}
      <div className="setinfo-head">
        <span className="setinfo-icon">{set.icon}</span>
        <span className="setinfo-name">{set.name}</span>
        <span className="setinfo-count">{count}<span className="setinfo-count-max">/3</span></span>
      </div>
      <div className="setinfo-pips" aria-label={`${count} pièces sur 3 équipées`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={'setinfo-pip' + (i < count ? ' on' : '')} />
        ))}
      </div>
      <Tier n={2} count={count} lines={lines2} />
      <Tier n={3} count={count} lines={lines3} />
    </div>
  );
}
