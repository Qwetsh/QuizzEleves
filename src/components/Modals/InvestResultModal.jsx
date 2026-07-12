import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import ModalOverlay from './ModalOverlay';

// Bilan d'investissement affiché APRÈS une bonne réponse (post-loot, avant la main
// suivante) : mise, taux, remboursement et bénéfice, ambiance « bourse spatiale ».
const SPACE_PANEL = {
  background: 'radial-gradient(ellipse at 80% 0%, #1c3a4e 0%, #10233a 45%, #07101f 100%)',
  border: '1px solid rgba(120,220,200,0.35)',
  boxShadow: '0 30px 80px rgba(0,0,0,0.6), inset 0 0 60px rgba(80,220,180,0.12)',
  color: '#eafff8',
};

export default function InvestResultModal() {
  const T = useT();
  const res = useGameStore((s) => s.investResult);
  const teams = useGameStore((s) => s.teams);
  const dismiss = useGameStore((s) => s.dismissInvestResult);

  if (!res) return null;
  const team = teams[res.teamIndex];
  const profit = (res.payout ?? 0) - (res.stake ?? 0);
  const profitColor = profit > 0 ? '#7dffbf' : profit < 0 ? '#ff9c9c' : '#eafff8';

  return (
    <AnimatePresence>
      {res && (
        <ModalOverlay className="max-w-sm" panelStyle={SPACE_PANEL} onClose={dismiss}>
          <div style={{ padding: '28px 26px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5,
              background: 'radial-gradient(1px 1px at 22% 18%, #fff, transparent), radial-gradient(1.5px 1.5px at 68% 26%, #b8fff0, transparent), radial-gradient(1px 1px at 40% 66%, #fff, transparent), radial-gradient(1px 1px at 84% 54%, #9ff5df, transparent)' }} />

            <div style={{ fontSize: 44, filter: 'drop-shadow(0 0 14px rgba(120,255,190,0.6))' }}>🚀</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 23, marginTop: 6,
              color: '#8effc9', textShadow: '0 0 18px rgba(90,240,180,0.5)' }}>
              {T('modal.investResult.title')}
            </h2>
            <p style={{ fontSize: 13, color: '#a9d8cd', marginTop: 6 }}>
              {team ? `${team.emoji} ${team.name}` : ''} — {T('modal.investResult.flavor')}
            </p>

            <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 13,
              background: 'rgba(6,18,28,0.6)', border: '1px solid rgba(120,220,200,0.25)' }}>
              <Row label={T('modal.investResult.stake')} value={`${res.stake} 🪙`} />
              <Row label={T('modal.investResult.rate')} value={`${res.rate} %`} color="#ffe08a" />
              <Row label={T('modal.investResult.payout')} value={`${res.payout} 🪙`} />
              <div style={{ height: 1, background: 'rgba(120,220,200,0.25)', margin: '8px 0' }} />
              <Row label={T('modal.investResult.profit')} value={`${profit >= 0 ? '+' : ''}${profit} 🪙`} color={profitColor} bold />
            </div>

            <button onClick={dismiss}
              style={{ marginTop: 20, width: '100%', padding: '13px 0', borderRadius: 12, cursor: 'pointer', border: 'none',
                background: 'linear-gradient(180deg, #8effc9, #2fbd8a)', color: '#053023',
                fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800,
                boxShadow: '0 8px 24px rgba(47,189,138,0.4)' }}>
              {T('modal.investResult.close')}
            </button>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, color = '#eafff8', bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 13, color: '#a9d8cd' }}>{label}</span>
      <span style={{ fontSize: bold ? 20 : 15, fontWeight: bold ? 800 : 600, color, fontFamily: bold ? 'var(--font-display)' : 'inherit' }}>{value}</span>
    </div>
  );
}
