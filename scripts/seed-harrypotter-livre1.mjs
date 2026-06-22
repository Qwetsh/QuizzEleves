// Thème « Harry Potter (livre) » (non scolaire) : 1 module + 1 sous-thème
// (« Livre 1 — L'école des sorciers ») + 62 questions. Les livres suivants
// seront ajoutés comme nouveaux sous-thèmes (hp_livre2, …). Idempotent.
//
//   node scripts/seed-harrypotter-livre1.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const moduleRow = { key: 'harrypotter', name: 'Harry Potter (livre)', name_en: 'Harry Potter (book)', icon: '🪄', kind: 'themed', description: 'Les romans Harry Potter, livre par livre.', color: '#5b3a8c', color_soft: '#ddd2ec', color_deep: '#2e1c4a', biome: 'Le Château de Poudlard', biome_en: 'Hogwarts Castle', enabled: true, ord: 2 };

const catRows = [
  { key: 'hp_livre1', module: 'harrypotter', name: "Livre 1 — L'école des sorciers", name_en: "Book 1 — The Philosopher's Stone", short: 'L1', icon: '🏰', color: '#6d4caf', color_soft: '#e0d6f2', color_deep: '#38245e', biome: "L'École des Sorciers", biome_en: "The School of Wizardry", role: 'subject', board: true, default_on: true, lv2_member: false, enabled: true, ord: 30 },
];

// Questions : pool='cycle4', level=null (transverse, car module 'themed').
// `correcte` est 1-indexé (a=1, b=2, c=3, d=4) ; les réponses sont mélangées
// à l'affichage par le jeu.
const Q = (q, [a, b, c, d], correcte, e) => ({ pool: 'cycle4', subject: 'hp_livre1', level: null, q, rep_a: a, rep_b: b, rep_c: c, rep_d: d, correcte, e, t: "Livre 1 — L'école des sorciers", enabled: true, ord: 0 });

