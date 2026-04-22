import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Filter,
  TrendingUp,
  TrendingDown,
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
  const getFieldByAliases = (aliases = []) => {
    for (const key of aliases) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  };

  const guardiaoNome = getFieldByAliases([
    'guardiaonome',
    'nomeguardiao',
    'guardiao',
    'guardian',
    'responsavelguardiao'
  ]);
  const analiseGuardiao = getFieldByAliases([
    'analisedoguardiao',
    'analisedoguardiao',
    'analiseguardiao',
    'analise',
    'comentariosguardiao'
  ]) || guardiaoNome;
  const periodoPadrao = getFieldByAliases(['periodo', 'periodoreferencia', 'periodoanalise']);

  const indicators = [];
  const indicesPairs = [
    { nome: 'ind1nome', unidade: 'ind1unidade', antes: 'ind1antes', depois: 'ind1depois', periodoAnt: 'periodo1antes', periodoDep: 'periodo1depois', resultado: 'resultado1', analise: 'analise1guardiao', guardiao: 'guardiao1', periodo: 'periodo1' },
    { nome: 'ind2nome', unidade: 'ind2unidade', antes: 'ind2antes', depois: 'ind2depois', periodoAnt: 'periodo2antes', periodoDep: 'periodo2depois', resultado: 'resultado2', analise: 'analise2guardiao', guardiao: 'guardiao2', periodo: 'periodo2' },
    { nome: 'ind3nome', unidade: 'ind3unidade', antes: 'ind3antes', depois: 'ind3depois', periodoAnt: 'periodo3antes', periodoDep: 'periodo3depois', resultado: 'resultado3', analise: 'analise3guardiao', guardiao: 'guardiao3', periodo: 'periodo3' },
    { nome: 'ind4nome', unidade: 'ind4unidade', antes: 'ind4antes', depois: 'ind4depois', periodoAnt: 'periodo4antes', periodoDep: 'periodo4depois', resultado: 'resultado4', analise: 'analise4guardiao', guardiao: 'guardiao4', periodo: 'periodo4' }
  ];

  const getIndicatorFieldValue = (primaryKey, aliases = []) => {
    const allAliases = [primaryKey, ...aliases].filter(Boolean);
    for (const key of allAliases) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  };

  indicesPairs.forEach((pair, idx) => {
    const indicatorNumber = idx + 1;
    const nome = getIndicatorFieldValue(pair.nome, [
      `indicador${indicatorNumber}nome`,
      `ind${indicatorNumber}`,
      `indicador${indicatorNumber}`
    ]);
    if (nome && nome !== '') {
      const unidade = getIndicatorFieldValue(pair.unidade, [`indicador${indicatorNumber}unidade`]) || '';
      const antes = getIndicatorFieldValue(pair.antes, [
        `indicador${indicatorNumber}antes`,
        `ind${indicatorNumber}before`
      ]) || '—';
      const depois = getIndicatorFieldValue(pair.depois, [
        `indicador${indicatorNumber}depois`,
        `indicador${indicatorNumber}apos`,
        `ind${indicatorNumber}after`
      ]) || '—';
      const periodoAnt = getIndicatorFieldValue(pair.periodoAnt, [
        `periodo${indicatorNumber}ant`,
        `periodo${indicatorNumber}before`,
        `mes${indicatorNumber}antes`,
        `mes${indicatorNumber}ant`,
        `mes${indicatorNumber}before`,
        `indicador${indicatorNumber}mesantes`,
        `indicador${indicatorNumber}mesant`
      ]) || '';
      const periodoDep = getIndicatorFieldValue(pair.periodoDep, [
        `periodo${indicatorNumber}apos`,
        `periodo${indicatorNumber}dep`,
        `periodo${indicatorNumber}after`,
        `mes${indicatorNumber}depois`,
        `mes${indicatorNumber}apos`,
        `mes${indicatorNumber}dep`,
        `mes${indicatorNumber}after`,
        `indicador${indicatorNumber}mesdepois`,
        `indicador${indicatorNumber}mesapos`
      ]) || '';
      const resultado = (getIndicatorFieldValue(pair.resultado, [`indicador${indicatorNumber}resultado`]) || 'inconclusivo').toLowerCase();
      const analise = getIndicatorFieldValue(pair.analise ?? '', [`indicador${indicatorNumber}analise`]) || analiseGuardiao;
      const guardiao = getIndicatorFieldValue(pair.guardiao ?? '', [`indicador${indicatorNumber}guardiao`]) || guardiaoNome;
      const periodo = getIndicatorFieldValue(pair.periodo ?? '', [`indicador${indicatorNumber}periodo`]) || periodoPadrao;

      indicators.push({
        nome,
        unidade,
        antes,
        depois,
        periodoAnt,
        periodoDep,
        periodo,
        resultado: resultado === 'melhorou' ? 'melhorou' : resultado === 'piorou' ? 'piorou' : 'inconclusivo',
        analise,
        guardiao
      });
    }
  });

  return indicators;
};

const BUDGET_TOTAL = 1_100_000;

