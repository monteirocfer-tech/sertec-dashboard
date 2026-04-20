import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Filter,
  TrendingUp,
  UserCheck,
  RefreshCw,
  Award,
  PlayCircle,
  ChevronDown,
  XCircle,
  CalendarClock,
  AlertTriangle
} from 'lucide-react';

const GOOGLE_SHEETS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4GkP_Mu5rVg7AJi5gKj12o0WBCdgRm8GsM2-DtNlPx6ilflCfj0LyYg_tQTGbY1O-7rgyBT_spkk3/pub?gid=1391900322&single=true&output=csv';

// ─────────────────────────────────────────────────────────────
// STATUS NORMALIZATION
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

const getStatusDisplayLabel = (status) => {
  const raw = (status || '').toString().trim();
  const norm = normalizeStatus(raw);
  if (norm === 'reagendado') return raw;
  if (norm === 'realizado') return 'Realizado';
  if (norm === 'cancelado') return 'Cancelado';
  if (norm === 'andamento') return 'Em Andamento';
  return 'Planejado';
};

const statusMatchesFilter = (status, selectedStatuses) => {
  const norm = normalizeStatus(status);
  if (!selectedStatuses || selectedStatuses.length === 0) return true;
  return selectedStatuses.some(sel => {
    if (sel === 'Realizado') return norm === 'realizado';
    if (sel === 'Em andamento') return norm === 'andamento';
    if (sel === 'Planejado') return norm === 'planejado';
    if (sel === 'Cancelado') return norm === 'cancelado';
    if (sel === 'Reagendado') return norm === 'reagendado';
    if (sel === 'Atrasado') return norm === 'atrasado';
    return false;
  });
};

// ─────────────────────────────────────────────────────────────
// INDICATOR PARSING — extract indicators from class row
// ─────────────────────────────────────────────────────────────
const parseIndicatorsFromRow = (row) => {
  const indicators = [];
  const indicesPairs = [
    { nome: 'Ind1 Nome', unidade: 'Ind1 Unidade', antes: 'Ind1 Antes', depois: 'Ind1 Depois', periodoAnt: 'Periodo1_antes', periodoDep: 'Peiriodo1_depois', resultado: 'Resultado1', analise: 'Guardião' },
    { nome: 'Ind2 Nome', unidade: 'Ind2 Unidade', antes: 'Ind2 Antes', depois: 'Ind2 Depois', periodoAnt: 'Periodo2_antes', periodoDep: 'Periodo2_depois', resultado: 'Resultado2' },
    { nome: 'Ind3 Nome', unidade: 'Ind3 Unidade', antes: 'Ind3 Antes', depois: 'Ind3 Depois', periodoAnt: 'Periodo3_antes', periodoDep: 'Periodo3_depois', resultado: 'Resultado3' },
    { nome: 'Ind4 Nome', unidade: 'Ind4 Unidade', antes: 'Ind4 Antes', depois: 'Ind4 Depois', periodoAnt: 'Periodo4_antes', periodoDep: 'Periodo4_depois', resultado: 'Resultado4' }
  ];

  indicesPairs.forEach((pair, idx) => {
    const nome = row[pair.nome]?.toString().trim();
    if (nome && nome !== '') {
      const unidade = row[pair.unidade]?.toString().trim() || '';
      const antes = row[pair.antes]?.toString().trim() || '—';
      const depois = row[pair.depois]?.toString().trim() || '—';
      const periodoAnt = row[pair.periodoAnt]?.toString().trim() || '';
      const periodoDep = row[pair.periodoDep]?.toString().trim() || '';
      const resultado = row[pair.resultado]?.toString().trim().toLowerCase() || 'inconclusivo';
      const analise = idx === 0 ? (row['Guardião']?.toString().trim() || '') : '';

      indicators.push({
        nome,
        unidade,
        antes,
        depois,
        periodoAnt,
        periodoDep,
        resultado: resultado === 'melhorou' ? 'melhorou' : resultado === 'piorou' ? 'piorou' : 'inconclusivo',
        analise
      });
    }
  });

  return indicators;
};

