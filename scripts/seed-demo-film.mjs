// Thème DÉMO « Film » (non scolaire) : 1 module + 3 sous-thèmes + ~12 questions.
// Sert à VOIR le système de thèmes en action (mono : voies = sous-thèmes ;
// multi Collège+Film : voies = thèmes). Idempotent (upsert + delete/insert).
//
//   node scripts/seed-demo-film.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const moduleRow = { key: 'film', name: 'Film', name_en: 'Movies', icon: '🎬', kind: 'themed', description: 'Thème démo : cinéma.', color: '#c0392b', color_soft: '#f3d4cf', color_deep: '#5e1a13', biome: 'Le Grand Écran', biome_en: 'The Silver Screen', enabled: true, ord: 1 };

const catRows = [
  { key: 'film_scifi',  module: 'film', name: 'Science-fiction', name_en: 'Sci-fi',    short: 'SF', icon: '🚀', color: '#3b6cb3', color_soft: '#d2dceb', color_deep: '#1a3357', biome: 'La Galaxie Lointaine', biome_en: 'The Far Galaxy', role: 'subject', board: true, default_on: true, lv2_member: false, enabled: true, ord: 20 },
  { key: 'film_anim',   module: 'film', name: 'Animation',       name_en: 'Animation', short: 'AN', icon: '🎨', color: '#cf5aa0', color_soft: '#f1d6e8', color_deep: '#6e2b54', biome: 'Le Studio Enchanté',  biome_en: 'The Enchanted Studio', role: 'subject', board: true, default_on: true, lv2_member: false, enabled: true, ord: 21 },
  { key: 'film_action', module: 'film', name: 'Action',          name_en: 'Action',    short: 'AC', icon: '💥', color: '#c65429', color_soft: '#f2d9d0', color_deep: '#692d16', biome: 'L’Arène des Cascades', biome_en: 'The Stunt Arena', role: 'subject', board: true, default_on: true, lv2_member: false, enabled: true, ord: 22 },
];

// Questions : pool='cycle4', level=null (transverse, car module 'themed').
const Q = (subject, q, [a, b, c, d], correcte, e) => ({ pool: 'cycle4', subject, level: null, q, rep_a: a, rep_b: b, rep_c: c, rep_d: d, correcte, e, t: 'Film', enabled: true, ord: 0 });

const questions = [
  Q('film_scifi', 'Dans quelle saga apparaît le sabre laser ?', ['Star Wars', 'Star Trek', 'Matrix', 'Alien'], 1, 'Le sabre laser est l’arme emblématique des Jedi dans Star Wars.'),
  Q('film_scifi', 'Qui a réalisé « Inception » ?', ['Steven Spielberg', 'Christopher Nolan', 'James Cameron', 'Denis Villeneuve'], 2, 'Christopher Nolan, sorti en 2010.'),
  Q('film_scifi', 'Quel personnage est incarné par Keanu Reeves dans « Matrix » ?', ['Trinity', 'Néo', 'Morpheus', 'Cypher'], 2, 'Néo, « l’Élu ».'),
  Q('film_scifi', 'Dans « Retour vers le futur », quel véhicule voyage dans le temps ?', ['DeLorean', 'Batmobile', 'KITT', 'TARDIS'], 1, 'Une DeLorean modifiée par Doc Brown.'),
  Q('film_anim', 'Quel studio a créé « Toy Story » ?', ['DreamWorks', 'Pixar', 'Ghibli', 'Illumination'], 2, 'Pixar, premier long-métrage entièrement en images de synthèse (1995).'),
  Q('film_anim', 'Dans « Le Roi Lion », comment s’appelle le jeune lion héros ?', ['Simba', 'Mufasa', 'Scar', 'Timon'], 1, 'Simba, fils de Mufasa.'),
  Q('film_anim', 'Quel film d’animation met en scène la reine Elsa ?', ['Vaiana', 'Raiponce', 'La Reine des Neiges', 'Rebelle'], 3, 'Elsa et sa sœur Anna.'),
  Q('film_anim', 'Quel studio japonais a réalisé « Mon voisin Totoro » ?', ['Studio Ghibli', 'Toei', 'Madhouse', 'Pixar'], 1, 'Studio Ghibli, réalisé par Hayao Miyazaki.'),
  Q('film_action', 'Quel acteur incarne John Wick ?', ['Tom Cruise', 'Keanu Reeves', 'Jason Statham', 'Matt Damon'], 2, 'Keanu Reeves.'),
  Q('film_action', 'À quelle saga appartient l’agent 007 ?', ['Mission: Impossible', 'Jason Bourne', 'James Bond', 'Kingsman'], 3, '007 = James Bond.'),
  Q('film_action', 'Quel acteur joue Indiana Jones ?', ['Harrison Ford', 'Sean Connery', 'Mel Gibson', 'Bruce Willis'], 1, 'Harrison Ford.'),
  Q('film_action', 'Dans « Die Hard », comment s’appelle le héros ?', ['John McClane', 'John Rambo', 'John Matrix', 'John Wick'], 1, 'John McClane, joué par Bruce Willis.'),
];

console.log(`Module film + ${catRows.length} sous-thèmes + ${questions.length} questions.`);
{ const { error } = await sb.from('quete_modules').upsert([moduleRow], { onConflict: 'key' }); if (error) throw new Error('module: ' + error.message); }
{ const { error } = await sb.from('quete_categories').upsert(catRows, { onConflict: 'key' }); if (error) throw new Error('categories: ' + error.message); }
// Questions : delete (idempotence) puis insert.
{ const { error } = await sb.from('quete_questions').delete().in('subject', ['film_scifi', 'film_anim', 'film_action']); if (error) throw new Error('del questions: ' + error.message); }
{ const { error } = await sb.from('quete_questions').insert(questions); if (error) throw new Error('ins questions: ' + error.message); }
console.log('✅ Démo Film seedée.');
