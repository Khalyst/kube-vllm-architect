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
import { Activity, Gauge, Zap, Clock, Users, ArrowUpRight, Sparkles, Sliders } from 'lucide-react';

interface Props {
  config: AppConfig;
  preset: ModelPreset;
  vram: VramCalculationResult;
}

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
  const [chartMode, setChartMode] = useState<'throughput' | 'latency'>('throughput');

  // Baseline per-replica token generation rate
  const baseTokensPerSec = Math.max(80, vram.tokensPerSecEstimate || 350);

  // Compute performance points for replica counts from 1 to maxReplicas
  const maxPods = Math.max(4, Math.min(16, config.maxReplicas || 4));
  
  const performanceData = useMemo(() => {
    const data = [];

    // Prefix caching multiplier (reusing prefill KV cache avoids redundant matrix multiplication)
    const cachingMultiplier = 1 + (cacheHitRate / 100) * 1.6;

    for (let r = 1; r <= maxPods; r++) {
      // Replicas * base throughput
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

      // Prefill calculation (Time-to-First-Token)
      // Cold TTFT depends on prompt tokens and model parameters
      const coldPrefillMs = Math.round(15 + (promptLength / (selectedGpu.bandwidthGBs * 0.4)) * (preset.paramsBillions / 10) * 8);
      // Warm TTFT is near constant (just hash table lookup and page table allocation)
      const warmPrefillMs = Math.round(18 + (promptLength / 1000) * 3);
      
      const effectiveTtftMs = Math.round(
        (cacheHitRate / 100) * warmPrefillMs + (1 - cacheHitRate / 100) * coldPrefillMs
      );

      // Inter-token latency (ITL) per output token (decode phase)
      // Slows slightly under higher concurrency per replica
      const itlMs = Math.round((14 + Math.min(25, loadPerReplica * 0.25)) * 10) / 10;

      // End-to-End latency for typical request
      const e2eLatencyMs = Math.round(queueDelayMs + effectiveTtftMs + (outputLength * itlMs));

      data.push({
        replicas: `${r} Pod${r > 1 ? 's' : ''}`,
        replicaCount: r,
        throughputWithCache,
        throughputWithoutCache,
        ttft: effectiveTtftMs,
        coldTtft: coldPrefillMs,
        warmTtft: warmPrefillMs,
        itl: itlMs,
        queueDelay: queueDelayMs,
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
    <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/50 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">3. Performance & Scalability Estimation</h3>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Predicts aggregate cluster throughput (tokens/s), Time-to-First-Token (TTFT), and queue delay across replica counts.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-950 border border-neutral-800 rounded">
          <button
            onClick={() => setChartMode('throughput')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              chartMode === 'throughput'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Throughput (tok/s)
          </button>
          <button
            onClick={() => setChartMode('latency')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              chartMode === 'latency'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Latency & TTFT (ms)
          </button>
        </div>
      </div>

      {/* Interactive Simulation Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-xs">
        {/* Concurrent Clients */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-300 font-medium">Simulated Concurrency</span>
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
          <div className="text-[10px] text-neutral-500">Active concurrent HTTP requests</div>
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
            {cacheHitRate > 0 ? 'Smart Prefix Caching active' : 'Zero cache affinity (cold)'}
          </div>
        </div>

        {/* Prompt Length */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-300 font-medium">Prompt Context Size</span>
            <span className="font-mono text-neutral-200 tabular-nums">{promptLength} tokens</span>
          </div>
          <select
            value={promptLength}
            onChange={(e) => setPromptLength(Number(e.target.value))}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-xs text-white font-mono"
          >
            <option value="512">512 tokens (Short Query)</option>
            <option value="1024">1,024 tokens (Standard Chat)</option>
            <option value="2048">2,048 tokens (Document QA)</option>
            <option value="4096">4,096 tokens (Extended Context)</option>
          </select>
          <div className="text-[10px] text-neutral-500">Input prefill token payload</div>
        </div>

        {/* Output Generation Length */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-300 font-medium">Output Tokens</span>
            <span className="font-mono text-neutral-200 tabular-nums">{outputLength} tokens</span>
          </div>
          <select
            value={outputLength}
            onChange={(e) => setOutputLength(Number(e.target.value))}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-xs text-white font-mono"
          >
            <option value="128">128 tokens (Concise summary)</option>
            <option value="256">256 tokens (Standard answer)</option>
            <option value="512">512 tokens (Long code/reasoning)</option>
            <option value="1024">1,024 tokens (Detailed output)</option>
          </select>
          <div className="text-[10px] text-neutral-500">Autoregressive decode tokens</div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Peak Cluster Throughput */}
        <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono flex items-center justify-between">
            <span>Peak Cluster Throughput</span>
            <Zap className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {peakSnapshot.throughputWithCache.toLocaleString()}
            <span className="text-xs text-neutral-400 font-normal"> tok/s</span>
          </div>
          <div className="text-[10px] text-neutral-400 font-mono">
            At {maxPods} pods ({cacheHitRate}% cache hit rate)
          </div>
        </div>

        {/* Warm TTFT (Prefix Hit) */}
        <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono flex items-center justify-between">
            <span>Warm Cache TTFT</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
            {currentSnapshot.warmTtft}
            <span className="text-xs text-neutral-400 font-normal"> ms</span>
          </div>
          <div className="text-[10px] text-neutral-400 font-mono">
            vs {currentSnapshot.coldTtft} ms cold prefill ({(100 - (currentSnapshot.warmTtft / currentSnapshot.coldTtft) * 100).toFixed(0)}% faster)
          </div>
        </div>

        {/* Inter-Token Latency (ITL) */}
        <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono flex items-center justify-between">
            <span>Decode Latency (ITL)</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {currentSnapshot.itl}
            <span className="text-xs text-neutral-400 font-normal"> ms/tok</span>
          </div>
          <div className="text-[10px] text-neutral-400 font-mono">
            ~{(1000 / currentSnapshot.itl).toFixed(0)} tokens/sec per user stream
          </div>
        </div>

        {/* End-to-End Latency */}
        <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono flex items-center justify-between">
            <span>Avg E2E Response Time</span>
            <Gauge className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-sky-300 font-mono tabular-nums">
            {(currentSnapshot.e2eLatency / 1000).toFixed(2)}
            <span className="text-xs text-neutral-400 font-normal"> sec</span>
          </div>
          <div className="text-[10px] text-neutral-400 font-mono">
            For {outputLength} tokens output @ {concurrency} users
          </div>
        </div>
      </div>

      {/* Main Chart Visualization */}
      <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-200">
              {chartMode === 'throughput'
                ? 'Throughput Scaling (tokens/s vs. Replica Count)'
                : 'Latency Curve & Queue Delay Breakdown (ms vs. Replica Count)'}
            </span>
          </div>
          <span className="text-neutral-500 font-mono text-[11px]">
            {selectedGpu.name} (TP={config.tensorParallelSize})
          </span>
        </div>

        <div className="h-[280px] w-full text-xs">
          {chartMode === 'throughput' ? (
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
          ) : (
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
                <Bar dataKey="ttft" name="Time-to-First-Token (TTFT)" fill="#10b981" radius={[3, 3, 0, 0]} stackId="a" />
                <Bar dataKey="queueDelay" name="Queue Scheduler Delay" fill="#ef4444" radius={[3, 3, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Engineering Takeaway Note */}
      <div className="p-3 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-400 flex items-start gap-2">
        <ArrowUpRight className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-neutral-200">Scaling Dynamics Insight:</strong> Throughput scales linearly with replica count, while smart prefix caching adds an additional <span className="text-sky-300 font-mono font-medium">~2.2x multiplier</span> by eliminating duplicate prompt matrix multiplications. Under high traffic concurrency ({concurrency} users), scaling past <span className="text-emerald-400 font-mono font-medium">{Math.ceil(concurrency / 60)} replicas</span> eliminates scheduler queue starvation and keeps TTFT below 50ms.
        </div>
      </div>
    </div>
  );
};
