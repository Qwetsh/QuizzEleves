// Consommateur de trocs (TBI, maître de la logique). Quand une session existe,
// écoute la table quete_trades : dès qu'une offre passe en « accepted », le TBI
// la re-vérifie et l'applique atomiquement (applyTrade), puis marque l'offre
// « applied »/« failed ». Aucune UI — composant logique monté dans GameLayout.
import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { subscribeTrades, fetchTrades, setTradeStatus, deleteTrade } from '../../logic/sessionConfig';
import { isForgeServiceTrade } from '../../logic/forge';

export default function TradeConsumer() {
  const sessionCode = useGameStore((s) => s.sessionCode);
  const applyTrade = useGameStore((s) => s.applyTrade);
  const startForgeService = useGameStore((s) => s.startForgeService);

  useEffect(() => {
    if (!sessionCode) return;
    let alive = true;
    const handle = (row) => {
      if (!alive || !row || row.status !== 'accepted') return;
      // Prestation de forgeage : on n'applique pas un transfert direct — on OUVRE
      // la session de forge collaborative (état diffusé aux 2 mobiles) et on
      // consomme la ligne d'offre (la session vit dans le store, plus dans la table).
      if (isForgeServiceTrade(row)) {
        let res;
        try { res = startForgeService(row); } catch { res = { ok: false }; }
        if (res?.ok) deleteTrade(row.id).catch(() => {});
        else setTradeStatus(row.id, 'failed').catch(() => {});
        return;
      }
      let res;
      try { res = applyTrade(row); } catch { res = { ok: false, reason: 'erreur' }; }
      setTradeStatus(row.id, res?.ok ? 'applied' : 'failed').catch(() => {});
    };
    // Rattrapage des offres déjà acceptées avant l'abonnement.
    fetchTrades(sessionCode).then((rows) => { if (alive) rows.forEach(handle); }).catch(() => {});
    const unsub = subscribeTrades(sessionCode, (payload) => handle(payload.new));
    return () => { alive = false; unsub(); };
  }, [sessionCode, applyTrade, startForgeService]);

  return null;
}
