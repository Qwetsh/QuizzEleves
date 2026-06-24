// Pactes de non-agression — extension « Complots & pactes ».
//
// Une promesse vit sur l'équipe qui l'a faite :
//   team.promises = [{ to: <teamIdx>, turns: <n> }]
//   = « je promets de NE PAS attaquer l'équipe `to` pendant `turns` tours ».
//
// La promesse est BRISABLE : rien ne bloque l'attaque dans le moteur. La trahison
// (attaquer une cible qu'on avait promis d'épargner) est détectée et punie au
// moment de l'attaque (cf. powerHandlers.resolveBetrayals). Les promesses se
// décrémentent quand l'équipe REGAGNE LA MAIN, comme les buffs/Immunité totale.
//
// Une offre diplomatique transite par la table `quete_trades` (réutilisée) : sa
// `give`/`want` peut porter un terme `pact: { turns }` en plus de l'or/objets.

// Valeurs d'équilibrage (points de départ — calibrables ensuite).
export const PACT_DEFAULT_TURNS = 2; // durée par défaut d'un pacte (fourchette 1-5)
export const PACT_MIN_TURNS = 1;
export const PACT_MAX_TURNS = 5;
export const PACT_BETRAY_PENALTY = 10; // or perdu par le traître (fourchette 5-20)

// Une « spec » d'offre (give/want) porte-t-elle un terme de pacte ?
export const hasPactSpec = (spec) => !!(spec && spec.pact);

// Une offre (ligne quete_trades) est-elle diplomatique (un côté porte un pacte) ?
export const isPactTrade = (trade) => hasPactSpec(trade?.give) || hasPactSpec(trade?.want);

// Durée (clampée) demandée par une spec de pacte, ou 0 si pas de pacte.
export function pactTurns(spec) {
  if (!hasPactSpec(spec)) return 0;
  const n = Math.trunc(spec.pact.turns ?? PACT_DEFAULT_TURNS);
  if (!Number.isFinite(n) || n <= 0) return PACT_DEFAULT_TURNS;
  return Math.max(PACT_MIN_TURNS, Math.min(PACT_MAX_TURNS, n));
}

// Renvoie une COPIE de `promises` garantissant une promesse vers `toIdx` d'au
// moins `turns` tours (on conserve la durée la plus longue si elle existe déjà).
export function withPromise(promises, toIdx, turns) {
  const others = (promises || []).filter((p) => p && p.to !== toIdx);
  const existing = (promises || []).find((p) => p && p.to === toIdx);
  const t = Math.max(turns || 0, existing?.turns ?? 0);
  if (t <= 0) return others;
  return [...others, { to: toIdx, turns: t }];
}

// L'équipe a-t-elle une promesse ACTIVE de ne pas attaquer `toIdx` ?
export const hasActivePromise = (team, toIdx) =>
  (team?.promises || []).some((p) => p && p.to === toIdx && (p.turns ?? 0) > 0);

// Retire la promesse vers `toIdx` (pacte rompu ou expiré).
export const withoutPromise = (promises, toIdx) =>
  (promises || []).filter((p) => p && p.to !== toIdx);

// Décrémente toutes les promesses d'un tour et retire les expirées.
// Renvoie { promises, expired } (expired = nombre de pactes arrivés à terme).
export function tickPromises(promises) {
  if (!promises?.length) return { promises: promises || [], expired: 0 };
  const next = [];
  let expired = 0;
  for (const p of promises) {
    const turns = (p.turns ?? 1) - 1;
    if (turns > 0) next.push({ ...p, turns });
    else expired++;
  }
  return { promises: next, expired };
}

// ── Coalitions (« attaques communes ») ────────────────────────────────────────
//
// L'inverse d'un pacte : deux équipes conviennent EN SECRET de viser une même
// cible. Purement un marqueur partagé (les deux téléphones l'affichent) — AUCUN
// effet automatique : les équipes coordonnent elles-mêmes leurs attaques.
//   team.coalitions = [{ with: <allyIdx>, against: <targetIdx>, turns: <n> }]
//
// Transite par la table `quete_trades` : un côté give/want porte un terme
// `coalition: { against, turns }` (les deux côtés pour un accord mutuel).

export const hasCoalitionSpec = (spec) => !!(spec && spec.coalition);

// Une offre porte-t-elle un terme de coalition (sur l'un des deux côtés) ?
export const isCoalitionTrade = (trade) => hasCoalitionSpec(trade?.give) || hasCoalitionSpec(trade?.want);

// Une offre est-elle « diplomatique » (secrète) : pacte OU coalition ?
export const isDiploTrade = (trade) => isPactTrade(trade) || isCoalitionTrade(trade);

// Durée (clampée) d'une spec de coalition, ou 0 si pas de coalition.
export function coalitionTurns(spec) {
  if (!hasCoalitionSpec(spec)) return 0;
  const n = Math.trunc(spec.coalition.turns ?? PACT_DEFAULT_TURNS);
  if (!Number.isFinite(n) || n <= 0) return PACT_DEFAULT_TURNS;
  return Math.max(PACT_MIN_TURNS, Math.min(PACT_MAX_TURNS, n));
}

// Renvoie une COPIE de `coalitions` garantissant une coalition (allié `withIdx`,
// cible `againstIdx`) d'au moins `turns` tours (garde la durée la plus longue).
export function withCoalition(coalitions, withIdx, againstIdx, turns) {
  const same = (c) => c && c.with === withIdx && c.against === againstIdx;
  const others = (coalitions || []).filter((c) => !same(c));
  const existing = (coalitions || []).find(same);
  const t = Math.max(turns || 0, existing?.turns ?? 0);
  if (t <= 0) return others;
  return [...others, { with: withIdx, against: againstIdx, turns: t }];
}

// Décrémente toutes les coalitions d'un tour et retire les expirées.
export function tickCoalitions(coalitions) {
  if (!coalitions?.length) return { coalitions: coalitions || [], expired: 0 };
  const next = [];
  let expired = 0;
  for (const c of coalitions) {
    const turns = (c.turns ?? 1) - 1;
    if (turns > 0) next.push({ ...c, turns });
    else expired++;
  }
  return { coalitions: next, expired };
}
