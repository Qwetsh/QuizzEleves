// Tests fonctionnels du système d'objets : catalogue, effets passifs,
// achats/reventes, consommables, hooks événements et combat.
// On pilote le vrai store zustand (pas de mock de la logique métier).
import { useGameStore } from '../store/gameStore.js';
import { ITEMS, RARITIES, SLOTS, setItemsData } from '../data/items.js';
import { getEffectValue, reducedRecul, reducedSteal, reducedTax } from '../logic/itemEffects.js';
import { resolveWrongAnswer } from '../logic/turnHelpers.js';
import { generateShopStock, generateBlackMarketStock, pickLootItem, pickReplacement, isValidMove, BAG_SIZE } from '../store/itemHandlers.js';
import { EVENTS } from '../data/events.js';

// Le sac est positionnel (BAG_SIZE cases, null = vide) : on compare le contenu
const bagItems = (t) => (t.bag || []).filter(Boolean);

// Plateau linéaire : depart -> n1..n8 -> arrivee
const BOARD = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 8; i++) {
    b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 8 ? 'arrivee' : `n${i + 1}`] };
  }
  b.arrivee = { x: 9, y: 0, type: 'arrivee', next: [] };
  return b;
})();

const QUESTIONS = { maths: [{ q: 'Q ?', a: ['A', 'B', 'C', 'D'], c: 1 }] };

function mkTeam(i, over = {}) {
  return {
    name: `T${i}`, color: '#111', emoji: '🦁', blazonGlyph: 'lion',
    pos: 'n4', correct: 0, wrong: 0, money: 50,
    powerDef: null, powerOff: null, powers: {},
    sablierActif: false, doubleActive: false,
    equipment: { head: null, body: null, feet: null }, bag: [],
    ...over,
  };
}

// devSandbox: true => saveGame est un no-op (pas de localStorage en Node)
function freshGame(overrides = [{}, {}, {}]) {
  useGameStore.setState({
    phase: 'game', devSandbox: true,
    teams: overrides.map((o, i) => mkTeam(i, o)),
    currentTeam: 0, board: BOARD, finished: false,
    askedQuestions: {}, questions: QUESTIONS, log: [],
    rolling: false, diceValue: null, pendingMove: null, pendingLanding: false,
    awaitingChoice: false, showQuestion: null, showEvent: null, showFight: null,
    showTargetPicker: null, showShop: false, showInventory: false,
    showChargePicker: false, showDiceModal: false, eventApplied: false,
    indiceUsed: false, indiceHidden: [], freeActivation: false,
    shopStock: [], shopStockTurns: 10, movePath: null,
    preRollPos: null, preRollValue: null,
    enabledItems: Object.keys(ITEMS),
  });
}

const S = () => useGameStore.getState();
const team = (i = 0) => S().teams[i];
const equip = (i, slot, key) => {
  const teams = [...S().teams];
  teams[i] = { ...teams[i], equipment: { ...teams[i].equipment, [slot]: key } };
  useGameStore.setState({ teams });
};

// --- Catalogue ---

describe('catalogue items.js', () => {
  const EQUIP_EFFECTS = ['timerBonus', 'indiceBoost', 'moneyPerCorrect', 'taxReduction',
    'stealProtection', 'reculReduction', 'tempeteImmune', 'oubliProtect', 'fightStealBonus',
    'itemStealImmune', 'goldStealImmune', 'reflectChance', 'thorns', 'streakGuard',
    'minRoll', 'insurance', 'interest', 'tithe', 'anchor', 'diceMalus'];
  const CONSUMABLE_EFFECTS = ['gainMoney', 'gainMoneyAll', 'moveForward', 'extraTime',
    'shieldNext', 'gainCharge', 'fumigene'];

  it('chaque item est complet et cohérent', () => {
    for (const [key, item] of Object.entries(ITEMS)) {
      expect(item.name, key).toBeTruthy();
      expect(item.icon, key).toBeTruthy();
      expect(item.desc, key).toBeTruthy();
      expect(['head', 'body', 'feet', 'consumable'], key).toContain(item.slot);
      expect(Object.keys(RARITIES), key).toContain(item.rarity);
      // Familles alchimie/enchant : règles propres (potions price 0, parchemins
      // sans `effects` mais avec `enchant`) — validées par leurs tests dédiés.
      if (item.family) continue;
      expect(item.price, key).toBeGreaterThan(0);
      expect(item.effects.length, key).toBeGreaterThan(0);
      const allowed = item.slot === 'consumable' ? CONSUMABLE_EFFECTS : EQUIP_EFFECTS;
      for (const fx of item.effects) {
        // Effet composable (kind:'trigger') : validé par le moteur — on vérifie
        // juste qu'il porte au moins une action.
        if (fx.kind === 'trigger') {
          expect(Array.isArray(fx.do) && fx.do.length > 0, `${key}: trigger sans action`).toBe(true);
          continue;
        }
        expect(allowed, `${key}: effet ${fx.type}`).toContain(fx.type);
        expect(fx.value, key).toBeGreaterThan(0);
      }
    }
  });

  it('les légendaires sont lootOnly (et seulement eux)', () => {
    for (const [key, item] of Object.entries(ITEMS)) {
      if (item.family) continue; // potions/parchemins : hors rotation boutique/loot
      expect(!!item.lootOnly, key).toBe(item.rarity === 'legendaire');
    }
  });

  it('la vitrine = consommables + équipements, sans légendaires ni doublon', () => {
    for (let n = 0; n < 20; n++) {
      const stock = generateShopStock();
      expect(new Set(stock).size).toBe(stock.length); // pas de doublon
      for (const k of stock) expect(ITEMS[k].lootOnly).toBeFalsy();
      const consos = stock.filter((k) => ITEMS[k].slot === 'consumable');
      const equips = stock.filter((k) => ITEMS[k].slot !== 'consumable');
      expect(consos.length).toBeGreaterThan(0);
      expect(equips.length).toBeGreaterThan(0);
      expect(consos.length).toBeLessThanOrEqual(8);
      expect(equips.length).toBeLessThanOrEqual(8);
    }
    expect(ITEMS[pickLootItem(1)].rarity).toBe('legendaire');
    expect(ITEMS[pickLootItem(0)].rarity).not.toBe('legendaire');
  });

  it('enabledItems filtre la boutique et le loot', () => {
    const enabled = ['chapeauPaille', 'potionHate']; // 1 équip + 1 conso
    for (let n = 0; n < 10; n++) {
      const stock = generateShopStock(enabled);
      expect(stock.length).toBeLessThanOrEqual(2);
      for (const k of stock) expect(enabled).toContain(k);
      expect(enabled).toContain(pickLootItem(0.5, enabled));
    }
    // Rabattement : que des non-legendaires actives mais tirage "legendaire"
    expect(enabled).toContain(pickLootItem(1, enabled));
    // Aucun objet active
    expect(generateShopStock([])).toEqual([]);
    expect(pickLootItem(0.5, [])).toBeNull();
  });

  it('le parchemin vierge est ÉPINGLÉ en boutique quand l\'enchantement est actif', () => {
    const enabled = Object.keys(ITEMS);
    // Sans la famille parchment autorisée : pas de vierge en boutique.
    for (let n = 0; n < 10; n++) expect(generateShopStock(enabled, [])).not.toContain('parcheminVierge');
    // Avec parchment autorisé : TOUJOURS présent.
    for (let n = 0; n < 20; n++) {
      const stock = generateShopStock(enabled, ['parchment']);
      expect(stock).toContain('parcheminVierge');
      expect(new Set(stock).size).toBe(stock.length); // pas de doublon
    }
    // Réassort à l'identique après achat du vierge.
    expect(pickReplacement('parcheminVierge', [], enabled, ['parchment'])).toBe('parcheminVierge');
  });
});

