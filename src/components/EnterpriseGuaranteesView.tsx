import React, { useState } from 'react';
import { AppConfig, ModelPreset, GpuSpec } from '../types';
import { GPU_SPECS } from '../data/gpus';
import { 
  ShieldCheck, 
  DollarSign, 
  TrendingUp, 
  Shuffle, 
  Activity, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Cpu, 
  Server, 
  Network, 
  Clock, 
  Lock, 
  FileCode, 
  Zap,
  Sliders,
  Check
} from 'lucide-react';

interface EnterpriseGuaranteesViewProps {
  config: AppConfig;
  preset: ModelPreset;
  updateConfig: (patch: Partial<AppConfig>) => void;
}

export const EnterpriseGuaranteesView: React.FC<EnterpriseGuaranteesViewProps> = ({
  config,
  preset,
  updateConfig
}) => {
  const [activePillar, setActivePillar] = useState<'all' | 'cost' | 'scalability' | 'experimentation' | 'reliability'>('all');
  const [simulatedSpike, setSimulatedSpike] = useState(false);

  const selectedGpu = GPU_SPECS.find((g) => g.id === config.selectedGpuId) || GPU_SPECS[0];
  const platform = config.cloudPlatform === 'baremetal' ? 'aws' : config.cloudPlatform;
  const pricing = selectedGpu.hourlyPrice[platform] || selectedGpu.hourlyPrice.aws;
  const hourlyGpuCost = pricing?.onDemand || 3.5;
  const spotGpuCost = pricing?.spot || hourlyGpuCost * 0.35;
  const gpusPerReplica = config.tensorParallelSize * config.pipelineParallelSize;
  const baselineMonthly = hourlyGpuCost * gpusPerReplica * config.maxReplicas * 730;

  // Optimized cost with scale-to-zero, spot arbitrage, and prefix caching savings
  const effectiveHours = config.minReplicas === 0 ? 300 : 730;
  const effectiveReplicas = config.minReplicas === 0 ? 1.5 : (config.minReplicas + config.maxReplicas) / 2;
  const optimizedMonthly = spotGpuCost * gpusPerReplica * effectiveReplicas * effectiveHours;
  const monthlySavings = Math.max(0, baselineMonthly - optimizedMonthly);
  const savingsPct = Math.round((monthlySavings / (baselineMonthly || 1)) * 100);

  const handleSimulateSpike = () => {
    setSimulatedSpike(true);
    setTimeout(() => {
      setSimulatedSpike(false);
    }, 4500);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sky-950/40 via-neutral-900/60 to-neutral-950 border border-sky-800/30 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold tracking-wide uppercase">
              <ShieldCheck className="w-3.5 h-3.5" />
              Production SLA & Enterprise Guarantees
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Enterprise-Grade vLLM Serving Contract
            </h1>
            <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
              Guaranteed infrastructure contracts across cost containment, traffic surge resilience,
              zero-downtime inference engine hot-swapping, and multi-tier operational reliability.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-3 text-center min-w-[140px]">
              <div className="text-xs text-neutral-400">Guaranteed Uptime</div>
              <div className="text-xl font-bold font-mono text-emerald-400">99.95% SLA</div>
              <div className="text-[10px] text-neutral-500">PDB + Headroom</div>
            </div>
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-3 text-center min-w-[140px]">
              <div className="text-xs text-neutral-400">Projected Savings</div>
              <div className="text-xl font-bold font-mono text-sky-400">{savingsPct}% Spend</div>
              <div className="text-[10px] text-neutral-500">Engine + Autoscaling</div>
            </div>
          </div>
        </div>

        {/* Pillar filter tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-neutral-800/70">
          <button
            onClick={() => setActivePillar('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activePillar === 'all'
                ? 'bg-neutral-100 text-neutral-950 font-semibold shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            All 4 Pillars
          </button>
          <button
            onClick={() => setActivePillar('cost')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activePillar === 'cost'
                ? 'bg-emerald-500 text-white font-semibold shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            1. Cost Control
          </button>
          <button
            onClick={() => setActivePillar('scalability')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activePillar === 'scalability'
                ? 'bg-sky-500 text-white font-semibold shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            2. Scalability (Monday Spike)
          </button>
          <button
            onClick={() => setActivePillar('experimentation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activePillar === 'experimentation'
                ? 'bg-indigo-500 text-white font-semibold shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" />
            3. Experimentation & Swapping
          </button>
          <button
            onClick={() => setActivePillar('reliability')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activePillar === 'reliability'
                ? 'bg-amber-500 text-white font-semibold shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            4. Reliability & SLA Alerts
          </button>
        </div>
      </div>

      {/* Grid of 4 Pillars */}
      <div className="space-y-8">
        {/* ========================================================= */}
        {/* PILLAR 1: COST CONTROL */}
        {/* ========================================================= */}
        {(activePillar === 'all' || activePillar === 'cost') && (
          <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 relative">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Pillar 1</div>
                  <h2 className="text-lg font-bold text-white">Cost Control Guarantee</h2>
                  <p className="text-xs text-neutral-400">
                    Optimizations at the inference engine level systematically reduce GPU spend
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 bg-emerald-950/30 border border-emerald-800/40 px-3 py-1.5 rounded-md text-xs font-mono text-emerald-300">
                <span>Saving: ~${monthlySavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Feature 1: PagedAttention */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">PagedAttention (Zero Waste)</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-mono">Guaranteed</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                  Allocates KV cache memory in dynamic non-contiguous physical pages. Eliminates 96% of internal fragmentation.
                </p>
                <div className="text-[11px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                  Status: Native in vLLM core engine
                </div>
              </div>

              {/* Feature 2: Prefix Caching */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">KV Prefix Caching</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enablePrefixCaching}
                      onChange={(e) => updateConfig({ enablePrefixCaching: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                  Reuses precomputed KV tokens across multi-turn user chats, agent system prompts, and RAG contexts with zero recomputation.
                </p>
                <div className="text-[11px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                  Flag: {config.enablePrefixCaching ? '--enable-prefix-caching (Active)' : 'Disabled'}
                </div>
              </div>

              {/* Feature 3: FP8 KV Cache */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">FP8 KV Cache Pool</span>
                  <button
                    onClick={() => updateConfig({ kvCacheDtype: config.kvCacheDtype === 'fp8' ? 'auto' : 'fp8' })}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      config.kvCacheDtype === 'fp8'
                        ? 'bg-emerald-500 text-white font-semibold'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {config.kvCacheDtype === 'fp8' ? 'FP8 Active' : 'Switch to FP8'}
                  </button>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                  Cuts KV cache footprint in half, doubling effective token concurrency per GPU without buying additional hardware.
                </p>
                <div className="text-[11px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                  Flag: --kv-cache-dtype {config.kvCacheDtype}
                </div>
              </div>

              {/* Feature 4: Scale to Zero */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">Scale-to-Zero Off-Peak</span>
                  <button
                    onClick={() => updateConfig({ minReplicas: config.minReplicas === 0 ? 1 : 0 })}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      config.minReplicas === 0
                        ? 'bg-emerald-500 text-white font-semibold'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {config.minReplicas === 0 ? 'Min: 0 (Enabled)' : 'Min: 1 (Warm)'}
                  </button>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                  KEDA scales deployment pods to zero when queue is empty for over 5m, saving 100% of GPU compute during idle nights.
                </p>
                <div className="text-[11px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                  KEDA: minReplicaCount: {config.minReplicas}
                </div>
              </div>

              {/* Feature 5: Chunked Prefill */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">Chunked Prefill Scheduling</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enableChunkedPrefill}
                      onChange={(e) => updateConfig({ enableChunkedPrefill: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                  Interleaves long prompt prefill with short token decodes to prevent latency spikes and maximize batch saturation.
                </p>
                <div className="text-[11px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                  Flag: {config.enableChunkedPrefill ? '--enable-chunked-prefill' : 'Off'}
                </div>
              </div>

              {/* Feature 6: Spot Arbitrage */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">Karpenter Spot Provisioning</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-mono">Spot Ready</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                  NodePool declarative spec supports Spot capacity types with automatic fallback to On-Demand during stock shortages.
                </p>
                <div className="text-[11px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                  Manifest: 07-gpu-node-provisioner.yaml
                </div>
              </div>
            </div>

            {/* Cost Summary Box */}
            <div className="p-4 rounded-lg bg-neutral-950/80 border border-emerald-900/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="text-xs text-neutral-400 font-medium">Monthly Cloud GPU Cost Arbitrage</div>
                <div className="text-xs text-neutral-500">
                  Calculated based on {gpusPerReplica}x {selectedGpu.name} on {config.cloudPlatform.toUpperCase()}
                </div>
              </div>
              <div className="flex items-center gap-6 font-mono text-xs">
                <div>
                  <div className="text-neutral-500 text-[10px]">Unoptimized Peak</div>
                  <div className="text-neutral-300 line-through">${baselineMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</div>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-600 hidden sm:block" />
                <div>
                  <div className="text-emerald-400 text-[10px] font-semibold">Guaranteed Optimized</div>
                  <div className="text-lg font-bold text-emerald-400">${optimizedMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* PILLAR 2: SCALABILITY (MONDAY MORNING SPIKE) */}
        {/* ========================================================= */}
        {(activePillar === 'all' || activePillar === 'scalability') && (
          <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 relative">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-sky-400 uppercase tracking-wider">Pillar 2</div>
                  <h2 className="text-lg font-bold text-white">Scalability Guarantee</h2>
                  <p className="text-xs text-neutral-400">
                    Serving layer ensures your system handles Monday morning spikes without downtime
                  </p>
                </div>
              </div>

              <button
                onClick={handleSimulateSpike}
                disabled={simulatedSpike}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-sm disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                {simulatedSpike ? 'Simulating 500 req/s Spike...' : 'Simulate Monday Spike'}
              </button>
            </div>

            {/* Spike simulation banner */}
            {simulatedSpike && (
              <div className="mb-6 p-4 rounded-lg bg-sky-950/40 border border-sky-600/40 animate-pulse flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Simulated Traffic Surge: +450 concurrent requests detected</div>
                    <div className="text-[11px] text-sky-300">
                      KEDA trigger activated (queue depth {'>'} {config.kedaQueueThreshold}) → ScaleUp policy firing +100% pods → PDB preserves existing workers.
                    </div>
                  </div>
                </div>
                <div className="text-xs font-mono text-sky-400 font-bold">Scaling: 1 → {config.maxReplicas} Pods (0 Dropouts)</div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Defense 1: PodDisruptionBudget */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">PodDisruptionBudget (PDB)</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enablePdb}
                      onChange={(e) => updateConfig({ enablePdb: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                  Enforces <span className="font-mono text-neutral-300">minAvailable: {config.pdbMinAvailable}</span>. Prevents Karpenter node drains or cluster upgrades from evicting active inference pods during peak business hours.
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-500">Min Available Pods:</span>
                  <select
                    value={config.pdbMinAvailable}
                    onChange={(e) => updateConfig({ pdbMinAvailable: Number(e.target.value) })}
                    className="bg-neutral-900 border border-neutral-700 text-xs rounded px-2 py-0.5 text-neutral-200"
                  >
                    <option value={1}>1 pod</option>
                    <option value={2}>2 pods</option>
                    <option value={3}>3 pods</option>
                  </select>
                </div>
              </div>

              {/* Defense 2: Aggressive KEDA Scale-Up */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">Immediate Scale-Up Profile</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-400 font-mono">0s Delay</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                  <span className="font-mono text-neutral-300">stabilizationWindowSeconds: 0</span> with 100% pod increase rate every 15s. Instantly catches surges before clients see latency degredation.
                </p>
                <div className="text-[11px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                  Trigger: vllm:num_requests_waiting &gt; {config.kedaQueueThreshold}
                </div>
              </div>

              {/* Defense 3: Conservative Scale-Down Dampener */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">Scale-Down Cooldown Dampener</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-400 font-mono">{config.kedaCooldownPeriod}s Window</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                  Stabilizes warm GPU pods for 5 minutes after traffic lulls. Eliminates GPU "flapping" and cold-start model weight re-loading.
                </p>
                <div className="text-[11px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                  Policy: 1 pod per 60s step-down
                </div>
              </div>
            </div>

            {/* Architecture Flow Diagram */}
            <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
              <div className="text-xs font-semibold text-neutral-300 mb-3 flex items-center gap-2">
                <Network className="w-3.5 h-3.5 text-sky-400" />
                Monday Spike Ingress &amp; Headroom Topology
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center text-xs">
                <div className="p-3 rounded bg-neutral-900/80 border border-neutral-800">
                  <div className="text-[11px] text-neutral-500">1. Client Wave</div>
                  <div className="font-bold text-white mt-1">Gateway API Ingress</div>
                  <div className="text-[10px] text-neutral-400 mt-1">Non-blocking HTTP connection queue</div>
                </div>
                <div className="p-3 rounded bg-neutral-900/80 border border-neutral-800">
                  <div className="text-[11px] text-neutral-500">2. Metric Sensor</div>
                  <div className="font-bold text-sky-400 mt-1">Prometheus Poller</div>
                  <div className="text-[10px] text-neutral-400 mt-1">Evaluates queue backlog every 15s</div>
                </div>
                <div className="p-3 rounded bg-neutral-900/80 border border-neutral-800">
                  <div className="text-[11px] text-neutral-500">3. KEDA Scaler</div>
                  <div className="font-bold text-emerald-400 mt-1">Autoscaler Engine</div>
                  <div className="text-[10px] text-neutral-400 mt-1">Spawns up to {config.maxReplicas} GPU worker pods</div>
                </div>
                <div className="p-3 rounded bg-neutral-900/80 border border-neutral-800">
                  <div className="text-[11px] text-neutral-500">4. SLA Safety</div>
                  <div className="font-bold text-indigo-400 mt-1">PDB Guard</div>
                  <div className="text-[10px] text-neutral-400 mt-1">Guarantee {config.pdbMinAvailable} pod(s) never evicted</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* PILLAR 3: EXPERIMENTATION & ENGINE SWAPPING */}
        {/* ========================================================= */}
        {(activePillar === 'all' || activePillar === 'experimentation') && (
          <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 relative">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Shuffle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Pillar 3</div>
                  <h2 className="text-lg font-bold text-white">Experimentation Guarantee</h2>
                  <p className="text-xs text-neutral-400">
                    With a clean serving layer, you can swap inference engines (TensorRT vs. ONNX vs. vLLM) without breaking APIs
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 bg-indigo-950/30 border border-indigo-800/40 px-3 py-1.5 rounded-md text-xs font-mono text-indigo-300">
                <span>Contract: /v1/chat/completions</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Engine Switcher & Canary Control */}
              <div className="p-5 rounded-lg bg-neutral-950 border border-neutral-800 space-y-5">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    Decoupled Multi-Engine Control
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400">Zero Client Code Changes</span>
                </div>

                {/* Primary Engine */}
                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-2">
                    Primary Production Engine (Active Backend)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'vllm', name: 'vLLM', desc: 'PagedAttention & Prefix Caching' },
                      { id: 'tensorrt', name: 'TensorRT-LLM', desc: 'NVIDIA Hardware Accelerated' },
                      { id: 'onnx', name: 'ONNX Runtime GenAI', desc: 'Cross-platform low latency' },
                      { id: 'sglang', name: 'SGLang', desc: 'RadixAttention structured gen' }
                    ].map((engine) => (
                      <button
                        key={engine.id}
                        onClick={() => updateConfig({ primaryEngine: engine.id as any })}
                        className={`p-3 rounded-lg text-left transition-all border ${
                          config.primaryEngine === engine.id
                            ? 'bg-indigo-950/50 border-indigo-500 text-white'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-semibold flex items-center justify-between">
                          {engine.name}
                          {config.primaryEngine === engine.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-1">{engine.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Canary Engine */}
                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-2">
                    Canary A/B Experimentation Engine
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'none', label: 'None (100% Primary)' },
                      { id: 'tensorrt', label: 'TensorRT-LLM' },
                      { id: 'onnx', label: 'ONNX Runtime' },
                      { id: 'vllm', label: 'vLLM' }
                    ].map((canary) => (
                      <button
                        key={canary.id}
                        onClick={() => updateConfig({ canaryEngine: canary.id as any })}
                        className={`p-2 rounded text-xs font-medium transition-all border text-center ${
                          config.canaryEngine === canary.id
                            ? 'bg-indigo-950/50 border-indigo-500 text-white font-semibold'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {canary.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Canary Traffic Weight Slider */}
                {config.canaryEngine !== 'none' && (
                  <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-300">Canary Traffic Weight:</span>
                      <span className="font-mono text-indigo-400 font-bold">
                        {config.canaryTrafficWeight}% Canary ({config.canaryEngine}) / {100 - config.canaryTrafficWeight}% Primary ({config.primaryEngine})
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={config.canaryTrafficWeight}
                      onChange={(e) => updateConfig({ canaryTrafficWeight: Number(e.target.value) })}
                      className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                      <span>1% Canary (Safe Trial)</span>
                      <span>10% Canary</span>
                      <span>50% A/B Split</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Decoupled Routing Diagram */}
              <div className="p-5 rounded-lg bg-neutral-950 border border-neutral-800 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-white mb-1 flex items-center gap-2">
                    <Server className="w-4 h-4 text-indigo-400" />
                    Live Kubernetes Gateway API Routing Split
                  </div>
                  <p className="text-xs text-neutral-400 mb-4">
                    The Gateway API HTTPRoute maps upstream requests without touching client SDKs or DNS records.
                  </p>

                  {/* Visual traffic split */}
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white">
                        <Lock className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Client Endpoint:</span>
                      </div>
                      <span className="text-sky-400">POST /v1/chat/completions</span>
                    </div>

                    <div className="flex justify-center text-neutral-600">
                      ↓ <span className="text-[10px] px-2 text-neutral-500">Gateway API HTTPRoute Filter</span> ↓
                    </div>

                    <div className="space-y-2">
                      <div className="p-3 rounded bg-indigo-950/20 border border-indigo-800/40 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>Primary Backend: {config.primaryEngine.toUpperCase()}</span>
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-normal">Active</span>
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-0.5">{config.deploymentName}-svc:8000</div>
                        </div>
                        <div className="text-base font-bold text-indigo-400">
                          {config.canaryEngine !== 'none' ? 100 - config.canaryTrafficWeight : 100}%
                        </div>
                      </div>

                      {config.canaryEngine !== 'none' && (
                        <div className="p-3 rounded bg-purple-950/20 border border-purple-800/40 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>Canary Backend: {config.canaryEngine.toUpperCase()}</span>
                              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-normal">Canary</span>
                            </div>
                            <div className="text-[10px] text-neutral-400 mt-0.5">{config.canaryEngine}-inference-svc:8000</div>
                          </div>
                          <div className="text-base font-bold text-purple-400">
                            {config.canaryTrafficWeight}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-800/80 text-[11px] text-neutral-500 flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Configured in manifest: </span>
                  <span className="font-mono text-neutral-300">10-multi-engine-canary-route.yaml</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* PILLAR 4: RELIABILITY & MONITORING */}
        {/* ========================================================= */}
        {(activePillar === 'all' || activePillar === 'reliability') && (
          <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 relative">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pillar 4</div>
                  <h2 className="text-lg font-bold text-white">Reliability &amp; Day-2 Operations</h2>
                  <p className="text-xs text-neutral-400">
                    Clear separation makes debugging, monitoring, and compliance easier
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 bg-amber-950/30 border border-amber-800/40 px-3 py-1.5 rounded-md text-xs font-mono text-amber-300">
                <span>Prometheus + AlertManager</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Layer 1: Ingress & Security */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[10px] font-mono text-neutral-500 uppercase">Tier 1</div>
                <div className="text-xs font-bold text-white mt-1 mb-2">Ingress &amp; Security</div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Decoupled Gateway API handles TLS termination, CORS, rate limits, and Envoy WASM prompt injection screening before requests reach GPUs.
                </p>
                <div className="mt-3 text-[10px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                  08-gateway-api-and-wasm-security.yaml
                </div>
              </div>

              {/* Layer 2: Routing & Session */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[10px] font-mono text-neutral-500 uppercase">Tier 2</div>
                <div className="text-xs font-bold text-white mt-1 mb-2">Smart Router</div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Maintains affinity headers (<span className="font-mono text-neutral-300">{config.sessionAffinityHeader}</span>) to route multi-turn chats to warm KV cache replicas.
                </p>
                <div className="mt-3 text-[10px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                  05-vllm-smart-router.yaml
                </div>
              </div>

              {/* Layer 3: Compute Engine */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[10px] font-mono text-neutral-500 uppercase">Tier 3</div>
                <div className="text-xs font-bold text-white mt-1 mb-2">Inference Pods</div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Stateless GPU workers with `/dev/shm` IPC volumes, pinned CUDA drivers, and readiness probes on `/v1/models` (verifying weight loading).
                </p>
                <div className="mt-3 text-[10px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                  03-vllm-deployment.yaml
                </div>
              </div>

              {/* Layer 4: Observability & SLA */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[10px] font-mono text-neutral-500 uppercase">Tier 4</div>
                <div className="text-xs font-bold text-white mt-1 mb-2">SLA Rules &amp; Metrics</div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Native Prometheus `ServiceMonitor` pulls 15s metrics. Fires `LLMQueueBacklogHigh` and `LLMGpuCacheNearExhaustion` alerts automatically.
                </p>
                <div className="mt-3 text-[10px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                  11-observability-alerts-sla.yaml
                </div>
              </div>
            </div>

            {/* SLA Alert Configuration Bar */}
            <div className="p-5 rounded-lg bg-neutral-950 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  SLA Alert Threshold Configuration
                </div>
                <div className="text-xs text-neutral-400">
                  Defines PrometheusRule alert trigger when vLLM request backlog exceeds threshold for {'>'} 2 minutes.
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">Backlog Threshold:</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={config.alertQueueBacklogThreshold}
                    onChange={(e) => updateConfig({ alertQueueBacklogThreshold: Number(e.target.value) })}
                    className="w-20 bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-xs font-mono text-white text-right"
                  />
                  <span className="text-xs text-neutral-500">reqs</span>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enableServiceMonitor}
                    onChange={(e) => updateConfig({ enableServiceMonitor: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
