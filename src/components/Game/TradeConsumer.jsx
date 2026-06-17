// Consommateur de trocs (TBI, maître de la logique). Quand une session existe,
// écoute la table quete_trades : dès qu'une offre passe en « accepted », le TBI
// la re-vérifie et l'applique atomiquement (applyTrade), puis marque l'offre
// « applied »/« failed ». Aucune UI — composant logique monté dans GameLayout.
import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { subscribeTrades, fetchTrades, setTradeStatus } from '../../logic/sessionConfig';

export default function TradeConsumer() {
  const sessionCode = useGameStore((s) => s.sessionCode);
  const applyTrade = useGameStore((s) => s.applyTrade);

  useEffect(() => {
    if (!sessionCode) return;
    let alive = true;
    const handle = (row) => {
      if (!alive || !row || row.status !== 'accepted') return;
      let res;
      try { res = applyTrade(row); } catch { res = { ok: false, reason: 'erreur' }; }
      setTradeStatus(row.id, res?.ok ? 'applied' : 'failed').catch(() => {});
    };
    // Rattrapage des offres déjà acceptées avant l'abonnement.
    fetchTrades(sessionCode).then((rows) => { if (alive) rows.forEach(handle); }).catch(() => {});
    const unsub = subscribeTrades(sessionCode, (payload) => handle(payload.new));
    return () => { alive = false; unsub(); };
  }, [sessionCode, applyTrade]);

  return null;
}
