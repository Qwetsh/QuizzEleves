import { useGameStore } from '../../store/gameStore';

function RadioGroup({ label, name, value, options, onChange }) {
  return (
    <div className="mb-3">
      <div className="text-xs font-semibold text-[var(--muted)] mb-1">{label}</div>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-1 px-3 py-1 rounded border text-sm cursor-pointer transition ${
              value === opt.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-[var(--border)] bg-white hover:border-blue-300'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function SliderParam({ label, param, min, max, value, onChange }) {
  return (
    <div className="mb-3">
      <div className="text-xs font-semibold text-[var(--muted)] mb-1">
        {`${label} : ${value}`}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500"
      />
    </div>
  );
}

export default function BoardParams() {
  const params = useGameStore((s) => s.boardParams);
  const setBoardParam = useGameStore((s) => s.setBoardParam);

  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold mb-2 text-[var(--muted)]">
        Plateau
      </label>
      <div className="bg-white rounded-lg border border-[var(--border)] p-3 space-y-1">
        <SliderParam
          label="Cases par voie"
          min={3} max={6}
          value={params.casesParVoie}
          onChange={(v) => setBoardParam('casesParVoie', v)}
        />
        <RadioGroup
          label={"Voies parall\u00e8les"}
          name="nbVoies"
          value={params.nbVoies}
          options={[
            { value: 2, label: '2 voies' },
            { value: 3, label: '3 voies' },
          ]}
          onChange={(v) => setBoardParam('nbVoies', v)}
        />
        <RadioGroup
          label="Sections"
          name="nbSections"
          value={params.nbSections}
          options={[
            { value: 2, label: '2' },
            { value: 3, label: '3' },
            { value: 4, label: '4' },
          ]}
          onChange={(v) => setBoardParam('nbSections', v)}
        />
        <RadioGroup
          label="Voie finale"
          name="voieFinale"
          value={params.voieFinale}
          options={[
            { value: 'court-long', label: 'Court / Long' },
            { value: 'unique', label: 'Unique' },
            { value: 'aucune', label: 'Aucune' },
          ]}
          onChange={(v) => setBoardParam('voieFinale', v)}
        />
        <SliderParam
          label="Couloirs mix"
          min={0} max={3}
          value={params.couloirsMix}
          onChange={(v) => setBoardParam('couloirsMix', v)}
        />
        <SliderParam
          label={"\u00c9v\u00e9nements / couloir"}
          min={0} max={2}
          value={params.eventsPerCouloir}
          onChange={(v) => setBoardParam('eventsPerCouloir', v)}
        />
      </div>
    </div>
  );
}
