import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Users,
  Filter,
  TrendingUp,
  UserCheck,
  RefreshCw,
  Award,
  PlayCircle,
  BookOpen,
  ChevronDown,
  XCircle,
  CalendarClock,
  AlertTriangle
} from 'lucide-react';

const GOOGLE_SHEETS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4GkP_Mu5rVg7AJi5gKj12o0WBCdgRm8GsM2-DtNlPx6ilflCfj0LyYg_tQTGbY1O-7rgyBT_spkk3/pub?gid=1391900322&single=true&output=csv';

// ─────────────────────────────────────────────────────────────
// STATUS NORMALIZATION
// Central function: all status logic flows through here.
// Returns one of: 'realizado' | 'andamento' | 'planejado' | 'cancelado' | 'reagendado' | 'atrasado'
// ─────────────────────────────────────────────────────────────
const normalizeStatus = (status) => {
  const raw = (status || '').toString().trim().toLowerCase();
  if (raw.includes('realizado')) return 'realizado';
  if (raw.includes('cancelado')) return 'cancelado';
  if (raw.startsWith('reagendado')) return 'reagendado';
  if (raw.includes('atrasado')) return 'atrasado';
  if (raw.includes('andamento')) return 'andamento';
  if (raw.includes('planejado')) return 'planejado';
  return 'planejado';
};

// Returns the display label — preserves "Reagendado 2" etc.
const getStatusDisplayLabel = (status) => {
  const raw = (status || '').toString().trim();
  const norm = normalizeStatus(raw);
  if (norm === 'reagendado') return raw;
  if (norm === 'realizado') return 'Realizado';
  if (norm === 'cancelado') return 'Cancelado';
  if (norm === 'andamento') return 'Em Andamento';
  return 'Planejado';
};

