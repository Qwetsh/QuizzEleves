import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';

export default function BoardParams() {
  const T = useT();
  const params = useGameStore((s) => s.boardParams);
  const setBoardParam = useGameStore((s) => s.setBoardParam);

  return (
    <div>
      <div className="field-label">{T('setup.boardTitle')}</div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 6 }}>
          {T('setup.boardSpacesPerLane')}<strong>{params.casesParVoie}</strong>
        </div>
        <input
          type="range" min={3} max={12} value={params.casesParVoie}
          onChange={(e) => setBoardParam('casesParVoie', Number(e.target.value))}
          style={{ accentColor: '#b8862c', width: '100%' }}
        />
      </div>

      <ChipGroup
        label={T('setup.boardParallelLanes')}
        value={params.nbVoies}
        options={[{ value: 2, label: T('setup.boardLanes', { n: 2 }) }, { value: 3, label: T('setup.boardLanes', { n: 3 }) }]}
        onChange={(v) => setBoardParam('nbVoies', v)}
      />

      <ChipGroup
        label={T('setup.boardSections')}
        value={params.nbSections}
        options={[{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }]}
        onChange={(v) => setBoardParam('nbSections', v)}
      />

      <ChipGroup
        label={T('setup.boardFinalLane')}
        value={params.voieFinale}
        options={[
          { value: 'court-long', label: T('setup.boardFinalShortLong') },
          { value: 'unique', label: T('setup.boardFinalUnique') },
          { value: 'aucune', label: T('setup.boardFinalNone') },
        ]}
        onChange={(v) => setBoardParam('voieFinale', v)}
      />

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 6 }}>
          {T('setup.boardMixCorridors')}<strong>{params.couloirsMix}</strong>
        </div>
        <input
          type="range" min={0} max={8} value={params.couloirsMix}
          onChange={(e) => setBoardParam('couloirsMix', Number(e.target.value))}
          style={{ accentColor: '#b8862c', width: '100%' }}
        />
      </div>

      <div>
        <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 6 }}>
          {T('setup.boardEvents')}
          <strong>
            {params.eventEveryX < 1
              ? T('setup.boardEventsNone')
              : T('setup.boardEventsEvery', { n: params.eventEveryX })}
          </strong>
        </div>
        <input
          type="range" min={0} max={6} value={params.eventEveryX}
          onChange={(e) => setBoardParam('eventEveryX', Number(e.target.value))}
          style={{ accentColor: '#b8862c', width: '100%' }}
        />
      </div>
    </div>
  );
}

function ChipGroup({ label, value, options, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 6 }}>{label}</div>
      <div className="flex gap-2.5 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.value}
            className={`chip ${value === opt.value ? 'is-active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
