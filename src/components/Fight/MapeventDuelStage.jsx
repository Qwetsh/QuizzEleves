// Police « LCD » du bandeau TV rétro (auto-hébergée, comme l'écran cassettes).
import '@fontsource/vt323/400.css';
import { useGameStore } from '../../store/gameStore';
import { onlineToken } from '../../logic/sessionConfig';
import LotrEventMap from './minigames/LotrEventMap';
import MapeventDuelView from './MapeventDuelView';
import { useT } from '../../i18n';

/**
 * Duel « Chroniques de la Terre du Milieu » (LIEU → ÉVÉNEMENT) piloté par le
 * STORE — rendu dans FightModal (phase minigame, showFight.mapevent). Comme le
 * Curioscope / les sorciers, ce duel tourne sur les 3 surfaces :
 * - fenêtre de l'HÔTE EN LIGNE dont l'équipe est duelliste → il joue son duel
 *   (MapeventDuelView branché sur l'action store mapeventAnswer) ;
 * - sinon (écran partagé du mode « écran + téléphones », hôte non-duelliste,
 *   miroir en ligne) → vue SPECTATEUR : la carte avec le lieu qui pulse en grand
 *   dans la TV CRT rétro + les 4 événements en lecture seule + « Répondez sur vos
 *   téléphones ! ». Les DEUX camps répondent (course) sur leur appareil.
 */
export default function MapeventDuelStage({ fight, attacker, defender }) {
  const T = useT();
  const teams = useGameStore((s) => s.teams);
  const mirror = useGameStore((s) => !!s._mirror);
  const online = useGameStore((s) => s.connectionMode === 'online');
  const sessionCode = useGameStore((s) => s.sessionCode);
  const mapeventAnswer = useGameStore((s) => s.mapeventAnswer);

  const me = fight.mapevent;
  if (!me) return null;

  // Hôte en ligne = joueur : si SON équipe est un des duellistes, il joue ici
  // (même résolution de jeton que WizardDuelStage / ChessDuelStage).
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
      <MapeventDuelView
        fight={{ ...fight, mapevent: me, winnerIndex: null }}
        teams={teams}
        myTeamIdx={myTeamIdx}
        onAnswer={(choiceId) => mapeventAnswer && mapeventAnswer(hostSide, choiceId)}
        onReward={() => {}}
        onClose={() => {}}
      />
    );
  }

  // --- Vue spectateur (écran partagé / miroir) : la carte + les 4 événements en
  // lecture seule, « Répondez sur vos téléphones ! ».
  const target = me.target || {};
  const choices = Array.isArray(me.choices) ? me.choices : [];
  const reveal = me.reveal || null;
  const correctId = reveal?.correctId ?? null;
  const winner = reveal?.winner || null;
  const winTeam = winner === 'attacker' ? attacker : winner === 'defender' ? defender : null;
  const label = (c) => (T.lang === 'en' ? (c.eventEn || c.event) : c.event);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: 14, minHeight: 0 }}>
      {/* Bandeau : titre (LCD ambré) + rappel téléphones */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '7px 18px', borderRadius: 12,
        background: 'linear-gradient(180deg, #463e30 0%, #2a2317 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.4)',
      }}>
        <span style={{
          fontFamily: "'VT323', monospace", fontSize: 22, letterSpacing: 1, whiteSpace: 'nowrap',
          color: '#f3c969', textShadow: '0 0 7px rgba(243,201,105,0.5)',
        }}>
          {'\u{1F5FA}'} {T('fight.mg.lotrevent.name')}
        </span>
        <span style={{
          flex: 1, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 18, color: '#ffe8b0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {T('fight.lotrevent.prompt')}
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'rgba(255,240,210,0.6)', whiteSpace: 'nowrap' }}>
          {'\u{1F4F1}'} {T('fight.mapevent.phonesHint')}
        </span>
      </div>

      {/* La scène en grand : la carte avec le lieu qui pulse (cadre CRT rétro). */}
      <div style={{
        position: 'relative', flex: '1 1 52%', minHeight: 0, borderRadius: 16, overflow: 'hidden',
        padding: 10, background: 'linear-gradient(180deg, #2a1f10, #140d05)',
        border: '3px solid rgba(180,140,70,0.4)',
        boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.5)',
      }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden' }}>
          <LotrEventMap universe={me.universe} x={target.x} y={target.y} />
        </div>

        {/* Bandeau de fin par-dessus la scène */}
        {winTeam && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 30, padding: '10px 28px', borderRadius: 999,
              color: '#25301a', background: 'rgba(155,230,127,0.97)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
            }}>
              {winTeam.name} 🏆
            </span>
          </div>
        )}
      </div>

      {/* Les 4 événements en LECTURE SEULE + « Répondez sur vos téléphones ! ».
          À la révélation, le bon choix (correctId) est surligné en vert. */}
      <div style={{
        flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '10px 14px', borderRadius: 12,
        background: 'linear-gradient(180deg, rgba(60,46,26,0.6), rgba(30,20,10,0.6))',
        border: '1px solid rgba(180,140,70,0.25)',
      }}>
        {choices.length ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {choices.map((c) => {
              const isCorrect = reveal && correctId != null && c.id === correctId;
              return (
                <span key={c.id} style={{
                  fontFamily: 'var(--font-ui)', fontSize: 14, lineHeight: 1.3,
                  color: isCorrect ? '#25301a' : 'rgba(255,255,255,0.85)',
                  padding: '6px 14px', borderRadius: 999,
                  background: isCorrect ? 'rgba(155,230,127,0.95)' : 'rgba(255,255,255,0.08)',
                  border: `${isCorrect ? 2 : 1}px solid ${isCorrect ? '#5b8c3a' : 'rgba(255,255,255,0.12)'}`,
                }}>{label(c)}</span>
              );
            })}
          </div>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-ui)', fontSize: 14 }}>…</div>
        )}
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: '#f3c969' }}>
          {'\u{1F4F1}'} {T('fight.mapevent.phonesHint')}
        </div>
      </div>
    </div>
  );
}