// --- Helpers d'effets ---

describe('itemEffects', () => {
  it('getEffectValue cumule les effets de tout léquipement', () => {
    const t = mkTeam(0, { equipment: { head: 'monocleDetective', body: 'etendardRoyal', feet: 'pegase' } });
    expect(getEffectValue(t, 'timerBonus')).toBe(2);
    expect(getEffectValue(t, 'indiceBoost')).toBe(1);
    expect(getEffectValue(t, 'moneyPerCorrect')).toBe(3);
    expect(getEffectValue(t, 'taxReduction')).toBe(50);
    expect(getEffectValue(t, 'reculReduction')).toBe(2);
    expect(getEffectValue(t, 'tempeteImmune')).toBe(1);
  });

  it('tolère les équipes sans equipment (anciennes sauvegardes)', () => {
    expect(getEffectValue({ name: 'old' }, 'timerBonus')).toBe(0);
  });

  it('getEffectValue résout un bonus aléatoire (timer 1D4) et le rejoue à chaque appel', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      sablierFee: {
        name: 'Sablier féérique', icon: '⏳', slot: 'head', rarity: 'commun', price: 0,
        effects: [{ type: 'timerBonus', value: 'd4' }],
      },
    });
    const t = mkTeam(0, { equipment: { head: 'sablierFee', body: null, feet: null } });
    vi.spyOn(Math, 'random').mockReturnValue(0);     // d4 → 1
    expect(getEffectValue(t, 'timerBonus')).toBe(1);
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // d4 → 4 (nouveau tirage)
    expect(getEffectValue(t, 'timerBonus')).toBe(4);
    vi.restoreAllMocks();
    // bornes : toujours dans 1..4 sur plusieurs tirages
    for (let i = 0; i < 20; i++) {
      const v = getEffectValue(t, 'timerBonus');
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(4);
    }
    setItemsData(snapshot);
  });

  it('getEffectValue applique la probabilité (chance) de l’effet passif', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      bourseChanceuse: {
        name: 'Bourse chanceuse', icon: '🪙', slot: 'body', rarity: 'commun', price: 0,
        effects: [{ type: 'fightStealBonus', value: 'd10', chance: 0.2 }],
      },
    });
    const t = mkTeam(0, { equipment: { head: null, body: 'bourseChanceuse', feet: null } });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);  // ≥ 0.2 → raté
    expect(getEffectValue(t, 'fightStealBonus')).toBe(0);
    // < 0.2 → déclenche, puis 2e random pour le d10 (0 → 1)
    let calls = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => (calls++ === 0 ? 0.1 : 0));
    expect(getEffectValue(t, 'fightStealBonus')).toBe(1);
    vi.restoreAllMocks();
    setItemsData(snapshot);
  });

  it('reducedRecul / reducedSteal / reducedTax', () => {
    const t = mkTeam(0, { equipment: { head: null, body: 'capeOmbre', feet: 'bottesMontagne' } });
    expect(reducedRecul(t, 2)).toBe(0);
    expect(reducedRecul(t, 5)).toBe(3);
    expect(reducedSteal(t, 10)).toBe(5);
    expect(reducedTax(mkTeam(0, { equipment: { head: null, body: 'talismanOr', feet: null } }), 15)).toBe(0);
  });
});

