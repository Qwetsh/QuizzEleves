// Duel HACKING (« Cyber-duel ») — écran du DUELLISTE sur les surfaces distantes :
// téléphone (mode « écran + téléphones ») et client en ligne (+ fenêtre de
// l'hôte-joueur en ligne, via HackDuelStage). Présentationnel : reçoit le bloc
// `fight` (payload turn.fight, avec `hack`) + `myTeamIdx` et des callbacks (envoi
// d'intents). Aucune logique de partie : l'hôte (store) est l'autorité —
// je choisis mon langage, je choisis un token, l'hôte tranche.
//
// Contrat lu (fight.hack) :
//   { roundNo, langs:{attacker,defender}, started,
//     sides:{ attacker:{ lang,title,titleEn,lines,blanks,cur,filled,breach,
//                        solved,locked,denySeq }, defender:{…} }, reveal }
// mySide déduit comme ChessDuelView (attacker si myTeamIdx===attackerIndex).
import { useState } from 'react';
import TeamAvatar from '../TeamAvatar';
import HackTerminal, { HackLangChooser, HACK_CSS, MONO } from './minigames/HackTerminal';
import { useT } from '../../i18n';
import hackData from '../../data/hackPuzzles.json';

const wrap = {
  position: 'fixed', inset: 0, zIndex: 340, display: 'flex', flexDirection: 'column',
  background: 'rgba(4,7,9,0.96)', fontFamily: 'var(--font-ui)', color: '#c9ffe0',
  padding: 14, gap: 10, pointerEvents: 'auto',
};

function btn(bg, color = '#06210f') {
  return {
    cursor: 'pointer', padding: '11px 14px', borderRadius: 10, border: '2px solid #05070a',
    background: bg, color, fontWeight: 700, fontFamily: 'var(--font-ui)', fontSize: 15,
  };
}

// Liste des langages disponibles, déduite du JEU DE DONNÉES (pas du moteur) :
// ordre stable, sans dépendre de logic/hackPuzzle. Calculée une fois au module.
const LANG_LIST = (() => {
  const set = new Set();
  for (const p of hackData.puzzles || []) if (p && p.lang) set.add(p.lang);
  return [...set].sort();
})();

export default function HackDuelView({ fight, teams = [], myTeamIdx, onPickLang, onPick, onReward, onClose }) {
  const T = useT();
  const hk = fight?.hack;
  const mySide = myTeamIdx === fight?.attackerIndex ? 'attacker'
    : myTeamIdx === fight?.defenderIndex ? 'defender' : null;
  const isWinner = fight?.winnerIndex != null && fight.winnerIndex === myTeamIdx;

  const att = teams[fight?.attackerIndex] || { emoji: '🅰️', name: 'A', color: '#c9472f' };
  const def = fight?.defenderIndex === -1 ? { emoji: '🅱️', name: '?', color: '#8b9096' }
    : (teams[fight?.defenderIndex] || { emoji: '🅱️', name: 'B', color: '#2f6fc9' });

  // --- Récompense / résultat (mêmes intents que les autres duels) ---
  if (fight?.phase === 'reward') {
    const itemsOn = fight.itemsOn !== false;
    return (
      <div style={{ ...wrap, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {isWinner && !fight.rewardChosen ? (
          <>
            <div style={{ fontSize: 20, margin: '6px 0 14px' }}>🏆 {T('fight.reward.choose')}</div>
            <div style={{ display: 'grid', gap: 8, width: 'min(460px, 92vw)' }}>
              <button onClick={() => onReward('steal')} style={btn('#caa23a', '#1a1405')}>💰 {T('fight.reward.steal')}</button>
              <button onClick={() => onReward('knockback')} style={btn('#c9472f')}>💥 {T('fight.reward.knockback')}</button>
              {itemsOn && <button onClick={() => onReward('loot')} style={btn('#5a2f8e')}>🎁 {T('fight.reward.loot')}</button>}
            </div>
          </>
        ) : (
          <div style={{ color: '#8b9096', fontSize: 18 }}>
            {isWinner ? '…' : `${(teams[fight.winnerIndex] || {}).name || ''} 🏆`}
          </div>
        )}
      </div>
    );
  }
  if (fight?.phase === 'result') {
    return (
      <div style={{ ...wrap, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 17, margin: '6px 0 14px' }}>{fight.resultMessage}</div>
        <button onClick={onClose} style={btn('#2fb551')}>{T('fight.reward.backToBoard')}</button>
      </div>
    );
  }

  // --- Phase minigame ---
  if (!hk || !mySide) {
    return <div style={{ ...wrap, justifyContent: 'center', alignItems: 'center' }}><div style={{ color: '#8b9096' }}>…</div></div>;
  }

  const me = mySide === 'attacker' ? att : def;
  const myLang = hk.langs?.[mySide] || null;
  const roundNo = hk.roundNo || 1;

  // 1) Choix du langage : tant que mon camp n'a pas choisi → menu ; sinon, si le
  //    duel n'a pas démarré (l'autre camp choisit encore) → « en attente ».
  if (!myLang) {
    return (
      <div style={wrap}>
        <style>{HACK_CSS}</style>
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <HackLangChooser
            team={me}
            langs={LANG_LIST}
            chosen={null}
            interactive
            onPick={(lang) => onPickLang && onPickLang(lang)}
            T={T}
          />
        </div>
      </div>
    );
  }
  if (!hk.started) {
    return (
      <div style={{ ...wrap, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <style>{HACK_CSS}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TeamAvatar team={me} size={28} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: me.color }}>{me.name}</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 15, color: 'rgba(150,255,190,0.85)', marginTop: 10 }}>
          {T('fight.hack.waiting')}
        </div>
      </div>
    );
  }

  // 2) Duel démarré : MON terminal interactif.
  const side = hk.sides?.[mySide] || {};
  const title = T.lang === 'en' ? (side.titleEn || side.title) : side.title;
  const solved = !!side.solved;

  return (
    <div style={wrap}>
      <style>{HACK_CSS}</style>

      {/* En-tête : moi + manche */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: '4px 0' }}>
        <TeamAvatar team={me} size={26} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: me.color }}>{me.name}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(200,255,225,0.55)', fontFamily: MONO }}>
          {T('fight.hack.round', { n: roundNo })}
        </span>
      </div>

      {/* MON terminal, interactif tant que non résolu */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <HackTerminal
          lang={side.lang || myLang}
          title={title}
          lines={side.lines || []}
          blanks={side.blanks || []}
          filled={side.filled || []}
          cur={side.cur || 0}
          breach={side.breach}
          solved={solved}
          locked={!!side.locked}
          denySeq={side.denySeq || 0}
          interactive
          onPick={(token) => onPick && onPick(token)}
          team={me}
          roundNo={roundNo}
          T={T}
        />
      </div>

      {solved && (
        <div style={{ textAlign: 'center', fontSize: 13, color: '#8b9096' }}>{T('fight.hack.solvedWait')}</div>
      )}
    </div>
  );
}
