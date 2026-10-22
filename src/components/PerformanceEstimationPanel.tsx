import React, { useState, useMemo } from 'react';
import { AppConfig, ModelPreset, VramCalculationResult } from '../types';
import { GPU_SPECS } from '../data/gpus';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { 
  Activity, 
  Gauge, 
  Zap, 
  Clock, 
  Sparkles, 
  ArrowUpRight, 
  TrendingUp, 
  Hourglass,
  Layers,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

interface Props {
  config: AppConfig;
  preset: ModelPreset;
  vram: VramCalculationResult;
}

export type MetricTab = 'throughput' | 'ttft' | 'tpot' | 'e2e';

export const PerformanceEstimationPanel: React.FC<Props> = ({
  config,
  preset,
  vram
}) => {
  const selectedGpu = GPU_SPECS.find((g) => g.id === config.selectedGpuId) || GPU_SPECS[0];

  // Interactive controls for performance simulation
  const [concurrency, setConcurrency] = useState<number>(64);
  const [cacheHitRate, setCacheHitRate] = useState<number>(config.enablePrefixCaching ? 75 : 0);
  const [promptLength, setPromptLength] = useState<number>(1024);
  const [outputLength, setOutputLength] = useState<number>(256);
  const [activeMetricTab, setActiveMetricTab] = useState<MetricTab>('throughput');

  // Baseline per-replica token generation rate
  const baseTokensPerSec = Math.max(80, vram.tokensPerSecEstimate || 350);

  // Compute performance points for replica counts from 1 to maxReplicas
  const maxPods = Math.max(4, Math.min(16, config.maxReplicas || 4));
  
  const performanceData = useMemo(() => {
    const data = [];

    // Prefix caching multiplier (reusing prefill KV cache avoids redundant matrix multiplication)
    const cachingMultiplier = 1 + (cacheHitRate / 100) * 1.6;

    for (let r = 1; r <= maxPods; r++) {
      // 1. Throughput calculation
      const throughputWithoutCache = Math.round(r * baseTokensPerSec);
      const throughputWithCache = Math.round(throughputWithoutCache * cachingMultiplier);

      // Concurrency load per replica
      const loadPerReplica = concurrency / r;
      const capacityPerReplica = config.maxNumSeqs || 256;

      // Queue delay in ms (spikes if loadPerReplica exceeds safe capacity)
      const saturationRatio = loadPerReplica / (capacityPerReplica * 0.7);
      const queueDelayMs = saturationRatio > 1
        ? Math.round(Math.pow(saturationRatio - 1, 2) * 450 + (saturationRatio - 1) * 300)
        : Math.round(Math.max(0, saturationRatio * 20));

      // 2. TTFT (Time To First Token) - Prefill Phase
      // Cold TTFT depends on prompt tokens and model parameter size
      const coldPrefillMs = Math.round(15 + (promptLength / (selectedGpu.bandwidthGBs * 0.4)) * (preset.paramsBillions / 10) * 8);
      // Warm TTFT is near constant (just hash table lookup and page table allocation)
      const warmPrefillMs = Math.round(18 + (promptLength / 1000) * 3);
      
      const effectiveTtftMs = Math.round(
        (cacheHitRate / 100) * warmPrefillMs + (1 - cacheHitRate / 100) * coldPrefillMs
      );

      // 3. TPOT (Time Per Output Token) - Decode Phase (also known as ITL)
      // Time in ms to generate each subsequent token during autoregressive decoding
      const tpotMs = Math.round((14 + Math.min(25, loadPerReplica * 0.25)) * 10) / 10;
      const tokensPerSecPerStream = Math.round((1000 / tpotMs) * 10) / 10;

      // 4. End-to-End Latency
      // Total duration from initial request submission until the final token is generated
      const generationDurationMs = Math.round(outputLength * tpotMs);
      const e2eLatencyMs = Math.round(queueDelayMs + effectiveTtftMs + generationDurationMs);

      data.push({
        replicas: `${r} Pod${r > 1 ? 's' : ''}`,
        replicaCount: r,
        // Metric 1: Throughput
        throughputWithCache,
        throughputWithoutCache,
        // Metric 2: TTFT
        ttft: effectiveTtftMs,
        coldTtft: coldPrefillMs,
        warmTtft: warmPrefillMs,
        // Metric 3: TPOT
        tpot: tpotMs,
        tokensPerSecPerStream,
        // Metric 4: End-to-End Latency
        queueDelay: queueDelayMs,
        generationDuration: generationDurationMs,
        e2eLatency: e2eLatencyMs,
        maxSupportedConcurrency: r * capacityPerReplica
      });
    }

    return data;
  }, [maxPods, baseTokensPerSec, cacheHitRate, concurrency, promptLength, outputLength, selectedGpu, preset, config.maxNumSeqs]);

  // Current cluster snapshot at active/min replicas
  const currentReplicaCount = Math.max(1, config.minReplicas || 1);
  const currentSnapshot = performanceData.find((d) => d.replicaCount === currentReplicaCount) || performanceData[0];
  const peakSnapshot = performanceData[performanceData.length - 1];

  return (
    <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/50 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">3. Inference Metrics & Performance Visualization</h3>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real-time simulation and visualization of the four core LLM serving metrics: TTFT, TPOT, Throughput, and End-to-End Latency.
          </p>
        </div>

        {/* View Toggle Tabs for the 4 Core Metrics */}
        <div className="flex items-center gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-lg overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveMetricTab('throughput')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              activeMetricTab === 'throughput'
                ? 'bg-sky-600 text-white shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Throughput (tok/s)
          </button>
          <button
            onClick={() => setActiveMetricTab('ttft')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              activeMetricTab === 'ttft'
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            TTFT (First Token)
          </button>
          <button
            onClick={() => setActiveMetricTab('tpot')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              activeMetricTab === 'tpot'
                ? 'bg-amber-600 text-white shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            TPOT (Per Output Token)
          </button>
          <button
            onClick={() => setActiveMetricTab('e2e')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              activeMetricTab === 'e2e'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            End-to-End Latency
          </button>
        </div>
      </div>

      {/* 4 Core Inference Metrics Cards (Directly matching user image) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: TTFT */}
        <div 
          onClick={() => setActiveMetricTab('ttft')}
          className={`p-4 rounded-lg border transition-all cursor-pointer ${
            activeMetricTab === 'ttft'
              ? 'bg-emerald-950/30 border-emerald-500 shadow-sm'
              : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              TTFT
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300">
              Prefill
            </span>
          </div>
          <div className="text-[11px] font-medium text-neutral-300">Time To First Token</div>
          <div className="text-[10px] text-neutral-400 mt-0.5 leading-snug">
            Time until the first token appears
          </div>
          <div className="mt-3 flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-bold text-white tabular-nums">
              {currentSnapshot.warmTtft}
            </span>
            <span className="text-xs text-neutral-400">ms (warm)</span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1 font-mono">
            vs {currentSnapshot.coldTtft} ms cold prefill
          </div>
        </div>

        {/* Metric 2: TPOT */}
        <div 
          onClick={() => setActiveMetricTab('tpot')}
          className={`p-4 rounded-lg border transition-all cursor-pointer ${
            activeMetricTab === 'tpot'
              ? 'bg-amber-950/30 border-amber-500 shadow-sm'
              : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-amber-400 flex items-center gap-1.5">
              <Hourglass className="w-3.5 h-3.5" />
              TPOT
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300">
              Decode
            </span>
          </div>
          <div className="text-[11px] font-medium text-neutral-300">Time Per Output Token</div>
          <div className="text-[10px] text-neutral-400 mt-0.5 leading-snug">
            How quickly tokens arrive during generation
          </div>
          <div className="mt-3 flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-bold text-white tabular-nums">
              {currentSnapshot.tpot}
            </span>
            <span className="text-xs text-neutral-400">ms / tok</span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1 font-mono">
            ~{currentSnapshot.tokensPerSecPerStream} tokens/sec per user stream
          </div>
        </div>

        {/* Metric 3: Throughput */}
        <div 
          onClick={() => setActiveMetricTab('throughput')}
          className={`p-4 rounded-lg border transition-all cursor-pointer ${
            activeMetricTab === 'throughput'
              ? 'bg-sky-950/30 border-sky-500 shadow-sm'
              : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-sky-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Throughput
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300">
              Cluster Capacity
            </span>
          </div>
          <div className="text-[11px] font-medium text-neutral-300">System Throughput</div>
          <div className="text-[10px] text-neutral-400 mt-0.5 leading-snug">
            How much the system processes per second
          </div>
          <div className="mt-3 flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-bold text-white tabular-nums">
              {peakSnapshot.throughputWithCache.toLocaleString()}
            </span>
            <span className="text-xs text-neutral-400">tok / s</span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1 font-mono">
            Across {maxPods} pods ({cacheHitRate}% cache hit)
          </div>
        </div>

        {/* Metric 4: End-to-End Latency */}
        <div 
          onClick={() => setActiveMetricTab('e2e')}
          className={`p-4 rounded-lg border transition-all cursor-pointer ${
            activeMetricTab === 'e2e'
              ? 'bg-indigo-950/30 border-indigo-500 shadow-sm'
              : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-indigo-400 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" />
              End-to-End Latency
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300">
              Total E2E
            </span>
          </div>
          <div className="text-[11px] font-medium text-neutral-300">Total Response Latency</div>
          <div className="text-[10px] text-neutral-400 mt-0.5 leading-snug">
            Total time from request to finished response
          </div>
          <div className="mt-3 flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-bold text-white tabular-nums">
              {(currentSnapshot.e2eLatency / 1000).toFixed(2)}
            </span>
            <span className="text-xs text-neutral-400">seconds</span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1 font-mono">
            TTFT ({currentSnapshot.ttft}ms) + Decode ({(currentSnapshot.generationDuration / 1000).toFixed(2)}s)
          </div>
        </div>
      </div>

      {/* Interactive Simulation Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-xs">
        {/* Concurrent Clients */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-300 font-medium">Active Concurrency</span>
            <span className="font-mono text-sky-400 font-semibold tabular-nums">{concurrency} users</span>
          </div>
          <input
            type="range"
            min="10"
            max="300"
            step="10"
            value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            className="w-full accent-sky-500"
          />
          <div className="text-[10px] text-neutral-500">Affects queue delay &amp; TPOT decode speed</div>
        </div>

        {/* Cache Hit Rate */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-300 font-medium">KV Cache Hit Rate</span>
            <span className="font-mono text-emerald-400 font-semibold tabular-nums">{cacheHitRate}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="95"
            step="5"
            value={cacheHitRate}
            onChange={(e) => setCacheHitRate(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="text-[10px] text-neutral-500">
            {cacheHitRate > 0 ? 'Prefix caching accelerates TTFT & Throughput' : 'Cold prefill on every request'}
          </div>
        </div>

        {/* Prompt Length */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-300 font-medium">Input Prompt Size</span>
            <span className="font-mono text-neutral-200 tabular-nums">{promptLength} tokens</span>
          </div>
          <select
            value={promptLength}
            onChange={(e) => setPromptLength(Number(e.target.value))}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-xs text-white font-mono"
          >
            <option value="512">512 tokens (Short Prompt)</option>
            <option value="1024">1,024 tokens (Standard Chat)</option>
            <option value="2048">2,048 tokens (Document QA / RAG)</option>
            <option value="4096">4,096 tokens (Extended Context)</option>
          </select>
          <div className="text-[10px] text-neutral-500">Determines prefill computation load</div>
        </div>

        {/* Output Generation Length */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-300 font-medium">Output Generated Tokens</span>
            <span className="font-mono text-neutral-200 tabular-nums">{outputLength} tokens</span>
          </div>
          <select
            value={outputLength}
            onChange={(e) => setOutputLength(Number(e.target.value))}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-xs text-white font-mono"
          >
            <option value="128">128 tokens (Concise summary)</option>
            <option value="256">256 tokens (Standard response)</option>
            <option value="512">512 tokens (Long code / reasoning)</option>
            <option value="1024">1,024 tokens (Deep response)</option>
          </select>
          <div className="text-[10px] text-neutral-500">Multiplied by TPOT to calculate E2E latency</div>
        </div>
      </div>

      {/* Main Chart Visualization Section for the Selected Metric */}
      <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-200">
              {activeMetricTab === 'throughput' && 'Throughput Scaling (System Tokens/sec vs. Replica Count)'}
              {activeMetricTab === 'ttft' && 'TTFT: Time To First Token Comparison (Warm Cache vs. Cold Prefill)'}
              {activeMetricTab === 'tpot' && 'TPOT: Time Per Output Token / Inter-Token Generation Latency'}
              {activeMetricTab === 'e2e' && 'End-to-End Latency: Breakdown from Request to Finished Response'}
            </span>
          </div>
          <span className="text-neutral-500 font-mono text-[11px]">
            {selectedGpu.name} (TP={config.tensorParallelSize})
          </span>
        </div>

        <div className="h-[280px] w-full text-xs">
          {/* TAB 1: THROUGHPUT */}
          {activeMetricTab === 'throughput' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorWithCache" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorWithoutCache" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="replicas" stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 11 }} />
                <YAxis stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 11 }} tickFormatter={(val) => `${val.toLocaleString()} t/s`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '6px', fontSize: '11px', color: '#e5e5e5' }}
                  formatter={(val: any) => [`${Number(val).toLocaleString()} tokens/sec`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Area
                  type="monotone"
                  dataKey="throughputWithCache"
                  name={`With Smart Prefix Routing (${cacheHitRate}% Cache Hit)`}
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorWithCache)"
                />
                <Area
                  type="monotone"
                  dataKey="throughputWithoutCache"
                  name="Without Prefix Caching (Cold Prefill)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#colorWithoutCache)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {/* TAB 2: TTFT (Time To First Token) */}
          {activeMetricTab === 'ttft' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="replicas" stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 11 }} />
                <YAxis stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 11 }} tickFormatter={(val) => `${val} ms`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '6px', fontSize: '11px', color: '#e5e5e5' }}
                  formatter={(val: any, name: any) => [`${val} ms`, name]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="warmTtft" name="Warm Prefix Cache TTFT" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="coldTtft" name="Cold Prefill TTFT (No Cache)" fill="#64748b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="queueDelay" name="Queue Scheduler Delay" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* TAB 3: TPOT (Time Per Output Token) */}
          {activeMetricTab === 'tpot' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="replicas" stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 11 }} />
                <YAxis 
                  yAxisId="left" 
                  stroke="#f59e0b" 
                  tick={{ fill: '#f59e0b', fontSize: 11 }} 
                  tickFormatter={(val) => `${val} ms/tok`} 
                  domain={['dataMin - 5', 'dataMax + 10']}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  stroke="#38bdf8" 
                  tick={{ fill: '#38bdf8', fontSize: 11 }} 
                  tickFormatter={(val) => `${val} tok/s`} 
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '6px', fontSize: '11px', color: '#e5e5e5' }}
                  formatter={(val: any, name: any) => [
                    name.includes('TPOT') ? `${val} ms per output token` : `${val} tokens/sec per stream`,
                    name
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="tpot"
                  name="TPOT (Time Per Output Token - ms/tok)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#f59e0b' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="tokensPerSecPerStream"
                  name="Per-User Stream Speed (Tokens/s)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={{ r: 3, fill: '#38bdf8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* TAB 4: END-TO-END LATENCY */}
          {activeMetricTab === 'e2e' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="replicas" stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 11 }} />
                <YAxis stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 11 }} tickFormatter={(val) => `${val} ms`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '6px', fontSize: '11px', color: '#e5e5e5' }}
                  formatter={(val: any, name: any) => [`${val} ms`, name]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="queueDelay" name="Queue Delay" fill="#ef4444" stackId="a" />
                <Bar dataKey="ttft" name="TTFT (Time To First Token)" fill="#10b981" stackId="a" />
                <Bar dataKey="generationDuration" name={`Output Decode (${outputLength} toks × TPOT)`} fill="#6366f1" radius={[3, 3, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Educational Formula & Anatomy Bar */}
      <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg space-y-3">
        <div className="text-xs font-semibold text-white flex items-center gap-2">
          <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
          <span>Inference Metrics Relationship &amp; Mathematical Anatomy</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-neutral-300">
          <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800/80">
            <span className="text-indigo-400 font-semibold font-mono">End-to-End Latency Formula:</span>
            <div className="mt-1 font-mono text-[11px] text-neutral-200 bg-neutral-950 p-2 rounded">
              E2E = Queue Delay + TTFT + (Output Tokens × TPOT)
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">
              TTFT handles prompt processing (prefill), while TPOT dictates output generation pacing.
            </div>
          </div>
          <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800/80">
            <span className="text-sky-400 font-semibold font-mono">System Throughput vs. TPOT:</span>
            <div className="mt-1 font-mono text-[11px] text-neutral-200 bg-neutral-950 p-2 rounded">
              Throughput = (Active Concurrent Requests × 1000) / TPOT
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">
              vLLM continuous batching and PagedAttention maximize overall system throughput while maintaining low individual TPOT.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