// --- Achats / reventes ---

describe('boutique : buyItem / revente', () => {
  beforeEach(() => freshGame());

  it('achat déquipement : débit + slot rempli + remplacé dans le stock', () => {
    // Catalogue réduit pour rendre le remplacement déterministe : après l'achat
    // de chapeauPaille, le seul autre équipement activé est bandeauSage.
    useGameStore.setState({
      enabledItems: ['chapeauPaille', 'potionHate', 'bandeauSage'],
      shopStock: ['chapeauPaille', 'potionHate'],
    });
    S().buyItem('chapeauPaille');
    expect(team().money).toBe(40);
    expect(team().equipment.head).toBe('chapeauPaille');
    // chapeauPaille retiré, remplacé par un équipement (bandeauSage) ; potionHate reste
    expect(S().shopStock).not.toContain('chapeauPaille');
    expect(S().shopStock).toContain('potionHate');
    expect(S().shopStock).toContain('bandeauSage');
    expect(S().shopStock).toHaveLength(2);
  });

  it('slot occupé : le nouvel équipement va dans le sac (pas de revente forcée)', () => {
    equip(0, 'head', 'chapeauPaille');
    useGameStore.setState({ shopStock: ['bandeauSage'] }); // prix 24
    S().buyItem('bandeauSage');
    expect(team().equipment.head).toBe('chapeauPaille'); // inchangé
    expect(bagItems(team())).toEqual(['bandeauSage']);
    expect(team().money).toBe(50 - 24);
  });

  it('consommable -> sac ; refusé si sac plein ou argent insuffisant', () => {
    useGameStore.setState({ shopStock: ['potionHate', 'painVoyageur'] });
    S().buyItem('potionHate');
    expect(bagItems(team())).toEqual(['potionHate']);

    const teams = [...S().teams];
    teams[0] = { ...teams[0], bag: Array(BAG_SIZE).fill('potionHate') };
    useGameStore.setState({ teams, shopStock: ['painVoyageur'] });
    S().buyItem('painVoyageur');
    expect(bagItems(team())).toHaveLength(BAG_SIZE); // sac plein : refus

    teams[0] = { ...S().teams[0], bag: [], money: 2 };
    useGameStore.setState({ teams: [teams[0], ...S().teams.slice(1)], shopStock: ['painVoyageur'] });
    S().buyItem('painVoyageur');
    expect(bagItems(team())).toHaveLength(0); // trop pauvre : refus
  });

  it('hors stock : refusé', () => {
    useGameStore.setState({ shopStock: ['potionHate'] });
    S().buyItem('bandeauSage');
    expect(team().money).toBe(50);
    expect(team().equipment.head).toBeNull();
  });

  it('renouvellement à lachat : remplaçant de même catégorie, pas le même objet', () => {
    // Achat d'un consommable -> un autre CONSOMMABLE arrive, jamais celui acheté.
    useGameStore.setState({ shopStock: ['potionHate', 'chapeauPaille'] });
    S().buyItem('potionHate');
    const added = S().shopStock.filter((k) => k !== 'chapeauPaille');
    expect(added).toHaveLength(1);
    expect(added[0]).not.toBe('potionHate');           // pas de réapparition immédiate
    expect(ITEMS[added[0]].slot).toBe('consumable');   // même catégorie
    expect(S().shopStock).toContain('chapeauPaille');  // l'équipement reste
  });

  it('achat refusé (argent) : pas de remplacement', () => {
    const teams = [...S().teams];
    teams[0] = { ...teams[0], money: 0 };
    useGameStore.setState({ teams, shopStock: ['bandeauSage', 'potionHate'] });
    S().buyItem('bandeauSage');
    expect(S().shopStock).toEqual(['bandeauSage', 'potionHate']); // inchangé
  });

  it('sellEquipment / sellBagItem rendent la moitié du prix', () => {
    equip(0, 'feet', 'bottesMontagne'); // 24 -> 12
    S().sellEquipment('feet');
    expect(team().equipment.feet).toBeNull();
    expect(team().money).toBe(62);

    const teams = [...S().teams];
    teams[0] = { ...teams[0], bag: ['coffretEpices'] }; // 14 -> 7
    useGameStore.setState({ teams });
    S().sellBagItem(0);
    expect(bagItems(team())).toHaveLength(0);
    expect(team().money).toBe(69);
  });
});

// --- Séries, précision & déclencheurs de réponse ---

