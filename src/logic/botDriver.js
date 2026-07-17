// ============================================================
//  DRIVER des bots (mode SOLO) — la mécanique du « quand ».
//
//  Observe le store (subscribe Zustand) et, quand le cerveau (botBrain)
//  signale une décision en attente, la planifie après un délai « humain »
//  (spectacle rythmé : on voit le bot réfléchir puis agir).
//
//  Garanties :
//   · IDEMPOTENCE — une décision = une signature ; tant qu'elle ne change
//     pas on ne replanifie rien, et un timer qui se réveille sur un état
//     périmé (signature différente) ne tire pas.
//   · UN SEUL timer d'action à la fois (annulé/replanifié à chaque
//     changement de signature).
//   · WATCHDOG anti soft-lock — si une décision reste en attente trop
//     longtemps (action au comportement inattendu, état non couvert), on
//     joue l'action de secours du cerveau (décliner/annuler/continuer).
//   · Les actions du store ayant leurs gardes internes, un tir fantôme est
//     un no-op — jamais de nextTurn() aveugle ici.
//
//  Testabilité : délais multipliés par `delayScale` (0 en test), `rng`
//  injectable, watchdog non scalé (fake timers).
// ============================================================
import { pendingDecision } from './botBrain.js';

export const WATCHDOG_MS = 12000;

export function createBotDriver(store, { delayScale = 1, rng = Math.random, watchdogMs = WATCHDOG_MS } = {}) {
  let unsub = null;
  let actionTimer = null;
  let watchdogTimer = null;
  let lastSig = null;

  const clearTimers = () => {
    if (actionTimer) { clearTimeout(actionTimer); actionTimer = null; }
    if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
  };

  const exec = (sig, { action, args }) => {
    const st = store.getState();
    // État périmé (l'humain a agi au tableau, un timeout du jeu est passé…) :
    // on jette le tir — les gardes du store en feraient un no-op de toute façon.
    if (pendingDecision(st)?.sig !== sig) return;
    const fn = st[action];
    if (typeof fn === 'function') fn(...(args || []));
    else console.warn('[bot] action inconnue :', action);
  };

  const evaluate = () => {
    const state = store.getState();
    const pending = pendingDecision(state);
    const sig = pending?.sig ?? null;
    if (sig === lastSig) return; // même décision → timers déjà en place
    lastSig = sig;
    clearTimers();
    if (!pending) return;

    const decision = pending.decide(rng);
    if (decision) {
      const delay = Math.max(0, Math.round((decision.delayMs ?? 1500) * delayScale));
      actionTimer = setTimeout(() => {
        actionTimer = null;
        exec(sig, decision);
      }, delay);
    }
    // Watchdog : la décision (ou l'attente d'un enchaînement auto) n'a pas
    // fait évoluer l'état → secours. `lastSig` est remis à zéro pour forcer
    // une réévaluation complète après le secours.
    watchdogTimer = setTimeout(() => {
      watchdogTimer = null;
      const st = store.getState();
      if (pendingDecision(st)?.sig !== sig) return;
      console.warn('[bot] watchdog :', sig, pending.fallback ? `→ ${pending.fallback.action}` : '(pas de secours)');
      if (pending.fallback) exec(sig, pending.fallback);
      lastSig = null;
      evaluate();
    }, watchdogMs);
  };

  return {
    start() {
      if (unsub) return;
      unsub = store.subscribe(evaluate);
      evaluate();
    },
    stop() {
      if (unsub) { unsub(); unsub = null; }
      clearTimers();
      lastSig = null;
    },
    // Pour les tests : force une réévaluation immédiate.
    tick: evaluate,
  };
}
