// Événements « lieu → événement » de la Terre du Milieu (carte terre_du_milieu_atlas).
// En jeu : un lieu s'illumine, le joueur choisit l'événement qui s'y est déroulé.
// Les distracteurs d'une question = les `event` des AUTRES lieux (tirés au hasard).
//
// `place`/`x`/`y` sont COPIÉS à l'identique des spots de l'univers
// 'terre_du_milieu_atlas' (labels + coordonnées normalisées cx/cy).
export const LOTR_EVENTS = [
  {
    place: 'Fondcombe (Imladris)',
    x: 0.458, y: 0.227,
    event: "Le Conseil d'Elrond décide de détruire l'Anneau Unique",
    eventEn: "The Council of Elrond decides to destroy the One Ring",
  },
  {
    place: 'Le Mont Destin (Orodruin)',
    x: 0.729, y: 0.595,
    event: "L'Anneau Unique est détruit dans les flammes",
    eventEn: "The One Ring is destroyed in the fire",
  },
  {
    place: 'Le Gouffre de Helm (Fort-le-Cor)',
    x: 0.451, y: 0.521,
    event: "La bataille du Gouffre de Helm contre les Uruk-hai",
    eventEn: "The Battle of Helm's Deep against the Uruk-hai",
  },
  {
    place: 'Isengard (Orthanc)',
    x: 0.417, y: 0.482,
    event: "Les Ents assaillent Saroumane et brisent le barrage",
    eventEn: "The Ents storm Saruman and break the dam",
  },
  {
    place: 'Minas Tirith',
    x: 0.638, y: 0.597,
    event: "La bataille des Champs du Pelennor devant la cité blanche",
    eventEn: "The Battle of the Pelennor Fields before the white city",
  },
  {
    place: 'La Moria (Khazad-dûm)',
    x: 0.440, y: 0.342,
    event: "Gandalf tombe dans l'abîme avec le Balrog",
    eventEn: "Gandalf falls into the abyss with the Balrog",
  },
  {
    place: 'La Lothlórien',
    x: 0.474, y: 0.352,
    event: "Galadriel offre ses présents à la Communauté",
    eventEn: "Galadriel gives her gifts to the Fellowship",
  },
  {
    place: 'Erebor (Mont Solitaire)',
    x: 0.629, y: 0.168,
    event: "La Bataille des Cinq Armées devant la montagne des Nains",
    eventEn: "The Battle of the Five Armies before the Dwarves' mountain",
  },
  {
    place: 'Esgaroth (Bourg-du-Lac)',
    x: 0.628, y: 0.176,
    event: "Bard l'Archer terrasse le dragon Smaug d'une flèche noire",
    eventEn: "Bard the Bowman slays the dragon Smaug with a black arrow",
  },
  {
    place: 'Barad-dûr',
    x: 0.752, y: 0.581,
    event: "L'Œil de Sauron veille au sommet de la Tour Sombre",
    eventEn: "The Eye of Sauron watches atop the Dark Tower",
  },
  {
    place: 'Minas Morgul',
    x: 0.697, y: 0.594,
    event: "L'armée du Roi-Sorcier sort en guerre de la cité maudite",
    eventEn: "The Witch-king's army marches to war from the cursed city",
  },
  {
    place: 'Osgiliath',
    x: 0.640, y: 0.598,
    event: "Faramir défend les ruines de l'ancienne capitale du Gondor",
    eventEn: "Faramir defends the ruins of Gondor's old capital",
  },
  {
    place: 'Le Mont Venteux (Amon Sûl)',
    x: 0.317, y: 0.261,
    event: "Frodon est blessé par la lame du Roi-Sorcier",
    eventEn: "Frodo is wounded by the Witch-king's blade",
  },
  {
    place: 'Bree',
    x: 0.295, y: 0.259,
    event: "Frodon rencontre Grand-Pas à l'auberge du Poney Fringant",
    eventEn: "Frodo meets Strider at the Prancing Pony inn",
  },
  {
    place: 'La Comté',
    x: 0.245, y: 0.283,
    event: "Bilbon disparaît par surprise lors de son anniversaire",
    eventEn: "Bilbo vanishes by surprise during his birthday party",
  },
  {
    place: 'Edoras',
    x: 0.514, y: 0.528,
    event: "Gandalf libère le roi Théoden de l'emprise de Saroumane",
    eventEn: "Gandalf frees King Théoden from Saruman's hold",
  },
  {
    place: 'Dunharrow (Dunhart)',
    x: 0.514, y: 0.533,
    event: "Aragorn s'engage sur le Chemin des Morts",
    eventEn: "Aragorn takes the Paths of the Dead",
  },
  {
    place: 'La Fangorn',
    x: 0.462, y: 0.372,
    event: "Merry et Pippin rencontrent l'Ent Sylvebarbe",
    eventEn: "Merry and Pippin meet the Ent Treebeard",
  },
  {
    place: 'La Forêt Noire (Mirkwood)',
    x: 0.540, y: 0.345,
    event: "Bilbon et les Nains sont piégés par les araignées géantes",
    eventEn: "Bilbo and the Dwarves are trapped by the giant spiders",
  },
  {
    place: 'Le Palais de Thranduil',
    x: 0.598, y: 0.185,
    event: "Les Nains s'évadent des cachots enfermés dans des tonneaux",
    eventEn: "The Dwarves escape the dungeons hidden inside barrels",
  },
  {
    place: 'Les Havres Gris (Mithlond)',
    x: 0.165, y: 0.276,
    event: "Frodon embarque vers les Terres Immortelles",
    eventEn: "Frodo sails away to the Undying Lands",
  },
  {
    place: 'Les Champs aux Iris (Gladden)',
    x: 0.505, y: 0.298,
    event: "Isildur est tué et l'Anneau se perd dans le fleuve",
    eventEn: "Isildur is slain and the Ring is lost in the river",
  },
  {
    place: 'Dol Amroth',
    x: 0.473, y: 0.664,
    event: "Le prince Imrahil mène ses chevaliers au secours du Gondor",
    eventEn: "Prince Imrahil leads his knights to Gondor's aid",
  },
  {
    place: 'Pelargir',
    x: 0.638, y: 0.655,
    event: "Aragorn s'empare de la flotte des corsaires d'Umbar",
    eventEn: "Aragorn seizes the corsair fleet of Umbar",
  },
];
