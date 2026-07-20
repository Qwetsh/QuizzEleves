// Police « LCD » du bandeau TV rétro (auto-hébergée, comme l'écran cassettes).
import '@fontsource/vt323/400.css';
import { useGameStore } from '../../store/gameStore';
import { onlineToken } from '../../logic/sessionConfig';
import TeamAvatar from '../TeamAvatar';
import HackTerminal, { HackLangChooser, HACK_CSS } from './minigames/HackTerminal';
import HackDuelView from './HackDuelView';
import { useT } from '../../i18n';

/**
 * Duel HACKING (« Cyber-duel ») piloté par le STORE — rendu dans FightModal
 * (phase minigame, showFight.hack). Comme les échecs / le Curioscope, ce duel
 * tourne sur les 3 surfaces :
 * - fenêtre de l'HÔTE EN LIGNE dont l'équipe est duelliste → il joue son
 *   terminal (HackDuelView branché sur hackDuelLang / hackDuelPick) ;
 * - sinon (écran partagé du mode « écran + téléphones », hôte non-duelliste,
 *   miroir en ligne) → vue SPECTATEUR : les DEUX terminaux en lecture seule
 *   (ou « choisit son langage… » tant qu'un camp n'a pas choisi), + breach/état.
 */
export default function HackDuelStage({ fight, attacker, defender }) {
  const T = useT();
  const teams = useGameStore((s) => s.teams);
  const mirror = useGameStore((s) => !!s._mirror);
  const online = useGameStore((s) => s.connectionMode === 'online');
  const sessionCode = useGameStore((s) => s.sessionCode);
  const hackDuelLang = useGameStore((s) => s.hackDuelLang);
  const hackDuelPick = useGameStore((s) => s.hackDuelPick);

  const hk = fight.hack;
  if (!hk) return null;

  // Hôte en ligne = joueur : si SON équipe est un des duellistes, il joue ici
  // (même résolution de jeton que ChessDuelStage / CurioDuelStage).
  let hostSide = null;
  if (online && !mirror) {
    const hostToken = sessionCode ? onlineToken(sessionCode) : null;
    for (const [side, idx] of [['attacker', fight.attackerIndex], ['defender', fight.defenderIndex]]) {
      const t = teams[idx];
      if (t && !t.isBot && (!t.token || (hostToken && t.token === hostToken))) { hostSide = side; break; }
    }
  }
  if (hostSide) {
    const myTeamIdx = hostSide === 'attacker' ? fight.attackerIndex : fight.defenderIndex;
    return (
      <HackDuelView
        fight={{ ...fight, hack: hk, winnerIndex: null }}
        teams={teams}
        myTeamIdx={myTeamIdx}
        onPickLang={(lang) => hackDuelLang && hackDuelLang(hostSide, lang)}
        onPick={(token) => hackDuelPick && hackDuelPick(hostSide, token)}
        onReward={() => {}}
        onClose={() => {}}
      />
    );
  }

  // --- Vue spectateur (écran partagé / miroir) : les deux terminaux en lecture
  // seule, ou le menu « choisit son langage… » tant qu'un camp n'a pas choisi.
  const reveal = hk.reveal;

  const panel = (side, team) => {
    const s = hk.sides?.[side] || null;
    const lang = hk.langs?.[side] || null;
    const won = reveal?.winner === side;
    const lost = reveal && reveal.winner !== side;

    // Pas encore de langage choisi (ou duel pas démarré, pas d'énigme publiée) :
    // afficher le menu en lecture seule (« choisit son langage… » / logo choisi).
    if (!lang || !hk.started || !s) {
      return (
        <div style={{
          flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column',
          borderRadius: 12, border: `2px solid ${team.color}`, background: '#05080a',
          opacity: lost ? 0.7 : 1, transition: 'opacity 200ms ease',
        }}>
          <HackLangChooser team={team} langs={[]} chosen={lang} interactive={false} T={T} />
        </div>
      );
    }

    const title = T.lang === 'en' ? (s.titleEn || s.title) : s.title;
    return (
      <div style={{
        flex: 1, minWidth: 0, position: 'relative', display: 'flex',
        opacity: lost ? 0.7 : 1, transition: 'opacity 200ms ease',
      }}>
        <HackTerminal
          lang={s.lang || lang}
          title={title}
          lines={s.lines || []}
          blanks={s.blanks || []}
          filled={s.filled || []}
          cur={s.cur || 0}
          breach={s.breach}
          solved={!!s.solved || won}
          locked={!!s.locked}
          denySeq={s.denySeq || 0}
          interactive={false}
          team={team}
          roundNo={hk.roundNo || 1}
          T={T}
        />
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: 14, minHeight: 0 }}>
      <style>{HACK_CSS}</style>
      {/* Bandeau : manche (LCD vert) + rappel téléphones */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '7px 18px', borderRadius: 12,
        background: 'linear-gradient(180deg, #12211a 0%, #081410 100%)',
        boxShadow: 'inset 0 1px 0 rgba(120,255,180,0.18), inset 0 -2px 0 rgba(0,0,0,0.4)',
      }}>
        <span style={{
          fontFamily: "'VT323', monospace", fontSize: 22, letterSpacing: 1, whiteSpace: 'nowrap',
          color: '#7dffa5', textShadow: '0 0 7px rgba(125,255,165,0.5)',
        }}>
          {'>_'} {T('fight.hack.round', { n: hk.roundNo || 1 })}
        </span>
        <span style={{
          flex: 1, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 20, color: '#8effc0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {T('fight.mg.hack.name')}
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'rgba(200,255,225,0.6)', whiteSpace: 'nowrap' }}>
          {'\u{1F4F1}'} {T('fight.hack.phonesHint')}
        </span>
      </div>

      {/* Les deux terminaux, côte à côte */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
        {panel('attacker', attacker)}
        {panel('defender', defender)}
      </div>
    </div>
  );
}
