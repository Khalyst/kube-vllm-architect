import React, { useState } from 'react';
import { AppConfig, ModelPreset } from '../types';
import { GPU_SPECS } from '../data/gpus';
import { Play, RotateCcw, Zap, AlertTriangle, CheckCircle2, Cpu, HardDrive, Network, Server } from 'lucide-react';

interface Props {
  config: AppConfig;
  preset: ModelPreset;
  updateConfig: (patch: Partial<AppConfig>) => void;
}

interface SimulatedRequest {
  id: number;
  promptType: string;
  prefixHash: string;
  assignedReplica: number;
  isCacheHit: boolean;
  prefillLatencyMs: number;
  wastedCompute: boolean;
}

export const ArchitectureVisualizer: React.FC<Props> = ({
  config,
  preset,
  updateConfig
}) => {
  const gpu = GPU_SPECS.find((g) => g.id === config.selectedGpuId) || GPU_SPECS[0];
  const [activeSimulation, setActiveSimulation] = useState<SimulatedRequest[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStats, setSimulationStats] = useState({
    totalRequests: 0,
    cacheHits: 0,
    wastedMatrixMults: 0,
    avgLatencyMs: 0
  });

  const replicaCount = Math.max(2, Math.min(4, config.minReplicas || 2));

  // Run simulation comparing Dumb vs Smart Routing
  const runSimulation = () => {
    setIsSimulating(true);

    const prompts = [
      { type: 'Legal Contract Review v2', hash: 'hash_legal_doc_01' },
      { type: 'Legal Contract Follow-up', hash: 'hash_legal_doc_01' }, // Same prefix!
      { type: 'Coding Agent Tool Context', hash: 'hash_code_prompt_88' },
      { type: 'Legal Contract Summary', hash: 'hash_legal_doc_01' }, // Same prefix!
      { type: 'Coding Agent Debug Turn', hash: 'hash_code_prompt_88' }, // Same prefix!
      { type: 'General Math Question', hash: 'hash_generic_99' }
    ];

    const results: SimulatedRequest[] = [];
    const replicaCacheState: Record<number, Set<string>> = { 0: new Set(), 1: new Set(), 2: new Set(), 3: new Set() };

    let hits = 0;
    let wasted = 0;
    let totalLatency = 0;

    prompts.forEach((p, idx) => {
      let targetReplica = 0;

      if (config.routingStrategy === 'smart_prefix') {
        // Smart routing: Consistent hash on prefix sends identical prefixes to the exact same replica!
        const charCodeSum = p.hash.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        targetReplica = charCodeSum % replicaCount;
      } else {
        // Dumb routing: Round robin or random
        targetReplica = idx % replicaCount;
      }

      const hasCache = replicaCacheState[targetReplica].has(p.hash);
      const isCacheHit = config.enablePrefixCaching && hasCache;

      if (isCacheHit) {
        hits++;
      } else {
        if (!hasCache && prompts.slice(0, idx).some((prev) => prev.hash === p.hash)) {
          // Re-computed something that was already computed on another pod = Compute waste!
          wasted++;
        }
        replicaCacheState[targetReplica].add(p.hash);
      }

      const latency = isCacheHit ? 35 : 420;
      totalLatency += latency;

      results.push({
        id: idx + 1,
        promptType: p.type,
        prefixHash: p.hash,
        assignedReplica: targetReplica,
        isCacheHit,
        prefillLatencyMs: latency,
        wastedCompute: !isCacheHit && prompts.slice(0, idx).some((prev) => prev.hash === p.hash)
      });
    });

    setActiveSimulation(results);
    setSimulationStats({
      totalRequests: prompts.length,
      cacheHits: hits,
      wastedMatrixMults: wasted,
      avgLatencyMs: Math.round(totalLatency / prompts.length)
    });

    setTimeout(() => {
      setIsSimulating(false);
    }, 400);
  };

  const resetSimulation = () => {
    setActiveSimulation([]);
    setSimulationStats({
      totalRequests: 0,
      cacheHits: 0,
      wastedMatrixMults: 0,
      avgLatencyMs: 0
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Architecture Context */}
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Production Serving on Kubernetes & KV Cache Routing
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Stateful LLM workloads on GPU nodes with automatic KEDA scaling and prefix-aware API gateway routing.
            </p>
          </div>

          {/* Interactive Routing Mode Selector */}
          <div className="flex items-center gap-2 p-1 bg-neutral-950 border border-neutral-800 rounded-md shrink-0">
            <button
              onClick={() => {
                updateConfig({
                  routingStrategy: 'smart_prefix',
                  enablePrefixCaching: true
                });
                resetSimulation();
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                config.routingStrategy === 'smart_prefix'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Smart Routing (Prefix Cache Affinity)
            </button>
            <button
              onClick={() => {
                updateConfig({
                  routingStrategy: 'dumb_round_robin'
                });
                resetSimulation();
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                config.routingStrategy === 'dumb_round_robin'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Dumb Routing (Round Robin)
            </button>
          </div>
        </div>

        {/* Live Simulation Controls & Metrics Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={runSimulation}
              disabled={isSimulating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Simulate Traffic Batch (6 Prompts)
            </button>
            {activeSimulation.length > 0 && (
              <button
                onClick={resetSimulation}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>

          {activeSimulation.length > 0 && (
            <div className="flex items-center gap-6 text-xs font-mono tabular-nums">
              <div>
                <span className="text-neutral-500">KV Cache Hits: </span>
                <span className={simulationStats.cacheHits > 0 ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}>
                  {simulationStats.cacheHits} / {simulationStats.totalRequests} (
                  {Math.round((simulationStats.cacheHits / simulationStats.totalRequests) * 100)}%)
                </span>
              </div>
              <div>
                <span className="text-neutral-500">Wasted Matrix Mults: </span>
                <span className={simulationStats.wastedMatrixMults > 0 ? 'text-red-400 font-semibold' : 'text-emerald-400'}>
                  {simulationStats.wastedMatrixMults} calls
                </span>
              </div>
              <div>
                <span className="text-neutral-500">Avg TTFT: </span>
                <span className="text-sky-300 font-semibold">{simulationStats.avgLatencyMs} ms</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Primary Visual Topology Diagram */}
      <div className="border border-neutral-800 rounded-lg p-6 bg-neutral-950 space-y-8">
        {/* Layer 1: Incoming Traffic */}
        <div className="text-center">
          <span className="text-xs uppercase tracking-wider text-neutral-500 font-mono">
            Client Requests (HTTP / OpenAI-Compatible API)
          </span>
          <div className="flex justify-center items-center gap-3 mt-3">
            <div className="px-4 py-2 rounded border border-neutral-700 bg-neutral-900 text-neutral-200 text-xs font-mono flex items-center gap-2">
              <Network className="w-3.5 h-3.5 text-sky-400" />
              POST /v1/chat/completions (Prompt + Context)
            </div>
          </div>
          <div className="w-0.5 h-6 bg-sky-500/40 mx-auto my-2" />
        </div>

        {/* Layer 2: API Gateway / vLLM Router */}
        <div className="max-w-2xl mx-auto border border-sky-900/60 bg-sky-950/20 rounded-lg p-4">
          <div className="flex items-center justify-between pb-2 border-b border-sky-800/40">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold text-sky-200 uppercase tracking-wide">
                API Gateway / vLLM Router (Layer 7 Proxy)
              </span>
            </div>
            <span className="text-[11px] font-mono text-sky-300">
              {config.routingStrategy === 'smart_prefix' ? 'Prefix Hash Affinity: Active' : 'Round Robin: Active'}
            </span>
          </div>

          <p className="text-xs text-neutral-300 mt-2">
            {config.routingStrategy === 'smart_prefix'
              ? 'Hashes prompt prefix tokens or conversation session headers. Routes identical prefixes to the replica holding the pre-computed KV cache context.'
              : 'Distributes incoming requests uniformly across pods regardless of stored context. Often forces GPUs to re-evaluate the exact same prompt prefix.'}
          </p>
        </div>

        {/* Dynamic Traffic Distribution Connectors */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: replicaCount }).map((_, rIdx) => {
            const requestsForReplica = activeSimulation.filter((r) => r.assignedReplica === rIdx);
            const hasWasted = requestsForReplica.some((r) => r.wastedCompute);
            const hasHits = requestsForReplica.some((r) => r.isCacheHit);

            return (
              <div
                key={rIdx}
                className={`border rounded-lg p-4 transition-all ${
                  hasWasted
                    ? 'border-red-900/60 bg-red-950/10'
                    : hasHits
                    ? 'border-emerald-800/60 bg-emerald-950/10'
                    : 'border-neutral-800 bg-neutral-900/50'
                }`}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    <Cpu className="w-3.5 h-3.5 text-sky-400" />
                    <span>GPU Node Replica #{rIdx + 1}</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Pod: vllm-worker-{rIdx}
                  </span>
                </div>

                {/* Node Internal Pipeline */}
                <div className="mt-3 space-y-2 text-xs">
                  {/* Model & Engine */}
                  <div className="p-2 rounded bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-neutral-200">{preset.name}</div>
                      <div className="text-[10px] text-neutral-400">TP={config.tensorParallelSize} · {config.precision.toUpperCase()}</div>
                    </div>
                    <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
                  </div>

                  {/* Physical Hardware */}
                  <div className="p-2 rounded bg-neutral-950 border border-neutral-800 flex items-center justify-between text-[11px] text-neutral-300">
                    <span>{config.tensorParallelSize}x {gpu.name}</span>
                    <span className="font-mono text-sky-400">{gpu.vramGB * config.tensorParallelSize} GB VRAM</span>
                  </div>

                  {/* KV Cache Status */}
                  <div className="p-2 rounded border border-neutral-800 bg-neutral-900/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-400">KV Cache Status:</span>
                      <span className="font-mono text-xs text-neutral-200">
                        {config.enablePrefixCaching ? 'Prefix Caching ON' : 'Disabled'}
                      </span>
                    </div>

                    {requestsForReplica.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-neutral-800 space-y-1">
                        {requestsForReplica.map((req) => (
                          <div
                            key={req.id}
                            className={`flex items-center justify-between text-[10px] p-1 rounded font-mono ${
                              req.isCacheHit
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                                : req.wastedCompute
                                ? 'bg-red-950/60 text-red-300 border border-red-800/40'
                                : 'bg-neutral-800 text-neutral-300'
                            }`}
                          >
                            <span className="truncate max-w-[120px]">{req.promptType}</span>
                            <span>{req.isCacheHit ? 'KV HIT (35ms)' : req.wastedCompute ? 'WASTE MULT (420ms)' : 'MISS (420ms)'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Explanatory Contrast Section (Directly from User's Diagram) */}
        <div className="pt-4 border-t border-neutral-800 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Dumb Routing Breakdown */}
          <div className="border border-neutral-800 rounded p-4 bg-neutral-900/30">
            <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Dumb Routing Mechanics (Without Cache Affinity)</span>
            </div>
            <p className="text-neutral-400 leading-relaxed">
              Rebuilding context is computationally expensive. When round-robin routing sends follow-up requests to random replicas, the GPU lacks the stored KV cache and repeats identical matrix multiplications (prefill phase). This saturates Tensor Cores and causes high Time-to-First-Token (TTFT) latency.
            </p>
          </div>

          {/* Smart Routing Breakdown */}
          <div className="border border-emerald-900/40 rounded p-4 bg-emerald-950/10">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Smart Routing Mechanics (Prefix & KV Affinity)</span>
            </div>
            <p className="text-neutral-300 leading-relaxed">
              With consistent prefix hashing at the API Gateway combined with vLLM <code className="text-sky-300">--enable-prefix-caching</code>, requests with shared prompts (system instructions, long docs, multi-turn dialogues) land on the replica with the warmed KV cache. Bypasses redundant matrix multiplication, offering up to 80% lower latency and 3x higher throughput.
            </p>
          </div>
        </div>
      </div>

      {/* Required Kubernetes Serving Stack Prereqs (From User Diagram) */}
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/40">
        <h3 className="text-sm font-semibold text-white mb-3">
          Required Kubernetes Components for vLLM Serving Stack
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-neutral-950 border border-neutral-800 rounded">
            <div className="font-semibold text-neutral-200">1. NVIDIA GPU Operator</div>
            <p className="text-neutral-400 mt-1">
              Automates driver installation, container toolkit, and device plugin (<code className="text-neutral-300">nvidia.com/gpu</code> resource limits).
            </p>
          </div>
          <div className="p-3 bg-neutral-950 border border-neutral-800 rounded">
            <div className="font-semibold text-neutral-200">2. IPC Memory (/dev/shm)</div>
            <p className="text-neutral-400 mt-1">
              PyTorch multi-GPU NCCL tensor parallelism requires an emptyDir volume mounted at <code className="text-neutral-300">/dev/shm</code> with RAM medium to prevent bus errors.
            </p>
          </div>
          <div className="p-3 bg-neutral-950 border border-neutral-800 rounded">
            <div className="font-semibold text-neutral-200">3. KEDA Prometheus Metrics</div>
            <p className="text-neutral-400 mt-1">
              vLLM exports <code className="text-neutral-300">vllm:num_requests_waiting</code> and <code className="text-neutral-300">vllm:gpu_cache_usage_factor</code> at <code className="text-neutral-300">:8000/metrics</code> for dynamic autoscaling.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
