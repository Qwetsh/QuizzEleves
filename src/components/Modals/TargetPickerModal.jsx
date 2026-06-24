import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { locName, locDesc } from '../../i18n/content';
import { POWERS } from '../../data/powers';
import { hasActivePromise } from '../../logic/pacts';
import ModalOverlay from './ModalOverlay';
import TeamTargetButton from './TeamTargetButton';

// Décrit l'entête du picker selon la source (pouvoir legacy ou moteur d'effets).
function pickerInfo(stp, T) {
  if (!stp) return null;
  if (stp.source === 'engine') {
    const a = stp.action || {};
    const isMoney = a.action === 'money';
    return {
      icon: isMoney ? '💰' : '🎯',
      color: isMoney ? '#e8b117' : '#c9472f',
      name: isMoney ? T('modal.target.stealName') : T('modal.target.moveName'),
      desc: T('modal.target.desc'),
    };
  }
  if (stp.source === 'surge') {
    // Sur-réduction (Bouclier L7) : choisir l'équipe à reculer du surplus.
    return { icon: '⏩', color: POWERS.bouclier?.color || '#3b6cb3', name: T('modal.target.surgeName'), desc: T('modal.target.surgeDesc', { n: stp.amount }) };
  }
  const p = POWERS[stp.powerKey];
  return p ? { icon: p.icon, color: p.color, name: locName(p), desc: locDesc(p) } : null;
}

export default function TargetPickerModal() {
  const T = useT();
  const showTargetPicker = useGameStore((s) => s.showTargetPicker);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const selectTarget = useGameStore((s) => s.selectTarget);
  const cancelTargetPicker = useGameStore((s) => s.cancelTargetPicker);
  // Cible sous pacte cliquée : on demande confirmation avant de TRAHIR (et de
  // déclencher la cérémonie publique). null = pas de confirmation en attente.
  const [betrayIdx, setBetrayIdx] = useState(null);

  const info = pickerInfo(showTargetPicker, T);
  const me = teams[currentTeam];

  return (
    <AnimatePresence>
      {showTargetPicker && info && (
        <ModalOverlay onClose={cancelTargetPicker} className="max-w-sm">
          <div style={{ padding: '26px 26px 4px', textAlign: 'center' }}>
            <div
              style={{
                width: 80, height: 80, borderRadius: 22,
                margin: '0 auto 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40,
                background: `linear-gradient(180deg, ${info.color}cc, ${info.color})`,
                boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -5px 0 rgba(0,0,0,0.18), 0 6px 0 rgba(110,30,18,0.4)',
              }}
            >
              {info.icon}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{info.name}</h2>
            <p style={{ fontSize: 14, color: 'var(--ink-600)', marginTop: 4 }}>{info.desc}</p>
          </div>

          {betrayIdx != null ? (
            // Confirmation de TRAHISON : briser un pacte est public et coûteux.
            <div style={{ padding: '10px 26px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 6 }}>🐍</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: '#a8341f' }}>
                {T('modal.target.betrayTitle', { emoji: teams[betrayIdx].emoji, name: teams[betrayIdx].name })}
              </p>
              <p style={{ fontSize: 13.5, color: 'var(--ink-600)', marginTop: 6 }}>{T('modal.target.betrayWarn')}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => { const i = betrayIdx; setBetrayIdx(null); selectTarget(i); }}
                  style={{ flex: 1, padding: '12px 8px', borderRadius: 14, border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-display)', fontSize: 15, color: '#fff',
                    background: 'linear-gradient(180deg,#c14a32,#9a2f1c)' }}
                >
                  {T('modal.target.betrayConfirm')}
                </button>
                <button
                  onClick={() => setBetrayIdx(null)}
                  style={{ flex: 1, padding: '12px 8px', borderRadius: 14, cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-700)',
                    background: '#fffefb', border: '2px solid rgba(122,94,58,0.22)' }}
                >
                  {T('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
          <div style={{ padding: '10px 26px 24px' }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>{T('modal.target.chooseTeam')}</p>
            <div className="space-y-2">
              {teams.map((team, i) => {
                if (i === currentTeam) return null;
                // Une équipe sous Immunité totale ne peut pas être ciblée par une attaque.
                const immune = (team.totalImmuneTurns ?? 0) > 0;
                // Pacte de non-agression : on peut quand même attaquer (promesse
                // brisable), mais on prévient et on confirme avant de trahir. Seuls
                // les VRAIS pouvoirs offensifs déclenchent la trahison (la pénalité
                // vit dans applyOffensivePower) — pas les ciblages du moteur d'effets.
                const promised = !showTargetPicker.source && !immune && hasActivePromise(me, i);
                return (
                  <TeamTargetButton
                    key={i}
                    team={team}
                    disabled={immune}
                    disabledNote={immune ? `(${T('modal.target.immune')})` : undefined}
                    note={promised ? `🐍 ${T('modal.target.pact')}` : undefined}
                    onClick={() => (promised ? setBetrayIdx(i) : selectTarget(i))}
                  />
                );
              })}
            </div>
            <button
              onClick={cancelTargetPicker}
              style={{
                marginTop: 16, width: '100%',
                fontSize: 14, color: 'var(--ink-500)',
                cursor: 'pointer', background: 'none', border: 'none',
                fontFamily: 'var(--font-ui)',
                padding: 8,
              }}
            >
              {T('common.cancel')}
            </button>
          </div>
          )}
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