const DashboardHeader = ({ activeTab, onTabChange }) => (
  <header className="dashboard-header md:sticky md:top-0 z-50 shadow-sm">
    <div className="header-content">
      <div>
        <h1 className="dashboard-title">
          SER <span style={{ color: '#d61c59' }}>+</span> TEC 2026
        </h1>
        <p className="dashboard-subtitle">Capacitação Técnica para nossos Talentos</p>
      </div>
      <nav className="header-nav" aria-label="Navegação principal do dashboard">
        <button
          onClick={() => onTabChange('cal')}
          className={`header-nav-item ${activeTab === 'cal' ? 'active' : ''}`}
        >
          Calendário
        </button>
        <button
          onClick={() => onTabChange('perf')}
          className={`header-nav-item ${activeTab === 'perf' ? 'active' : ''}`}
        >
          Performance
        </button>
      </nav>
    </div>
  </header>
);

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
  const [lastUpdate, setLastUpdate] = useState(null);
  const [operationalFilter, setOperationalFilter] = useState('todos');
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [openPopover, setOpenPopover] = useState(null);

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

  const parseOptionalFloatValue = (value) => {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const parsed = parseFloatValue(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const calcDelta = (item) => {
    const po = parseFloatValue(item?.po);
    const cost = parseFloatValue(item?.cost);

    if (po > 0 && cost > 0 && cost <= po) {
      return { type: 'saving', value: po - cost };
    }
    if (po > 0 && cost > 0 && cost > po) {
      return { type: 'cost_increase', value: cost - po };
    }
    if (po > 0 && cost === 0) {
      return { type: null, value: 0 };
    }
    if (po === 0 && cost > 0) {
      return { type: 'cost_increase', value: cost };
    }
    return { type: null, value: 0 };
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

  const formatDateTimeBR = (value) => {
    if (!value) return '--';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const extractBaseLastUpdated = (rows) => {
    const lastUpdatedKeys = new Set([
      'lastupdated',
      'updatedat',
      'ultimaatualizacao',
      'dataatualizacao',
      'datahoraatualizacao',
      'metadataupdatedat'
    ]);

    for (const row of rows || []) {
      const entries = Object.entries(row || {});
      for (const [key, value] of entries) {
        const normalizedKey = normalizeHeader(key);
        if (!lastUpdatedKeys.has(normalizedKey)) continue;
        if (!value) continue;
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
      }
    }
    return null;
  };

  const processRows = (rows) => {
    const aliases = {
      id: ['id'],
      unit: ['unidade', 'unit'],
      area: ['area', 'departamento'],
      name: ['nomedotreinamento', 'treinamento', 'capacitacaotecnica', 'capacitacao', 'nome'],
      type: ['tipo', 'tipodotreinamento'],
      hours: ['horas', 'cargahoraria', 'ch'],
      cost: ['custo', 'valorreal', 'real'],
      po: ['po', 'ordemdecompra', 'purchaseorder', 'orcamento', 'valorpo', 'custopo', 'valorpor'],
      supplier: ['fornecedor', 'supplier', 'vendor', 'parceiro', 'fornecedora']
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
        const rawCostValue = findValue('cost', 13);
        const rawPoValue = findValue('po', 14);
        const parsedCost = parseOptionalFloatValue(rawCostValue);
        const parsedPo = parseOptionalFloatValue(rawPoValue);
        const parsedSupplier = findValue('supplier', 15)?.toString().trim() || '';
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
            const parsedNps = parseInteger(value);
            classesByIndex.get(npsIdx).nps = value === '' || value === null || value === undefined ? null : parsedNps;
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
              nps: normalizedRow.nps === '' || normalizedRow.nps === null || normalizedRow.nps === undefined
                ? null
                : parseInteger(normalizedRow.nps),
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
          cost: parsedCost ?? 0,
          po: parseFloatValue(findValue('po', 14)),
          hasCostValue: parsedCost !== null,
          hasPoValue: parsedPo !== null,
          supplier: parsedSupplier,
          fornecedor: parsedSupplier,
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
        onComplete(processed, result.data || []);
      },
      error: onError
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        let sourceLastUpdated = null;
        try {
          const metaResp = await fetch(
            `https://www.googleapis.com/drive/v3/files/1JpwTB2zribZWi0kcNWFTgwxQwUpjr8xON5xb6HwrRwQ?fields=modifiedTime&key=AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY`
          );
          if (metaResp.ok) {
            const meta = await metaResp.json();
            sourceLastUpdated = meta?.modifiedTime || null;
          }
        } catch (_) {}

        const response = await fetch(GOOGLE_SHEETS_CSV_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Falha ao carregar Google Sheets (status ${response.status})`);

        if (!sourceLastUpdated) {
          const lastModified = response.headers.get('Last-Modified');
          sourceLastUpdated = lastModified || null;
        }

        const text = await response.text();
        parseCsvInput(
          text.replace(/^\uFEFF/, ''),
          (data, rawRows) => {
            const baseLastUpdated = extractBaseLastUpdated(rawRows) || sourceLastUpdated || null;
            setTrainingsData(data);
            setLastUpdate(baseLastUpdated);
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

  useEffect(() => {
    const handleGlobalClick = () => { setActiveTooltip(null); setOpenPopover(null); };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
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

  const totalCostRealizado = statusRealizadoData.reduce((acc, curr) => acc + (curr.training.cost || 0), 0);
  const totalCostPlanejado = statusPlanejadoData.reduce((acc, curr) => acc + (curr.training.cost || 0), 0);
  const horasPorPessoa = totalImpacted > 0 ? (totalHours / totalImpacted).toFixed(1) : '0.0';
  const custoMedioPorPessoa = totalImpacted > 0 ? Math.round(totalCostRealizado / totalImpacted) : 0;
  const budgetUsed = Math.min(100, Math.round((totalCostRealizado / BUDGET_TOTAL) * 100)) || 0;

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
  const npsSomatorio = npsValues.reduce((acc, value) => acc + value, 0);
  const npsContagem = npsValues.length;

  const npsClassRankings = useMemo(() => {
    return statusRealizadoData
      .filter((cls) => Number.isFinite(cls.nps))
      .map((cls, idx) => ({
        classKey: `${cls.training?.id || 'sem-id'}-${cls.turma || 'sem-turma'}-${idx}`,
        trainingName: cls.training?.name || 'Treinamento sem nome',
        unit: cls.training?.unit || 'Unidade não informada',
        fornecedor: cls.training?.fornecedor || '',
        turma: cls.turma || 'Turma sem nome',
        score: cls.nps,
      }));
  }, [statusRealizadoData]);

  const top5NPS = useMemo(() => {
    return [...npsClassRankings]
      .sort((a, b) => (
        b.score - a.score ||
        a.trainingName.localeCompare(b.trainingName, 'pt-BR') ||
        a.turma.localeCompare(b.turma, 'pt-BR')
      ))
      .slice(0, 5);
  }, [npsClassRankings]);

  const bottom5NPS = useMemo(() => {
    return [...npsClassRankings]
      .filter((entry) => entry.score < 50)
      .sort((a, b) => (
        a.score - b.score ||
        a.trainingName.localeCompare(b.trainingName, 'pt-BR') ||
        a.turma.localeCompare(b.turma, 'pt-BR')
      ))
      .slice(0, 5);
  }, [npsClassRankings]);

  // ─────────────────────────────────────────────────────────────
  // PERFORMANCE METRICS — Bloco 1: Visão por Unidade
  // ─────────────────────────────────────────────────────────────
  const unitPerformance = useMemo(() => {
    const unitMap = {};
    filteredData.forEach((training) => {
      const npsVals = training.visibleClasses
        .filter((cls) => normalizeStatus(cls.status) === 'realizado' && Number.isFinite(cls.nps))
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

  // ─────────────────────────────────────────────────────────────
  // UNIT BAR DATA — segmented by training/turma
  // ─────────────────────────────────────────────────────────────
  const unitBarData = useMemo(() => {
    const getMonthSortValue = (month) => (Number.isInteger(month) ? month : Number.POSITIVE_INFINITY);
    const unitMap = {};
    filteredData.forEach((training) => {
      const u = training.unit;
      if (!unitMap[u]) unitMap[u] = { trainings: [], totalClasses: 0, realizadoClasses: 0 };
      const sortedVisibleClasses = [...training.visibleClasses].sort((a, b) => {
        const monthDiff = getMonthSortValue(a.month) - getMonthSortValue(b.month);
        if (monthDiff !== 0) return monthDiff;
        return String(a.turma || '').localeCompare(String(b.turma || ''), 'pt-BR');
      });
      const cls = sortedVisibleClasses;
      unitMap[u].trainings.push({ ...training, visibleClasses: sortedVisibleClasses });
      unitMap[u].totalClasses += cls.length;
      unitMap[u].realizadoClasses += cls.filter((c) => normalizeStatus(c.status) === 'realizado').length;
    });
    return Object.entries(unitMap)
      .map(([unit, data]) => ({
        unit,
        trainings: data.trainings.sort((a, b) => {
          const aMin = Math.min(...a.visibleClasses.map((c) => getMonthSortValue(c.month)));
          const bMin = Math.min(...b.visibleClasses.map((c) => getMonthSortValue(c.month)));
          if (aMin !== bMin) return aMin - bMin;
          return (a.name || '').localeCompare((b.name || ''), 'pt-BR');
        }),
        totalClasses: data.totalClasses,
        realizadoClasses: data.realizadoClasses,
        realizationRate: data.totalClasses > 0 ? Math.round((data.realizadoClasses / data.totalClasses) * 100) : 0,
      }))
      .sort((a, b) => b.realizationRate - a.realizationRate);
  }, [filteredData]);

  const getClassBarColor = (status) => {
    const n = normalizeStatus(status);
    if (n === 'realizado') return { bg: '#2e7d32', border: null };
    if (n === 'cancelado') return { bg: '#607d8b', border: null };
    if (n === 'atrasado') return { bg: '#e65100', border: null };
    if (n === 'reagendado') return { bg: '#7b1fa2', border: null };
    return { bg: '#f1f5f9', border: '1px solid #e2e8f0' };
  };

  const extractMonthsFromText = (value) => {
    const raw = (value || '').toString().trim();
    if (!raw) return [];
    const normalized = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const matches = [];
    Object.entries(monthByText).forEach(([monthText, monthIndex]) => {
      const regex = new RegExp(`\\b${monthText}\\w*\\b`, 'g');
      if (regex.test(normalized)) matches.push(monthIndex);
    });
    return [...new Set(matches)].sort((a, b) => a - b).map((monthIndex) => months[monthIndex]);
  };

  const normalizePeriodLabel = (value, fallback = '', contextValue = '', prefer = 'first') => {
    const raw = (value || '').toString().trim();
    const parsedMonth = parseMonthValue(raw);
    if (Number.isInteger(parsedMonth)) return months[parsedMonth];
    const normalized = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (!raw) {
      return fallback || '—';
    }
    const genericLabels = new Set(['antes', 'depois', 'apos', 'before', 'after']);
    if (genericLabels.has(normalized)) {
      const contextMonths = extractMonthsFromText(contextValue);
      if (contextMonths.length > 0) {
        return prefer === 'last' ? contextMonths[contextMonths.length - 1] : contextMonths[0];
      }
      return fallback || '—';
    }
    return raw.toUpperCase();
  };

  const getFallbackPeriodLabels = (training) => {
    const sortedMonths = [...new Set((training?.visibleClasses || [])
      .map((cls) => cls.month)
      .filter((month) => Number.isInteger(month)))]
      .sort((a, b) => a - b);
    const afterMonth = sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : null;
    const beforeMonth = Number.isInteger(afterMonth) && afterMonth > 0 ? afterMonth - 1 : null;
    return {
      before: Number.isInteger(beforeMonth) ? months[beforeMonth] : 'ANTES',
      after: Number.isInteger(afterMonth) ? months[afterMonth] : 'DEPOIS',
    };
  };

  const handleBarClick = (e, training, idx, cls) => {
    e.stopPropagation();
    setActiveTooltip((prev) => {
      if (prev?.id === idx) return null;
      return { id: idx, x: e.clientX, y: e.clientY, training, cls };
    });
  };

  const renderTooltip = () => {
    if (!activeTooltip) return null;
    const { training, cls, x, y } = activeTooltip;
    const top = Math.max(16, Math.min(y + 14, window.innerHeight - 230));
    const left = Math.max(16, Math.min(x + 14, window.innerWidth - 330));

    return (
      <div
        className="fixed w-[310px] max-w-[calc(100vw-24px)] bg-[#1e293b] text-white rounded-xl px-3.5 py-3 shadow-2xl"
        style={{ top, left, zIndex: 9999 }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[12px] font-black leading-snug">{training.name}</p>
        <div className="mt-2 space-y-1 text-[11px] text-slate-200">
          <p><span className="text-slate-400">Status:</span> {getStatusDisplayLabel(cls.status)}</p>
          <p><span className="text-slate-400">Unidade:</span> {training.unit}</p>
          <p><span className="text-slate-400">Mês:</span> {Number.isInteger(cls.month) ? months[cls.month] : '—'}</p>
          <p><span className="text-slate-400">Carga horária:</span> {training.hours > 0 ? `${training.hours}h` : '—'}</p>
          <p><span className="text-slate-400">Tipo:</span> {training.type || '—'}</p>
          <p><span className="text-slate-400">Participantes:</span> {cls.present ?? 0}</p>
          <p><span className="text-slate-400">NPS:</span> {cls.nps ?? '—'}</p>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // FINANCIAL — external trainings only
  // ─────────────────────────────────────────────────────────────
  const externalRealizadoTrainings = filteredData.filter((t) =>
    (t.type || '').toLowerCase().includes('extern') &&
    t.visibleClasses.some((c) => normalizeStatus(c.status) === 'realizado')
  );
  const externalPlanejadoTrainings = filteredData.filter((t) =>
    (t.type || '').toLowerCase().includes('extern') &&
    !t.visibleClasses.some((c) => normalizeStatus(c.status) === 'realizado') &&
    t.visibleClasses.some((c) => ['planejado', 'reagendado'].includes(normalizeStatus(c.status)))
  );
  const totalInvestimentoRealizado = externalRealizadoTrainings.reduce((acc, t) => acc + (t.cost || 0), 0);
  const totalInvestimentoPlanejado = externalPlanejadoTrainings.reduce((acc, t) => acc + (t.po || t.cost || 0), 0);
  const totalExternalImpacted = externalRealizadoTrainings.reduce(
    (acc, t) => acc + t.visibleClasses.filter((c) => normalizeStatus(c.status) === 'realizado').reduce((s, c) => s + (c.present || 0), 0),
    0
  );
  const custoMedioExterno = totalExternalImpacted > 0 ? Math.round(totalInvestimentoRealizado / totalExternalImpacted) : 0;
  const budgetExternoPercent = Math.round((totalInvestimentoRealizado / BUDGET_TOTAL) * 100) || 0;
  const totalPrevisto = totalInvestimentoRealizado + totalInvestimentoPlanejado;
  const budgetEstourado = totalPrevisto > BUDGET_TOTAL;

  const top5Financial = useMemo(() => {
    const extractFirstDayNumber = (rawDays) => {
      const match = (rawDays || '').toString().match(/\d+/);
      return match ? Number.parseInt(match[0], 10) : -1;
    };

    const getT1Class = (training) =>
      training.classes.find((cls) => cls.turma === 'T1') || training.classes[0] || null;

    return filteredData
      .map((training) => {
        const delta = calcDelta(training);
        if (!delta?.type) return null;
        const t1Class = getT1Class(training);
        const monthIndex = Number.isInteger(t1Class?.month) ? t1Class.month : -1;
        const dayIndex = extractFirstDayNumber(t1Class?.days);
        return {
          ...training,
          deltaType: delta.type,
          deltaValue: delta.value,
          monthIndex,
          dayIndex
        };
      })
      .filter(Boolean)
      .sort((a, b) => (
        b.monthIndex - a.monthIndex ||
        b.dayIndex - a.dayIndex ||
        (a.name || '').localeCompare((b.name || ''), 'pt-BR') ||
        String(a.id || '').localeCompare(String(b.id || ''), 'pt-BR')
      ))
      .slice(0, 5);
  }, [filteredData]);

  const totalSavingAccum = trainingsData.reduce((acc, item) => {
    const d = calcDelta(item);
    return d?.type === 'saving' ? acc + d.value : acc;
  }, 0);
  const totalCostIncreaseAccum = trainingsData.reduce((acc, item) => {
    const d = calcDelta(item);
    return d?.type === 'cost_increase' ? acc + d.value : acc;
  }, 0);

  // ─────────────────────────────────────────────────────────────
  // OPERATIONAL RESULTS — filtered view
  // ─────────────────────────────────────────────────────────────
  const filteredOperationalData = useMemo(() => {
    return filteredData.filter((training) => {
      const hasIndicators = training.indicators.some((i) => i.nome);
      const hasRealized = training.visibleClasses.some((c) => normalizeStatus(c.status) === 'realizado');
      if (!hasIndicators || !hasRealized) return false;
      if (operationalFilter === 'melhoraram') return training.indicators.some((i) => i.resultado === 'melhorou');
      if (operationalFilter === 'pioraram') return training.indicators.some((i) => i.resultado === 'piorou');
      if (operationalFilter === 'neutros') return training.indicators.every((i) => i.resultado === 'inconclusivo');
      return true;
    });
  }, [filteredData, operationalFilter]);

  const npsBandDistribution = {
    green: npsValues.filter((value) => value >= 75).length,
    magenta: npsValues.filter((value) => value >= 50 && value < 75).length,
    orange: npsValues.filter((value) => value < 50).length
  };
  const totalNpsBand = npsValues.length || 1;
  const npsBandPercentages = {
    green: npsContagem > 0 ? Math.round((npsBandDistribution.green / npsContagem) * 100) : 0,
    magenta: npsContagem > 0 ? Math.round((npsBandDistribution.magenta / npsContagem) * 100) : 0,
    orange: npsContagem > 0 ? Math.round((npsBandDistribution.orange / npsContagem) * 100) : 0,
  };
  const improvedIndicators = filteredData.reduce(
    (acc, training) => acc + training.indicators.filter((ind) => ind.resultado === 'melhorou').length,
    0
  );
  const worsenedIndicators = filteredData.reduce(
    (acc, training) => acc + training.indicators.filter((ind) => ind.resultado === 'piorou').length,
    0
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9]">
        <RefreshCw className="animate-spin text-pink-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-[#333333] font-sans selection:bg-pink-100 relative pb-20">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/p6.png')" }}
      ></div>

      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 pb-7 pt-4 box-border">
      {/* ── HEADER ── */}
      <DashboardHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── MAIN ── */}
      <main className="pt-2 pb-8 relative">
        {activeTab === 'cal' && (
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3 mb-3">
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

        {/* ── FILTERS — sticky below header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-3 sticky top-0 md:top-[76px] z-40 bg-[#f1f5f9] py-2 shadow-[0_4px_12px_rgba(0,0,0,0.07)]">
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

          {/* Legend */}
          <div className="sm:ml-auto flex items-center gap-3.5 flex-wrap">
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
            Base atualizada em: <span className="font-bold text-gray-600">{formatDateTimeBR(lastUpdate)}</span>
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
                      <th key={m} className="p-2 text-[9px] uppercase font-black tracking-wide text-center w-[78px] min-w-[78px] max-w-[78px] sticky top-0 z-10">{m}</th>
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
                          <td key={mIdx} className="py-2.5 px-2 align-middle overflow-visible text-center border-l border-gray-50 w-[78px] min-w-[78px] max-w-[78px]">
                            <div className="flex flex-col items-center gap-2.5 min-h-[74px] overflow-visible">
                              {cellClasses.map((cls) => {
                                const norm = normalizeStatus(cls.status);
                                const cardStyle = getCardStyle(cls.status);
                                const popId = `${training.id}-${cls.turma}-${mIdx}`;
                                const isOpen = openPopover?.id === popId;
                                const hasPopover = ['reagendado', 'atrasado', 'cancelado'].includes(norm);

                                return (
                                  <div key={popId} className="relative">
                                    <div
                                      className={`inline-flex flex-col items-center justify-center min-w-[64px] max-w-[78px] min-h-[46px] py-1.5 px-2 rounded shadow-sm transition-transform hover:scale-[1.02] ${hasPopover ? 'cursor-pointer' : ''}`}
                                      style={{
                                        backgroundColor: cardStyle.bg,
                                        color: cardStyle.text,
                                        border: cardStyle.border || 'none',
                                        boxSizing: 'border-box',
                                        whiteSpace: 'normal',
                                        wordBreak: 'keep-all',
                                        overflowWrap: 'break-word',
                                        textAlign: 'center',
                                        lineHeight: 1.1,
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
                                        <div className="mt-1 flex items-center justify-center gap-1">
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
          <div className="max-w-[1120px] mx-auto px-1">

            {/* 1. KPI CARDS — 3 colunas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px] mb-[18px]">
              <div className="bg-[#1e293b] rounded-2xl px-5 pt-4 pb-3.5 border-b-4 min-h-[108px] flex flex-col justify-center relative overflow-hidden" style={{ borderBottomColor: '#e65100' }}>
                <Award size={90} className="absolute -right-3 -bottom-5 text-white" style={{ opacity: 0.08 }} />
                <p className="text-[12px] font-black uppercase tracking-[0.06em] text-slate-200 mb-1.5 relative z-10">Pessoas Impactadas</p>
                <p className="text-[28px] font-black text-white leading-[1.05] relative z-10">{totalImpacted}</p>
                <p className="text-[11px] font-semibold text-slate-300 mt-1.5 relative z-10">Participantes em turmas realizadas</p>
              </div>
              <div className="bg-[#1e293b] rounded-2xl px-5 pt-4 pb-3.5 border-b-4 min-h-[108px] flex flex-col justify-center relative overflow-hidden" style={{ borderBottomColor: '#d61c59' }}>
                <PlayCircle size={90} className="absolute -right-3 -bottom-5 text-white" style={{ opacity: 0.08 }} />
                <p className="text-[12px] font-black uppercase tracking-[0.06em] text-slate-200 mb-1.5 relative z-10">Horas de Formação</p>
                <p className="text-[28px] font-black text-white leading-[1.05] relative z-10">{totalHours}</p>
                <p className="text-[11px] font-semibold text-slate-300 mt-1.5 relative z-10">Carga horária total de turmas realizadas</p>
              </div>
              <div className="bg-[#1e293b] rounded-2xl px-5 pt-4 pb-3.5 border-b-4 min-h-[108px] flex flex-col justify-center relative overflow-hidden" style={{ borderBottomColor: '#0288D1' }}>
                <UserCheck size={90} className="absolute -right-3 -bottom-5 text-white" style={{ opacity: 0.08 }} />
                <p className="text-[12px] font-black uppercase tracking-[0.06em] text-slate-200 mb-1.5 relative z-10">Hora / Pessoa</p>
                <p className="text-[28px] font-black text-white leading-[1.05] relative z-10">{horasPorPessoa}h</p>
                <p className="text-[11px] font-semibold text-slate-300 mt-1.5 relative z-10">Média de horas por participante realizado</p>
              </div>
            </div>

            {/* 2. REALIZAÇÃO POR UNIDADE */}
            <div className="bg-white rounded-3xl px-[18px] pt-[18px] pb-[16px] shadow-sm mb-[18px]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Realização por Unidade</p>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Progresso granular de capacitações e turmas</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  {[
                    { label: 'Realizado', color: '#2e7d32', dashed: false },
                    { label: 'Planejado', color: '#f1f5f9', dashed: true },
                    { label: 'Cancelado', color: '#607d8b', dashed: false },
                    { label: 'Atrasado', color: '#e65100', dashed: false },
                    { label: 'Reagendado', color: '#7b1fa2', dashed: false },
                  ].map(({ label, color, dashed }) => (
                    <div key={label} className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color, border: dashed ? '1px solid #e2e8f0' : undefined }}></div>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                {unitBarData.map((u, unitIdx) => (
                  <div key={u.unit} className="grid grid-cols-[80px_1fr_48px] items-center gap-2">
                    <span className="text-[11px] font-black uppercase text-slate-700 leading-tight">{u.unit}</span>
                    <div className="flex items-center h-5 gap-[2px]">
                      {u.trainings.map((training, trainingIdx) => {
                        const segWidth = u.totalClasses > 0 ? (training.visibleClasses.length / u.totalClasses) * 100 : 0;
                        return (
                          <div
                            key={training.id}
                            className="h-full flex items-center gap-[1px] rounded-sm overflow-visible"
                            style={{ width: `${segWidth}%`, minWidth: '6px' }}
                          >
                            {training.visibleClasses.map((cls, ci) => {
                              const clr = getClassBarColor(cls.status);
                              const classId = `${u.unit}-${unitIdx}-${training.id || trainingIdx}-${cls.turma || ci}-${ci}`;
                              return (
                                <button
                                  type="button"
                                  key={classId}
                                  className="relative h-full rounded-[2px] flex-1 cursor-pointer p-0 border-0 bg-transparent"
                                  style={{ backgroundColor: clr.bg, border: clr.border || 'none', minWidth: '4px' }}
                                  onClick={(e) => handleBarClick(e, training, classId, cls)}
                                >
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                    <span className="text-[12px] font-black text-slate-700 text-right">{u.realizationRate}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. NPS + EFICIÊNCIA FINANCEIRA */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] mb-[18px] items-start">

              {/* NPS */}
              <div className="bg-white rounded-2xl p-[18px] border border-slate-100">
                <p className="text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Análise de NPS</p>
                <p className="text-[38px] font-black leading-none mb-2.5" style={{ color: '#15803d' }}>{npsMedia}</p>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 mb-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Cálculo real aplicado no card</p>
                  <p className="text-[11px] font-semibold text-slate-700 mt-1">
                    NPS exibido = (somatório do NPS das turmas realizadas com NPS preenchido) / quantidade de turmas.
                  </p>
                  <p className="text-[11px] font-semibold text-slate-700 mt-1">
                    ({npsSomatorio.toFixed(1)} / {npsContagem}) = {npsMedia}
                  </p>
                </div>
                <div className="rounded-full overflow-hidden h-4 flex mt-2.5 mb-4 bg-slate-100">
                  <div style={{ width: `${(npsBandDistribution.green / totalNpsBand) * 100}%`, backgroundColor: '#15803d' }}></div>
                  <div style={{ width: `${(npsBandDistribution.magenta / totalNpsBand) * 100}%`, backgroundColor: '#d61c59' }}></div>
                  <div style={{ width: `${(npsBandDistribution.orange / totalNpsBand) * 100}%`, backgroundColor: '#e65100' }}></div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-slate-50 rounded-md p-2">
                    <p className="text-[10px] font-black uppercase text-slate-500">Alta (75+)</p>
                    <p className="text-sm font-black text-slate-900">{npsBandDistribution.green} <span className="text-slate-500">({npsBandPercentages.green}%)</span></p>
                  </div>
                  <div className="bg-slate-50 rounded-md p-2">
                    <p className="text-[10px] font-black uppercase text-slate-500">Média (50-74)</p>
                    <p className="text-sm font-black text-slate-900">{npsBandDistribution.magenta} <span className="text-slate-500">({npsBandPercentages.magenta}%)</span></p>
                  </div>
                  <div className="bg-slate-50 rounded-md p-2">
                    <p className="text-[10px] font-black uppercase text-slate-500">Baixa (&lt;50)</p>
                    <p className="text-sm font-black text-slate-900">{npsBandDistribution.orange} <span className="text-slate-500">({npsBandPercentages.orange}%)</span></p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Top 5 Melhores Turmas</p>
                    <p className="text-[10px] text-slate-400 mb-2">Mostrando {top5NPS.length} de {npsClassRankings.length} turmas com NPS válido.</p>
                    <div className="flex flex-col gap-2">
                      {top5NPS.map((entry) => (
                        <div key={`${entry.classKey}-top`} className="bg-slate-50 rounded-lg px-2.5 py-2 flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-slate-700 block leading-snug" title={entry.trainingName} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{entry.trainingName}</span>
                            <span className="text-[10px] text-slate-400 block truncate mt-0.5">{entry.turma} · {entry.unit}{entry.fornecedor ? ` · ${entry.fornecedor}` : ''}</span>
                          </div>
                          <span className="shrink-0 min-w-[52px] h-7 px-2 rounded-full text-[11px] font-black text-white inline-flex items-center justify-center" style={{ backgroundColor: '#15803d' }}>
                            {entry.score.toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Top 5 Piores Turmas</p>
                    <p className="text-[10px] text-slate-400 mb-2">Mostrando {bottom5NPS.length} de {npsBandDistribution.orange} turmas com NPS abaixo de 50.</p>
                    <div className="flex flex-col gap-2">
                      {bottom5NPS.map((entry) => (
                        <div key={`${entry.classKey}-bottom`} className="bg-slate-50 rounded-lg px-2.5 py-2 flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-slate-700 block leading-snug" title={entry.trainingName} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{entry.trainingName}</span>
                            <span className="text-[10px] text-slate-400 block truncate mt-0.5">{entry.turma} · {entry.unit}{entry.fornecedor ? ` · ${entry.fornecedor}` : ''}</span>
                          </div>
                          <span className="shrink-0 min-w-[52px] h-7 px-2 rounded-full text-[11px] font-black text-white inline-flex items-center justify-center" style={{ backgroundColor: '#e65100' }}>
                            {entry.score.toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* EFICIÊNCIA FINANCEIRA */}
              <div className="bg-white rounded-2xl p-[18px] border border-slate-100">
                <div className="mb-3">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Eficiência Financeira</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Apenas Treinamentos Externos</p>
                </div>
                <div className="grid grid-cols-2 gap-[12px] mb-4">
                  <div className="bg-slate-50 rounded-xl py-3 px-3.5">
                    <p className="text-[10px] font-black uppercase text-slate-500">Investimento Realizado</p>
                    <p className="text-[17px] font-black mt-1" style={{ color: '#d61c59' }}>R$ {totalInvestimentoRealizado.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl py-3 px-3.5">
                    <p className="text-[10px] font-black uppercase text-slate-500">Investimento Planejado</p>
                    <p className="text-[17px] font-black mt-1" style={{ color: '#f57c00' }}>R$ {totalInvestimentoPlanejado.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl py-3 px-3.5">
                    <p className="text-[10px] font-black uppercase text-slate-500">Custo Médio / Pessoa</p>
                    <p className="text-[17px] font-black mt-1" style={{ color: '#d61c59' }}>R$ {custoMedioExterno.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl py-3 px-3.5">
                    <p className="text-[10px] font-black uppercase text-slate-500">Budget Consumido</p>
                    <p className="text-[22px] font-black mt-1" style={{ color: '#d61c59' }}>{budgetExternoPercent}%</p>
                  </div>
                </div>

                {/* Budget bar segmentada */}
                <div className="bg-slate-50 rounded-xl p-3.5 mb-4">
                  <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Consumo do Budget</p>
                  {budgetEstourado && (
                    <div className="flex items-center gap-1.5 mb-2 text-[10px] font-black uppercase text-orange-600 bg-orange-50 rounded-lg px-2 py-1.5">
                      <AlertTriangle size={12} /> Previsão total ultrapassa o budget definido
                    </div>
                  )}
                  <div className="relative w-full h-4 bg-slate-200 rounded-full overflow-hidden flex">
                    <div style={{ width: `${Math.min(100, (totalInvestimentoRealizado / Math.max(totalPrevisto, BUDGET_TOTAL)) * 100)}%`, backgroundColor: '#d61c59', transition: 'width 0.4s' }} className="h-full rounded-l-full"></div>
                    <div style={{ width: `${Math.min(100 - Math.min(100, (totalInvestimentoRealizado / Math.max(totalPrevisto, BUDGET_TOTAL)) * 100), (totalInvestimentoPlanejado / Math.max(totalPrevisto, BUDGET_TOTAL)) * 100)}%`, backgroundColor: '#f57c00', transition: 'width 0.4s' }} className="h-full"></div>
                    {/* Marcador PO Global */}
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-slate-900"
                      style={{ left: `${Math.min(98, (BUDGET_TOTAL / Math.max(totalPrevisto, BUDGET_TOTAL)) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[9px] font-black uppercase text-slate-400">Realizado · Planejado | Marcador = PO Global</p>
                    <p className="text-[9px] font-black uppercase text-slate-400">R$ {BUDGET_TOTAL.toLocaleString('pt-BR')}</p>
                  </div>
                </div>

                {/* TOP 5 Maiores Negociações */}
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Top 5 Maiores Investimentos e Negociações</p>
                  <div className="space-y-1.5">
                    {top5Financial.map((t) => (
                      <div
                        key={`${t.id}-fin`}
                        className={`rounded-xl px-3 py-2 flex items-start justify-between gap-2 ${
                          t.deltaType === 'saving' ? 'bg-green-50' : t.deltaType === 'cost_increase' ? 'bg-red-50' : 'bg-slate-50'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-bold text-slate-700 block truncate" title={t.name}>{t.name}</span>
                          <span className="text-[10px] text-slate-400 block truncate">{t.unit}{(t.supplier || t.fornecedor) ? ` · ${t.supplier || t.fornecedor}` : ''}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-black uppercase text-slate-500">PO: R$ {parseFloatValue(t.po).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                            <span className="text-[9px] text-slate-400">·</span>
                            <span className="text-[9px] font-black uppercase text-slate-500">Real: R$ {parseFloatValue(t.cost).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right max-w-[110px]">
                          {t.deltaType && (
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-[9px] font-black uppercase whitespace-nowrap ${
                                t.deltaType === 'saving' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                              }`}
                            >
                              {t.deltaType === 'saving' ? 'Saving' : 'Cost Increase'}
                            </span>
                          )}
                          <p className="text-xs font-black mt-0.5" style={{ color: t.deltaType === 'saving' ? '#15803d' : t.deltaType === 'cost_increase' ? '#dc2626' : '#64748b' }}>
                            {t.deltaType === 'saving' ? '-' : t.deltaType === 'cost_increase' ? '+' : ''}R$ {t.deltaValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Rodapé consolidado */}
                  <div className="mt-3 bg-slate-900 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Total Saving Acumulado</p>
                      <p className="text-base font-black text-green-400">R$ {totalSavingAccum.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="w-px h-8 bg-slate-700"></div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Total Cost Increase</p>
                      <p className="text-base font-black text-red-400">R$ {totalCostIncreaseAccum.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. RESULTADOS OPERACIONAIS */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Resultados Operacionais</p>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Impacto direto nos indicadores de processo</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {['todos', 'melhoraram', 'pioraram', 'neutros'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setOperationalFilter(f)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide transition-colors ${
                        operationalFilter === f
                          ? 'bg-[#1e293b] text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {f === 'todos' ? 'Todos' : f === 'melhoraram' ? 'Melhoraram' : f === 'pioraram' ? 'Pioraram' : 'Neutros'}
                    </button>
                  ))}
                </div>
              </div>

              {filteredOperationalData.length === 0 && (
                <div className="bg-white rounded-xl p-6 border border-slate-100 text-center">
                  <p className="text-[11px] font-black uppercase text-slate-400">Nenhum treinamento corresponde ao filtro selecionado</p>
                </div>
              )}

              {filteredOperationalData.map((training) => {
                const indicators = training.indicators.filter((ind) => ind.nome && ind.nome.trim() !== '');
                const indMelhoraram = indicators.filter((i) => i.resultado === 'melhorou').length;
                const indPioraram = indicators.filter((i) => i.resultado === 'piorou').length;
                const indNeutros = indicators.filter((i) => i.resultado === 'inconclusivo').length;
                const fallbackPeriods = getFallbackPeriodLabels(training);
                const periodoAnt = normalizePeriodLabel(indicators[0]?.periodoAnt, fallbackPeriods.before, indicators[0]?.periodo, 'first');
                const periodoDep = normalizePeriodLabel(indicators[0]?.periodoDep, fallbackPeriods.after, indicators[0]?.periodo, 'last');
                const periodo = indicators[0]?.periodo || '';
                return (
                  <div key={training.id} className="bg-white rounded-2xl p-5 border border-slate-100 mb-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-black text-slate-800 leading-snug">{training.name}</p>
                        <p className="text-[10px] font-black uppercase text-slate-500 mt-1 tracking-wide">
                          Unidade: {training.unit} &nbsp;·&nbsp; Área: {training.area} &nbsp;·&nbsp; Tipo: {training.type}
                          {periodo && <> &nbsp;·&nbsp; Período: {periodo}</>}
                          {periodoAnt && <> &nbsp;·&nbsp; Antes: {periodoAnt}</>}
                          {periodoDep && <> &nbsp;·&nbsp; Após: {periodoDep}</>}
                        </p>
                        {training.fornecedor && (
                          <p className="text-[10px] font-semibold mt-0.5 tracking-wide" style={{ color: '#94a3b8' }}>
                            Fornecedor: {training.fornecedor}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
                        {indMelhoraram > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-[10px] font-black uppercase text-green-700">
                            <TrendingUp size={10} /> {indMelhoraram} Melhoraram
                          </span>
                        )}
                        {indPioraram > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-[10px] font-black uppercase text-red-700">
                            <TrendingDown size={10} /> {indPioraram} Pioraram
                          </span>
                        )}
                        {indNeutros > 0 && (
                          <span className="inline-flex px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black uppercase text-slate-500">
                            {indNeutros} Neutros
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {indicators.map((ind, idx) => {
                        const bgClass = ind.resultado === 'melhorou' ? 'bg-green-50' : ind.resultado === 'piorou' ? 'bg-red-50' : 'bg-slate-50';
                        const borderClass = ind.resultado === 'melhorou' ? 'border-green-200' : ind.resultado === 'piorou' ? 'border-red-200' : 'border-slate-200';
                        return (
                          <div key={idx} className={`relative group p-4 rounded-2xl border-2 ${bgClass} ${borderClass}`}>
                            <p className="text-xs font-bold text-slate-700 mb-2.5 leading-snug" title={ind.nome}>{ind.nome}</p>
                            <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500 mb-1.5">
                              <span>{normalizePeriodLabel(ind.periodoAnt, fallbackPeriods.before, ind.periodo, 'first')}</span>
                              <span>{normalizePeriodLabel(ind.periodoDep, fallbackPeriods.after, ind.periodo, 'last')}</span>
                            </div>
                            <div className="flex items-center justify-between mb-2.5">
                              <div className="text-left">
                                <p className="text-[11px] font-semibold text-slate-400 line-through">{ind.antes}</p>
                              </div>
                              <span className="text-slate-300 mx-2">→</span>
                              <div className="text-right">
                                <p className="text-xl font-black text-slate-900 leading-none">{ind.depois}</p>
                                {ind.unidade && (
                                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">{ind.unidade}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              {ind.resultado === 'melhorou' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-green-700"><TrendingUp size={12} /> Melhorou</span>
                              )}
                              {ind.resultado === 'piorou' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-600"><TrendingDown size={12} /> Piorou</span>
                              )}
                              {ind.resultado === 'inconclusivo' && (
                                <span className="text-[10px] font-black uppercase text-slate-500">— Inconclusivo</span>
                              )}
                            </div>
                            {ind.analise && (
                              <div className="absolute bottom-full left-0 mb-2 z-50 hidden group-hover:block w-max max-w-[340px] bg-[#1e293b] text-white rounded-xl px-3 py-2 shadow-xl pointer-events-none">
                                {ind.guardiao && (
                                  <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Guardião: {ind.guardiao}</p>
                                )}
                                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Análise do Guardião</p>
                                <p className="text-xs leading-snug">{ind.analise}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
      {renderTooltip()}
      </div>

      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; }
          .dashboard-header {
            background-color: #ffffff;
            border-radius: 0 0 14px 14px;
            padding: 16px 24px 14px;
            border-bottom: 3px solid #e91e63;
          }
          .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .dashboard-title {
            font-size: 28px;
            font-weight: 800;
            margin: 0;
            letter-spacing: -0.3px;
            line-height: 1;
          }
          .dashboard-subtitle {
            font-size: 11px;
            margin-top: 4px;
            opacity: 0.7;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            font-weight: 700;
          }
          .header-nav {
            display: flex;
            align-items: center;
            gap: 20px;
          }
          .header-nav-item {
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            opacity: 0.6;
            background: transparent;
            border: none;
            color: inherit;
            padding: 0 0 4px;
          }
          .header-nav-item.active {
            color: #e91e63;
            opacity: 1;
            border-bottom: 2px solid #e91e63;
          }
          @media print {
            .no-print { display: none !important; }
            header { position: static !important; border-bottom: 3px solid #e91e63 !important; }
            table { border: 1px solid #ddd !important; }
            thead tr { background-color: #1e293b !important; -webkit-print-color-adjust: exact; }
          }
        `}
      </style>
    </div>
  );
};

export default App;
