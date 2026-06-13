// Questions « spécial Brevet » (DNB 3e) — converties depuis quiz_brevet_complet.json
// par scripts/convert-brevet.mjs. NE PAS éditer à la main : relancer le script.
//
// Pool ADDITIF : activé via le toggle « + Brevet » du Setup, fusionné aux
// questions du niveau choisi (cf. getQuestions dans index.js). Même structure
// { q, a, c, e, t } que _cycle4.js. Les choix ont été mélangés (seed par id)
// pour neutraliser le biais de position de la source.
//
// Total : 438 questions — doc exclus : 14
export const BREVET_QUESTIONS = {
 "francais": [
  {
   "q": "Dans « le chat noir », quelle est la classe grammaticale (nature) du mot « noir » ?",
   "a": [
    "Un verbe",
    "Un adverbe",
    "Un nom",
    "Un adjectif qualificatif"
   ],
   "c": 3,
   "e": "« Noir » qualifie le nom « chat » : c'est un adjectif qualificatif.",
   "t": "Brevet · Classes grammaticales"
  },
  {
   "q": "Quelle est la nature du mot « rapidement » ?",
   "a": [
    "Un verbe",
    "Un adjectif",
    "Un nom",
    "Un adverbe"
   ],
   "c": 3,
   "e": "« Rapidement » modifie un verbe et est invariable : c'est un adverbe (souvent en -ment).",
   "t": "Brevet · Classes grammaticales"
  },
  {
   "q": "« le », « la », « un », « des » sont des :",
   "a": [
    "Pronoms",
    "Conjonctions",
    "Adjectifs",
    "Déterminants (articles)"
   ],
   "c": 3,
   "e": "Ces mots accompagnent le nom : ce sont des déterminants (ici des articles).",
   "t": "Brevet · Classes grammaticales"
  },
  {
   "q": "Dans « Il mange une pomme », quelle est la nature de « il » ?",
   "a": [
    "Un nom",
    "Un pronom personnel",
    "Un adverbe",
    "Un déterminant"
   ],
   "c": 1,
   "e": "« Il » remplace un nom et occupe la fonction sujet : c'est un pronom personnel.",
   "t": "Brevet · Classes grammaticales"
  },
  {
   "q": "« sous », « dans », « avec », « pour » sont des :",
   "a": [
    "Prépositions",
    "Adverbes",
    "Conjonctions de coordination",
    "Pronoms"
   ],
   "c": 0,
   "e": "Ces mots invariables introduisent un complément : ce sont des prépositions.",
   "t": "Brevet · Classes grammaticales"
  },
  {
   "q": "« mais », « ou », « et », « donc », « or », « ni », « car » sont des :",
   "a": [
    "Adverbes",
    "Prépositions",
    "Conjonctions de coordination",
    "Déterminants"
   ],
   "c": 2,
   "e": "Ces mots relient deux éléments de même nature : ce sont les conjonctions de coordination (mais/ou/et/donc/or/ni/car).",
   "t": "Brevet · Classes grammaticales"
  },
  {
   "q": "Dans « un très beau jardin », quelle est la nature de « très » ?",
   "a": [
    "Un déterminant",
    "Un adverbe",
    "Un adjectif",
    "Un nom"
   ],
   "c": 1,
   "e": "« Très » modifie l'adjectif « beau » : c'est un adverbe (d'intensité).",
   "t": "Brevet · Classes grammaticales"
  },
  {
   "q": "Dans « ce livre est intéressant », quelle est la nature de « ce » ?",
   "a": [
    "Un adjectif",
    "Un déterminant démonstratif",
    "Un adverbe",
    "Un pronom"
   ],
   "c": 1,
   "e": "« Ce » accompagne et désigne le nom « livre » : c'est un déterminant démonstratif.",
   "t": "Brevet · Classes grammaticales"
  },
  {
   "q": "Dans « Le chien mange un os », quelle est la fonction de « le chien » ?",
   "a": [
    "COD",
    "Sujet",
    "Attribut",
    "COI"
   ],
   "c": 1,
   "e": "« Le chien » fait l'action (qui mange ?) : c'est le sujet du verbe.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "Dans « Le chien mange un os », quelle est la fonction de « un os » ?",
   "a": [
    "CC de lieu",
    "COI",
    "COD (complément d'objet direct)",
    "Sujet"
   ],
   "c": 2,
   "e": "« Un os » complète directement le verbe (mange quoi ?) sans préposition : c'est le COD.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "Dans « Il parle à son frère », quelle est la fonction de « à son frère » ?",
   "a": [
    "Attribut",
    "COI (complément d'objet indirect)",
    "Sujet",
    "COD"
   ],
   "c": 1,
   "e": "Le complément est introduit par la préposition « à » (parle à qui ?) : c'est un COI.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "Dans « Cette élève est studieuse », quelle est la fonction de « studieuse » ?",
   "a": [
    "COD",
    "Épithète",
    "CC de manière",
    "Attribut du sujet"
   ],
   "c": 3,
   "e": "« Studieuse » est relié au sujet par le verbe d'état « est » : c'est un attribut du sujet.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "Dans « la voiture rouge », quelle est la fonction de « rouge » ?",
   "a": [
    "Attribut",
    "Épithète",
    "Sujet",
    "COD"
   ],
   "c": 1,
   "e": "« Rouge » qualifie directement le nom « voiture » (sans verbe d'état) : c'est une épithète.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "Dans « Demain, nous partirons en voyage », quelle est la fonction de « demain » ?",
   "a": [
    "Sujet",
    "CC de temps",
    "COD",
    "CC de lieu"
   ],
   "c": 1,
   "e": "« Demain » indique quand se passe l'action : c'est un complément circonstanciel de temps.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "Dans « Ils habitent à Paris », quelle est la fonction de « à Paris » ?",
   "a": [
    "COD",
    "CC de lieu",
    "Attribut",
    "CC de temps"
   ],
   "c": 1,
   "e": "« À Paris » indique où se déroule l'action : c'est un complément circonstanciel de lieu.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "À quel temps est conjugué le verbe dans « je mangeais » ?",
   "a": [
    "Imparfait",
    "Présent",
    "Passé simple",
    "Futur"
   ],
   "c": 0,
   "e": "La terminaison -ais (je mangeais) est caractéristique de l'imparfait de l'indicatif.",
   "t": "Brevet · Identifier les temps"
  },
  {
   "q": "À quel temps est « nous avons mangé » ?",
   "a": [
    "Futur",
    "Imparfait",
    "Plus-que-parfait",
    "Passé composé"
   ],
   "c": 3,
   "e": "Auxiliaire « avoir » au présent + participe passé = passé composé.",
   "t": "Brevet · Identifier les temps"
  },
  {
   "q": "À quel temps est « il chantera » ?",
   "a": [
    "Futur simple",
    "Conditionnel",
    "Présent",
    "Imparfait"
   ],
   "c": 0,
   "e": "La terminaison -era (il chantera) marque le futur simple.",
   "t": "Brevet · Identifier les temps"
  },
  {
   "q": "À quel mode et temps est « que je sois » ?",
   "a": [
    "Conditionnel présent",
    "Subjonctif présent",
    "Impératif",
    "Indicatif présent"
   ],
   "c": 1,
   "e": "Introduit par « que » et exprimant le souhait/l'éventualité, « que je sois » est au subjonctif présent.",
   "t": "Brevet · Identifier les temps"
  },
  {
   "q": "À quel temps est « je mangerais » (avec un -s) ?",
   "a": [
    "Subjonctif",
    "Imparfait",
    "Futur simple",
    "Conditionnel présent"
   ],
   "c": 3,
   "e": "Radical du futur + terminaisons de l'imparfait (-ais) = conditionnel présent (je mangerais).",
   "t": "Brevet · Identifier les temps"
  },
  {
   "q": "Les verbes du 1er groupe ont leur infinitif en :",
   "a": [
    "-oir",
    "-er",
    "-ir",
    "-re"
   ],
   "c": 1,
   "e": "Les verbes du 1er groupe se terminent en -er (sauf « aller »).",
   "t": "Brevet · Groupes verbaux"
  },
  {
   "q": "À quel groupe appartient le verbe « finir » ?",
   "a": [
    "Aucun",
    "2e groupe",
    "1er groupe",
    "3e groupe"
   ],
   "c": 1,
   "e": "« Finir » est un verbe du 2e groupe (infinitif en -ir, nous finissons).",
   "t": "Brevet · Groupes verbaux"
  },
  {
   "q": "Conjugue correctement : « Tu (manger) une pomme. »",
   "a": [
    "Tu manger",
    "Tu mangent",
    "Tu mange",
    "Tu manges"
   ],
   "c": 3,
   "e": "Au présent, à la 2e personne du singulier, les verbes du 1er groupe prennent -es : tu manges.",
   "t": "Brevet · Conjuguer au présent"
  },
  {
   "q": "Conjugue : « Ils (faire) leurs devoirs. »",
   "a": [
    "Ils faient",
    "Ils fond",
    "Ils font",
    "Ils faisent"
   ],
   "c": 2,
   "e": "Le verbe « faire » au présent à la 3e personne du pluriel donne : ils font.",
   "t": "Brevet · Conjuguer au présent"
  },
  {
   "q": "Dans un récit au passé, l'imparfait sert surtout à :",
   "a": [
    "Décrire et exprimer des actions longues ou habituelles",
    "Donner un ordre",
    "Situer une action dans le futur",
    "Exprimer des actions soudaines et brèves"
   ],
   "c": 0,
   "e": "L'imparfait sert à décrire le décor, exprimer la durée, la répétition ou l'habitude dans le passé.",
   "t": "Brevet · Valeurs des temps"
  },
  {
   "q": "Dans un récit, le passé simple exprime généralement :",
   "a": [
    "Une action brève et de premier plan",
    "Un ordre",
    "Une description de fond",
    "Une habitude"
   ],
   "c": 0,
   "e": "Le passé simple exprime les actions de premier plan, brèves et successives, qui font avancer le récit.",
   "t": "Brevet · Valeurs des temps"
  },
  {
   "q": "Quelle phrase est à l'impératif ?",
   "a": [
    "Ranger sa chambre est utile.",
    "Il range sa chambre.",
    "Tu ranges ta chambre.",
    "Range ta chambre."
   ],
   "c": 3,
   "e": "« Range ta chambre » est un ordre, sans sujet exprimé : c'est l'impératif présent.",
   "t": "Brevet · Impératif"
  },
  {
   "q": "Complète : « Il ___ mangé toute la tarte. »",
   "a": [
    "à",
    "a",
    "as",
    "ah"
   ],
   "c": 1,
   "e": "Ici « a » est le verbe avoir (on peut dire « il avait mangé ») : pas d'accent.",
   "t": "Brevet · Homophones a / à"
  },
  {
   "q": "Complète : « Je vais ___ Paris demain. »",
   "a": [
    "as",
    "a",
    "ha",
    "à"
   ],
   "c": 3,
   "e": "« À » est ici une préposition (de lieu) : elle prend un accent grave.",
   "t": "Brevet · Homophones a / à"
  },
  {
   "q": "Complète : « Mon frère ___ très grand. »",
   "a": [
    "et",
    "ai",
    "ès",
    "est"
   ],
   "c": 3,
   "e": "« Est » est le verbe être (« était »). « Et » servirait à relier deux éléments.",
   "t": "Brevet · Homophones et / est"
  },
  {
   "q": "Complète : « Il a oublié ___ affaires de sport (les siennes). »",
   "a": [
    "ses",
    "ces",
    "sais",
    "c'est"
   ],
   "c": 0,
   "e": "« Ses » est le déterminant possessif (les siennes). « Ces » serait démonstratif (celles-là).",
   "t": "Brevet · Homophones ses / ces"
  },
  {
   "q": "Complète : « Les élèves ___ terminé l'exercice. »",
   "a": [
    "sont",
    "ont",
    "vont",
    "on"
   ],
   "c": 1,
   "e": "« Ont » est le verbe avoir au pluriel (« avaient terminé »). « On » est un pronom ; « vont »/« sont » ne conviennent pas avec « terminé ».",
   "t": "Brevet · Homophones on / ont"
  },
  {
   "q": "Complète : « ___ vas-tu cet été ? »",
   "a": [
    "Ou",
    "Houx",
    "Où",
    "Oû"
   ],
   "c": 2,
   "e": "« Où » exprime le lieu : il prend un accent. « Ou » signifie « ou bien ».",
   "t": "Brevet · Homophones ou / où"
  },
  {
   "q": "Complète : « Ils ___ partis en vacances. »",
   "a": [
    "sont",
    "sons",
    "s'ont",
    "son"
   ],
   "c": 0,
   "e": "« Sont » est le verbe être au pluriel (« étaient partis »). « Son » est un possessif.",
   "t": "Brevet · Homophones son / sont"
  },
  {
   "q": "Complète : « ___ une très bonne idée. »",
   "a": [
    "C'est",
    "Ces",
    "S'est",
    "Ses"
   ],
   "c": 0,
   "e": "« C'est » = cela est. « S'est » accompagne un verbe pronominal (il s'est lavé).",
   "t": "Brevet · Homophones c'est / s'est"
  },
  {
   "q": "Complète : « Ce film, il ___ déjà vu. »",
   "a": [
    "là",
    "l'a",
    "la",
    "l'as"
   ],
   "c": 1,
   "e": "« L'a » = le (pronom) + a (verbe avoir) : « il l'a vu ».",
   "t": "Brevet · Homophones la / là / l'a"
  },
  {
   "q": "Complète : « Elle ___ venir avec nous. »",
   "a": [
    "peut",
    "peux",
    "peu",
    "peus"
   ],
   "c": 0,
   "e": "« Peut » est le verbe pouvoir à la 3e personne (elle peut). « Peu » est un adverbe de quantité.",
   "t": "Brevet · Homophones peu / peut / peux"
  },
  {
   "q": "Complète : « Je ___ ai donné un cadeau. »",
   "a": [
    "leure",
    "leur",
    "l'heure",
    "leurs"
   ],
   "c": 1,
   "e": "Devant un verbe, « leur » est un pronom personnel invariable (= à eux) : il ne prend jamais de -s.",
   "t": "Brevet · Homophones leur / leurs"
  },
  {
   "q": "Complète : « Les enfants ___ dans le jardin. » (jouer, présent)",
   "a": [
    "jouer",
    "joue",
    "jouent",
    "joues"
   ],
   "c": 2,
   "e": "Le sujet « les enfants » est au pluriel : le verbe prend -ent (ils jouent).",
   "t": "Brevet · Accord sujet-verbe"
  },
  {
   "q": "Complète : « des fleurs ___ » (blanc)",
   "a": [
    "blanches",
    "blanc",
    "blanche",
    "blancs"
   ],
   "c": 0,
   "e": "L'adjectif s'accorde avec « fleurs » (féminin pluriel) : blanches.",
   "t": "Brevet · Accord de l'adjectif"
  },
  {
   "q": "Complète : « Elle est ___ tôt ce matin. » (partir)",
   "a": [
    "partis",
    "partie",
    "parties",
    "parti"
   ],
   "c": 1,
   "e": "Avec l'auxiliaire « être », le participe passé s'accorde avec le sujet « elle » : partie.",
   "t": "Brevet · Accord du participe passé"
  },
  {
   "q": "Complète : « Les pommes que j'ai ___ étaient bonnes. » (manger)",
   "a": [
    "mangée",
    "mangées",
    "mangés",
    "mangé"
   ],
   "c": 1,
   "e": "Avec « avoir », le participe s'accorde avec le COD placé avant (« que » = les pommes, féminin pluriel) : mangées.",
   "t": "Brevet · Accord du participe passé"
  },
  {
   "q": "Complète : « Elles se sont ___ ce matin. » (se laver)",
   "a": [
    "lavées",
    "lavés",
    "lavé",
    "laver"
   ],
   "c": 0,
   "e": "Le pronom « se » est ici COD placé avant : le participe s'accorde avec « elles » (féminin pluriel) → lavées.",
   "t": "Brevet · Accord du participe passé"
  },
  {
   "q": "« Quelle heure est-il ? » est une phrase :",
   "a": [
    "Impérative",
    "Exclamative",
    "Interrogative",
    "Déclarative"
   ],
   "c": 2,
   "e": "La phrase pose une question et se termine par un point d'interrogation : elle est interrogative.",
   "t": "Brevet · Types de phrases"
  },
  {
   "q": "« Ferme la porte ! » est une phrase :",
   "a": [
    "Déclarative",
    "Impérative (injonctive)",
    "Exclamative",
    "Interrogative"
   ],
   "c": 1,
   "e": "Cette phrase exprime un ordre : elle est impérative (ou injonctive).",
   "t": "Brevet · Types de phrases"
  },
  {
   "q": "« Quel beau spectacle ! » est une phrase :",
   "a": [
    "Exclamative",
    "Interrogative",
    "Déclarative",
    "Impérative"
   ],
   "c": 0,
   "e": "La phrase exprime un sentiment fort et se termine par un point d'exclamation : elle est exclamative.",
   "t": "Brevet · Types de phrases"
  },
  {
   "q": "« Je ne mange jamais de viande. » est une phrase de forme :",
   "a": [
    "Exclamative",
    "Affirmative",
    "Interrogative",
    "Négative"
   ],
   "c": 3,
   "e": "La présence de « ne … jamais » indique une phrase de forme négative.",
   "t": "Brevet · Formes de phrases"
  },
  {
   "q": "« La souris est mangée par le chat. » est à la voix :",
   "a": [
    "Impérative",
    "Passive",
    "Active",
    "Pronominale"
   ],
   "c": 1,
   "e": "Le sujet « la souris » subit l'action : la phrase est à la voix passive (auxiliaire être + participe + complément d'agent).",
   "t": "Brevet · Voix active / passive"
  },
  {
   "q": "Quelle est la transformation passive de « Le chat mange la souris » ?",
   "a": [
    "La souris mange le chat.",
    "Le chat est mangé par la souris.",
    "La souris a mangé le chat.",
    "La souris est mangée par le chat."
   ],
   "c": 3,
   "e": "Le COD « la souris » devient sujet, et le sujet « le chat » devient complément d'agent : « La souris est mangée par le chat. »",
   "t": "Brevet · Voix active / passive"
  },
  {
   "q": "« Il déclara qu'il viendrait le lendemain. » est du discours :",
   "a": [
    "Narrativisé",
    "Indirect",
    "Indirect libre",
    "Direct"
   ],
   "c": 1,
   "e": "Les paroles sont intégrées dans une subordonnée (« qu'il viendrait »), sans guillemets : c'est du discours indirect.",
   "t": "Brevet · Discours rapporté"
  },
  {
   "q": "Quel signe de ponctuation marque le discours direct ?",
   "a": [
    "Les parenthèses",
    "Les crochets",
    "Le point-virgule",
    "Les guillemets (et les tirets)"
   ],
   "c": 3,
   "e": "Le discours direct rapporte les paroles exactes, signalées par des guillemets et/ou des tirets.",
   "t": "Brevet · Discours rapporté"
  },
  {
   "q": "Dans « Le livre que je lis est passionnant », « que je lis » est une proposition subordonnée :",
   "a": [
    "Principale",
    "Conjonctive complétive",
    "Relative",
    "Indépendante"
   ],
   "c": 2,
   "e": "Introduite par le pronom relatif « que » et complétant le nom « livre », c'est une subordonnée relative.",
   "t": "Brevet · Propositions subordonnées"
  },
  {
   "q": "Parmi ces mots, lequel est un pronom relatif ?",
   "a": [
    "et",
    "très",
    "le",
    "dont"
   ],
   "c": 3,
   "e": "« Dont » est un pronom relatif (comme qui, que, où, lequel) qui introduit une subordonnée relative.",
   "t": "Brevet · Propositions subordonnées"
  },
  {
   "q": "Dans « Je pense que tu as raison », « que tu as raison » est une proposition subordonnée :",
   "a": [
    "Relative",
    "Indépendante",
    "Interrogative directe",
    "Conjonctive (complétive)"
   ],
   "c": 3,
   "e": "Introduite par la conjonction « que » et complétant le verbe « pense », c'est une subordonnée conjonctive complétive.",
   "t": "Brevet · Propositions subordonnées"
  },
  {
   "q": "« Il est fort comme un lion. » Quelle figure de style reconnaît-on ?",
   "a": [
    "Une métaphore",
    "Une personnification",
    "Une comparaison",
    "Une hyperbole"
   ],
   "c": 2,
   "e": "La présence de l'outil de comparaison « comme » indique une comparaison.",
   "t": "Brevet · Comparaison"
  },
  {
   "q": "« Cet homme est un lion au combat. » Quelle figure de style est employée ?",
   "a": [
    "Une métaphore",
    "Une litote",
    "Une énumération",
    "Une comparaison"
   ],
   "c": 0,
   "e": "Le rapprochement se fait sans outil de comparaison : c'est une métaphore.",
   "t": "Brevet · Métaphore"
  },
  {
   "q": "« Le vent murmure dans les arbres. » Quelle figure de style reconnaît-on ?",
   "a": [
    "Une métonymie",
    "Une comparaison",
    "Une personnification",
    "Une hyperbole"
   ],
   "c": 2,
   "e": "On attribue une action humaine (murmurer) à une chose (le vent) : c'est une personnification.",
   "t": "Brevet · Personnification"
  },
  {
   "q": "« Je meurs de faim ! » Quelle figure de style est employée ?",
   "a": [
    "Une litote",
    "Une hyperbole (exagération)",
    "Une comparaison",
    "Une personnification"
   ],
   "c": 1,
   "e": "L'expression exagère volontairement la réalité : c'est une hyperbole.",
   "t": "Brevet · Hyperbole"
  },
  {
   "q": "« Une obscure clarté » associe deux mots de sens opposés. Quelle figure est-ce ?",
   "a": [
    "Un oxymore",
    "Une allitération",
    "Une gradation",
    "Une anaphore"
   ],
   "c": 0,
   "e": "L'association de deux termes contradictoires (obscure / clarté) constitue un oxymore.",
   "t": "Brevet · Oxymore"
  },
  {
   "q": "La répétition d'un même mot au début de plusieurs vers ou phrases s'appelle :",
   "a": [
    "Une anaphore",
    "Une allitération",
    "Une comparaison",
    "Une métaphore"
   ],
   "c": 0,
   "e": "L'anaphore est la répétition d'un mot (ou groupe de mots) en début de vers ou de phrases successives.",
   "t": "Brevet · Anaphore"
  },
  {
   "q": "« Pour qui sont ces serpents qui sifflent sur vos têtes ? » : la répétition du son « s » est :",
   "a": [
    "Une assonance",
    "Une anaphore",
    "Une métaphore",
    "Une allitération"
   ],
   "c": 3,
   "e": "La répétition d'un même son consonne (ici [s]) est une allitération.",
   "t": "Brevet · Allitération"
  },
  {
   "q": "« Il a tout perdu : sa maison, son travail, ses amis, son espoir. » Quelle figure de style est-ce ?",
   "a": [
    "Un oxymore",
    "Une comparaison",
    "Une litote",
    "Une énumération"
   ],
   "c": 3,
   "e": "La succession de plusieurs éléments forme une énumération (ici renforcée par une gradation).",
   "t": "Brevet · Énumération"
  },
  {
   "q": "Le mot « bagnole » appartient au registre :",
   "a": [
    "Soutenu",
    "Familier",
    "Scientifique",
    "Courant"
   ],
   "c": 1,
   "e": "« Bagnole » est un terme familier ; « voiture » est courant et « automobile » plutôt soutenu.",
   "t": "Brevet · Registres de langue"
  },
  {
   "q": "Parmi ces mots, lequel relève du registre soutenu ?",
   "a": [
    "ouvrage",
    "bouquinerie",
    "livre",
    "bouquin"
   ],
   "c": 0,
   "e": "« Ouvrage » est soutenu, « livre » courant, « bouquin » familier.",
   "t": "Brevet · Registres de langue"
  },
  {
   "q": "Quel est un synonyme de « content » ?",
   "a": [
    "Heureux",
    "Triste",
    "Méchant",
    "Fatigué"
   ],
   "c": 0,
   "e": "« Heureux » a un sens proche de « content » : ce sont des synonymes.",
   "t": "Brevet · Synonymes"
  },
  {
   "q": "Quel est l'antonyme (contraire) de « grand » ?",
   "a": [
    "Immense",
    "Long",
    "Petit",
    "Gros"
   ],
   "c": 2,
   "e": "« Petit » est le contraire de « grand » : ce sont des antonymes.",
   "t": "Brevet · Antonymes"
  },
  {
   "q": "Dans « refaire », que signifie le préfixe « re- » ?",
   "a": [
    "La répétition (faire à nouveau)",
    "Le contraire",
    "La petitesse",
    "La négation"
   ],
   "c": 0,
   "e": "Le préfixe « re- » indique la répétition : refaire = faire de nouveau.",
   "t": "Brevet · Préfixes"
  },
  {
   "q": "Le préfixe « anti- » (comme dans « antivol ») signifie :",
   "a": [
    "Contre",
    "Sous",
    "Avant",
    "Avec"
   ],
   "c": 0,
   "e": "Le préfixe « anti- » signifie « contre » (antivol = contre le vol).",
   "t": "Brevet · Préfixes"
  },
  {
   "q": "Dans « Il a un cœur de pierre », l'expression est employée au sens :",
   "a": [
    "Scientifique",
    "Propre",
    "Littéral",
    "Figuré"
   ],
   "c": 3,
   "e": "Au sens figuré, « cœur de pierre » signifie « une personne dure, insensible », et non un vrai cœur en pierre.",
   "t": "Brevet · Sens propre / sens figuré"
  },
  {
   "q": "Les mots « vague », « marée », « écume », « rivage » appartiennent au champ lexical :",
   "a": [
    "De la ville",
    "De la guerre",
    "De la montagne",
    "De la mer"
   ],
   "c": 3,
   "e": "Tous ces mots se rapportent à la mer : ils forment un champ lexical de la mer.",
   "t": "Brevet · Champ lexical"
  },
  {
   "q": "Quel mot n'appartient PAS à la famille de « terre » ?",
   "a": [
    "terrestre",
    "enterrer",
    "terrain",
    "terrible"
   ],
   "c": 3,
   "e": "« Terrible » vient d'un autre radical (la peur) ; les autres partagent le radical « terr- » de « terre ».",
   "t": "Brevet · Famille de mots"
  },
  {
   "q": "Dans « lavable », le suffixe « -able » exprime :",
   "a": [
    "La petitesse",
    "La possibilité (qui peut être lavé)",
    "Le contraire",
    "La répétition"
   ],
   "c": 1,
   "e": "Le suffixe « -able » indique la possibilité : lavable = qui peut être lavé.",
   "t": "Brevet · Suffixes"
  },
  {
   "q": "Dans « Il mange beaucoup », quelle est la nature de « beaucoup » ?",
   "a": [
    "Un adjectif",
    "Un nom",
    "Un déterminant",
    "Un adverbe"
   ],
   "c": 3,
   "e": "« Beaucoup » modifie le verbe « mange » et est invariable : c'est un adverbe (de quantité).",
   "t": "Brevet · Classes grammaticales"
  },
  {
   "q": "Dans « Il parle lentement », quelle est la fonction de « lentement » ?",
   "a": [
    "Sujet",
    "Attribut",
    "COD",
    "CC de manière"
   ],
   "c": 3,
   "e": "« Lentement » indique de quelle manière se fait l'action : c'est un complément circonstanciel de manière.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "À quel temps est « il avait mangé » ?",
   "a": [
    "Passé composé",
    "Conditionnel passé",
    "Plus-que-parfait",
    "Imparfait"
   ],
   "c": 2,
   "e": "Auxiliaire à l'imparfait (« avait ») + participe passé = plus-que-parfait.",
   "t": "Brevet · Identifier les temps"
  },
  {
   "q": "Conjugue : « Nous (être) heureux. » (imparfait)",
   "a": [
    "Nous sommes",
    "Nous fûmes",
    "Nous serions",
    "Nous étions"
   ],
   "c": 3,
   "e": "À l'imparfait, « être » à la 1re personne du pluriel donne : nous étions.",
   "t": "Brevet · Conjuguer à l'imparfait"
  },
  {
   "q": "Complète : « ___ heure est-il ? »",
   "a": [
    "Quels",
    "Quelle",
    "Quel",
    "Qu'elle"
   ],
   "c": 1,
   "e": "« Quelle » est un déterminant interrogatif qui s'accorde avec « heure » (féminin singulier).",
   "t": "Brevet · Homophones quel / qu'elle"
  },
  {
   "q": "Complète : « Il ___ lève tôt chaque matin. »",
   "a": [
    "ses",
    "se",
    "ce",
    "ceux"
   ],
   "c": 1,
   "e": "Devant un verbe pronominal, on écrit « se » (il se lève). « Ce » accompagne un nom.",
   "t": "Brevet · Homophones se / ce"
  },
  {
   "q": "Complète : « La boîte de chocolats ___ sur la table. » (être, présent)",
   "a": [
    "est",
    "sont",
    "es",
    "ait"
   ],
   "c": 0,
   "e": "Le sujet est « la boîte » (singulier), pas « chocolats » : le verbe reste au singulier (est).",
   "t": "Brevet · Accord sujet-verbe"
  },
  {
   "q": "« Le soleil brille. » est une proposition :",
   "a": [
    "Principale",
    "Subordonnée conjonctive",
    "Subordonnée relative",
    "Indépendante"
   ],
   "c": 3,
   "e": "La phrase contient un seul verbe conjugué et se suffit à elle-même : c'est une proposition indépendante.",
   "t": "Brevet · Propositions"
  },
  {
   "q": "« C'est un roc ! … c'est un cap ! Que dis-je, c'est un cap ? … C'est une péninsule ! » illustre :",
   "a": [
    "Une personnification",
    "Une gradation",
    "Une comparaison",
    "Une litote"
   ],
   "c": 1,
   "e": "Les termes sont organisés du plus faible au plus fort : c'est une gradation (ascendante).",
   "t": "Brevet · Gradation"
  },
  {
   "q": "Un vers de douze syllabes s'appelle :",
   "a": [
    "Un alexandrin",
    "Un quatrain",
    "Un octosyllabe",
    "Un décasyllabe"
   ],
   "c": 0,
   "e": "Le vers de 12 syllabes est l'alexandrin ; l'octosyllabe a 8 syllabes, le décasyllabe 10.",
   "t": "Brevet · Versification"
  },
  {
   "q": "Une strophe de quatre vers s'appelle :",
   "a": [
    "Un distique",
    "Un sonnet",
    "Un tercet",
    "Un quatrain"
   ],
   "c": 3,
   "e": "Une strophe de quatre vers est un quatrain ; le tercet en compte trois.",
   "t": "Brevet · Versification"
  },
  {
   "q": "Que signifie le mot « éphémère » ?",
   "a": [
    "Qui est très grand",
    "Qui dure peu de temps",
    "Qui est solide",
    "Qui dure très longtemps"
   ],
   "c": 1,
   "e": "« Éphémère » qualifie ce qui ne dure qu'un court instant.",
   "t": "Brevet · Sens des mots"
  },
  {
   "q": "Quelle phrase est formulée dans un registre courant ?",
   "a": [
    "Passe ton bic, vite.",
    "Peux-tu me prêter ton stylo ?",
    "File-moi ton stylo.",
    "Auriez-vous l'amabilité de me prêter votre stylo ?"
   ],
   "c": 1,
   "e": "« Peux-tu me prêter ton stylo ? » est neutre et correct : registre courant. Les autres sont familiers ou soutenu.",
   "t": "Brevet · Niveaux de langue"
  },
  {
   "q": "Dans « Pierre offre des fleurs à sa mère », quelle est la fonction de « des fleurs » ?",
   "a": [
    "Sujet",
    "COI",
    "COD",
    "CC de but"
   ],
   "c": 2,
   "e": "« Des fleurs » complète directement « offre » (offre quoi ?) : c'est le COD.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "Dans un récit au passé, quelle combinaison de temps est correcte ?",
   "a": [
    "Il marchera quand il entendit un bruit.",
    "Il marchait quand soudain il entend un bruit.",
    "Il marchait quand soudain il entendit un bruit.",
    "Il marche quand soudain il entendit un bruit."
   ],
   "c": 2,
   "e": "L'imparfait (marchait = arrière-plan) s'associe au passé simple (entendit = action soudaine de premier plan).",
   "t": "Brevet · Concordance des temps"
  },
  {
   "q": "Dans une phrase, le connecteur logique « cependant » exprime :",
   "a": [
    "La cause",
    "Le temps",
    "L'opposition",
    "La conséquence"
   ],
   "c": 2,
   "e": "« Cependant » (comme « mais », « pourtant », « toutefois ») exprime une opposition.",
   "t": "Brevet · Connecteurs et reprises"
  }
 ],
 "maths": [
  {
   "q": "Combien vaut 1/2 + 1/3 ?",
   "a": [
    "1/6",
    "5/6",
    "2/6",
    "2/5"
   ],
   "c": 1,
   "e": "On réduit au même dénominateur (6) : 3/6 + 2/6 = 5/6.",
   "t": "Brevet · Fractions"
  },
  {
   "q": "Combien vaut 2/3 × 3/4 ?",
   "a": [
    "1/2",
    "1/4",
    "6/7",
    "5/7"
   ],
   "c": 0,
   "e": "On multiplie numérateurs et dénominateurs : 6/12 = 1/2.",
   "t": "Brevet · Fractions"
  },
  {
   "q": "Combien vaut (3/4) ÷ (1/2) ?",
   "a": [
    "2/3",
    "3/8",
    "1/2",
    "3/2"
   ],
   "c": 3,
   "e": "Diviser revient à multiplier par l'inverse : 3/4 × 2/1 = 6/4 = 3/2.",
   "t": "Brevet · Fractions"
  },
  {
   "q": "Quelle est la forme irréductible de 12/18 ?",
   "a": [
    "4/6",
    "6/9",
    "3/4",
    "2/3"
   ],
   "c": 3,
   "e": "On divise par le PGCD (6) : 12/18 = 2/3.",
   "t": "Brevet · Fractions"
  },
  {
   "q": "Combien vaut 10³ ?",
   "a": [
    "30",
    "100",
    "10000",
    "1000"
   ],
   "c": 3,
   "e": "10³ = 10 × 10 × 10 = 1000.",
   "t": "Brevet · Puissances"
  },
  {
   "q": "Combien vaut 2⁵ ?",
   "a": [
    "25",
    "16",
    "32",
    "10"
   ],
   "c": 2,
   "e": "2⁵ = 2 × 2 × 2 × 2 × 2 = 32.",
   "t": "Brevet · Puissances"
  },
  {
   "q": "Quelle est l'écriture scientifique de 45 000 ?",
   "a": [
    "45 × 10³",
    "4,5 × 10³",
    "0,45 × 10⁵",
    "4,5 × 10⁴"
   ],
   "c": 3,
   "e": "L'écriture scientifique a un seul chiffre non nul avant la virgule : 4,5 × 10⁴.",
   "t": "Brevet · Notation scientifique"
  },
  {
   "q": "Quelle est l'écriture scientifique de 0,003 ?",
   "a": [
    "3 × 10⁻²",
    "3 × 10³",
    "0,3 × 10⁻²",
    "3 × 10⁻³"
   ],
   "c": 3,
   "e": "0,003 = 3 / 1000 = 3 × 10⁻³.",
   "t": "Brevet · Notation scientifique"
  },
  {
   "q": "Combien vaut −5 + 8 ?",
   "a": [
    "−13",
    "−3",
    "13",
    "3"
   ],
   "c": 3,
   "e": "−5 + 8 = 8 − 5 = 3.",
   "t": "Brevet · Nombres relatifs"
  },
  {
   "q": "Combien vaut (−4) × (−3) ?",
   "a": [
    "−12",
    "7",
    "12",
    "−7"
   ],
   "c": 2,
   "e": "Le produit de deux nombres négatifs est positif : (−4) × (−3) = 12.",
   "t": "Brevet · Nombres relatifs"
  },
  {
   "q": "Combien vaut 3 + 4 × 2 ?",
   "a": [
    "11",
    "24",
    "10",
    "14"
   ],
   "c": 0,
   "e": "La multiplication est prioritaire : 4 × 2 = 8, puis 3 + 8 = 11.",
   "t": "Brevet · Priorités opératoires"
  },
  {
   "q": "Combien vaut 2 × (3 + 5) ?",
   "a": [
    "16",
    "11",
    "26",
    "13"
   ],
   "c": 0,
   "e": "On calcule d'abord la parenthèse : 3 + 5 = 8, puis 2 × 8 = 16.",
   "t": "Brevet · Priorités opératoires"
  },
  {
   "q": "Développer 3(x + 2) donne :",
   "a": [
    "x + 6",
    "3x + 6",
    "3x + 2",
    "3x + 5"
   ],
   "c": 1,
   "e": "On distribue : 3 × x + 3 × 2 = 3x + 6.",
   "t": "Brevet · Calcul littéral"
  },
  {
   "q": "Développer 2(3x − 4) donne :",
   "a": [
    "6x − 8",
    "6x + 8",
    "5x − 8",
    "6x − 4"
   ],
   "c": 0,
   "e": "2 × 3x − 2 × 4 = 6x − 8.",
   "t": "Brevet · Calcul littéral"
  },
  {
   "q": "Réduire 5x + 3x donne :",
   "a": [
    "15x",
    "8x²",
    "8x",
    "2x"
   ],
   "c": 2,
   "e": "On additionne les coefficients des termes en x : 5x + 3x = 8x.",
   "t": "Brevet · Calcul littéral"
  },
  {
   "q": "Réduire 4x + 3 − x + 2 donne :",
   "a": [
    "3x + 6",
    "5x + 5",
    "3x + 5",
    "8x"
   ],
   "c": 2,
   "e": "Termes en x : 4x − x = 3x ; constantes : 3 + 2 = 5. D'où 3x + 5.",
   "t": "Brevet · Calcul littéral"
  },
  {
   "q": "Factoriser 5x + 5y donne :",
   "a": [
    "5x + y",
    "5(x + y)",
    "10xy",
    "5xy"
   ],
   "c": 1,
   "e": "Le facteur commun est 5 : 5x + 5y = 5(x + y).",
   "t": "Brevet · Calcul littéral"
  },
  {
   "q": "Factoriser 3x + 6 donne :",
   "a": [
    "9x",
    "3x + 2",
    "3(x + 2)",
    "3(x + 6)"
   ],
   "c": 2,
   "e": "6 = 3 × 2, donc 3x + 6 = 3(x + 2).",
   "t": "Brevet · Calcul littéral"
  },
  {
   "q": "Développer (x + 1)(x + 2) donne :",
   "a": [
    "x² + 2",
    "2x + 3",
    "x² + 3x + 2",
    "x² + 3x + 3"
   ],
   "c": 2,
   "e": "Double distributivité : x² + 2x + x + 2 = x² + 3x + 2.",
   "t": "Brevet · Calcul littéral"
  },
  {
   "q": "Résoudre x + 5 = 12. On trouve x = ",
   "a": [
    "−7",
    "5",
    "7",
    "17"
   ],
   "c": 2,
   "e": "x = 12 − 5 = 7.",
   "t": "Brevet · Équations"
  },
  {
   "q": "Résoudre 3x = 21. On trouve x = ",
   "a": [
    "18",
    "7",
    "63",
    "24"
   ],
   "c": 1,
   "e": "x = 21 ÷ 3 = 7.",
   "t": "Brevet · Équations"
  },
  {
   "q": "Résoudre 2x + 3 = 11. On trouve x = ",
   "a": [
    "5",
    "8",
    "4",
    "7"
   ],
   "c": 2,
   "e": "2x = 11 − 3 = 8, donc x = 4.",
   "t": "Brevet · Équations"
  },
  {
   "q": "Résoudre 5x − 2 = 13. On trouve x = ",
   "a": [
    "11",
    "3",
    "2,2",
    "15"
   ],
   "c": 1,
   "e": "5x = 13 + 2 = 15, donc x = 3.",
   "t": "Brevet · Équations"
  },
  {
   "q": "Parmi ces nombres, lequel est un nombre premier ?",
   "a": [
    "9",
    "15",
    "21",
    "7"
   ],
   "c": 3,
   "e": "7 n'a que deux diviseurs (1 et 7). Les autres ont d'autres diviseurs (9 = 3×3, 15 = 3×5, 21 = 3×7).",
   "t": "Brevet · Arithmétique"
  },
  {
   "q": "Par lequel de ces nombres 45 est-il divisible ?",
   "a": [
    "8",
    "5",
    "4",
    "2"
   ],
   "c": 1,
   "e": "45 se termine par 5, il est donc divisible par 5 (45 = 5 × 9).",
   "t": "Brevet · Arithmétique"
  },
  {
   "q": "Le PGCD de 24 et 36 est :",
   "a": [
    "4",
    "72",
    "12",
    "6"
   ],
   "c": 2,
   "e": "Le plus grand diviseur commun à 24 et 36 est 12.",
   "t": "Brevet · Arithmétique"
  },
  {
   "q": "Si 3 stylos coûtent 6 €, combien coûtent 5 stylos (au même prix unitaire) ?",
   "a": [
    "8 €",
    "9 €",
    "10 €",
    "12 €"
   ],
   "c": 2,
   "e": "Un stylo coûte 6 ÷ 3 = 2 €, donc 5 stylos coûtent 5 × 2 = 10 €.",
   "t": "Brevet · Proportionnalité"
  },
  {
   "q": "Combien vaut 20 % de 80 ?",
   "a": [
    "20",
    "16",
    "4",
    "160"
   ],
   "c": 1,
   "e": "20 % de 80 = 0,20 × 80 = 16.",
   "t": "Brevet · Pourcentages"
  },
  {
   "q": "Combien vaut 25 % de 200 ?",
   "a": [
    "75",
    "25",
    "5",
    "50"
   ],
   "c": 3,
   "e": "25 % = un quart : 200 ÷ 4 = 50.",
   "t": "Brevet · Pourcentages"
  },
  {
   "q": "Un article à 50 € augmente de 20 %. Son nouveau prix est :",
   "a": [
    "70 €",
    "100 €",
    "55 €",
    "60 €"
   ],
   "c": 3,
   "e": "Augmentation : 50 × 0,20 = 10 €, donc 50 + 10 = 60 € (ou 50 × 1,20).",
   "t": "Brevet · Pourcentages"
  },
  {
   "q": "Un article à 80 € subit une réduction de 25 %. Son nouveau prix est :",
   "a": [
    "60 €",
    "20 €",
    "55 €",
    "75 €"
   ],
   "c": 0,
   "e": "Réduction : 80 × 0,25 = 20 €, donc 80 − 20 = 60 € (ou 80 × 0,75).",
   "t": "Brevet · Pourcentages"
  },
  {
   "q": "Sur un plan à l'échelle 1/100, une longueur de 5 cm représente en réalité :",
   "a": [
    "0,5 m",
    "5 m",
    "500 m",
    "50 cm"
   ],
   "c": 1,
   "e": "1 cm sur le plan = 100 cm en réalité, donc 5 cm = 500 cm = 5 m.",
   "t": "Brevet · Échelles"
  },
  {
   "q": "La moyenne des notes 10, 12 et 14 est :",
   "a": [
    "12",
    "13",
    "36",
    "11"
   ],
   "c": 0,
   "e": "(10 + 12 + 14) ÷ 3 = 36 ÷ 3 = 12.",
   "t": "Brevet · Statistiques"
  },
  {
   "q": "La moyenne de 8, 12, 10 et 14 est :",
   "a": [
    "10",
    "44",
    "12",
    "11"
   ],
   "c": 3,
   "e": "(8 + 12 + 10 + 14) ÷ 4 = 44 ÷ 4 = 11.",
   "t": "Brevet · Statistiques"
  },
  {
   "q": "La médiane de la série 3, 5, 7, 9, 11 est :",
   "a": [
    "5",
    "9",
    "7",
    "35"
   ],
   "c": 2,
   "e": "La médiane est la valeur centrale de la série ordonnée : 7.",
   "t": "Brevet · Statistiques"
  },
  {
   "q": "La médiane de la série 4, 6, 8, 10 est :",
   "a": [
    "7",
    "28",
    "6",
    "8"
   ],
   "c": 0,
   "e": "Avec un nombre pair de valeurs, on fait la moyenne des deux valeurs centrales : (6 + 8) ÷ 2 = 7.",
   "t": "Brevet · Statistiques"
  },
  {
   "q": "L'étendue de la série 5, 8, 12, 3 est :",
   "a": [
    "12",
    "7",
    "9",
    "3"
   ],
   "c": 2,
   "e": "L'étendue = valeur maximale − valeur minimale = 12 − 3 = 9.",
   "t": "Brevet · Statistiques"
  },
  {
   "q": "Dans une classe de 20 élèves, 5 sont gauchers. La fréquence de gauchers est :",
   "a": [
    "25 %",
    "20 %",
    "40 %",
    "5 %"
   ],
   "c": 0,
   "e": "Fréquence = 5 ÷ 20 = 0,25 = 25 %.",
   "t": "Brevet · Fréquences"
  },
  {
   "q": "On lance un dé équilibré à 6 faces. La probabilité d'obtenir un 3 est :",
   "a": [
    "1/6",
    "3/6",
    "1/3",
    "1/2"
   ],
   "c": 0,
   "e": "Il y a 1 cas favorable sur 6 issues possibles : 1/6.",
   "t": "Brevet · Probabilités"
  },
  {
   "q": "On lance un dé à 6 faces. La probabilité d'obtenir un nombre pair est :",
   "a": [
    "1/6",
    "1/3",
    "1/2",
    "2/3"
   ],
   "c": 2,
   "e": "Les nombres pairs sont 2, 4, 6 : 3 cas favorables sur 6, soit 3/6 = 1/2.",
   "t": "Brevet · Probabilités"
  },
  {
   "q": "Dans un jeu de 52 cartes, la probabilité de tirer un cœur est :",
   "a": [
    "1/52",
    "1/2",
    "1/13",
    "1/4"
   ],
   "c": 3,
   "e": "Il y a 13 cœurs sur 52 cartes : 13/52 = 1/4.",
   "t": "Brevet · Probabilités"
  },
  {
   "q": "La probabilité d'un événement certain est :",
   "a": [
    "0,5",
    "1",
    "100",
    "0"
   ],
   "c": 1,
   "e": "Un événement certain a une probabilité de 1 ; un événement impossible a une probabilité de 0.",
   "t": "Brevet · Probabilités"
  },
  {
   "q": "Soit la fonction f définie par f(x) = 3x. Que vaut f(2) ?",
   "a": [
    "6",
    "3",
    "9",
    "5"
   ],
   "c": 0,
   "e": "f(2) = 3 × 2 = 6.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "Soit f(x) = 2x + 1. Que vaut f(3) ?",
   "a": [
    "7",
    "6",
    "5",
    "8"
   ],
   "c": 0,
   "e": "f(3) = 2 × 3 + 1 = 6 + 1 = 7.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "Soit f(x) = 2x. L'image de 5 par f est :",
   "a": [
    "2,5",
    "10",
    "7",
    "5"
   ],
   "c": 1,
   "e": "L'image de 5 est f(5) = 2 × 5 = 10.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "Soit f(x) = 2x. Quel est l'antécédent de 8 par f ?",
   "a": [
    "16",
    "10",
    "6",
    "4"
   ],
   "c": 3,
   "e": "On résout 2x = 8, donc x = 4 : l'antécédent de 8 est 4.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "La représentation graphique d'une fonction linéaire est :",
   "a": [
    "Une droite ne passant pas par l'origine",
    "Une parabole",
    "Une droite passant par l'origine",
    "Un cercle"
   ],
   "c": 2,
   "e": "Une fonction linéaire f(x) = ax est représentée par une droite passant par l'origine du repère.",
   "t": "Brevet · Fonctions"
  },
  {
   "q": "Un tableau est un tableau de proportionnalité lorsque :",
   "a": [
    "Toutes les valeurs sont égales",
    "La somme des lignes est nulle",
    "On passe d'une ligne à l'autre en multipliant par un même nombre",
    "Les nombres sont rangés par ordre croissant"
   ],
   "c": 2,
   "e": "Dans un tableau de proportionnalité, on passe d'une ligne à l'autre par multiplication par un coefficient constant.",
   "t": "Brevet · Proportionnalité"
  },
  {
   "q": "L'aire d'un rectangle de longueur 5 cm et de largeur 3 cm est :",
   "a": [
    "30 cm²",
    "15 cm²",
    "16 cm²",
    "8 cm²"
   ],
   "c": 1,
   "e": "Aire d'un rectangle = longueur × largeur = 5 × 3 = 15 cm².",
   "t": "Brevet · Aires"
  },
  {
   "q": "Le périmètre d'un rectangle de longueur 5 cm et de largeur 3 cm est :",
   "a": [
    "30 cm",
    "8 cm",
    "15 cm",
    "16 cm"
   ],
   "c": 3,
   "e": "Périmètre = 2 × (longueur + largeur) = 2 × (5 + 3) = 16 cm.",
   "t": "Brevet · Périmètres"
  },
  {
   "q": "L'aire d'un triangle de base 6 cm et de hauteur 4 cm est :",
   "a": [
    "6 cm²",
    "10 cm²",
    "24 cm²",
    "12 cm²"
   ],
   "c": 3,
   "e": "Aire d'un triangle = (base × hauteur) ÷ 2 = (6 × 4) ÷ 2 = 12 cm².",
   "t": "Brevet · Aires"
  },
  {
   "q": "L'aire d'un disque de rayon 3 cm est :",
   "a": [
    "9π cm²",
    "6π cm²",
    "3π cm²",
    "9 cm²"
   ],
   "c": 0,
   "e": "Aire d'un disque = π × rayon² = π × 3² = 9π cm².",
   "t": "Brevet · Aires"
  },
  {
   "q": "Le périmètre (circonférence) d'un cercle de rayon 5 cm est :",
   "a": [
    "10π cm",
    "25π cm",
    "2π cm",
    "5π cm"
   ],
   "c": 0,
   "e": "Circonférence = 2 × π × rayon = 2 × π × 5 = 10π cm.",
   "t": "Brevet · Périmètres"
  },
  {
   "q": "Le volume d'un cube d'arête 3 cm est :",
   "a": [
    "27 cm³",
    "18 cm³",
    "12 cm³",
    "9 cm³"
   ],
   "c": 0,
   "e": "Volume d'un cube = arête³ = 3 × 3 × 3 = 27 cm³.",
   "t": "Brevet · Volumes"
  },
  {
   "q": "Le volume d'un pavé droit de dimensions 2 × 3 × 4 cm est :",
   "a": [
    "9 cm³",
    "48 cm³",
    "24 cm³",
    "12 cm³"
   ],
   "c": 2,
   "e": "Volume d'un pavé = longueur × largeur × hauteur = 2 × 3 × 4 = 24 cm³.",
   "t": "Brevet · Volumes"
  },
  {
   "q": "1 m³ est égal à :",
   "a": [
    "1 L",
    "100 L",
    "1000 L",
    "10 L"
   ],
   "c": 2,
   "e": "1 m³ = 1000 dm³, et 1 dm³ = 1 L, donc 1 m³ = 1000 L.",
   "t": "Brevet · Conversions"
  },
  {
   "q": "2,5 km correspondent à :",
   "a": [
    "2500 m",
    "250 m",
    "25000 m",
    "25 m"
   ],
   "c": 0,
   "e": "1 km = 1000 m, donc 2,5 km = 2500 m.",
   "t": "Brevet · Conversions"
  },
  {
   "q": "Une voiture parcourt 120 km en 1,5 h. Sa vitesse moyenne est :",
   "a": [
    "80 km/h",
    "60 km/h",
    "180 km/h",
    "90 km/h"
   ],
   "c": 0,
   "e": "v = distance ÷ durée = 120 ÷ 1,5 = 80 km/h.",
   "t": "Brevet · Vitesse"
  },
  {
   "q": "Lors d'un agrandissement de rapport 2, l'aire d'une figure est multipliée par :",
   "a": [
    "4",
    "8",
    "2",
    "6"
   ],
   "c": 0,
   "e": "Les aires sont multipliées par le carré du rapport : 2² = 4.",
   "t": "Brevet · Agrandissement-réduction"
  },
  {
   "q": "Lors d'un agrandissement de rapport 3, le volume d'un solide est multiplié par :",
   "a": [
    "3",
    "27",
    "6",
    "9"
   ],
   "c": 1,
   "e": "Les volumes sont multipliés par le cube du rapport : 3³ = 27.",
   "t": "Brevet · Agrandissement-réduction"
  },
  {
   "q": "Le volume d'un cylindre de rayon r et de hauteur h est :",
   "a": [
    "π × r × h",
    "(π × r² × h) ÷ 3",
    "2 × π × r × h",
    "π × r² × h"
   ],
   "c": 3,
   "e": "Volume d'un cylindre = aire de la base × hauteur = π × r² × h.",
   "t": "Brevet · Volumes"
  },
  {
   "q": "Le volume d'une pyramide est donné par :",
   "a": [
    "aire de la base × hauteur",
    "aire de la base ÷ hauteur",
    "périmètre × hauteur",
    "(aire de la base × hauteur) ÷ 3"
   ],
   "c": 3,
   "e": "Volume d'une pyramide (ou d'un cône) = (aire de la base × hauteur) ÷ 3.",
   "t": "Brevet · Volumes"
  },
  {
   "q": "Dans un triangle rectangle dont les côtés de l'angle droit mesurent 3 et 4 cm, l'hypoténuse mesure :",
   "a": [
    "7 cm",
    "6 cm",
    "5 cm",
    "25 cm"
   ],
   "c": 2,
   "e": "D'après Pythagore : 3² + 4² = 9 + 16 = 25, donc l'hypoténuse = √25 = 5 cm.",
   "t": "Brevet · Théorème de Pythagore"
  },
  {
   "q": "Dans un triangle rectangle dont les côtés de l'angle droit mesurent 6 et 8 cm, l'hypoténuse mesure :",
   "a": [
    "100 cm",
    "12 cm",
    "10 cm",
    "14 cm"
   ],
   "c": 2,
   "e": "6² + 8² = 36 + 64 = 100, donc l'hypoténuse = √100 = 10 cm.",
   "t": "Brevet · Théorème de Pythagore"
  },
  {
   "q": "Un triangle rectangle a une hypoténuse de 13 cm et un côté de 5 cm. L'autre côté mesure :",
   "a": [
    "144 cm",
    "18 cm",
    "12 cm",
    "8 cm"
   ],
   "c": 2,
   "e": "13² − 5² = 169 − 25 = 144, donc le côté = √144 = 12 cm.",
   "t": "Brevet · Théorème de Pythagore"
  },
  {
   "q": "Un triangle a des côtés de 5, 12 et 13 cm. Que peut-on dire ?",
   "a": [
    "Il est rectangle (car 5² + 12² = 13²)",
    "C'est impossible",
    "Il n'est pas rectangle",
    "Il est équilatéral"
   ],
   "c": 0,
   "e": "5² + 12² = 25 + 144 = 169 = 13² : d'après la réciproque de Pythagore, le triangle est rectangle.",
   "t": "Brevet · Réciproque de Pythagore"
  },
  {
   "q": "Dans un triangle rectangle, le cosinus d'un angle aigu est égal à :",
   "a": [
    "côté opposé / hypoténuse",
    "hypoténuse / côté adjacent",
    "côté adjacent / hypoténuse",
    "côté opposé / côté adjacent"
   ],
   "c": 2,
   "e": "cos = côté adjacent / hypoténuse (moyen mnémo : CAH).",
   "t": "Brevet · Trigonométrie"
  },
  {
   "q": "Dans un triangle rectangle, le sinus d'un angle aigu est égal à :",
   "a": [
    "côté opposé / côté adjacent",
    "côté adjacent / hypoténuse",
    "côté opposé / hypoténuse",
    "hypoténuse / côté opposé"
   ],
   "c": 2,
   "e": "sin = côté opposé / hypoténuse (moyen mnémo : SOH).",
   "t": "Brevet · Trigonométrie"
  },
  {
   "q": "Dans un triangle rectangle, la tangente d'un angle aigu est égale à :",
   "a": [
    "côté opposé / côté adjacent",
    "côté adjacent / hypoténuse",
    "côté adjacent / côté opposé",
    "côté opposé / hypoténuse"
   ],
   "c": 0,
   "e": "tan = côté opposé / côté adjacent (moyen mnémo : TOA).",
   "t": "Brevet · Trigonométrie"
  },
  {
   "q": "Le théorème de Thalès permet de calculer :",
   "a": [
    "Des aires de disques",
    "Des moyennes",
    "Des probabilités",
    "Des longueurs dans une configuration de droites parallèles"
   ],
   "c": 3,
   "e": "Le théorème de Thalès donne des rapports de longueurs égaux dans une configuration avec deux droites sécantes coupées par des parallèles.",
   "t": "Brevet · Théorème de Thalès"
  },
  {
   "q": "La somme des angles d'un triangle est :",
   "a": [
    "270°",
    "90°",
    "360°",
    "180°"
   ],
   "c": 3,
   "e": "Dans tout triangle, la somme des trois angles vaut 180°.",
   "t": "Brevet · Angles"
  },
  {
   "q": "Dans un triangle, deux angles mesurent 50° et 60°. Le troisième mesure :",
   "a": [
    "80°",
    "110°",
    "90°",
    "70°"
   ],
   "c": 3,
   "e": "180° − (50° + 60°) = 180° − 110° = 70°.",
   "t": "Brevet · Angles"
  },
  {
   "q": "Une translation transforme une figure en :",
   "a": [
    "Une figure tournée",
    "Une figure réduite",
    "Une figure identique glissée selon une direction",
    "Une figure agrandie"
   ],
   "c": 2,
   "e": "Une translation fait glisser la figure selon une direction, un sens et une longueur, sans la déformer ni la tourner.",
   "t": "Brevet · Transformations"
  },
  {
   "q": "Une homothétie de rapport 2 :",
   "a": [
    "Conserve les longueurs",
    "Divise les longueurs par 2",
    "Multiplie les longueurs par 2 (agrandissement)",
    "Fait tourner la figure"
   ],
   "c": 2,
   "e": "Une homothétie de rapport 2 agrandit la figure : toutes les longueurs sont multipliées par 2.",
   "t": "Brevet · Transformations"
  },
  {
   "q": "Combien de faces possède une pyramide à base carrée ?",
   "a": [
    "8",
    "6",
    "4",
    "5"
   ],
   "c": 3,
   "e": "Une pyramide à base carrée a 1 base carrée + 4 faces triangulaires = 5 faces.",
   "t": "Brevet · Solides"
  },
  {
   "q": "Combien d'arêtes possède un cube ?",
   "a": [
    "16",
    "12",
    "6",
    "8"
   ],
   "c": 1,
   "e": "Un cube possède 6 faces, 8 sommets et 12 arêtes.",
   "t": "Brevet · Solides"
  },
  {
   "q": "La section d'un cube par un plan parallèle à une face est :",
   "a": [
    "Un triangle",
    "Un carré",
    "Un cercle",
    "Un hexagone"
   ],
   "c": 1,
   "e": "Couper un cube parallèlement à une face donne un carré identique à cette face.",
   "t": "Brevet · Géométrie dans l'espace"
  },
  {
   "q": "Combien vaut 3/5 − 1/5 ?",
   "a": [
    "4/5",
    "2/10",
    "2/0",
    "2/5"
   ],
   "c": 3,
   "e": "Les dénominateurs sont égaux : 3/5 − 1/5 = 2/5.",
   "t": "Brevet · Fractions"
  },
  {
   "q": "Combien vaut 5² + 3² ?",
   "a": [
    "16",
    "64",
    "34",
    "28"
   ],
   "c": 2,
   "e": "5² = 25 et 3² = 9, donc 25 + 9 = 34.",
   "t": "Brevet · Puissances"
  },
  {
   "q": "Combien vaut −7 − 5 ?",
   "a": [
    "−12",
    "2",
    "12",
    "−2"
   ],
   "c": 0,
   "e": "−7 − 5 = −12 (on s'éloigne de zéro côté négatif).",
   "t": "Brevet · Nombres relatifs"
  },
  {
   "q": "Sur 30 élèves, 18 sont des filles. Quel pourcentage cela représente-t-il ?",
   "a": [
    "18 %",
    "60 %",
    "50 %",
    "40 %"
   ],
   "c": 1,
   "e": "18 ÷ 30 = 0,6 = 60 %.",
   "t": "Brevet · Pourcentages"
  },
  {
   "q": "Une urne contient 3 boules rouges et 2 boules bleues. La probabilité de tirer une boule rouge est :",
   "a": [
    "2/5",
    "3/2",
    "3/5",
    "1/5"
   ],
   "c": 2,
   "e": "Il y a 3 boules rouges sur 5 boules au total : 3/5.",
   "t": "Brevet · Probabilités"
  },
  {
   "q": "Un coureur parcourt 400 m en 50 s. Sa vitesse moyenne est :",
   "a": [
    "450 m/s",
    "20 000 m/s",
    "8 m/s",
    "0,125 m/s"
   ],
   "c": 2,
   "e": "v = 400 ÷ 50 = 8 m/s.",
   "t": "Brevet · Vitesse"
  },
  {
   "q": "Dans un script, l'instruction « répéter 10 fois » est :",
   "a": [
    "Une condition",
    "Une variable",
    "Une boucle",
    "Une opération"
   ],
   "c": 2,
   "e": "« Répéter … fois » est une boucle : elle exécute plusieurs fois les mêmes instructions.",
   "t": "Brevet · Boucles"
  },
  {
   "q": "Le bloc « répéter 4 fois [avancer de 100 ; tourner de 90°] » trace :",
   "a": [
    "Une ligne droite",
    "Un triangle",
    "Un carré",
    "Un cercle"
   ],
   "c": 2,
   "e": "4 côtés égaux et 4 angles de 90° : le lutin trace un carré.",
   "t": "Brevet · Scripts"
  },
  {
   "q": "Dans un programme, une variable sert à :",
   "a": [
    "Arrêter le programme",
    "Stocker une valeur qui peut changer",
    "Dessiner une figure",
    "Tourner le lutin"
   ],
   "c": 1,
   "e": "Une variable est une « case mémoire » qui stocke une valeur pouvant évoluer pendant l'exécution.",
   "t": "Brevet · Variables"
  },
  {
   "q": "L'instruction « si … alors … sinon … » correspond à :",
   "a": [
    "Un déplacement",
    "Une boucle",
    "Une variable",
    "Une instruction conditionnelle (test)"
   ],
   "c": 3,
   "e": "« Si … alors … sinon » est une instruction conditionnelle : elle exécute des actions différentes selon qu'une condition est vraie ou fausse.",
   "t": "Brevet · Conditions"
  },
  {
   "q": "Le bloc « répéter 3 fois [avancer de 50 ; tourner de 120°] » trace :",
   "a": [
    "Un hexagone",
    "Un triangle équilatéral",
    "Un carré",
    "Un cercle"
   ],
   "c": 1,
   "e": "3 côtés égaux et des rotations de 120° (= 360°/3) tracent un triangle équilatéral.",
   "t": "Brevet · Scripts"
  }
 ],
 "histoire": [
  {
   "q": "En quelle année débute la Première Guerre mondiale ?",
   "a": [
    "1918",
    "1914",
    "1939",
    "1870"
   ],
   "c": 1,
   "e": "La Première Guerre mondiale débute en 1914 et se termine en 1918.",
   "t": "Brevet · Première Guerre mondiale"
  },
  {
   "q": "À quelle date est signé l'armistice mettant fin aux combats de la Première Guerre mondiale ?",
   "a": [
    "11 novembre 1918",
    "28 juin 1919",
    "8 mai 1945",
    "14 juillet 1918"
   ],
   "c": 0,
   "e": "L'armistice est signé le 11 novembre 1918, date encore commémorée chaque année.",
   "t": "Brevet · Première Guerre mondiale"
  },
  {
   "q": "Comment appelle-t-on la guerre menée depuis des tranchées sur le front de l'Ouest ?",
   "a": [
    "La guerre éclair",
    "La guerre de position (de tranchées)",
    "La guerre de mouvement",
    "La guerre froide"
   ],
   "c": 1,
   "e": "À partir de fin 1914, le front se fige : c'est la guerre de position, menée dans les tranchées (ex : Verdun, 1916).",
   "t": "Brevet · Première Guerre mondiale"
  },
  {
   "q": "Quelle grande bataille de 1916 est devenue le symbole de la violence de la Première Guerre mondiale en France ?",
   "a": [
    "Verdun",
    "Waterloo",
    "Stalingrad",
    "Normandie"
   ],
   "c": 0,
   "e": "La bataille de Verdun (1916) symbolise l'enfer des tranchées et la violence de masse.",
   "t": "Brevet · Première Guerre mondiale"
  },
  {
   "q": "Le génocide perpétré contre un peuple par l'Empire ottoman pendant la Première Guerre mondiale est le génocide :",
   "a": [
    "Des Tziganes",
    "Des Arméniens",
    "Des Tutsis",
    "Des Juifs"
   ],
   "c": 1,
   "e": "Le génocide des Arméniens débute en 1915, durant la Première Guerre mondiale.",
   "t": "Brevet · Première Guerre mondiale"
  },
  {
   "q": "Quel traité, signé en 1919, met officiellement fin à la Première Guerre mondiale ?",
   "a": [
    "Le traité de Versailles",
    "Le traité de Vienne",
    "Le traité de Rome",
    "Le traité de Maastricht"
   ],
   "c": 0,
   "e": "Le traité de Versailles (1919) impose de lourdes conditions à l'Allemagne, jugée responsable de la guerre.",
   "t": "Brevet · Sortie de guerre"
  },
  {
   "q": "En 1917 éclate en Russie une révolution qui porte au pouvoir :",
   "a": [
    "Les fascistes",
    "Les royalistes",
    "Les bolcheviks (communistes)",
    "Les nazis"
   ],
   "c": 2,
   "e": "La révolution de 1917 amène les bolcheviks de Lénine au pouvoir, fondant le futur régime communiste soviétique.",
   "t": "Brevet · Révolution russe"
  },
  {
   "q": "Quel dirigeant est associé au régime totalitaire soviétique (URSS) dans les années 1930 ?",
   "a": [
    "Mussolini",
    "Lénine",
    "Staline",
    "Hitler"
   ],
   "c": 2,
   "e": "Staline dirige l'URSS et installe un régime totalitaire communiste (terreur, goulags, culte de la personnalité).",
   "t": "Brevet · Régimes totalitaires"
  },
  {
   "q": "Le régime fasciste italien est dirigé par :",
   "a": [
    "Hitler",
    "Staline",
    "Mussolini",
    "Franco"
   ],
   "c": 2,
   "e": "Mussolini installe le régime fasciste en Italie à partir des années 1920.",
   "t": "Brevet · Régimes totalitaires"
  },
  {
   "q": "En quelle année Hitler arrive-t-il au pouvoir en Allemagne ?",
   "a": [
    "1939",
    "1933",
    "1945",
    "1923"
   ],
   "c": 1,
   "e": "Hitler devient chancelier en 1933 et instaure rapidement une dictature nazie.",
   "t": "Brevet · Régimes totalitaires"
  },
  {
   "q": "Un régime totalitaire se caractérise par :",
   "a": [
    "Un parti unique contrôlant toute la société",
    "Des élections libres",
    "La liberté de la presse",
    "Le pluralisme des partis"
   ],
   "c": 0,
   "e": "Un régime totalitaire repose sur un parti unique, une idéologie imposée, la propagande, la police politique et la terreur.",
   "t": "Brevet · Régimes totalitaires"
  },
  {
   "q": "La Seconde Guerre mondiale débute en 1939 avec l'invasion par l'Allemagne de :",
   "a": [
    "Le Royaume-Uni",
    "La France",
    "La Pologne",
    "L'URSS"
   ],
   "c": 2,
   "e": "Le 1er septembre 1939, l'Allemagne envahit la Pologne, déclenchant la Seconde Guerre mondiale.",
   "t": "Brevet · Seconde Guerre mondiale"
  },
  {
   "q": "En quelle année se termine la Seconde Guerre mondiale ?",
   "a": [
    "1940",
    "1945",
    "1958",
    "1918"
   ],
   "c": 1,
   "e": "La guerre se termine en 1945 (8 mai en Europe, 2 septembre en Asie après la capitulation du Japon).",
   "t": "Brevet · Seconde Guerre mondiale"
  },
  {
   "q": "Le génocide des Juifs et des Tziganes pendant la Seconde Guerre mondiale est appelé :",
   "a": [
    "La Résistance",
    "Le Blitz",
    "La Shoah",
    "La Terreur"
   ],
   "c": 2,
   "e": "La Shoah désigne le génocide des Juifs d'Europe par les nazis ; les Tziganes ont aussi été victimes d'un génocide.",
   "t": "Brevet · Seconde Guerre mondiale"
  },
  {
   "q": "À quelle date a lieu le débarquement allié en Normandie ?",
   "a": [
    "6 juin 1944",
    "8 mai 1945",
    "11 novembre 1918",
    "18 juin 1940"
   ],
   "c": 0,
   "e": "Le débarquement de Normandie a lieu le 6 juin 1944 (D-Day), ouvrant un nouveau front à l'Ouest.",
   "t": "Brevet · Seconde Guerre mondiale"
  },
  {
   "q": "La première bombe atomique utilisée contre une ville est larguée en 1945 sur :",
   "a": [
    "Hiroshima",
    "Tokyo",
    "Pearl Harbor",
    "Berlin"
   ],
   "c": 0,
   "e": "Les États-Unis larguent une bombe atomique sur Hiroshima le 6 août 1945, puis sur Nagasaki.",
   "t": "Brevet · Seconde Guerre mondiale"
  },
  {
   "q": "Qui dirige le régime de Vichy, qui collabore avec l'Allemagne nazie ?",
   "a": [
    "Léon Blum",
    "Charles de Gaulle",
    "Georges Clemenceau",
    "Philippe Pétain"
   ],
   "c": 3,
   "e": "Le maréchal Pétain dirige le régime de Vichy (à partir de 1940) et collabore avec l'Allemagne nazie.",
   "t": "Brevet · La France pendant la guerre"
  },
  {
   "q": "Qui lance l'appel du 18 juin 1940 invitant les Français à résister ?",
   "a": [
    "Jean Moulin",
    "Charles de Gaulle",
    "Philippe Pétain",
    "Winston Churchill"
   ],
   "c": 1,
   "e": "Le général de Gaulle lance depuis Londres l'appel du 18 juin 1940, acte fondateur de la France libre.",
   "t": "Brevet · La France pendant la guerre"
  },
  {
   "q": "Jean Moulin est une grande figure :",
   "a": [
    "De l'armée allemande",
    "De la Résistance intérieure",
    "Du régime de Vichy",
    "De la collaboration"
   ],
   "c": 1,
   "e": "Jean Moulin unifie la Résistance intérieure française ; arrêté en 1943, il meurt sous la torture.",
   "t": "Brevet · La France pendant la guerre"
  },
  {
   "q": "En quelle année les femmes obtiennent-elles le droit de vote en France ?",
   "a": [
    "1975",
    "1944",
    "1848",
    "1981"
   ],
   "c": 1,
   "e": "Le droit de vote des femmes est instauré par une ordonnance de 1944 ; elles votent pour la première fois en 1945.",
   "t": "Brevet · La France après 1945"
  },
  {
   "q": "En quelle année est fondée la Ve République, toujours en vigueur aujourd'hui ?",
   "a": [
    "1958",
    "1945",
    "1981",
    "1969"
   ],
   "c": 0,
   "e": "La Ve République est instaurée en 1958, avec Charles de Gaulle comme premier président.",
   "t": "Brevet · La Ve République"
  },
  {
   "q": "La Guerre froide oppose principalement :",
   "a": [
    "L'Italie et l'Espagne",
    "La France et l'Allemagne",
    "Le Japon et la Chine",
    "Les États-Unis et l'URSS"
   ],
   "c": 3,
   "e": "La Guerre froide (1947-1991) oppose le bloc de l'Ouest (États-Unis) au bloc de l'Est (URSS), sans affrontement direct.",
   "t": "Brevet · Guerre froide"
  },
  {
   "q": "Le mur de Berlin, symbole de la division de l'Europe, tombe en :",
   "a": [
    "1989",
    "1961",
    "1991",
    "2002"
   ],
   "c": 0,
   "e": "Le mur de Berlin, construit en 1961, tombe le 9 novembre 1989, annonçant la fin de la Guerre froide.",
   "t": "Brevet · Guerre froide"
  },
  {
   "q": "En quelle année l'URSS disparaît-elle, marquant la fin de la Guerre froide ?",
   "a": [
    "1995",
    "1985",
    "1989",
    "1991"
   ],
   "c": 3,
   "e": "L'URSS est dissoute en 1991, ce qui met fin à la Guerre froide.",
   "t": "Brevet · Guerre froide"
  },
  {
   "q": "La guerre d'Algérie, qui aboutit à l'indépendance, se déroule de :",
   "a": [
    "1939 à 1945",
    "1914 à 1918",
    "1954 à 1962",
    "1962 à 1968"
   ],
   "c": 2,
   "e": "La guerre d'Algérie (1954-1962) se termine par l'indépendance de l'Algérie en 1962.",
   "t": "Brevet · Décolonisation"
  },
  {
   "q": "La décolonisation désigne :",
   "a": [
    "L'accès à l'indépendance des anciennes colonies",
    "L'union de l'Europe",
    "La création de l'ONU",
    "La conquête de nouvelles colonies"
   ],
   "c": 0,
   "e": "La décolonisation est le processus par lequel les colonies accèdent à l'indépendance (surtout après 1945).",
   "t": "Brevet · Décolonisation"
  },
  {
   "q": "Le traité de Rome (1957) crée :",
   "a": [
    "La CEE (Communauté économique européenne)",
    "L'ONU",
    "L'OTAN",
    "La SDN"
   ],
   "c": 0,
   "e": "Le traité de Rome de 1957 fonde la CEE, ancêtre de l'Union européenne.",
   "t": "Brevet · Construction européenne"
  },
  {
   "q": "Le traité de Maastricht (1992) donne naissance à :",
   "a": [
    "La Guerre froide",
    "L'Union européenne (UE)",
    "La CEE",
    "Le franc"
   ],
   "c": 1,
   "e": "Le traité de Maastricht (1992) crée l'Union européenne et prépare la monnaie unique.",
   "t": "Brevet · Construction européenne"
  },
  {
   "q": "En quelle année l'euro entre-t-il en circulation sous forme de pièces et billets ?",
   "a": [
    "2002",
    "1999",
    "2007",
    "1992"
   ],
   "c": 0,
   "e": "Les pièces et billets en euros sont mis en circulation le 1er janvier 2002.",
   "t": "Brevet · Construction européenne"
  },
  {
   "q": "La loi Veil de 1975 autorise en France :",
   "a": [
    "L'interruption volontaire de grossesse (IVG)",
    "Le divorce",
    "Le droit de vote des femmes",
    "La laïcité"
   ],
   "c": 0,
   "e": "La loi Veil (1975), portée par Simone Veil, légalise l'IVG en France.",
   "t": "Brevet · La société française"
  },
  {
   "q": "On qualifie la Première Guerre mondiale de « guerre totale » car :",
   "a": [
    "Elle dure seulement un an",
    "Elle mobilise toutes les ressources et la population des pays",
    "Elle ne concerne que les soldats",
    "Elle se limite à la France"
   ],
   "c": 1,
   "e": "La guerre totale mobilise l'économie, la société et les populations civiles (usines, propagande, rationnement) au service du conflit.",
   "t": "Brevet · Première Guerre mondiale"
  },
  {
   "q": "Les lieux où les nazis ont exterminé massivement les déportés sont appelés :",
   "a": [
    "Camps d'extermination",
    "Colonies",
    "Tranchées",
    "Camps de prisonniers"
   ],
   "c": 0,
   "e": "Les camps d'extermination (comme Auschwitz-Birkenau) étaient destinés au meurtre de masse, cœur de la Shoah.",
   "t": "Brevet · Seconde Guerre mondiale"
  },
  {
   "q": "L'expression « Trente Glorieuses » désigne :",
   "a": [
    "Une période de forte croissance économique (1945-1975)",
    "Une dictature",
    "Une crise économique",
    "Une période de guerre"
   ],
   "c": 0,
   "e": "Les Trente Glorieuses correspondent aux trois décennies de croissance et de progrès social après 1945.",
   "t": "Brevet · La France après 1945"
  },
  {
   "q": "Classe ces événements dans l'ordre chronologique : (1) Seconde Guerre mondiale, (2) Première Guerre mondiale, (3) chute du mur de Berlin.",
   "a": [
    "2 – 3 – 1",
    "3 – 2 – 1",
    "1 – 2 – 3",
    "2 – 1 – 3"
   ],
   "c": 3,
   "e": "Première Guerre (1914-1918), Seconde Guerre (1939-1945), chute du mur (1989) : ordre 2 – 1 – 3.",
   "t": "Brevet · Repères chronologiques"
  },
  {
   "q": "Dans un régime totalitaire, la propagande sert à :",
   "a": [
    "Informer librement les citoyens",
    "Imposer l'idéologie et contrôler les esprits",
    "Organiser des élections libres",
    "Garantir la liberté de la presse"
   ],
   "c": 1,
   "e": "La propagande diffuse l'idéologie du régime et façonne l'opinion ; elle s'accompagne de censure.",
   "t": "Brevet · Régimes totalitaires"
  },
  {
   "q": "On parle de « guerre d'anéantissement » pour la Seconde Guerre mondiale car :",
   "a": [
    "Elle se déroule uniquement en mer",
    "Elle ne fait pas de victimes civiles",
    "Elle vise à détruire totalement l'ennemi et des populations entières",
    "Elle est très courte"
   ],
   "c": 2,
   "e": "La guerre d'anéantissement vise la destruction de l'adversaire et l'extermination de populations (génocides, bombardements massifs).",
   "t": "Brevet · Seconde Guerre mondiale"
  },
  {
   "q": "Le premier président de la Ve République est :",
   "a": [
    "François Mitterrand",
    "Georges Pompidou",
    "Charles de Gaulle",
    "Jacques Chirac"
   ],
   "c": 2,
   "e": "Charles de Gaulle devient le premier président de la Ve République en 1958.",
   "t": "Brevet · La Ve République"
  },
  {
   "q": "Quelle est la devise de la République française ?",
   "a": [
    "Paix, Justice, Liberté",
    "Un pour tous, tous pour un",
    "Travail, Famille, Patrie",
    "Liberté, Égalité, Fraternité"
   ],
   "c": 3,
   "e": "La devise de la République française est « Liberté, Égalité, Fraternité ».",
   "t": "Brevet · Valeurs de la République"
  },
  {
   "q": "Quel est l'hymne national de la France ?",
   "a": [
    "God Save the King",
    "Le Chant des partisans",
    "L'Internationale",
    "La Marseillaise"
   ],
   "c": 3,
   "e": "La Marseillaise est l'hymne national français depuis la Révolution.",
   "t": "Brevet · Symboles de la République"
  },
  {
   "q": "Quelle est la date de la fête nationale française ?",
   "a": [
    "1er mai",
    "8 mai",
    "14 juillet",
    "11 novembre"
   ],
   "c": 2,
   "e": "La fête nationale est le 14 juillet, en référence à la prise de la Bastille (1789) et à la Fête de la Fédération (1790).",
   "t": "Brevet · Symboles de la République"
  },
  {
   "q": "Quelle figure féminine représente la République française ?",
   "a": [
    "Jeanne d'Arc",
    "Athéna",
    "Marianne",
    "La Liberté"
   ],
   "c": 2,
   "e": "Marianne est l'allégorie (la représentation symbolique) de la République française.",
   "t": "Brevet · Symboles de la République"
  },
  {
   "q": "Quelles sont les couleurs du drapeau français ?",
   "a": [
    "Rouge, blanc, vert",
    "Bleu, blanc, jaune",
    "Bleu, blanc, rouge",
    "Noir, rouge, or"
   ],
   "c": 2,
   "e": "Le drapeau tricolore français est bleu, blanc, rouge.",
   "t": "Brevet · Symboles de la République"
  },
  {
   "q": "La loi de séparation des Églises et de l'État, fondement de la laïcité, date de :",
   "a": [
    "1789",
    "1944",
    "1905",
    "1958"
   ],
   "c": 2,
   "e": "La loi de 1905 sépare les Églises et l'État et garantit la liberté de conscience : c'est le socle de la laïcité.",
   "t": "Brevet · Laïcité"
  },
  {
   "q": "La laïcité garantit :",
   "a": [
    "La liberté de croire ou de ne pas croire, et la neutralité de l'État",
    "L'obligation d'avoir une religion",
    "L'interdiction de toutes les religions",
    "Une religion officielle"
   ],
   "c": 0,
   "e": "La laïcité assure la liberté de conscience, l'égalité des citoyens et la neutralité de l'État vis-à-vis des religions.",
   "t": "Brevet · Laïcité"
  },
  {
   "q": "La Déclaration des droits de l'homme et du citoyen est adoptée en :",
   "a": [
    "1958",
    "1789",
    "1848",
    "1905"
   ],
   "c": 1,
   "e": "La Déclaration des droits de l'homme et du citoyen est adoptée en 1789, pendant la Révolution française.",
   "t": "Brevet · Droits de l'homme"
  },
  {
   "q": "En France, le pouvoir législatif (voter les lois) appartient :",
   "a": [
    "À l'armée",
    "Aux juges",
    "Au président de la République",
    "Au Parlement (Assemblée nationale et Sénat)"
   ],
   "c": 3,
   "e": "Le Parlement, composé de l'Assemblée nationale et du Sénat, détient le pouvoir législatif : il vote les lois.",
   "t": "Brevet · Institutions"
  },
  {
   "q": "Le pouvoir exécutif en France est exercé par :",
   "a": [
    "Les maires uniquement",
    "Le président de la République et le gouvernement",
    "Le Parlement",
    "Les tribunaux"
   ],
   "c": 1,
   "e": "Le pouvoir exécutif, qui applique les lois, est exercé par le président de la République et le gouvernement (Premier ministre).",
   "t": "Brevet · Institutions"
  },
  {
   "q": "Pour combien d'années le président de la République est-il élu ?",
   "a": [
    "3 ans",
    "5 ans",
    "10 ans",
    "7 ans"
   ],
   "c": 1,
   "e": "Depuis 2002, le président est élu pour 5 ans (quinquennat) au suffrage universel direct.",
   "t": "Brevet · Institutions"
  },
  {
   "q": "Le pouvoir judiciaire est chargé de :",
   "a": [
    "Faire appliquer les lois et juger",
    "Voter les lois",
    "Élire le président",
    "Diriger le gouvernement"
   ],
   "c": 0,
   "e": "Le pouvoir judiciaire, exercé par les juges et tribunaux, fait respecter les lois et tranche les litiges.",
   "t": "Brevet · Institutions"
  },
  {
   "q": "À quel âge devient-on majeur et électeur en France ?",
   "a": [
    "16 ans",
    "18 ans",
    "21 ans",
    "15 ans"
   ],
   "c": 1,
   "e": "La majorité, qui ouvre le droit de vote, est fixée à 18 ans en France.",
   "t": "Brevet · Citoyenneté"
  },
  {
   "q": "Voter est pour le citoyen :",
   "a": [
    "Un droit (et un devoir civique)",
    "Réservé aux élus",
    "Interdit avant 30 ans",
    "Une obligation sous peine de prison"
   ],
   "c": 0,
   "e": "Le vote est un droit du citoyen, considéré aussi comme un devoir civique ; il n'est pas obligatoire en France.",
   "t": "Brevet · Citoyenneté"
  },
  {
   "q": "La liberté d'expression permet :",
   "a": [
    "De diffuser de fausses informations sans risque",
    "D'exprimer ses opinions, dans le respect de la loi",
    "De dire tout sans aucune limite",
    "D'insulter librement autrui"
   ],
   "c": 1,
   "e": "La liberté d'expression permet d'exprimer ses opinions, mais elle est encadrée par la loi (interdiction de l'injure, de la diffamation, de l'incitation à la haine).",
   "t": "Brevet · Libertés"
  },
  {
   "q": "S'engager dans une association est une forme :",
   "a": [
    "D'activité interdite aux mineurs",
    "De sanction",
    "D'engagement citoyen",
    "D'obligation légale"
   ],
   "c": 2,
   "e": "L'engagement associatif est une forme d'engagement citoyen au service de l'intérêt général.",
   "t": "Brevet · Engagement"
  },
  {
   "q": "La Journée Défense et Citoyenneté (JDC) concerne :",
   "a": [
    "Les personnes de plus de 25 ans",
    "Tous les jeunes Français vers 17 ans",
    "Uniquement les militaires de carrière",
    "Seulement les garçons"
   ],
   "c": 1,
   "e": "La JDC est obligatoire pour tous les jeunes Français (filles et garçons) recensés, généralement vers 17 ans.",
   "t": "Brevet · Défense"
  },
  {
   "q": "Le principe d'égalité signifie que :",
   "a": [
    "Seuls certains ont des droits",
    "Tous les citoyens ont les mêmes droits devant la loi",
    "Tout le monde a le même salaire",
    "Personne ne peut voter"
   ],
   "c": 1,
   "e": "L'égalité garantit que tous les citoyens ont les mêmes droits et sont traités de la même façon devant la loi.",
   "t": "Brevet · Valeurs de la République"
  },
  {
   "q": "Pour vérifier une information trouvée sur Internet, il faut :",
   "a": [
    "La partager immédiatement",
    "Vérifier la source et la recouper avec d'autres",
    "Se fier au nombre de « j'aime »",
    "La croire si elle est partagée souvent"
   ],
   "c": 1,
   "e": "Une information fiable se vérifie en identifiant sa source et en la recoupant avec d'autres sources sérieuses.",
   "t": "Brevet · Médias et information"
  },
  {
   "q": "Les députés de l'Assemblée nationale sont élus :",
   "a": [
    "Par les juges",
    "Au suffrage universel direct par les citoyens",
    "À vie",
    "Par le président seul"
   ],
   "c": 1,
   "e": "Les députés sont élus au suffrage universel direct par les citoyens, pour 5 ans.",
   "t": "Brevet · Institutions"
  },
  {
   "q": "Un droit s'accompagne généralement :",
   "a": [
    "D'un privilège réservé à certains",
    "D'aucune contrepartie",
    "D'une récompense financière",
    "De devoirs (ex : respecter la loi, autrui)"
   ],
   "c": 3,
   "e": "La citoyenneté associe des droits (voter, s'exprimer) et des devoirs (respecter la loi, payer l'impôt, participer à la défense).",
   "t": "Brevet · Citoyenneté"
  },
  {
   "q": "Les soldats qui combattaient dans les tranchées étaient surnommés :",
   "a": [
    "Les partisans",
    "Les fédérés",
    "Les poilus",
    "Les sans-culottes"
   ],
   "c": 2,
   "e": "Les soldats français de la Première Guerre mondiale étaient surnommés « les poilus ».",
   "t": "Brevet · Première Guerre mondiale"
  },
  {
   "q": "La déportation des Juifs vers les camps depuis la France a notamment impliqué :",
   "a": [
    "Une protection par le régime de Vichy",
    "L'action de la Résistance",
    "Une collaboration de Vichy avec l'occupant nazi",
    "Aucune participation française"
   ],
   "c": 2,
   "e": "Le régime de Vichy a collaboré à la déportation des Juifs de France vers les camps nazis (ex : rafle du Vél d'Hiv, 1942).",
   "t": "Brevet · Seconde Guerre mondiale"
  },
  {
   "q": "La ville de Berlin est, pendant la Guerre froide, le symbole :",
   "a": [
    "De la décolonisation",
    "De l'unité européenne",
    "De la division entre les deux blocs",
    "De la paix mondiale"
   ],
   "c": 2,
   "e": "Berlin, divisée par un mur de 1961 à 1989, symbolise l'affrontement entre bloc de l'Est et bloc de l'Ouest.",
   "t": "Brevet · Guerre froide"
  },
  {
   "q": "Le principe de fraternité invite à :",
   "a": [
    "La solidarité et l'entraide entre les citoyens",
    "La compétition permanente",
    "L'indifférence envers les autres",
    "L'exclusion des étrangers"
   ],
   "c": 0,
   "e": "La fraternité repose sur la solidarité, l'entraide et le respect entre les membres de la société.",
   "t": "Brevet · Valeurs de la République"
  },
  {
   "q": "En France, une personne accusée est considérée comme :",
   "a": [
    "Coupable jusqu'à preuve du contraire",
    "Toujours coupable",
    "Innocente jusqu'à preuve de sa culpabilité",
    "Jugée sans procès"
   ],
   "c": 2,
   "e": "La présomption d'innocence garantit que toute personne est présumée innocente tant que sa culpabilité n'est pas prouvée.",
   "t": "Brevet · Justice"
  },
  {
   "q": "Une « fake news » (infox) est :",
   "a": [
    "Une information vérifiée",
    "Une fausse information diffusée comme vraie",
    "Un journal officiel",
    "Un article scientifique"
   ],
   "c": 1,
   "e": "Une infox (fake news) est une fausse information présentée comme vraie, qu'il faut savoir repérer et vérifier.",
   "t": "Brevet · Médias et information"
  },
  {
   "q": "L'ONU (Organisation des Nations unies) est créée en 1945 pour :",
   "a": [
    "Diriger l'Europe",
    "Coloniser l'Afrique",
    "Déclencher la guerre",
    "Maintenir la paix et la sécurité dans le monde"
   ],
   "c": 3,
   "e": "L'ONU, créée en 1945, a pour but principal de maintenir la paix et la sécurité internationales.",
   "t": "Brevet · La France après 1945"
  },
  {
   "q": "Quel événement est le plus ancien ?",
   "a": [
    "Débarquement de Normandie",
    "Traité de Maastricht",
    "Chute du mur de Berlin",
    "Armistice de la Première Guerre mondiale"
   ],
   "c": 3,
   "e": "Armistice (1918) précède le débarquement (1944), la chute du mur (1989) et Maastricht (1992).",
   "t": "Brevet · Repères chronologiques"
  },
  {
   "q": "Le recensement citoyen à 16 ans permet ensuite :",
   "a": [
    "De voter immédiatement",
    "De devenir militaire automatiquement",
    "D'être dispensé d'école",
    "D'être convoqué à la Journée Défense et Citoyenneté"
   ],
   "c": 3,
   "e": "Le recensement à 16 ans est obligatoire ; il permet d'être convoqué à la JDC et facilite l'inscription aux examens et au vote.",
   "t": "Brevet · Citoyenneté"
  },
  {
   "q": "À l'école publique en France, la laïcité implique :",
   "a": [
    "L'obligation d'une pratique religieuse",
    "La neutralité et le respect de toutes les convictions",
    "L'interdiction de toute opinion",
    "L'enseignement d'une religion"
   ],
   "c": 1,
   "e": "À l'école publique, la laïcité garantit la neutralité, le respect des convictions de chacun et la liberté de conscience.",
   "t": "Brevet · Laïcité"
  }
 ],
 "geographie": [
  {
   "q": "Quelle est la plus grande aire urbaine de France ?",
   "a": [
    "Lyon",
    "Lille",
    "Paris",
    "Marseille"
   ],
   "c": 2,
   "e": "Paris est de loin la plus grande aire urbaine française, concentrant plus de 10 millions d'habitants.",
   "t": "Brevet · Aires urbaines"
  },
  {
   "q": "Une aire urbaine est composée de :",
   "a": [
    "Ville-centre, banlieue et couronne périurbaine",
    "Uniquement la ville-centre",
    "Une seule commune",
    "Uniquement des campagnes"
   ],
   "c": 0,
   "e": "Une aire urbaine regroupe la ville-centre, sa banlieue et la couronne périurbaine dont les habitants travaillent dans le pôle urbain.",
   "t": "Brevet · Aires urbaines"
  },
  {
   "q": "La métropolisation désigne :",
   "a": [
    "La concentration des populations et activités dans les grandes villes",
    "La baisse de la population urbaine",
    "L'agriculture intensive",
    "Le départ des habitants vers les campagnes"
   ],
   "c": 0,
   "e": "La métropolisation est la concentration croissante des hommes, des activités et des fonctions de commandement dans les métropoles.",
   "t": "Brevet · Métropolisation"
  },
  {
   "q": "L'étalement des villes dans les espaces ruraux proches s'appelle :",
   "a": [
    "La périurbanisation",
    "La littoralisation",
    "La métropolisation inverse",
    "La désertification"
   ],
   "c": 0,
   "e": "La périurbanisation est l'extension de l'urbanisation autour des villes, sous forme de zones résidentielles et commerciales.",
   "t": "Brevet · Urbanisation"
  },
  {
   "q": "Un espace productif est :",
   "a": [
    "Un espace de loisirs",
    "Une zone protégée",
    "Une frontière",
    "Un espace où sont créées des richesses (agricole, industriel, de services)"
   ],
   "c": 3,
   "e": "Les espaces productifs sont les lieux d'activité économique : espaces agricoles, industriels et de services.",
   "t": "Brevet · Espaces productifs"
  },
  {
   "q": "Un espace de faible densité se caractérise par :",
   "a": [
    "Une très forte population au km²",
    "Peu d'habitants au km²",
    "Une métropole mondiale",
    "De nombreux gratte-ciels"
   ],
   "c": 1,
   "e": "Les espaces de faible densité (certaines campagnes, montagnes) comptent peu d'habitants au km².",
   "t": "Brevet · Espaces de faible densité"
  },
  {
   "q": "Parmi ces territoires, lequel est un département et région d'outre-mer (DROM) ?",
   "a": [
    "La Savoie",
    "La Bretagne",
    "La Corse",
    "La Réunion"
   ],
   "c": 3,
   "e": "La Réunion est un DROM, comme la Guadeloupe, la Martinique, la Guyane et Mayotte.",
   "t": "Brevet · France ultramarine"
  },
  {
   "q": "Les territoires ultramarins permettent à la France de posséder :",
   "a": [
    "Un vaste domaine maritime (ZEE) dans le monde entier",
    "Aucune ressource",
    "Une seule frontière terrestre",
    "Le plus petit territoire du monde"
   ],
   "c": 0,
   "e": "Grâce à l'outre-mer, la France dispose de la 2e zone économique exclusive (ZEE) maritime au monde.",
   "t": "Brevet · France ultramarine"
  },
  {
   "q": "La mondialisation désigne :",
   "a": [
    "La disparition des frontières d'État",
    "La fin du commerce",
    "La mise en relation des territoires du monde par les échanges",
    "L'isolement des pays"
   ],
   "c": 2,
   "e": "La mondialisation est la mise en relation croissante des territoires par les flux de marchandises, de personnes, d'argent et d'informations.",
   "t": "Brevet · Mondialisation"
  },
  {
   "q": "Une grande partie du commerce mondial de marchandises se fait par :",
   "a": [
    "Train uniquement",
    "Avion",
    "Pipeline",
    "Voie maritime (porte-conteneurs)"
   ],
   "c": 3,
   "e": "L'essentiel du commerce mondial de marchandises transite par voie maritime, notamment via les porte-conteneurs.",
   "t": "Brevet · Mers et océans"
  },
  {
   "q": "La France est membre de l'Union européenne, qui compte aujourd'hui :",
   "a": [
    "12 pays",
    "50 pays",
    "6 pays",
    "27 pays"
   ],
   "c": 3,
   "e": "Depuis le retrait du Royaume-Uni (Brexit), l'Union européenne compte 27 États membres.",
   "t": "Brevet · France et UE"
  },
  {
   "q": "L'aménagement du territoire vise à :",
   "a": [
    "Concentrer toute l'activité à Paris",
    "Supprimer les transports",
    "Organiser l'espace pour réduire les inégalités et développer les territoires",
    "Augmenter les inégalités entre régions"
   ],
   "c": 2,
   "e": "L'aménagement du territoire cherche à mieux répartir activités, équipements et services pour un développement plus équilibré.",
   "t": "Brevet · Aménagement du territoire"
  },
  {
   "q": "Une activité de services (tertiaire) est par exemple :",
   "a": [
    "L'extraction de charbon",
    "Le commerce ou le tourisme",
    "La fabrication de voitures",
    "La culture du blé"
   ],
   "c": 1,
   "e": "Le secteur des services (tertiaire) regroupe commerce, tourisme, santé, éducation, banque, etc.",
   "t": "Brevet · Espaces productifs"
  },
  {
   "q": "Les fonctions de commandement (sièges sociaux, finance, recherche) se concentrent surtout dans :",
   "a": [
    "Les espaces ruraux isolés",
    "Les déserts",
    "Les zones de montagne",
    "Les métropoles"
   ],
   "c": 3,
   "e": "Les métropoles concentrent les fonctions de commandement économiques, politiques et culturelles.",
   "t": "Brevet · Métropolisation"
  },
  {
   "q": "L'espace Schengen permet :",
   "a": [
    "La suppression de l'euro",
    "La libre circulation des personnes entre pays membres",
    "La fermeture totale des frontières",
    "L'interdiction du commerce"
   ],
   "c": 1,
   "e": "L'espace Schengen autorise la libre circulation des personnes entre les pays membres, sans contrôle aux frontières intérieures.",
   "t": "Brevet · France et Europe"
  },
  {
   "q": "Aujourd'hui, en France, la majorité de la population vit :",
   "a": [
    "En montagne",
    "Sur les îles",
    "Dans les espaces ruraux",
    "Dans les aires urbaines"
   ],
   "c": 3,
   "e": "La grande majorité des Français vit dans les aires urbaines (plus de 8 habitants sur 10).",
   "t": "Brevet · Urbanisation"
  },
  {
   "q": "Une firme transnationale (FTN) est une entreprise qui :",
   "a": [
    "N'existe que dans un seul pays",
    "Exerce ses activités dans plusieurs pays",
    "Appartient à l'État uniquement",
    "Ne fait pas de commerce"
   ],
   "c": 1,
   "e": "Une FTN possède des activités et des implantations dans plusieurs pays : elle est un acteur majeur de la mondialisation.",
   "t": "Brevet · Mondialisation"
  },
  {
   "q": "Les acteurs de l'aménagement du territoire en France sont notamment :",
   "a": [
    "Seulement les entreprises étrangères",
    "L'État, les collectivités territoriales et l'Union européenne",
    "L'armée seule",
    "Uniquement les particuliers"
   ],
   "c": 1,
   "e": "L'aménagement associe l'État, les collectivités (régions, départements, communes) et l'Union européenne.",
   "t": "Brevet · Aménagement du territoire"
  },
  {
   "q": "La monnaie unique partagée par de nombreux pays de l'UE est :",
   "a": [
    "Le franc",
    "L'euro",
    "Le dollar",
    "La livre"
   ],
   "c": 1,
   "e": "L'euro est la monnaie unique de la zone euro, utilisée par une majorité de pays de l'UE.",
   "t": "Brevet · France et UE"
  }
 ],
 "svt": [
  {
   "q": "Où est localisée la quasi-totalité de l'information génétique dans une cellule ?",
   "a": [
    "Dans la paroi",
    "Dans la membrane plasmique",
    "Dans le noyau",
    "Dans le cytoplasme"
   ],
   "c": 2,
   "e": "L'information génétique est portée par les chromosomes, situés dans le noyau de la cellule.",
   "t": "Brevet · Information génétique"
  },
  {
   "q": "Les chromosomes sont constitués d'une molécule appelée :",
   "a": [
    "ATP",
    "ARN messager",
    "Glucose",
    "ADN"
   ],
   "c": 3,
   "e": "Les chromosomes sont constitués d'ADN (acide désoxyribonucléique), support de l'information génétique.",
   "t": "Brevet · Information génétique"
  },
  {
   "q": "Combien de chromosomes possède une cellule humaine (hors cellules reproductrices) ?",
   "a": [
    "92",
    "23",
    "46",
    "47"
   ],
   "c": 2,
   "e": "Une cellule humaine contient 46 chromosomes, soit 23 paires.",
   "t": "Brevet · Information génétique"
  },
  {
   "q": "Un gène est :",
   "a": [
    "Un chromosome entier",
    "Une portion d'ADN porteuse d'une information",
    "Une protéine",
    "Une cellule reproductrice"
   ],
   "c": 1,
   "e": "Un gène est une portion de la molécule d'ADN qui porte une information génétique précise.",
   "t": "Brevet · Information génétique"
  },
  {
   "q": "Les différentes versions d'un même gène sont appelées :",
   "a": [
    "Des gamètes",
    "Des allèles",
    "Des chromosomes",
    "Des mutations"
   ],
   "c": 1,
   "e": "Les allèles sont les versions différentes d'un même gène (ex : allèle « yeux bleus » et allèle « yeux marron »).",
   "t": "Brevet · Information génétique"
  },
  {
   "q": "Une mutation est :",
   "a": [
    "Le passage à l'âge adulte",
    "La fusion de deux gamètes",
    "Une modification de la séquence de l'ADN",
    "Une division cellulaire"
   ],
   "c": 2,
   "e": "Une mutation est une modification de la séquence de l'ADN ; elle peut créer un nouvel allèle.",
   "t": "Brevet · Mutations"
  },
  {
   "q": "Les cellules reproductrices (gamètes) chez l'être humain sont :",
   "a": [
    "Deux cellules-œufs",
    "Le noyau et le cytoplasme",
    "Le spermatozoïde et l'ovule",
    "L'embryon et le fœtus"
   ],
   "c": 2,
   "e": "Le gamète mâle est le spermatozoïde, le gamète femelle est l'ovule.",
   "t": "Brevet · Reproduction sexuée"
  },
  {
   "q": "La fécondation correspond à :",
   "a": [
    "La division d'une cellule",
    "L'implantation dans l'utérus",
    "La production de gamètes",
    "La fusion d'un spermatozoïde et d'un ovule"
   ],
   "c": 3,
   "e": "La fécondation est la fusion d'un gamète mâle et d'un gamète femelle, formant une cellule-œuf.",
   "t": "Brevet · Reproduction sexuée"
  },
  {
   "q": "Combien de chromosomes possède un gamète humain ?",
   "a": [
    "46",
    "47",
    "92",
    "23"
   ],
   "c": 3,
   "e": "Un gamète contient 23 chromosomes ; la fécondation rétablit les 46 chromosomes de la cellule-œuf.",
   "t": "Brevet · Reproduction sexuée"
  },
  {
   "q": "Pourquoi les enfants d'une même famille ne sont-ils pas identiques (hors vrais jumeaux) ?",
   "a": [
    "Parce qu'ils n'ont pas les mêmes gènes",
    "À cause de mutations systématiques",
    "À cause de l'alimentation",
    "Parce que chaque gamète reçoit une combinaison unique de chromosomes"
   ],
   "c": 3,
   "e": "Lors de la reproduction sexuée, chaque gamète reçoit une combinaison aléatoire de chromosomes : chaque cellule-œuf est unique.",
   "t": "Brevet · Reproduction sexuée"
  },
  {
   "q": "Les individus issus de reproduction asexuée (bouturage, clonage) sont :",
   "a": [
    "Des clones génétiquement identiques au parent",
    "Issus de deux parents",
    "Génétiquement différents du parent",
    "Stériles"
   ],
   "c": 0,
   "e": "La reproduction asexuée ne fait pas intervenir de gamètes : les descendants sont des clones identiques au parent.",
   "t": "Brevet · Reproduction asexuée"
  },
  {
   "q": "Un facteur du milieu pouvant influencer la reproduction des êtres vivants est :",
   "a": [
    "La température",
    "La couleur des yeux",
    "Le groupe sanguin",
    "Le nombre de chromosomes"
   ],
   "c": 0,
   "e": "Des facteurs comme la température, la lumière ou la disponibilité en nourriture influencent la reproduction (période, réussite).",
   "t": "Brevet · Reproduction et milieu"
  },
  {
   "q": "Parmi ces caractères, lequel n'est PAS héréditaire ?",
   "a": [
    "Le groupe sanguin",
    "La couleur naturelle des cheveux",
    "La couleur des yeux",
    "Une cicatrice"
   ],
   "c": 3,
   "e": "Une cicatrice résulte de l'environnement (blessure) et n'est pas transmise par les gènes.",
   "t": "Brevet · Caractères héréditaires"
  },
  {
   "q": "Le bronzage de la peau est un caractère :",
   "a": [
    "Influencé par l'environnement (exposition au soleil)",
    "Uniquement héréditaire",
    "Dû à une mutation",
    "Transmis aux descendants"
   ],
   "c": 0,
   "e": "Le bronzage dépend de l'exposition au soleil : c'est l'environnement qui agit sur un caractère.",
   "t": "Brevet · Caractères"
  },
  {
   "q": "La biodiversité désigne :",
   "a": [
    "Le nombre d'individus d'une seule espèce",
    "La diversité des roches",
    "La diversité des espèces, des gènes et des écosystèmes",
    "Le nombre de chromosomes d'une espèce"
   ],
   "c": 2,
   "e": "La biodiversité regroupe la diversité des écosystèmes, des espèces et la diversité génétique au sein des espèces.",
   "t": "Brevet · Évolution"
  },
  {
   "q": "La sélection naturelle favorise :",
   "a": [
    "Les individus les mieux adaptés à leur milieu",
    "Les individus les plus jeunes",
    "Les individus les plus gros",
    "Les individus mutants"
   ],
   "c": 0,
   "e": "Les individus possédant des caractères avantageux dans un milieu survivent et se reproduisent mieux : ils transmettent ces caractères.",
   "t": "Brevet · Évolution"
  },
  {
   "q": "Deux espèces qui possèdent un ancêtre commun récent :",
   "a": [
    "Sont forcément de la même taille",
    "Vivent forcément dans le même milieu",
    "N'ont aucun point commun",
    "Partagent de nombreux caractères"
   ],
   "c": 3,
   "e": "Plus l'ancêtre commun est récent, plus les espèces partagent de caractères hérités de cet ancêtre.",
   "t": "Brevet · Évolution"
  },
  {
   "q": "Un fossile est :",
   "a": [
    "Une trace ou un reste d'un être vivant ancien conservé dans les roches",
    "Une cellule reproductrice",
    "Un être vivant actuel",
    "Un type de chromosome"
   ],
   "c": 0,
   "e": "Les fossiles sont des restes ou empreintes d'organismes anciens conservés dans les roches sédimentaires ; ils témoignent de l'évolution.",
   "t": "Brevet · Fossiles"
  },
  {
   "q": "Dans la classification actuelle, on regroupe les êtres vivants selon :",
   "a": [
    "Leur ordre alphabétique",
    "Leur taille",
    "Les attributs (caractères) qu'ils partagent",
    "Leur milieu de vie"
   ],
   "c": 2,
   "e": "La classification emboîtée regroupe les espèces selon les caractères qu'elles possèdent en commun.",
   "t": "Brevet · Classification"
  },
  {
   "q": "La disparition des dinosaures non-aviens il y a 66 millions d'années est un exemple de :",
   "a": [
    "Mutation génétique",
    "Crise biologique (extinction massive)",
    "Reproduction asexuée",
    "Sélection naturelle"
   ],
   "c": 1,
   "e": "Une crise biologique correspond à la disparition rapide d'un grand nombre d'espèces.",
   "t": "Brevet · Crises biologiques"
  },
  {
   "q": "Toutes les cellules d'un même individu possèdent la même information génétique.",
   "a": [
    "Vrai",
    "Faux"
   ],
   "c": 0,
   "e": "Toutes les cellules d'un individu (sauf les gamètes) proviennent de la cellule-œuf et possèdent le même ADN.",
   "t": "Brevet · Information génétique"
  },
  {
   "q": "Le sexe d'un individu humain est déterminé par :",
   "a": [
    "Le groupe sanguin",
    "L'alimentation de la mère",
    "Le nombre total de chromosomes",
    "Les chromosomes X et Y"
   ],
   "c": 3,
   "e": "Une paire XX donne une fille, une paire XY donne un garçon. C'est le spermatozoïde qui apporte le X ou le Y.",
   "t": "Brevet · Information génétique"
  },
  {
   "q": "La cellule-œuf (zygote) est :",
   "a": [
    "La première cellule d'un nouvel individu",
    "Un clone du père",
    "Un gamète",
    "Une cellule du sang"
   ],
   "c": 0,
   "e": "La cellule-œuf résulte de la fécondation : c'est la première cellule du nouvel individu, qui se divise ensuite.",
   "t": "Brevet · Reproduction sexuée"
  },
  {
   "q": "L'apparition d'une résistance aux antibiotiques chez des bactéries s'explique par :",
   "a": [
    "La volonté des bactéries",
    "L'absence de reproduction",
    "Un changement de température",
    "La sélection des bactéries mutantes résistantes"
   ],
   "c": 3,
   "e": "Des bactéries mutantes résistantes survivent à l'antibiotique et se multiplient : c'est la sélection naturelle.",
   "t": "Brevet · Évolution"
  },
  {
   "q": "Les vrais jumeaux (monozygotes) sont génétiquement :",
   "a": [
    "Différents",
    "Sans information génétique",
    "Identiques",
    "De sexes différents"
   ],
   "c": 2,
   "e": "Les vrais jumeaux proviennent d'une même cellule-œuf : ils ont la même information génétique.",
   "t": "Brevet · Information génétique"
  },
  {
   "q": "Au cours des temps géologiques, les espèces :",
   "a": [
    "Apparaissent, se transforment et disparaissent",
    "Ne disparaissent jamais",
    "Sont toutes apparues en même temps",
    "Restent toujours identiques"
   ],
   "c": 0,
   "e": "L'histoire de la vie montre une succession d'apparitions, de transformations et de disparitions d'espèces.",
   "t": "Brevet · Évolution"
  },
  {
   "q": "Une paire de chromosomes est constituée de :",
   "a": [
    "Un chromosome venant du père et un de la mère",
    "Deux gamètes",
    "Deux chromosomes identiques de l'individu",
    "Deux gènes"
   ],
   "c": 0,
   "e": "Dans chaque paire, un chromosome provient du père (gamète mâle) et l'autre de la mère (gamète femelle).",
   "t": "Brevet · Information génétique"
  },
  {
   "q": "La taille d'un individu dépend :",
   "a": [
    "Uniquement de l'alimentation",
    "À la fois des gènes et de l'environnement",
    "Uniquement des gènes",
    "Du groupe sanguin"
   ],
   "c": 1,
   "e": "De nombreux caractères, comme la taille, résultent de l'interaction entre le patrimoine génétique et l'environnement.",
   "t": "Brevet · Caractères"
  },
  {
   "q": "L'organe qui reçoit et traite les informations nerveuses est :",
   "a": [
    "Le poumon",
    "Le cœur",
    "Le cerveau",
    "L'estomac"
   ],
   "c": 2,
   "e": "Le cerveau (centre nerveux) reçoit, traite les messages nerveux et commande les réponses.",
   "t": "Brevet · Système nerveux"
  },
  {
   "q": "La cellule de base du système nerveux est :",
   "a": [
    "Le gamète",
    "Le neurone",
    "Le muscle",
    "Le globule rouge"
   ],
   "c": 1,
   "e": "Le neurone est la cellule nerveuse qui transmet le message nerveux sous forme de signal.",
   "t": "Brevet · Système nerveux"
  },
  {
   "q": "Les organes qui captent les informations de l'environnement (lumière, son…) sont :",
   "a": [
    "Les os",
    "Les muscles",
    "Les organes des sens (récepteurs sensoriels)",
    "Les nerfs moteurs"
   ],
   "c": 2,
   "e": "Les récepteurs sensoriels (œil, oreille, peau…) captent les stimulations et génèrent des messages nerveux sensitifs.",
   "t": "Brevet · Système nerveux"
  },
  {
   "q": "Le trajet d'un message nerveux lors d'un mouvement volontaire est :",
   "a": [
    "Cerveau → récepteur → muscle",
    "Muscle → cerveau → nerf",
    "Muscle → récepteur → cerveau",
    "Récepteur → nerf sensitif → cerveau → nerf moteur → muscle"
   ],
   "c": 3,
   "e": "L'information part du récepteur, remonte au cerveau via un nerf sensitif, puis le cerveau commande le muscle via un nerf moteur.",
   "t": "Brevet · Système nerveux"
  },
  {
   "q": "Parmi ces comportements, lequel peut perturber le fonctionnement du cerveau ?",
   "a": [
    "Boire de l'eau",
    "Dormir suffisamment",
    "Faire du sport",
    "Consommer des drogues ou de l'alcool"
   ],
   "c": 3,
   "e": "L'alcool et les drogues modifient la transmission des messages nerveux et perturbent le cerveau.",
   "t": "Brevet · Système nerveux"
  },
  {
   "q": "Lors d'un effort physique, la fréquence cardiaque :",
   "a": [
    "S'arrête",
    "Augmente",
    "Ne change pas",
    "Diminue"
   ],
   "c": 1,
   "e": "À l'effort, le cœur bat plus vite pour apporter davantage de dioxygène et de nutriments aux muscles.",
   "t": "Brevet · Activité physique"
  },
  {
   "q": "Le mouvement d'un membre est possible grâce à :",
   "a": [
    "Les nerfs uniquement",
    "Le sang uniquement",
    "Les muscles, les os et les articulations",
    "Les os seuls"
   ],
   "c": 2,
   "e": "Le mouvement nécessite la contraction des muscles reliés aux os par les tendons, autour d'une articulation.",
   "t": "Brevet · Activité physique"
  },
  {
   "q": "La digestion permet de :",
   "a": [
    "Transformer les aliments en nutriments",
    "Éliminer le dioxyde de carbone",
    "Fabriquer du sang",
    "Produire des hormones"
   ],
   "c": 0,
   "e": "La digestion transforme les aliments en nutriments, petites molécules absorbables par le sang.",
   "t": "Brevet · Nutrition"
  },
  {
   "q": "Le passage des nutriments du tube digestif vers le sang s'appelle :",
   "a": [
    "L'absorption",
    "La digestion",
    "La respiration",
    "L'excrétion"
   ],
   "c": 0,
   "e": "L'absorption intestinale fait passer les nutriments à travers la paroi de l'intestin grêle vers le sang.",
   "t": "Brevet · Nutrition"
  },
  {
   "q": "Les organes assurent leur fonctionnement grâce à un apport de :",
   "a": [
    "Dioxygène et nutriments",
    "Déchets",
    "Hormones uniquement",
    "Dioxyde de carbone uniquement"
   ],
   "c": 0,
   "e": "Le sang apporte aux organes le dioxygène (issu de la respiration) et les nutriments (issus de la digestion).",
   "t": "Brevet · Nutrition"
  },
  {
   "q": "Parmi ces micro-organismes, lequel est le plus petit et n'est pas une cellule ?",
   "a": [
    "Une bactérie",
    "Une levure",
    "Un champignon",
    "Un virus"
   ],
   "c": 3,
   "e": "Le virus n'est pas une cellule : il est plus petit qu'une bactérie et a besoin d'une cellule-hôte pour se multiplier.",
   "t": "Brevet · Microorganismes"
  },
  {
   "q": "La pénétration d'un micro-organisme dans l'organisme s'appelle :",
   "a": [
    "L'infection",
    "La contamination",
    "La vaccination",
    "La phagocytose"
   ],
   "c": 1,
   "e": "La contamination est l'entrée du micro-organisme dans le corps ; l'infection est sa multiplication ensuite.",
   "t": "Brevet · Microorganismes"
  },
  {
   "q": "Les cellules immunitaires qui ingèrent et détruisent les microbes par phagocytose sont :",
   "a": [
    "Les phagocytes (un type de globules blancs)",
    "Les plaquettes",
    "Les neurones",
    "Les globules rouges"
   ],
   "c": 0,
   "e": "Les phagocytes, un type de globules blancs, englobent et digèrent les micro-organismes : c'est la phagocytose.",
   "t": "Brevet · Système immunitaire"
  },
  {
   "q": "Les anticorps sont produits par :",
   "a": [
    "Les globules rouges",
    "Les plaquettes",
    "Les phagocytes",
    "Les lymphocytes B"
   ],
   "c": 3,
   "e": "Les lymphocytes B produisent des anticorps spécifiques qui neutralisent un antigène précis.",
   "t": "Brevet · Système immunitaire"
  },
  {
   "q": "Un anticorps agit :",
   "a": [
    "De façon spécifique contre un seul antigène",
    "En produisant des hormones",
    "Contre n'importe quel microbe",
    "En digérant les aliments"
   ],
   "c": 0,
   "e": "Chaque anticorps est spécifique : il ne reconnaît et neutralise qu'un seul type d'antigène.",
   "t": "Brevet · Système immunitaire"
  },
  {
   "q": "La vaccination permet :",
   "a": [
    "De guérir une maladie déjà déclarée",
    "De tuer tous les microbes du corps",
    "D'apporter des antibiotiques",
    "De préparer l'organisme à se défendre avant l'infection"
   ],
   "c": 3,
   "e": "Le vaccin déclenche une réponse immunitaire et crée une mémoire : l'organisme réagira vite lors d'un futur contact.",
   "t": "Brevet · Vaccination"
  },
  {
   "q": "Les antibiotiques sont efficaces contre :",
   "a": [
    "Les cellules cancéreuses",
    "Les bactéries",
    "Les virus",
    "Tous les micro-organismes"
   ],
   "c": 1,
   "e": "Les antibiotiques agissent contre les bactéries, pas contre les virus.",
   "t": "Brevet · Antibiotiques"
  },
  {
   "q": "La puberté correspond à :",
   "a": [
    "L'ensemble des transformations rendant le corps apte à se reproduire",
    "La fin de la vie reproductrice",
    "La fabrication des hormones digestives",
    "La période de l'enfance"
   ],
   "c": 0,
   "e": "La puberté est l'ensemble des transformations physiques qui rendent l'organisme capable de se reproduire.",
   "t": "Brevet · Reproduction et sexualité"
  },
  {
   "q": "Les transformations de la puberté sont déclenchées par :",
   "a": [
    "Des anticorps",
    "Des nutriments",
    "Des nerfs",
    "Des hormones"
   ],
   "c": 3,
   "e": "Les hormones, transportées par le sang, déclenchent et contrôlent les transformations de la puberté.",
   "t": "Brevet · Reproduction et sexualité"
  },
  {
   "q": "Une méthode de contraception qui protège aussi des IST est :",
   "a": [
    "Le préservatif",
    "L'implant",
    "Le stérilet",
    "La pilule"
   ],
   "c": 0,
   "e": "Le préservatif est la seule méthode qui empêche à la fois la grossesse et la transmission des IST.",
   "t": "Brevet · Reproduction et sexualité"
  },
  {
   "q": "IST signifie :",
   "a": [
    "Infection Sexuellement Transmissible",
    "Information Scientifique Technique",
    "Immunité Spécifique Transmise",
    "Insuffisance Sanguine Totale"
   ],
   "c": 0,
   "e": "Une Infection Sexuellement Transmissible se transmet lors de rapports sexuels (ex : VIH, chlamydia).",
   "t": "Brevet · Reproduction et sexualité"
  },
  {
   "q": "La nidation correspond à :",
   "a": [
    "La fécondation",
    "L'implantation de l'embryon dans la paroi de l'utérus",
    "La naissance",
    "La production d'ovules"
   ],
   "c": 1,
   "e": "La nidation est l'installation de l'embryon dans la muqueuse utérine, où il poursuit son développement.",
   "t": "Brevet · Reproduction et sexualité"
  },
  {
   "q": "Le manque de sommeil peut diminuer les capacités de concentration et de mémorisation.",
   "a": [
    "Vrai",
    "Faux"
   ],
   "c": 0,
   "e": "Le sommeil est nécessaire au bon fonctionnement du cerveau, notamment pour la mémoire et l'attention.",
   "t": "Brevet · Système nerveux"
  },
  {
   "q": "Lors de la respiration cellulaire, les organes consomment :",
   "a": [
    "Uniquement de l'eau",
    "Du dioxygène et des nutriments, et rejettent du dioxyde de carbone",
    "Du dioxyde de carbone et rejettent du dioxygène",
    "Des anticorps"
   ],
   "c": 1,
   "e": "Les organes utilisent dioxygène et nutriments pour produire de l'énergie, et rejettent du dioxyde de carbone.",
   "t": "Brevet · Nutrition"
  },
  {
   "q": "La réaction immunitaire rapide et non spécifique est :",
   "a": [
    "La production d'anticorps",
    "La phagocytose",
    "La nidation",
    "La vaccination"
   ],
   "c": 1,
   "e": "La phagocytose est une réponse immédiate et non spécifique ; la production d'anticorps est plus lente et spécifique.",
   "t": "Brevet · Système immunitaire"
  },
  {
   "q": "Une barrière naturelle qui empêche l'entrée des microbes est :",
   "a": [
    "La peau",
    "Le sang",
    "Le cœur",
    "Le cerveau"
   ],
   "c": 0,
   "e": "La peau et les muqueuses constituent des barrières naturelles limitant l'entrée des micro-organismes.",
   "t": "Brevet · Microorganismes"
  },
  {
   "q": "Chez la femme, l'ovulation correspond à :",
   "a": [
    "Les règles",
    "La libération d'un ovule par un ovaire",
    "La fécondation",
    "La production de spermatozoïdes"
   ],
   "c": 1,
   "e": "L'ovulation est la libération d'un ovule par un ovaire, environ au milieu du cycle.",
   "t": "Brevet · Reproduction et sexualité"
  },
  {
   "q": "Pendant un effort, la fréquence respiratoire augmente afin de :",
   "a": [
    "Produire des hormones",
    "Apporter plus de dioxygène à l'organisme",
    "Éliminer les anticorps",
    "Refroidir le corps"
   ],
   "c": 1,
   "e": "Respirer plus vite et plus profondément permet d'apporter davantage de dioxygène aux muscles en activité.",
   "t": "Brevet · Activité physique"
  },
  {
   "q": "Le VIH est un virus qui s'attaque :",
   "a": [
    "Aux muscles",
    "Aux cellules du système immunitaire",
    "Aux neurones",
    "Aux globules rouges"
   ],
   "c": 1,
   "e": "Le VIH infecte et détruit des cellules immunitaires, affaiblissant les défenses de l'organisme (SIDA).",
   "t": "Brevet · Système immunitaire"
  },
  {
   "q": "Pour préserver sa santé, il est recommandé :",
   "a": [
    "De rester sédentaire",
    "De manger équilibré, dormir et faire de l'activité physique",
    "De sauter des repas",
    "De réduire son sommeil"
   ],
   "c": 1,
   "e": "Une alimentation équilibrée, un sommeil suffisant et une activité physique régulière contribuent à la santé.",
   "t": "Brevet · Hygiène de vie"
  },
  {
   "q": "La couche externe rigide de la Terre, découpée en plaques, s'appelle :",
   "a": [
    "La lithosphère",
    "Le noyau",
    "Le manteau profond",
    "L'atmosphère"
   ],
   "c": 0,
   "e": "La lithosphère est la couche rigide externe ; elle est découpée en plaques lithosphériques mobiles.",
   "t": "Brevet · Structure de la Terre"
  },
  {
   "q": "Un séisme est provoqué par :",
   "a": [
    "La rupture brutale de roches en profondeur",
    "La pluie",
    "La marée",
    "Le vent"
   ],
   "c": 0,
   "e": "Un séisme résulte de la rupture brutale de roches soumises à des contraintes ; l'énergie libérée se propage en ondes sismiques.",
   "t": "Brevet · Séismes"
  },
  {
   "q": "Le point en profondeur où démarre un séisme s'appelle :",
   "a": [
    "L'épicentre",
    "Le foyer (ou hypocentre)",
    "La faille",
    "Le cratère"
   ],
   "c": 1,
   "e": "Le foyer (hypocentre) est le lieu de rupture en profondeur ; l'épicentre est le point situé à la surface, à la verticale du foyer.",
   "t": "Brevet · Séismes"
  },
  {
   "q": "Le magma qui sort à la surface lors d'une éruption s'appelle :",
   "a": [
    "La cendre",
    "La lave",
    "La faille",
    "Le cratère"
   ],
   "c": 1,
   "e": "Le magma devient lave lorsqu'il atteint la surface lors d'une éruption volcanique.",
   "t": "Brevet · Volcanisme"
  },
  {
   "q": "Une éruption explosive est caractéristique d'un volcan dont la lave est :",
   "a": [
    "Très fluide",
    "Liquide comme de l'eau",
    "Très visqueuse",
    "Froide"
   ],
   "c": 2,
   "e": "Une lave visqueuse piège les gaz qui s'échappent violemment : l'éruption est explosive (nuées ardentes, projections).",
   "t": "Brevet · Volcanisme"
  },
  {
   "q": "Les plaques lithosphériques :",
   "a": [
    "Se déplacent de quelques centimètres par an",
    "Sont immobiles",
    "Ont disparu",
    "Se déplacent de plusieurs mètres par jour"
   ],
   "c": 0,
   "e": "Les plaques se déplacent lentement, de l'ordre de quelques centimètres par an.",
   "t": "Brevet · Tectonique des plaques"
  },
  {
   "q": "Au niveau d'une dorsale océanique :",
   "a": [
    "Les plaques fusionnent définitivement",
    "Il ne se passe rien",
    "Deux plaques s'écartent et de la nouvelle croûte se forme",
    "Une plaque plonge sous une autre"
   ],
   "c": 2,
   "e": "À la dorsale, les plaques s'écartent (divergence) et du magma remonte pour créer une nouvelle lithosphère océanique.",
   "t": "Brevet · Tectonique des plaques"
  },
  {
   "q": "La zone où une plaque plonge sous une autre s'appelle :",
   "a": [
    "Un épicentre",
    "Une faille transformante",
    "Une zone de subduction",
    "Une dorsale"
   ],
   "c": 2,
   "e": "En zone de subduction, une plaque (souvent océanique) s'enfonce sous une autre, générant séismes et volcanisme.",
   "t": "Brevet · Tectonique des plaques"
  },
  {
   "q": "Le risque géologique correspond à :",
   "a": [
    "L'aléa seul",
    "L'absence de population",
    "La présence d'enjeux humains/matériels exposés à un aléa",
    "Un séisme uniquement"
   ],
   "c": 2,
   "e": "Le risque combine l'aléa (probabilité d'un phénomène) et l'enjeu (population, biens exposés).",
   "t": "Brevet · Risques géologiques"
  },
  {
   "q": "Pour réduire les conséquences d'un séisme, on peut :",
   "a": [
    "Construire des bâtiments parasismiques",
    "Augmenter la population",
    "Construire sur une faille",
    "Ignorer les normes"
   ],
   "c": 0,
   "e": "Les constructions parasismiques, l'éducation et les plans de prévention réduisent les dégâts (prévention du risque).",
   "t": "Brevet · Risques géologiques"
  },
  {
   "q": "Quelle est la différence entre météo et climat ?",
   "a": [
    "La météo concerne uniquement la pluie",
    "La météo décrit le temps à court terme, le climat les conditions moyennes sur des décennies",
    "Le climat change chaque jour",
    "Il n'y en a pas"
   ],
   "c": 1,
   "e": "La météo concerne le temps qu'il fait à court terme ; le climat correspond aux conditions moyennes sur une longue période (≈ 30 ans).",
   "t": "Brevet · Météo et climat"
  },
  {
   "q": "L'effet de serre est dû à des gaz qui :",
   "a": [
    "Refroidissent l'atmosphère",
    "Bloquent toute lumière",
    "Détruisent l'ozone",
    "Retiennent une partie de la chaleur émise par la Terre"
   ],
   "c": 3,
   "e": "Les gaz à effet de serre piègent une partie du rayonnement infrarouge émis par la Terre, réchauffant l'atmosphère.",
   "t": "Brevet · Effet de serre"
  },
  {
   "q": "Quel gaz, émis par les activités humaines, contribue le plus au réchauffement climatique ?",
   "a": [
    "L'azote",
    "L'hélium",
    "Le dioxyde de carbone (CO2)",
    "Le dioxygène"
   ],
   "c": 2,
   "e": "Le CO2, issu notamment de la combustion des énergies fossiles, est le principal gaz à effet de serre d'origine humaine.",
   "t": "Brevet · Effet de serre"
  },
  {
   "q": "Une conséquence du réchauffement climatique est :",
   "a": [
    "La diminution du CO2 atmosphérique",
    "Le refroidissement global",
    "L'arrêt des saisons",
    "La fonte des glaces et la montée du niveau des mers"
   ],
   "c": 3,
   "e": "Le réchauffement entraîne la fonte des glaciers et de la banquise, et l'élévation du niveau des océans.",
   "t": "Brevet · Changement climatique"
  },
  {
   "q": "Parmi ces énergies, laquelle est renouvelable ?",
   "a": [
    "Le gaz naturel",
    "Le pétrole",
    "Le charbon",
    "L'énergie solaire"
   ],
   "c": 3,
   "e": "L'énergie solaire est renouvelable ; pétrole, charbon et gaz sont des énergies fossiles épuisables.",
   "t": "Brevet · Énergies"
  },
  {
   "q": "Les énergies fossiles se sont formées :",
   "a": [
    "À partir de matière organique sur des millions d'années",
    "Par les volcans actuels",
    "Dans le noyau terrestre",
    "En quelques années"
   ],
   "c": 0,
   "e": "Pétrole, charbon et gaz proviennent de matière organique enfouie et transformée sur des millions d'années : ressources non renouvelables à notre échelle.",
   "t": "Brevet · Énergies"
  },
  {
   "q": "Dans une chaîne alimentaire, le premier maillon est généralement :",
   "a": [
    "Un décomposeur",
    "Un animal carnivore",
    "Un champignon",
    "Un végétal (producteur)"
   ],
   "c": 3,
   "e": "Les végétaux, producteurs primaires, sont à la base des chaînes alimentaires car ils produisent leur matière organique.",
   "t": "Brevet · Écosystèmes"
  },
  {
   "q": "La flèche d'une chaîne alimentaire (A → B) signifie :",
   "a": [
    "A mange B",
    "A et B coopèrent",
    "B est mangé par A",
    "A est mangé par B"
   ],
   "c": 3,
   "e": "La flèche se lit « est mangé par » : A → B signifie que A est mangé par B.",
   "t": "Brevet · Écosystèmes"
  },
  {
   "q": "La déforestation a pour conséquence :",
   "a": [
    "Une amélioration des sols",
    "Une perte de biodiversité et plus de CO2 dans l'air",
    "Un refroidissement du climat",
    "Une augmentation de la biodiversité"
   ],
   "c": 1,
   "e": "Détruire les forêts réduit la biodiversité et supprime des puits de carbone, augmentant le CO2 atmosphérique.",
   "t": "Brevet · Action humaine"
  },
  {
   "q": "Pour reconstituer les climats du passé, les scientifiques utilisent notamment :",
   "a": [
    "Les images satellites actuelles",
    "Les carottes de glace et les fossiles",
    "Les bulletins météo anciens",
    "Les prévisions à 5 jours"
   ],
   "c": 1,
   "e": "Les carottes glaciaires, pollens et fossiles renseignent sur les climats passés (paléoclimats) et leurs variations.",
   "t": "Brevet · Paléoclimats"
  },
  {
   "q": "L'appareil qui enregistre les ondes sismiques est :",
   "a": [
    "Le sismomètre (sismographe)",
    "L'anémomètre",
    "Le baromètre",
    "Le thermomètre"
   ],
   "c": 0,
   "e": "Le sismomètre enregistre les vibrations du sol ; le sismogramme obtenu permet d'étudier le séisme.",
   "t": "Brevet · Séismes"
  },
  {
   "q": "Une mesure permettant de limiter le réchauffement climatique est :",
   "a": [
    "Augmenter l'usage des énergies fossiles",
    "Déboiser davantage",
    "Développer les énergies renouvelables et réduire les émissions de CO2",
    "Augmenter le trafic routier"
   ],
   "c": 2,
   "e": "Réduire les émissions de gaz à effet de serre et développer les énergies renouvelables limite le réchauffement.",
   "t": "Brevet · Action humaine"
  },
  {
   "q": "Le rôle des décomposeurs (bactéries, champignons) dans un écosystème est :",
   "a": [
    "Capter la lumière",
    "Produire la matière organique",
    "Manger les herbivores",
    "Recycler la matière organique morte en matière minérale"
   ],
   "c": 3,
   "e": "Les décomposeurs transforment la matière organique morte en éléments minéraux réutilisables par les végétaux.",
   "t": "Brevet · Écosystèmes"
  },
  {
   "q": "L'eau douce disponible pour l'être humain est :",
   "a": [
    "Illimitée",
    "Produite par les volcans",
    "Une ressource limitée à préserver",
    "La majorité de l'eau de la planète"
   ],
   "c": 2,
   "e": "L'eau douce accessible représente une faible part de l'eau terrestre : c'est une ressource limitée à gérer durablement.",
   "t": "Brevet · Ressources"
  },
  {
   "q": "Le réchauffement climatique actuel est principalement dû aux activités humaines.",
   "a": [
    "Vrai",
    "Faux"
   ],
   "c": 0,
   "e": "Le consensus scientifique attribue le réchauffement actuel aux émissions de gaz à effet de serre d'origine humaine.",
   "t": "Brevet · Changement climatique"
  },
  {
   "q": "Une éruption effusive se caractérise par :",
   "a": [
    "Des explosions violentes",
    "Des coulées de lave fluide",
    "Des séismes uniquement",
    "L'absence totale de lave"
   ],
   "c": 1,
   "e": "Une lave fluide laisse échapper les gaz facilement : l'éruption est effusive, avec des coulées de lave (ex : volcans d'Hawaï).",
   "t": "Brevet · Volcanisme"
  },
  {
   "q": "En allant de la surface vers le centre de la Terre, on trouve :",
   "a": [
    "Noyau, manteau, croûte",
    "Manteau, croûte, noyau",
    "Croûte, manteau, noyau",
    "Croûte, noyau, manteau"
   ],
   "c": 2,
   "e": "La Terre est structurée en couches : croûte (surface), manteau, puis noyau (centre).",
   "t": "Brevet · Structure de la Terre"
  },
  {
   "q": "L'utilisation massive d'engrais et de pesticides peut entraîner :",
   "a": [
    "Une amélioration de la qualité de l'eau",
    "Une augmentation de la biodiversité",
    "Un refroidissement du climat",
    "Une pollution des sols et des eaux"
   ],
   "c": 3,
   "e": "L'excès d'engrais et de pesticides pollue les sols et les nappes/cours d'eau, et nuit à la biodiversité.",
   "t": "Brevet · Action humaine"
  },
  {
   "q": "Un tsunami peut être déclenché par :",
   "a": [
    "Une marée basse",
    "Un séisme sous-marin",
    "Un coup de vent",
    "Une éclipse"
   ],
   "c": 1,
   "e": "Un séisme sous-marin (ou une éruption/glissement de terrain en mer) peut provoquer un tsunami, vague géante côtière.",
   "t": "Brevet · Risques géologiques"
  },
  {
   "q": "La plus petite entité constituant la matière est :",
   "a": [
    "La solution",
    "Le mélange",
    "La molécule",
    "L'atome"
   ],
   "c": 3,
   "e": "L'atome est le constituant de base de la matière ; les molécules sont des assemblages d'atomes.",
   "t": "Brevet · Constitution de la matière"
  },
  {
   "q": "Une molécule est :",
   "a": [
    "Un assemblage de plusieurs atomes",
    "Un ion chargé",
    "Un seul atome",
    "Un mélange"
   ],
   "c": 0,
   "e": "Une molécule est un assemblage d'au moins deux atomes liés entre eux (ex : H2O).",
   "t": "Brevet · Constitution de la matière"
  },
  {
   "q": "La formule chimique de l'eau est :",
   "a": [
    "H2O",
    "CO2",
    "NaCl",
    "O2"
   ],
   "c": 0,
   "e": "L'eau est constituée de 2 atomes d'hydrogène et 1 atome d'oxygène : H2O.",
   "t": "Brevet · Formules chimiques"
  },
  {
   "q": "Dans la molécule de dioxyde de carbone CO2, combien y a-t-il d'atomes d'oxygène ?",
   "a": [
    "0",
    "1",
    "2",
    "3"
   ],
   "c": 2,
   "e": "L'indice 2 dans CO2 indique 2 atomes d'oxygène, associés à 1 atome de carbone.",
   "t": "Brevet · Formules chimiques"
  },
  {
   "q": "Un ion est :",
   "a": [
    "Une molécule neutre",
    "Un changement d'état",
    "Un atome qui a gagné ou perdu un ou plusieurs électrons",
    "Un mélange homogène"
   ],
   "c": 2,
   "e": "Un ion est un atome (ou groupe d'atomes) ayant gagné ou perdu des électrons : il porte donc une charge électrique.",
   "t": "Brevet · Ions"
  },
  {
   "q": "L'ion sodium Na+ porte une charge :",
   "a": [
    "Variable",
    "Négative",
    "Positive",
    "Nulle"
   ],
   "c": 2,
   "e": "Le signe « + » indique que l'atome de sodium a perdu un électron : l'ion est chargé positivement (cation).",
   "t": "Brevet · Ions"
  },
  {
   "q": "Un mélange dans lequel on ne distingue pas les constituants à l'œil est :",
   "a": [
    "Un corps pur",
    "Une réaction chimique",
    "Un mélange homogène",
    "Un mélange hétérogène"
   ],
   "c": 2,
   "e": "Dans un mélange homogène (ex : eau salée), les constituants ne sont pas discernables ; dans un mélange hétérogène, oui.",
   "t": "Brevet · Mélanges"
  },
  {
   "q": "Deux liquides qui ne se mélangent pas (ex : huile et eau) sont dits :",
   "a": [
    "Homogènes",
    "Non miscibles",
    "Miscibles",
    "Solubles"
   ],
   "c": 1,
   "e": "Des liquides non miscibles forment un mélange hétérogène avec des phases séparées.",
   "t": "Brevet · Mélanges"
  },
  {
   "q": "La masse volumique se calcule par la relation :",
   "a": [
    "ρ = m + V",
    "ρ = m / V",
    "ρ = V / m",
    "ρ = m × V"
   ],
   "c": 1,
   "e": "La masse volumique est le rapport de la masse sur le volume : ρ = m / V.",
   "t": "Brevet · Masse volumique"
  },
  {
   "q": "Un objet de masse 200 g et de volume 100 cm³ a une masse volumique de :",
   "a": [
    "0,5 g/cm³",
    "2 g/cm³",
    "20 g/cm³",
    "100 g/cm³"
   ],
   "c": 1,
   "e": "ρ = m / V = 200 / 100 = 2 g/cm³.",
   "t": "Brevet · Masse volumique"
  },
  {
   "q": "Un objet coule dans l'eau (ρeau = 1 g/cm³) si sa masse volumique est :",
   "a": [
    "Inférieure à 1 g/cm³",
    "Supérieure à 1 g/cm³",
    "Égale à 1 g/cm³",
    "Nulle"
   ],
   "c": 1,
   "e": "Un objet coule si sa masse volumique est supérieure à celle du liquide.",
   "t": "Brevet · Masse volumique"
  },
  {
   "q": "Le passage de l'état liquide à l'état gazeux s'appelle :",
   "a": [
    "La solidification",
    "La fusion",
    "La condensation",
    "La vaporisation"
   ],
   "c": 3,
   "e": "La vaporisation (ébullition ou évaporation) fait passer un corps de l'état liquide à l'état gazeux.",
   "t": "Brevet · Changements d'état"
  },
  {
   "q": "Le passage de l'état solide à l'état liquide s'appelle :",
   "a": [
    "La vaporisation",
    "La fusion",
    "La condensation",
    "La sublimation"
   ],
   "c": 1,
   "e": "La fusion est le passage de l'état solide à l'état liquide (ex : glace qui fond).",
   "t": "Brevet · Changements d'état"
  },
  {
   "q": "Lors d'un changement d'état d'un corps pur, la masse :",
   "a": [
    "Disparaît",
    "Se conserve",
    "Diminue",
    "Augmente"
   ],
   "c": 1,
   "e": "La masse se conserve lors d'un changement d'état ; seul l'état (et le volume) change.",
   "t": "Brevet · Changements d'état"
  },
  {
   "q": "Sous pression normale, l'eau pure bout à :",
   "a": [
    "0 °C",
    "50 °C",
    "100 °C",
    "212 °C"
   ],
   "c": 2,
   "e": "L'eau pure bout à 100 °C et se solidifie (gèle) à 0 °C sous la pression atmosphérique normale.",
   "t": "Brevet · Changements d'état"
  },
  {
   "q": "Lors d'une transformation chimique :",
   "a": [
    "Les molécules de départ sont conservées",
    "De nouvelles espèces chimiques sont formées",
    "Rien ne se passe",
    "Seul l'état physique change"
   ],
   "c": 1,
   "e": "Une transformation chimique consomme des réactifs et forme de nouveaux produits (nouvelles espèces chimiques).",
   "t": "Brevet · Transformation chimique"
  },
  {
   "q": "Dans une équation de réaction, les espèces consommées sont :",
   "a": [
    "Les catalyseurs",
    "Les solvants",
    "Les produits",
    "Les réactifs"
   ],
   "c": 3,
   "e": "Les réactifs (à gauche de la flèche) sont consommés ; les produits (à droite) sont formés.",
   "t": "Brevet · Transformation chimique"
  },
  {
   "q": "Lors d'une transformation chimique, la masse totale :",
   "a": [
    "Se conserve",
    "Augmente",
    "Diminue",
    "Devient nulle"
   ],
   "c": 0,
   "e": "La masse totale des réactifs est égale à la masse totale des produits : la masse se conserve (Lavoisier).",
   "t": "Brevet · Conservation de la masse"
  },
  {
   "q": "La combustion complète du carbone dans le dioxygène produit :",
   "a": [
    "Du dioxyde de carbone (CO2)",
    "Du méthane",
    "De l'eau",
    "Du dioxygène"
   ],
   "c": 0,
   "e": "Carbone + dioxygène → dioxyde de carbone. Le CO2 trouble l'eau de chaux, ce qui permet de l'identifier.",
   "t": "Brevet · Combustion"
  },
  {
   "q": "Le test permettant d'identifier le dioxyde de carbone est :",
   "a": [
    "Il fait une détonation à la flamme",
    "Il trouble l'eau de chaux",
    "Il bleuit le sulfate de cuivre",
    "Il rallume une bûchette incandescente"
   ],
   "c": 1,
   "e": "Le CO2 trouble l'eau de chaux (elle devient laiteuse). La bûchette qui se rallume teste le dioxygène.",
   "t": "Brevet · Combustion"
  },
  {
   "q": "Le test permettant d'identifier le dioxygène est :",
   "a": [
    "Il trouble l'eau de chaux",
    "Il ravive une bûchette incandescente",
    "Il produit une détonation",
    "Il colore en rose"
   ],
   "c": 1,
   "e": "Le dioxygène ravive (rallume) une bûchette incandescente : c'est un gaz comburant.",
   "t": "Brevet · Tests chimiques"
  },
  {
   "q": "Une solution dont le pH est inférieur à 7 est :",
   "a": [
    "Acide",
    "Sans pH",
    "Basique",
    "Neutre"
   ],
   "c": 0,
   "e": "pH < 7 : solution acide ; pH = 7 : neutre ; pH > 7 : basique.",
   "t": "Brevet · pH"
  },
  {
   "q": "Une solution de pH = 7 est :",
   "a": [
    "Acide",
    "Neutre",
    "Corrosive",
    "Basique"
   ],
   "c": 1,
   "e": "Un pH égal à 7 correspond à une solution neutre, comme l'eau pure.",
   "t": "Brevet · pH"
  },
  {
   "q": "Quand on dissout du sel dans l'eau, le sel est :",
   "a": [
    "Le produit",
    "Le solvant",
    "Le soluté",
    "Le solvant et le soluté"
   ],
   "c": 2,
   "e": "Le soluté est l'espèce dissoute (le sel) ; le solvant est le liquide qui dissout (l'eau).",
   "t": "Brevet · Solubilité"
  },
  {
   "q": "Un corps pur est :",
   "a": [
    "Toujours un solide",
    "Un mélange de plusieurs espèces",
    "Constitué d'une seule espèce chimique",
    "Toujours coloré"
   ],
   "c": 2,
   "e": "Un corps pur ne contient qu'une seule espèce chimique (ex : eau distillée, dioxygène).",
   "t": "Brevet · Constitution de la matière"
  },
  {
   "q": "La vitesse moyenne se calcule par la relation :",
   "a": [
    "v = d + t",
    "v = d × t",
    "v = d / t",
    "v = t / d"
   ],
   "c": 2,
   "e": "La vitesse moyenne est la distance parcourue divisée par la durée : v = d / t.",
   "t": "Brevet · Vitesse"
  },
  {
   "q": "Une voiture parcourt 100 km en 2 h. Sa vitesse moyenne est :",
   "a": [
    "100 km/h",
    "50 km/h",
    "25 km/h",
    "200 km/h"
   ],
   "c": 1,
   "e": "v = d / t = 100 / 2 = 50 km/h.",
   "t": "Brevet · Vitesse"
  },
  {
   "q": "Quelle est l'unité de vitesse du Système international ?",
   "a": [
    "km",
    "m/s",
    "km/h",
    "s"
   ],
   "c": 1,
   "e": "L'unité SI de la vitesse est le mètre par seconde (m/s).",
   "t": "Brevet · Vitesse"
  },
  {
   "q": "Une vitesse de 36 km/h correspond à :",
   "a": [
    "10 m/s",
    "100 m/s",
    "36 m/s",
    "3,6 m/s"
   ],
   "c": 0,
   "e": "On divise par 3,6 : 36 / 3,6 = 10 m/s.",
   "t": "Brevet · Vitesse"
  },
  {
   "q": "Un mouvement dont la trajectoire est une ligne droite est dit :",
   "a": [
    "Curviligne",
    "Rectiligne",
    "Circulaire",
    "Aléatoire"
   ],
   "c": 1,
   "e": "Un mouvement rectiligne suit une trajectoire en ligne droite ; circulaire = cercle ; curviligne = courbe.",
   "t": "Brevet · Trajectoire"
  },
  {
   "q": "Un mouvement dont la vitesse ne change pas est dit :",
   "a": [
    "Circulaire",
    "Uniforme",
    "Accéléré",
    "Ralenti"
   ],
   "c": 1,
   "e": "Un mouvement uniforme a une vitesse constante ; accéléré : vitesse augmente ; ralenti (décéléré) : vitesse diminue.",
   "t": "Brevet · Mouvement"
  },
  {
   "q": "Un passager assis dans un train en marche est :",
   "a": [
    "Toujours immobile",
    "Immobile par rapport au train, en mouvement par rapport au sol",
    "Immobile par rapport au sol",
    "En mouvement par rapport au train"
   ],
   "c": 1,
   "e": "Le mouvement est relatif : le passager est immobile par rapport au train mais en mouvement par rapport au sol (référentiel).",
   "t": "Brevet · Relativité du mouvement"
  },
  {
   "q": "Une action mécanique peut :",
   "a": [
    "N'avoir aucun effet",
    "Mettre en mouvement, arrêter, dévier ou déformer un objet",
    "Uniquement arrêter un objet",
    "Uniquement déformer un objet"
   ],
   "c": 1,
   "e": "Une action mécanique peut modifier le mouvement (départ, arrêt, déviation) ou déformer un objet.",
   "t": "Brevet · Actions mécaniques"
  },
  {
   "q": "Une force se modélise par :",
   "a": [
    "Un vecteur (flèche)",
    "Un nombre seul",
    "Un point",
    "Un cercle"
   ],
   "c": 0,
   "e": "Une force est représentée par un vecteur caractérisé par un point d'application, une direction, un sens et une valeur.",
   "t": "Brevet · Forces"
  },
  {
   "q": "L'unité d'une force est :",
   "a": [
    "Le joule (J)",
    "Le mètre (m)",
    "Le newton (N)",
    "Le kilogramme (kg)"
   ],
   "c": 2,
   "e": "La force (dont le poids) s'exprime en newtons (N). Le kilogramme est l'unité de masse.",
   "t": "Brevet · Forces"
  },
  {
   "q": "Le poids d'un objet se calcule par la relation :",
   "a": [
    "P = m + g",
    "P = m / g",
    "P = m × g",
    "P = g / m"
   ],
   "c": 2,
   "e": "Le poids est le produit de la masse par l'intensité de la pesanteur : P = m × g (g ≈ 10 N/kg sur Terre).",
   "t": "Brevet · Poids et masse"
  },
  {
   "q": "Sur Terre (g ≈ 10 N/kg), le poids d'un objet de 5 kg est environ :",
   "a": [
    "5 N",
    "500 N",
    "0,5 N",
    "50 N"
   ],
   "c": 3,
   "e": "P = m × g = 5 × 10 = 50 N.",
   "t": "Brevet · Poids et masse"
  },
  {
   "q": "Quand on emmène un objet de la Terre vers la Lune, sa masse :",
   "a": [
    "Diminue",
    "Devient nulle",
    "Augmente",
    "Ne change pas"
   ],
   "c": 3,
   "e": "La masse (en kg) ne change pas ; c'est le poids qui diminue car la pesanteur est plus faible sur la Lune.",
   "t": "Brevet · Poids et masse"
  },
  {
   "q": "La force de gravitation entre deux corps est d'autant plus grande que :",
   "a": [
    "La distance est grande",
    "Leurs masses sont petites",
    "Ils sont immobiles",
    "Leurs masses sont grandes et la distance petite"
   ],
   "c": 3,
   "e": "L'attraction gravitationnelle augmente avec les masses et diminue quand la distance augmente.",
   "t": "Brevet · Gravitation"
  },
  {
   "q": "Ce qui maintient la Terre en orbite autour du Soleil est :",
   "a": [
    "L'air",
    "Le vent solaire",
    "La force de gravitation",
    "Le magnétisme du Soleil"
   ],
   "c": 2,
   "e": "La gravitation, attraction entre la Terre et le Soleil, maintient la Terre sur son orbite.",
   "t": "Brevet · Gravitation"
  },
  {
   "q": "Une interaction de contact est :",
   "a": [
    "La gravitation",
    "Le magnétisme à distance",
    "Le frottement entre deux surfaces",
    "L'attraction Terre-Lune"
   ],
   "c": 2,
   "e": "Le frottement nécessite un contact ; la gravitation et le magnétisme sont des interactions à distance.",
   "t": "Brevet · Interactions"
  },
  {
   "q": "On mesure une force avec :",
   "a": [
    "Un voltmètre",
    "Une balance",
    "Un thermomètre",
    "Un dynamomètre"
   ],
   "c": 3,
   "e": "Le dynamomètre mesure une force (en newtons) ; la balance mesure une masse (en grammes/kg).",
   "t": "Brevet · Poids et masse"
  },
  {
   "q": "Pour décrire un mouvement, il faut d'abord préciser :",
   "a": [
    "Le référentiel (objet de référence)",
    "La couleur de l'objet",
    "La température",
    "La masse de l'objet"
   ],
   "c": 0,
   "e": "Le mouvement étant relatif, il faut indiquer le référentiel par rapport auquel on l'étudie.",
   "t": "Brevet · Mouvement"
  },
  {
   "q": "Une ampoule transforme l'énergie électrique principalement en :",
   "a": [
    "Énergie de position",
    "Énergie chimique uniquement",
    "Énergie nucléaire",
    "Énergie lumineuse (et thermique)"
   ],
   "c": 3,
   "e": "Une ampoule convertit l'énergie électrique en énergie lumineuse, avec des pertes sous forme de chaleur (thermique).",
   "t": "Brevet · Formes d'énergie"
  },
  {
   "q": "L'énergie liée au mouvement d'un objet est :",
   "a": [
    "L'énergie cinétique",
    "L'énergie chimique",
    "L'énergie lumineuse",
    "L'énergie thermique"
   ],
   "c": 0,
   "e": "L'énergie cinétique est l'énergie que possède un objet du fait de sa vitesse ; elle augmente avec la masse et la vitesse.",
   "t": "Brevet · Énergie cinétique"
  },
  {
   "q": "À masse égale, si la vitesse d'un véhicule augmente, son énergie cinétique :",
   "a": [
    "Reste constante",
    "Diminue",
    "Devient nulle",
    "Augmente"
   ],
   "c": 3,
   "e": "L'énergie cinétique augmente avec la vitesse (et fortement, car elle dépend du carré de la vitesse) : d'où les distances de freinage plus longues.",
   "t": "Brevet · Énergie cinétique"
  },
  {
   "q": "Parmi ces sources d'énergie, laquelle est renouvelable ?",
   "a": [
    "Le gaz naturel",
    "Le charbon",
    "Le pétrole",
    "L'énergie éolienne"
   ],
   "c": 3,
   "e": "L'énergie éolienne (vent) est renouvelable. Charbon, pétrole et gaz sont des énergies fossiles.",
   "t": "Brevet · Sources d'énergie"
  },
  {
   "q": "Dans un circuit en série, si on retire une lampe sur deux :",
   "a": [
    "Le circuit prend feu",
    "Rien ne change",
    "L'autre lampe s'éteint",
    "L'autre lampe brille plus"
   ],
   "c": 2,
   "e": "Dans un circuit en série, ouvrir le circuit en un point éteint tout : l'autre lampe s'éteint.",
   "t": "Brevet · Circuit électrique"
  },
  {
   "q": "L'intensité du courant électrique se mesure avec :",
   "a": [
    "Un ampèremètre branché en série",
    "Un thermomètre",
    "Un voltmètre branché en dérivation",
    "Un dynamomètre"
   ],
   "c": 0,
   "e": "L'ampèremètre, branché en série, mesure l'intensité (en ampères, A).",
   "t": "Brevet · Circuit électrique"
  },
  {
   "q": "La tension électrique se mesure avec :",
   "a": [
    "Une balance",
    "Un baromètre",
    "Un voltmètre en dérivation",
    "Un ampèremètre en série"
   ],
   "c": 2,
   "e": "Le voltmètre, branché en dérivation (parallèle), mesure la tension (en volts, V).",
   "t": "Brevet · Circuit électrique"
  },
  {
   "q": "La loi d'Ohm pour une résistance s'écrit :",
   "a": [
    "U = R / I",
    "U = I / R",
    "U = R + I",
    "U = R × I"
   ],
   "c": 3,
   "e": "La loi d'Ohm relie tension, résistance et intensité : U = R × I (U en V, R en Ω, I en A).",
   "t": "Brevet · Loi d'Ohm"
  },
  {
   "q": "Une résistance de 20 Ω traversée par un courant de 0,5 A présente une tension de :",
   "a": [
    "20 V",
    "10 V",
    "40 V",
    "0,025 V"
   ],
   "c": 1,
   "e": "U = R × I = 20 × 0,5 = 10 V.",
   "t": "Brevet · Loi d'Ohm"
  },
  {
   "q": "L'unité de la résistance électrique est :",
   "a": [
    "Le watt (W)",
    "L'ampère (A)",
    "L'ohm (Ω)",
    "Le volt (V)"
   ],
   "c": 2,
   "e": "La résistance s'exprime en ohms (Ω).",
   "t": "Brevet · Résistance"
  },
  {
   "q": "La puissance électrique se calcule par :",
   "a": [
    "P = U + I",
    "P = U / I",
    "P = I / U",
    "P = U × I"
   ],
   "c": 3,
   "e": "La puissance est le produit de la tension par l'intensité : P = U × I (P en watts).",
   "t": "Brevet · Puissance électrique"
  },
  {
   "q": "Un appareil sous 230 V parcouru par 2 A a une puissance de :",
   "a": [
    "232 W",
    "460 W",
    "230 W",
    "115 W"
   ],
   "c": 1,
   "e": "P = U × I = 230 × 2 = 460 W.",
   "t": "Brevet · Puissance électrique"
  },
  {
   "q": "L'énergie consommée par un appareil se calcule par :",
   "a": [
    "E = t / P",
    "E = P + t",
    "E = P / t",
    "E = P × t"
   ],
   "c": 3,
   "e": "L'énergie est le produit de la puissance par la durée : E = P × t (en joules, ou en Wh selon les unités).",
   "t": "Brevet · Énergie électrique"
  },
  {
   "q": "Un radiateur de 2000 W fonctionnant 3 h consomme :",
   "a": [
    "2003 Wh",
    "0,66 kWh",
    "6000 Wh soit 6 kWh",
    "600 Wh"
   ],
   "c": 2,
   "e": "E = P × t = 2000 × 3 = 6000 Wh = 6 kWh.",
   "t": "Brevet · Énergie électrique"
  },
  {
   "q": "Le dispositif qui coupe le courant en cas de surintensité est :",
   "a": [
    "La pile",
    "Le voltmètre",
    "L'interrupteur classique",
    "Le disjoncteur (ou fusible)"
   ],
   "c": 3,
   "e": "Disjoncteurs et fusibles protègent l'installation en coupant le courant en cas de surintensité.",
   "t": "Brevet · Sécurité électrique"
  },
  {
   "q": "Une centrale hydroélectrique transforme :",
   "a": [
    "L'énergie électrique en énergie chimique",
    "L'énergie thermique en eau",
    "L'énergie de l'eau en mouvement en énergie électrique",
    "L'énergie lumineuse en énergie nucléaire"
   ],
   "c": 2,
   "e": "L'eau en mouvement entraîne une turbine reliée à un alternateur qui produit de l'électricité.",
   "t": "Brevet · Conversion d'énergie"
  },
  {
   "q": "Un panneau solaire photovoltaïque convertit l'énergie lumineuse en énergie :",
   "a": [
    "Chimique",
    "Thermique",
    "Électrique",
    "Cinétique"
   ],
   "c": 2,
   "e": "Le panneau photovoltaïque transforme directement l'énergie lumineuse en énergie électrique.",
   "t": "Brevet · Conversion d'énergie"
  },
  {
   "q": "Dans un circuit en dérivation, si une lampe grille :",
   "a": [
    "L'intensité devient nulle partout",
    "Toutes les lampes s'éteignent",
    "Les autres lampes continuent de fonctionner",
    "Le circuit prend feu"
   ],
   "c": 2,
   "e": "En dérivation, chaque branche est indépendante : les autres lampes restent allumées.",
   "t": "Brevet · Circuit électrique"
  },
  {
   "q": "L'unité d'énergie du Système international est :",
   "a": [
    "Le volt (V)",
    "Le joule (J)",
    "L'ampère (A)",
    "Le watt (W)"
   ],
   "c": 1,
   "e": "L'énergie s'exprime en joules (J) ; le watt est l'unité de puissance.",
   "t": "Brevet · Énergie"
  },
  {
   "q": "Dans une lampe de poche, la chaîne énergétique correcte est :",
   "a": [
    "Soleil → pile → chaleur",
    "Lampe → pile → mouvement",
    "Pile (chimique) → lampe → lumière",
    "Lumière → pile → chimique"
   ],
   "c": 2,
   "e": "La pile stocke de l'énergie chimique, convertie en électrique, puis en lumineuse par la lampe.",
   "t": "Brevet · Chaîne énergétique"
  },
  {
   "q": "Pour qu'un courant circule, le circuit doit être :",
   "a": [
    "Ouvert",
    "Branché à la lumière",
    "Fermé",
    "Vide"
   ],
   "c": 2,
   "e": "Le courant ne circule que dans un circuit fermé, formant une boucle continue.",
   "t": "Brevet · Circuit électrique"
  },
  {
   "q": "Dans le vide ou l'air, la lumière se propage à environ :",
   "a": [
    "300 000 km/s",
    "30 km/s",
    "340 m/s",
    "3 000 km/s"
   ],
   "c": 0,
   "e": "La vitesse de la lumière est d'environ 300 000 km/s (3 × 10⁸ m/s).",
   "t": "Brevet · Signaux lumineux"
  },
  {
   "q": "Dans un milieu transparent et homogène, la lumière se propage :",
   "a": [
    "En cercle",
    "En ligne droite",
    "En zigzag",
    "En courbe"
   ],
   "c": 1,
   "e": "La lumière se propage en ligne droite dans un milieu transparent homogène (propagation rectiligne).",
   "t": "Brevet · Signaux lumineux"
  },
  {
   "q": "Dans l'air, le son se propage à environ :",
   "a": [
    "340 m/s",
    "3400 m/s",
    "300 000 km/s",
    "34 m/s"
   ],
   "c": 0,
   "e": "La vitesse du son dans l'air est d'environ 340 m/s, bien plus lente que la lumière.",
   "t": "Brevet · Signaux sonores"
  },
  {
   "q": "Le son peut-il se propager dans le vide ?",
   "a": [
    "Non, il a besoin d'un milieu matériel",
    "Oui, comme la lumière",
    "Oui, mais plus vite",
    "Uniquement dans l'espace"
   ],
   "c": 0,
   "e": "Le son a besoin d'un milieu matériel (air, eau, solide) pour se propager : il ne se propage pas dans le vide.",
   "t": "Brevet · Signaux sonores"
  },
  {
   "q": "Un son aigu correspond à une fréquence :",
   "a": [
    "Élevée",
    "Négative",
    "Basse",
    "Nulle"
   ],
   "c": 0,
   "e": "Plus la fréquence (en hertz) est élevée, plus le son est aigu ; une fréquence basse donne un son grave.",
   "t": "Brevet · Signaux sonores"
  },
  {
   "q": "L'unité de la fréquence d'un son est :",
   "a": [
    "Le mètre (m)",
    "Le décibel (dB)",
    "Le watt (W)",
    "Le hertz (Hz)"
   ],
   "c": 3,
   "e": "La fréquence se mesure en hertz (Hz) ; le décibel mesure le niveau sonore (intensité).",
   "t": "Brevet · Signaux sonores"
  },
  {
   "q": "Une exposition à des sons très intenses (forts) peut :",
   "a": [
    "Augmenter la fréquence",
    "N'avoir aucun effet",
    "Endommager l'oreille",
    "Améliorer l'audition"
   ],
   "c": 2,
   "e": "Un niveau sonore trop élevé endommage les cellules de l'oreille interne et peut causer une perte auditive.",
   "t": "Brevet · Signaux sonores"
  },
  {
   "q": "Pendant un orage, on voit l'éclair avant d'entendre le tonnerre car :",
   "a": [
    "L'éclair est plus proche",
    "Le son part en retard",
    "La lumière va beaucoup plus vite que le son",
    "Le tonnerre est plus faible"
   ],
   "c": 2,
   "e": "La lumière (300 000 km/s) atteint l'œil quasi instantanément, tandis que le son (340 m/s) met du temps à parvenir.",
   "t": "Brevet · Signaux lumineux"
  },
  {
   "q": "Un éclair est suivi du tonnerre 3 s plus tard. L'orage est à environ (son ≈ 340 m/s) :",
   "a": [
    "340 m",
    "100 m",
    "10 km",
    "1020 m"
   ],
   "c": 3,
   "e": "d = v × t = 340 × 3 ≈ 1020 m, soit environ 1 km.",
   "t": "Brevet · Signaux et distances"
  },
  {
   "q": "On voit un objet non lumineux par lui-même parce qu'il :",
   "a": [
    "Produit sa propre lumière",
    "Est transparent",
    "Absorbe toute la lumière",
    "Renvoie (diffuse) la lumière qu'il reçoit"
   ],
   "c": 3,
   "e": "Un objet diffuse vers nos yeux une partie de la lumière reçue d'une source ; c'est ainsi qu'on le voit.",
   "t": "Brevet · Signaux lumineux"
  },
  {
   "q": "Pour transmettre une information sur de longues distances (fibre optique), on utilise :",
   "a": [
    "Des forces",
    "Des signaux sonores",
    "Des signaux lumineux",
    "Des changements d'état"
   ],
   "c": 2,
   "e": "La fibre optique transmet l'information grâce à des signaux lumineux, très rapides.",
   "t": "Brevet · Signaux"
  },
  {
   "q": "Un atome est constitué :",
   "a": [
    "Uniquement d'un noyau",
    "D'un noyau et d'électrons",
    "De molécules",
    "Uniquement d'électrons"
   ],
   "c": 1,
   "e": "Un atome possède un noyau central (protons et neutrons) entouré d'électrons.",
   "t": "Brevet · Atomes"
  },
  {
   "q": "Globalement, un atome est électriquement :",
   "a": [
    "Positif",
    "Variable",
    "Neutre",
    "Négatif"
   ],
   "c": 2,
   "e": "Un atome est neutre : il compte autant de charges positives (protons) que de charges négatives (électrons).",
   "t": "Brevet · Atomes"
  },
  {
   "q": "Le symbole chimique de l'oxygène est :",
   "a": [
    "Or",
    "Ox",
    "Og",
    "O"
   ],
   "c": 3,
   "e": "L'oxygène a pour symbole O ; l'hydrogène H, le carbone C, l'azote N.",
   "t": "Brevet · Symboles chimiques"
  },
  {
   "q": "La rouille qui se forme sur du fer est le signe :",
   "a": [
    "D'un mélange homogène",
    "D'une dissolution",
    "D'une transformation chimique",
    "D'un changement d'état"
   ],
   "c": 2,
   "e": "La formation de rouille crée une nouvelle espèce chimique : c'est une transformation chimique (oxydation du fer).",
   "t": "Brevet · Transformation chimique"
  },
  {
   "q": "L'action d'un acide sur un métal comme le fer produit notamment :",
   "a": [
    "Du dioxyde de carbone",
    "De l'eau de chaux",
    "Du dihydrogène",
    "Du dioxygène"
   ],
   "c": 2,
   "e": "L'attaque d'un métal par un acide dégage du dihydrogène (H2), gaz qui détone à l'approche d'une flamme.",
   "t": "Brevet · Acides et métaux"
  },
  {
   "q": "Le test au sulfate de cuivre anhydre (blanc) permet de détecter :",
   "a": [
    "Le dioxyde de carbone",
    "Le dioxygène",
    "L'eau",
    "Un acide"
   ],
   "c": 2,
   "e": "Le sulfate de cuivre anhydre, blanc, bleuit en présence d'eau.",
   "t": "Brevet · Tests chimiques"
  },
  {
   "q": "Pour mesurer le pH d'une solution, on peut utiliser :",
   "a": [
    "Une balance",
    "Un ampèremètre",
    "Du papier pH ou un pH-mètre",
    "Un dynamomètre"
   ],
   "c": 2,
   "e": "Le papier pH (indicateur coloré) ou le pH-mètre permettent de mesurer le pH d'une solution.",
   "t": "Brevet · pH"
  },
  {
   "q": "Une centrale thermique à charbon émet du CO2 car elle repose sur :",
   "a": [
    "L'énergie du vent",
    "L'énergie de l'eau",
    "Une combustion d'énergie fossile",
    "L'énergie solaire"
   ],
   "c": 2,
   "e": "Brûler du charbon (énergie fossile) libère du CO2, gaz à effet de serre.",
   "t": "Brevet · Sources d'énergie"
  },
  {
   "q": "Sur la route, à vitesse plus élevée, la distance de freinage :",
   "a": [
    "Devient nulle",
    "Augmente",
    "Reste identique",
    "Diminue"
   ],
   "c": 1,
   "e": "L'énergie cinétique augmentant avec la vitesse, il faut une plus grande distance pour l'évacuer : distance de freinage plus longue.",
   "t": "Brevet · Énergie cinétique"
  },
  {
   "q": "L'unité d'intensité du courant électrique est :",
   "a": [
    "L'ohm (Ω)",
    "Le joule (J)",
    "Le volt (V)",
    "L'ampère (A)"
   ],
   "c": 3,
   "e": "L'intensité s'exprime en ampères (A) et se mesure avec un ampèremètre.",
   "t": "Brevet · Circuit électrique"
  },
  {
   "q": "Pour calculer la durée d'un trajet connaissant la distance et la vitesse, on utilise :",
   "a": [
    "t = v + d",
    "t = v / d",
    "t = d / v",
    "t = d × v"
   ],
   "c": 2,
   "e": "À partir de v = d / t, on obtient t = d / v.",
   "t": "Brevet · Vitesse"
  },
  {
   "q": "Sur la Lune, l'intensité de pesanteur est environ 6 fois plus faible que sur Terre. Un astronaute y a donc un poids :",
   "a": [
    "Nul",
    "6 fois plus grand",
    "Identique",
    "6 fois plus petit"
   ],
   "c": 3,
   "e": "Le poids P = m × g diminue car g est plus faible sur la Lune ; la masse, elle, reste inchangée.",
   "t": "Brevet · Gravitation"
  },
  {
   "q": "La lumière blanche du Soleil est en réalité composée :",
   "a": [
    "De chaleur uniquement",
    "De plusieurs couleurs (spectre)",
    "D'une seule couleur",
    "De son"
   ],
   "c": 1,
   "e": "La lumière blanche est composée de plusieurs lumières colorées, révélées par un prisme (spectre, comme l'arc-en-ciel).",
   "t": "Brevet · Signaux lumineux"
  }
 ],
 "anglais": []
};
