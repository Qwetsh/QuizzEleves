// Pastille DESIGNÉE d'une face de dé (Forge) : parchemin en relief, valeur de
// déplacement embossée, et — s'il y a un effet — un bandeau bas à la couleur de
// la famille (icône + paliers en pips). Réutilisée partout : vitrine boutique,
// atelier, réserve, faces du dé 3D, cérémonie. Taille pilotée par `size` (px).
import { FORGE_EFFECTS, FORGE_FAMILY_COLOR } from '../../logic/forgeEffects';
import { clampFaceValue } from '../../logic/forge';
import '../../styles/forge.css';

export default function FaceTile({
  face,
  size = 64,
  base = null,        // adresse du slot (atelier) — petit chiffre en coin
  selected = false,
  dim = false,
  clickable = false,
  flat = false,       // variante « nue » (faces du dé 3D) : pas de bordure/ombre
  onClick,
  title,
}) {
  const v = clampFaceValue(face?.value);
  const meta = face?.effect?.type ? FORGE_EFFECTS[face.effect.type] : null;
  const fam = (meta && FORGE_FAMILY_COLOR[meta.family]) || '#b8862c';
  const tier = meta ? (face.effect.tier ?? 0) : -1;
  const cls = ['facetile']
    .concat(flat ? 'facetile--flat' : [])
    .concat(selected ? 'is-sel' : [])
    .concat(dim ? 'is-dim' : [])
    .concat(!meta && v === 0 ? 'facetile--safe' : [])
    .concat(clickable ? 'is-clickable' : [])
    .join(' ');
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={cls}
      style={{ '--s': `${size}px`, '--fam': fam }}
      onClick={onClick}
      title={title}
    >
      {base != null && <span className="facetile-base">{base}</span>}
      <span className="facetile-top"><span className="facetile-val">{v}</span></span>
      {meta && (
        <span className="facetile-ribbon">
          <span className="facetile-ribbon-icon">{meta.icon}</span>
          {tier >= 0 && (
            <span className="facetile-pips" aria-hidden="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} className={'facetile-pip' + (i <= tier ? ' on' : '')} />
              ))}
            </span>
          )}
        </span>
      )}
    </Tag>
  );
}
