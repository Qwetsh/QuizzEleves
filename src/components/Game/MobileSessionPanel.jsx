// Panneau « Mode mobile » côté TBI : crée une session, publie en continu
// l'état des équipes vers Supabase, et affiche le QR + code d'appairage. Tout
// est optionnel — si on ne l'active pas, rien n'est publié et le jeu tourne seul.
import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useGameStore } from '../../store/gameStore';
import { createSession, publishSession, buildSessionPayload, joinUrl } from '../../logic/sessionConfig';

export default function MobileSessionPanel() {
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const finished = useGameStore((s) => s.finished);
  const shopStock = useGameStore((s) => s.shopStock);
  const shopFaceStock = useGameStore((s) => s.shopFaceStock);
  const log = useGameStore((s) => s.log);
  const extensions = useGameStore((s) => s.extensions);
  const lv2Mode = useGameStore((s) => s.lv2Mode);
  // Journal analytique : alimente l'onglet mobile « anciennes questions ».
  const gameStats = useGameStore((s) => s.gameStats);
  const englishMode = useGameStore((s) => s.englishMode);
  // Prestation de forgeage en cours (diffusée aux 2 mobiles concernés).
  const forgeService = useGameStore((s) => s.forgeService);
  // « Hacking » : l'état piraté est porté par chaque équipe (t.hackedTurns) et
  // donc déjà répercuté via `teams` dans le payload — rien de plus à abonner.
  // Code de session partagé (créé ici en mode tableau, ou par le lobby en mode
  // téléphone) — source unique dans le store.
  const code = useGameStore((s) => s.sessionCode);
  const setSessionCode = useGameStore((s) => s.setSessionCode);
  // Verrou d'édition mobile : pendant une résolution (question/duel/événement/
  // déplacement), les téléphones ne peuvent pas modifier l'équipement.
  const locked = useGameStore((s) => !!(s.showQuestion || s.showEvent || s.showFight || s.showDuelChoice
    || s.rolling || s.showDiceModal || s.awaitingChoice || s.pendingActions || s.pendingLanding));
  // Manette téléphone : états du tour publiés dans le bloc `turn` du payload.
  // ⚠️ Chaque état lu par buildTurnPayload DOIT être abonné ici ET listé dans
  // les deps du useEffect de publication — sinon un changement interne à une
  // résolution (révélation de réponse, phase d'événement…) ne republierait pas
  // et la manette se figerait silencieusement.
  const phoneController = useGameStore((s) => s.phoneController);
  const board = useGameStore((s) => s.board);
  const rolling = useGameStore((s) => s.rolling);
  const showDiceModal = useGameStore((s) => s.showDiceModal);
  const diceValue = useGameStore((s) => s.diceValue);
  const awaitingChoice = useGameStore((s) => s.awaitingChoice);
  const pendingMove = useGameStore((s) => s.pendingMove);
  const pendingLanding = useGameStore((s) => s.pendingLanding);
  const showQuestion = useGameStore((s) => s.showQuestion);
  const showEvent = useGameStore((s) => s.showEvent);
  const showFight = useGameStore((s) => s.showFight);
  const showDuelChoice = useGameStore((s) => s.showDuelChoice);
  const showTargetPicker = useGameStore((s) => s.showTargetPicker);
  const showTilePicker = useGameStore((s) => s.showTilePicker);
  const showSubjectPicker = useGameStore((s) => s.showSubjectPicker);
  const showChargePicker = useGameStore((s) => s.showChargePicker);
  const showActionDice = useGameStore((s) => s.showActionDice);
  const lootReveal = useGameStore((s) => s.lootReveal);
  const showStarterChest = useGameStore((s) => s.showStarterChest);
  const lastStarterReward = useGameStore((s) => s.lastStarterReward);
  const showShopPrompt = useGameStore((s) => s.showShopPrompt);
  const showMetierPicker = useGameStore((s) => s.showMetierPicker);
  const indiceHidden = useGameStore((s) => s.indiceHidden);
  const indiceUsed = useGameStore((s) => s.indiceUsed);
  const rerollUsed = useGameStore((s) => s.rerollUsed);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const turnState = {
    finished, teams, currentTeam, board,
    rolling, showDiceModal, diceValue, awaitingChoice, pendingMove, pendingLanding,
    showQuestion, showEvent, showFight, showDuelChoice,
    showTargetPicker, showTilePicker, showSubjectPicker, showChargePicker, showActionDice,
    lootReveal, showStarterChest, lastStarterReward, showShopPrompt, showMetierPicker, indiceHidden, indiceUsed, rerollUsed,
  };

  // Tant que la session est active, republie à chaque changement pertinent
  // (débounce léger pour grouper les rafales de mise à jour).
  useEffect(() => {
    if (!code) return;
    const payload = buildSessionPayload({ teams, currentTeam, status: finished ? 'finished' : 'playing', shopStock, shopFaceStock, log, extensions, locked, lv2Mode, englishMode, gameStats, forgeService, phoneController, turnState });
    const id = setTimeout(() => { publishSession(code, payload).catch(() => {}); }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, teams, currentTeam, finished, shopStock, shopFaceStock, log, extensions, locked, lv2Mode, englishMode, gameStats, forgeService,
    phoneController, board, rolling, showDiceModal, diceValue, awaitingChoice, pendingMove, pendingLanding,
    showQuestion, showEvent, showFight, showDuelChoice, showTargetPicker, showTilePicker, showSubjectPicker,
    showChargePicker, showActionDice, lootReveal, showStarterChest, lastStarterReward, showShopPrompt, showMetierPicker, indiceHidden, indiceUsed, rerollUsed]);

  // Heartbeat : republication périodique même sans changement d'état, pour que
  // les téléphones distinguent « rien ne bouge » de « liaison morte » (bandeau
  // reconnexion de la manette). Le payload courant est lu via une ref (toujours
  // frais, sans réarmer l'intervalle à chaque rendu).
  const heartbeatRef = useRef(null);
  heartbeatRef.current = { code, args: { teams, currentTeam, status: finished ? 'finished' : 'playing', shopStock, shopFaceStock, log, extensions, locked, lv2Mode, englishMode, gameStats, forgeService, phoneController, turnState } };
  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => {
      const h = heartbeatRef.current;
      if (h?.code) publishSession(h.code, buildSessionPayload(h.args)).catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [code]);

  async function activate() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const payload = buildSessionPayload({ teams, currentTeam, status: finished ? 'finished' : 'playing', shopStock, shopFaceStock, log, extensions, locked, lv2Mode, englishMode, gameStats, forgeService, phoneController, turnState });
      setSessionCode(await createSession(payload));
      setOpen(true);
    } catch (e) { setError(e.message || 'Connexion impossible'); }
    setBusy(false);
  }

  const url = code ? joinUrl(code) : '';

  return (
    <>
      <button
        className="btn btn--ghost btn--sm"
        onClick={code ? () => setOpen(true) : activate}
        disabled={busy}
        title={code ? 'Afficher le QR de connexion' : 'Activer le suivi sur téléphone'}
      >
        {busy ? '…' : code ? `📱 ${code}` : '📱 Mobile'}
      </button>

      {open && code && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center',
            background: 'rgba(28,18,6,0.6)', backdropFilter: 'blur(4px)' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: 340, maxWidth: '90vw', padding: '22px 24px 24px', borderRadius: 22, textAlign: 'center',
              background: 'linear-gradient(180deg, #fffefb, #f4e8cf)', border: '1.5px solid var(--gold-600)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#8a6418' }}>
              {'📱'} Suivi sur téléphone
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-600)', margin: '6px 0 16px' }}>
              Scanne le QR, ou va sur le lien et entre le code.
            </p>
            <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 16, boxShadow: 'inset 0 0 0 1px rgba(122,94,58,0.2)' }}>
              <QRCodeSVG value={url} size={196} level="M" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, letterSpacing: '0.3em', textIndent: '0.3em', color: 'var(--ink-900)', margin: '14px 0 4px' }}>
              {code}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)', wordBreak: 'break-all' }}>{url}</div>
            <button className="btn btn--ghost btn--sm" style={{ marginTop: 16 }} onClick={() => setOpen(false)}>Fermer</button>
          </div>
        </div>
      )}

      {error && <span style={{ fontSize: 11, color: '#b5341f' }}>{error}</span>}
    </>
  );
}
