// Archive les statistiques de la partie dans Supabase (table quete_game_stats)
// UNE SEULE FOIS, au moment où la partie se termine (finished passe à true).
// Aucune UI — composant logique monté dans GameLayout (jamais en mode OFFLINE).
// Les données alimentent le dashboard d'analyse (`?analyse`).
import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { archiveGameStats } from '../../logic/sessionConfig';

export default function StatsArchiver() {
  const finished = useGameStore((s) => s.finished);
  const done = useRef(false);

  useEffect(() => {
    if (!finished || done.current) return;
    const st = useGameStore.getState();
    if (st.statsArchived || st.devSandbox) return; // déjà archivé / bac à sable
    const gs = st.gameStats;
    if (!gs || !(gs.answers || []).length) { useGameStore.setState({ statsArchived: true }); return; }
    done.current = true;
    useGameStore.setState({ statsArchived: true });
    archiveGameStats({
      code: st.sessionCode || null,
      classLabel: gs.classLabel || '',
      startedAt: gs.startedAt || null,
      subjects: gs.subjects || [],
      data: {
        ...gs,
        // Résumé final des équipes (nom, score, or, position) pour le rapport.
        teams: (st.teams || []).map((t, idx) => ({
          idx, name: t.name, emoji: t.emoji, color: t.color,
          correct: t.correct ?? 0, wrong: t.wrong ?? 0,
          money: t.money ?? 0, pos: t.pos,
        })),
        endedAt: new Date().toISOString(),
      },
    }).catch(() => { /* archivage best-effort : ne bloque jamais la partie */ });
  }, [finished]);

  return null;
}
