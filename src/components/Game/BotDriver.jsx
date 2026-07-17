// Sentinelle sans UI : monte/démonte le driver des bots (mode SOLO).
// Actif dès la sélection des pouvoirs et pendant toute la partie — le cycle
// de vie React couvre naturellement resume, reset et retour à l'accueil.
import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { createBotDriver } from '../../logic/botDriver';

export default function BotDriver() {
  const active = useGameStore(
    (s) => (s.phase === 'powerSelect' || s.phase === 'game')
      && !s._mirror
      && Array.isArray(s.teams) && s.teams.some((t) => t?.isBot),
  );

  useEffect(() => {
    if (!active) return undefined;
    const driver = createBotDriver(useGameStore);
    driver.start();
    return () => driver.stop();
  }, [active]);

  return null;
}
