import { characterById } from '../data/characters';

// Avatar visuel d'une équipe : la vignette de son PERSONNAGE si défini
// (team.character), sinon repli sur l'emoji-badge (team.emoji). À utiliser
// partout où l'on affichait `{team.emoji}` comme avatar (HUD, modales, mobile).
// Les LOGS/chaînes i18n gardent l'emoji (un sprite ne rentre pas dans du texte).
export default function TeamAvatar({ team, size = 32, style, className, alt = '' }) {
  const s = typeof size === 'number' ? size : parseInt(size, 10) || 32;
  const char = team && characterById(team.character);
  if (char?.body) {
    return (
      <img
        src={char.body}
        alt={alt}
        className={className}
        style={{ width: s, height: s, objectFit: 'contain', imageRendering: 'pixelated', display: 'block', ...style }}
      />
    );
  }
  return (
    <span className={className} style={{ fontSize: Math.round(s * 0.82), lineHeight: 1, ...style }}>
      {team?.emoji}
    </span>
  );
}
