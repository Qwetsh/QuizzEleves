// Client « jeu en ligne » (miroir) : pilotage du tour DIRECTEMENT à l'écran.
//
// Le miroir rend le plateau complet (modales TBI incluses) depuis le snapshot
// diffusé par l'hôte — mais il n'est PAS l'autorité : un clic ne doit jamais
// muter l'état local, il doit envoyer l'intent `turn*` correspondant à l'hôte
// (mêmes gardes que la manette téléphone, anti-triche inchangé).
//
// Plutôt que de modifier chaque modale (QuestionModal, EventModal, coffre…),
// on REMPLACE ici, dans le store du miroir uniquement, les actions de tour
// qu'elles appellent par des émetteurs d'intents. Les composants restent
// identiques pour le TBI classe et la manette téléphone.
//
// Sans effet hors miroir : à n'appeler qu'une fois côté OnlineClient, après
// l'hydratation du premier snapshot (hydrateSnapshot ne touche que les champs
// de données, jamais ces actions).
import { useGameStore } from '../store/gameStore';
import { sendIntent, randomToken } from './sessionConfig';
import { questionRerollOptions } from '../store/effectEngine';
import { normalizeBag, cellKey } from '../store/itemHandlers';

export function bindMirrorTurnActions(code, token) {
  // uid : anti-doublon côté hôte (fetch + realtime peuvent livrer deux fois).
  const send = (type, payload = {}) => {
    sendIntent(code, token, type, { ...payload, uid: randomToken() }).catch(() => {});
  };

  useGameStore.setState({
    // --- Déplacement ---
    rollDice: () => send('turnRoll'),
    chooseJunction: (nodeId) => send('turnChooseJunction', { nodeId }),
    confirmLanding: () => send('turnConfirmLanding'),
    teleportToCheckpoint: () => send('turnCheckpoint'),

    // --- Question ---
    selectAnswer: (index) => send('turnAnswerSelect', { index }),
    continueQuestion: () => send('turnQuestionContinue'),
    // Le timeout est arbitré par l'hôte (son horloge fait foi) : le timer local
    // de QuestionModal ne doit pas muter l'état du miroir.
    revealQuestionTimeout: () => {},
    useQuestionReroll: (opt) => {
      // L'intent attend l'INDEX dans la liste d'options ; on la recalcule ici
      // (mêmes entrées snapshot ⇒ même liste que celle affichée par la modale).
      const s = useGameStore.getState();
      const team = s.teams[s.currentTeam];
      if (!team || !s.showQuestion) return;
      const opts = questionRerollOptions(team, s.rerollUsed, s.showQuestion.subject);
      const i = opts.findIndex((o) => JSON.stringify(o) === JSON.stringify(opt));
      if (i >= 0) send('turnUseReroll', { optIndex: i });
    },

    // --- Pouvoirs & consommables (pendant mon tour) ---
    usePower: (key) => send('turnUsePower', { key }),
    useConsumable: (i) => {
      // Par CLÉ : même contrat que la manette téléphone (sac positionnel côté hôte).
      const s = useGameStore.getState();
      const team = s.teams[s.currentTeam];
      const key = cellKey(normalizeBag(team?.bag)[i]);
      if (key) send('turnUseConsumable', { key });
    },

    // --- Pickers (interrupts moteur d'effets / pouvoirs) ---
    selectTarget: (index) => send('turnSelectTarget', { index }),
    cancelTargetPicker: () => send('turnCancelTarget'),
    selectSubject: (key) => send('turnSelectSubject', { key }),
    chargePickerChoice: (key) => send('turnChargePick', { key }),
    chargePickerSkip: () => send('turnChargeSkip'),
    selectTile: (nodeId) => send('turnSelectTile', { nodeId }),
    cancelTilePicker: () => send('turnCancelTile'),

    // --- Duel (choix de l'arrivant) ---
    chooseDuel: (index) => send('turnDuelChoose', { index }),
    declineDuel: () => send('turnDuelDecline'),

    // --- Cinématiques auto-pilotées (timers d'animation) : l'HÔTE est la
    // seule horloge — le timer local du miroir ne doit rien muter ni envoyer
    // (la garde « équipe active » de l'hôte filtrerait, autant no-op ici).
    completeDiceRoll: () => {},
    revealEvent: () => {},

    // --- Événements ---
    acceptEvent: () => send('turnEventAccept'),
    declineEvent: () => send('turnEventDecline'),
    eventSelectTarget: (index) => send('turnEventTarget', { index }),
    eventAnswerQuestion: (index) => send('turnEventAnswer', { index }),
    eventVaToutContinue: () => send('turnEventVaToutContinue'),
    eventVaToutCashOut: () => send('turnEventVaToutCashOut'),
    eventChooseGift: (itemKey) => send('turnEventGift', { itemKey }),
    eventRechargeChoice: (key) => send('turnEventRecharge', { key }),
    eventMarcheNoirBuy: (key) => send('turnEventMarcheNoir', { key }),
    eventMerchantBuy: (itemKey) => send('turnEventBuy', { itemKey }),
    eventVolApply: (stealKey, giveKey) => send('turnEventVol', { stealKey, giveKey }),
    eventTrade: (pick) => send('turnEventTradePick', { pick }),
    eventPillageApply: (pick) => send('turnEventPillage', { pick }),
    startBossFight: (subject) => send('turnEventBoss', { subject }),
    closeEvent: () => send('turnEventClose'),

    // --- Marché Noir (boutique louche d'événement, instance TBI partagée) ---
    buyItem: (key) => send('buyItem', { key }),
    closeShop: () => send('turnShopClose'),

    // --- Investissement / voie de Maîtrise / enchantement ---
    confirmInvest: (amount) => send('turnInvestConfirm', { amount }),
    cancelInvest: () => send('turnInvestCancel'),
    dismissInvestResult: () => send('turnInvestDismiss'),
    chooseSpec: (specKey) => send('turnChooseSpec', { specKey }),
    chooseEnchantSlot: (slot) => send('turnEnchantSlot', { slot }),
    cancelEnchant: () => send('turnEnchantCancel'),

    // --- Loot / coffre de départ / prompt boutique / métier ---
    dismissLoot: () => send('turnLootDismiss'),
    // Choix UNIQUE : la modale passe une STRING (close(key)) ; multiple : un
    // tableau (validate(picked)) ; « rien » : null. L'intent attend un tableau.
    closeStarterChest: (keys) => send('turnStarterChest', {
      keys: Array.isArray(keys) ? keys : keys ? [keys] : [],
    }),
    acceptShopPrompt: () => send('turnShopAccept'),
    dismissShopPrompt: () => send('turnShopDismiss'),
    chooseMetier: (craft) => send('chooseMetier', { craft }),
  });
}
