import { useState } from 'react';

const STATUS_ORDER = ['realizado', 'reagendado', 'atrasado', 'planejado'];

const STATUS_COLORS = {
  realizado: '#2e7d32',
  reagendado: '#7b1fa2',
  atrasado: '#e65100',
  planejado: '#e2e8f0',
  andamento: '#1565c0',
};

const STATUS_LABELS = {
  realizado: 'Realizado',
  reagendado: 'Reagendado',
  atrasado: 'Atrasado',
  planejado: 'Planejado',
  andamento: 'Em Andamento',
};

function classifyStatus(norm) {
  if (norm === 'realizado') return 'realizado';
  if (norm === 'reagendado') return 'reagendado';
  if (norm === 'atrasado') return 'atrasado';
  if (norm === 'andamento') return 'andamento';
  return 'planejado';
}

export function UnitProgressChart({ unitBarData, months, normalizeStatus, getStatusDisplayLabel }) {
  const [expandedUnit, setExpandedUnit] = useState(null);

  return (
    <div className="space-y-0.5">
      {unitBarData.map((u) => {
        // Bar segments: only LNT - Planejado classes, excluding Cancelado
        const lntForBar = u.trainings
          .filter((t) => t.origem === 'LNT - Planejado')
          .flatMap((t) => (t.classes || t.visibleClasses))
          .filter((c) => normalizeStatus(c.status) !== 'cancelado');
        const total = lntForBar.length;

        const counts = { realizado: 0, reagendado: 0, atrasado: 0, andamento: 0, planejado: 0 };
        lntForBar.forEach((c) => {
          const bucket = classifyStatus(normalizeStatus(c.status));
          counts[bucket]++;
        });

        const isExpanded = expandedUnit === u.unit;

        return (
          <div key={u.unit}>
            <button
              type="button"
              className="w-full grid items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-slate-50 transition-colors group"
              style={{ gridTemplateColumns: '80px 1fr 48px' }}
              onClick={() => setExpandedUnit(isExpanded ? null : u.unit)}
            >
              <span className="text-[11px] font-black uppercase text-slate-700 leading-tight text-left flex items-center gap-1">
                <span className="text-slate-300 group-hover:text-slate-400 transition-colors text-[8px]">
                  {isExpanded ? '▲' : '▼'}
                </span>
                {u.unit}
              </span>

              <div className="h-5 flex rounded-sm overflow-hidden" style={{ backgroundColor: '#f1f5f9' }}>
                {total > 0 ? (
                  [...STATUS_ORDER, 'andamento'].map((status) => {
                    const count = counts[status] ?? 0;
                    if (count === 0) return null;
                    const pct = (count / total) * 100;
                    return (
                      <div
                        key={status}
                        style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[status] }}
                        title={`${STATUS_LABELS[status] ?? status}: ${count} turma${count !== 1 ? 's' : ''} (${Math.round(pct)}%)`}
                      />
                    );
                  })
                ) : (
                  <div className="w-full" />
                )}
              </div>

              <span className="text-[12px] font-black text-slate-700 text-right">
                {u.realizationRate !== null ? `${u.realizationRate}%` : '—'}
              </span>
            </button>

            {isExpanded && (
              <div className="mx-1 mb-2 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-2 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 whitespace-nowrap">
                        Código
                      </th>
                      <th className="text-left px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        Capacitação
                      </th>
                      <th className="text-left px-2 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 whitespace-nowrap">
                        Origem
                      </th>
                      <th className="text-center px-2 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        Mês
                      </th>
                      <th className="text-center px-2 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        Turma
                      </th>
                      <th className="text-center px-2 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        Status
                      </th>
                      <th className="text-center px-2 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        Part.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.trainings.flatMap((training, ti) =>
                      (training.classes || training.visibleClasses).map((cls, ci) => {
                        const norm = normalizeStatus(cls.status);
                        const statusColor = STATUS_COLORS[norm] || '#94a3b8';
                        const isExtra = training.origem === 'Extra - Não Planejado';
                        const isCancelled = norm === 'cancelado';
                        return (
                          <tr
                            key={`${training.id || ti}-${ci}`}
                            className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${isCancelled ? 'opacity-60' : ''}`}
                          >
                            <td className="px-2 py-2 text-[9px] text-slate-500 whitespace-nowrap font-mono">
                              {training.id || '—'}
                            </td>
                            <td className="px-3 py-2 text-[10px] font-semibold text-slate-700 max-w-[180px]">
                              <span className="block truncate" title={training.name}>
                                {training.name}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-[9px] whitespace-nowrap">
                              <span
                                className="inline-block px-1.5 py-0.5 rounded text-[8px] font-black"
                                style={{
                                  backgroundColor: isExtra ? '#fff3e0' : '#e8f5e9',
                                  color: isExtra ? '#e65100' : '#2e7d32',
                                }}
                              >
                                {isExtra ? 'Extra' : 'LNT'}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-[10px] text-center text-slate-600 whitespace-nowrap">
                              {Number.isInteger(cls.month) ? months[cls.month] : '—'}
                            </td>
                            <td className="px-2 py-2 text-[10px] text-center text-slate-600">
                              {cls.turma || '—'}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black text-white whitespace-nowrap"
                                style={{ backgroundColor: statusColor }}
                              >
                                {getStatusDisplayLabel(cls.status)}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-[10px] text-center text-slate-600">
                              {cls.present != null ? cls.present : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
