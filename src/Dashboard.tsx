import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ============================================
// TYPES
// ============================================
interface AlertHistogramPoint {
  timestamp: string;
  count: number;
}

interface SpikePoint {
  timestamp: string;
  latency: number;
}

interface Asset {
  id: string;
  name: string;
  type: "server" | "database" | "firewall" | "lb" | "cache" | "service" | "core";
  status: "healthy" | "warning" | "critical";
  risk: number;
  x?: number;
  y?: number;
  connections?: string[];
  metadata?: Record<string, unknown>;
}

interface RiskIndex {
  label: string;
  value: number;
  max: number;
  trend: "up" | "down" | "stable";
  trendValue: number;
}

interface SeverityCard {
  severity: "Critical" | "High" | "Medium" | "Low";
  count: number;
  attackedAssets: number;
  trend: number;
}

interface MatrixRow {
  action: string;
  events: number[];
  alerts: Array<{ col: number; type: "alert" | "danger" | "protected"; message?: string }>;
}

interface TerrainPoint {
  x: number;
  y: number;
  height: number;
  risk: number;
}

interface ApiResponse<T> {
  data: T;
  timestamp: string;
  cached: boolean;
}

// ============================================
// API CLIENT & HOOKS
// ============================================
const API_BASE = import.meta.env.VITE_API_BASE || "/api/v1";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API error: ${res.statusText}`);
  }
  return res.json();
}

// Generic SWR-style hook
function useApi<T>(endpoint: string | null, refreshMs = 30000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const fetchData = useCallback(async () => {
    if (!endpoint) return;
    try {
      setLoading(true);
      const result = await fetchJson<T>(endpoint);
      setData(result.data);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
      setStale(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      setStale(true);
      fetchData();
    }, refreshMs);
    return () => clearInterval(interval);
  }, [fetchData, refreshMs]);

  const mutate = useCallback(async (newData?: T) => {
    if (newData) setData(newData);
    else await fetchData();
  }, [fetchData]);

  return { data, error, loading, stale, mutate, refetch: fetchData };
}

// Specific hooks
function useAlertsHistogram(hours = 24) {
  return useApi<AlertHistogramPoint[]>(`/metrics/alerts/histogram?hours=${hours}`, 60000);
}

function useSpikeChart(hours = 6) {
  return useApi<SpikePoint[]>(`/metrics/latency/spikes?hours=${hours}`, 30000);
}

function useAssets(filters?: { status?: string; type?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.type) params.set("type", filters.type);
  return useApi<Asset[]>(`/assets?${params.toString()}`, 45000);
}

function useRiskIndices() {
  return useApi<RiskIndex[]>(`/risk/indices`, 60000);
}

function useSeverityCards() {
  return useApi<SeverityCard[]>(`/attacks/severity`, 60000);
}

function useMatrixData() {
  return useApi<MatrixRow[]>(`/matrix/360-view`, 60000);
}

function useTerrainMap(bounds: { width: number; height: number }) {
  return useApi<TerrainPoint[]>(`/terrain/map?width=${bounds.width}&height=${bounds.height}`, 120000);
}

// ============================================
// MOCK DATA FALLBACKS (for demo without API)
// ============================================
const FALLBACK_ALERTS_HISTOGRAM: AlertHistogramPoint[] = Array.from({ length: 24 }, (_, i) => ({
  timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
  count: Math.floor(Math.random() * 400) + 150,
}));

const FALLBACK_SPIKES: SpikePoint[] = Array.from({ length: 60 }, (_, i) => ({
  timestamp: new Date(Date.now() - (59 - i) * 60000).toISOString(),
  latency: Math.floor(Math.random() * 80) + 20,
}));

const FALLBACK_ASSETS: Asset[] = [
  { id: "AST-001", name: "Core Switch", type: "core", status: "healthy", risk: 12, x: 200, y: 100, connections: ["FW-01", "FW-02", "LB-01", "LB-02"] },
  { id: "FW-01", name: "Firewall Primary", type: "firewall", status: "critical", risk: 94, x: 80, y: 60, connections: ["CORE", "LB-01"] },
  { id: "FW-02", name: "Firewall Secondary", type: "firewall", status: "healthy", risk: 18, x: 320, y: 60, connections: ["CORE", "LB-02"] },
  { id: "LB-01", name: "Load Balancer Web", type: "lb", status: "warning", risk: 67, x: 50, y: 180, connections: ["CORE", "WEB-01", "WEB-02", "WEB-03"] },
  { id: "LB-02", name: "Load Balancer API", type: "lb", status: "healthy", risk: 23, x: 350, y: 180, connections: ["CORE", "API-01", "API-02"] },
  { id: "WEB-01", name: "Web Server 01", type: "server", status: "healthy", risk: 31, x: 20, y: 280, connections: ["LB-01", "AUTH-01"] },
  { id: "WEB-02", name: "Web Server 02", type: "server", status: "critical", risk: 91, x: 80, y: 280, connections: ["LB-01", "AUTH-01"] },
  { id: "WEB-03", name: "Web Server 03", type: "server", status: "healthy", risk: 28, x: 140, y: 280, connections: ["LB-01", "AUTH-01"] },
  { id: "API-01", name: "API Gateway 01", type: "server", status: "warning", risk: 72, x: 260, y: 280, connections: ["LB-02", "DB-01", "CACHE-01"] },
  { id: "API-02", name: "API Gateway 02", type: "server", status: "healthy", risk: 19, x: 320, y: 280, connections: ["LB-02", "DB-02", "CACHE-01"] },
  { id: "DB-01", name: "Database Primary", type: "database", status: "critical", risk: 88, x: 150, y: 380, connections: ["API-01", "AUTH-01"] },
  { id: "DB-02", name: "Database Replica", type: "database", status: "healthy", risk: 22, x: 250, y: 380, connections: ["API-02"] },
  { id: "CACHE-01", name: "Redis Cluster", type: "cache", status: "healthy", risk: 15, x: 370, y: 380, connections: ["API-01", "API-02"] },
  { id: "AUTH-01", name: "Auth Service", type: "service", status: "critical", risk: 95, x: 30, y: 380, connections: ["WEB-01", "WEB-02", "WEB-03", "DB-01"] },
];

const FALLBACK_RISK_INDICES: RiskIndex[] = [
  { label: "Malicious Process", value: 1247, max: 10000, trend: "up", trendValue: 12.3 },
  { label: "Attacked Assets", value: 3421, max: 15000, trend: "down", trendValue: -4.1 },
];

const FALLBACK_SEVERITY: SeverityCard[] = [
  { severity: "Critical", count: 247, attackedAssets: 992000, trend: 15.2 },
  { severity: "High", count: 1834, attackedAssets: 992000, trend: 8.7 },
  { severity: "Medium", count: 5219, attackedAssets: 992000, trend: -2.1 },
  { severity: "Low", count: 12043, attackedAssets: 992000, trend: -12.4 },
];

const FALLBACK_MATRIX: MatrixRow[] = [
  { action: "Attack", events: [1, 0, 1, 1, 0, 1, 0, 0, 1, 0], alerts: [{ col: 2, type: "alert" }, { col: 5, type: "danger", message: "Unsafe connection to the UPS" }] },
  { action: "Delete", events: [0, 1, 0, 0, 1, 0, 1, 0, 0, 1], alerts: [{ col: 4, type: "alert" }] },
  { action: "Failure", events: [1, 1, 0, 1, 0, 0, 1, 1, 0, 0], alerts: [{ col: 6, type: "protected" }] },
  { action: "Lockout", events: [0, 0, 1, 0, 1, 1, 0, 0, 1, 1], alerts: [{ col: 7, type: "danger", message: "Brute force detected" }] },
];

// ============================================
// TERRAIN GENERATION (Simplex-like noise)
// ============================================
function generateTerrain(width: number, height: number, seed = 42): TerrainPoint[] {
  const points: TerrainPoint[] = [];
  const scale = 0.015;
  const octaves = 4;
  const persistence = 0.5;

  let randSeed = seed;
  const rand = () => {
    randSeed = (randSeed * 16807) % 2147483647;
    return (randSeed - 1) / 2147483646;
  };

  const noise2D = (x: number, y: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const grad = (ix: number, iy: number) => {
      const h = (ix * 374761393 + iy * 668265263 + seed * 1103515245) & 0x7fffffff;
      const angle = (h % 360) * (Math.PI / 180);
      return [Math.cos(angle), Math.sin(angle)];
    };

    const g00 = grad(X, Y);
    const g10 = grad(X + 1, Y);
    const g01 = grad(X, Y + 1);
    const g11 = grad(X + 1, Y + 1);

    const n00 = g00[0] * xf + g00[1] * yf;
    const n10 = g10[0] * (xf - 1) + g10[1] * yf;
    const n01 = g01[0] * xf + g01[1] * (yf - 1);
    const n11 = g11[0] * (xf - 1) + g11[1] * (yf - 1);

    const nx0 = n00 + u * (n10 - n00);
    const nx1 = n01 + u * (n11 - n01);
    return nx0 + v * (nx1 - nx0);
  };

  const fbm = (x: number, y: number) => {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return value / maxValue;
  };

  const step = 4;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const h = fbm(x, y);
      const ridge = 1 - Math.abs(h * 2 - 1);
      const heightNorm = Math.pow(Math.max(0, h), 1.5);
      const risk = Math.min(1, heightNorm * 1.2 + ridge * 0.3 + rand() * 0.1);
      
      points.push({ x, y, height: heightNorm, risk });
    }
  }
  return points;
}

// ============================================
// REUSABLE UI PRIMITIVES
// ============================================
const GlassCard = ({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
  <div
    className={`
      relative rounded-2xl bg-slate-900/60 backdrop-blur-xl
      border border-slate-700/50 shadow-[0_0_40px_rgba(6,182,212,0.08)]
      ${className}
    `}
    {...props}
  >
    {children}
  </div>
);

const PillDropdown = ({ label, value, options, onChange, className = "" }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; className?: string
}) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`
        appearance-none px-3 py-1.5 text-sm text-white bg-slate-800/80
        border border-slate-700 rounded-full
        focus:outline-none focus:ring-1 focus:ring-teal-400
        cursor-pointer
      `}
    >
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-slate-900 text-white">
          {opt}
        </option>
      ))}
    </select>
  </div>
);

const IconButton = ({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
  <button
    className={`
      p-2 rounded-full text-slate-300 hover:text-white
      hover:bg-slate-800/50 transition-colors
      ${className}
    `}
    {...props}
  >
    {children}
  </button>
);

const TabPill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`
      px-4 py-1.5 text-sm rounded-full transition-all
      ${active
        ? "bg-white text-slate-900 font-medium shadow-lg"
        : "text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600"
      }
    `}
  >
    {label}
  </button>
);

const StatusBadge = ({ status }: { status: "healthy" | "warning" | "critical" }) => (
  <span className={`
    px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider
    ${status === "critical" ? "bg-red-500/20 text-red-400" :
      status === "warning" ? "bg-orange-500/20 text-orange-400" :
      "bg-green-500/20 text-green-400"}
  `}>
    {status}
  </span>
);

// ============================================
// CHART COMPONENTS
// ============================================
const HistogramChart = ({ data, maxValue = 600 }: { data: number[]; maxValue?: number }) => (
  <div className="h-40 flex items-end justify-around gap-1 px-2">
    {data.map((val, i) => (
      <div key={i} className="flex-1 max-w-6" style={{ height: `${Math.max((val / maxValue) * 100, 4)}%` }}>
        <div className="w-full rounded-t transition-all duration-300 hover:opacity-80"
          style={{ background: `linear-gradient(180deg, #06b6d4 0%, #0891b2 100%)` }} />
      </div>
    ))}
  </div>
);