const App = () => {
  const [trainingsData, setTrainingsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cal');
  const [filterUnits, setFilterUnits] = useState([]);
  const [filterAreas, setFilterAreas] = useState([]);
  const [filterTypes, setFilterTypes] = useState([]);
  const [filterMonths, setFilterMonths] = useState([]);
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [openFilter, setOpenFilter] = useState(null);
  const [openPopover, setOpenPopover] = useState(null);
  const [lastUpdate, setLastUpdate] = useState('Carregando...');

  const colors = {
    magenta: '#d61c59',
    green: '#2E7D32',
    orange: '#F57C00',
    purple: '#7B1FA2',
    pink: '#FF6B8B',
    blue: '#0288D1',
    ice: '#F4F4F4',
    graphite: '#333333',
    gray: '#6B6B6B',
    canceled: '#546E7A',
    rescheduled: '#6a1b9a',
    delayed: '#e65100',
    planned: '#cbd5e1',
    navy: '#1e293b',
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
          const justIdx = parseClassIndex(key, 'justificativa');
          if (justIdx !== null) {
            if (!classesByIndex.has(justIdx)) classesByIndex.set(justIdx, { turma: `T${justIdx}` });
            classesByIndex.get(justIdx).justificativa = value?.toString().trim() || '';
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
            nps: cls.nps ?? null,
            justificativa: cls.justificativa || ''
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
              nps: parseInteger(normalizedRow.nps) || null,
              justificativa: ''
            });
          }
        }

        // Parse indicators from this row
        const indicators = parseIndicatorsFromRow(normalizedRow);

        return {
          id: findValue('id', 1)?.toString().trim() || `ID-${idx + 1}`,
          unit: findValue('unit', 2)?.toString().trim() || 'N/A',
          area: findValue('area', 3)?.toString().trim() || 'N/A',
          name: parsedName || 'Sem Nome',
          type: findValue('type', 5)?.toString().trim() || 'Interno',
          classes,
          hours: parseInteger(findValue('hours', 12)),
          cost: parseFloatValue(findValue('cost', 13)),
          indicators
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
        let sheetDate = '';
        try {
          const metaResp = await fetch(
            `https://www.googleapis.com/drive/v3/files/1JpwTB2zribZWi0kcNWFTgwxQwUpjr8xON5xb6HwrRwQ?fields=modifiedTime&key=AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY`
          );
          if (metaResp.ok) {
            const meta = await metaResp.json();
            sheetDate = new Date(meta.modifiedTime).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            });
          }
        } catch (_) {}

        const response = await fetch(GOOGLE_SHEETS_CSV_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Falha ao carregar Google Sheets (status ${response.status})`);

        if (!sheetDate) {
          const lastModified = response.headers.get('Last-Modified');
          sheetDate = lastModified
            ? new Date(lastModified).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            : new Date().toLocaleString('pt-BR');
        }

        const text = await response.text();
        parseCsvInput(
          text.replace(/^\uFEFF/, ''),
          (data) => {
            setTrainingsData(data);
            setLastUpdate(sheetDate);
            setLoading(false);
          },
          (error) => { throw error; }
        );
      } catch (error) {
        console.error('Erro ao carregar base (Google Sheets):', error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const resetFilters = () => {
    setFilterUnits([]);
    setFilterAreas([]);
    setFilterTypes([]);
    setFilterMonths([]);
    setFilterStatuses([]);
    setOpenFilter(null);
  };

  const autoClose = () => setTimeout(() => setOpenFilter(null), 300);

  const units = useMemo(() => [...new Set(trainingsData.map((d) => d.unit))].sort(), [trainingsData]);
  const areas = useMemo(() => [...new Set(trainingsData.map((d) => d.area))].sort(), [trainingsData]);

  const filteredData = useMemo(() => {
    return trainingsData
      .map((training) => {
        const visibleClasses = training.classes.filter((cls) => {
          const matchMonth = filterMonths.length === 0 || filterMonths.includes(cls.month);
          return matchMonth && statusMatchesFilter(cls.status, filterStatuses);
        });
        return { ...training, visibleClasses };
      })
      .filter((training) => {
        const matchUnit = filterUnits.length === 0 || filterUnits.includes(training.unit);
        const matchArea = filterAreas.length === 0 || filterAreas.includes(training.area);
        const matchType = filterTypes.length === 0 || filterTypes.includes(training.type);
        return matchUnit && matchArea && matchType && training.visibleClasses.length > 0;
      });
  }, [trainingsData, filterUnits, filterAreas, filterTypes, filterMonths, filterStatuses]);

  const filteredClasses = useMemo(
    () => filteredData.flatMap((training) => training.visibleClasses.map((cls) => ({ ...cls, training }))),
    [filteredData]
  );

  // ─────────────────────────────────────────────────────────────
  // INDICATOR CALCULATIONS — all 6 statuses
  // ─────────────────────────────────────────────────────────────
  const statusRealizadoData = filteredClasses.filter((t) => normalizeStatus(t.status) === 'realizado');
  const statusAndamentoData = filteredClasses.filter((t) => normalizeStatus(t.status) === 'andamento');
  const statusPlanejadoData = filteredClasses.filter((t) => normalizeStatus(t.status) === 'planejado');
  const statusCanceladoData = filteredClasses.filter((t) => normalizeStatus(t.status) === 'cancelado');
  const statusReagendadoData = filteredClasses.filter((t) => normalizeStatus(t.status) === 'reagendado');
  const statusAtrasadoData = filteredClasses.filter((t) => normalizeStatus(t.status) === 'atrasado');

  const totalTrainings = filteredClasses.length;
  const countRealizado = statusRealizadoData.length;
  const countAndamento = statusAndamentoData.length;
  const countPlanejado = statusPlanejadoData.length;
  const countCancelado = statusCanceladoData.length;
  const countReagendado = statusReagendadoData.length;
  const countAtrasado = statusAtrasadoData.length;

  const pct = (n) => Math.round((n / totalTrainings) * 100) || 0;
  const percentRealizado = pct(countRealizado);
  const percentAndamento = pct(countAndamento);
  const percentPlanejado = pct(countPlanejado);
  const percentCancelado = pct(countCancelado);
  const percentReagendado = pct(countReagendado);
  const percentAtrasado = pct(countAtrasado);

  const totalImpacted = statusRealizadoData.reduce((acc, curr) => acc + (curr.present || 0), 0);
  const totalHours = statusRealizadoData.reduce((acc, curr) => acc + (curr.present || 0) * (curr.training.hours || 0), 0);

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

  const statusSummaryItems = [
    { label: 'Realizado', percent: percentRealizado, count: countRealizado, color: colors.green },
    { label: 'Em andamento', percent: percentAndamento, count: countAndamento, color: colors.magenta },
    { label: 'Planeado', percent: percentPlanejado, count: countPlanejado, color: colors.planned },
    { label: 'Cancelado', percent: percentCancelado, count: countCancelado, color: colors.canceled },
    { label: 'Reagendado', percent: percentReagendado, count: countReagendado, color: colors.rescheduled },
    { label: 'Atrasado', percent: percentAtrasado, count: countAtrasado, color: colors.delayed },
  ];

  const toggleMultiFilter = (value, selected, setSelected) => {
    if (selected.includes(value)) {
      setSelected(selected.filter((item) => item !== value));
      return;
    }
    setSelected([...selected, value]);
  };

  const getCardStyle = (status) => {
    const norm = normalizeStatus(status);
    if (norm === 'realizado') return { bg: colors.green, text: 'white' };
    if (norm === 'andamento') return { bg: colors.magenta, text: 'white' };
    if (norm === 'cancelado') return { bg: colors.canceled, text: 'white' };
    if (norm === 'reagendado') return { bg: colors.rescheduled, text: 'white' };
    if (norm === 'atrasado') return { bg: colors.delayed, text: 'white' };
    return { bg: 'transparent', text: '#9ca3af', border: '2px dashed #e5e7eb' };
  };

  // ─────────────────────────────────────────────────────────────
  // PERFORMANCE METRICS — Bloco 2: NPS
  // ─────────────────────────────────────────────────────────────
  const npsValues = statusRealizadoData
    .filter((t) => t.nps !== null && t.nps !== undefined)
    .map((t) => t.nps);
  const npsMedia = npsValues.length > 0 ? (npsValues.reduce((a, b) => a + b, 0) / npsValues.length).toFixed(1) : 0;

  const trainingNpsMap = useMemo(() => {
    const map = {};
    filteredData.forEach((training) => {
      const npsVals = training.visibleClasses
        .filter((cls) => normalizeStatus(cls.status) === 'realizado' && cls.nps)
        .map((cls) => cls.nps);
      if (npsVals.length > 0) {
        map[training.id] = npsVals.reduce((a, b) => a + b, 0) / npsVals.length;
      }
    });
    return map;
  }, [filteredData]);

  const top3NPS = useMemo(() => {
    return Object.entries(trainingNpsMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => filteredData.find((t) => t.id === id));
  }, [trainingNpsMap, filteredData]);

  const bottom3NPS = useMemo(() => {
    return Object.entries(trainingNpsMap)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 3)
      .map(([id]) => filteredData.find((t) => t.id === id));
  }, [trainingNpsMap, filteredData]);

  // ─────────────────────────────────────────────────────────────
  // PERFORMANCE METRICS — Bloco 1: Visão por Unidade
  // ─────────────────────────────────────────────────────────────
  const unitPerformance = useMemo(() => {
    const unitMap = {};
    filteredData.forEach((training) => {
      const npsVals = training.visibleClasses
        .filter((cls) => normalizeStatus(cls.status) === 'realizado' && cls.nps)
        .map((cls) => cls.nps);
      const npsMedia = npsVals.length > 0 ? npsVals.reduce((a, b) => a + b, 0) / npsVals.length : null;

      const totalInvitedUnit = training.visibleClasses.reduce((a, cls) => a + (cls.invited || 0), 0);
      const totalPresentUnit = training.visibleClasses.reduce((a, cls) => a + (cls.present || 0), 0);
      const adhesionUnit = totalInvitedUnit > 0 ? Math.round((totalPresentUnit / totalInvitedUnit) * 100) : null;

      const totalClasses = training.visibleClasses.length;
      const realizadoClasses = training.visibleClasses.filter((cls) => normalizeStatus(cls.status) === 'realizado').length;

      if (!unitMap[training.unit]) {
        unitMap[training.unit] = { npsValues: [], adhesionValues: [], totalClasses: 0, realizadoClasses: 0 };
      }
      if (npsMedia !== null) unitMap[training.unit].npsValues.push(npsMedia);
      if (adhesionUnit !== null) unitMap[training.unit].adhesionValues.push(adhesionUnit);
      unitMap[training.unit].totalClasses += totalClasses;
      unitMap[training.unit].realizadoClasses += realizadoClasses;
    });

    const result = Object.entries(unitMap).map(([unit, data]) => {
      const npsMed = data.npsValues.length > 0 ? Math.round(data.npsValues.reduce((a, b) => a + b, 0) / data.npsValues.length) : null;
      const adhesionMed = data.adhesionValues.length > 0 ? Math.round(data.adhesionValues.reduce((a, b) => a + b, 0) / data.adhesionValues.length) : null;
      const realizationRate = data.totalClasses > 0 ? Math.round((data.realizadoClasses / data.totalClasses) * 100) : 0;
      return { unit, nps: npsMed, adhesion: adhesionMed, realizationRate };
    });

    return result.sort((a, b) => b.realizationRate - a.realizationRate);
  }, [filteredData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F4F4]">
        <RefreshCw className="animate-spin text-pink-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F4] text-[#333333] font-sans selection:bg-pink-100 relative pb-20" onClick={() => setOpenPopover(null)}>
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/p6.png')" }}
      ></div>

      <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-10">
      {/* ── HEADER ── */}
      <header
        className="bg-white border-b-4 md:sticky md:top-0 z-50 py-2 shadow-md rounded-b-xl"
        style={{ borderBottomColor: colors.magenta }}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight flex items-center gap-1.5 leading-none">
                SER<span style={{ color: '#d61c59' }}>+</span>TEC 2026
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">
                Capacitação Técnica para nossos Talentos
              </p>
            </div>
            <div className="flex gap-1.5 border-l border-gray-200 pl-4">
              <button
                onClick={() => setActiveTab('cal')}
                className={`px-3 py-1 text-[11px] font-black uppercase tracking-wide rounded-t-md transition ${
                  activeTab === 'cal'
                    ? 'bg-white text-pink-500 border-b-4'
                    : 'bg-transparent text-gray-400 hover:text-gray-600'
                }`}
                style={activeTab === 'cal' ? { borderBottomColor: colors.magenta } : {}}
              >
                Calendário
              </button>
              <button
                onClick={() => setActiveTab('perf')}
                className={`px-3 py-1 text-[11px] font-black uppercase tracking-wide rounded-t-md transition ${
                  activeTab === 'perf'
                    ? 'bg-white text-pink-500 border-b-4'
                    : 'bg-transparent text-gray-400 hover:text-gray-600'
                }`}
                style={activeTab === 'perf' ? { borderBottomColor: colors.magenta } : {}}
              >
                Performance
              </button>
            </div>
          </div>

          {activeTab === 'cal' && (
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3">
              {/* ── STATUS GERAL — 6 status ── */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                  <p className="text-[11px] text-slate-600 uppercase font-black tracking-[0.16em] leading-none">Status Geral do Programa</p>
                </div>
                <div className="p-3.5">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {statusSummaryItems.map((item) => (
                    <div key={item.label} className="rounded-lg border border-gray-100 p-2.5 bg-slate-50/70">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 leading-none">{item.label}</span>
                      </div>
                      <p className="text-2xl font-black leading-none" style={{ color: item.color }}>{item.percent}%</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mt-1">{item.count} ações</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex">
                    {statusSummaryItems.map((item) => (
                      <div key={`bar-${item.label}`} style={{ width: `${item.percent}%`, backgroundColor: item.color }} className="h-full" />
                    ))}
                  </div>
                </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="bg-white rounded-xl border border-gray-100 h-1/2 overflow-hidden shadow-sm">
                  <div className="px-3 py-2 flex justify-between items-center" style={{ backgroundColor: colors.navy }}>
                    <span className="text-[10px] text-slate-100 uppercase font-black tracking-wide">Budget utilizado</span>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp size={12} style={{ color: colors.orange }} />
                      <span className="text-lg font-black leading-none" style={{ color: '#fff' }}>{budgetUsed}%</span>
                    </div>
                  </div>
                  <div className="px-3 py-3">
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${budgetUsed}%`, backgroundColor: colors.orange }} />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 h-1/2 overflow-hidden shadow-sm">
                  <div className="px-3 py-2 flex justify-between items-center" style={{ backgroundColor: colors.navy }}>
                    <span className="text-[10px] text-slate-100 uppercase font-black tracking-wide">Adesão</span>
                    <div className="flex items-center gap-1.5">
                      <UserCheck size={12} style={{ color: colors.green }} />
                      <span className="text-lg font-black leading-none" style={{ color: '#fff' }}>{adhesionRate}%</span>
                    </div>
                  </div>
                  <div className="px-3 py-3">
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${adhesionRate}%`, backgroundColor: colors.green }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="pt-3 pb-10 relative">

        {/* ── FILTERS — sticky below header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-3 sticky top-[106px] z-40 bg-[#F4F4F4] py-1.5">
          <div className="bg-white w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-1.5 rounded-2xl sm:rounded-full shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center gap-2.5 relative">
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest sm:mr-1">
              <Filter size={14} /> Filtros:
            </div>

            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setOpenFilter(openFilter === 'unit' ? null : 'unit')}
                className="bg-transparent text-[11px] font-black uppercase tracking-wide outline-none cursor-pointer sm:border-r sm:pr-3 flex items-center justify-between gap-1 w-full sm:w-auto"
              >
                Unidade{filterUnits.length > 0 ? `: ${filterUnits.length} selecionados` : ''}
                <ChevronDown size={15} className="text-gray-500" />
              </button>
              {openFilter === 'unit' && (
                <div className="z-20 mt-2 sm:absolute sm:top-8 sm:left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-full sm:min-w-56 max-h-64 overflow-y-auto">
                  {units.map((u) => (
                    <label key={u} className="flex items-center gap-2 py-1 text-xs cursor-pointer">
                      <input type="checkbox" checked={filterUnits.includes(u)} onChange={() => { toggleMultiFilter(u, filterUnits, setFilterUnits); autoClose(); }} />
                      <span>{u}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setOpenFilter(openFilter === 'area' ? null : 'area')}
                className="bg-transparent text-[11px] font-black uppercase tracking-wide outline-none cursor-pointer sm:border-r sm:pr-3 flex items-center justify-between gap-1 w-full sm:w-auto"
              >
                Área{filterAreas.length > 0 ? `: ${filterAreas.length} selecionadas` : ''}
                <ChevronDown size={15} className="text-gray-500" />
              </button>
              {openFilter === 'area' && (
                <div className="z-20 mt-2 sm:absolute sm:top-8 sm:left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-full sm:min-w-56 max-h-64 overflow-y-auto">
                  {areas.map((a) => (
                    <label key={a} className="flex items-center gap-2 py-1 text-xs cursor-pointer">
                      <input type="checkbox" checked={filterAreas.includes(a)} onChange={() => { toggleMultiFilter(a, filterAreas, setFilterAreas); autoClose(); }} />
                      <span>{a}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setOpenFilter(openFilter === 'type' ? null : 'type')}
                className="bg-transparent text-[11px] font-black uppercase tracking-wide outline-none cursor-pointer sm:border-r sm:pr-3 flex items-center justify-between gap-1 w-full sm:w-auto"
              >
                Tipo{filterTypes.length > 0 ? `: ${filterTypes.length} selecionados` : ''}
                <ChevronDown size={15} className="text-gray-500" />
              </button>
              {openFilter === 'type' && (
                <div className="z-20 mt-2 sm:absolute sm:top-8 sm:left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-full sm:min-w-40 max-h-64 overflow-y-auto">
                  {['Interno', 'Externo'].map((t) => (
                    <label key={t} className="flex items-center gap-2 py-1 text-xs cursor-pointer">
                      <input type="checkbox" checked={filterTypes.includes(t)} onChange={() => { toggleMultiFilter(t, filterTypes, setFilterTypes); autoClose(); }} />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setOpenFilter(openFilter === 'month' ? null : 'month')}
                className="bg-transparent text-[11px] font-black uppercase tracking-wide outline-none cursor-pointer sm:border-r sm:pr-3 flex items-center justify-between gap-1 w-full sm:w-auto"
              >
                Mês{filterMonths.length > 0 ? `: ${filterMonths.length} selecionados` : ''}
                <ChevronDown size={15} className="text-gray-500" />
              </button>
              {openFilter === 'month' && (
                <div className="z-20 mt-2 sm:absolute sm:top-8 sm:left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-full sm:min-w-48 max-h-64 overflow-y-auto">
                  {monthFilterLabels.map((m, idx) => (
                    <label key={m} className="flex items-center gap-2 py-1 text-xs cursor-pointer">
                      <input type="checkbox" checked={filterMonths.includes(idx)} onChange={() => { toggleMultiFilter(idx, filterMonths, setFilterMonths); autoClose(); }} />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setOpenFilter(openFilter === 'status' ? null : 'status')}
                className="bg-transparent text-[11px] font-black uppercase tracking-wide outline-none cursor-pointer w-full sm:w-auto flex items-center justify-between gap-1"
              >
                Status{filterStatuses.length > 0 ? `: ${filterStatuses.length} selecionados` : ''}
                <ChevronDown size={15} className="text-gray-500" />
              </button>
              {openFilter === 'status' && (
                <div className="z-20 mt-2 sm:absolute sm:top-8 sm:left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-full sm:min-w-48 max-h-64 overflow-y-auto">
                  {['Realizado', 'Em andamento', 'Planejado', 'Cancelado', 'Reagendado', 'Atrasado'].map((s) => (
                    <label key={s} className="flex items-center gap-2 py-1 text-xs cursor-pointer">
                      <input type="checkbox" checked={filterStatuses.includes(s)} onChange={() => { toggleMultiFilter(s, filterStatuses, setFilterStatuses); autoClose(); }} />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button onClick={resetFilters} className="sm:ml-2 text-[10px] font-black uppercase tracking-wide text-slate-500 hover:text-slate-700 text-left">
              Limpar filtros
            </button>
          </div>

          {/* Legend — discreta, sem cápsula */}
          <div className="sm:ml-auto flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: colors.green }}></div>Realizado
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: colors.magenta }}></div>Em andamento
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              <div className="w-2 h-2 rounded-sm border border-dashed border-gray-300"></div>Planejado
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: colors.canceled }}></div>Cancelado
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: colors.rescheduled }}></div>Reagendado
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: colors.delayed }}></div>Atrasado
            </div>
          </div>
        </div>

        {/* ── SEMESTER CARDS (only in Calendário) ── */}
        {activeTab === 'cal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 flex items-center justify-between" style={{ borderLeftColor: colors.purple }}>
              <div>
                <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">1º Semestre 2026</h3>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-4xl font-black leading-none" style={{ color: colors.purple }}>{sem1Data.length}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Formações Previstas</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-wide">Conclusão</p>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl font-black leading-none">{sem1Percent}%</span>
                  <div className="w-8 h-8 relative">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-gray-100" />
                      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="3" fill="transparent"
                        strokeDasharray={75} strokeDashoffset={75 - (75 * sem1Percent) / 100}
                        style={{ color: colors.purple }} />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 flex items-center justify-between" style={{ borderLeftColor: colors.orange }}>
              <div>
                <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">2º Semestre 2026</h3>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-4xl font-black leading-none" style={{ color: colors.orange }}>{sem2Data.length}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Formações Previstas</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-wide">Conclusão</p>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl font-black leading-none">{sem2Percent}%</span>
                  <div className="w-8 h-8 relative">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-gray-100" />
                      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="3" fill="transparent"
                        strokeDasharray={75} strokeDashoffset={75 - (75 * sem2Percent) / 100}
                        style={{ color: colors.orange }} />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data de atualização */}
        <div className="flex justify-end mb-3">
          <div className="flex items-center gap-1.5 text-[8px] text-gray-400">
            <RefreshCw size={9} className="animate-spin" style={{ animationDuration: '10s' }} />
            Base atualizada em: <span className="font-bold text-gray-600">{lastUpdate}</span>
          </div>
        </div>

        {/* ══ ABA CALENDÁRIO ══ */}
        {activeTab === 'cal' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-white" style={{ backgroundColor: colors.navy }}>
                    <th className="p-3 text-[9px] uppercase font-black tracking-widest w-16 text-center sticky top-0 z-10">Unid.</th>
                    <th className="p-3 text-[9px] uppercase font-black tracking-widest min-w-[240px] sticky top-0 z-10">Capacitação Técnica</th>
                    <th className="p-3 text-[9px] uppercase font-black tracking-widest text-center w-14 sticky top-0 z-10">CH</th>
                    {months.map((m) => (
                      <th key={m} className="p-2 text-[9px] uppercase font-black tracking-wide text-center w-[72px] min-w-[72px] max-w-[72px] sticky top-0 z-10">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.map((training, idx) => (
                    <tr key={`${training.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 border-r border-gray-50 text-center">
                        <span className="text-[11px] font-black text-gray-500">{training.unit}</span>
                      </td>
                      <td className="p-3 border-r border-gray-50">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-extrabold text-slate-800">{training.name}</span>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">{training.area}</span>
                            <span className="text-[9px] font-black" style={{ color: training.type === 'Interno' ? colors.purple : colors.orange }}>
                              • {training.type.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 border-r border-gray-50 text-center">
                        {training.hours > 0
                          ? <span className="text-[11px] font-black text-slate-700">{training.hours}h</span>
                          : <span className="text-[11px] text-gray-300">—</span>
                        }
                      </td>

                      {months.map((_, mIdx) => {
                        const cellClasses = training.visibleClasses.filter((cls) => cls.month === mIdx);
                        return (
                          <td key={mIdx} className="py-2.5 px-2 align-top text-center border-l border-gray-50 w-[72px] min-w-[72px] max-w-[72px]">
                            <div className="flex flex-col gap-2.5 min-h-[74px]">
                              {cellClasses.map((cls) => {
                                const norm = normalizeStatus(cls.status);
                                const cardStyle = getCardStyle(cls.status);
                                const popId = `${training.id}-${cls.turma}-${mIdx}`;
                                const hasPopover = norm === 'cancelado' || norm === 'reagendado' || norm === 'atrasado';
                                const isOpen = openPopover?.id === popId;

                                return (
                                  <div key={popId} className="relative">
                                    <div
                                      className={`flex flex-col items-center justify-center min-h-[64px] py-2 px-1.5 rounded shadow-sm transition-transform hover:scale-[1.02] ${hasPopover ? 'cursor-pointer' : ''}`}
                                      style={{
                                        backgroundColor: cardStyle.bg,
                                        color: cardStyle.text,
                                        border: cardStyle.border || 'none',
                                      }}
                                      onClick={hasPopover ? (e) => {
                                        e.stopPropagation();
                                        setOpenPopover(isOpen ? null : { id: popId, justificativa: cls.justificativa, status: cls.status, turma: cls.turma, days: cls.days });
                                      } : undefined}
                                    >
                                      <span className="text-[9px] font-black leading-none">{cls.turma}</span>
                                      <span className="text-[9px] font-black leading-none mt-1">{cls.days || '-'}</span>

                                      {norm === 'realizado' && (
                                        <div className="mt-1 flex items-center gap-1">
                                          <span className="text-[9px] font-bold">NPS {cls.nps ?? '-'}</span>
                                        </div>
                                      )}

                                      {norm === 'andamento' && (
                                        <div className="mt-1 flex items-center gap-1">
                                          <PlayCircle size={10} className="animate-pulse" />
                                          <span className="text-[9px] font-bold">EXECUTANDO</span>
                                        </div>
                                      )}

                                      {norm === 'cancelado' && (
                                        <div className="mt-1 flex items-center gap-1">
                                          <XCircle size={10} />
                                          <span className="text-[9px] font-bold">CANCELADO</span>
                                        </div>
                                      )}

                                      {norm === 'reagendado' && (
                                        <div className="mt-1 flex items-center gap-1">
                                          <CalendarClock size={10} />
                                          <span className="text-[9px] font-bold">{getStatusDisplayLabel(cls.status).toUpperCase()}</span>
                                        </div>
                                      )}

                                      {norm === 'atrasado' && (
                                        <div className="mt-1 flex items-center gap-1">
                                          <AlertTriangle size={10} />
                                          <span className="text-[9px] font-bold">ATRASADO</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Popover de justificativa */}
                                    {isOpen && (
                                      <div
                                        className="absolute z-50 bottom-full left-1/2 mb-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-left"
                                        style={{ transform: 'translateX(-50%)' }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="flex items-center gap-1.5 mb-2">
                                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cardStyle.bg === 'transparent' ? '#9ca3af' : cardStyle.bg }}></div>
                                          <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">{getStatusDisplayLabel(cls.status)} · {cls.turma}</span>
                                        </div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Justificativa</p>
                                        {cls.justificativa
                                          ? <p className="text-xs text-slate-700 leading-relaxed">{cls.justificativa}</p>
                                          : <p className="text-xs text-gray-400 italic">Sem justificativa registrada.</p>
                                        }
                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                          <span className="text-[9px] text-gray-400">Clique fora para fechar</span>
                                        </div>
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
        )}

        {/* ══ ABA PERFORMANCE ══ */}
        {activeTab === 'perf' && (
          <div>
            {/* Bloco 1: Visão por Unidade */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
              <p className="text-[9px] font-black text-gray-400 uppercase mb-3 tracking-widest">Realização por Unidade</p>
              {unitPerformance.map((u) => (
                <div key={u.unit} className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] font-bold w-20 text-gray-700">{u.unit}</span>
                  <div className="flex-1">
                    <div className="bg-gray-100 h-4 rounded overflow-hidden">
                      <div className="h-full" style={{
                        width: `${u.realizationRate}%`,
                        backgroundColor: u.realizationRate >= 60 ? colors.green : u.realizationRate >= 30 ? colors.magenta : colors.orange
                      }}></div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold w-12 text-center">{u.realizationRate}%</span>
                  <span className="text-[8px] text-gray-500 w-24 text-right">
                    {u.nps ? `NPS ${u.nps}` : '—'} · {u.adhesion ? `${u.adhesion}% adesão` : '—'}
                  </span>
                </div>
              ))}
            </div>

            {/* Bloco 2 + 3: NPS + Financeiro */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase mb-3 tracking-widest">NPS Médio</p>
                <p className="text-4xl font-black text-green-700 mb-4">{npsMedia}</p>
                {top3NPS.length > 0 && (
                  <div className="mb-3 pb-3 border-b border-gray-100">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-2">Top 3</p>
                    {top3NPS.map((t) => t && (
                      <div key={t.id} className="text-[8px] mb-1 flex justify-between">
                        <span className="truncate">{t.name.slice(0, 35)}</span>
                        <span className="font-bold" style={{ color: colors.green }}>NPS {(trainingNpsMap[t.id] || 0).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {bottom3NPS.length > 0 && (
                  <div>
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-2">Últimos 3</p>
                    {bottom3NPS.map((t) => t && (
                      <div key={t.id} className="text-[8px] mb-1 flex justify-between">
                        <span className="truncate">{t.name.slice(0, 35)}</span>
                        <span className="font-bold" style={{ color: colors.orange }}>NPS {(trainingNpsMap[t.id] || 0).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase mb-3 tracking-widest">Eficiência Financeira</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-sm font-black" style={{ color: colors.orange }}>R$ 147</p>
                    <p className="text-[8px] text-gray-500">por pessoa</p>
                  </div>
                  <div>
                    <p className="text-sm font-black" style={{ color: colors.purple }}>R$ 38</p>
                    <p className="text-[8px] text-gray-500">por hora</p>
                  </div>
                </div>
                <div className="text-[8px] text-gray-600 mb-2">
                  <span className="font-bold">Budget utilizado:</span> R$ 189.576 de R$ 1.100.000
                </div>
                <div className="flex h-3 rounded overflow-hidden">
                  <div className="flex-1" style={{ backgroundColor: colors.orange, width: '68%' }}></div>
                  <div className="flex-1" style={{ backgroundColor: colors.purple, width: '32%' }}></div>
                </div>
              </div>
            </div>

            {/* Bloco 4: Resultados Operacionais */}
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest">Resultados Operacionais</p>
              {filteredData.map((training) => {
                const realizadas = training.visibleClasses.filter((cls) => normalizeStatus(cls.status) === 'realizado');
                if (realizadas.length === 0) return null;

                const indicators = training.indicators.filter((ind) => ind.nome && ind.nome.trim() !== '');

                return (
                  <div key={training.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 mb-3">
                    <div className="mb-3">
                      <p className="text-[10px] font-black text-slate-800">{training.name}</p>
                      <p className="text-[8px] text-gray-500">{training.unit} · {training.area} · {training.type}</p>
                    </div>

                    {indicators.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {indicators.map((ind, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded text-[8px] cursor-pointer relative group"
                            style={{
                              backgroundColor: ind.resultado === 'melhorou' ? '#e8f5e9' : ind.resultado === 'piorou' ? '#fce8e8' : '#f3f4f6',
                              border: ind.resultado === 'melhorou' ? '0.5px solid #a5d6a7' : ind.resultado === 'piorou' ? '0.5px solid #ef9a9a' : '0.5px solid #e5e7eb'
                            }}
                          >
                            <p className="font-bold mb-1 truncate" title={ind.nome}>{ind.nome}</p>
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-gray-500">{ind.antes}</span>
                              <span className="font-bold" style={{
                                color: ind.resultado === 'melhorou' ? colors.green : ind.resultado === 'piorou' ? '#a32d2d' : '#6b7280'
                              }}>→</span>
                              <span className="font-bold">{ind.depois}</span>
                            </div>
                            {ind.resultado === 'melhorou' && <span style={{ color: colors.green }}>▲ Melhorou</span>}
                            {ind.resultado === 'piorou' && <span style={{ color: '#a32d2d' }}>▼ Piorou</span>}
                            {ind.resultado === 'inconclusivo' && <span style={{ color: '#6b7280' }}>● Inconclusivo</span>}

                            {ind.analise && (
                              <div className="hidden group-hover:block absolute z-50 bottom-full left-0 mb-2 w-56 bg-slate-800 text-white rounded-lg shadow-lg p-3 text-[8px]">
                                <p className="font-bold mb-1">Análise da guardiã</p>
                                <p className="leading-relaxed">{ind.analise}</p>
                                <div className="absolute top-full left-3 border-4 border-transparent" style={{ borderTopColor: '#1e293b' }}></div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[8px] text-gray-400 italic">Indicadores operacionais não cadastrados ainda</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <footer className="mt-8 flex flex-col items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="h-[1px] w-16 bg-gray-300"></div>
            <div className="flex gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.magenta }}></div>
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.orange }}></div>
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.purple }}></div>
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.blue }}></div>
            </div>
            <div className="h-[1px] w-16 bg-gray-300"></div>
          </div>
          <div className="bg-white px-8 py-4 rounded-2xl border border-gray-200 shadow-sm text-center max-w-lg">
            <p className="text-sm text-gray-500 font-medium">
              Desenvolvendo pessoas, elevando performance. <br />
              Dúvidas? Fale com <span className="font-black" style={{ color: colors.magenta }}>Fernanda Monteiro</span>.
            </p>
          </div>
        </footer>
      </main>
      </div>

      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; }
          @media print {
            .no-print { display: none !important; }
            header { position: static !important; border-bottom: 4px solid #d61c59 !important; }
            table { border: 1px solid #ddd !important; }
            thead tr { background-color: #1e293b !important; -webkit-print-color-adjust: exact; }
          }
        `}
      </style>
    </div>
  );
};

export default App;
