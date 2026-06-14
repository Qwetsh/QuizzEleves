// Lot 2 : Culture générale « 2010-2025 » (pop-culture récente). S'AJOUTE au lot 1
// (ne le remplace pas). Idempotent : supprime t='lot2' puis réinsère.
//
//   node scripts/seed-questions-lot2.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const MARK = 'lot2';
// Bonne réponse en 1re position (mélangée à l'affichage).
const DEFS = [
  ['Quel jeu « battle royale » avec des constructions est sorti en 2017 ?', ['Fortnite', 'Minecraft', 'Among Us', 'Roblox']],
  ['Quelle chanteuse a sorti l’album « 25 » et le tube « Hello » en 2015 ?', ['Adele', 'Beyoncé', 'Rihanna', 'Taylor Swift']],
  ['Quel tube de Luis Fonsi (2017) a battu des records de vues sur YouTube ?', ['Despacito', 'Gangnam Style', 'Shape of You', 'Baby Shark']],
  ['Quel jeu mobile de 2016 fait chasser des créatures dans la rue au téléphone ?', ['Pokémon GO', 'Candy Crush', 'Clash of Clans', 'Angry Birds']],
  ['Quel film Marvel de 2019 est devenu un des plus gros succès du cinéma ?', ['Avengers: Endgame', 'Iron Man', 'Black Panther', 'Les Gardiens de la Galaxie']],
  ['Quelle série Netflix met en scène des enfants face au « Demogorgon » ?', ['Stranger Things', 'La Casa de Papel', 'Wednesday', 'Lupin']],
  ['Quelle série coréenne (2021) avec des jeux d’enfants mortels a cartonné ?', ['Squid Game', 'Alice in Borderland', 'Dark', 'The Witcher']],
  ['Quel pays a gagné la Coupe du monde de football 2022 ?', ['l’Argentine', 'la France', 'le Brésil', 'la Croatie']],
  ['Quel footballeur portugais est le grand rival de Lionel Messi ?', ['Cristiano Ronaldo', 'Neymar', 'Kylian Mbappé', 'Karim Benzema']],
  ['Quelle danse accompagnait le tube « Gangnam Style » (2012) ?', ['la danse du cheval', 'le floss', 'le dab', 'la macarena']],
  ['Quel réseau social de vidéos courtes est devenu très populaire vers 2020 ?', ['TikTok', 'Vine', 'BeReal', 'Snapchat']],
  ['Quel jeu de 2020 où l’on démasque l’imposteur a explosé pendant le confinement ?', ['Among Us', 'Fall Guys', 'Valorant', 'Phasmophobia']],
  ['Quelle chanteuse a sorti « Bad Guy » en 2019 ?', ['Billie Eilish', 'Dua Lipa', 'Olivia Rodrigo', 'Ariana Grande']],
  ['Quel film d’animation Disney de 2013 a popularisé « Libérée, délivrée » ?', ['La Reine des Neiges', 'Vaiana', 'Raiponce', 'Encanto']],
  ['Quel film de 2023 sur une célèbre poupée a été un énorme succès ?', ['Barbie', 'Oppenheimer', 'Wonka', 'Super Mario Bros, le film']],
];

const rows = DEFS.map(([q, a], i) => ({
  pool: 'cycle4', subject: 'cultureG', level: null,
  q, rep_a: a[0], rep_b: a[1], rep_c: a[2] ?? null, rep_d: a[3] ?? null,
  correcte: 1, e: null, t: MARK, enabled: true, ord: 9100 + i,
}));

const del = await supabase.from('quete_questions').delete().eq('t', MARK);
if (del.error) { console.error('DELETE échec :', del.error.message); process.exit(1); }
const { error } = await supabase.from('quete_questions').insert(rows);
if (error) { console.error('INSERT échec :', error.message); process.exit(1); }
console.log(`Terminé. ${rows.length} questions Culture G « 2010-2025 » insérées.`);