describe('séries & déclencheurs de réponse', () => {
  afterEach(() => vi.restoreAllMocks());

  it('la série +1 sur bonne réponse, repart de 0 sur erreur', () => {
    freshGame([{ streak: 4 }, {}]);
    S().askQuestion('maths');
    S().answerQuestion(S().showQuestion.question.c, 10); // bonne
    expect(team(0).streak).toBe(5);

    useGameStore.setState({ currentTeam: 1, teams: S().teams.map((t, i) => (i === 1 ? { ...t, streak: 3 } : t)) });
    S().askQuestion('maths');
    S().answerQuestion((S().showQuestion.question.c + 1) % 4, 10); // mauvaise
    expect(team(1).streak).toBe(0);
  });

  it('answerTimeRatio (% temps restant) figé à la réponse', () => {
    freshGame([{}, {}]);
    S().askQuestion('maths');
    S().answerQuestion(S().showQuestion.question.c, 15); // 15/30 ⇒ 50%
    expect(team(0).answerTimeRatio).toBe(50);
  });

  it('déclencheur on:wrong — coiffe qui fait perdre 5 PO à l’erreur', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      coiffeMaudite: {
        name: 'Coiffe maudite', icon: '👑', slot: 'head', rarity: 'commun', price: 0,
        effects: [{ kind: 'trigger', on: 'wrong', do: [{ action: 'money', mode: 'lose', target: 'self', n: 5 }] }],
      },
    });
    freshGame([{ money: 50, equipment: { head: 'coiffeMaudite', body: null, feet: null } }, {}]);
    S().askQuestion('maths');
    S().answerQuestion((S().showQuestion.question.c + 1) % 4, 10); // mauvaise
    expect(team(0).money).toBe(45);
    setItemsData(snapshot);
  });

  it('on:wrong interactif (piège) DIFFÈRE le passage de tour jusqu’à résolution', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      casquePiege: {
        name: 'Casque piégeur', icon: '🎩', slot: 'head', rarity: 'commun', price: 0,
        effects: [{ kind: 'trigger', on: 'wrong', do: [{ action: 'placeTrap', trap: { label: 'X', icon: '🪤', do: [{ action: 'move', target: 'self', dir: 'back', n: 1 }] } }] }],
      },
    });
    freshGame([{ equipment: { head: 'casquePiege', body: null, feet: null } }, {}]);
    S().askQuestion('maths');
    S().answerQuestion((S().showQuestion.question.c + 1) % 4, 10); // mauvaise réponse
    // sélecteur de case ouvert ET tour NON avancé (nextTurn différé)
    expect(S().showTilePicker).toBeTruthy();
    expect(S().pendingActions).toBeTruthy();
    expect(S().currentTeam).toBe(0);
    S().selectTile('n6');
    // file vidée → le nextTurn différé s'exécute
    expect(S().board.n6.trap).toBeTruthy();
    expect(S().pendingActions).toBeNull();
    expect(S().currentTeam).toBe(1);
    setItemsData(snapshot);
  });

  it('déclencheur on:correct — arme un bouclier à la bonne réponse', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      talisman: {
        name: 'Talisman', icon: '🔮', slot: 'feet', rarity: 'commun', price: 0,
        effects: [{ kind: 'trigger', on: 'correct', do: [{ action: 'shieldNext', n: 1 }] }],
      },
    });
    freshGame([{ equipment: { head: null, body: null, feet: 'talisman' } }, {}]);
    S().askQuestion('maths');
    S().answerQuestion(S().showQuestion.question.c, 10); // bonne
    expect(team(0).itemShield).toBe(1);
    setItemsData(snapshot);
  });

  it('lootBonusConsumable à l’échelle de la série (5%/série)', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      besace: {
        name: 'Besace', icon: '🎒', slot: 'body', rarity: 'commun', price: 0,
        effects: [{ type: 'lootBonusConsumable', value: { per: 'streak', factor: 5 } }],
      },
    });
    const t = mkTeam(0, { streak: 3, equipment: { head: null, body: 'besace', feet: null } });
    expect(getEffectValue(t, 'lootBonusConsumable')).toBe(15); // 5 × 3
    setItemsData(snapshot);
  });
});

// --- Marché Noir ---

describe('marché noir', () => {
  it('generateBlackMarketStock peut inclure des légendaires (lootOnly)', () => {
    let sawLegendary = false;
    for (let i = 0; i < 50 && !sawLegendary; i++) {
      const stock = generateBlackMarketStock(5);
      if (stock.some((k) => ITEMS[k]?.rarity === 'legendaire')) sawLegendary = true;
    }
    expect(sawLegendary).toBe(true); // exclus de la boutique normale, dispo au marché noir
  });

  it('buyItem applique la remise en mode marché noir', () => {
    freshGame([{ money: 1000, bag: [], equipment: { head: null, body: null, feet: null } }, {}]);
    const consK = Object.keys(ITEMS).find((k) => ITEMS[k].slot === 'consumable');
    useGameStore.setState({ showShop: { marcheNoir: true, stock: [consK], discount: 0.5 } });
    const before = team(0).money;
    S().buyItem(consK);
    expect(team(0).money).toBe(before - Math.max(1, Math.round(ITEMS[consK].price * 0.5)));
    expect(S().showShop.stock).not.toContain(consK); // retiré du stock marché noir
  });
});

// --- Loot de bonne réponse : canaux indépendants ---

