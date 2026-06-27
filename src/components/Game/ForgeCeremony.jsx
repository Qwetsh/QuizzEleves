// Cérémonie de forge (Phase 3) : overlay « spectacle » joué sur le TBI quand une
// équipe pose une face sur son dé (forgeFace, au tableau OU via intent mobile).
// Marteau qui frappe l'enclume, pièce qui rougeoie puis refroidit, gerbe
// d'étincelles + son, et la ligne « résultat net » de la face forgée.
import { useEffect, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { faceEffectLabel } from '../../logic/forgeEffects';
import { clampFaceValue } from '../../logic/forge';
import FaceTile from './FaceTile';
import { soundForge } from '../../logic/sounds';
import '../../styles/forge.css';

export default function ForgeCeremony() {
  const cer = useGameStore((s) => s.forgeCeremony);
  const clear = useGameStore((s) => s.clearForgeCeremony);
  const en = useGameStore((s) => !!s.englishMode);

  useEffect(() => {
    if (!cer) return undefined;
    const tSound = setTimeout(() => soundForge(), 350); // synchronisé sur l'impact du marteau
    const tClear = setTimeout(() => clear(), 2200);
    return () => { clearTimeout(tSound); clearTimeout(tClear); };
  }, [cer, clear]);

  const sparks = useMemo(() => Array.from({ length: 26 }).map((_, i) => {
    const a = (i / 26) * Math.PI * 2;
    const d = 70 + Math.random() * 130;
    return { id: i, x: `${Math.cos(a) * d}px`, y: `${Math.sin(a) * d * 0.85}px`, delay: `${Math.random() * 80}ms` };
  }), [cer?.base, cer?.teamIdx]);

  if (!cer) return null;
  const v = clampFaceValue(cer.face?.value);
  const eff = faceEffectLabel(cer.face, en);
  const spaces = en ? (v === 1 ? 'space' : 'spaces') : (v === 1 ? 'case' : 'cases');
  const net = `+${v} ${spaces}${eff ? ` · ${eff}` : ''}`;

  return (
    <div className="forge-cer" role="dialog" aria-label="Forge">
      <div className="forge-cer-stage">
        <div className="forge-cer-hammer">{'\u{1F528}'}</div>
        <div className="forge-cer-piece">
          <div className="forge-cer-sparks">
            {sparks.map((s) => (
              <span key={s.id} className="forge-cer-spark" style={{ '--x': s.x, '--y': s.y, animationDelay: s.delay }} />
            ))}
          </div>
          <div className="forge-cer-tile"><FaceTile face={cer.face} size={124} /></div>
        </div>
        <div className="forge-cer-anvil" />
        <div className="forge-cer-label">{'\u{1F525}'} {en ? `Face #${cer.base} forged` : `Face n°${cer.base} forgée`}</div>
        <div className="forge-cer-net">{net}</div>
      </div>
    </div>
  );
}
