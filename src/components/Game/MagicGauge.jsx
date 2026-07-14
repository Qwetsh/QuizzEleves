// Jauge de MAGIE d'une équipe (extension « Magie ») — HUD TBI.
// La valeur courante est CALCULÉE localement (magicNow, accrual lazy) et
// rafraîchie par un interval interne (~500 ms) SANS muter le store : muter
// `teams` déclencherait un republish Supabase de la session à chaque tick.
// Variantes :
//   - défaut  : micro-jauge des cartes d'équipe (bande du bas, posée en absolu
//     sur le bord bas de la carte via .ts-card > .mg-gauge) ;
//   - compact : idem, ultra-fine (cartes inactives — le texte disparaît en
//     carte mini via les container queries de magic-hud.css) ;
//   - detailed: jauge du rail droit (barre + « 42/100 » + « +4/min » + fiche
//     info glossaire « Magie » au survol/tap).
// S'auto-gate : rien si l'extension est coupée ou si l'équipe n'a pas de magie.
import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { extOn } from '../../extensions/registry';
import { magicNow, magicMaxOf, magicRegenPerMin } from '../../logic/magic';
import { useInfoTrigger } from './useInfoTrigger';
import '../../styles/magic-hud.css';

// Taux « propre » pour l'affichage (4 → « 4 », 4.5 → « 4.5 »).
const fmtRate = (r) => String(Math.round(r * 10) / 10);

// Valeur ENTIÈRE animée localement : setState no-op tant que le plancher ne
// change pas (React bail-out) → pas de re-render inutile à barre pleine.
function useMagicValue(team) {
  const [val, setVal] = useState(() => Math.floor(magicNow(team)));
  useEffect(() => {
    if (!team?.magic) return undefined;
    setVal(Math.floor(magicNow(team)));
    const id = setInterval(() => setVal(Math.floor(magicNow(team))), 500);
    return () => clearInterval(id);
  }, [team]);
  return val;
}

export default function MagicGauge({ team, compact = false, detailed = false }) {
  const magicOn = useGameStore((s) => extOn(s.extensions, 'magic'));
  const val = useMagicValue(team);
  const infoTrigger = useInfoTrigger({ type: 'term', key: 'magie' });
  if (!magicOn || !team?.magic) return null;

  const max = magicMaxOf(team);
  const rate = magicRegenPerMin(team);
  const pct = Math.max(0, Math.min(100, (val / max) * 100));
  const summary = `\u{2728} ${val}/${max} · +${fmtRate(rate)}/min`;

  if (detailed) {
    return (
      <div className="mg-rail" {...infoTrigger} title={summary}>
        <span className="mg-rail-ico" aria-hidden="true">{'\u{2728}'}</span>
        <div className="mg-rail-track">
          <div className="mg-gauge-fill" style={{ width: pct + '%' }} />
        </div>
        <span className="mg-rail-num">{val}<small>/{max}</small></span>
        <span className="mg-rail-rate">+{fmtRate(rate)}/min</span>
      </div>
    );
  }

  return (
    <div className={'mg-gauge' + (compact ? ' mg-gauge--compact' : '')} title={summary}>
      <span className="mg-gauge-ico" aria-hidden="true">{'\u{2728}'}</span>
      <span className="mg-gauge-num">{val}</span>
      <div className="mg-gauge-track">
        <div className="mg-gauge-fill" style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}