describe('loot de bonne réponse', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lootBonusEquipment 100% garantit le loot même en répondant lentement', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      casqueExplo: {
        name: "Casque d'explorateur", icon: '🪖', slot: 'head', rarity: 'commun', price: 0,
        effects: [{ type: 'lootBonusEquipment', value: 100 }],
      },
    });
    freshGame([{ equipment: { head: 'casqueExplo', body: null, feet: null }, bag: [] }, {}]);
    // random élevé ⇒ le taux de BASE (× petit timeRatio) échouerait ; seul le
    // bonus flat de 100% garantit le drop.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    S().askQuestion('maths');
    S().answerQuestion(S().showQuestion.question.c, 1); // réponse lente ⇒ timeRatio ≈ 0.03
    expect(S().lootReveal).toBeTruthy();
    setItemsData(snapshot);
  });

  it('consommable ET équipement peuvent tomber au même tour (canaux indépendants)', () => {
    freshGame([{ equipment: { head: null, body: null, feet: null }, bag: [] }, {}]);
    // random = 0 ⇒ les deux tirages passent (0 < 0.12 et 0 < 0.10), et pickLootItem
    // choisit un objet de chaque catégorie.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    S().askQuestion('maths');
    S().answerQuestion(S().showQuestion.question.c, 30); // bonne, temps plein ⇒ timeRatio ≈ 1
    // deux objets révélés : le premier + un « rest » de longueur 1
    expect(S().lootReveal).toBeTruthy();
    expect(S().lootReveal.rest).toHaveLength(1);
  });

  it('le butin est révélé AVANT de passer la main (tour différé jusqu’à fermeture)', () => {
    freshGame([{ equipment: { head: null, body: null, feet: null }, bag: [] }, {}]);
    vi.spyOn(Math, 'random').mockReturnValue(0); // garantit un drop
    S().askQuestion('maths');
    S().answerQuestion(S().showQuestion.question.c, 30);
    // Le butin appartient à l'équipe 0 : il s'affiche pendant SON tour, la main
    // n'a pas encore tourné (sinon le coffre de l'équipe 1 le recouvrirait).
    expect(S().lootReveal).toBeTruthy();
    expect(S().lootReveal.thenNextTurn).toBe(true);
    expect(S().currentTeam).toBe(0);
    // On enchaîne les révélations jusqu'au bout, puis la main passe.
    S().dismissLoot();
    while (S().lootReveal) S().dismissLoot();
    expect(S().currentTeam).toBe(1);
  });
});

// --- indiceBoost passif (élimine des mauvaises réponses à chaque question) ---

describe('indiceBoost passif', () => {
  afterEach(() => vi.restoreAllMocks());

  it('élimine des mauvaises réponses dès l’ouverture de la question (dé résolu)', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      loupe: { name: 'Loupe', icon: '🔍', slot: 'head', rarity: 'commun', price: 0, effects: [{ type: 'indiceBoost', value: 'd3' }] },
    });
    freshGame([{ equipment: { head: 'loupe', body: null, feet: null } }, {}]);
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // d3 → 3 : retire toutes les mauvaises réponses
    S().askQuestion('maths');
    expect(S().indiceHidden).toHaveLength(3); // 3 mauvaises (c=1)
    expect(S().indiceHidden).not.toContain(1); // jamais la bonne réponse
    setItemsData(snapshot);
  });

  it('sans indiceBoost, aucune réponse masquée d’office', () => {
    freshGame([{}, {}]);
    S().askQuestion('maths');
    expect(S().indiceHidden).toHaveLength(0);
  });

  it('le pouvoir Indice ne consomme PAS de charge si tout est déjà masqué', () => {
    const snapshot = { ...ITEMS };
    setItemsData({
      ...ITEMS,
      loupePro: { name: 'Loupe pro', icon: '🔍', slot: 'head', rarity: 'commun', price: 0, effects: [{ type: 'indiceBoost', value: 'd3' }] },
    });
    freshGame([{ equipment: { head: 'loupePro', body: null, feet: null }, powers: { indice: { charges: 2, level: 1 } } }, {}]);
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // d3 → 3 : les 3 mauvaises masquées
    S().askQuestion('maths');
    expect(S().indiceHidden).toHaveLength(3);
    S().usePower('indice');
    expect(team(0).powers.indice.charges).toBe(2); // charge intacte (rien à éliminer)
    vi.restoreAllMocks();
    setItemsData(snapshot);
  });
});

// --- Consommables ---

describe('consommables : useConsumable', () => {
  beforeEach(() => freshGame());
  const giveBag = (items) => {
    const teams = [...S().teams];
    teams[0] = { ...teams[0], bag: items };
    useGameStore.setState({ teams });
  };

  it('gainMoney', () => {
    giveBag(['painVoyageur']);
    S().useConsumable(0);
    expect(team().money).toBe(58);
    expect(bagItems(team())).toHaveLength(0);
  });

  it('gainMoneyAll crédite toutes les équipes', () => {
    giveBag(['banquetPartage']);
    S().useConsumable(0);
    expect(team(0).money).toBe(55);
    expect(team(1).money).toBe(55);
    expect(team(2).money).toBe(55);
  });

  it('moveForward avance le pion avec animation', () => {
    giveBag(['potionHate']);
    S().useConsumable(0);
    expect(team().pos).toBe('n6');
    expect(S().movePath?.[0]?.waypoints?.length).toBe(3);
  });

  it('moveForward jusquà l’arrivée déclenche la victoire', () => {
    const teams = [...S().teams];
    teams[0] = { ...teams[0], pos: 'n8', bag: ['potionCelerite'] };
    useGameStore.setState({ teams });
    S().useConsumable(0);
    expect(team().pos).toBe('arrivee');
    expect(S().finished).toBe(true);
  });

  it('extraTime / shieldNext / fumigene posent leurs drapeaux', () => {
    giveBag(['sablierPoche', 'bouclierBois', 'bombeFumigene']);
    // Sac positionnel : chaque objet garde sa case
    S().useConsumable(0);
    S().useConsumable(1);
    S().useConsumable(2);
    expect(team().itemTimerBonus).toBe(10);
    expect(team().itemShield).toBe(1);
    expect(team().itemFumigene).toBe(true);
    expect(bagItems(team())).toHaveLength(0);
  });

  it('gainCharge ouvre le sélecteur de charge (contexte objet, pas dé de 1)', () => {
    // L'équipe doit posséder au moins un pouvoir, sinon gainCharge est sauté.
    const teams = [...S().teams];
    teams[0] = { ...teams[0], powers: { foudre: { charges: 0, level: 1 } } };
    useGameStore.setState({ teams });
    giveBag(['cristalEnergie']);
    S().useConsumable(0);
    // Passe désormais par le moteur d'effets : source 'engine' (recharge simple,
    // sans enchaînement offensif contrairement au dé de 1).
    expect(S().showChargePicker?.source).toBe('engine');
  });

  it('refusé pendant une question', () => {
    giveBag(['painVoyageur']);
    useGameStore.setState({ showQuestion: { question: QUESTIONS.maths[0] } });
    S().useConsumable(0);
    expect(bagItems(team())).toHaveLength(1);
  });
});

