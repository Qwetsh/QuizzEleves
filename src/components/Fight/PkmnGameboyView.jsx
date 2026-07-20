import { useState, useEffect } from 'react';
import { useT } from '../../i18n';

// ─────────────────────────────────────────────────────────────────────────────
// Combat Pokémon — VUE TÉLÉPHONE « GAME BOY » (mode écran + téléphones).
// Le téléphone devient une console DMG : coque grise, écran dot-matrix vert
// 4 nuances, D-pad + A/B FONCTIONNELS (navigation au curseur ▶, A = valider,
// B = retour) — le tap direct sur l'écran marche aussi. Tout passe par les
// intents : draft, choix secrets, remplaçants, récompense, fermeture.
// La TV n'affiche que la scène (PkmnDuelStage) — ZÉRO interaction sur l'écran.
// ─────────────────────────────────────────────────────────────────────────────

// Palette DMG authentique.
const GB = {
  darkest: '#0f380f', dark: '#306230', light: '#8bac0f', lightest: '#9bbc0f',
  shell: '#c4c0b7', shellDark: '#a8a49b', bezel: '#3f4152', btn: '#a53860',
};
// Sprites re-teintés « dot matrix » (vert monochrome).
const GB_IMG_FILTER = 'grayscale(1) brightness(1.05) contrast(1.2) sepia(1) hue-rotate(55deg) saturate(2.6)';

const TYPE_FR = {
  normal: 'NORMAL', fire: 'FEU', water: 'EAU', grass: 'PLANTE', electric: 'ELEC',
  ice: 'GLACE', fighting: 'COMBAT', poison: 'POISON', ground: 'SOL', rock: 'ROCHE',
  flying: 'VOL', psychic: 'PSY', bug: 'INSECTE', ghost: 'SPECTRE', dragon: 'DRAGON',
};
const AILMENT = { par: 'PAR', psn: 'PSN', slp: 'SOM' };

// Barre de PV façon Game Boy (cadre sombre, remplissage plein).
function GbHpBar({ hp, maxHp }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 9, fontWeight: 900 }}>PV</span>
      <div style={{ flex: 1, height: 8, border: `2px solid ${GB.darkest}`, borderRadius: 3, padding: 1, background: GB.lightest }}>
        <div style={{ height: '100%', width: `${Math.max(0, (hp / maxHp) * 100)}%`, background: GB.darkest, transition: 'width 500ms steps(8)' }} />
      </div>
    </div>
  );
}

