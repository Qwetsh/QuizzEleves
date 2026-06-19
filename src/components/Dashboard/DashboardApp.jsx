// Racine du dashboard d'analyse (URL `?analyse`). Charge les parties archivées
// depuis Supabase (quete_game_stats), gère le filtre par classe et la navigation
// liste → rapport, ainsi que l'onglet « suivi de classe » (longitudinal).
import { useEffect, useState } from 'react';
import { fetchGameStats, fetchClassLabels } from '../../logic/sessionConfig';
import GameList from './GameList';
import GameReport from './GameReport';
import ClassTrends from './ClassTrends';
import '../../styles/dashboard.css';

export default function DashboardApp() {
  const [rows, setRows] = useState([]);
  const [labels, setLabels] = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [tab, setTab] = useState('games'); // 'games' | 'trends'
  const [openRow, setOpenRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true); setError(null);
    Promise.all([
      fetchGameStats({ classLabel: classFilter || null }),
      fetchClassLabels(),
    ]).then(([r, l]) => { setRows(r); setLabels(l); setLoading(false); })
      .catch((e) => { setError(e.message || 'Chargement impossible'); setLoading(false); });
  };

  useEffect(load, [classFilter]);

  return (
    <div className="dash-root">
      <header className="dash-header">
        <div className="dash-h-title">📊 Analyse des parties</div>
        <div className="dash-h-controls">
          <select className="dash-select" value={classFilter} onChange={(e) => { setOpenRow(null); setClassFilter(e.target.value); }}>
            <option value="">Toutes les classes</option>
            {labels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button className="dash-btn" onClick={load} title="Recharger">↻</button>
        </div>
      </header>

      {!openRow && (
        <nav className="dash-tabs">
          <button className={'dash-tab' + (tab === 'games' ? ' is-active' : '')} onClick={() => setTab('games')}>Parties</button>
          <button className={'dash-tab' + (tab === 'trends' ? ' is-active' : '')} onClick={() => setTab('trends')}>Suivi de classe</button>
        </nav>
      )}

      <main className="dash-main">
        {loading && <p className="dash-empty" style={{ margin: 24 }}>Chargement…</p>}
        {error && <p className="dash-empty" style={{ margin: 24, color: '#b5341f' }}>{error}</p>}
        {!loading && !error && (
          openRow ? <GameReport row={openRow} onBack={() => setOpenRow(null)} />
            : tab === 'games' ? <GameList rows={rows} onOpen={setOpenRow} />
              : <ClassTrends rows={rows} />
        )}
      </main>
    </div>
  );
}