const SpikeChart = ({ data, maxValue = 100 }: { data: number[]; maxValue?: number }) => {
  const pathData = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 400;
    const y = 128 - (val / maxValue) * 110;
    return `${i === 0 ? "M" : "L"}${x} ${y}`;
  }).join(" ") + " L400 128 L0 128 Z";

  const pointsData = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 400;
    const y = 128 - (val / maxValue) * 110;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg className="w-full h-32" viewBox="0 0 400 128" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spikeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path
        d={pathData}
        fill="url(#spikeGrad)" stroke="#06b6d4" strokeWidth="1.5" fillOpacity="0.3"
      />
      <polyline
        points={pointsData}
        fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"
      />
    </svg>
  );
};

const RiskGauge = ({ label, value, max, colorFrom = "#22c55e", colorTo = "#f97316", trend, trendValue }: RiskIndex & { colorFrom?: string; colorTo?: string }) => {
  const percentage = Math.min(value / max, 1);
  const angle = -90 + percentage * 180;
  const radius = 56;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
          <circle
            cx="64" cy="64" r={radius} fill="none" stroke="url(#gaugeGrad)" strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percentage)}
            strokeLinecap="round" className="transition-all duration-1000"
          />
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={colorFrom} />
              <stop offset="100%" stopColor={colorTo} />
            </linearGradient>
          </defs>
          <g transform={`rotate(${angle} 64 64)`}>
            <path d="M64 64 L64 12 L66 12 L66 64 Z" fill={colorTo} filter="drop-shadow(0 0 4px rgba(249,115,22,0.6))" />
            <circle cx="64" cy="64" r="6" fill="#0f172a" stroke={colorTo} strokeWidth="2" />
          </g>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-2xl font-bold text-white">{value.toLocaleString()}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">/ {max.toLocaleString()}</span>
        </div>
      </div>
      <span className="text-xs text-slate-400 text-center px-2">{label}</span>
      {trend && (
        <span className={`text-[10px] font-medium ${trend === "up" ? "text-red-400" : trend === "down" ? "text-green-400" : "text-slate-400"}`}>
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {Math.abs(trendValue)}%
        </span>
      )}
    </div>
  );
};

