// Table des sorts sur le TBI : MÊME interface que l'app élève (SpellTableView +
// CodexView réutilisés) dans une modale au format téléphone — c'est le repli
// « sans téléphone » et l'outil de test DEV. Le cast est appliqué DIRECTEMENT
// pour l'équipe active (castSpellFor) ; la modale SE FERME sur une incantation
// aboutie (cast/découverte/fizzle) pour laisser la cérémonie plein écran
// (SpellCeremony, zIndex 80 < modale 120) se jouer au tableau.
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { magicRegenPerMin, magicMaxOf } from '../../logic/magic';
import { tFor } from '../../i18n';
import SpellTableView from '../Mobile/SpellTableView';
import CodexView from '../Mobile/CodexView';

// `dock` (jeu en ligne) : table PRIVÉE de MON équipe, incantation via l'intent
// `castSpell` (dock.dispatch) — la cérémonie joue via le snapshot diffusé.
export default function SpellTableModal({ dock = null }) {
  const showSpellTable = useGameStore((s) => s.showSpellTable);
  const closeSpellTable = useGameStore((s) => s.closeSpellTable);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const en = useGameStore((s) => s.englishMode);
  const castSpellFor = useGameStore((s) => s.castSpellFor);
  // Même verrou d'ambiance que le payload mobile (session.locked) : incanter est
  // grisé pendant une résolution — l'hôte refuse de toute façon (double filet).
  const resolving = useGameStore((s) => !!(s.showQuestion || s.showEvent || s.showFight || s.showDuelChoice
    || s.rolling || s.showDiceModal || s.awaitingChoice || s.pendingActions || s.pendingLanding));
  const [sub, setSub] = useState('table');

  const show = dock ? dock.open : showSpellTable;
  const close = dock ? dock.onClose : closeSpellTable;
  const teamIdx = dock ? dock.teamIdx : currentTeam;

  if (!show) return null;
  const team = teams[teamIdx];
  if (!team) return null;
  const T = tFor(en);

  // Même contrat de données que le payload mobile : barre + taux/plafond résolus.
  const magic = {
    stored: team.magic?.stored ?? 0,
    lastTs: team.magic?.lastTs ?? Date.now(),
    regenPerMin: magicRegenPerMin(team),
    max: magicMaxOf(team),
    lastCastAt: team.lastCastAt || 0,
  };
  const teamList = teams.map((t, idx) => ({ idx, name: t.name, emoji: t.emoji, color: t.color }));

  const onCast = (payload) => {
    if (dock) {
      // À distance : l'issue (réussite/fizzle) n'est connue que par l'hôte —
      // on ferme pour laisser la cérémonie diffusée se jouer à l'écran.
      dock.dispatch('castSpell', payload);
      close();
      return;
    }
    const r = castSpellFor(currentTeam, payload);
    // Incantation partie au moteur (réussie, découverte OU fizzle) : place à la
    // cérémonie. Refus silencieux (noMana/cooldown/busy) : la table reste ouverte.
    if (r?.ok || r?.reason === 'fizzle') close();
  };

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(20,12,30,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="mgc-root" style={{ width: 'min(480px,96vw)', height: 'min(88vh,880px)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}>
        <button onClick={close} aria-label="✕" style={{ position: 'absolute', top: 8, right: 10, zIndex: 80, width: 32, height: 32, borderRadius: 16, border: 'none', background: 'rgba(150,120,255,0.2)', color: '#cdb4ff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <div style={{ textAlign: 'center', padding: '10px 40px 0', fontFamily: "'Baloo 2', var(--font-display), sans-serif", fontWeight: 800, fontSize: 19, color: '#efe6ff' }}>
          {'\u{2728}'} {team.emoji} {team.name}
        </div>
        <div className="mgc-seg">
          <button className={sub === 'table' ? 'is-on' : ''} onClick={() => setSub('table')}>{'\u{1FA84}'} {T('mobile.magic.table')}</button>
          <button className={sub === 'codex' ? 'is-on' : ''} onClick={() => setSub('codex')}>{'\u{1F4D6}'} {T('mobile.magic.codex')}</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {sub === 'table' ? (
            <SpellTableView
              magic={magic}
              knownRunes={team.knownRunes || []}
              knownSpells={team.knownSpells || []}
              teams={teamList}
              myIdx={teamIdx}
              locked={dock ? resolving : false}
              en={en}
              onCast={onCast}
              bottomInset={8}
            />
          ) : (
            <CodexView knownRunes={team.knownRunes || []} knownSpells={team.knownSpells || []} faceMods={team.faceMods || {}} en={en} />
          )}
        </div>
      </div>
    </div>
  );
}
