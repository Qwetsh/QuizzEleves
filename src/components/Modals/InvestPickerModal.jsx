import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import ModalOverlay from './ModalOverlay';

// Bourse galactique : à l'activation de l'effet « investir », l'équipe choisit sa
// mise (1 → tout son or) ou refuse. Le taux (en %) est fixé par l'effet. Ambiance
// business spatiale : fond nébuleuse, accents dorés, remboursement projeté en direct.
const SPACE_PANEL = {
  background: 'radial-gradient(ellipse at 20% 0%, #26305e 0%, #141a38 45%, #0b0f24 100%)',
  border: '1px solid rgba(120,150,255,0.35)',
  boxShadow: '0 30px 80px rgba(0,0,0,0.6), inset 0 0 60px rgba(90,120,255,0.12)',
  color: '#eaf0ff',
};

export default function InvestPickerModal() {
  const T = useT();
  const picker = useGameStore((s) => s.showInvestPicker);
  const teams = useGameStore((s) => s.teams);
  const confirmInvest = useGameStore((s) => s.confirmInvest);
  const cancelInvest = useGameStore((s) => s.cancelInvest);

  const gold = picker?.gold ?? 0;
  const rate = picker?.rate ?? 200;
  const team = picker ? teams[picker.teamIndex] : null;
  // Mise par défaut : la moitié du capital (au moins 1). Réinitialisée à chaque
  // ouverture — le composant reste monté, seul `picker` change.
  const [amount, setAmount] = useState(1);
  useEffect(() => {
    if (picker) setAmount(Math.max(1, Math.round((picker.gold ?? 0) / 2)));
  }, [picker]);

  if (!picker) return null;
  const stake = Math.max(1, Math.min(Math.round(amount) || 1, gold));
  const payout = Math.max(0, Math.round((stake * rate) / 100));
  const net = payout - stake;
  const netColor = net > 0 ? '#7dffa8' : net < 0 ? '#ff9c9c' : '#eaf0ff';

  const quick = [
    { label: '¼', v: Math.max(1, Math.round(gold / 4)) },
    { label: '½', v: Math.max(1, Math.round(gold / 2)) },
    { label: 'Max', v: gold },
  ];

  return (
    <AnimatePresence>
      {picker && (
        <ModalOverlay className="max-w-md" panelStyle={SPACE_PANEL}>
          <div style={{ padding: '26px 26px 22px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            {/* Étoiles décoratives */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5,
              background: 'radial-gradient(1px 1px at 18% 22%, #fff, transparent), radial-gradient(1px 1px at 72% 14%, #cdd6ff, transparent), radial-gradient(1.5px 1.5px at 42% 60%, #fff, transparent), radial-gradient(1px 1px at 86% 48%, #b7c6ff, transparent), radial-gradient(1px 1px at 30% 82%, #fff, transparent)' }} />

            <div style={{ fontSize: 40, filter: 'drop-shadow(0 0 12px rgba(255,210,120,0.6))' }}>📈</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginTop: 6, letterSpacing: 0.5,
              color: '#ffd873', textShadow: '0 0 18px rgba(255,190,80,0.5)' }}>
              {T('modal.invest.title')}
            </h2>
            <p style={{ fontSize: 14, color: '#b9c4ee', marginTop: 6 }}>
              {T('modal.invest.sub', { emoji: team?.emoji ?? '', name: team?.name ?? '' })}
            </p>

            {/* Bandeaux capital / taux */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Stat label={T('modal.invest.available')} value={`${gold} 🪙`} />
              <Stat label={T('modal.invest.rate')} value={`${rate} %`} accent="#ffd873" />
            </div>

            {/* Curseur de mise */}
            <div style={{ marginTop: 20, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, color: '#b9c4ee' }}>{T('modal.invest.stakeLabel')}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: '#fff' }}>{stake} <span style={{ fontSize: 18 }}>🪙</span></span>
              </div>
              <input
                type="range" min={1} max={Math.max(1, gold)} step={1} value={stake}
                onChange={(e) => setAmount(Number(e.target.value))}
                style={{ width: '100%', marginTop: 8, accentColor: '#ffd873', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {quick.map((q) => (
                  <button key={q.label} onClick={() => setAmount(q.v)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 9, cursor: 'pointer',
                      border: '1px solid rgba(150,180,255,0.4)', background: stake === q.v ? 'rgba(255,216,115,0.22)' : 'rgba(120,150,255,0.12)',
                      color: '#eaf0ff', fontWeight: 700, fontSize: 13 }}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Projection remboursement / bénéfice */}
            <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 12,
              background: 'rgba(10,14,34,0.6)', border: '1px solid rgba(120,150,255,0.25)' }}>
              <Row label={T('modal.invest.payout')} value={`${payout} 🪙`} />
              <Row label={T('modal.invest.net')} value={`${net >= 0 ? '+' : ''}${net} 🪙`} color={netColor} bold />
            </div>

            <p style={{ fontSize: 12, color: '#c7a0a0', marginTop: 12 }}>{T('modal.invest.warn')}</p>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              <button onClick={() => confirmInvest(stake)}
                style={{ padding: '13px 0', borderRadius: 12, cursor: 'pointer', border: 'none',
                  background: 'linear-gradient(180deg, #ffe08a, #f0b23c)', color: '#3a2600',
                  fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800,
                  boxShadow: '0 8px 24px rgba(240,178,60,0.4)' }}>
                {T('modal.invest.confirm', { n: stake })}
              </button>
              <button onClick={cancelInvest}
                style={{ padding: '10px 0', borderRadius: 12, cursor: 'pointer',
                  border: '1px solid rgba(150,180,255,0.35)', background: 'transparent',
                  color: '#b9c4ee', fontSize: 14, fontWeight: 600 }}>
                {T('modal.invest.decline')}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ flex: 1, padding: '10px 8px', borderRadius: 11, background: 'rgba(120,150,255,0.1)', border: '1px solid rgba(120,150,255,0.22)' }}>
      <div style={{ fontSize: 11, color: '#9fabda', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginTop: 2, color: accent || '#fff' }}>{value}</div>
    </div>
  );
}

function Row({ label, value, color = '#eaf0ff', bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
      <span style={{ fontSize: 13, color: '#b9c4ee' }}>{label}</span>
      <span style={{ fontSize: bold ? 18 : 15, fontWeight: bold ? 800 : 600, color, fontFamily: bold ? 'var(--font-display)' : 'inherit' }}>{value}</span>
    </div>
  );
}