const statusMatchesFilter = (status, selectedStatus) => {
  const norm = normalizeStatus(status);
  if (selectedStatus === 'Todos') return true;
  if (selectedStatus === 'Realizado') return norm === 'realizado';
  if (selectedStatus === 'Em andamento') return norm === 'andamento';
  if (selectedStatus === 'Planejado') return norm === 'planejado';
  if (selectedStatus === 'Cancelado') return norm === 'cancelado';
  if (selectedStatus === 'Reagendado') return norm === 'reagendado';
  if (selectedStatus === 'Atrasado') return norm === 'atrasado';
  return false;
};

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
    gray: '#6B6B6B',
    canceled: '#1a1a1a',
    rescheduled: '#C62828',
    delayed: '#F9A825',
  };

  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const monthFilterLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthByText = {
    jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
    jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11
  };

  const normalizeHeader = (value) =>
    (value ?? '')
      .toString()
      .replace(/^\uFEFF/, '')
      .normalize('NFD')
      .replace(/[\u000b\t\n\r\f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();

  const parseInteger = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number.parseInt(String(value).replace(',', '.').trim(), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseFloatValue = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const raw = String(value).trim();
    if (!raw) return 0;
    const isNegative = raw.startsWith('-') || (raw.startsWith('(') && raw.endsWith(')'));
    const numericOnly = raw.replace(/ /g, '').replace(/\s+/g, '').replace(/[^\d,.-]/g, '');
    if (!numericOnly) return 0;
    const lastComma = numericOnly.lastIndexOf(',');
    const lastDot = numericOnly.lastIndexOf('.');
    let normalizedNumber = numericOnly;
    if (lastComma !== -1 && lastDot !== -1) {
      normalizedNumber = lastComma > lastDot
        ? numericOnly.replace(/\./g, '').replace(',', '.')
        : numericOnly.replace(/,/g, '');
    } else if (lastComma !== -1) {
      normalizedNumber = numericOnly.replace(/\./g, '').replace(',', '.');
    } else {
      normalizedNumber = numericOnly.replace(/,/g, '');
    }
    const parsed = Number.parseFloat(normalizedNumber);
    if (!Number.isFinite(parsed)) return 0;
    return isNegative ? -Math.abs(parsed) : parsed;
  };

  const parseMonthValue = (value) => {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const numeric = Number.parseInt(raw, 10);
    if (Number.isFinite(numeric)) {
      if (numeric >= 0 && numeric <= 11) return numeric;
      if (numeric >= 1 && numeric <= 12) return numeric - 1;
    }
    const normalized = raw
      .normalize('NFD')
      .replace(/[\u000b\t\n\r\f]/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    for (const [monthText, monthIndex] of Object.entries(monthByText)) {
      if (normalized.startsWith(monthText)) return monthIndex;
    }
    return null;
  };

  const parseClassIndex = (key, prefix) => {
    const match = key.match(new RegExp(`^${prefix}t?(\\d+)$`));
    return match ? Number.parseInt(match[1], 10) : null;
  };

  const processRows = (rows) => {
    const aliases = {
      id: ['id'],
      unit: ['unidade', 'unit'],
      area: ['area', 'departamento'],
      name: ['nomedotreinamento', 'treinamento', 'capacitacaotecnica', 'capacitacao', 'nome'],
      type: ['tipo', 'tipodotreinamento'],
      hours: ['horas', 'cargahoraria', 'ch'],
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
          if (Array.isArray(row)) return row[fallbackIndex];
          const objectValues = Object.values(row || {});
          return objectValues[fallbackIndex];
        };

        const parsedName = findValue('name', 4)?.toString().trim();
        const classesByIndex = new Map();

        Object.entries(normalizedRow).forEach(([key, value]) => {
          const monthIdx = parseClassIndex(key, 'mes');
          if (monthIdx !== null) {
            if (!classesByIndex.has(monthIdx)) classesByIndex.set(monthIdx, { turma: `T${monthIdx}` });
            classesByIndex.get(monthIdx).month = parseMonthValue(value);
          }
          const dayIdx = parseClassIndex(key, 'data');
          if (dayIdx !== null) {
            if (!classesByIndex.has(dayIdx)) classesByIndex.set(dayIdx, { turma: `T${dayIdx}` });
            classesByIndex.get(dayIdx).days = value?.toString().trim() || '-';
          }
          const statusIdx = parseClassIndex(key, 'status');
          if (statusIdx !== null) {
            if (!classesByIndex.has(statusIdx)) classesByIndex.set(statusIdx, { turma: `T${statusIdx}` });
            // Raw status preserved so "Reagendado 2" is kept intact
            classesByIndex.get(statusIdx).status = value?.toString().trim() || 'Planejado';
          }
          const invitedIdx = parseClassIndex(key, 'convidados');
          if (invitedIdx !== null) {
            if (!classesByIndex.has(invitedIdx)) classesByIndex.set(invitedIdx, { turma: `T${invitedIdx}` });
            classesByIndex.get(invitedIdx).invited = parseInteger(value);
          }
          const presentIdx = parseClassIndex(key, 'presentes');
          if (presentIdx !== null) {
            if (!classesByIndex.has(presentIdx)) classesByIndex.set(presentIdx, { turma: `T${presentIdx}` });
            classesByIndex.get(presentIdx).present = parseInteger(value);
          }
          const npsIdx = parseClassIndex(key, 'nps');
          if (npsIdx !== null) {
            if (!classesByIndex.has(npsIdx)) classesByIndex.set(npsIdx, { turma: `T${npsIdx}` });
            classesByIndex.get(npsIdx).nps = parseInteger(value) || null;
          }
        });

        const classes = [...classesByIndex.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, cls]) => ({
            turma: cls.turma,
            month: cls.month ?? null,
            days: cls.days || '-',
            status: cls.status || 'Planejado',
            invited: cls.invited || 0,
            present: cls.present || 0,
            nps: cls.nps ?? null
          }))
          .filter((cls) => cls.month !== null);

        if (classes.length === 0) {
          const month = parseMonthValue(normalizedRow.mes ?? normalizedRow.mes011 ?? normalizedRow.mes0a11);
          if (month !== null) {
            classes.push({
              turma: 'T1',
              month,
              days: normalizedRow.dias?.toString().trim() || normalizedRow.dia?.toString().trim() || '-',
              status: normalizedRow.status?.toString().trim() || normalizedRow.situacao?.toString().trim() || 'Planejado',
              invited: parseInteger(normalizedRow.convidados ?? normalizedRow.inscritos),
              present: parseInteger(normalizedRow.presentes ?? normalizedRow.participantes),
              nps: parseInteger(normalizedRow.nps) || null
            });
          }
        }

        return {
          id: findValue('id', 1)?.toString().trim() || `ID-${idx + 1}`,
          unit: findValue('unit', 2)?.toString().trim() || 'N/A',
          area: findValue('area', 3)?.toString().trim() || 'N/A',
          name: parsedName || 'Sem Nome',
          type: findValue('type', 5)?.toString().trim() || 'Interno',
          classes,
          hours: parseInteger(findValue('hours', 12)),
          cost: parseFloatValue(findValue('cost', 13))
        };
      })
      .filter((item) => item.name !== 'Sem Nome' || item.unit !== 'N/A')
      .filter((item) => item.classes.length > 0);
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
        const response = await fetch(GOOGLE_SHEETS_CSV_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Falha ao carregar Google Sheets (status ${response.status})`);
        const text = await response.text();
        parseCsvInput(
          text.replace(/^\uFEFF/, ''),
          (data) => {
            setTrainingsData(data);
            setLastUpdate(new Date().toLocaleString('pt-BR'));
            setLoading(false);
          },
          (error) => { throw error; }
        );
      } catch (error) {
        console.error('Erro ao carregar base principal (Google Sheets):', error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
    return trainingsData
      .map((training) => {
        const visibleClasses = training.classes.filter((cls) => {
          const matchMonth = filterMonths.length === 0 || filterMonths.includes(cls.month);
          return matchMonth && statusMatchesFilter(cls.status, filterStatus);
        });
        return { ...training, visibleClasses };
      })
      .filter((training) => {
        const matchUnit = filterUnits.length === 0 || filterUnits.includes(training.unit);
        const matchArea = filterAreas.length === 0 || filterAreas.includes(training.area);
        const matchType = filterType === 'Todos' || training.type === filterType;
        return matchUnit && matchArea && matchType && training.visibleClasses.length > 0;
      });
  }, [trainingsData, filterUnits, filterAreas, filterType, filterMonths, filterStatus]);

  const filteredClasses = useMemo(
    () => filteredData.flatMap((training) => training.visibleClasses.map((cls) => ({ ...cls, training }))),
    [filteredData]
  );

  // ─────────────────────────────────────────────────────────────
  // INDICATOR CALCULATIONS — all 6 statuses
  // ─────────────────────────────────────────────────────────────
  const statusRealizadoData  = filteredClasses.filter((t) => normalizeStatus(t.status) === 'realizado');
  const statusAndamentoData  = filteredClasses.filter((t) => normalizeStatus(t.status) === 'andamento');
  const statusPlanejadoData  = filteredClasses.filter((t) => normalizeStatus(t.status) === 'planejado');
  const statusCanceladoData  = filteredClasses.filter((t) => normalizeStatus(t.status) === 'cancelado');
  const statusReagendadoData = filteredClasses.filter((t) => normalizeStatus(t.status) === 'reagendado');
  const statusAtrasadoData   = filteredClasses.filter((t) => normalizeStatus(t.status) === 'atrasado');

  const totalTrainings  = filteredClasses.length;
  const countRealizado  = statusRealizadoData.length;
  const countAndamento  = statusAndamentoData.length;
  const countPlanejado  = statusPlanejadoData.length;
  const countCancelado  = statusCanceladoData.length;
  const countReagendado = statusReagendadoData.length;
  const countAtrasado   = statusAtrasadoData.length;

  const pct = (n) => Math.round((n / totalTrainings) * 100) || 0;
  const percentRealizado  = pct(countRealizado);
  const percentAndamento  = pct(countAndamento);
  const percentPlanejado  = pct(countPlanejado);
  const percentCancelado  = pct(countCancelado);
  const percentReagendado = pct(countReagendado);
  const percentAtrasado   = pct(countAtrasado);

  const totalImpacted = statusRealizadoData.reduce((acc, curr) => acc + (curr.present || 0), 0);
  const totalHours    = statusRealizadoData.reduce((acc, curr) => acc + (curr.present || 0) * (curr.training.hours || 0), 0);

  const budgetUsed = Math.min(100, Math.round(
    ((statusRealizadoData.reduce((acc, curr) => acc + (curr.training.cost || 0), 0) +
      statusPlanejadoData.reduce((acc, curr) => acc + (curr.training.cost || 0), 0)) / 1100000) * 100
  )) || 0;

  const totalInvited = statusRealizadoData.reduce((acc, curr) => acc + (curr.invited || 0), 0);
  const totalPresent = statusRealizadoData.reduce((acc, curr) => acc + (curr.present || 0), 0);
  const adhesionRate = totalInvited > 0 ? Math.min(100, Math.round((totalPresent / totalInvited) * 100)) : 0;

  const sem1Data = filteredClasses.filter((t) => t.month <= 5);
  const sem2Data = filteredClasses.filter((t) => t.month > 5);
  const sem1Percent = Math.round((sem1Data.filter((t) => normalizeStatus(t.status) === 'realizado').length / sem1Data.length) * 100) || 0;
  const sem2Percent = Math.round((sem2Data.filter((t) => normalizeStatus(t.status) === 'realizado').length / sem2Data.length) * 100) || 0;

  const toggleMultiFilter = (value, selected, setSelected) => {
    if (selected.includes(value)) {
      setSelected(selected.filter((item) => item !== value));
      return;
    }
    setSelected([...selected, value]);
  };

  // ─────────────────────────────────────────────────────────────
  // STATUS CARD STYLE — single source of truth for table cards
  // ─────────────────────────────────────────────────────────────
  const getCardStyle = (status) => {
    const norm = normalizeStatus(status);
    if (norm === 'realizado')  return { bg: colors.green,      text: 'white' };
    if (norm === 'andamento')  return { bg: colors.magenta,    text: 'white' };
    if (norm === 'cancelado')  return { bg: colors.canceled,   text: 'white' };
    if (norm === 'reagendado') return { bg: colors.rescheduled, text: 'white' };
    if (norm === 'atrasado')   return { bg: colors.delayed,     text: '#4a2c00' };
    return { bg: 'transparent', text: '#9ca3af', border: '2px dashed #e5e7eb' };
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

      {/* ── HEADER ── */}
      <header
        className="bg-white border-b-4 md:sticky md:top-0 z-50 px-8 py-6 shadow-md"
        style={{ borderBottomColor: colors.magenta }}
      >
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <div className="flex items-center">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* ── STATUS GERAL — 5 status ── */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm col-span-1 md:col-span-2">
              <p className="text-[10px] text-gray-400 uppercase font-black mb-3 tracking-widest">Status Geral do Programa</p>

              {/* Row 1: Realizado / Em Andamento / Planejado */}
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.green }}></div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Realizado</span>
                  </div>
                  <p className="text-2xl font-black" style={{ color: colors.green }}>{percentRealizado}%</p>
                  <p className="text-[9px] text-gray-400 font-bold">{countRealizado} ações</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.magenta }}></div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Em Andamento</span>
                  </div>
                  <p className="text-2xl font-black" style={{ color: colors.magenta }}>{percentAndamento}%</p>
                  <p className="text-[9px] text-gray-400 font-bold">{countAndamento} ações</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full border border-gray-300"></div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Planejado</span>
                  </div>
                  <p className="text-2xl font-black">{percentPlanejado}%</p>
                  <p className="text-[9px] text-gray-400 font-bold">{countPlanejado} ações</p>
                </div>
              </div>

              {/* Row 2: Cancelado / Reagendado / Atrasado — status de exceção */}
              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-100 opacity-60">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.canceled }}></div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Cancelado</span>
                  </div>
                  <p className="text-sm font-black">{percentCancelado}%</p>
                  <p className="text-[9px] text-gray-400 font-bold">{countCancelado} ações</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.rescheduled }}></div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Reagendado</span>
                  </div>
                  <p className="text-sm font-black">{percentReagendado}%</p>
                  <p className="text-[9px] text-gray-400 font-bold">{countReagendado} ações</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.delayed }}></div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Atrasado</span>
                  </div>
                  <p className="text-sm font-black">{percentAtrasado}%</p>
                  <p className="text-[9px] text-gray-400 font-bold">{countAtrasado} ações</p>
                </div>
              </div>

              {/* Progress bar — 6 segments, altura maior + labels */}
              <div className="mt-4">
                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden flex">
                  <div style={{ width: `${percentRealizado}%`, backgroundColor: colors.green }} className="h-full" />
                  <div style={{ width: `${percentAndamento}%`, backgroundColor: colors.magenta }} className="h-full" />
                  <div style={{ width: `${percentPlanejado}%`, backgroundColor: '#d1d5db' }} className="h-full" />
                  <div style={{ width: `${percentCancelado}%`, backgroundColor: colors.canceled }} className="h-full" />
                  <div style={{ width: `${percentReagendado}%`, backgroundColor: colors.rescheduled }} className="h-full" />
                  <div style={{ width: `${percentAtrasado}%`, backgroundColor: colors.delayed }} className="h-full" />
                </div>
                <div className="flex mt-1 text-[9px] font-black">
                  {percentRealizado > 0 && <span style={{ width: `${percentRealizado}%`, color: colors.green }} className="text-center truncate">{percentRealizado}%</span>}
                  {percentAndamento > 0 && <span style={{ width: `${percentAndamento}%`, color: colors.magenta }} className="text-center truncate">{percentAndamento}%</span>}
                  {percentPlanejado > 0 && <span style={{ width: `${percentPlanejado}%` }} className="text-center truncate text-gray-400">{percentPlanejado}%</span>}
                </div>
              </div>
            </div>

            <div className="bg-slate-800 px-4 py-4 rounded-xl shadow-md border-b-[3px] flex flex-col justify-center" style={{ borderBottomColor: colors.orange }}>
              <p className="text-[10px] text-slate-300 uppercase font-black mb-2 tracking-[0.12em]">Pessoas Impactadas</p>
              <div className="flex items-center gap-2.5">
                <Users size={24} style={{ color: colors.orange }} />
                <p className="text-4xl font-black text-white leading-none">{totalImpacted.toLocaleString()}</p>
              </div>
              <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-tight leading-snug opacity-70">Total de presenças em ações realizadas</p>
            </div>

            <div className="bg-slate-800 px-4 py-4 rounded-xl shadow-md border-b-[3px] flex flex-col justify-center" style={{ borderBottomColor: colors.pink }}>
              <p className="text-[10px] text-slate-300 uppercase font-black mb-2 tracking-[0.12em]">Horas de Formação</p>
              <div className="flex items-center gap-2.5">
                <BookOpen size={24} style={{ color: colors.pink }} />
                <p className="text-4xl font-black text-white leading-none">{totalHours.toLocaleString()}</p>
              </div>
              <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-tight leading-snug opacity-70">Presenças × CH em ações realizadas</p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="bg-white p-3 rounded-xl border border-gray-100 h-1/2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] text-gray-500 uppercase font-black">Budget utilizado</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp size={14} style={{ color: colors.orange }} />
                    <span className="text-lg font-black" style={{ color: colors.orange }}>{budgetUsed}%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${budgetUsed}%`, backgroundColor: colors.orange }} />
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-100 h-1/2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] text-gray-500 uppercase font-black">Adesão</span>
                  <div className="flex items-center gap-1">
                    <UserCheck size={14} style={{ color: colors.green }} />
                    <span className="text-lg font-black" style={{ color: colors.green }}>{adhesionRate}%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${adhesionRate}%`, backgroundColor: colors.green }} />
                </div>
              </div>
            </div>
          </div>

          <div className="-mt-4 text-right">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">ações realizadas e planejadas</p>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="max-w-7xl mx-auto p-8 relative">

        {/* ── FILTERS ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <div className="bg-white w-full sm:w-auto px-4 sm:px-5 py-3 sm:py-2.5 rounded-2xl sm:rounded-full shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center gap-3 relative">
            <div className="flex items-center gap-2 text-[11px] font-black text-gray-500 uppercase tracking-widest sm:mr-1">
              <Filter size={14} /> Filtros:
            </div>

            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setOpenFilter(openFilter === 'unit' ? null : 'unit')}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer sm:border-r sm:pr-3 flex items-center justify-between gap-1 w-full sm:w-auto"
              >
                Unidade{filterUnits.length > 0 ? `: ${filterUnits.length} selecionados` : ''}
                <ChevronDown size={15} className="text-gray-500" />
              </button>
              {openFilter === 'unit' && (
                <div className="z-20 mt-2 sm:absolute sm:top-8 sm:left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-full sm:min-w-56 max-h-64 overflow-y-auto">
                  {units.map((u) => (
                    <label key={u} className="flex items-center gap-2 py-1 text-sm">
                      <input type="checkbox" checked={filterUnits.includes(u)} onChange={() => toggleMultiFilter(u, filterUnits, setFilterUnits)} />
                      <span>{u}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setOpenFilter(openFilter === 'area' ? null : 'area')}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer sm:border-r sm:pr-3 flex items-center justify-between gap-1 w-full sm:w-auto"
              >
                Área{filterAreas.length > 0 ? `: ${filterAreas.length} selecionadas` : ''}
                <ChevronDown size={15} className="text-gray-500" />
              </button>
              {openFilter === 'area' && (
                <div className="z-20 mt-2 sm:absolute sm:top-8 sm:left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-full sm:min-w-56 max-h-64 overflow-y-auto">
                  {areas.map((a) => (
                    <label key={a} className="flex items-center gap-2 py-1 text-sm">
                      <input type="checkbox" checked={filterAreas.includes(a)} onChange={() => toggleMultiFilter(a, filterAreas, setFilterAreas)} />
                      <span>{a}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none cursor-pointer sm:border-r sm:pr-8 w-full sm:w-auto py-1 appearance-none bg-[length:14px_14px] bg-[right_8px_center] bg-no-repeat"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
            >
              <option value="Todos">Tipo</option>
              <option value="Interno">INTERNO</option>
              <option value="Externo">EXTERNO</option>
            </select>

            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setOpenFilter(openFilter === 'month' ? null : 'month')}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer sm:border-r sm:pr-3 flex items-center justify-between gap-1 w-full sm:w-auto"
              >
                Mês{filterMonths.length > 0 ? `: ${filterMonths.length} selecionados` : ''}
                <ChevronDown size={15} className="text-gray-500" />
              </button>
              {openFilter === 'month' && (
                <div className="z-20 mt-2 sm:absolute sm:top-8 sm:left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-full sm:min-w-48 max-h-64 overflow-y-auto">
                  {monthFilterLabels.map((m, idx) => (
                    <label key={m} className="flex items-center gap-2 py-1 text-sm">
                      <input type="checkbox" checked={filterMonths.includes(idx)} onChange={() => toggleMultiFilter(idx, filterMonths, setFilterMonths)} />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Status filter — includes Cancelado & Reagendado */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none cursor-pointer w-full sm:w-auto py-1 pr-6 appearance-none bg-[length:14px_14px] bg-[right_0_center] bg-no-repeat"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
            >
              <option value="Todos">Status</option>
              <option value="Realizado">Realizado</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Planejado">Planejado</option>
              <option value="Cancelado">Cancelado</option>
              <option value="Reagendado">Reagendado</option>
              <option value="Atrasado">Atrasado</option>
            </select>

            <button onClick={resetFilters} className="sm:ml-2 text-xs font-black uppercase text-slate-500 hover:text-slate-700 text-left">
              Limpar filtros
            </button>
          </div>

          {/* Legend — linha única com separadores */}
          <div className="sm:ml-auto flex items-center border border-gray-200 rounded-full overflow-hidden bg-white shadow-sm">
            <div className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-2 border-r border-gray-100">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.green }}></div> REALIZADO
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-2 border-r border-gray-100">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.magenta }}></div> EM ANDAMENTO
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-2 border-r border-gray-100">
              <div className="w-3 h-3 rounded-sm border-2 border-dashed border-gray-300"></div> PLANEJADO
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-2 border-r border-gray-100">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.canceled }}></div> CANCELADO
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-2 border-r border-gray-100">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.rescheduled }}></div> REAGENDADO
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.delayed }}></div> ATRASADO
            </div>
          </div>
        </div>

        {/* ── SEMESTER CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-white rounded-2xl p-6 shadow-sm border-l-8 flex items-center justify-between" style={{ borderLeftColor: colors.purple }}>
            <div>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-1">1º Semestre 2026</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black" style={{ color: colors.purple }}>{sem1Data.length}</span>
                <span className="text-xs font-bold text-gray-400 uppercase">Formações Previstas</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Conclusão</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black">{sem1Percent}%</span>
                <div className="w-16 h-16 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-100" />
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent"
                      strokeDasharray={175} strokeDashoffset={175 - (175 * sem1Percent) / 100}
                      style={{ color: colors.purple }} />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border-l-8 flex items-center justify-between" style={{ borderLeftColor: colors.orange }}>
            <div>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-1">2º Semestre 2026</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black" style={{ color: colors.orange }}>{sem2Data.length}</span>
                <span className="text-xs font-bold text-gray-400 uppercase">Formações Previstas</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Conclusão</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black">{sem2Percent}%</span>
                <div className="w-16 h-16 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-100" />
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent"
                      strokeDasharray={175} strokeDashoffset={175 - (175 * sem2Percent) / 100}
                      style={{ color: colors.orange }} />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── TABLE ── */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-5 text-[11px] uppercase font-black tracking-widest w-24">Unid.</th>
                  <th className="p-5 text-[11px] uppercase font-black tracking-widest min-w-[300px]">Capacitação Técnica</th>
                  <th className="p-5 text-[11px] uppercase font-black tracking-widest text-center w-20">CH</th>
                  {months.map((m) => (
                    <th key={m} className="p-3 text-[11px] uppercase font-black tracking-widest text-center min-w-[85px]">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((training, idx) => (
                  <tr key={`${training.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 border-r border-gray-50 text-center">
                      <span className="text-sm font-black text-gray-500">{training.unit}</span>
                    </td>
                    <td className="p-4 border-r border-gray-50">
                      <div className="flex flex-col">
                        <span className="text-sm font-extrabold text-slate-800">{training.name}</span>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{training.area}</span>
                          <span className="text-[10px] font-black" style={{ color: training.type === 'Interno' ? colors.purple : colors.orange }}>
                            • {training.type.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 border-r border-gray-50 text-center">
                      {training.hours > 0
                        ? <span className="text-sm font-black text-slate-700">{training.hours}h</span>
                        : <span className="text-sm text-gray-300">—</span>
                      }
                    </td>

                    {months.map((_, mIdx) => {
                      const cellClasses = training.visibleClasses.filter((cls) => cls.month === mIdx);
                      return (
                        <td key={mIdx} className="p-2 align-middle text-center border-l border-gray-50">
                          <div className="flex flex-col gap-2">
                            {cellClasses.map((cls) => {
                              const norm = normalizeStatus(cls.status);
                              const cardStyle = getCardStyle(cls.status);

                              return (
                                <div
                                  key={`${training.id}-${cls.turma}-${mIdx}`}
                                  className="flex flex-col items-center justify-center p-2 rounded shadow-sm transition-transform hover:scale-105"
                                  style={{
                                    backgroundColor: cardStyle.bg,
                                    color: cardStyle.text,
                                    border: cardStyle.border || 'none',
                                  }}
                                >
                                  <span className="text-[10px] font-black">{cls.turma}</span>
                                  <span className="text-[10px] font-black">{cls.days || '-'}</span>

                                  {norm === 'realizado' && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <span className="text-[10px] font-bold">NPS {cls.nps ?? '-'}</span>
                                    </div>
                                  )}

                                  {norm === 'andamento' && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <PlayCircle size={10} className="animate-pulse" />
                                      <span className="text-[10px] font-bold">EXECUTANDO</span>
                                    </div>
                                  )}

                                  {norm === 'cancelado' && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <XCircle size={10} />
                                      <span className="text-[10px] font-bold">CANCELADO</span>
                                    </div>
                                  )}

                                  {/* Reagendado: preserves raw text e.g. "REAGENDADO 2" */}
                                  {norm === 'reagendado' && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <CalendarClock size={10} />
                                      <span className="text-[10px] font-bold">{getStatusDisplayLabel(cls.status).toUpperCase()}</span>
                                    </div>
                                  )}

                                  {norm === 'atrasado' && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <AlertTriangle size={10} />
                                      <span className="text-[10px] font-bold">ATRASADO</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FOOTER ── */}
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