// ============================================
// TERRAIN MAP + INFRASTRUCTURE GRAPH (FUSED)
// ============================================
const TerrainInfraGraph = ({ assets, onAssetSelect, selectedAssetId }: {
  assets: Asset[];
  onAssetSelect: (asset: Asset) => void;
  selectedAssetId?: string;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [terrainPoints, setTerrainPoints] = useState<TerrainPoint[]>([]);
  const [bounds, setBounds] = useState({ width: 400, height: 500 });
  const [hoveredAsset, setHoveredAsset] = useState<Asset | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    setBounds({ width, height });
    const pts = generateTerrain(width, height);
    setTerrainPoints(pts);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const imageData = ctx.createImageData(rect.width, rect.height);
    const data = imageData.data;

    for (const pt of terrainPoints) {
      const px = Math.floor(pt.x);
      const py = Math.floor(pt.y);
      if (px >= 0 && px < rect.width && py >= 0 && py < rect.height) {
        const idx = (py * rect.width + px) * 4;
        const t = pt.height;
        const r = Math.floor(6 + t * 180);
        const g = Math.floor(182 - t * 100);
        const b = Math.floor(212 - t * 150);
        const alpha = Math.floor(40 + pt.risk * 180);
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = alpha;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    ctx.strokeStyle = "rgba(6,182,212,0.06)";
    ctx.lineWidth = 0.5;
    const gridSize = 40;
    for (let x = 0; x < rect.width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, rect.height); ctx.stroke();
    }
    for (let y = 0; y < rect.height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(rect.width, y); ctx.stroke();
    }
  }, [terrainPoints, bounds]);

  const nodes = useMemo(() => assets.map(a => ({
    ...a,
    x: a.x ?? Math.random() * bounds.width,
    y: a.y ?? Math.random() * bounds.height,
  })), [assets, bounds]);

  const edges = useMemo(() => {
    const edgeSet = new Set<string>();
    nodes.forEach(n => {
      n.connections?.forEach(cId => {
        const key = [n.id, cId].sort().join("-");
        edgeSet.add(key);
      });
    });
    return Array.from(edgeSet).map(k => k.split("-") as [string, string]);
  }, [nodes]);

  const statusColors = {
    healthy: "#22c55e",
    warning: "#f97316",
    critical: "#ef4444",
  };

  const statusGlow = {
    healthy: "0 0 16px #22c55e, 0 0 32px #22c55e44",
    warning: "0 0 16px #f97316, 0 0 32px #f9731644",
    critical: "0 0 16px #ef4444, 0 0 32px #ef444444",
  };

  const nodeIcons = {
    core: "◆", firewall: "🛡", lb: "⚖", server: "◈", database: "⟳", cache: "⚡", service: "⚙",
  };

  return (
    <div className="relative w-full h-[520px] bg-slate-950/50 rounded-xl overflow-hidden" ref={containerRef}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${bounds.width} ${bounds.height}`}>
        {edges.map(([fromId, toId], i) => {
          const from = nodes.find(n => n.id === fromId);
          const to = nodes.find(n => n.id === toId);
          if (!from || !to) return null;
          return (
            <line
              key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="6,4"
              filter="drop-shadow(0 0 2px #06b6d444)"
            />
          );
        })}
      </svg>

      {nodes.map((node) => (
        <div
          key={node.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 cursor-pointer"
          style={{
            left: node.x, top: node.y, zIndex: 10,
            filter: `drop-shadow(${statusGlow[node.status]})`,
          }}
          onClick={() => onAssetSelect(node)}
          onMouseEnter={() => setHoveredAsset(node)}
          onMouseLeave={() => setHoveredAsset(null)}
        >
          <div
            className={`
              w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm border-2
              ${selectedAssetId === node.id ? "ring-2 ring-teal-400 ring-offset-2 ring-offset-slate-950 scale-110" : ""}
            `}
            style={{
              background: `linear-gradient(135deg, ${statusColors[node.status]} 0%, ${statusColors[node.status]}dd 100%)`,
              borderColor: statusColors[node.status],
              boxShadow: `0 0 24px ${statusColors[node.status]}88, inset 0 0 0 1px rgba(255,255,255,0.1)`,
            }}
          >
            {nodeIcons[node.type]}
          </div>
          
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-slate-900/95 backdrop-blur px-3 py-2 rounded-lg border border-slate-700 shadow-xl min-w-[180px]">
              <p className="text-sm font-semibold text-white">{node.name}</p>
              <p className="text-[11px] text-slate-400 capitalize">{node.type} • Risk: {node.risk}%</p>
              <StatusBadge status={node.status} />
            </div>
          </div>

          {node.status === "critical" && (
            <div className="absolute -inset-1 rounded-full border-2 animate-ping opacity-75 pointer-events-none"
              style={{ borderColor: statusColors.critical, animationDuration: "2s" }} />
          )}
        </div>
      ))}

      {hoveredAsset && hoveredAsset.id !== selectedAssetId && (
        <div className="absolute right-4 top-4 z-20 w-72">
          <GlassCard className="p-3 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ background: `linear-gradient(135deg, ${statusColors[hoveredAsset.status]} 0%, transparent 100%)` }}
              >
                {nodeIcons[hoveredAsset.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{hoveredAsset.name}</p>
                <p className="text-[11px] text-slate-400">{hoveredAsset.type} • {hoveredAsset.risk}% risk</p>
                <StatusBadge status={hoveredAsset.status} />
              </div>
            </div>
            {hoveredAsset.metadata && (
              <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-2 gap-2 text-[11px]">
                {Object.entries(hoveredAsset.metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-white font-mono">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => onAssetSelect(hoveredAsset)}
              className="mt-3 w-full text-center text-teal-400 hover:text-teal-300 text-sm font-medium"
            >
              View Details →
            </button>
          </GlassCard>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <IconButton className="w-10 h-10 bg-slate-800/80 border border-slate-700" title="Zoom Out">−</IconButton>
        <div className="w-16 h-16 rounded-full bg-slate-800/80 border-2 border-teal-400/50 flex items-center justify-center">
          <svg className="w-7 h-7 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101m-.758 4.899l1.102-1.101m-.758-4.899l-1.102-1.101" />
          </svg>
        </div>
        <IconButton className="w-10 h-10 bg-slate-800/80 border border-slate-700" title="Zoom In">+</IconButton>
        <span className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-[10px] text-red-400 uppercase tracking-wider">
          Alerts × {assets.filter(a => a.status === "critical").length}
        </span>
      </div>
    </div>
  );
};

// ============================================
// ASSET DETAIL DROPDOWN (Right panel)
// ============================================
const AssetDetailDropdown = ({ assets, selectedId, onSelect }: {
  assets: Asset[]; selectedId?: string; onSelect: (asset: Asset) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selected = assets.find(a => a.id === selectedId) || assets[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`
          flex items-center gap-3 px-3 py-2 pr-8 bg-slate-800/80 backdrop-blur
          border border-slate-700 rounded-xl min-w-[280px] text-left
          hover:border-teal-400/50 transition-colors
        `}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
          style={{ background: `linear-gradient(135deg, ${selected.status === "critical" ? "#ef4444" : selected.status === "warning" ? "#f97316" : "#22c55e"} 0%, transparent 100%)` }}
        >
          {selected.type === "server" ? "◈" : selected.type === "database" ? "⟳" : selected.type === "firewall" ? "🛡" : selected.type === "lb" ? "⚖" : selected.type === "core" ? "◆" : "⚙"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{selected.name}</p>
          <p className="text-[11px] text-slate-400 capitalize">{selected.status} risk • {selected.risk}%</p>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-20 w-full min-w-[320px]">
          <GlassCard className="p-2">
            <div className="flex items-center justify-between px-2 py-2 border-b border-slate-700/50">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Asset Details</span>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => { onSelect(asset); setOpen(false); }}
                  className={`
                    w-full px-3 py-2.5 rounded-lg text-left transition-all
                    ${selectedId === asset.id ? "bg-teal-500/10 border border-teal-500/30" : "hover:bg-slate-800/50"}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                      style={{ background: `linear-gradient(135deg, ${asset.status === "critical" ? "#ef4444" : asset.status === "warning" ? "#f97316" : "#22c55e"} 0%, transparent 100%)` }}
                    >
                      {asset.type === "server" ? "◈" : asset.type === "database" ? "⟳" : asset.type === "firewall" ? "🛡" : asset.type === "lb" ? "⚖" : asset.type === "core" ? "◆" : "⚙"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{asset.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge status={asset.status} />
                        <span className="text-[10px] text-slate-500">Risk: {asset.risk}%</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

// ============================================
// MATRIX PANEL (Bottom Left)
// ============================================
const MatrixPanel = ({ data }: { data: MatrixRow[] }) => (
  <GlassCard className="p-4 h-full flex flex-col">
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-medium text-white flex items-center gap-2">
        360 View by Blocks
        <IconButton className="ml-auto p-1" title="Expand">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
        </IconButton>
      </h3>
    </div>
    
    <div className="flex-1 overflow-hidden relative">
      <div className="absolute left-0 top-0 bottom-0 w-24 flex flex-col justify-around px-2 text-right pr-3">
        {data.map((row, i) => (
          <div key={row.action} className="flex items-center h-1/4">
            <span className="text-[11px] text-slate-400 whitespace-nowrap">{row.action}</span>
          </div>
        ))}
      </div>
      
      <div className="ml-24 flex-1 flex items-center justify-center">
        <div className="relative grid grid-cols-10 gap-1.5 p-2">
          {data.flatMap((row, rowIdx) =>
            row.events.map((cell, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={`
                  w-6 h-6 rounded transition-all
                  ${cell === 1 
                    ? (row.alerts.some(a => a.col === colIdx && a.type === "danger") ? "bg-red-500/30 border border-red-500/50 relative" :
                       row.alerts.some(a => a.col === colIdx && a.type === "alert") ? "bg-orange-500/30 border border-orange-500/50 relative" :
                       row.alerts.some(a => a.col === colIdx && a.type === "protected") ? "bg-green-500/30 border border-green-500/50 relative" :
                       "bg-slate-700/50")
                    : "bg-transparent"
                  }
                `}
              >
                {row.alerts.filter(a => a.col === colIdx).map((alert, ai) => (
                  <div key={ai} className="absolute -top-8 left-1/2 -translate-x-1/2 w-max px-2 py-1 text-white text-[10px] rounded whitespace-nowrap shadow-lg"
                    style={{ background: alert.type === "danger" ? "rgba(239,68,68,0.95)" : alert.type === "alert" ? "rgba(249,115,22,0.95)" : "rgba(34,197,94,0.95)" }}
                  >
                    {alert.message || (alert.type === "danger" ? "Critical Alert" : alert.type === "alert" ? "Alert" : "Protected")}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-transparent"
                      style={{ borderTopColor: alert.type === "danger" ? "rgba(239,68,68,0.95)" : alert.type === "alert" ? "rgba(249,115,22,0.95)" : "rgba(34,197,94,0.95)" }} />
                  </div>
                ))}
              </div>
            ))
          )}
          
          <div className="col-span-4 row-span-2 absolute border-2 border-teal-400/50 border-dashed rounded-lg pointer-events-none" style={{ gridColumn: '3 / 7', gridRow: '2 / 4' }} />
          
          <div className="col-span-2 row-span-2 absolute z-10" style={{ gridColumn: '5 / 7', gridRow: '3 / 5' }}>
            <div className="w-10 h-10 rounded-full bg-teal-500/20 border-2 border-teal-400 flex items-center justify-center relative group">
              <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101m-.758 4.899l1.102-1.101m-.758-4.899l-1.102-1.101" /></svg>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 p-1 bg-slate-900/95 backdrop-blur rounded border border-slate-700">
                <IconButton className="p-1" title="Details"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></IconButton>
                <IconButton className="p-1" title="Trace"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19l9 2m0 0l-9 2m9-2l-3.5-6.5M9 10l9-2" /></svg></IconButton>
                <IconButton className="p-1" title="Isolate"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></IconButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </GlassCard>
);

// ============================================
// SECTION COMPONENTS
// ============================================
const TopBar = () => (
  <GlassCard className="px-4 py-2.5">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
          <span className="text-white font-bold text-xs">></span>
        </div>
        <span className="font-mono text-white font-medium">splunk</span>
      </div>
      <div className="flex items-center gap-3">
        <PillDropdown label="Belongs to" value="War Room" options={["War Room", "SOC", "NOC", "DevOps"]} onChange={() => {}} />
        <PillDropdown label="Location" value="Asia" options={["Asia", "Europe", "US-East", "US-West", "Global"]} onChange={() => {}} />
        <PillDropdown label="Active days" value="360 day" options={["360 day", "90 day", "30 day", "7 day", "24 hour"]} onChange={() => {}} />
        <PillDropdown label="Links" value="Maps" options={["Maps", "Topology", "Dependencies", "Inventory"]} onChange={() => {}} />
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Search by Name etc." className="w-64 pl-10 pr-4 py-1.5 text-sm text-white bg-slate-800/80 border border-slate-700 rounded-full placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400" />
        </div>
        <IconButton title="Settings"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></IconButton>
      </div>
    </div>
  </GlassCard>
);

const LeftColumn = ({ histogramData, spikeData }: { histogramData: number[]; spikeData: number[] }) => (
  <div className="flex flex-col gap-4 h-full min-h-0">
    <div className="flex items-start gap-3">
      <IconButton className="w-8 h-8 bg-slate-800/50 border border-slate-700" title="Back">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      </IconButton>
      <div>
        <h2 className="text-xl font-semibold text-white">System Performance</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">Data based on 2110 indexes</p>
      </div>
    </div>
    <GlassCard className="p-4 flex-1 flex flex-col">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Alerts Intensity in Blocks</h3>
      <HistogramChart data={histogramData} className="flex-1" />
      <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-2">
        <span>{Math.min(...histogramData)}</span>
        <span>{Math.max(...histogramData)}</span>
      </div>
    </GlassCard>
    <GlassCard className="p-4 flex-1 flex flex-col">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Response Time Spikes</h3>
      <SpikeChart data={spikeData} className="flex-1" />
      <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-2">
        <span>{Math.min(...spikeData)}</span>
        <span>{Math.max(...spikeData)}</span>
      </div>
    </GlassCard>
    <div className="flex items-center justify-between">
      <div className="flex gap-2">
        <PillDropdown label="" value="Monthly Trend" options={["Monthly Trend", "Weekly Trend", "Daily Trend"]} onChange={() => {}} />
        <PillDropdown label="" value="Last 12 Hour" options={["Last 12 Hour", "Last 24 Hour", "Last 7 Days"]} onChange={() => {}} />
      </div>
      <div className="flex gap-1">
        <IconButton title="Refresh"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></IconButton>
        <IconButton title="More"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg></IconButton>
        <IconButton title="Export"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></IconButton>
      </div>
    </div>
  </div>
);

const CenterColumn = ({ assets, selectedAssetId, onAssetSelect }: { assets: Asset[]; selectedAssetId?: string; onAssetSelect: (a: Asset) => void }) => (
  <GlassCard className="p-4 flex flex-col h-full min-h-0">
    <TerrainInfraGraph assets={assets} onAssetSelect={onAssetSelect} selectedAssetId={selectedAssetId} />
  </GlassCard>
);

const RightColumn = ({ riskIndices, onTabChange }: { riskIndices: RiskIndex[]; onTabChange: (tab: string) => void }) => (
  <div className="flex flex-col gap-4 h-full min-h-0">
    <div className="flex gap-1">
      {["View", "Policy Manager", "Marketplace"].map((tab, i) => (
        <TabPill key={tab} label={tab} active={i === 0} onClick={() => onTabChange(tab)} />
      ))}
    </div>
    <div className="grid grid-cols-2 gap-4 flex-1">
      {riskIndices.map((ri, i) => (
        <RiskGauge
          key={ri.label}
          label={ri.label}
          value={ri.value}
          max={ri.max}
          colorFrom={i === 0 ? "#22c55e" : "#22c55e"}
          colorTo={i === 0 ? "#ef4444" : "#f97316"}
          trend={ri.trend}
          trendValue={ri.trendValue}
        />
      ))}
    </div>
  </div>
);

const BottomRightPanel = ({ severityCards }: { severityCards: SeverityCard[] }) => (
  <GlassCard className="p-4">
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-medium text-white">Total Attacks by Alerts</h3>
      <div className="flex gap-1">
        <IconButton className="p-1.5" title="Calendar"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></IconButton>
        <IconButton className="p-1.5" title="Export"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></IconButton>
      </div>
    </div>
    <div className="grid grid-cols-4 gap-3">
      {severityCards.map((card) => {
        const colors = {
          Critical: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: "🔴" },
          High: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: "🟠" },
          Medium: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", icon: "🟡" },
          Low: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", icon: "🟢" },
        };
        const c = colors[card.severity];
        return (
          <div key={card.severity} className={`rounded-xl p-4 ${c.bg} ${c.border} border transition-all hover:border-opacity-50`}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{c.icon}</span>
              <span className={c.color}>{card.severity}</span>
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Attacked Assets / {card.attackedAssets.toLocaleString()}</p>
            <p className="text-3xl font-bold text-white">{card.count.toLocaleString()}</p>
            <span className={`text-[10px] font-medium ${card.trend >= 0 ? "text-red-400" : "text-green-400"}`}>
              {card.trend >= 0 ? "↑" : "↓"} {Math.abs(card.trend)}% vs last period
            </span>
          </div>
        );
      })}
    </div>
  </GlassCard>
);

// ============================================
// MAIN DASHBOARD WITH DATA FETCHING
// ============================================
export default function PerformanceDashboard() {
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();

  const { data: alertsHist, loading: histLoading } = useAlertsHistogram(24);
  const { data: spikes, loading: spikesLoading } = useSpikeChart(6);
  const { data: assets, loading: assetsLoading, refetch: refetchAssets } = useAssets();
  const { data: riskIndices, loading: riskLoading } = useRiskIndices();
  const { data: severityCards, loading: severityLoading } = useSeverityCards();
  const { data: matrixData, loading: matrixLoading } = useMatrixData();

  const histogramValues = useMemo(() => 
    alertsHist?.map(d => d.count) || FALLBACK_ALERTS_HISTOGRAM.map(d => d.count), [alertsHist]);
  const spikeValues = useMemo(() => 
    spikes?.map(d => d.latency) || FALLBACK_SPIKES.map(d => d.latency), [spikes]);
  const assetList = useMemo(() => assets || FALLBACK_ASSETS, [assets]);
  const riskList = useMemo(() => riskIndices || FALLBACK_RISK_INDICES, [riskIndices]);
  const severityList = useMemo(() => severityCards || FALLBACK_SEVERITY, [severityCards]);
  const matrixList = useMemo(() => matrixData || FALLBACK_MATRIX, [matrixData]);

  const loading = histLoading || spikesLoading || assetsLoading || riskLoading || severityLoading || matrixLoading;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans antialiased">
      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        .animate-ping { animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; }
      `}</style>

      <div className="relative max-w-[1600px] mx-auto bg-slate-900 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(6,182,212,0.15)] border border-slate-800">
        <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-[11px] text-slate-500 font-mono ml-2">splunk></span>
          <span className="text-[10px] text-slate-600 ml-auto">
            {loading ? "Loading..." : "System Performance Software"}
          </span>
        </div>

        <div className="p-4 space-y-4" style={{ background: "radial-gradient(ellipse at center, #0f1a1a 0%, #080f0f 100%)" }}>
          <TopBar />
          
          <div className="grid grid-cols-[260px_1fr_220px] gap-4" style={{ minHeight: "520px" }}>
            <LeftColumn histogramData={histogramValues} spikeData={spikeValues} />
            <CenterColumn assets={assetList} selectedAssetId={selectedAssetId} onAssetSelect={a => setSelectedAssetId(a.id)} />
            <RightColumn riskIndices={riskList} onTabChange={() => {}} />
          </div>

          <div className="grid grid-cols-[1fr_1.3fr] gap-4" style={{ minHeight: "280px" }}>
            <MatrixPanel data={matrixList} />
            <BottomRightPanel severityCards={severityList} />
          </div>

          {selectedAssetId && (
            <div className="absolute right-4 top-20 bottom-4 w-80 z-50 pointer-events-none">
              <div className="h-full flex flex-col" style={{ pointerEvents: "auto" }}>
                <AssetDetailDropdown
                  assets={assetList}
                  selectedId={selectedAssetId}
                  onSelect={a => setSelectedAssetId(a.id)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export {
  useAlertsHistogram,
  useSpikeChart,
  useAssets,
  useRiskIndices,
  useSeverityCards,
  useMatrixData,
  useTerrainMap,
};
export type { Asset, RiskIndex, SeverityCard, MatrixRow, AlertHistogramPoint, SpikePoint };