// --- Effets passifs en jeu ---

describe('effets passifs : questions', () => {
  beforeEach(() => freshGame());

  it('timerBonus (équipement + consommable one-shot)', () => {
    equip(0, 'head', 'bandeauSage'); // +5s
    const teams = [...S().teams];
    teams[0] = { ...teams[0], itemTimerBonus: 10 };
    useGameStore.setState({ teams });

    S().askQuestion('maths');
    expect(S().showQuestion.itemBonusTime).toBe(15);
    expect(team().itemTimerBonus).toBe(0); // le one-shot est consommé
  });

  it('moneyPerCorrect s’ajoute au gain de bonne réponse', () => {
    equip(0, 'body', 'banniereMarchand'); // +2
    S().askQuestion('maths');
    // les réponses sont mélangées : on lit l'index réel de la bonne réponse
    S().answerQuestion(S().showQuestion.question.c, 30); // plein temps => +10 de base
    expect(team().correct).toBe(1);
    expect(team().money).toBe(50 + 10 + 2);
  });

  it('reculReduction réduit le recul sur mauvaise réponse', () => {
    const t = mkTeam(0, { equipment: { head: null, body: null, feet: 'bottesUsees' } });
    const r = resolveWrongAnswer(t, BOARD);
    expect(r.updatedTeam.pos).toBe('n3'); // recul de 1 au lieu de 2
  });

  it('reculReductionPct réduit le recul en % (cumulable avec le forfait)', () => {
    ITEMS.__tpct = { name: 'TestPct', slot: 'feet', rarity: 'commun', price: 0, effects: [{ type: 'reculReductionPct', value: 50 }] };
    const t = mkTeam(0, { equipment: { head: null, body: null, feet: '__tpct' } });
    expect(reducedRecul(t, 6)).toBe(3); // −50 % de 6
    ITEMS.__tpct.effects.push({ type: 'reculReduction', value: 1 });
    expect(reducedRecul(t, 6)).toBe(2); // 6 → 3 (−50 %) → 2 (−1 case)
    delete ITEMS.__tpct;
  });

  it('Bouclier de bois (−1 case) consommé AVANT le pouvoir, qui reste intact si recul absorbé', () => {
    // Recul de 1 : le Bouclier de bois (−1) suffit, le pouvoir n'est pas entamé.
    const t = mkTeam(0, { itemShield: 1, powers: { bouclier: { charges: 2, level: 1 } } });
    const r = resolveWrongAnswer(t, BOARD, 'Mauvaise réponse', 1);
    expect(r.updatedTeam.pos).toBe('n4'); // recul 1 − 1 = 0
    expect(r.updatedTeam.itemShield).toBe(0);
    expect(r.updatedTeam.powers.bouclier.charges).toBe(2); // pouvoir intact
  });

  it('Bouclier de bois (−1) puis pouvoir Bouclier si le recul dépasse', () => {
    // Recul de 3 : bois −1 → 2, puis pouvoir niv.1 −2 → 0 (les deux consommés).
    const t = mkTeam(0, { itemShield: 1, powers: { bouclier: { charges: 1, level: 1 } } });
    const r = resolveWrongAnswer(t, BOARD, 'Mauvaise réponse', 3);
    expect(r.updatedTeam.pos).toBe('n4'); // recul absorbé
    expect(r.updatedTeam.itemShield).toBe(0);
    expect(r.updatedTeam.powers.bouclier.charges).toBe(0); // pouvoir entamé
  });

  it('indiceBoost élimine une réponse de plus', () => {
    const teams = [...S().teams];
    teams[0] = { ...teams[0], powers: { indice: { charges: 1, level: 1 } }, equipment: { head: 'lunettesLecture', body: null, feet: null } };
    useGameStore.setState({ teams });
    S().askQuestion('maths');
    S().usePower('indice');
    expect(S().indiceHidden).toHaveLength(2); // 1 (niv.1) + 1 boost lunettes
  });
});

