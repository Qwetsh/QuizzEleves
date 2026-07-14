// i18n léger (FR/EN) piloté par le flag `englishMode`. Pas de lib externe.
// - Au TBI : `useT()` lit `englishMode` du store.
// - Au mobile (autre root React) : `tFor(session.englishMode)` (pas de store).
// Les dictionnaires sont découpés par ZONE (src/i18n/dicts/*) et fusionnés ici —
// clés à points namespacées (setup.*, game.*, modal.*, mobile.*, fight.*, common.*).
import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { getLang } from './lang.js';
export { getLang, setLang } from './lang.js';
import common from './dicts/common.js';
import setup from './dicts/setup.js';
import game from './dicts/game.js';
import modals from './dicts/modals.js';
import mobile from './dicts/mobile.js';
import fight from './dicts/fight.js';
// Journal de partie (messages addLog/announce générés dans les handlers du store).
import logStore from './dicts/logStore.js';
import logEffects from './dicts/logEffects.js';
import logEvents from './dicts/logEvents.js';
import logPowers from './dicts/logPowers.js';
import logItems from './dicts/logItems.js';
import logFight from './dicts/logFight.js';
import logTurn from './dicts/logTurn.js';
import logMagic from './dicts/logMagic.js';
import weather from './dicts/weather.js';

// DICT[key] = { fr, en } (ou { fr:[sing,plur], en:[sing,plur] } pour les pluriels).
export const DICT = {
  ...common, ...setup, ...game, ...modals, ...mobile, ...fight,
  ...logStore, ...logEffects, ...logEvents, ...logPowers, ...logItems, ...logFight, ...logTurn,
  ...logMagic, ...weather,
};

const interpolate = (s, vars) => (vars
  ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])))
  : s);

// Traduit une clé. Repli : EN→FR→clé. `vars` interpole {x}.
export function t(key, vars, lang = 'fr') {
  const e = DICT[key];
  let s = e ? (e[lang] ?? e.fr ?? key) : key;
  if (Array.isArray(s)) s = s[0]; // forme plurielle utilisée via tplural
  return interpolate(s, vars);
}

// Pluriel : choisit singulier/pluriel selon n. dict[key] = { fr:[s,p], en:[s,p] }.
// Règle : EN singulier si n===1 ; FR singulier si |n|<=1 (0 et 1).
export function tplural(key, n, vars = {}, lang = 'fr') {
  const e = DICT[key];
  const forms = e ? (e[lang] ?? e.fr) : null;
  const isSing = lang === 'en' ? n === 1 : Math.abs(n) <= 1;
  const s = Array.isArray(forms) ? (isSing ? forms[0] : forms[1]) : (forms ?? key);
  return interpolate(s, { n, ...vars });
}

// Fonction de traduction liée à une langue (en = booléen englishMode).
export function tFor(en) {
  const lang = en ? 'en' : 'fr';
  const fn = (key, vars) => t(key, vars, lang);
  fn.lang = lang;
  fn.plural = (key, n, vars) => tplural(key, n, vars, lang);
  return fn;
}

// Traduction « globale » pour le code HORS React (handlers du store, moteurs) :
// suit la langue module-globale (getLang(), synchronisée au toggle). Pratique
// pour les messages du journal générés côté logique.
export function tg(key, vars) { return t(key, vars, getLang()); }
export function tgPlural(key, n, vars) { return tplural(key, n, vars, getLang()); }

// Hook TBI : renvoie une fonction de traduction qui suit le toggle du store.
export function useT() {
  const en = useGameStore((s) => s.englishMode);
  return useMemo(() => tFor(en), [en]);
}
