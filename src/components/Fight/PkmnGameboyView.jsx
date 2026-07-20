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

  const view = p?.view;
  const mine = view?.[mySide];
  const foe = view?.[foeSide];
  const myF = mine?.fighters?.[mine.active];
  const foeF = foe?.fighters?.[foe.active];

  const recap = view && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {/* Adversaire en haut (comme sur GB), moi en bas avec mon sprite de dos simulé */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <img src={foeF.spriteStatic} alt="" style={{ height: 34, imageRendering: 'pixelated', filter: GB_IMG_FILTER }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 900 }}>
            {foeF.name.toUpperCase()} {foeF.status ? `[${AILMENT[foeF.status]}]` : ''} {foeF.ko ? 'K.O.' : ''}
          </div>
          <GbHpBar hp={foeF.hp} maxHp={foeF.maxHp} />
        </div>
        <span style={{ fontSize: 9 }}>{foe.fighters.map((f) => (f.ko ? '○' : '●')).join('')}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <img src={myF.spriteStatic} alt="" style={{ height: 34, imageRendering: 'pixelated', filter: GB_IMG_FILTER, transform: 'scaleX(-1)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 900 }}>
            {myF.name.toUpperCase()} {myF.status ? `[${AILMENT[myF.status]}]` : ''} {myF.ko ? 'K.O.' : ''}
          </div>
          <GbHpBar hp={myF.hp} maxHp={myF.maxHp} />
          <div style={{ fontSize: 8.5, fontWeight: 700 }}>{myF.hp}/{myF.maxHp} PV</div>
        </div>
        <span style={{ fontSize: 9 }}>{mine.fighters.map((f) => (f.ko ? '○' : '●')).join('')}</span>
      </div>
    </div>
  );

  if (fight.phase === 'reward' || fight.phase === 'result' || p?.phaseB === 'over') {
    title = p?.winner === mySide || iWon ? 'VICTOIRE !' : 'DEFAITE…';
    if (fight.phase === 'reward' && iWon && !fight.rewardChosen) {
      lines = [
        { label: T('fight.reward.steal'), onA: () => onReward('steal') },
        { label: T('fight.reward.knockback'), onA: () => onReward('knockback') },
        { label: T('fight.reward.loot'), onA: () => onReward('loot') },
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
      screenBody = recap;
    }
  }

  // Curseur borné + navigation D-pad.
  const maxCursor = Math.max(0, lines.length - 1);
  const cur = Math.min(cursor, maxCursor);
  useEffect(() => { if (cursor > maxCursor) setCursor(maxCursor); }, [maxCursor]); // eslint-disable-line react-hooks/exhaustive-deps
  const move = (d) => lines.length && setCursor((c) => (c + d + lines.length) % lines.length);
  const pressA = () => { const l = lines[cur]; if (l && !l.disabled) l.onA(); };
  const pressB = () => { if (benchOpen) setBenchOpen(false); };

  // ── Rendu : la console ──
  const dpadBtn = (label, onTap, style) => (
    <button
      onPointerDown={onTap}
      style={{
        position: 'absolute', width: 34, height: 34, border: 'none', borderRadius: 6,
        background: '#2c2c30', boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.15), 0 2px 3px rgba(0,0,0,0.5)',
        color: '#555', fontSize: 12, cursor: 'pointer', touchAction: 'manipulation', ...style,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 340, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#17120c', padding: 10,
    }}>
      {/* Coque DMG */}
      <div style={{
        width: 'min(96vw, 420px)', maxHeight: '98vh', borderRadius: '14px 14px 46px 14px',
        background: `linear-gradient(160deg, ${GB.shell}, ${GB.shellDark})`,
        boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.5), inset 0 -4px 8px rgba(0,0,0,0.25), 0 18px 44px rgba(0,0,0,0.7)',
        padding: '12px 16px 20px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Ligne du haut : rainures + logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 4, borderTop: '2px solid #8f8b82', borderBottom: '2px solid #d8d4cb' }} />
          <span style={{ fontSize: 8, fontWeight: 700, color: '#6b675e', letterSpacing: '0.1em' }}>QUÊTE BOY™</span>
          <div style={{ flex: 1, height: 4, borderTop: '2px solid #8f8b82', borderBottom: '2px solid #d8d4cb' }} />
        </div>

        {/* Bezel écran */}
        <div style={{
          borderRadius: '10px 10px 32px 10px', background: `linear-gradient(180deg, #4a4c5a, ${GB.bezel})`,
          padding: '14px 26px 16px', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 7 }}>
            <span style={{ fontSize: 7.5, color: '#9aa', letterSpacing: '0.14em', fontWeight: 600 }}>DOT MATRIX WITH STEREO SOUND</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e33', boxShadow: '0 0 6px #e33' }} />
              <span style={{ fontSize: 6.5, color: '#9aa' }}>BATTERY</span>
            </div>
            {/* ÉCRAN */}
            <div style={{
              flex: 1, minHeight: 300, maxHeight: '46vh', overflowY: 'auto', background: GB.lightest,
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
              {lines.length > 0 && (
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
          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <span style={{ fontSize: 9, fontStyle: 'italic', fontWeight: 800, color: '#8f95b5' }}>La Quête des Matières</span>
          </div>
        </div>

        {/* Commandes physiques */}
        <div style={{ position: 'relative', height: 128 }}>
          {/* D-pad */}
          <div style={{ position: 'absolute', left: 14, top: 8, width: 102, height: 102 }}>
            {dpadBtn('▲', () => move(-1), { left: 34, top: 0 })}
            {dpadBtn('▼', () => move(1), { left: 34, top: 68 })}
            {dpadBtn('◀', () => move(-1), { left: 0, top: 34 })}
            {dpadBtn('▶', () => move(1), { left: 68, top: 34 })}
            <div style={{ position: 'absolute', left: 34, top: 34, width: 34, height: 34, background: '#2c2c30' }} />
          </div>
          {/* A / B */}
          {[{ l: 'B', x: 250, y: 62, fn: pressB }, { l: 'A', x: 310, y: 34, fn: pressA }].map((b) => (
            <button
              key={b.l}
              onPointerDown={b.fn}
              style={{
                position: 'absolute', left: b.x, top: b.y, width: 46, height: 46, borderRadius: '50%',
                border: 'none', background: `radial-gradient(circle at 35% 30%, #c95b85, ${GB.btn})`,
                color: '#7a2246', fontWeight: 900, fontSize: 15,
                boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.3), 0 3px 5px rgba(0,0,0,0.45)',
                cursor: 'pointer', touchAction: 'manipulation',
              }}
            >
              {b.l}
            </button>
          ))}
          {/* SELECT / START (décoratifs) */}
          <div style={{ position: 'absolute', left: 130, top: 100, display: 'flex', gap: 16 }}>
            {['SELECT', 'START'].map((s) => (
              <div key={s} style={{ textAlign: 'center' }}>
                <div style={{ width: 34, height: 10, borderRadius: 6, background: '#8f8b82', transform: 'rotate(-22deg)', boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.4)' }} />
                <div style={{ fontSize: 6.5, color: '#6b675e', fontWeight: 800, marginTop: 3 }}>{s}</div>
              </div>
            ))}
          </div>
          {/* Grille haut-parleur */}
          <div style={{ position: 'absolute', right: 2, top: 88, display: 'flex', gap: 5, transform: 'rotate(-22deg)' }}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{ width: 5, height: 34, borderRadius: 3, background: '#8f8b82', boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.35)' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
