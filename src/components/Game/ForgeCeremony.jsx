// Cérémonie de forge (Phase 3) : overlay bref joué sur le TBI quand une équipe
// pose une face sur son dé (forgeFace, déclenché au tableau OU via intent mobile).
// Marteau qui frappe l'enclume, métal rougeoyant, gerbe d'étincelles + son.
import { useEffect, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { FORGE_EFFECTS, FORGE_FAMILY_COLOR } from '../../logic/forgeEffects';
import { soundForge } from '../../logic/sounds';
import '../../styles/forge.css';

export default function ForgeCeremony() {
  const cer = useGameStore((s) => s.forgeCeremony);
  const clear = useGameStore((s) => s.clearForgeCeremony);

  useEffect(() => {
    if (!cer) return undefined;
    const tSound = setTimeout(() => soundForge(), 350); // synchronisé sur l'impact du marteau
    const tClear = setTimeout(() => clear(), 2000);
    return () => { clearTimeout(tSound); clearTimeout(tClear); };
  }, [cer, clear]);

  const sparks = useMemo(() => Array.from({ length: 18 }).map((_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const d = 60 + Math.random() * 95;
    return { id: i, x: `${Math.cos(a) * d}px`, y: `${Math.sin(a) * d}px`, delay: `${Math.random() * 60}ms` };
  }), [cer?.base, cer?.teamIdx]);

  if (!cer) return null;
  const meta = cer.face?.effect?.type ? FORGE_EFFECTS[cer.face.effect.type] : null;
  const color = (meta && FORGE_FAMILY_COLOR[meta.family]) || '#c9762e';

  return (
    <div className="forge-cer" role="dialog" aria-label="Forge">
      <div className="forge-cer-stage" style={{ '--fc': color }}>
        <div className="forge-cer-hammer">{'\u{1F528}'}</div>
        <div className="forge-cer-anvil">
          <div className="forge-cer-face">
            <span className="forge-cer-val">{cer.face?.value ?? 0}</span>
            {meta && <span className="forge-cer-fx">{meta.icon}</span>}
          </div>
          <div className="forge-cer-sparks">
            {sparks.map((s) => (
              <span key={s.id} className="forge-cer-spark" style={{ '--x': s.x, '--y': s.y, animationDelay: s.delay }} />
            ))}
          </div>
        </div>
        <div className="forge-cer-label">{'\u{1F525}'} Face n°{cer.base} forgée</div>
      </div>
    </div>
  );
}
