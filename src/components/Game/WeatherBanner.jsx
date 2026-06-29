// Bandeau météo persistant (pilule centrée en haut du plateau, lisible de loin).
// Affiche : (1) un PRÉAVIS « 🌧️ X approche… » quand une météo punitive est
// annoncée pour le tour suivant ; (2) la météo AMBIANTE en cours avec son
// décompte de tours (« 🌬️ Vent contraire — 2 tours restants »).
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { weatherName, weatherIcon } from '../../data/weather';
import '../../styles/weather.css';

export default function WeatherBanner() {
  const weather = useGameStore((s) => s.weather);
  const notice = useGameStore((s) => s.weatherNotice);
  const T = useT();

  // Le préavis prime visuellement (tension de l'annonce).
  if (notice?.id) {
    return (
      <div className="wx-banner wx-banner--soon" role="status">
        {T('weather.banner.soon', { icon: weatherIcon(notice.id), name: weatherName(notice.id, T.lang) })}
      </div>
    );
  }
  if (weather?.id && weather.nature === 'ambient') {
    const n = weather.turnsLeft ?? 1;
    return (
      <div className="wx-banner wx-banner--active" role="status">
        {T.plural('weather.banner.turns', n, { icon: weatherIcon(weather.id), name: weatherName(weather.id, T.lang), n })}
      </div>
    );
  }
  return null;
}
