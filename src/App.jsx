import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Users,
  Download,
  Filter,
  TrendingUp,
  UserCheck,
  RefreshCw,
  Award,
  PlayCircle,
  BookOpen,
  Upload,
  FileSpreadsheet
} from 'lucide-react';

const App = () => {
  const [trainingsData, setTrainingsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUnits, setFilterUnits] = useState([]);
  const [filterAreas, setFilterAreas] = useState([]);
  const [filterType, setFilterType] = useState('Todos');
  const [filterMonths, setFilterMonths] = useState([]);
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [openFilter, setOpenFilter] = useState(null);
  const [lastUpdate, setLastUpdate] = useState('Carregando...');

  const colors = {
    magenta: '#E91E63',
    green: '#2E7D32',
    orange: '#F57C00',
    purple: '#7B1FA2',
    pink: '#FF6B8B',
    blue: '#0288D1',
    ice: '#F4F4F4',
    graphite: '#333333',
    gray: '#6B6B6B'
  };

  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const monthFilterLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const normalizeHeader = (value) =>
    (value ?? '')
      .toString()
      .replace(/^\uFEFF/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();

  const normalizeStatus = (status) =>
    (status || '')
      .toString()
      .trim()
      .toLowerCase();

  const parseInteger = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number.parseInt(String(value).replace(',', '.').trim(), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseFloatValue = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number.parseFloat(String(value).replace(/\./g, '').replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const processRows = (rows) => {
    const aliases = {
      id: ['id'],
      unit: ['unidade', 'unit'],
      area: ['area', 'departamento'],
      name: ['nomedotreinamento', 'treinamento', 'capacitacaotecnica', 'nome'],
      type: ['tipo', 'tipodotreinamento'],
      month: ['mes011', 'mes', 'mes0a11'],
      days: ['dias', 'dia'],
      status: ['status', 'situacao'],
      nps: ['nps'],
      invited: ['convidados', 'inscritos'],
      present: ['presentes', 'participantes'],
      hours: ['horas', 'cargahoraria'],
      cost: ['custo', 'valor']
    };

    return rows
      .map((row, idx) => {
        const normalizedRow = {};
        Object.entries(row || {}).forEach(([key, value]) => {
          normalizedRow[normalizeHeader(key)] = typeof value === 'string' ? value.trim() : value;
        });

        const findValue = (field, fallbackIndex) => {
          for (const alias of aliases[field]) {
            if (normalizedRow[alias] !== undefined && normalizedRow[alias] !== null && normalizedRow[alias] !== '') {
              return normalizedRow[alias];
            }
          }

          if (Array.isArray(row)) {
            return row[fallbackIndex];
          }

          const objectValues = Object.values(row || {});
          return objectValues[fallbackIndex];
        };

        const monthRaw = parseInteger(findValue('month', 6));
        const month = monthRaw >= 0 && monthRaw <= 11 ? monthRaw : 0;

        return {
          id: findValue('id', 1)?.toString().trim() || `ID-${idx + 1}`,
          unit: findValue('unit', 2)?.toString().trim() || 'N/A',
          area: findValue('area', 3)?.toString().trim() || 'N/A',
          name: findValue('name', 4)?.toString().trim() || 'Sem Nome',
          type: findValue('type', 5)?.toString().trim() || 'Interno',
          month,
          days: findValue('days', 7)?.toString().trim() || '-',
          status: findValue('status', 8)?.toString().trim() || 'Planejado',
          nps: parseInteger(findValue('nps', 9)) || null,
          invited: parseInteger(findValue('invited', 10)),
          present: parseInteger(findValue('present', 11)),
          hours: parseInteger(findValue('hours', 12)),
          cost: parseFloatValue(findValue('cost', 13))
        };
      })
      .filter((item) => item.name !== 'Sem Nome' || item.unit !== 'N/A');
  };

  const parseCsvInput = (input, onComplete, onError) => {
    Papa.parse(input, {
      header: true,
      skipEmptyLines: 'greedy',
      delimiter: '',
      delimitersToGuess: [',', ';', '\t', '|'],
      transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
      complete: (result) => {
        const processed = processRows(result.data || []);
        onComplete(processed);
      },
      error: onError
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}template_sertec_2026.csv`);
        const text = await response.text();

        parseCsvInput(
          text.replace(/^\uFEFF/, ''),
          (data) => {
            setTrainingsData(data);
            setLastUpdate(new Date().toLocaleString('pt-BR'));
            setLoading(false);
          },
          (error) => {
            console.error('Erro ao processar CSV inicial:', error);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      parseCsvInput(
        file,
        (data) => {
          setTrainingsData(data);
          setLastUpdate(new Date().toLocaleString('pt-BR'));
        },
        (error) => console.error('Erro no upload de CSV:', error)
      );
    }
  };

  const downloadTemplate = async () => {
    const templateUrl = `${import.meta.env.BASE_URL}template_sertec_2026.csv`;
    const response = await fetch(templateUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'template_sertec_2026.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  const resetFilters = () => {
    setFilterUnits([]);
    setFilterAreas([]);
    setFilterType('Todos');
    setFilterMonths([]);
    setFilterStatus('Todos');
    setOpenFilter(null);
  };

  const units = useMemo(() => [...new Set(trainingsData.map((d) => d.unit))].sort(), [trainingsData]);
  const areas = useMemo(() => [...new Set(trainingsData.map((d) => d.area))].sort(), [trainingsData]);

  const filteredData = useMemo(() => {
    return trainingsData.filter((t) => {
      const status = normalizeStatus(t.status);
      const matchUnit = filterUnits.length === 0 || filterUnits.includes(t.unit);
      const matchArea = filterAreas.length === 0 || filterAreas.includes(t.area);
      const matchType = filterType === 'Todos' || t.type === filterType;
      const matchMonth = filterMonths.length === 0 || filterMonths.includes(t.month);
      const matchStatus =
        filterStatus === 'Todos' ||
        (filterStatus === 'Realizado' && status.includes('realizado')) ||
        (filterStatus === 'Em andamento' && status.includes('andamento')) ||
        (filterStatus === 'Planejado' && status.includes('planejado'));

      return matchUnit && matchArea && matchType && matchMonth && matchStatus;
    });
  }, [trainingsData, filterUnits, filterAreas, filterType, filterMonths, filterStatus]);

  const statusRealizadoData = filteredData.filter((t) => normalizeStatus(t.status).includes('realizado'));
  const statusPlanejadoData = filteredData.filter((t) => normalizeStatus(t.status).includes('planejado'));

  const totalTrainings = filteredData.length;
  const countRealizado = statusRealizadoData.length;
  const countAndamento = filteredData.filter((t) => normalizeStatus(t.status).includes('andamento')).length;
  const countPlanejado = totalTrainings - countRealizado - countAndamento;

  const percentRealizado = Math.round((countRealizado / totalTrainings) * 100) || 0;
  const percentAndamento = Math.round((countAndamento / totalTrainings) * 100) || 0;

  const totalImpacted = statusRealizadoData.reduce((acc, curr) => acc + (curr.present || 0), 0);
  const totalHours = statusRealizadoData.reduce((acc, curr) => acc + (curr.present || 0) * (curr.hours || 0), 0);

  const budgetUsed =
    Math.min(
      100,
      Math.round(
        ((statusRealizadoData.reduce((acc, curr) => acc + (curr.cost || 0), 0) +
          statusPlanejadoData.reduce((acc, curr) => acc + (curr.cost || 0), 0)) /
          1100000) *
          100
      )
    ) || 0;

  const totalInvited = statusRealizadoData.reduce((acc, curr) => acc + (curr.invited || 0), 0);
  const totalPresent = statusRealizadoData.reduce((acc, curr) => acc + (curr.present || 0), 0);
  const adhesionRate = totalInvited > 0 ? Math.min(100, Math.round((totalPresent / totalInvited) * 100)) : 0;

  const sem1Data = filteredData.filter((t) => t.month <= 5);
  const sem2Data = filteredData.filter((t) => t.month > 5);
  const sem1Percent =
    Math.round((sem1Data.filter((t) => normalizeStatus(t.status).includes('realizado')).length / sem1Data.length) * 100) ||
    0;
  const sem2Percent =
    Math.round((sem2Data.filter((t) => normalizeStatus(t.status).includes('realizado')).length / sem2Data.length) * 100) ||
    0;

  const toggleMultiFilter = (value, selected, setSelected) => {
    if (selected.includes(value)) {
      setSelected(selected.filter((item) => item !== value));
      return;
    }
    setSelected([...selected, value]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F4F4]">
        <RefreshCw className="animate-spin text-pink-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F4] text-[#333333] font-sans selection:bg-pink-100 relative pb-20">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/p6.png')" }}
      ></div>
      <header
        className="bg-white border-b-4 sticky top-0 z-50 px-8 py-6 shadow-md"
        style={{ borderBottomColor: colors.magenta }}
      >
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full opacity-20" style={{ backgroundColor: colors.magenta }}></div>
                <Award size={28} style={{ color: colors.magenta }} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                  SER<span style={{ color: colors.magenta }}>+</span>TEC 2026
                </h1>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  Capacitação Técnica para nossos Talentos
                </p>
              </div>
            </div>
            <div className="flex gap-3 no-print">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                <FileSpreadsheet size={16} /> TEMPLATE EXCEL
              </button>
              <label className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-full text-xs font-bold cursor-pointer hover:bg-slate-700 transition-colors">
                <Upload size={16} /> UPLOAD BASE
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg transition-transform hover:scale-105"
                style={{ backgroundColor: colors.magenta }}
              >
                <Download size={16} /> PDF
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm col-span-1 md:col-span-2">
              <p className="text-[10px] text-gray-400 uppercase font-black mb-3 tracking-widest">Status Geral do Programa</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.green }}></div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Realizado</span>
                  </div>
                  <p className="text-xl font-black">{percentRealizado}%</p>
                  <p className="text-[9px] text-gray-400 font-bold">{countRealizado} ações</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.magenta }}></div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Em Andamento</span>
                  </div>
                  <p className="text-xl font-black">{percentAndamento}%</p>
                  <p className="text-[9px] text-gray-400 font-bold">{countAndamento} ações</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full border border-gray-300"></div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Planejado</span>
                  </div>
                  <p className="text-xl font-black">{Math.max(0, 100 - percentRealizado - percentAndamento)}%</p>
                  <p className="text-[9px] text-gray-400 font-bold">{countPlanejado} ações</p>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-2 mt-4 rounded-full overflow-hidden flex">
                <div style={{ width: `${percentRealizado}%`, backgroundColor: colors.green }} className="h-full" />
                <div style={{ width: `${percentAndamento}%`, backgroundColor: colors.magenta }} className="h-full" />
              </div>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl shadow-lg border-b-4" style={{ borderBottomColor: colors.orange }}>
              <p className="text-[10px] text-slate-400 uppercase font-black mb-1 tracking-widest">Pessoas Impactadas</p>
              <div className="flex items-center gap-3">
                <Users size={24} style={{ color: colors.orange }} />
                <p className="text-2xl font-black text-white">{totalImpacted.toLocaleString()}</p>
              </div>
              <p className="text-[9px] text-slate-500 font-bold mt-2 uppercase tracking-tighter">Total de presenças em ações realizadas</p>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl shadow-lg border-b-4" style={{ borderBottomColor: colors.pink }}>
              <p className="text-[10px] text-slate-400 uppercase font-black mb-1 tracking-widest">Horas de Formação</p>
              <div className="flex items-center gap-3">
                <BookOpen size={24} style={{ color: colors.pink }} />
                <p className="text-2xl font-black text-white">{totalHours.toLocaleString()}</p>
              </div>
              <p className="text-[9px] text-slate-500 font-bold mt-2 uppercase tracking-tighter">Presenças × CH em ações realizadas</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center h-1/2">
                <span className="text-[9px] text-gray-400 uppercase font-black">Budget utilizado</span>
                <div className="flex items-center gap-1">
                  <TrendingUp size={14} style={{ color: colors.orange }} />
                  <span className="text-lg font-black" style={{ color: colors.orange }}>
                    {budgetUsed}%
                  </span>
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center h-1/2">
                <span className="text-[9px] text-gray-400 uppercase font-black">Adesão</span>
                <div className="flex items-center gap-1">
                  <UserCheck size={14} style={{ color: colors.orange }} />
                  <span className="text-lg font-black" style={{ color: colors.orange }}>
                    {adhesionRate}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="-mt-4 text-right">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">ações realizadas e planejadas</p>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-8 relative">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="bg-white px-5 py-2.5 rounded-full shadow-sm border border-gray-200 flex items-center gap-3 relative">
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1">
              <Filter size={14} /> Filtros:
            </div>

            <div className="relative">
              <button
                onClick={() => setOpenFilter(openFilter === 'unit' ? null : 'unit')}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer border-r pr-3"
              >
                Unidade{filterUnits.length > 0 ? `: ${filterUnits.length} selecionados` : ''}
              </button>
              {openFilter === 'unit' && (
                <div className="absolute z-20 top-8 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-56 max-h-64 overflow-y-auto">
                  {units.map((u) => (
                    <label key={u} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={filterUnits.includes(u)}
                        onChange={() => toggleMultiFilter(u, filterUnits, setFilterUnits)}
                      />
                      <span>{u}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setOpenFilter(openFilter === 'area' ? null : 'area')}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer border-r pr-3"
              >
                Área{filterAreas.length > 0 ? `: ${filterAreas.length} selecionadas` : ''}
              </button>
              {openFilter === 'area' && (
                <div className="absolute z-20 top-8 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-56 max-h-64 overflow-y-auto">
                  {areas.map((a) => (
                    <label key={a} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={filterAreas.includes(a)}
                        onChange={() => toggleMultiFilter(a, filterAreas, setFilterAreas)}
                      />
                      <span>{a}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none cursor-pointer border-r pr-3"
            >
              <option value="Todos">Tipo</option>
              <option value="Interno">INTERNO</option>
              <option value="Externo">EXTERNO</option>
            </select>

            <div className="relative">
              <button
                onClick={() => setOpenFilter(openFilter === 'month' ? null : 'month')}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer border-r pr-3"
              >
                Mês{filterMonths.length > 0 ? `: ${filterMonths.length} selecionados` : ''}
              </button>
              {openFilter === 'month' && (
                <div className="absolute z-20 top-8 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-48 max-h-64 overflow-y-auto">
                  {monthFilterLabels.map((m, idx) => (
                    <label key={m} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={filterMonths.includes(idx)}
                        onChange={() => toggleMultiFilter(idx, filterMonths, setFilterMonths)}
                      />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none cursor-pointer"
            >
              <option value="Todos">Status</option>
              <option value="Realizado">Realizado</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Planejado">Planejado</option>
            </select>

            <button
              onClick={resetFilters}
              className="ml-2 text-xs font-black uppercase text-slate-500 hover:text-slate-700"
            >
              Limpar filtros
            </button>
          </div>
          <div className="ml-auto flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: colors.green }}></div> REALIZADO
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: colors.magenta }}></div> EM ANDAMENTO
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <div className="w-4 h-4 rounded-sm border-2 border-dashed border-gray-200"></div> PLANEJADO
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div
            className="bg-white rounded-2xl p-6 shadow-sm border-l-8 flex items-center justify-between"
            style={{ borderLeftColor: colors.purple }}
          >
            <div>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-1">1º Semestre 2026</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black" style={{ color: colors.purple }}>
                  {sem1Data.length}
                </span>
                <span className="text-xs font-bold text-gray-400 uppercase">Formações Previstas</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Conclusão</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black">{sem1Percent}%</span>
                <div className="w-16 h-16 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="transparent"
                      className="text-gray-100"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="transparent"
                      strokeDasharray={175}
                      strokeDashoffset={175 - (175 * sem1Percent) / 100}
                      style={{ color: colors.purple }}
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div
            className="bg-white rounded-2xl p-6 shadow-sm border-l-8 flex items-center justify-between"
            style={{ borderLeftColor: colors.orange }}
          >
            <div>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-1">2º Semestre 2026</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black" style={{ color: colors.orange }}>
                  {sem2Data.length}
                </span>
                <span className="text-xs font-bold text-gray-400 uppercase">Formações Previstas</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Conclusão</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black">{sem2Percent}%</span>
                <div className="w-16 h-16 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="transparent"
                      className="text-gray-100"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="transparent"
                      strokeDasharray={175}
                      strokeDashoffset={175 - (175 * sem2Percent) / 100}
                      style={{ color: colors.orange }}
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-5 text-[10px] uppercase font-black tracking-widest w-24">Unid.</th>
                  <th className="p-5 text-[10px] uppercase font-black tracking-widest min-w-[300px]">Capacitação Técnica (CH)</th>
                  {months.map((m) => (
                    <th key={m} className="p-3 text-[10px] uppercase font-black tracking-widest text-center min-w-[85px]">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((training, idx) => {
                  const isRealizado = normalizeStatus(training.status).includes('realizado');
                  const isAndamento = normalizeStatus(training.status).includes('andamento');

                  return (
                    <tr key={`${training.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 border-r border-gray-50 text-center">
                        <span className="text-xs font-black text-gray-400">{training.unit}</span>
                      </td>
                      <td className="p-4 border-r border-gray-50">
                        <div className="flex flex-col">
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-extrabold text-slate-800">{training.name}</span>
                            <span className="text-[10px] font-bold text-gray-400">{training.hours}h</span>
                          </div>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{training.area}</span>
                            <span
                              className="text-[9px] font-black"
                              style={{ color: training.type === 'Interno' ? colors.purple : colors.orange }}
                            >
                              • {training.type.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </td>
                      {months.map((_, mIdx) => (
                        <td key={mIdx} className="p-2 align-middle text-center border-l border-gray-50">
                          {training.month === mIdx && (
                            <div
                              className={`flex flex-col items-center justify-center p-2 rounded shadow-sm transition-transform hover:scale-105 ${
                                isRealizado ? 'text-white' : isAndamento ? 'text-white' : 'bg-white border-2 border-dashed border-gray-200 text-gray-400'
                              }`}
                              style={{
                                backgroundColor: isRealizado ? colors.green : isAndamento ? colors.magenta : 'transparent'
                              }}
                            >
                              <span className="text-[10px] font-black">{training.days || '-'}</span>
                              {isRealizado && (
                                <div className="mt-1 flex items-center gap-1">
                                  <span className="text-[9px] font-bold">NPS {training.nps ?? '-'}</span>
                                </div>
                              )}
                              {isAndamento && (
                                <div className="mt-1 flex items-center gap-1">
                                  <PlayCircle size={10} className="animate-pulse" />
                                  <span className="text-[9px] font-bold">EXECUTANDO</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <footer className="mt-12 flex flex-col items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="h-[1px] w-20 bg-gray-300"></div>
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.magenta }}></div>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.orange }}></div>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.purple }}></div>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.blue }}></div>
            </div>
            <div className="h-[1px] w-20 bg-gray-300"></div>
          </div>
          <div className="bg-white px-10 py-5 rounded-2xl border border-gray-200 shadow-sm text-center max-w-lg">
            <p className="text-sm text-gray-500 font-medium">
              Desenvolvendo pessoas, elevando performance. <br />
              Dúvidas? Fale com <span className="font-black" style={{ color: colors.magenta }}>Fernanda Monteiro</span>.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
            <RefreshCw size={12} className="animate-spin" style={{ animationDuration: '10s' }} />
            Base Atualizada em: {lastUpdate}
          </div>
        </footer>
      </main>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; }
          @media print {
            .no-print { display: none !important; }
            header { position: static !important; border-bottom: 4px solid #E91E63 !important; }
            table { border: 1px solid #ddd !important; }
            .bg-slate-800 { background-color: #1e293b !important; -webkit-print-color-adjust: exact; }
          }
        `}
      </style>
    </div>
  );
};

export default App;
