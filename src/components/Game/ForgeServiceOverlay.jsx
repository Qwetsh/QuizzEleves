import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { getDieFaces, faceEffects, clampFaceValue } from '../../logic/forge';
import { FORGE_EFFECTS, FORGE_FAMILY_COLOR } from '../../logic/forgeEffects';

// Overlay TBI (lecture seule + override prof) d'une PRESTATION DE FORGEAGE en cours :
// la classe voit le forgeron travailler sur le dé du client et l'état des deux
// validations. L'interaction se fait sur les téléphones ; le bouton « Annuler »
// permet au prof de débloquer une session restée en suspens.
export default function ForgeServiceOverlay() {
  const T = useT();
  const fs = useGameStore((s) => s.forgeService);
  const teams = useGameStore((s) => s.teams);
  const cancel = useGameStore((s) => s.forgeServiceCancel);

  if (!fs) return null;
  const provider = teams[fs.providerIdx];
  const customer = teams[fs.customerIdx];
  if (!provider || !customer) return null;

  const placements = fs.placements || {};
  const baseFaces = getDieFaces(customer);
  const draft = baseFaces.map((f, i) => {
    const si = placements[i];
    if (si == null) return { face: f, drafted: false };
    const sf = fs.providerStock[si];
    return { face: { base: i + 1, value: clampFaceValue(sf.value), effects: faceEffects(sf) }, drafted: true };
  });
  const colorOf = (f) => { const e = faceEffects(f)[0]; const m = e ? FORGE_EFFECTS[e.type] : null; return (m && FORGE_FAMILY_COLOR[m.family]) || '#7a5e3a'; };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 120, width: 320,
          background: 'linear-gradient(180deg,#241a0e,#16100a)', border: '2px solid var(--gold-600)',
          borderRadius: 18, padding: 16, color: '#f3e9d3', boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontSize: 16, color: '#ffe9b8' }}>
          <span style={{ fontSize: 22 }}>🔨</span>
          {T('game.forgeSvcTitle', { p: `${provider.emoji} ${provider.name}`, c: `${customer.emoji} ${customer.name}` })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5, marginTop: 12 }}>
          {draft.map((d, i) => {
            const eff = faceEffects(d.face);
            return (
              <div key={i} style={{
                aspectRatio: '1', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                border: `2px solid ${d.drafted ? '#ffcf6a' : colorOf(d.face)}`,
                background: d.drafted ? 'linear-gradient(180deg,#3a2a12,#241809)' : 'rgba(255,255,255,0.04)',
                boxShadow: d.drafted ? '0 0 8px rgba(255,200,90,0.45)' : 'none',
              }}>
                <span style={{ fontSize: 16, fontWeight: 800 }}>{clampFaceValue(d.face.value)}</span>
                <span style={{ display: 'flex', gap: 1, height: 5 }}>
                  {eff.map((e, k) => { const m = FORGE_EFFECTS[e.type]; const col = (m && FORGE_FAMILY_COLOR[m.family]) || '#caa45f'; return <span key={k} style={{ width: 5, height: 5, borderRadius: '50%', background: col }} />; })}
                </span>
              </div>
            );
          })}
        </div>
        {fs.error === 'payment' && (
          <div style={{ marginTop: 10, padding: '7px 10px', borderRadius: 8, background: 'rgba(210,59,47,0.2)', border: '1px solid rgba(210,59,47,0.5)', color: '#ffd9d4', fontSize: 12, textAlign: 'center' }}>
            {T('game.forgeSvcPayFail')}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12, fontSize: 13 }}>
          <span>{provider.emoji} {fs.providerOk ? '✅' : '⏳'}</span>
          <span>{customer.emoji} {fs.customerOk ? '✅' : '⏳'}</span>
        </div>
        <button onClick={() => cancel(null)}
          style={{ marginTop: 12, width: '100%', padding: '8px 0', borderRadius: 10, cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.06)', color: '#f3e9d3', fontSize: 13 }}>
          {T('game.forgeSvcCancel')}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
