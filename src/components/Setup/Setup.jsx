import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { loadGame } from '../../store/persistence';
import { SUBJECTS, SUBJECT_KEYS, MODULES } from '../../data/subjects';
import { getMinigame, getDefaultMinigame } from '../Fight/minigames';
import { ITEMS } from '../../data/items';
import LootReveal from '../Modals/LootReveal';
import QuestionsEditor from './QuestionsEditor';
import BalanceEditor from './BalanceEditor';
import LevelSelect from './LevelSelect';
import SubjectSelect from './SubjectSelect';
import TeamCount from './TeamCount';
import TeamCustomization from './TeamCustomization';
import BoardParams from './BoardParams';
import EventsChecklist from './EventsChecklist';
import ItemsChecklist, { equipmentItemKeys } from './ItemsChecklist';
import StarterChestConfig from './StarterChestConfig';
import ExtensionsChecklist from './ExtensionsChecklist';
import RulesConfig from './RulesConfig';
import ConnectionMode from './ConnectionMode';
import LobbyPanel from './LobbyPanel';
import EventsEditor from './EventsEditor';
import SetupSection from './SetupSection';
import { EVENTS } from '../../data/events';
import { EXTENSIONS, extOn } from '../../extensions/registry';
import { OFFLINE } from '../../logic/offline';

// Simulateur de combat — visible uniquement en dev (npm run dev), jamais en prod.
// Lance un duel direct entre les deux premières équipes du setup, sans toucher
// à la sauvegarde (bac à sable). Quitter : bouton ✕ du jeu.
function DevFightPanel() {
  const devStartFight = useGameStore((s) => s.devStartFight);
  const showLoot = useGameStore((s) => s.showLoot);

  const revealRandomLoot = () => {
    const keys = Object.keys(ITEMS);
    const key = keys[Math.floor(Math.random() * keys.length)];
    showLoot(key, { title: '\u{1F381} Objet obtenu !', subtitle: 'Aperçu (dev)' });
  };

  return (
    <div className="panel" style={{ border: '2px dashed #c9472f', background: 'rgba(201,71,47,0.04)' }}>
      <div className="field-label" style={{ color: '#c9472f' }}>
        {"\u{1F6E0}️ Dev — simulateur de combat (localhost)"}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 10 }}>
        Duel direct entre les 2 premières équipes ci-dessus. La sauvegarde n'est pas touchée — quitte avec ✕.
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SUBJECT_KEYS.map((key) => {
          const s = SUBJECTS[key];
          const mg = getMinigame(key);
          return (
            <button
              key={key}
              onClick={() => devStartFight(key)}
              className="btn btn--ghost btn--sm"
              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
            >
              {s.icon} {mg.name}
            </button>
          );
        })}
        <button
          onClick={() => devStartFight(SUBJECT_KEYS[Math.floor(Math.random() * SUBJECT_KEYS.length)], true)}
          className="btn btn--ghost btn--sm"
          style={{ justifyContent: 'flex-start', textAlign: 'left' }}
        >
          {"⚡"} {getDefaultMinigame().name} (générique)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2" style={{ marginTop: 10 }}>
        <button
          onClick={revealRandomLoot}
          className="btn btn--green btn--sm"
          style={{ gridColumn: '1 / -1', justifyContent: 'center' }}
        >
          {"\u{1F381} Aperçu gain d'objet"}
        </button>
      </div>

      {/* La révélation se porte vers document.body (portal) : visible par-dessus le setup */}
      <LootReveal />
    </div>
  );
}

