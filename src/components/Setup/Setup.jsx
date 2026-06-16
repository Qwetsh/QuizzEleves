import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { loadGame } from '../../store/persistence';
import { SUBJECTS, SUBJECT_KEYS } from '../../data/subjects';
import { getMinigame, getDefaultMinigame } from '../Fight/minigames';
import { ITEMS } from '../../data/items';
import LootReveal from '../Modals/LootReveal';
import QuestionsEditor from './QuestionsEditor';
import BalanceEditor from './BalanceEditor';
import LevelSelect from './LevelSelect';
import TeamCount from './TeamCount';
import TeamCustomization from './TeamCustomization';
import BoardParams from './BoardParams';
import EventsChecklist from './EventsChecklist';
import ItemsChecklist from './ItemsChecklist';
import ExtensionsChecklist from './ExtensionsChecklist';
import { extOn } from '../../extensions/registry';

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
      </div>
      {showQuestionsEditor && <QuestionsEditor onClose={() => setShowQuestionsEditor(false)} />}
      {showBalanceEditor && <BalanceEditor onClose={() => setShowBalanceEditor(false)} />}
    </div>
  );
}

const TOOLS_UNLOCK_KEY = 'quete_tools_unlock';
const TOOLS_CODE = '54150';

export default function Setup() {
  const startGame = useGameStore((s) => s.startGame);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const extensions = useGameStore((s) => s.extensions);
  const itemsOn = extOn(extensions, 'equipment');
  const [hasSave, setHasSave] = useState(false);
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
    const code = window.prompt("Code d'accès aux outils d'édition :");
    if (code == null) return;
    if (code.trim() === TOOLS_CODE) {
      try { localStorage.setItem(TOOLS_UNLOCK_KEY, '1'); } catch { /* quota */ }
      setToolsUnlocked(true);
    } else {
      window.alert('Code incorrect.');
    }
  };
  const showTools = import.meta.env.DEV || toolsUnlocked;

  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ padding: '36px 24px 80px' }}>
      <div className="max-w-[1180px] mx-auto grid gap-7 grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Hero */}
        <div className="col-span-1 lg:col-span-2 flex items-center gap-6 flex-wrap mb-2">
          <div
            className="flex items-center justify-center text-5xl"
            onClick={handleDiceClick}
            style={{
              width: 96, height: 96, borderRadius: 24,
              background: 'linear-gradient(135deg, var(--gold-400), var(--gold-600))',
              boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.6), inset 0 -6px 0 rgba(0,0,0,0.18), 0 8px 0 rgba(110,78,16,0.55), 0 16px 30px rgba(0,0,0,0.25)',
              transform: 'rotate(-6deg)',
              cursor: 'default', userSelect: 'none',
            }}
            title={toolsUnlocked ? 'Outils déverrouillés' : undefined}
          >
            {"\u{1F3B2}"}
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 48,
                lineHeight: 1.05,
                background: 'linear-gradient(180deg, #b8862c 0%, #6e4e10 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                textShadow: 'none',
              }}
            >
              {"Qu\u00eate des Mati\u00e8res"}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 16, fontWeight: 500, color: 'var(--ink-500)', marginTop: 4 }}>
              {"Jeu de plateau p\u00e9dagogique \u00b7 Cycle 4"}
            </div>
          </div>
          <button
            onClick={startGame}
            className="btn btn--green btn--lg"
            style={{ marginLeft: 'auto', padding: '16px 36px' }}
          >
            {"\u{1F680} Lancer la partie"}
          </button>
        </div>

        {hasSave && (
          <div className="col-span-1 lg:col-span-2">
            <button
              onClick={resumeGame}
              className="btn btn--blue btn--lg"
              style={{ width: '100%' }}
            >
              {"\u25B6\uFE0F Reprendre la partie"}
            </button>
          </div>
        )}

        {/* Left column */}
        <div className="flex flex-col gap-4">
          <div className="panel">
            <LevelSelect />
          </div>
          <div className="panel">
            <TeamCount />
            <TeamCustomization />
          </div>
          <div className="panel">
            <ExtensionsChecklist />
          </div>
          <div className="panel">
            <EventsChecklist />
          </div>
          {itemsOn && (
            <div className="panel">
              <ItemsChecklist />
            </div>
          )}
          {showTools && <EditorTools />}
          {import.meta.env.DEV && <DevFightPanel />}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <div className="panel">
            <BoardParams />
          </div>
          <div className="panel panel--parchment">
            <div className="field-label" style={{ color: 'var(--ink-700)' }}>Les 6 royaumes</div>
            <div className="grid grid-cols-2 gap-2.5">
              {SUBJECT_KEYS.map((key) => {
                const s = SUBJECTS[key];
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2.5"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: 'rgba(255, 250, 240, 0.7)',
                      borderLeft: `4px solid ${s.color}`,
                    }}
                  >
                    <span className="text-xl">{s.icon}</span>
                    <div className="min-w-0">
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink-900)' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{s.biome}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
