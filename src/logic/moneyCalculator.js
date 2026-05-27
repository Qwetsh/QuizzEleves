/**
 * Calcule le gain d'argent en fonction du temps restant sur le timer.
 * Plus le temps restant est eleve, plus le gain est important.
 *
 * @param {number} timeLeft - secondes restantes (0 a maxTime)
 * @param {number} maxTime - duree max du timer (defaut 30)
 * @returns {number} gain en pieces
 */
export function calculateMoneyGain(timeLeft, maxTime = 30) {
  if (timeLeft <= 0) return 0;
  const ratio = timeLeft / maxTime;

  if (ratio >= 0.8) return 10;
  if (ratio >= 0.6) return 8;
  if (ratio >= 0.4) return 6;
  if (ratio >= 0.2) return 4;
  return 2;
}

/**
 * Verifie si une equipe peut acheter un pouvoir.
 * @param {number} money - argent actuel
 * @param {number} price - prix du pouvoir
 * @returns {boolean}
 */
export function canAfford(money, price) {
  return money >= price;
}
