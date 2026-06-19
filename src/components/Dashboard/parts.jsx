// Petites briques visuelles partagées du dashboard (barres CSS, badges de taux).
// Pas de lib de graphes : des divs, pour rester léger et fonctionner hors ligne.

export function rateColor(rate) {
  if (rate >= 70) return '#4f8f3a';
  if (rate >= 40) return '#c79120';
  return '#b5341f';
}

// Pastille colorée « 73 % ».
export function RateBadge({ rate }) {
  return (
    <span className="dash-rate" style={{ background: rateColor(rate) }}>{rate}%</span>
  );
}

// Barre horizontale proportionnelle. `value`/`max` définissent la largeur ;
// `color` la teinte ; `label` à gauche, `right` (texte) à droite.
export function Bar({ label, value, max = 100, color = '#5b6cc4', right }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="dash-bar-row">
      <div className="dash-bar-label" title={label}>{label}</div>
      <div className="dash-bar-track">
        <div className="dash-bar-fill" style={{ width: `${w}%`, background: color }} />
      </div>
      <div className="dash-bar-right">{right}</div>
    </div>
  );
}

export function Card({ title, children, className = '' }) {
  return (
    <section className={`dash-card ${className}`}>
      {title && <h3 className="dash-card-title">{title}</h3>}
      {children}
    </section>
  );
}

// Grande tuile chiffrée (KPI).
export function Kpi({ value, label, color }) {
  return (
    <div className="dash-kpi">
      <div className="dash-kpi-value" style={color ? { color } : undefined}>{value}</div>
      <div className="dash-kpi-label">{label}</div>
    </div>
  );
}