// Boîte d'info façon Gén. 1 : nom + statut, barre de PV, balls d'équipe
// (et PV chiffrés pour mon camp, comme sur la vraie cartouche).
function GbInfoBox({ f, balls, mine }) {
  return (
    <div style={{
      border: `2px solid ${GB.darkest}`, borderRadius: 4, padding: '3px 5px 4px',
      background: GB.lightest, boxShadow: `2px 2px 0 ${GB.dark}`,
    }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
        <span style={{ fontSize: 9.5, fontWeight: 900, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {f.name.toUpperCase()}
        </span>
        <span style={{ fontSize: 8, fontWeight: 900 }}>{f.ko ? 'K.O.' : f.status ? AILMENT[f.status] : ''}</span>
      </div>
      <GbHpBar hp={f.hp} maxHp={f.maxHp} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7.5, fontWeight: 700, marginTop: 1 }}>
        <span style={{ letterSpacing: 2 }}>{balls}</span>
        {mine && <span>{f.hp}/{f.maxHp} PV</span>}
      </div>
    </div>
  );
}

export default function PkmnGameboyView({ fight, teams, myTeamIdx, onPick, onValidate, onChoose, onReplace, onReward, onClose }) {
  const T = useT();
  const p = fight.pkmn;
  const mySide = myTeamIdx === fight.attackerIndex ? 'A' : 'B';
  const foeSide = mySide === 'A' ? 'B' : 'A';
  const iWon = fight.winnerIndex === myTeamIdx;

  const [cursor, setCursor] = useState(0);
  const [benchOpen, setBenchOpen] = useState(false);

  // ── Construction du menu courant (dépend de la phase) ──
  let title = '';
  let lines = [];        // [{ label, sub?, onA, marked?, disabled? }]
  let screenBody = null; // contenu au-dessus du menu
  let movesGrid = false; // menu d'attaques en 2×2 façon Gén. 1 (D-pad 2D)

  const view = p?.view;
  const mine = view?.[mySide];
  const foe = view?.[foeSide];
  const myF = mine?.fighters?.[mine.active];
  const foeF = foe?.fighters?.[foe.active];

  // Mini-scène de combat façon vraie cartouche : l'adversaire en haut à droite
  // (boîte d'info en haut à gauche), mon Pokémon « de dos » en bas à gauche
  // (boîte d'info en bas à droite). Un K.O. disparaît de la scène.
  const ballsOf = (side) => side.fighters.map((f) => (f.ko ? '○' : '●')).join('');
  const recap = view && myF && foeF && (
    <div style={{ position: 'relative', height: 128 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: '58%', zIndex: 1 }}>
        <GbInfoBox f={foeF} balls={ballsOf(foe)} />
      </div>
      {!foeF.ko && (
        <img
          src={foeF.spriteStatic} alt=""
          style={{ position: 'absolute', right: 4, top: 2, height: 52, imageRendering: 'pixelated', filter: GB_IMG_FILTER }}
        />
      )}
      {/* Ligne de sol sous l'adversaire, clin d'œil GB */}
      <div style={{ position: 'absolute', right: 0, top: 56, width: '34%', height: 2, background: GB.dark }} />
      {!myF.ko && (
        <img
          src={myF.spriteStatic} alt=""
          style={{ position: 'absolute', left: 2, bottom: 0, height: 66, imageRendering: 'pixelated', filter: GB_IMG_FILTER, transform: 'scaleX(-1)' }}
        />
      )}
      <div style={{ position: 'absolute', right: 0, bottom: 0, width: '58%', zIndex: 1 }}>
        <GbInfoBox f={myF} balls={ballsOf(mine)} mine />
      </div>
    </div>
  );

  if (fight.phase === 'reward' || fight.phase === 'result' || p?.phaseB === 'over') {
    title = p?.winner === mySide || iWon ? 'VICTOIRE !' : 'DEFAITE…';
    if (fight.phase === 'reward' && iWon && !fight.rewardChosen) {
      lines = [
        { label: T('fight.reward.steal'), onA: () => onReward('steal') },
        { label: T('fight.reward.knockback'), onA: () => onReward('knockback') },
        // Extension objets coupée (payload `itemsOn: false`) → pas de « Voler
        // un objet ». undefined = true (rétrocompat, même gate que le TBI).
        ...(fight.itemsOn !== false ? [{ label: T('fight.reward.loot'), onA: () => onReward('loot') }] : []),
      ];
    } else if (fight.phase === 'result') {
      lines = [{ label: T('fight.reward.backToBoard'), onA: onClose }];
    } else {
      screenBody = <div style={{ fontSize: 11, marginTop: 8 }}>{p?.dialog || '…'}</div>;
    }
  } else if (p?.stage === 'draft') {
    const done = p.validated[mySide];
    const picks = p.picks[mySide];
    title = done ? 'EQUIPE PRETE !' : `CHOISIS 3 POKEMON (${picks.length}/3)`;
    if (!done) {
      lines = [
        ...p.offers[mySide].map((m) => ({
          label: `${picks.includes(m.id) ? '■' : '□'} ${m.name.toUpperCase()}`,
          sub: `${m.types.map((t) => TYPE_FR[t]).join('/')} · PV${m.base.hp} ATQ${m.base.atk} VIT${m.base.spe}`,
          onA: () => onPick(m.id),
        })),
        { label: 'VALIDER L\'EQUIPE', onA: () => picks.length === 3 && onValidate(), disabled: picks.length !== 3 },
      ];
    } else {
      screenBody = <div style={{ fontSize: 11, marginTop: 10 }}>EN ATTENTE DE L'ADVERSAIRE…</div>;
    }
  } else if (p?.stage === 'battle') {
    const chosen = p.chosen?.[mySide];
    if (p.phaseB === 'replace' && p.replaceSide === mySide) {
      title = 'ENVOIE UN POKEMON !';
      lines = mine.fighters.map((f, i) => ({
        label: `${f.ko ? '✕' : '▮'} ${f.name.toUpperCase()}`,
        sub: f.ko ? 'K.O.' : `${f.hp}/${f.maxHp} PV`,
        onA: () => onReplace(i),
        disabled: f.ko || i === mine.active,
      }));
      screenBody = recap;
    } else if (p.phaseB !== 'choose' || chosen) {
      title = p.phaseB === 'choose' ? 'EN ATTENTE DE L\'ADVERSAIRE…' : '';
      screenBody = (
        <>
          {recap}
          <div style={{ fontSize: 10.5, marginTop: 8, minHeight: 26, borderTop: `2px solid ${GB.dark}`, paddingTop: 5 }}>
            ▶ {p.dialog || '…'}
          </div>
        </>
      );
    } else if (benchOpen) {
      title = 'CHANGER DE POKEMON';
      lines = [
        ...mine.fighters.map((f, i) => ({
          label: `${f.ko ? '✕' : '▮'} ${f.name.toUpperCase()}`,
          sub: f.ko ? 'K.O.' : `${f.hp}/${f.maxHp} PV`,
          onA: () => { setBenchOpen(false); onChoose({ kind: 'switch', index: i }); },
          disabled: f.ko || i === mine.active,
        })),
        { label: '← RETOUR', onA: () => setBenchOpen(false) },
      ];
      screenBody = recap;
    } else {
      title = 'QUE DOIT FAIRE ' + (myF?.name || '').toUpperCase() + ' ?';
      lines = [
        ...(myF?.moves || []).map((mv, i) => ({
          label: mv.fr.toUpperCase(),
          sub: `${TYPE_FR[mv.type]}${mv.power > 0 ? ` · PUIS ${mv.power}` : ' · STATUT'}`,
          onA: () => onChoose({ kind: 'move', index: i }),
        })),
        { label: '⇄ CHANGER DE POKEMON', onA: () => setBenchOpen(true) },
      ];
      movesGrid = (myF?.moves || []).length === 4;
      screenBody = recap;
    }
  }

  // Curseur borné + navigation D-pad. En grille d'attaques (2×2 + CHANGER en
  // pleine largeur, index 4) : ◀▶ change de colonne, ▲▼ change de rangée.
  const maxCursor = Math.max(0, lines.length - 1);
  const cur = Math.min(cursor, maxCursor);
  useEffect(() => { if (cursor > maxCursor) setCursor(maxCursor); }, [maxCursor]); // eslint-disable-line react-hooks/exhaustive-deps
  const nav = (dir) => {
    if (!lines.length) return;
    if (!movesGrid) {
      const d = dir === 'up' || dir === 'left' ? -1 : 1;
      setCursor((c) => (c + d + lines.length) % lines.length);
      return;
    }
    setCursor((c) => {
      if (dir === 'left' || dir === 'right') return c === 4 ? c : Math.floor(c / 2) * 2 + ((c + 1) % 2);
      if (dir === 'down') return c <= 1 ? c + 2 : c <= 3 ? 4 : 0;
      return c === 4 ? 2 : c >= 2 ? c - 2 : 4; // up
    });
  };
  const pressA = () => { const l = lines[cur]; if (l && !l.disabled) l.onA(); };
  const pressB = () => { if (benchOpen) setBenchOpen(false); };

  // ── Rendu : la console ──
  // 100 % présentation : unités relatives (clamp/dvh/%) pour tenir en entier
  // sur 320→430 px de large et ~640→930 px de haut, safe-areas iOS incluses.
  const ARM = 'clamp(40px, 12vw, 46px)';   // bras du D-pad (cible pouce ≥ ~40px)
  const AB = 'clamp(46px, 13vw, 54px)';    // boutons A/B
  const dpadArm = (label, onTap, area, radius) => (
    <button
      onPointerDown={onTap}
      aria-label={area}
      style={{
        gridArea: area, width: '100%', height: '100%', padding: 0, border: 'none',
        borderRadius: radius, background: 'linear-gradient(180deg, #33333a, #26262b)',
        color: '#55565e', fontSize: 12, lineHeight: 1,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
        cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 340, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#17120c', userSelect: 'none', WebkitUserSelect: 'none',
      padding: 'calc(8px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) calc(8px + env(safe-area-inset-left))',
    }}>
      {/* Coque DMG — grand arrondi caractéristique en bas à droite */}
      <div style={{
        width: 'min(100%, 420px)', maxHeight: '100%', overflow: 'hidden',
        borderRadius: '14px 14px clamp(46px, 15vw, 62px) 14px',
        background: `linear-gradient(160deg, ${GB.shell}, ${GB.shellDark})`,
        boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.5), inset 0 -4px 8px rgba(0,0,0,0.25), 0 18px 44px rgba(0,0,0,0.7)',
        padding: 'clamp(9px, 2.6vw, 12px) clamp(11px, 3.4vw, 16px) clamp(14px, 4vw, 20px)',
        display: 'flex', flexDirection: 'column', gap: 'clamp(7px, 2.2vw, 10px)',
      }}>
        {/* Ligne du haut : rainures + logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
          <div style={{ flex: 1, height: 4, borderTop: '2px solid #8f8b82', borderBottom: '2px solid #d8d4cb' }} />
          <span style={{ fontSize: 8, fontWeight: 700, color: '#6b675e', letterSpacing: '0.1em' }}>QUÊTE BOY™</span>
          <div style={{ flex: 1, height: 4, borderTop: '2px solid #8f8b82', borderBottom: '2px solid #d8d4cb' }} />
        </div>

        {/* Bezel écran */}
        <div style={{
          flex: '0 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column',
          borderRadius: '10px 10px clamp(24px, 8vw, 32px) 10px',
          background: `linear-gradient(180deg, #4a4c5a, ${GB.bezel})`,
          padding: 'clamp(10px, 3vw, 14px) clamp(14px, 5vw, 26px) clamp(9px, 2.6vw, 12px)',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 7, flex: '0 0 auto' }}>
            <span style={{ fontSize: 7.5, color: '#9aa', letterSpacing: '0.14em', fontWeight: 600, whiteSpace: 'nowrap' }}>DOT MATRIX WITH STEREO SOUND</span>
          </div>
          <div style={{ display: 'flex', gap: 'clamp(6px, 2vw, 10px)', alignItems: 'stretch', flex: '0 1 auto', minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, flex: '0 0 auto' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e33', boxShadow: '0 0 6px #e33' }} />
              <span style={{ fontSize: 6.5, color: '#9aa' }}>BATTERY</span>
            </div>
            {/* ÉCRAN */}
            <div style={{
              flex: 1, minWidth: 0, minHeight: 'min(280px, 32dvh)', maxHeight: 'min(50dvh, 430px)',
              overflowY: 'auto', scrollbarWidth: 'thin', background: GB.lightest,
              border: `3px solid ${GB.darkest}`, borderRadius: 4, padding: '8px 9px',
              color: GB.darkest, fontFamily: '"Courier New", monospace', fontWeight: 700,
              boxShadow: 'inset 0 0 18px rgba(15,56,15,0.25)',
            }}>
              {title && (
                <div style={{ fontSize: 11, borderBottom: `2px solid ${GB.dark}`, paddingBottom: 4, marginBottom: 6 }}>
                  {title}
                </div>
              )}
              {screenBody}
              {movesGrid && (
                /* Menu d'attaques façon Gén. 1 : cadre, 2 lignes × 2 colonnes,
                   bandeau type/puissance de l'attaque pointée, CHANGER dessous. */
                <div style={{ marginTop: 6, border: `2px solid ${GB.darkest}`, borderRadius: 4, padding: '4px 5px', background: GB.lightest, boxShadow: `2px 2px 0 ${GB.dark}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 6px' }}>
                    {lines.slice(0, 4).map((l, i) => (
                      <div
                        key={i}
                        onPointerDown={() => { setCursor(i); l.onA(); }}
                        style={{
                          display: 'flex', gap: 2, alignItems: 'center', padding: '4px 2px', borderRadius: 3,
                          background: i === cur ? GB.light : 'transparent', cursor: 'pointer', minWidth: 0,
                        }}
                      >
                        <span style={{ width: 9, fontSize: 9, flex: '0 0 auto' }}>{i === cur ? '▶' : ''}</span>
                        <span style={{ fontSize: 9.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: `2px solid ${GB.dark}`, marginTop: 4, paddingTop: 3, fontSize: 8.5, minHeight: 13, color: GB.dark, fontWeight: 900 }}>
                    {cur < 4 ? lines[cur]?.sub : ''}
                  </div>
                  <div
                    onPointerDown={() => { setCursor(4); lines[4].onA(); }}
                    style={{
                      marginTop: 2, padding: '3px 2px', display: 'flex', gap: 2, alignItems: 'center', borderRadius: 3,
                      background: cur === 4 ? GB.light : 'transparent', cursor: 'pointer', fontSize: 9.5,
                    }}
                  >
                    <span style={{ width: 9, fontSize: 9 }}>{cur === 4 ? '▶' : ''}</span>
                    <span>{lines[4].label}</span>
                  </div>
                </div>
              )}
              {!movesGrid && lines.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {lines.map((l, i) => (
                    <div
                      key={i}
                      onPointerDown={() => { setCursor(i); if (!l.disabled) l.onA(); }}
                      style={{
                        display: 'flex', gap: 5, alignItems: 'baseline', padding: '3px 4px', borderRadius: 3,
                        background: i === cur ? GB.light : 'transparent',
                        opacity: l.disabled ? 0.45 : 1, cursor: 'pointer',
                      }}
                    >
                      <span style={{ width: 10, fontSize: 10 }}>{i === cur ? '▶' : ''}</span>
                      <span style={{ flex: 1 }}>
                        <div style={{ fontSize: 10.5 }}>{l.label}</div>
                        {l.sub && <div style={{ fontSize: 8, color: GB.dark }}>{l.sub}</div>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', marginTop: 5, flex: '0 0 auto' }}>
            <span style={{ fontSize: 9, fontStyle: 'italic', fontWeight: 800, color: '#8f95b5' }}>La Quête des Matières</span>
          </div>
        </div>

        {/* Commandes physiques — flux flex/grid (aucune position en px fixes) */}
        <div style={{ position: 'relative', flex: '0 0 auto', paddingTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* D-pad : croix en relief dans sa cuvette circulaire */}
            <div style={{
              flex: '0 0 auto', borderRadius: '50%', padding: 'clamp(5px, 1.6vw, 8px)',
              background: 'radial-gradient(circle, rgba(0,0,0,0.10) 62%, rgba(0,0,0,0) 70%)',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateAreas: '". up ." "left mid right" ". down ."',
                gridTemplateColumns: `repeat(3, ${ARM})`, gridTemplateRows: `repeat(3, ${ARM})`,
                filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.45))',
              }}>
                {dpadArm('▲', () => nav('up'), 'up', '7px 7px 0 0')}
                {dpadArm('◀', () => nav('left'), 'left', '7px 0 0 7px')}
                {dpadArm('▶', () => nav('right'), 'right', '0 7px 7px 0')}
                {dpadArm('▼', () => nav('down'), 'down', '0 0 7px 7px')}
                {/* Creux central */}
                <div style={{
                  gridArea: 'mid', background: '#2c2c30',
                  backgroundImage: 'radial-gradient(circle at 50% 46%, #1e1e22 0 34%, rgba(0,0,0,0) 43%)',
                }} />
              </div>
            </div>
            {/* A / B : magenta, en diagonale sur leur pilule inclinée, libellés gravés */}
            <div style={{
              flex: '0 0 auto', transform: 'rotate(-24deg)', display: 'flex',
              gap: 'clamp(8px, 2.6vw, 14px)', alignItems: 'center',
              padding: 'clamp(5px, 1.5vw, 8px)', borderRadius: 999,
              background: 'rgba(0,0,0,0.08)', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.18)',
              marginRight: 'clamp(3px, 1.4vw, 10px)',
            }}>
              {[{ l: 'B', fn: pressB }, { l: 'A', fn: pressA }].map((b) => (
                <button
                  key={b.l}
                  onPointerDown={b.fn}
                  style={{
                    width: AB, height: AB, padding: 0, borderRadius: '50%', border: 'none',
                    background: `radial-gradient(circle at 35% 30%, #c95b85, ${GB.btn} 75%)`,
                    color: '#7a2246', fontWeight: 900, fontSize: 16,
                    textShadow: '0 1px 0 rgba(255,255,255,0.25)',
                    boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -3px 4px rgba(0,0,0,0.25), 0 3px 5px rgba(0,0,0,0.45)',
                    cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {b.l}
                </button>
              ))}
            </div>
          </div>
          {/* SELECT / START : pilules inclinées, libellés dessous (décoratifs) */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(14px, 5vw, 24px)', marginTop: 'clamp(4px, 1.4vw, 8px)' }}>
            {['SELECT', 'START'].map((s) => (
              <div key={s} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 'clamp(34px, 10.5vw, 42px)', height: 11, borderRadius: 7, margin: '0 auto',
                  background: '#8f8b82', transform: 'rotate(-24deg)',
                  boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.4)',
                }} />
                <div style={{ fontSize: 6.5, color: '#6b675e', fontWeight: 800, marginTop: 3, letterSpacing: '0.06em' }}>{s}</div>
              </div>
            ))}
          </div>
          {/* Grille haut-parleur : lignes diagonales, bas droite */}
          <div style={{
            position: 'absolute', right: 'clamp(2px, 1vw, 8px)', bottom: 0, pointerEvents: 'none',
            display: 'flex', gap: 'clamp(4px, 1.2vw, 5px)', transform: 'rotate(-24deg)',
          }}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{ width: 'clamp(4px, 1.2vw, 5px)', height: 'clamp(24px, 7.5vw, 32px)', borderRadius: 3, background: '#8f8b82', boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.35)' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
