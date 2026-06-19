// Langue d'AFFICHAGE courante du root React (TBI ou mobile), tenue à jour avec
// `englishMode`. Permet aux helpers de contenu (effectText, noms de données) de
// connaître la langue SANS qu'on doive passer `lang` à chaque appel.
// NB : un root = une seule langue (TBI et mobile sont des contextes JS séparés),
// donc une variable de module suffit. La langue est figée pendant une partie
// (choisie au Setup) → pas besoin d'abonnement par composant.
let _lang = 'fr';
export const getLang = () => _lang;
export const setLang = (l) => { _lang = l === 'en' ? 'en' : 'fr'; };
