// Consommateur d'intentions (TBI, maître de la logique). Quand une session
// existe, écoute la file quete_intents : chaque commande mobile (édition
// d'équipement) est appliquée via le store (validation + verrous) puis
// supprimée. Aucune UI — composant logique monté dans GameLayout.
import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { subscribeIntents, fetchIntents, deleteIntent } from '../../logic/sessionConfig';

export default function IntentConsumer() {
  const sessionCode = useGameStore((s) => s.sessionCode);
  const applyTeamIntent = useGameStore((s) => s.applyTeamIntent);
  const applyAdminIntent = useGameStore((s) => s.applyAdminIntent);

  useEffect(() => {
    if (!sessionCode) return;
    let alive = true;
    const handle = (row) => {
      if (!row) return;
      try {
        if (typeof row.type === 'string' && row.type.startsWith('admin')) applyAdminIntent(row.type, row.payload || {});
        else applyTeamIntent(row.token, row.type, row.payload || {});
      } catch { /* commande ignorée */ }
      deleteIntent(row.id).catch(() => {});
    };
    // Rattrapage des intentions arrivées avant l'abonnement.
    fetchIntents(sessionCode).then((rows) => { if (alive) rows.forEach(handle); }).catch(() => {});
    const unsub = subscribeIntents(sessionCode, handle);
    return () => { alive = false; unsub(); };
  }, [sessionCode, applyTeamIntent, applyAdminIntent]);

  return null;
}
