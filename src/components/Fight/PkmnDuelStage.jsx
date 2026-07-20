// Police « LCD » du bandeau TV rétro (auto-hébergée, comme l'écran cassettes).
import '@fontsource/vt323/400.css';
import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import TeamAvatar from '../TeamAvatar';
import PkmnStage from './minigames/PkmnStage';
import { soundPkmnVfx, soundPkmnBall, soundPkmnRecall, soundPkmnFaint } from '../../logic/sounds';
import { useT } from '../../i18n';

// Combat Pokémon — SCÈNE TV du mode « écran + téléphones » : uniquement le
// spectacle (arène, dresseurs, sprites, PV, dialogue, VFX) piloté par le store
// (pokemonFightHandlers). AUCUNE commande ici : le draft et les choix se font
// sur les téléphones (vue Game Boy). Pendant le draft, la TV affiche l'attente.
// La scène est INCRUSTÉE dans la même TV CRT rétro que le plateau (classes
// rg-tv de retro-game.css : coque, écran bombé, scanlines, bandeau marque).
export default function PkmnDuelStage({ fight, attacker, defender }) {
  const T = useT();
  const p = fight.pkmn;
  useGameStore((s) => s.showFight?.pkmn); // re-rendu sur chaque avancée du store

  // La TV est la SONO du combat téléphones : elle joue les sons d'attaque
  // (archétype du VFX) et les moments clés (ball / rappel / K.O.), calés sur les
  // changements publiés par le store. Les téléphones (PkmnGameboyView) ne jouent
  // PAS ces sons. Gardes anti-double-jeu : mémorise le dernier seq de VFX et la
  // dernière signature d'anim ; ne rejoue jamais au 1er rendu (reprise/reconnexion).
  const lastVfxSeq = useRef(null);
  const lastAnimSig = useRef(null);
  const vfxSeq = p?.vfx?.seq ?? null;
  const vfxArch = p?.vfx?.archetype ?? null;
  useEffect(() => {
    if (vfxSeq == null) return;
    if (lastVfxSeq.current === null) { lastVfxSeq.current = vfxSeq; return; } // 1er rendu : pas de rejeu
    if (vfxSeq !== lastVfxSeq.current) { lastVfxSeq.current = vfxSeq; soundPkmnVfx(vfxArch); }
  }, [vfxSeq, vfxArch]);
  const anim = p?.anim || null;
  const animSig = anim ? (anim.enter ? `enter:${anim.enter}` : anim.recall ? `recall:${anim.recall}` : anim.faint ? `faint:${anim.faint}` : null) : null;
  useEffect(() => {
    if (animSig == null) { lastAnimSig.current = null; return; }
    if (lastAnimSig.current === null && lastVfxSeq.current === null) { lastAnimSig.current = animSig; return; } // 1er rendu
    if (animSig === lastAnimSig.current) return;
    lastAnimSig.current = animSig;
    if (animSig.startsWith('enter')) soundPkmnBall();
    else if (animSig.startsWith('recall')) soundPkmnRecall();
    else if (animSig.startsWith('faint')) soundPkmnFaint();
  }, [animSig]);

  if (!p) return null;
  const teams = { A: attacker, B: defender };

  if (p.stage === 'draft') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: '#f3c969', textShadow: '0 3px 10px rgba(0,0,0,0.5)' }}>
          {T('fight.pkmn.draftTitle')}
        </div>
        <div style={{ display: 'flex', gap: 30 }}>
          {['A', 'B'].map((sideKey) => {
            const team = teams[sideKey];
            const done = p.validated[sideKey];
            return (
              <div key={sideKey} style={{
                width: 300, borderRadius: 18, padding: '18px 22px', textAlign: 'center',
                background: `linear-gradient(180deg, ${team.color}26, ${team.color}0d)`,
                borderTop: `4px solid ${team.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <TeamAvatar team={team} size={38} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: team.color }}>{team.name}</span>
                </div>
                <div style={{ marginTop: 14, fontSize: 40, letterSpacing: 6 }}>
                  {Array.from({ length: 3 }, (_, i) => (i < p.picks[sideKey].length ? '🔴' : '⚪')).join('')}
                </div>
                <div style={{ marginTop: 10, fontFamily: 'var(--font-ui)', fontSize: 14, color: done ? '#9be67f' : 'rgba(255,243,212,0.75)' }}>
                  {done ? T('fight.pkmn.ready') : T('fight.pkmn.draftOnPhone')}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'rgba(255,243,212,0.6)' }}>
          {T('fight.pkmn.tvHint')}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 14px 8px', minHeight: 0 }}>
      {/* Bandeau équipes : pokéballs restantes + accusé de choix secret */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
        {['A', 'B'].map((sideKey) => {
          const team = teams[sideKey];
          const balls = (p.view?.[sideKey]?.fighters || []).map((f) => (f.ko ? '⚪' : '🔴')).join('');
          const waiting = p.phaseB === 'choose' && !p.choice?.[sideKey] && !(p.chosen && p.chosen[sideKey]);
          return (
            <div key={sideKey} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {sideKey === 'B' && <span style={{ letterSpacing: 3, fontSize: 15 }}>{balls}</span>}
              <TeamAvatar team={team} size={30} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: team.color }}>{team.name}</span>
              {sideKey === 'A' && <span style={{ letterSpacing: 3, fontSize: 15 }}>{balls}</span>}
              {p.phaseB === 'choose' && (
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 800, color: waiting ? 'rgba(255,243,212,0.55)' : '#9be67f' }}>
                  {waiting ? T('fight.pkmn.thinking') : T('fight.pkmn.ready')}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Scène réduite, incrustée dans la TV CRT rétro (même chrome que le plateau) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', height: '100%', width: 'min(1150px, 96%)' }}>
          <section className="rg-tv" style={{ position: 'absolute', inset: 0 }}>
            <div className="rg-tv-screen">
              <div className="rg-tv-screen-inner" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10 }}>
                <PkmnStage
                  view={p.view} anim={p.anim || {}} vfx={p.vfx} dialog={p.dialog} dialogSize={18} spriteScale={0.7}
                  arena={p.arena || 'meadow'}
                  trainers={{
                    A: { character: attacker?.character, color: attacker?.color },
                    B: { character: defender?.character, color: defender?.color },
                  }}
                />
                <div className="rg-tv-fx rg-tv-fx--vignette" />
                <div className="rg-tv-fx rg-tv-fx--glare" />
                <div className="rg-tv-fx rg-tv-fx--flicker" />
                <div className="rg-tv-fx rg-tv-fx--scan" />
                <div className="rg-tv-badge">CH·3 PKMN</div>
              </div>
            </div>
            <div className="rg-tv-strip">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="rg-tv-brand">SONOVISION</span>
                <span className="rg-tv-sub">TRINI-VISION™</span>
              </div>
              <div style={{ flex: 1 }} />
              <div className="rg-tv-dial" />
              <div className="rg-tv-dial" style={{ transform: 'rotate(120deg)' }} />
              <div className="rg-tv-pwr"><span className="rg-tv-pwr-led" /><span className="rg-tv-pwr-txt">PWR</span></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