describe('effets passifs : pouvoirs offensifs', () => {
  beforeEach(() => freshGame());

  it('fumigene annule un pouvoir offensif (charge attaquant consommée)', () => {
    const teams = [...S().teams];
    teams[0] = { ...teams[0], powers: { foudre: { charges: 1, level: 1 } } };
    teams[1] = { ...teams[1], itemFumigene: true };
    useGameStore.setState({ teams, showTargetPicker: { powerKey: 'foudre' } });
    S().applyOffensivePower(1);
    expect(team(1).pos).toBe('n4'); // pas de recul
    expect(team(1).itemFumigene).toBe(false);
    expect(team(0).powers.foudre.charges).toBe(0);
  });

  it('reculReduction atténue la Foudre', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 1D4 → 3
    const teams = [...S().teams];
    teams[0] = { ...teams[0], powers: { foudre: { charges: 1, level: 1 } } };
    teams[1] = { ...teams[1], equipment: { head: null, body: null, feet: 'bottesMontagne' } };
    useGameStore.setState({ teams, showTargetPicker: { powerKey: 'foudre' } });
    S().applyOffensivePower(1);
    expect(team(1).pos).toBe('n3'); // 1D4=3, -2 (bottes) = 1 case de recul
    vi.restoreAllMocks();
  });

  it('la Foudre (attaque offensive) IGNORE le pouvoir Bouclier de la cible', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 1D4 → 3
    const teams = [...S().teams];
    teams[0] = { ...teams[0], powers: { foudre: { charges: 1, level: 1 } } };
    teams[1] = { ...teams[1], powers: { bouclier: { charges: 1, level: 3 } } };
    useGameStore.setState({ teams, showTargetPicker: { powerKey: 'foudre' } });
    S().applyOffensivePower(1);
    expect(team(1).pos).toBe('n1'); // recul 3 plein : le bouclier ne protège pas
    expect(team(1).powers.bouclier.charges).toBe(1); // charge non consommée
    vi.restoreAllMocks();
  });

  it('Foudre niv.8 recule de 1D10', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.95); // 1D10 → 10
    const teams = [...S().teams];
    teams[0] = { ...teams[0], powers: { foudre: { charges: 1, level: 8 } } };
    teams[1] = { ...teams[1], pos: 'n8' };
    useGameStore.setState({ teams, showTargetPicker: { powerKey: 'foudre' } });
    S().applyOffensivePower(1);
    // 1D10=10 depuis n8 → retour au départ (un 1D4 max=4 donnerait n4)
    expect(team(1).pos).toBe('depart');
    vi.restoreAllMocks();
  });
});

// --- Hooks événements ---

function runEvent(key, data = {}) {
  useGameStore.setState({
    showEvent: { key, event: EVENTS[key], phase: 'intro', data },
    eventApplied: false,
  });
  S().applyEventEffect();
}

describe('effets passifs : événements', () => {
  beforeEach(() => freshGame());

  it('talismanOr annule l’impôt', () => {
    equip(0, 'body', 'talismanOr');
    runEvent('impot');
    expect(team().money).toBe(50);
  });

  it('sans protection, l’impôt prélève 30%', () => {
    runEvent('impot');
    expect(team().money).toBe(35);
  });

  it('ancreMarine immunise contre la tempête', () => {
    equip(0, 'feet', 'ancreMarine');
    runEvent('tempete', { diceValue: 3 });
    expect(team(0).pos).toBe('n4'); // immunisé
    expect(team(1).pos).toBe('n1'); // a reculé de 3
  });

  it('grappin : le trou de l’oubli devient un recul de 3', () => {
    equip(0, 'feet', 'grappinVoyageur');
    runEvent('oubli');
    expect(team().pos).toBe('n1');
  });

  it('le pouvoir Bouclier absorbe un recul d’événement (bouclier universel)', () => {
    const teams = [...S().teams];
    teams[0] = { ...teams[0], powers: { bouclier: { charges: 1, level: 1 } } };
    useGameStore.setState({ teams });
    runEvent('recul'); // recul de 2, niv.1 retire 2
    expect(team(0).pos).toBe('n4'); // pas de recul
    expect(team(0).powers.bouclier.charges).toBe(0); // charge consommée
  });

  it('le Bouclier de bois réduit d’1 case un recul d’événement', () => {
    const teams = [...S().teams];
    teams[0] = { ...teams[0], itemShield: 1 };
    useGameStore.setState({ teams });
    runEvent('recul'); // recul de 2 − 1 (bois) = 1 : n4 → n3
    expect(team(0).pos).toBe('n3');
    expect(team(0).itemShield).toBe(0);
  });

  it('capeOmbre divise le vol de pièces par deux', () => {
    equip(1, 'body', 'capeOmbre');
    runEvent('volArgent', { targetIndex: 1 });
    expect(team(1).money).toBe(45); // 5 volées au lieu de 10
    expect(team(0).money).toBe(55);
  });

  it('coffre : un objet est looté et révélé (visuel C)', () => {
    runEvent('coffre');
    const t = team();
    const equippedOrBagged = Object.values(t.equipment).some(Boolean) || bagItems(t).length > 0;
    const refunded = t.money > 50;
    expect(equippedOrBagged || refunded).toBe(true);
    if (equippedOrBagged) {
      // Objet conservé : révélation visuel C (LootReveal), événement fermé
      expect(S().lootReveal?.itemKey).toBeTruthy();
      expect(ITEMS[S().lootReveal.itemKey]).toBeTruthy();
      expect(S().showEvent).toBeNull();
    } else {
      // Sac plein : pas de révélation, message texte dans le ResultPhase
      expect(S().lootReveal).toBeNull();
    }
  });
});

describe('événements : marchand ambulant & pillage', () => {
  beforeEach(() => freshGame());

  it('marchand : -30% et objet reçu', () => {
    useGameStore.setState({ showEvent: { key: 'marchandAmbulant', event: EVENTS.marchandAmbulant, phase: 'choice', data: { merchandise: ['bandeauSage'] } } });
    S().eventMerchantBuy('bandeauSage'); // 24 -> 17
    expect(team(0).equipment.head).toBe('bandeauSage');
    expect(team(0).money).toBe(50 - 17);
    expect(S().showEvent).toBeNull();
  });

  it('pillage : vole un équipement ciblé', () => {
    equip(1, 'feet', 'pegase');
    useGameStore.setState({ showEvent: { key: 'pillage', event: EVENTS.pillage, phase: 'choice', data: { targetIndex: 1 } } });
    S().eventPillageApply({ kind: 'equipment', slot: 'feet' });
    expect(team(1).equipment.feet).toBeNull();
    expect(team(0).equipment.feet).toBe('pegase');
  });

  it('pillage : vole un consommable du sac', () => {
    const teams = [...S().teams];
    teams[1] = { ...teams[1], bag: ['bombeFumigene'] };
    useGameStore.setState({ teams, showEvent: { key: 'pillage', event: EVENTS.pillage, phase: 'choice', data: { targetIndex: 1 } } });
    S().eventPillageApply({ kind: 'bag', index: 0 });
    expect(bagItems(team(1))).toHaveLength(0);
    expect(bagItems(team(0))).toEqual(['bombeFumigene']);
  });
});

