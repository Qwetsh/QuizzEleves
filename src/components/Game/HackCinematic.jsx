// Cinématique « application piratée » (événement Hacking, mode téléphone) —
// composant PRÉSENTIEL réutilisable qui TOURNE EN BOUCLE tant qu'il est monté :
//   • plein écran sur le TÉLÉPHONE du groupe piraté (mode 'full') ;
//   • compact dans la cellule HUD de ce groupe sur le TBI (mode 'compact').
// Il ne pilote PAS la fin du tour : il reste affiché tant que le groupe est
// piraté (team.hackedTurns > 0) ; la résolution (tour perdu) est gérée ailleurs.
import { useEffect, useRef, useState } from 'react';
import '../../styles/hack.css';

// Pluie de caractères « Matrix » dimensionnée à SON conteneur (plein écran ou
// cellule HUD) via ResizeObserver.
function MatrixRain() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return undefined;
    const ctx = canvas.getContext('2d');
    let raf = 0; let cols = 0; let drops = [];
    const GLYPHS = 'アカサタナハマヤラワ0123456789ABCDEF<>/\\|=+*#';
    const FONT = 14;
    const resize = () => {
      canvas.width = Math.max(1, host.clientWidth);
      canvas.height = Math.max(1, host.clientHeight);
      cols = Math.ceil(canvas.width / FONT);
      drops = Array.from({ length: cols }, () => Math.random() * -50);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const draw = () => {
      ctx.fillStyle = 'rgba(2, 8, 4, 0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${FONT}px monospace`;
      for (let i = 0; i < cols; i++) {
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        const y = drops[i] * FONT;
        ctx.fillStyle = Math.random() < 0.04 ? '#d7ffe6' : '#19ff7a';
        ctx.fillText(ch, i * FONT, y);
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} className="hack-matrix" aria-hidden="true" />;
}

// Flux de terminal qui défile EN BOUCLE (plein écran) — donne l'impression d'une
// intrusion en cours en continu.
function TerminalFeed({ en, name }) {
  const POOL = en ? [
    '> bypassing firewall ████████ OK',
    '> injecting payload ████████ OK',
    '> escalating privileges… root',
    '> ACCESS GRANTED',
    `> dumping ${name || 'team'} memory…`,
    '> rerouting packets 0xA3F…0xFF1',
    '> disabling input devices…',
    '> scanning ports 22 80 443 ████ OK',
    '> session token: ******** seized',
    '> ACCESS GRANTED',
  ] : [
    '> contournement du pare-feu ████████ OK',
    '> injection de la charge ████████ OK',
    '> élévation des privilèges… root',
    '> ACCÈS AUTORISÉ',
    `> extraction mémoire ${name || 'équipe'}…`,
    '> reroutage des paquets 0xA3F…0xFF1',
    '> désactivation des entrées…',
    '> scan des ports 22 80 443 ████ OK',
    '> jeton de session : ******** saisi',
    '> ACCÈS AUTORISÉ',
  ];
  const [lines, setLines] = useState([]);
  const iRef = useRef(0);
  useEffect(() => {
    setLines([]); iRef.current = 0;
    const id = setInterval(() => {
      const l = POOL[iRef.current % POOL.length];
      iRef.current += 1;
      setLines((prev) => [...prev, l].slice(-9)); // dernières lignes (défilement)
    }, 480);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [en, name]);
  return (
    <div className="hack-term-body">
      {lines.map((l, i) => (
        <div key={i} className={'hack-line' + (l.includes('GRANTED') || l.includes('AUTORIS') ? ' granted' : '')}>{l}</div>
      ))}
      <span className="hack-cursor">█</span>
    </div>
  );
}

// Props :
//   victim   = nom de l'équipe PIRATÉE (saveur du flux terminal) ;
//   by       = attribution { boss } OU { name, emoji, color } (équipe lanceuse).
export default function HackCinematic({ en = false, victim = '', by = null, compact = false }) {
  const title = en ? 'SYSTEM HACKED' : 'SYSTÈME PIRATÉ';
  const boss = !!by?.boss;
  const bossLabel = en ? '🤖 the boss' : '🤖 le boss';
  const whoLabel = boss ? bossLabel : `${by?.emoji || ''} ${by?.name || ''}`.trim();
  const whoColor = boss ? '#ff2e63' : (by?.color || '#19ff7a');

  return (
    <div className={'hack-cine' + (compact ? ' is-compact' : ' is-full')} role="alertdialog" aria-label={title}>
      <MatrixRain />
      <div className="hack-scanlines" aria-hidden="true" />
      <div className="hack-vignette" aria-hidden="true" />

      <div className="hack-stage">
        {!compact && (
          <div className="hack-terminal">
            <div className="hack-term-bar">
              <span className="hack-dot r" /><span className="hack-dot y" /><span className="hack-dot g" />
              <span className="hack-term-title">root@quizzeleves: ~ #</span>
            </div>
            <TerminalFeed en={en} name={victim} />
          </div>
        )}

        <div className="hack-bigwrap">
          <div className="hack-big glitch" data-text={title}>{title}</div>
          {whoLabel && <div className="hack-by">{en ? 'hijacked by' : 'piraté par'} <b style={{ color: whoColor }}>{whoLabel}</b></div>}
          <div className="hack-locked hack-pulse">
            {en ? '▌ session locked — app unusable' : '▌ session verrouillée — app inutilisable'}
          </div>
          <div className="hack-bar hack-bar--loop"><span /></div>
        </div>
      </div>
    </div>
  );
}