const questions = [
  Q('Quel est le numéro de la maison des Dursley sur Privet Drive ?', ['2', '4', '7', '12'], 2, 'Le 4, Privet Drive.'),
  Q('Au début du livre, où Harry dort-il dans la maison des Dursley ?', ["Dans le grenier", "Dans la chambre d'amis", "Dans le placard sous l'escalier", 'Dans le garage'], 3, "Dans le placard sous l'escalier."),
  Q('Comment s’appelle le cousin de Harry, fils des Dursley ?', ['Dudley', 'Vernon', 'Piers', 'Marjorie'], 1, 'Dudley Dursley.'),
  Q('Quelle est la forme de la cicatrice de Harry sur son front ?', ['Une étoile', 'Un croissant', 'Un éclair', 'Une croix'], 3, 'Un éclair.'),
  Q('Quel métier exerce l’oncle Vernon ?', ['Banquier', 'Directeur d’une fabrique de perceuses', 'Dentiste', 'Policier'], 2, 'Il dirige la Grunnings, une fabrique de perceuses.'),
  Q('Comment les parents de Harry sont-ils morts ?', ['Dans un accident de voiture', 'Tués par Voldemort', 'De maladie', 'Noyés'], 2, 'Tués par Voldemort ; les Dursley ont menti en évoquant un accident.'),
  Q('Avant de savoir qu’il est sorcier, quel acte de magie involontaire Harry réalise-t-il lors d’une sortie au zoo ?', ['Il fait disparaître la vitre du terrarium d’un serpent', 'Il fait léviter une plume', 'Il transforme Dudley en crapaud', 'Il allume un feu'], 1, "Il fait disparaître la vitre du terrarium d'un boa."),
  Q('Quel jour Harry fête-t-il son anniversaire ?', ['31 juillet', '1er septembre', '25 décembre', '30 juin'], 1, 'Le 31 juillet.'),
  Q('Qui vient chercher Harry pour l’emmener à Poudlard ?', ['McGonagall', 'Dumbledore', 'Hagrid', 'Rogue'], 3, 'Rubeus Hagrid.'),
  Q('Quel « cadeau » Hagrid inflige-t-il à Dudley lors de cette visite ?', ['Des oreilles d’âne', 'Une queue de cochon', 'Une langue de serpent', 'Des cornes'], 2, 'Une queue de cochon.'),
  Q('Par quel lieu accède-t-on au Chemin de Traverse depuis Londres ?', ['Une cabine téléphonique', 'Le Chaudron Baveur', 'La cheminée du Ministère', 'Un portoloin'], 2, "Par l'arrière-cour du Chaudron Baveur."),
  Q('Qui gère la banque des sorciers, Gringotts ?', ['Les elfes', 'Les gobelins', 'Les sorciers', 'Les centaures'], 2, 'Les gobelins.'),
  Q('Quel est le cœur (la matière magique) de la baguette de Harry ?', ['Crin de licorne', 'Ventricule de dragon', 'Plume de phénix', 'Poil de Veracrasse'], 3, 'Une plume de phénix.'),
  Q('Pourquoi la baguette de Harry est-elle particulière, selon Ollivander ?', ['Elle est en or', 'Sa plume vient du même phénix que celle de Voldemort', 'Elle appartenait à son père', 'Elle est incassable'], 2, 'Sa plume de phénix provient du même oiseau que la baguette de Voldemort.'),
  Q('De quelle voie part le Poudlard Express ?', ['Voie 9', 'Voie 9 ¾', 'Voie 10', 'Voie 13'], 2, 'La voie 9 ¾.'),
  Q('Dans quelle gare de Londres prend-on le Poudlard Express ?', ['Victoria', 'Paddington', 'King’s Cross', 'Waterloo'], 3, 'King’s Cross.'),
  Q('Comment s’appelle le rat de Ron Weasley ?', ['Croûtard', 'Pattenrond', 'Coquecigrue', 'Miss Teigne'], 1, 'Croûtard.'),
  Q('Comment s’appelle la chouette de Harry ?', ['Errol', 'Hedwige', 'Coq', 'Nyx'], 2, 'Hedwige.'),
  Q('Quel objet magique répartit les élèves dans les maisons de Poudlard ?', ['La Coupe de Feu', 'Le Choixpeau magique', 'Le Miroir du Riséd', 'Le Vif d’or'], 2, 'Le Choixpeau magique.'),
  Q('Dans quelle maison Harry est-il finalement envoyé ?', ['Serpentard', 'Serdaigle', 'Gryffondor', 'Poufsouffle'], 3, 'Gryffondor.'),
  Q('Quelle maison le Choixpeau a-t-il d’abord envisagée pour Harry avant de le répartir ?', ['Serpentard', 'Serdaigle', 'Poufsouffle', 'Aucune'], 1, 'Le Choixpeau songe d’abord à Serpentard.'),
  Q('Quelles sont les quatre maisons de Poudlard ?', ['Gryffondor, Serpentard, Poufsouffle, Serdaigle', 'Gryffondor, Serpentard, Beauxbâtons, Durmstrang', 'Poudlard, Gringotts, Azkaban, Pré-au-Lard', 'Lion, Serpent, Aigle, Blaireau'], 1, 'Gryffondor, Serpentard, Poufsouffle et Serdaigle.'),
  Q('Qui est le directeur de Poudlard ?', ['Severus Rogue', 'Albus Dumbledore', 'Cornelius Fudge', 'Filius Flitwick'], 2, 'Albus Dumbledore.'),
  Q('Qui est la directrice de la maison Gryffondor ?', ['Pomona Chourave', 'Minerva McGonagall', 'Sibylle Trelawney', 'Madame Bibine'], 2, 'Minerva McGonagall.'),
  Q('Quelle matière enseigne le professeur Rogue ?', ['Métamorphose', 'Sortilèges', 'Potions', 'Botanique'], 3, 'Les Potions.'),
  Q('De quelle maison le professeur Rogue est-il le directeur ?', ['Gryffondor', 'Serdaigle', 'Serpentard', 'Poufsouffle'], 3, 'Serpentard.'),
  Q('Comment s’appelle le concierge de Poudlard ?', ['Argus Rusard', 'Rubeus Hagrid', 'Peeves', 'Barjow'], 1, 'Argus Rusard.'),
  Q('Comment s’appelle la chatte d’Argus Rusard, le concierge ?', ['Pattenrond', 'Miss Teigne', 'Touffu', 'Norris la noire'], 2, 'Miss Teigne.'),
  Q('Quel professeur enseigne le vol sur balai aux premières années ?', ['Madame Pomfresh', 'Madame Bibine', 'Madame Maxime', 'Madame Guipure'], 2, 'Madame Bibine.'),
  Q('Comment s’appelle le principal rival de Harry, élève à Serpentard ?', ['Drago Malefoy', 'Cédric Diggory', 'Marcus Flint', 'Blaise Zabini'], 1, 'Drago Malefoy.'),
  Q('Comment s’appellent les deux acolytes de Drago Malefoy ?', ['Fred et George', 'Crabbe et Goyle', 'Dean et Seamus', 'Pansy et Millicent'], 2, 'Crabbe et Goyle.'),
  Q('Comment s’appelle le fantôme de la maison Gryffondor ?', ['Le Baron Sanglant', 'Le Moine Gras', 'Nick Quasi-Sans-Tête', 'La Dame Grise'], 3, 'Nick Quasi-Sans-Tête.'),
  Q('Quel professeur porte en permanence un turban ?', ['Rogue', 'Quirrell', 'Flitwick', 'Binns'], 2, 'Le professeur Quirrell.'),
  Q('Quelle matière enseigne le professeur Quirrell ?', ['Sortilèges', 'Défense contre les forces du Mal', 'Potions', 'Astronomie'], 2, 'La Défense contre les forces du Mal.'),
  Q('Le soir d’Halloween, quelle créature pénètre dans le château de Poudlard ?', ['Un dragon', 'Un troll', 'Un loup-garou', 'Un Détraqueur'], 2, 'Un troll des montagnes.'),
  Q('Le soir d’Halloween, où Harry et Ron sauvent-ils Hermione du troll ?', ['Dans la Grande Salle', 'Dans les cachots', 'Dans les toilettes des filles', 'Dans la bibliothèque'], 3, 'Dans les toilettes des filles.'),
  Q('Comment s’appelle le sport pratiqué sur des balais à Poudlard ?', ['Bavboules', 'Quidditch', 'Échecs version sorcier', 'Cracra-bouse'], 2, 'Le Quidditch.'),
  Q('Quel poste Harry occupe-t-il dans l’équipe de Quidditch de Gryffondor ?', ['Gardien', 'Poursuiveur', 'Batteur', 'Attrapeur'], 4, 'Attrapeur.'),
  Q('Quelle balle l’Attrapeur doit-il capturer au Quidditch ?', ['Le Souafle', 'Le Cognard', 'Le Vif d’or', 'Le Percuteur'], 3, 'Le Vif d’or.'),
  Q('Combien de points rapporte la capture du Vif d’or ?', ['10', '50', '100', '150'], 4, '150 points.'),
  Q('Comment s’appelle le balai offert à Harry pour le Quidditch ?', ['Brossdur 7', 'Nimbus 2000', 'Éclair de feu', 'Comète 260'], 2, 'Un Nimbus 2000.'),
  Q('Qui est le capitaine de l’équipe de Quidditch de Gryffondor ?', ['Olivier Dubois', 'Fred Weasley', 'Angelina Johnson', 'Marcus Flint'], 1, 'Olivier Dubois.'),
  Q('Quel objet appartenant à Neville Harry rattrape-t-il en vol, ce qui le fait remarquer par McGonagall ?', ['Une Beuglante', 'Le Rapeltout', 'Un Gnome de jardin', 'Un Retourneur de Temps'], 2, 'Le Rapeltout.'),
  Q('Comment s’appelle le chien à trois têtes gardant un passage à Poudlard ?', ['Touffu', 'Crockdur', 'Norbert', 'Cerbère'], 1, 'Touffu.'),
  Q('Que garde Touffu, le chien à trois têtes ?', ['La porte de Gringotts', 'Une trappe menant à la pierre', 'Le bureau de Dumbledore', 'La Salle sur Demande'], 2, 'Une trappe au-dessus de la cachette de la pierre.'),
  Q('À qui appartient Touffu, le chien à trois têtes ?', ['Rogue', 'Dumbledore', 'Hagrid', 'Rusard'], 3, 'À Hagrid.'),
  Q('Quel dragon Hagrid élève-t-il en secret dans sa cabane ?', ['Norbert', 'Touffu', 'Crockdur', 'Magyar à pointes'], 1, 'Norbert, un Norvégien à crête.'),
  Q('Quel célèbre alchimiste est lié à la création de la pierre philosophale ?', ['Nicolas Flamel', 'Godric Gryffondor', 'Salazar Serpentard', 'Merlin'], 1, 'Nicolas Flamel.'),
  Q('Quel objet précieux est caché et protégé dans Poudlard tout au long du livre ?', ['La pierre philosophale', 'La coupe de Poufsouffle', 'Le diadème de Serdaigle', 'Le Sablier d’or'], 1, 'La pierre philosophale.'),
  Q('Quels sont les deux pouvoirs de la pierre philosophale ?', ['Voler et devenir invisible', 'Transformer le métal en or et produire l’élixir de longue vie', 'Lire les pensées et voyager dans le temps', 'Soigner et ressusciter'], 2, 'Transformer le métal en or et donner l’élixir de longue vie.'),
  Q('Comment s’appelle le miroir qui montre les désirs les plus profonds de celui qui s’y regarde ?', ['Le Miroir du Riséd', 'Le Miroir aux Tracas', 'Le Miroir des Ombres', 'Le Miroir de Vérité'], 1, 'Le Miroir du Riséd (« désir » écrit à l’envers).'),
  Q('Que voit Harry lorsqu’il se regarde dans le Miroir du Riséd ?', ['De l’or', 'Lui-même en capitaine de Quidditch', 'Sa famille (ses parents)', 'Voldemort'], 3, 'Ses parents et sa famille.'),
  Q('Quel cadeau de Noël anonyme (de Dumbledore) Harry reçoit-il ?', ['Un balai', 'La cape d’invisibilité', 'Un album photo', 'La carte du Maraudeur'], 2, 'La cape d’invisibilité.'),
  Q('À qui appartenait la cape d’invisibilité de Harry auparavant ?', ['À Dumbledore', 'À sa mère', 'À son père (James)', 'À Sirius'], 3, 'À son père, James Potter.'),
  Q('Dans la forêt interdite, quelle créature est retrouvée blessée et dont on boit le sang ?', ['Une licorne', 'Un centaure', 'Un Sombral', 'Un hippogriffe'], 1, 'Une licorne.'),
  Q('Qui boit le sang de licorne dans la forêt interdite pour rester en vie ?', ['Rogue', 'Quirrell', 'Voldemort', 'Un loup-garou'], 3, 'Voldemort, pour survivre.'),
  Q('Quelle créature mi-homme mi-cheval sauve Harry dans la forêt interdite ?', ['Un gobelin', 'Un centaure (Firenze)', 'Un géant', 'Un Acromentule'], 2, 'Le centaure Firenze.'),
  Q('Parmi les épreuves protégeant la pierre, quelle plante étouffe ceux qui se débattent ?', ['Le Filet du Diable', 'La Mandragore', 'Le Saule cogneur', 'Le Tentacula vénéneux'], 1, 'Le Filet du Diable.'),
  Q('Dans l’épreuve des potions de Rogue, de quelles couleurs sont les flammes qui surgissent à l’entrée de la salle ?', ['Rouges en avant, bleues en arrière', 'Noires en avant (vers la pierre), violettes en arrière (vers la sortie)', 'Vertes en avant, jaunes en arrière', 'Blanches des deux côtés'], 2, 'Flammes noires vers la pierre, violettes vers la sortie.'),
  Q('Parmi les épreuves protégeant la pierre, laquelle oppose les enfants sur un échiquier géant ?', ['Le jeu d’échecs (de McGonagall)', 'Le labyrinthe', 'L’énigme des potions', 'Les clés volantes'], 1, 'Le jeu d’échecs version sorcier de McGonagall.'),
  Q('Qui se sacrifie pendant la partie d’échecs géante pour permettre aux autres d’avancer ?', ['Harry', 'Hermione', 'Ron', 'Neville'], 3, 'Ron Weasley.'),
  Q('Qui se cache réellement derrière la tentative de vol de la pierre, et où se trouve Voldemort ?', ['Rogue, dans les cachots', 'Quirrell, à l’arrière de sa tête sous le turban', 'Malefoy, dans son dortoir', 'Rusard, dans son bureau'], 2, 'Quirrell ; Voldemort est greffé à l’arrière de sa tête, sous le turban.'),
];

console.log(`Module harrypotter + ${catRows.length} sous-thème + ${questions.length} questions.`);
{ const { error } = await sb.from('quete_modules').upsert([moduleRow], { onConflict: 'key' }); if (error) throw new Error('module: ' + error.message); }
{ const { error } = await sb.from('quete_categories').upsert(catRows, { onConflict: 'key' }); if (error) throw new Error('categories: ' + error.message); }
// Questions : delete (idempotence) puis insert.
{ const { error } = await sb.from('quete_questions').delete().eq('subject', 'hp_livre1'); if (error) throw new Error('del questions: ' + error.message); }
{ const { error } = await sb.from('quete_questions').insert(questions); if (error) throw new Error('ins questions: ' + error.message); }
console.log('✅ Harry Potter — Livre 1 seedé.');
