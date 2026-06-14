// Lot 1 (validé) : 6e (cycle 3, par matière) + Culture générale (pop-culture) +
// Hardcore (lycée). Remplace les exemples temporaires. Idempotent : supprime
// d'abord les lignes marquées (t ∈ {exemple-extra, lot1}), puis réinsère.
//
//   node scripts/seed-questions-lot1.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const MARK = 'lot1';
// La bonne réponse est en 1re position (le jeu mélange les réponses à l'affichage).
// [subject, level|null, q, [bonne, ...distracteurs]]
const SIXE = [
  ['maths', '6e', 'Combien font 9 × 6 ?', ['54', '48', '56', '63']],
  ['maths', '6e', 'Quelle fraction est égale à ½ ?', ['2/4', '1/3', '3/4', '2/3']],
  ['maths', '6e', 'Périmètre d’un rectangle de 4 cm sur 6 cm ?', ['20 cm', '24 cm', '10 cm', '12 cm']],
  ['francais', '6e', '« finir » à la 1re personne du singulier au présent :', ['je finis', 'je finit', 'je finie', 'je finnis']],
  ['francais', '6e', 'Quel est le contraire de « rapide » ?', ['lent', 'vite', 'pressé', 'léger']],
  ['francais', '6e', 'Dans « le chat dort », quel est le verbe ?', ['dort', 'le', 'chat', 'aucun']],
  ['histoire', '6e', 'Quel fleuve traverse l’Égypte antique ?', ['le Nil', 'le Tibre', 'l’Euphrate', 'la Seine']],
  ['histoire', '6e', 'Comment appelle-t-on l’écriture des anciens Égyptiens ?', ['les hiéroglyphes', 'l’alphabet', 'les runes', 'le cunéiforme']],
  ['geographie', '6e', 'Quel est le plus grand océan ?', ['le Pacifique', 'l’Atlantique', 'l’Indien', 'l’Arctique']],
  ['geographie', '6e', 'Sur quel continent se trouve l’Égypte ?', ['l’Afrique', 'l’Asie', 'l’Europe', 'l’Océanie']],
  ['geographie', '6e', 'Quelle ligne partage la Terre en deux hémisphères ?', ['l’équateur', 'le méridien', 'le tropique', 'l’axe']],
  ['svt', '6e', 'De quoi les plantes ont-elles besoin pour fabriquer leur nourriture ?', ['de lumière', 'd’obscurité', 'de viande', 'de sel']],
  ['svt', '6e', 'Combien de pattes a un insecte ?', ['6', '4', '8', '10']],
  ['anglais', '6e', 'Comment dit-on « chien » en anglais ?', ['dog', 'cat', 'horse', 'bird']],
  ['anglais', '6e', 'Que signifie « Hello » ?', ['Bonjour', 'Au revoir', 'Merci', 'Oui']],
];
const CULTURE = [
  ['cultureG', null, 'Quel groupe a chanté « Bohemian Rhapsody » ?', ['Queen', 'The Beatles', 'Rolling Stones', 'ABBA']],
  ['cultureG', null, 'Qui est surnommé le « King of Pop » ?', ['Michael Jackson', 'Elvis Presley', 'Prince', 'Stromae']],
  ['cultureG', null, 'Dans quel film apparaît Dark Vador ?', ['Star Wars', 'Harry Potter', 'Avatar', 'Le Hobbit']],
  ['cultureG', null, 'Quel studio a créé Mickey Mouse ?', ['Disney', 'Pixar', 'DreamWorks', 'Illumination']],
  ['cultureG', null, 'Dans « Le Roi Lion », comment s’appelle le jeune lion héros ?', ['Simba', 'Mufasa', 'Scar', 'Timon']],
  ['cultureG', null, 'Quel plombier moustachu est la mascotte de Nintendo ?', ['Mario', 'Sonic', 'Crash', 'Kirby']],
  ['cultureG', null, 'Quel est le Pokémon électrique jaune le plus connu ?', ['Pikachu', 'Salamèche', 'Bulbizarre', 'Miaouss']],
  ['cultureG', null, 'Dans quel jeu construit-on un monde en blocs cubiques ?', ['Minecraft', 'Fortnite', 'FIFA', 'Tetris']],
  ['cultureG', null, 'Tous les combien d’années ont lieu les JO d’été ?', ['4 ans', '2 ans', '3 ans', '5 ans']],
  ['cultureG', null, 'Dans quel sport marque-t-on un « panier » ?', ['le basket-ball', 'le tennis', 'le rugby', 'le volley']],
  ['cultureG', null, 'Quel pays a gagné la Coupe du monde de football 2018 ?', ['la France', 'la Croatie', 'le Brésil', 'l’Allemagne']],
  ['cultureG', null, 'De quel pays la pizza est-elle originaire ?', ['l’Italie', 'la France', 'l’Espagne', 'la Grèce']],
  ['cultureG', null, 'Quel ingrédient est la base du pain ?', ['la farine', 'le riz', 'le sucre', 'le maïs']],
  ['cultureG', null, 'Quel dessert glacé sert-on souvent en cornet ?', ['la glace', 'le gâteau', 'la crêpe', 'le flan']],
  ['cultureG', null, 'Combien de cases compte un échiquier ?', ['64', '100', '32', '48']],
];
const HARDCORE = [
  ['hardcore', null, 'Quelle est la dérivée de cos(x) ?', ['−sin(x)', 'sin(x)', '−cos(x)', 'tan(x)']],
  ['hardcore', null, 'Quelle est la limite de (1 + 1/n)ⁿ quand n → ∞ ?', ['e', '1', '0', '+∞']],
  ['hardcore', null, 'Quel est le symbole chimique du potassium ?', ['K', 'P', 'Po', 'Pt']],
  ['hardcore', null, 'Quelle est la formule de l’énergie cinétique ?', ['½mv²', 'mgh', 'mv', '½mv']],
  ['hardcore', null, 'Qui a écrit « Le Mythe de Sisyphe » ?', ['Albert Camus', 'Jean-Paul Sartre', 'Friedrich Nietzsche', 'Emmanuel Kant']],
  ['hardcore', null, 'Combien vaut cos(60°) ?', ['1/2', '√3/2', '√2/2', '1']],
  ['hardcore', null, 'En quelle année a commencé la Révolution française ?', ['1789', '1799', '1715', '1804']],
  ['hardcore', null, 'Quel théorème énonce « a² + b² = c² » dans un triangle rectangle ?', ['Pythagore', 'Thalès', 'Euclide', 'Newton']],
  ['hardcore', null, 'Quelle particule porte une charge négative ?', ['l’électron', 'le proton', 'le neutron', 'le photon']],
  ['hardcore', null, 'Quelle est une primitive de 1/x ?', ['ln|x|', 'x²', '−1/x²', 'eˣ']],
  ['hardcore', null, 'Qui a développé la théorie de la relativité ?', ['Albert Einstein', 'Isaac Newton', 'Niels Bohr', 'Galilée']],
  ['hardcore', null, 'Que vaut (environ) le nombre d’Avogadro ?', ['6,02×10²³', '6,02×10²¹', '3,14×10²³', '9,81×10²³']],
  ['hardcore', null, 'Qui a écrit « À la recherche du temps perdu » ?', ['Marcel Proust', 'Gustave Flaubert', 'Albert Camus', 'Émile Zola']],
  ['hardcore', null, 'Quelle est la dérivée de eˣ ?', ['eˣ', 'x·eˣ⁻¹', '1/x', 'ln(x)']],
  ['hardcore', null, 'Qui a écrit « Du contrat social » ?', ['Rousseau', 'Voltaire', 'Montesquieu', 'Diderot']],
];

const rows = [...SIXE, ...CULTURE, ...HARDCORE].map(([subject, level, q, a], i) => ({
  pool: 'cycle4',
  subject,
  level,
  q,
  rep_a: a[0], rep_b: a[1], rep_c: a[2] ?? null, rep_d: a[3] ?? null,
  correcte: 1, // bonne réponse en 1re position ; mélangée à l'affichage (shuffleAnswers)
  e: null,
  t: MARK,
  enabled: true,
  ord: 9000 + i,
}));

// Nettoie le lot précédent ET les exemples temporaires, puis réinsère.
for (const m of ['exemple-extra', MARK]) {
  const del = await supabase.from('quete_questions').delete().eq('t', m);
  if (del.error) { console.error('DELETE échec :', del.error.message); process.exit(1); }
}

const { error } = await supabase.from('quete_questions').insert(rows);
if (error) { console.error('INSERT échec :', error.message); process.exit(1); }

console.log(`Terminé. ${rows.length} questions insérées (6e:${SIXE.length} · cultureG:${CULTURE.length} · hardcore:${HARDCORE.length}).`);
