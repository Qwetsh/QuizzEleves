import { useGameStore } from '../../store/gameStore';

export default function BoardParams() {
  const params = useGameStore((s) => s.boardParams);
  const setBoardParam = useGameStore((s) => s.setBoardParam);

  return (
    <div>
      <div className="field-label">Plateau</div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 6 }}>
          {"Cases par voie : "}<strong>{params.casesParVoie}</strong>
        </div>
        <input
          type="range" min={3} max={6} value={params.casesParVoie}
          onChange={(e) => setBoardParam('casesParVoie', Number(e.target.value))}
          style={{ accentColor: '#b8862c', width: '100%' }}
        />
      </div>

      <ChipGroup
        label={"Voies parall\u00e8les"}
        value={params.nbVoies}
        options={[{ value: 2, label: '2 voies' }, { value: 3, label: '3 voies' }]}
        onChange={(v) => setBoardParam('nbVoies', v)}
      />

      <ChipGroup
        label="Sections"
        value={params.nbSections}
        options={[{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }]}
        onChange={(v) => setBoardParam('nbSections', v)}
      />

      <ChipGroup
        label="Voie finale"
        value={params.voieFinale}
        options={[
          { value: 'court-long', label: 'Court / Long' },
          { value: 'unique', label: 'Unique' },
          { value: 'aucune', label: 'Aucune' },
        ]}
        onChange={(v) => setBoardParam('voieFinale', v)}
      />

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 6 }}>
          {"Couloirs mix : "}<strong>{params.couloirsMix}</strong>
        </div>
        <input
          type="range" min={0} max={3} value={params.couloirsMix}
          onChange={(e) => setBoardParam('couloirsMix', Number(e.target.value))}
          style={{ accentColor: '#b8862c', width: '100%' }}
        />
      </div>

      <div>
        <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 6 }}>
          {"\u00c9v\u00e9nements : "}
          <strong>
            {params.eventEveryX < 1
              ? 'Aucun'
              : `1 toutes les ${params.eventEveryX} cases`}
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
