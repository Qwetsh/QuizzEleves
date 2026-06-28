// Pastille DESIGNÉE d'une face de dé (Forge) : parchemin en relief, valeur de
// déplacement embossée, et — s'il y a un effet — un bandeau bas à la couleur de
// la famille (icône + paliers en pips). Réutilisée partout : vitrine boutique,
// atelier, réserve, faces du dé 3D, cérémonie. Taille pilotée par `size` (px).
import { FORGE_EFFECTS, FORGE_FAMILY_COLOR } from '../../logic/forgeEffects';
import { clampFaceValue, faceEffects } from '../../logic/forge';
import '../../styles/forge.css';

const famColor = (meta) => (meta && FORGE_FAMILY_COLOR[meta.family]) || '#9aa1ad'; // acier par défaut

export default function FaceTile({
  face,
  size = 64,
  base = null,        // adresse du slot (atelier) — petit chiffre en coin
  slotTag = null,     // slot CIBLE d'une face liée (boutique/réserve) — badge « →N »
  selected = false,
  dim = false,
  clickable = false,
  flat = false,       // variante « nue » (faces du dé 3D) : pas de bordure/ombre
  onClick,
  title,
}) {
  const v = clampFaceValue(face?.value);
  // 0→3 effets : 1 effet ⇒ icône + pips de palier ; 2-3 ⇒ rangée de pastilles
  // colorées par famille (le palier passe alors dans l'info-bulle / la modale).
  const metas = faceEffects(face).map((e) => ({ e, meta: FORGE_EFFECTS[e.type] })).filter((x) => x.meta);
  const firstFam = metas.length ? famColor(metas[0].meta) : '#9aa1ad';
  const single = metas.length === 1;
  const cls = ['facetile']
    .concat(flat ? 'facetile--flat' : [])
    .concat(selected ? 'is-sel' : [])
    .concat(dim ? 'is-dim' : [])
    .concat(!metas.length && v === 0 ? 'facetile--safe' : [])
    .concat(metas.length > 1 ? 'facetile--multi' : [])
    .concat(clickable ? 'is-clickable' : [])
    .join(' ');
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={cls}
      style={{ '--s': `${size}px`, '--fam': firstFam }}
      onClick={onClick}
      title={title}
    >
      {base != null && <span className="facetile-base">{base}</span>}
      {slotTag != null && <span className="facetile-slot">{'→'}{slotTag}</span>}
      <span className="facetile-top"><span className="facetile-val">{v}</span></span>
      {metas.length > 0 && (
        <span className="facetile-ribbon">
          {single ? (
            <>
              <span className="facetile-ribbon-icon">{metas[0].meta.icon}</span>
              <span className="facetile-pips" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className={'facetile-pip' + (i <= (metas[0].e.tier ?? 0) ? ' on' : '')} />
                ))}
              </span>
            </>
          ) : (
            <span className="facetile-chips">
              {metas.map(({ meta }, i) => (
                <span key={i} className="facetile-chip" style={{ '--fam': famColor(meta) }}>{meta.icon}</span>
              ))}
            </span>
          )}
        </span>
      )}
    </Tag>
  );
}