// Outils d'édition (questions + équilibrage). Disponibles en dev (npm run dev)
// OU déverrouillés en prod via le triple-clic sur le dé + code de validation
// (voir Setup). Les éditeurs écrivent directement dans Supabase.
function EditorTools() {
  const [showQuestionsEditor, setShowQuestionsEditor] = useState(false);
  const [showBalanceEditor, setShowBalanceEditor] = useState(false);
  const [showEventsEditor, setShowEventsEditor] = useState(false);
  return (
    <div className="panel" style={{ border: '2px dashed #2f6dc9', background: 'rgba(47,109,201,0.04)' }}>
      <div className="field-label" style={{ color: '#2f6dc9' }}>{'\u{1F6E0}️'} Outils d'édition</div>
      <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 10 }}>
        Édition des questions et de l'équilibrage (objets, pouvoirs, loot) — écrit dans Supabase.
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setShowQuestionsEditor(true)} className="btn btn--blue btn--sm" style={{ justifyContent: 'center' }}>
          {"\u{1F4DA} Éditer les questions"}
        </button>
        <button onClick={() => setShowBalanceEditor(true)} className="btn btn--blue btn--sm" style={{ justifyContent: 'center' }}>
          {"⚖️ Éditer l'équilibrage"}
        </button>
        <button onClick={() => setShowEventsEditor(true)} className="btn btn--blue btn--sm" style={{ justifyContent: 'center' }}>
          {"✨ Éditer les événements"}
        </button>
        <button
          onClick={() => window.open(`${window.location.origin}${import.meta.env.BASE_URL || '/'}?analyse`, '_blank', 'noopener')}
          className="btn btn--blue btn--sm" style={{ justifyContent: 'center' }}>
          {"📊 Analyse des parties"}
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 8 }}>
        {"⚗️ L'alchimie (ingrédients, potions, recettes) se gère dans l'éditeur d'équilibrage → onglet « Alchimie »."}
      </div>
      {showQuestionsEditor && <QuestionsEditor onClose={() => setShowQuestionsEditor(false)} />}
      {showBalanceEditor && <BalanceEditor onClose={() => setShowBalanceEditor(false)} />}
      {showEventsEditor && <EventsEditor onClose={() => setShowEventsEditor(false)} />}
    </div>
  );
}

const TOOLS_UNLOCK_KEY = 'quete_tools_unlock';
const TOOLS_CODE = '54150';

