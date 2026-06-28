// Fiche d'info « façon BG3 » — PRÉSENTATION PURE. Reçoit une entrée déjà résolue
// (cf. glossary.resolveDescriptor) : { name, icon, accent, badge, desc, lines }.
// Rendu dans la charte parchemin/or. Le positionnement flottant est géré par
// InfoPopover ; ici on ne fait que le contenu.
import '../../styles/info-card.css';

export default function InfoCard({ entry }) {
  if (!entry) return null;
  const { name, icon, accent = '#b8862c', badge, desc, lines = [] } = entry;
  return (
    <div className="info-card" style={{ '--accent': accent }}>
      <div className="info-card-head">
        {icon && <span className="info-card-icon">{icon}</span>}
        <div className="info-card-titles">
          <div className="info-card-name">{name}</div>
          {badge && <div className="info-card-badge">{badge}</div>}
        </div>
      </div>
      {desc && <div className="info-card-desc">{desc}</div>}
      {lines.length > 0 && (
        <div className="info-card-fx">
          {lines.map((l, i) => (
            <div className="info-card-fxrow" key={i}><span className="info-card-bullet">✦</span><span>{l}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}
