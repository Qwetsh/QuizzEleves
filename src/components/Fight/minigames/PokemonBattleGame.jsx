import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../../store/gameStore';
import MONS from '../../../data/pokemonBattle.json';
import { createBattle, resolveTurn, sendReplacement, draftOffers } from '../../../logic/pokemonBattle';
import { archetypeForMove, SELF_ARCHETYPES, CONTACT_ARCHETYPES } from '../../../logic/pkmnAnimMap';
import { soundEvent, soundPower, soundKatana, soundClick, getSfxLevel } from '../../../logic/sounds';
import TeamAvatar from '../../TeamAvatar';
import PkmnStage from './PkmnStage.jsx';
import { useT } from '../../../i18n';

// ─────────────────────────────────────────────────────────────────────────────
// « Combat Pokémon » (thème pokemon) — LE gros mini-jeu (DESIGN_POKEMON.md).
// Un combat = tout le duel : draft 6→3 par équipe, puis tour par tour Gén. 1
// (moteur pur logic/pokemonBattle.js). Choix SECRETS : le bouton tapé ne se
// surligne pas, le panneau passe juste en « PRÊT ✓ » ; résolution quand les
// deux camps ont validé. Victoire → fightMatchWin (fin directe du duel).
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_COLORS = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', grass: '#78c850',
  electric: '#e8c020', ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0',
  ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8',
};
function playCry(url) {
  if (!url) return;
  try { const a = new Audio(url); a.volume = getSfxLevel() * 0.45; a.play().catch(() => {}); } catch { /* silencieux */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Vue d'affichage (séparée du moteur : les événements sont REJOUÉS dessus un
// par un, alors que le moteur a déjà l'état final du tour).
function snapshot(battle) {
  const side = (s) => ({
    active: s.active,
    fighters: s.fighters.map((f) => ({
      name: f.mon.name, sprite: f.mon.sprite, spriteStatic: f.mon.spriteStatic,
      cry: f.mon.cry, types: f.mon.types,
      hp: f.hp, maxHp: f.maxHp, status: f.status, ko: f.ko, boosts: { ...f.boosts },
    })),
  });
  return { A: side(battle.sides.A), B: side(battle.sides.B) };
}

export default function PokemonBattleGame({ attacker, defender }) {
  const T = useT();
  const fightMatchWin = useGameStore((s) => s.fightMatchWin);

  // A = attaquant (gauche), B = défenseur (droite).
  const teams = { A: attacker, B: defender };

  const [stage, setStage] = useState('draft');           // draft | battle
  const [offers] = useState(() => draftOffers(MONS));
  const [picks, setPicks] = useState({ A: [], B: [] }); // ids choisis au draft
  const [validated, setValidated] = useState({ A: false, B: false });

  const battleRef = useRef(null);
  // Garde de démontage pour les boucles async. ⚠️ Il faut REMETTRE false dans
  // le corps de l'effet : en dev, le StrictMode monte → simule un démontage
  // (cleanup → dead=true) → re-monte LA MÊME instance ; sans reset, toute la
  // file d'événements se croyait morte et le tour ne se résolvait jamais.
  const dead = useRef(false);
  useEffect(() => {
    dead.current = false;
    return () => { dead.current = true; };
  }, []);

  const [view, setView] = useState(null);
  const [dialog, setDialog] = useState('');
  const [phase, setPhase] = useState('choose');          // choose | anim | replace | over
  const [secret, setSecret] = useState({ A: null, B: null });
  const [bench, setBench] = useState({ A: false, B: false }); // sélecteur de switch ouvert
  const [anim, setAnim] = useState({});                  // { lunge|hit|faint|cast|recall: side, enter: side|'both' }
  const [vfx, setVfx] = useState(null);                  // { archetype, type, from, side, seq }
  const vfxSeq = useRef(0);

  const mutView = (fn) => setView((v) => { const c = structuredClone(v); fn(c); return c; });

  // ── Draft ──────────────────────────────────────────────────────────────────
  const togglePick = (sideKey, id) => {
    if (validated[sideKey]) return;
    soundClick();
    setPicks((p) => {
      const cur = p[sideKey];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 3 ? [...cur, id] : cur;
      return { ...p, [sideKey]: next };
    });
  };

  const validate = (sideKey) => {
    if (picks[sideKey].length !== 3) return;
    soundClick();
    const next = { ...validated, [sideKey]: true };
    setValidated(next);
    if (next.A && next.B) startBattle();
  };

  const startBattle = () => {
    const team = (k) => picks[k].map((id) => offers[k].find((m) => m.id === id));
    battleRef.current = createBattle(team('A'), team('B'));
    const v = snapshot(battleRef.current);
    setView(v);
    setStage('battle');
    setDialog(T('fight.pkmn.begin'));
    // Entrée en scène : pokéballs lancées par les deux dresseurs, cris calés
    // sur la matérialisation (~650 ms après le lancer).
    setAnim({ enter: 'both' });
    setTimeout(() => { if (!dead.current) playCry(v.A.fighters[0].cry); }, 650);
    setTimeout(() => { if (!dead.current) playCry(v.B.fighters[0].cry); }, 1050);
    setTimeout(() => { if (!dead.current) setAnim((a) => (a.enter === 'both' ? {} : a)); }, 1800);
  };

  // ── Lecture séquencée des événements du moteur ────────────────────────────
  async function playEvents(events) {
    for (const e of events) {
      if (dead.current) return;
      await handleEvent(e);
    }
  }

  async function handleEvent(e) {
    const name = (side) => {
      const s = viewRefLatest.current[side];
      return s.fighters[s.active].name;
    };
    switch (e.kind) {
      case 'switch': {
        // Rappel dans la pokéball AVANT l'envoi du suivant (sauf si l'actif
        // est K.O. : son rappel a déjà été joué après l'évanouissement).
        const cur = viewRefLatest.current[e.side];
        const old = cur.fighters[cur.active];
        if (!old.ko) {
          setDialog(T('fight.pkmn.comeBack', { name: old.name }));
          setAnim({ recall: e.side });
          await sleep(900);
          if (dead.current) return;
        }
        mutView((v) => {
          v[e.side].active = e.index;
          v[e.side].fighters[e.index].boosts = { atk: 0, def: 0, spc: 0, spe: 0 };
        });
        setDialog(T('fight.pkmn.sendOut', { team: teams[e.side].name, name: e.name }));
        setAnim({ enter: e.side }); // pokéball + matérialisation
        await sleep(700);
        if (dead.current) return;
        playCry(viewRefLatest.current[e.side].fighters[e.index].cry);
        await sleep(850);
        setAnim({});
        break;
      }
      case 'move': {
        setDialog(T('fight.pkmn.uses', { name: name(e.side), move: e.move }));
        // VFX directionnel : part du lanceur vers la cible (ou sur soi).
        const arch = archetypeForMove(e.move, e.type);
        const target = e.side === 'A' ? 'B' : 'A';
        setVfx({
          archetype: arch, type: e.type || 'normal', from: e.side,
          side: SELF_ARCHETYPES.has(arch) ? e.side : target, seq: ++vfxSeq.current,
        });
        const contact = CONTACT_ARCHETYPES.has(arch);
        setAnim(contact ? { lunge: e.side } : { cast: e.side });
        await sleep(contact ? 750 : 900);
        setAnim({});
        break;
      }
      case 'damage': {
        soundKatana();
        setAnim({ hit: e.side }); // le VFX d'attaque (posé au 'move') arrive à l'impact
        mutView((v) => {
          const f = v[e.side].fighters[v[e.side].active];
          f.hp = Math.max(0, f.hp - e.dmg);
        });
        await sleep(750);
        setAnim({});
        if (e.crit) { setDialog(T('fight.pkmn.crit')); await sleep(850); }
        if (e.mult >= 2) { soundPower(); setDialog(T('fight.pkmn.superEff')); await sleep(900); }
        else if (e.mult > 0 && e.mult < 1) { setDialog(T('fight.pkmn.notEff')); await sleep(900); }
        break;
      }
      case 'immune': setDialog(T('fight.pkmn.immune', { name: name(e.side) })); await sleep(950); break;
      case 'miss': setDialog(T('fight.pkmn.miss')); await sleep(850); break;
      case 'fail': setDialog(T('fight.pkmn.fail')); await sleep(750); break;
      case 'ailment':
        mutView((v) => { v[e.side].fighters[v[e.side].active].status = e.ailment; });
        setDialog(T(`fight.pkmn.st.${e.ailment}`, { name: name(e.side) }));
        await sleep(950);
        break;
      case 'boost': {
        mutView((v) => {
          const f = v[e.side].fighters[v[e.side].active];
          f.boosts[e.stat] = Math.max(-2, Math.min(2, f.boosts[e.stat] + e.delta));
        });
        const key = e.delta > 0 ? 'fight.pkmn.boostUp' : 'fight.pkmn.boostDown';
        setDialog(T(key, { name: name(e.side), stat: T(`fight.pkmn.stat.${e.stat}`), much: Math.abs(e.delta) >= 2 ? T('fight.pkmn.much') : '' }));
        await sleep(900);
        break;
      }
      case 'asleep': setDialog(T('fight.pkmn.asleep', { name: name(e.side) })); await sleep(850); break;
      case 'wake': mutView((v) => { v[e.side].fighters[v[e.side].active].status = null; }); setDialog(T('fight.pkmn.wake', { name: name(e.side) })); await sleep(850); break;
      case 'paralyzed': setDialog(T('fight.pkmn.paralyzed', { name: name(e.side) })); await sleep(900); break;
      case 'poison':
        mutView((v) => { const f = v[e.side].fighters[v[e.side].active]; f.hp = Math.max(0, f.hp - e.dmg); });
        setDialog(T('fight.pkmn.poisonHurt', { name: name(e.side) }));
        setVfx({ archetype: 'spores', type: 'poison', from: e.side, side: e.side, seq: ++vfxSeq.current });
        await sleep(900);
        break;
      case 'ko':
        mutView((v) => { const f = v[e.side].fighters[v[e.side].active]; f.hp = 0; f.ko = true; });
        setAnim({ faint: e.side });
        playCry(viewRefLatest.current[e.side].fighters[viewRefLatest.current[e.side].active].cry);
        setDialog(T('fight.pkmn.ko', { name: e.name }));
        await sleep(1200);
        if (dead.current) return;
        // Rayon rouge de rappel — puis le K.O. reste caché (dresseur seul).
        setAnim({ recall: e.side });
        await sleep(800);
        setAnim({});
        break;
      case 'win': break; // géré par afterTurn
      default: break;
    }
  }

  // Réf toujours à jour de la vue (les handlers async lisent l'état courant).
  const viewRefLatest = useRef(view);
  useEffect(() => { viewRefLatest.current = view; }, [view]);

  async function runTurn(actions) {
    setPhase('anim');
    setBench({ A: false, B: false });
    const events = resolveTurn(battleRef.current, actions);
    await playEvents(events);
    afterTurn();
  }

  function afterTurn() {
    if (dead.current) return;
    const b = battleRef.current;
    if (b.winner) {
      setPhase('over');
      const side = b.winner;
      setDialog(T('fight.pkmn.win', { team: teams[side].name }));
      soundEvent();
      setTimeout(() => { if (!dead.current) fightMatchWin(side === 'A' ? 'attacker' : 'defender'); }, 2200);
    } else if (b.pendingSwitch) {
      setPhase('replace');
      setDialog(T('fight.pkmn.sendNext', { team: teams[b.pendingSwitch].name }));
    } else {
      setSecret({ A: null, B: null });
      setPhase('choose');
      setDialog(T('fight.pkmn.chooseAction'));
    }
  }

  const choose = (sideKey, action) => {
    if (phase !== 'choose' || secret[sideKey]) return;
    soundClick();
    setBench((o) => ({ ...o, [sideKey]: false }));
    const next = { ...secret, [sideKey]: action };
    setSecret(next);
    if (next.A && next.B) runTurn(next);
  };

  async function pickReplacement(sideKey, index) {
    if (phase !== 'replace' || battleRef.current.pendingSwitch !== sideKey) return;
    soundClick();
    setPhase('anim');
    const events = sendReplacement(battleRef.current, sideKey, index);
    await playEvents(events);
    afterTurn();
  }

  // ═══════════════════════════ RENDU ═══════════════════════════

  if (stage === 'draft') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
        <div style={{
          alignSelf: 'center', padding: '8px 26px', borderRadius: 14,
          background: 'rgba(255,254,251,0.95)', fontFamily: 'var(--font-display)',
          fontSize: 20, color: 'var(--ink-900)', boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}>
          {T('fight.pkmn.draftTitle')}
        </div>
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          {['A', 'B'].map((sideKey) => {
            const team = teams[sideKey];
            const done = validated[sideKey];
            return (
              <div key={sideKey} style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8,
                padding: '10px 12px', borderRadius: 16,
                background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
                borderTop: `4px solid ${team.color}`,
                opacity: done ? 0.75 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <TeamAvatar team={team} size={28} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: team.color }}>{team.name}</span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    {done ? T('fight.pkmn.ready') : `${picks[sideKey].length}/3`}
                  </span>
                </div>
                <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 8 }}>
                  {offers[sideKey].map((m) => {
                    const sel = picks[sideKey].includes(m.id);
                    return (
                      <button key={m.id} onPointerDown={() => togglePick(sideKey, m.id)}
                        style={{
                          minWidth: 0, minHeight: 0, borderRadius: 12, cursor: 'pointer', padding: 4,
                          border: sel ? `3px solid ${team.color}` : '2px solid rgba(122,94,58,0.3)',
                          background: sel ? '#fffdf2' : 'rgba(255,254,251,0.88)',
                          boxShadow: sel ? `0 0 12px ${team.color}88` : 'none',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                        }}>
                        <img src={m.spriteStatic} alt="" style={{ height: '52%', maxHeight: 96, imageRendering: 'pixelated' }} draggable={false} />
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(10px, 1vw, 15px)', color: '#3a2c14' }}>{m.name}</div>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {m.types.map((t) => (
                            <span key={t} style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: TYPE_COLORS[t], borderRadius: 4, padding: '1px 6px' }}>{T(`fight.pkmn.type.${t}`)}</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 9.5, color: '#7a6236', fontFamily: 'var(--font-ui)' }}>
                          {T('fight.pkmn.draftStats', { hp: m.base.hp, atk: m.base.atk, def: m.base.def, spc: m.base.spc, spe: m.base.spe })}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  onPointerDown={() => validate(sideKey)}
                  disabled={done || picks[sideKey].length !== 3}
                  style={{
                    height: 38, borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 15,
                    border: '2px solid #6e4e10',
                    background: done ? '#d1f0b8' : picks[sideKey].length === 3 ? 'linear-gradient(180deg, #f3c969, #c99b35)' : '#8a7a58',
                    color: '#3a2a14', opacity: picks[sideKey].length === 3 || done ? 1 : 0.6,
                  }}>
                  {done ? T('fight.pkmn.ready') : T('fight.pkmn.validate')}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Combat ────────────────────────────────────────────────────────────────
  const F = (sideKey) => view[sideKey].fighters[view[sideKey].active];

  const hpColor = (f) => (f.hp / f.maxHp > 0.5 ? 'linear-gradient(180deg,#7de060,#3fae42)' : f.hp / f.maxHp > 0.2 ? 'linear-gradient(180deg,#f2d060,#d8a53f)' : 'linear-gradient(180deg,#f28d60,#d84939)');

  const benchPicker = (sideKey, forced) => {
    const team = teams[sideKey];
    const s = view[sideKey];
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, borderRadius: 14, background: 'rgba(20,14,8,0.93)', display: 'flex', flexDirection: 'column', gap: 6, padding: 10 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: '#f3c969', textAlign: 'center' }}>
          {forced ? T('fight.pkmn.sendNext', { team: team.name }) : T('fight.pkmn.switchTo')}
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 1 }}>
          {s.fighters.map((f, i) => {
            const disabled = f.ko || i === s.active;
            return (
              <button key={i} disabled={disabled}
                onPointerDown={() => (forced ? pickReplacement(sideKey, i) : choose(sideKey, { type: 'switch', index: i }))}
                style={{
                  flex: 1, minWidth: 0, borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
                  border: '2px solid rgba(243,201,105,0.4)', background: disabled ? '#2a2118' : '#fffdf2',
                  opacity: disabled ? 0.45 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: 4,
                }}>
                <img src={f.spriteStatic} alt="" style={{ height: '46%', imageRendering: 'pixelated', filter: f.ko ? 'grayscale(1)' : 'none' }} draggable={false} />
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 11.5, color: disabled ? '#9a8a68' : '#3a2c14' }}>{f.name}</div>
                <div style={{ width: '80%', height: 6, borderRadius: 3, background: '#4a3c20', padding: 1 }}>
                  <div style={{ height: '100%', width: `${(f.hp / f.maxHp) * 100}%`, borderRadius: 2, background: hpColor(f) }} />
                </div>
                <div style={{ fontSize: 10, color: disabled ? '#9a8a68' : '#5a4a28', fontWeight: 700 }}>{f.ko ? T('fight.pkmn.koShort') : `${f.hp}/${f.maxHp}`}</div>
              </button>
            );
          })}
        </div>
        {!forced && (
          <button onPointerDown={() => setBench((o) => ({ ...o, [sideKey]: false }))}
            style={{ height: 26, borderRadius: 8, border: 'none', background: '#5a4a28', color: '#f4e7cc', fontFamily: 'var(--font-ui)', fontSize: 12, cursor: 'pointer' }}>
            {T('fight.pkmn.back')}
          </button>
        )}
      </div>
    );
  };

  const commandPanel = (sideKey) => {
    const team = teams[sideKey];
    const f = F(sideKey);
    const raw = battleRef.current.sides[sideKey].fighters[view[sideKey].active];
    const locked = secret[sideKey] != null;
    const forced = phase === 'replace' && battleRef.current.pendingSwitch === sideKey;
    const inactive = phase !== 'choose' && !forced;
    return (
      <div style={{
        flex: 1, minWidth: 0, position: 'relative', borderRadius: 14, padding: '6px 10px 8px',
        display: 'flex', flexDirection: 'column', gap: 5,
        background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
        borderTop: `4px solid ${team.color}`,
        opacity: inactive && !locked ? 0.55 : 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 13 }}>
          <TeamAvatar team={team} size={22} />
          <span style={{ color: team.color }}>{team.name}</span>
          <span style={{ letterSpacing: 2, fontSize: 11 }}>
            {view[sideKey].fighters.map((x, i) => (x.ko ? '⚪' : '🔴')).join('')}
          </span>
          {locked && phase === 'choose' && <span style={{ color: '#9be67f', fontWeight: 900, fontSize: 11, fontFamily: 'var(--font-ui)' }}>{T('fight.pkmn.ready')}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, flex: 1, minHeight: 0 }}>
          {raw.mon.moves.map((mv, i) => (
            <button key={i}
              onPointerDown={() => choose(sideKey, { type: 'move', index: i })}
              disabled={phase !== 'choose' || locked}
              style={{
                minHeight: 0, borderRadius: 10, cursor: 'pointer', padding: '2px 10px', textAlign: 'left',
                border: '2px solid rgba(0,0,0,0.3)',
                background: mv.power > 0
                  ? `linear-gradient(180deg, ${TYPE_COLORS[mv.type]}, ${TYPE_COLORS[mv.type]}bb)`
                  : 'linear-gradient(180deg, #7f95ad, #5a6f88)',
                color: '#fff', fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 'clamp(11px, 1.05vw, 14.5px)',
                textShadow: '0 1px 2px rgba(0,0,0,0.45)',
                boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -3px 0 rgba(0,0,0,0.2)',
              }}>
              {mv.fr}
              <div style={{ fontWeight: 600, fontSize: 'clamp(8px, 0.75vw, 10.5px)', opacity: 0.92 }}>
                {T(`fight.pkmn.type.${mv.type}`)} · {mv.power > 0 ? `${T('fight.pkmn.pow')} ${mv.power}` : T('fight.pkmn.statusMove')}
              </div>
            </button>
          ))}
        </div>
        <button
          onPointerDown={() => phase === 'choose' && !locked && setBench((o) => ({ ...o, [sideKey]: !o[sideKey] }))}
          disabled={phase !== 'choose' || locked}
          style={{
            height: 26, borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 12,
            border: '2px solid #6e4e10', background: 'linear-gradient(180deg, #f3c969, #c99b35)', color: '#3a2a14',
          }}>
          🔄 {T('fight.pkmn.switch')}
        </button>
        {(bench[sideKey] || forced) && benchPicker(sideKey, forced)}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {/* Arène + dialogue (scène partagée avec la TV du mode téléphones) */}
      <PkmnStage
        view={view} anim={anim} vfx={vfx} dialog={dialog}
        trainers={{
          A: { character: attacker.character, color: attacker.color },
          B: { character: defender.character, color: defender.color },
        }}
      />
      {/* Commandes */}
      <div style={{ display: 'flex', gap: 10, height: 150 }}>
        {commandPanel('A')}
        {commandPanel('B')}
      </div>
    </div>
  );
}
