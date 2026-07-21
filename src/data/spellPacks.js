// Packs de contenu du mini-jeu « Duel de sorts » (moteur spellHero, rythme façon
// Guitar Hero). Un pack = une liste de SORTS ; chaque sort porte une catégorie
// (mains de 4 sorts CONFONDABLES par vague) et des ÉVÉNEMENTS du lore (les notes
// qui tombent). Le joueur tape le bon sort quand l'événement franchit la ligne.
//
// Généré par workflow multi-agents (rédaction par catégorie → vérification canon
// adverse livre/film → synthèse), 2026-07-21. Fichier d'abord (comme fightPacks),
// migrera en DB + éditeur plus tard. DB = future source de vérité.
//
// Forme : { incantation, nomFr, cat, effet, events:[{ label, force }] }
//   - cat ∈ offensif | defensif | malefice | utilitaire | mental | metamorphose ;
//   - force ∈ iconique | clair | faible (tri décroissant ; sert à pondérer/filtrer
//     les événements par difficulté de vague plus tard).
// Décompte : offensif 12, defensif 8, malefice 5, utilitaire 11, mental 8,
// metamorphose 8 — toutes catégories ≥ 4 (mains de 4 composables partout).

export const HP_SPELLS = [
  // ── Sortilèges offensifs / de combat ──────────────────────────────────────
  { incantation: 'Expelliarmus', nomFr: 'Expelliarmus', cat: 'offensif',
    effet: "Désarme l'adversaire en projetant sa baguette au loin.", events: [
    { label: 'Club de duel avec Rogue', force: 'iconique' },
    { label: 'Sort de prédilection de Harry', force: 'iconique' },
    { label: 'Duel final contre Voldemort', force: 'iconique' },
    { label: 'Sortilège dans le cimetière', force: 'clair' }] },
  { incantation: 'Stupefy', nomFr: 'Stupéfix', cat: 'offensif',
    effet: "Assomme et neutralise la cible d'un jet de lumière rouge.", events: [
    { label: 'Bataille du Département des mystères', force: 'iconique' },
    { label: 'Bataille de Poudlard', force: 'iconique' },
    { label: 'Duel contre les Mangemorts', force: 'clair' }] },
  { incantation: 'Petrificus Totalus', nomFr: 'Petrificus Totalus', cat: 'offensif',
    effet: 'Paralyse totalement le corps de la cible, membres bloqués.', events: [
    { label: 'Hermione pétrifie Neville', force: 'iconique' }] },
  { incantation: 'Rictusempra', nomFr: 'Rictusempra', cat: 'offensif',
    effet: "Sort de chatouillis qui plie la cible de rire et l'affaiblit.", events: [
    { label: 'Club de duel : Harry contre Malefoy', force: 'iconique' }] },
  { incantation: 'Levicorpus', nomFr: 'Levicorpus', cat: 'offensif',
    effet: "Suspend la cible en l'air par la cheville, tête en bas.", events: [
    { label: 'Souvenir : Rogue humilié par James', force: 'iconique' },
    { label: 'Harry le teste sur Ron', force: 'clair' }] },
  { incantation: 'Serpensortia', nomFr: 'Serpensortia', cat: 'offensif',
    effet: 'Fait jaillir un serpent de la baguette pour attaquer.', events: [
    { label: 'Club de duel : Malefoy invoque un serpent', force: 'iconique' }] },
  { incantation: 'Reducto', nomFr: 'Reducto', cat: 'offensif',
    effet: 'Réduit en morceaux ou fait exploser un objet solide.', events: [
    { label: 'Bataille du Département des mystères', force: 'clair' },
    { label: 'Troisième tâche du labyrinthe', force: 'clair' }] },
  { incantation: 'Confringo', nomFr: 'Confringo', cat: 'offensif',
    effet: 'Provoque une explosion enflammée à l\'impact.', events: [
    { label: 'Fuite de chez les Lovegood', force: 'clair' }] },
  { incantation: 'Bombarda', nomFr: 'Bombarda', cat: 'offensif',
    effet: 'Fait exploser une cible ou une surface (version Maxima amplifiée).', events: [
    { label: 'Ombrage détruit une porte', force: 'clair' }] },
  { incantation: 'Everte Statum', nomFr: 'Everte Statum', cat: 'offensif',
    effet: "Repousse violemment l'adversaire en arrière.", events: [
    { label: 'Club de duel : Malefoy contre Harry', force: 'clair' }] },
  { incantation: 'Tarantallegra', nomFr: 'Tarantallegra', cat: 'offensif',
    effet: 'Force les jambes de la cible à danser de manière incontrôlable.', events: [
    { label: 'Club de duel : Malefoy contre Harry', force: 'clair' }] },
  { incantation: 'Furunculus', nomFr: 'Furunculus', cat: 'offensif',
    effet: 'Couvre la cible de furoncles.', events: [
    { label: 'Bagarre dans le Poudlard Express', force: 'clair' }] },

  // ── Sortilèges défensifs & protecteurs ────────────────────────────────────
  { incantation: 'Protego', nomFr: 'Sortilège du Bouclier', cat: 'defensif',
    effet: 'Dresse un bouclier magique qui dévie les sortilèges.', events: [
    { label: "Harry enseigne le Bouclier à l'AD", force: 'clair' },
    { label: 'Combat final contre Voldemort', force: 'clair' }] },
  { incantation: 'Expecto Patronum', nomFr: 'Sortilège du Patronus', cat: 'defensif',
    effet: 'Invoque un Patronus argenté qui repousse les Détraqueurs.', events: [
    { label: 'Le cerf au bord du lac', force: 'iconique' },
    { label: 'La biche argentée dans la forêt', force: 'iconique' },
    { label: "Cours de Lupin avec l'épouvantard", force: 'clair' },
    { label: 'Détraqueurs à Little Whinging', force: 'clair' },
    { label: "Patronus de l'AD (Cho, Hermione)", force: 'faible' },
    { label: 'Le lynx de Kingsley au mariage', force: 'faible' }] },
  { incantation: 'Riddikulus', nomFr: 'Riddikulus', cat: 'defensif',
    effet: 'Rend un épouvantard ridicule pour le vaincre par le rire.', events: [
    { label: "Cours de Lupin, l'épouvantard-Rogue en robe", force: 'iconique' }] },
  { incantation: 'Protego Maxima', nomFr: 'Protego Maxima', cat: 'defensif',
    effet: 'Érige un puissant bouclier protecteur à grande échelle.', events: [
    { label: 'Bouclier autour de Poudlard', force: 'iconique' }] },
  { incantation: 'Finite Incantatem', nomFr: 'Finite Incantatem', cat: 'defensif',
    effet: "Met fin aux effets d'un sortilège en cours.", events: [
    { label: 'Club de duel (tome 2)', force: 'clair' }] },
  { incantation: 'Impedimenta', nomFr: "Sortilège d'Entrave", cat: 'defensif',
    effet: 'Ralentit ou stoppe net un assaillant qui approche.', events: [
    { label: 'Épreuve du labyrinthe (Tournoi)', force: 'clair' },
    { label: 'Combat au Département des mystères', force: 'clair' }] },
  { incantation: 'Protego Totalum', nomFr: 'Protego Totalum', cat: 'defensif',
    effet: 'Protège une zone entière contre les intrusions.', events: [
    { label: 'Protection du campement en fuite', force: 'clair' }] },
  { incantation: 'Protego Horribilis', nomFr: 'Protego Horribilis', cat: 'defensif',
    effet: 'Protège contre la magie noire lors de la défense de Poudlard.', events: [
    { label: 'Défense de Poudlard (McGonagall)', force: 'clair' }] },

  // ── Maléfices noirs & Sortilèges Impardonnables ───────────────────────────
  { incantation: 'Avada Kedavra', nomFr: 'Sortilège de la Mort', cat: 'malefice',
    effet: "Tue instantanément la victime dans un éclair de lumière verte.", events: [
    { label: 'Mort des parents de Harry', force: 'iconique' },
    { label: 'Mort de Cedric Diggory', force: 'iconique' },
    { label: 'Meurtre de Dumbledore par Rogue', force: 'iconique' },
    { label: 'Voldemort tue Harry (Forêt)', force: 'iconique' },
    { label: 'Sortilège retourné sur Voldemort', force: 'iconique' },
    { label: 'Duel final Harry contre Voldemort', force: 'iconique' },
    { label: 'Mort de Charity Burbage', force: 'clair' },
    { label: "Fol-Œil tue l'araignée (classe)", force: 'clair' }] },
  { incantation: 'Crucio', nomFr: 'Endoloris', cat: 'malefice',
    effet: 'Sortilège impardonnable infligeant une douleur atroce et insoutenable.', events: [
    { label: 'Torture des Londubat par Bellatrix', force: 'iconique' },
    { label: 'Bellatrix torture Hermione', force: 'iconique' },
    { label: 'Maugrey le démontre en classe', force: 'iconique' },
    { label: 'Harry torture Amycus Carrow', force: 'clair' },
    { label: 'Voldemort torture Harry (cimetière)', force: 'clair' },
    { label: "Fol-Œil torture l'araignée (classe)", force: 'clair' },
    { label: 'Voldemort punit ses Mangemorts', force: 'faible' }] },
  { incantation: 'Morsmordre', nomFr: 'Marque des Ténèbres', cat: 'malefice',
    effet: 'Projette la Marque des Ténèbres (crâne et serpent) dans le ciel.', events: [
    { label: 'Marque à la Coupe du Monde', force: 'iconique' },
    { label: "Marque sur la tour d'astronomie", force: 'clair' },
    { label: 'Marque sur la maison Lovegood', force: 'faible' }] },
  { incantation: 'Feudeymon', nomFr: 'Feudeymon', cat: 'malefice',
    effet: 'Déchaîne un feu maudit incontrôlable formant des bêtes dévorantes.', events: [
    { label: 'Incendie de la Salle sur Demande', force: 'iconique' },
    { label: 'Mort de Vincent Crabbe', force: 'clair' },
    { label: 'Destruction du diadème (Horcruxe)', force: 'clair' }] },
  { incantation: 'Sectumsempra', nomFr: 'Sectumsempra', cat: 'malefice',
    effet: 'Lacère la victime de profondes entailles sanglantes, comme une lame invisible.', events: [
    { label: 'Harry blesse Malefoy (toilettes)', force: 'iconique' },
    { label: "Rogue tranche l'oreille de George", force: 'clair' },
    { label: 'Rogue invente le sort (manuel)', force: 'clair' }] },

  // ── Charmes & sortilèges utilitaires ──────────────────────────────────────
  { incantation: 'Wingardium Leviosa', nomFr: 'Wingardium Leviosa', cat: 'utilitaire',
    effet: 'Fait léviter et flotter un objet dans les airs.', events: [
    { label: 'Le troll des toilettes', force: 'iconique' },
    { label: "Cours de Flitwick, 'LeviO-sa'", force: 'iconique' }] },
  { incantation: 'Lumos', nomFr: 'Lumos', cat: 'utilitaire',
    effet: 'Allume une lumière au bout de la baguette.', events: [
    { label: 'Grotte des Inferi', force: 'iconique' },
    { label: 'Forêt interdite', force: 'clair' },
    { label: 'Chambre des Secrets, tuyauterie', force: 'clair' }] },
  { incantation: 'Alohomora', nomFr: 'Alohomora', cat: 'utilitaire',
    effet: 'Déverrouille portes et serrures.', events: [
    { label: 'Porte du corridor interdit, chien à trois têtes', force: 'iconique' }] },
  { incantation: 'Accio', nomFr: "Sortilège d'Attraction", cat: 'utilitaire',
    effet: 'Attire un objet à distance vers le lanceur.', events: [
    { label: 'Accio Éclair de feu, première tâche', force: 'iconique' },
    { label: 'Fred et George convoquent les bonbons', force: 'clair' },
    { label: 'Fuite des sept Potter', force: 'faible' }] },
  { incantation: 'Nox', nomFr: 'Nox', cat: 'utilitaire',
    effet: 'Éteint la lumière produite par Lumos.', events: [
    { label: 'Forêt interdite, se cacher', force: 'clair' }] },
  { incantation: 'Incendio', nomFr: 'Incendio', cat: 'utilitaire',
    effet: 'Projette une flamme pour embraser une cible ou allumer un feu.', events: [
    { label: 'Cheminée du Terrier', force: 'clair' }] },
  { incantation: 'Aguamenti', nomFr: 'Aguamenti', cat: 'utilitaire',
    effet: 'Fait jaillir un jet d\'eau de la baguette.', events: [
    { label: 'Grotte des Inferi', force: 'clair' }] },
  { incantation: 'Episkey', nomFr: 'Episkey', cat: 'utilitaire',
    effet: 'Soigne des blessures mineures.', events: [
    { label: "Tonks répare le nez d'Harry", force: 'clair' }] },
  { incantation: 'Reparo', nomFr: 'Reparo', cat: 'utilitaire',
    effet: 'Répare un objet cassé.', events: [
    { label: "Hermione répare les lunettes d'Harry", force: 'clair' }] },
  { incantation: 'Sonorus', nomFr: 'Sonorus', cat: 'utilitaire',
    effet: 'Amplifie la voix du lanceur.', events: [
    { label: 'Verpey commente la Coupe du Monde', force: 'clair' }] },
  { incantation: 'Ferula', nomFr: 'Ferula', cat: 'utilitaire',
    effet: 'Crée bandages et attelle pour immobiliser un membre.', events: [
    { label: 'Lupin bande la jambe de Ron', force: 'clair' }] },
  { incantation: 'Colloportus', nomFr: 'Colloportus', cat: 'utilitaire',
    effet: 'Verrouille magiquement une porte.', events: [
    { label: 'Département des mystères, Hermione scelle', force: 'clair' }] },

  // ── Sortilèges mentaux, mémoire & révélation ──────────────────────────────
  { incantation: 'Obliviate', nomFr: 'Oubliettes', cat: 'mental',
    effet: 'Efface ou modifie les souvenirs de la cible.', events: [
    { label: 'Lockhart perd la mémoire', force: 'iconique' },
    { label: 'Hermione efface ses parents', force: 'iconique' },
    { label: 'Bertha Jorkins mutilée mentalement', force: 'clair' },
    { label: 'Hermione efface un serveur de café', force: 'clair' },
    { label: 'Effacer le Moldu Roberts', force: 'faible' }] },
  { incantation: 'Legilimens', nomFr: 'Legilimens', cat: 'mental',
    effet: 'Pénètre l\'esprit de la cible pour y lire pensées et souvenirs.', events: [
    { label: "Rogue sonde Harry (Occlumancie)", force: 'iconique' },
    { label: 'Rogue sonde Harry en cours', force: 'clair' },
    { label: "Voldemort envahit l'esprit de Harry", force: 'faible' }] },
  { incantation: 'Confundo', nomFr: 'Sortilège de Confusion', cat: 'mental',
    effet: "Sème la confusion dans l'esprit de la cible.", events: [
    { label: 'Hermione confond McLaggen aux sélections', force: 'iconique' },
    { label: 'Croupton Jr ensorcelle la Coupe de Feu', force: 'clair' }] },
  { incantation: 'Imperio', nomFr: 'Impérium', cat: 'mental',
    effet: 'Sortilège impardonnable qui soumet totalement la volonté de la cible.', events: [
    { label: 'Maugrey le démontre en classe', force: 'iconique' },
    { label: "Harry résiste à l'Impérium", force: 'iconique' },
    { label: 'Harry contrôle un gobelin à Gringotts', force: 'clair' },
    { label: 'Voldemort contrôle Pius Thicknesse', force: 'faible' }] },
  { incantation: 'Priori Incantatem', nomFr: 'Priori Incantatem', cat: 'mental',
    effet: "Fait rejaillir les derniers sorts lancés par une baguette (écho des baguettes jumelles).", events: [
    { label: 'Duel Harry-Voldemort au cimetière', force: 'iconique' }] },
  { incantation: 'Silencio', nomFr: 'Sortilège de Mutisme', cat: 'mental',
    effet: 'Rend la cible totalement muette.', events: [
    { label: 'Hermione fait taire un Mangemort', force: 'clair' },
    { label: 'Cours de sortilèges informulés', force: 'faible' }] },
  { incantation: 'Muffliato', nomFr: 'Muffliato', cat: 'mental',
    effet: "Emplit les oreilles alentour d'un bourdonnement pour masquer une conversation.", events: [
    { label: 'Sort du Prince de Sang-Mêlé', force: 'clair' },
    { label: "Hermione l'utilise pendant la cavale", force: 'clair' }] },
  { incantation: 'Homenum Revelio', nomFr: 'Homenum Revelio', cat: 'mental',
    effet: 'Révèle la présence humaine cachée dans les environs.', events: [
    { label: 'Lupin au 12 Square Grimmaurd', force: 'clair' },
    { label: 'Hermione fouille la maison des Black', force: 'faible' }] },

  // ── Métamorphose & altération de la matière ───────────────────────────────
  { incantation: 'Piertotum Locomotor', nomFr: 'Piertotum Locomotor', cat: 'metamorphose',
    effet: 'Anime les statues et armures du château pour les faire combattre.', events: [
    { label: 'McGonagall anime les statues de Poudlard', force: 'iconique' }] },
  { incantation: 'Avis', nomFr: 'Avis', cat: 'metamorphose',
    effet: 'Fait jaillir une nuée d\'oiseaux de la baguette.', events: [
    { label: 'Hermione conjure des oiseaux contre Ron', force: 'iconique' },
    { label: 'Ollivander teste la baguette de Krum', force: 'clair' }] },
  { incantation: 'Oppugno', nomFr: 'Oppugno', cat: 'metamorphose',
    effet: 'Lance des créatures conjurées à l\'attaque d\'une cible.', events: [
    { label: 'Hermione dirige les oiseaux sur Ron', force: 'iconique' }] },
  { incantation: 'Geminio', nomFr: 'Geminio', cat: 'metamorphose',
    effet: 'Duplique un objet en une copie sans valeur.', events: [
    { label: 'Trésor multiplié dans le coffre des Lestrange', force: 'iconique' }] },
  { incantation: 'Densaugeo', nomFr: 'Densaugeo', cat: 'metamorphose',
    effet: 'Fait pousser démesurément les dents de la cible.', events: [
    { label: "Sort dévié frappe les dents d'Hermione", force: 'iconique' }] },
  { incantation: 'Engorgio', nomFr: 'Engorgio', cat: 'metamorphose',
    effet: 'Fait grossir un objet ou une créature.', events: [
    { label: 'Maugrey agrandit l\'araignée en cours', force: 'clair' }] },
  { incantation: 'Reducio', nomFr: 'Reducio', cat: 'metamorphose',
    effet: 'Rétrécit un objet grossi à sa taille normale.', events: [
    { label: "Contre-sort d'Engorgio", force: 'clair' }] },
  { incantation: 'Vera Verto', nomFr: 'Vera Verto', cat: 'metamorphose',
    effet: 'Transforme un animal en gobelet ou objet.', events: [
    { label: 'McGonagall change un oiseau en verre', force: 'clair' }] },
];

// Packs par thème (clé = subject). Étendable (autres univers de sorts plus tard).
export const SPELL_PACKS = {
  harrypotter: HP_SPELLS,
};

/** Pool de sorts d'un thème (ou null si aucun pack — l'appelant se rabat). */
export function getSpellPack(key) {
  return (key && SPELL_PACKS[key]) || null;
}
