// Recettes d'alchimie : combinaisons FIXES de 3 ingrédients → 1 potion.
// L'ordre des ingrédients n'a pas d'importance (comparaison par multiset).
// Les recettes ne sont pas connues d'avance : une équipe les DÉCOUVRE en
// distillant le bon trio (team.knownRecipes). Voir extension « alchemy ».
export const RECIPES = [
  { id: 'or',      ingredients: ['herbeDoree', 'fleurLune', 'champignonBleu'],   potion: 'potionOr' },
  { id: 'temps',   ingredients: ['champignonBleu', 'cendreDragon', 'larmeCristal'], potion: 'elixirTemps' },
  { id: 'pierre',  ingredients: ['racinePierre', 'ecailleArgent', 'cendreDragon'],  potion: 'potionPierre' },
  { id: 'hate',    ingredients: ['aileFee', 'larmeCristal', 'fleurLune'],           potion: 'potionRuee' },
  { id: 'supreme', ingredients: ['herbeDoree', 'cendreDragon', 'ecailleArgent'],    potion: 'elixirSupreme' },
];

// Clé canonique d'un trio (multiset trié) pour comparer sans tenir compte de l'ordre.
const tripleKey = (keys) => [...keys].filter(Boolean).sort().join('|');

// Recette correspondant à 3 clés d'ingrédients (ordre indifférent) ou null.
export function matchRecipe(keys, recipes = RECIPES) {
  if (!keys || keys.filter(Boolean).length !== 3) return null;
  const k = tripleKey(keys);
  return recipes.find((r) => tripleKey(r.ingredients) === k) || null;
}
