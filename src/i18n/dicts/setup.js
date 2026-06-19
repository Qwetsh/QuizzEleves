// Traductions de l'accueil / Setup (hors éditeurs dev). Rempli en Phase A.
// Clés namespacées `setup.*`. { fr, en }.
export default {
  // --- Setup.jsx (hero + colonne gauche/droite) ---
  'setup.appTitle': { fr: 'Quête des Matières', en: 'Subject Quest' },
  'setup.appTagline': { fr: 'Jeu de plateau pédagogique · Cycle 4', en: 'Educational board game · Cycle 4' },
  'setup.launch': { fr: '🚀 Lancer la partie', en: '🚀 Launch game' },
  'setup.resume': { fr: '▶️ Reprendre la partie', en: '▶️ Resume game' },
  'setup.classLabel': { fr: '📚 Classe / séance', en: '📚 Class / session' },
  'setup.classHint': { fr: '(optionnel — pour le suivi dans l\'analyse)', en: '(optional — for tracking in the analytics)' },
  'setup.classPlaceholder': { fr: 'ex. 6eB, Groupe 2…', en: 'e.g. 6B, Group 2…' },
  'setup.englishToggle': { fr: '🇬🇧 Questions en anglais', en: '🇬🇧 Questions in English' },
  'setup.englishToggleDesc': {
    fr: 'Énoncés, choix et explications affichés en anglais (repli français si non traduit).',
    en: 'Prompts, choices and explanations shown in English (falls back to French if untranslated).',
  },
  'setup.toolsUnlocked': { fr: 'Outils déverrouillés', en: 'Tools unlocked' },
  'setup.toolsPrompt': { fr: 'Code d\'accès aux outils d\'édition :', en: 'Access code for the editing tools:' },
  'setup.toolsBadCode': { fr: 'Code incorrect.', en: 'Wrong code.' },
  'setup.kingdomsTitle': { fr: 'Les 6 royaumes', en: 'The 6 kingdoms' },

  // --- LevelSelect.jsx ---
  'setup.levelLabel': { fr: 'Niveau', en: 'Level' },
  'setup.levelHint': { fr: '(plusieurs possibles)', en: '(several allowed)' },
  'setup.questionsCount': { fr: '{n} questions', en: '{n} questions' },
  'setup.brevetTooltip': {
    fr: 'Ajoute les questions « spécial Brevet » (DNB) au niveau choisi',
    en: 'Adds the "Brevet special" (DNB) questions to the chosen level',
  },
  'setup.brevet': { fr: 'Brevet', en: 'Brevet' },
  'setup.brevetCount': { fr: '+{n} questions DNB', en: '+{n} DNB questions' },

  // --- SubjectSelect.jsx ---
  'setup.subjectsLabel': { fr: 'Matières', en: 'Subjects' },
  'setup.subjectsHint': { fr: '(au moins une)', en: '(at least one)' },
  'setup.subjectEmpty': { fr: 'Aucune question pour ce niveau', en: 'No questions for this level' },
  'setup.subjectSoon': { fr: 'bientôt', en: 'soon' },
  'setup.lv2Title': {
    fr: 'LV2 au choix (Allemand + Espagnol fusionnés)',
    en: 'Second language of choice (German + Spanish merged)',
  },
  'setup.lv2Desc': {
    fr: 'Une seule case « LV2 » sur le plateau ; chaque équipe choisit sa langue à la création et répond dedans.',
    en: 'A single "L2" space on the board; each team picks its language when created and answers in it.',
  },

  // --- RulesConfig.jsx ---
  'setup.duelRules': { fr: '⚔️ Règles de duel', en: '⚔️ Duel rules' },
  'setup.forcedDuels': { fr: 'Duels forcés', en: 'Forced duels' },
  'setup.forcedDuelsOn': {
    fr: 'Activé : duel automatique dès qu’une équipe en rejoint une autre.',
    en: 'On: automatic duel as soon as one team lands on another.',
  },
  'setup.forcedDuelsOff': {
    fr: 'Désactivé : l’équipe qui arrive choisit de défier (et qui) ou de jouer la case.',
    en: 'Off: the arriving team chooses to challenge (and whom) or to play the space.',
  },

  // --- ConnectionMode.jsx ---
  'setup.connectionTitle': { fr: '🔗 Connexion des équipes', en: '🔗 Team connection' },
  'setup.connBoardLabel': { fr: 'Au tableau', en: 'On the board' },
  'setup.connBoardDesc': { fr: 'Tu crées les équipes ici.', en: 'You create the teams here.' },
  'setup.connPhoneLabel': { fr: 'Par téléphone', en: 'By phone' },
  'setup.connPhoneDesc': { fr: 'Les élèves créent leur équipe via QR.', en: 'Students create their team via QR code.' },

  // --- TeamCount.jsx ---
  'setup.teamsInPlay': { fr: 'Équipes — {n} en lice', en: 'Teams — {n} in play' },

  // --- TeamCustomization.jsx ---
  'setup.teamColorAria': { fr: 'Couleur de l\'équipe {name} : {color}', en: 'Team {name} colour: {color}' },
  'setup.teamAvatarAria': { fr: 'Changer l\'avatar de l\'équipe {n}', en: 'Change team {n} avatar' },
  'setup.teamNameAria': { fr: 'Nom de l\'équipe {n}', en: 'Team {n} name' },
  'setup.avatarAria': { fr: 'Avatar {emoji}', en: 'Avatar {emoji}' },
  'setup.lv2Inline': { fr: '🗣️ LV2 :', en: '🗣️ L2:' },

  // --- LobbyPanel.jsx ---
  'setup.lobbyTitle': { fr: '📱 Lobby téléphone', en: '📱 Phone lobby' },
  'setup.lobbyIntro': {
    fr: 'Ouvre un lobby : les élèves scannent le QR et créent leur équipe (nom + logo + pouvoir).',
    en: 'Open a lobby: students scan the QR code and create their team (name + logo + power).',
  },
  'setup.lobbyOpen': { fr: 'Ouvrir le lobby', en: 'Open the lobby' },
  'setup.lobbyConnFailed': { fr: 'Connexion impossible', en: 'Connection failed' },
  'setup.lobbyTitleCount': { fr: '📱 Lobby téléphone — {n} {teams}', en: '📱 Phone lobby — {n} {teams}' },
  'setup.teamCount': { fr: ['équipe', 'équipes'], en: ['team', 'teams'] },
  'setup.lobbyWaiting': { fr: 'En attente des équipes…', en: 'Waiting for teams…' },
  'setup.lobbyNoName': { fr: '(sans nom)', en: '(no name)' },
  'setup.lobbyDupName': { fr: 'Nom en double (sera suffixé au départ)', en: 'Duplicate name (will be suffixed at start)' },
  'setup.lobbyReady': { fr: '✅ prêt', en: '✅ ready' },
  'setup.lobbyInProgress': { fr: '… en cours', en: '… in progress' },
  'setup.lobbyRemoveTeam': { fr: 'Retirer cette équipe', en: 'Remove this team' },
  'setup.lobbyStart': { fr: '🚀 Démarrer la partie ({n})', en: '🚀 Start game ({n})' },
  'setup.lobbySimTitle': { fr: '🧪 Simuler des téléphones (test)', en: '🧪 Simulate phones (test)' },
  'setup.lobbySimStudent': { fr: '📱 Élève {n}', en: '📱 Student {n}' },
  'setup.lobbySimDesc': {
    fr: 'Chaque fenêtre = un élève distinct qui crée son équipe (nom, pouvoirs, LV2). Autoriser les pop-ups si bloqué.',
    en: 'Each window = a separate student creating their team (name, powers, L2). Allow pop-ups if blocked.',
  },

  // --- ExtensionsChecklist.jsx ---
  'setup.extensionsTitle': { fr: '🧩 Extensions de jeu', en: '🧩 Game extensions' },

  // --- StarterChestConfig.jsx ---
  'setup.chestCatConsumable': { fr: 'Consommables', en: 'Consumables' },
  'setup.chestCatEquipment': { fr: 'Équipements', en: 'Equipment' },
  'setup.chestCatBoth': { fr: 'Les deux', en: 'Both' },
  'setup.chestTitle': { fr: 'Coffre de départ', en: 'Starter chest' },
  'setup.chestDesc': {
    fr: 'Au 1er tour, chaque équipe ouvre un coffre (or + objets au choix).',
    en: 'On the first turn, each team opens a chest (gold + items of choice).',
  },
  'setup.chestGoldLabel': { fr: 'Or offert', en: 'Gold granted' },
  'setup.chestModeFixed': { fr: 'Fixe', en: 'Fixed' },
  'setup.chestModeRandom': { fr: 'Aléatoire', en: 'Random' },
  'setup.chestMin': { fr: 'Min', en: 'Min' },
  'setup.chestMax': { fr: 'Max', en: 'Max' },
  'setup.chestAmount': { fr: 'Montant', en: 'Amount' },
  'setup.chestSameRoll': { fr: 'Un seul tirage, le même pour toutes les équipes.', en: 'A single roll, the same for every team.' },
  'setup.chestItemsLabel': { fr: 'Objets du coffre', en: 'Chest items' },
  'setup.chestProposed': { fr: 'Proposés', en: 'Offered' },
  'setup.chestKeep': { fr: 'À garder', en: 'To keep' },
  'setup.chestGoldOnly': { fr: 'Aucun objet : le coffre ne donne que de l’or.', en: 'No items: the chest gives gold only.' },
  'setup.chestPickInfo': {
    fr: 'L\'équipe choisit {keep} objet(s) parmi {propose}.',
    en: 'The team picks {keep} item(s) out of {propose}.',
  },

  // --- BoardParams.jsx ---
  'setup.boardTitle': { fr: 'Plateau', en: 'Board' },
  'setup.boardSpacesPerLane': { fr: 'Cases par voie : ', en: 'Spaces per lane: ' },
  'setup.boardParallelLanes': { fr: 'Voies parallèles', en: 'Parallel lanes' },
  'setup.boardLanes': { fr: '{n} voies', en: '{n} lanes' },
  'setup.boardSections': { fr: 'Sections', en: 'Sections' },
  'setup.boardFinalLane': { fr: 'Voie finale', en: 'Final lane' },
  'setup.boardFinalShortLong': { fr: 'Court / Long', en: 'Short / Long' },
  'setup.boardFinalUnique': { fr: 'Unique', en: 'Single' },
  'setup.boardFinalNone': { fr: 'Aucune', en: 'None' },
  'setup.boardMixCorridors': { fr: 'Couloirs mix : ', en: 'Mixed corridors: ' },
  'setup.boardEvents': { fr: 'Événements : ', en: 'Events: ' },
  'setup.boardEventsNone': { fr: 'Aucun', en: 'None' },
  'setup.boardEventsEvery': { fr: '1 toutes les {n} cases', en: '1 every {n} spaces' },

  // --- EventsChecklist.jsx (chrome only) ---
  'setup.eventsTitle': { fr: 'Événements ({n}/{total})', en: 'Events ({n}/{total})' },
  'setup.eventsCheckAll': { fr: 'Tout cocher', en: 'Check all' },
  'setup.eventsUncheckAll': { fr: 'Tout décocher', en: 'Uncheck all' },

  // --- PowerSetup.jsx (chrome only) ---
  'setup.powerDef': { fr: '🛡 Pouvoir défensif', en: '🛡 Defensive power' },
  'setup.powerOff': { fr: '⚔️ Pouvoir offensif', en: '⚔️ Offensive power' },
  'setup.powerStep': { fr: ' · étape {n} / {total}', en: ' · step {n} / {total}' },
  'setup.powerChooseAria': { fr: 'Choisir le pouvoir {name}', en: 'Choose the {name} power' },
  'setup.powerTeamAria': { fr: 'Équipe {name}', en: 'Team {name}' },
  'setup.powerTeamAriaCurrent': { fr: 'Équipe {name} (en cours)', en: 'Team {name} (current)' },
};