// --- Combat ---

describe('combat : butin et protections', () => {
  beforeEach(() => {
    freshGame();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const setupFight = () => {
    useGameStore.setState({
      showFight: {
        attackerIndex: 0, defenderIndex: 1, subject: 'maths',
        phase: 'reward', round: 3, wins: { attacker: 2, defender: 1 },
        winnerSide: 'attacker', reward: null, resultMessage: null,
      },
    });
  };

  it('butin (loot) : vole l’unique objet du perdant', () => {
    const teams = [...S().teams];
    teams[1] = { ...teams[1], bag: ['elixirGeant'] };
    useGameStore.setState({ teams });
    setupFight();
    S().fightChooseReward('loot');
    vi.advanceTimersByTime(700);
    expect(bagItems(team(1))).toHaveLength(0);
    expect(bagItems(team(0))).toEqual(['elixirGeant']);
    expect(S().showFight.phase).toBe('result');
  });

  it('butin : perdant sans objet => fouille du champ de bataille', () => {
    setupFight();
    S().fightChooseReward('loot');
    vi.advanceTimersByTime(700);
    const w = team(0);
    const got = Object.values(w.equipment).some(Boolean) || bagItems(w).length > 0 || w.money > 50;
    expect(got).toBe(true);
  });

  it('armureGarde : pillage de pièces en combat entièrement bloqué', () => {
    equip(1, 'body', 'armureGarde');
    setupFight();
    S().fightChooseReward('steal');
    vi.advanceTimersByTime(3000); // animation dés + délai
    expect(team(1).money).toBe(50);
    expect(team(0).money).toBe(50);
    expect(S().showFight.phase).toBe('result');
  });
});

// --- Drag & drop de l'inventaire ---

describe('inventaire : moveInventoryItem / isValidMove', () => {
  beforeEach(() => freshGame());
  const giveBag = (items) => {
    const teams = [...S().teams];
    teams[0] = { ...teams[0], bag: items };
    useGameStore.setState({ teams });
  };

  it('équipe depuis le sac vers le bon slot', () => {
    giveBag(['bandeauSage']); // coiffe (head)
    expect(isValidMove(team(), 'bag:0', 'equip:head')).toBe(true);
    expect(isValidMove(team(), 'bag:0', 'equip:feet')).toBe(false);
    S().moveInventoryItem('bag:0', 'equip:head');
    expect(team().equipment.head).toBe('bandeauSage');
    expect(bagItems(team())).toHaveLength(0);
  });

  it('un consommable ne va dans aucun slot d’équipement', () => {
    giveBag(['potionHate']);
    expect(isValidMove(team(), 'bag:0', 'equip:head')).toBe(false);
    expect(isValidMove(team(), 'bag:0', 'equip:body')).toBe(false);
    S().moveInventoryItem('bag:0', 'equip:body'); // refusé
    expect(team().equipment.body).toBeNull();
    expect(bagItems(team())).toEqual(['potionHate']);
  });

  it('échange slot occupé <-> sac (swap)', () => {
    equip(0, 'head', 'chapeauPaille');
    giveBag(['bandeauSage']);
    S().moveInventoryItem('bag:0', 'equip:head');
    expect(team().equipment.head).toBe('bandeauSage');
    expect(team().bag[0]).toBe('chapeauPaille'); // l'ancien revient dans la même case
  });

  it('déséquipe vers une case vide du sac', () => {
    equip(0, 'feet', 'pegase');
    S().moveInventoryItem('equip:feet', 'bag:5');
    expect(team().equipment.feet).toBeNull();
    expect(team().bag[5]).toBe('pegase');
  });

  it('déséquiper sur une case occupée : seulement si l’objet délogé est compatible', () => {
    equip(0, 'head', 'chapeauPaille');
    giveBag(['potionHate', 'bandeauSage']);
    // potion ne peut pas prendre la place du chapeau
    expect(isValidMove(team(), 'equip:head', 'bag:0')).toBe(false);
    // bandeauSage (coiffe) peut : swap
    expect(isValidMove(team(), 'equip:head', 'bag:1')).toBe(true);
    S().moveInventoryItem('equip:head', 'bag:1');
    expect(team().equipment.head).toBe('bandeauSage');
    expect(team().bag[1]).toBe('chapeauPaille');
  });

  it('réorganisation libre dans le sac', () => {
    giveBag(['potionHate', 'painVoyageur']);
    S().moveInventoryItem('bag:0', 'bag:7');
    expect(team().bag[7]).toBe('potionHate');
    expect(team().bag[0]).toBeNull();
    S().moveInventoryItem('bag:1', 'bag:7'); // swap libre
    expect(team().bag[7]).toBe('painVoyageur');
    expect(team().bag[1]).toBe('potionHate');
  });
});