export default function Setup() {
  const T = useT();
  const startGame = useGameStore((s) => s.startGame);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const extensions = useGameStore((s) => s.extensions);
  const itemsOn = extOn(extensions, 'equipment');
  const connectionMode = useGameStore((s) => s.connectionMode);
  const classLabel = useGameStore((s) => s.classLabel);
  const setClassLabel = useGameStore((s) => s.setClassLabel);
  const englishMode = useGameStore((s) => s.englishMode);
  const setEnglishMode = useGameStore((s) => s.setEnglishMode);
  // Lectures pour les résumés d'accordéon (« Options de jeu »).
  const boardParams = useGameStore((s) => s.boardParams);
  const selectedSubjects = useGameStore((s) => s.selectedSubjects);
  useGameStore((s) => s.questionsVersion); // re-render quand le catalogue change
  const enabledEvents = useGameStore((s) => s.enabledEvents);
  const enabledItems = useGameStore((s) => s.enabledItems);
  const starterChestConfig = useGameStore((s) => s.starterChestConfig);
  const forcedDuels = useGameStore((s) => s.forcedDuels);
  // Hors ligne : le volet téléphone (lobby/QR/Realtime) est indisponible → on
  // force la création d'équipes au tableau.
  const phoneMode = !OFFLINE && connectionMode === 'phone';
  const [hasSave, setHasSave] = useState(false);
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  // Accès aux outils d'édition hors dev : triple-clic sur le dé + code.
  const [toolsUnlocked, setToolsUnlocked] = useState(() => {
    try { return localStorage.getItem(TOOLS_UNLOCK_KEY) === '1'; } catch { return false; }
  });
  const diceClicks = useRef({ n: 0, t: 0 });

  useEffect(() => {
    const saved = loadGame();
    setHasSave(saved !== null);
  }, []);

  // Triple-clic (< 700 ms entre chaque) sur le dé → demande le code de validation.
  const handleDiceClick = () => {
    const now = Date.now();
    const c = diceClicks.current;
    if (now - c.t > 700) c.n = 0;
    c.t = now; c.n += 1;
    if (c.n < 3) return;
    c.n = 0;
    if (toolsUnlocked) return;
    const code = window.prompt(T('setup.toolsPrompt'));
    if (code == null) return;
    if (code.trim() === TOOLS_CODE) {
      try { localStorage.setItem(TOOLS_UNLOCK_KEY, '1'); } catch { /* quota */ }
      setToolsUnlocked(true);
    } else {
      window.alert(T('setup.toolsBadCode'));
    }
  };
  const showTools = import.meta.env.DEV || toolsUnlocked;

  // Résumés d'une ligne pour les accordéons « Options de jeu ».
  const extActive = EXTENSIONS.filter((e) => extOn(extensions, e.id));
  const extSummary = extActive.length ? extActive.map((e) => `${e.icon} ${e.name}`).join(' · ') : T('setup.sumNone');
  const bp = boardParams || {};
  const eventsStr = (bp.eventEveryX ?? 0) < 1 ? T('setup.sumEventsOff') : T('setup.sumEventsEvery', { n: bp.eventEveryX });
  const boardSummary = T('setup.sumBoard', { cases: bp.casesParVoie, voies: bp.nbVoies, events: eventsStr });
  const eventsSummary = T('setup.sumActive', { n: (enabledEvents || []).length, total: Object.keys(EVENTS).length });
  const itemKeys = equipmentItemKeys();
  const itemsCount = (enabledItems || []).filter((k) => itemKeys.includes(k)).length;
  const chestOn = starterChestConfig ? starterChestConfig.enabled !== false : false;
  const itemsSummary = T('setup.sumItems', { n: itemsCount, chest: chestOn ? T('setup.sumChestOn') : T('setup.sumChestOff') });
  const rulesSummary = forcedDuels ? T('setup.sumDuelsForced') : T('setup.sumDuelsChoice');
  // Les niveaux scolaires (6e/3e…) ne sont pertinents que si un thème SCOLAIRE est
  // sélectionné (Collège, Lycée…). Pour une partie 100 % ludique → on les masque.
  const selSubs = Array.isArray(selectedSubjects) ? selectedSubjects : [];
  const hasSchoolSel = !selSubs.length || selSubs.some((k) => (MODULES[SUBJECTS[k]?.module || 'college']?.kind ?? 'school') === 'school');

  return (
    <div className="absolute inset-0 overflow-y-auto">
      {/* En-tête collant : identité + actions principales (Classe, langue, Outils,
          Reprendre, Lancer). Le dé garde le triple-clic de déverrouillage outils. */}
      <div
        className="sticky top-0 z-20"
        style={{
          background: 'linear-gradient(180deg, #fbf3e0 0%, #f6ecd6 100%)',
          borderBottom: '1px solid rgba(122,94,58,0.18)',
          boxShadow: '0 6px 18px rgba(80,52,8,0.10)',
          padding: '14px 24px',
        }}
      >
        <div className="max-w-[1180px] mx-auto flex items-center gap-4 flex-wrap">
          <div
            className="flex items-center justify-center"
            onClick={handleDiceClick}
            style={{
              width: 56, height: 56, borderRadius: 16, fontSize: 30, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--gold-400), var(--gold-600))',
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6), inset 0 -4px 0 rgba(0,0,0,0.18), 0 5px 0 rgba(110,78,16,0.55), 0 10px 18px rgba(0,0,0,0.22)',
              transform: 'rotate(-6deg)', cursor: 'default', userSelect: 'none',
            }}
            title={toolsUnlocked ? T('setup.toolsUnlocked') : undefined}
          >
            {"\u{1F3B2}"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: 1.05, background: 'linear-gradient(180deg, #b8862c 0%, #6e4e10 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              {T('setup.appTitle')}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--ink-500)' }}>
              {T('setup.appTagline')}
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap" style={{ marginLeft: 'auto' }}>
            <input
              type="text"
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
              placeholder={T('setup.classPlaceholder')}
              maxLength={40}
              title={T('setup.classLabel')}
              style={{ width: 150, padding: '9px 12px', borderRadius: 10, fontSize: 14, border: '1.5px solid var(--gold-600)', background: '#fffdf8', color: 'var(--ink-900)' }}
            />
            <button
              type="button"
              onClick={() => setEnglishMode(!englishMode)}
              aria-pressed={englishMode}
              title={T('setup.englishToggleDesc')}
              className="btn btn--ghost btn--sm"
              style={{
                borderColor: englishMode ? 'var(--gold-600)' : undefined,
                background: englishMode ? 'rgba(232,169,88,0.18)' : undefined,
              }}
            >
              {englishMode ? '🇬🇧 EN ✓' : '🇬🇧 EN'}
            </button>
            {showTools && !OFFLINE && (
              <button type="button" onClick={() => setShowToolsPanel(true)} className="btn btn--ghost btn--sm">
                {T('setup.toolsBtn')}
              </button>
            )}
            {hasSave && (
              <button onClick={resumeGame} className="btn btn--blue btn--sm">
                {T('setup.resumeShort')}
              </button>
            )}
            {!phoneMode && (
              <button onClick={startGame} className="btn btn--green" style={{ padding: '12px 26px' }}>
                {hasSave ? T('setup.newGame') : T('setup.launch')}
              </button>
            )}
          </div>
        </div>
        {phoneMode && (
          <div className="max-w-[1180px] mx-auto" style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 8 }}>
            {T('setup.phoneStartHint')}
          </div>
        )}
      </div>

      {/* Corps */}
      <div className="max-w-[1180px] mx-auto" style={{ padding: '24px 24px 80px' }}>
        {/* L'ESSENTIEL — toujours visible */}
        <div className="panel">
          <div className="field-label">{T('setup.essentialTitle')}</div>
          <div className={hasSchoolSel ? 'grid gap-5 grid-cols-1 lg:grid-cols-2' : ''}>
            {hasSchoolSel && <LevelSelect />}
            <SubjectSelect />
          </div>
          {!OFFLINE && (
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(122,94,58,0.14)' }}>
              <ConnectionMode />
            </div>
          )}
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(122,94,58,0.14)' }}>
            {phoneMode ? (
              <LobbyPanel />
            ) : (
              <>
                <TeamCount />
                <TeamCustomization />
              </>
            )}
          </div>
        </div>

        {/* OPTIONS DE JEU — accordéons repliés avec résumé */}
        <div className="field-label" style={{ marginTop: 26, marginBottom: 10 }}>
          {T('setup.optionsTitle')}
          <span style={{ fontWeight: 400, color: 'var(--ink-400)', fontSize: 12, marginLeft: 8 }}>{T('setup.optionsHint')}</span>
        </div>
        <div className="flex flex-col gap-3">
          <SetupSection title={T('setup.secExtensions')} summary={extSummary}>
            <ExtensionsChecklist />
          </SetupSection>
          <SetupSection title={T('setup.secBoard')} summary={boardSummary}>
            <BoardParams />
          </SetupSection>
          <SetupSection title={T('setup.secEvents')} summary={eventsSummary}>
            <EventsChecklist embedded />
          </SetupSection>
          {itemsOn && (
            <SetupSection title={T('setup.secItems')} summary={itemsSummary}>
              <ItemsChecklist embedded />
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(122,94,58,0.14)' }}>
                <StarterChestConfig />
              </div>
            </SetupSection>
          )}
          <SetupSection title={T('setup.secRules')} summary={rulesSummary}>
            <RulesConfig />
          </SetupSection>
        </div>
      </div>

      {/* Panneau Outils (éditeurs + simulateur dev) — overlay, gated showTools */}
      {showToolsPanel && showTools && !OFFLINE && (
        <div
          onClick={() => setShowToolsPanel(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(30,18,4,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#fff' }}>{T('setup.toolsTitle')}</div>
              <button onClick={() => setShowToolsPanel(false)} className="btn btn--ghost btn--sm">{T('common.close')}</button>
            </div>
            <div className="flex flex-col gap-4">
              <EditorTools />
              {import.meta.env.DEV && <DevFightPanel />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
