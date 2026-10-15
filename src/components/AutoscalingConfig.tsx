import React from 'react';
import { AppConfig, CloudPlatform } from '../types';
import { Activity, ArrowDownUp, Cloud, Cpu, DollarSign, Gauge, ShieldAlert } from 'lucide-react';

interface Props {
  config: AppConfig;
  updateConfig: (patch: Partial<AppConfig>) => void;
}

export const AutoscalingConfig: React.FC<Props> = ({ config, updateConfig }) => {
  const cloudPlatforms: { id: CloudPlatform; name: string; desc: string }[] = [
    { id: 'aws', name: 'AWS EKS + Karpenter', desc: 'Karpenter just-in-time GPU EC2 node provisioning (Spot & On-Demand)' },
    { id: 'gcp', name: 'Google Cloud GKE', desc: 'GKE Standard/Autopilot GPU node pools with image streaming' },
    { id: 'azure', name: 'Microsoft Azure AKS', desc: 'AKS GPU node pools with cluster autoscaler' },
    { id: 'baremetal', name: 'Bare-Metal / On-Prem', desc: 'NVIDIA GPU Operator on private Kubernetes clusters' }
  ];

  return (
    <div className="space-y-6">
      {/* Section 1: Autoscaler Type & Scaling Bounds */}
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/50 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div>
            <h3 className="text-sm font-semibold text-white">1. Automatic Autoscaling Engine</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Event-driven scaling dynamically adjusts GPU replica count based on real-time inference queue depth and KV cache saturation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">Scale-to-Zero:</span>
            <span className={`text-xs font-mono font-semibold ${config.minReplicas === 0 ? 'text-emerald-400' : 'text-neutral-500'}`}>
              {config.minReplicas === 0 ? 'ENABLED ($0 Idle)' : 'DISABLED (Min 1)'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Autoscaler Framework
            </label>
            <div className="flex items-center gap-2 p-1 bg-neutral-950 border border-neutral-800 rounded">
              <button
                onClick={() => updateConfig({ autoscalerType: 'keda' })}
                className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                  config.autoscalerType === 'keda'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                KEDA (Prometheus Event-Driven)
              </button>
              <button
                onClick={() => updateConfig({ autoscalerType: 'hpa', minReplicas: Math.max(1, config.minReplicas) })}
                className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                  config.autoscalerType === 'hpa'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Standard HPA (Memory/CPU)
              </button>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              {config.autoscalerType === 'keda'
                ? 'Recommended: Direct Prometheus metrics hook querying waiting queue depth and KV cache fullness.'
                : 'Native Kubernetes HPA scales on memory/CPU. Cannot scale to zero or inspect vLLM queue state.'}
            </p>
          </div>

          {/* Replica Count Bounds */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Min Replicas
              </label>
              <select
                value={config.minReplicas}
                onChange={(e) => updateConfig({ minReplicas: Number(e.target.value) })}
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              >
                <option value="0">0 (Scale-to-Zero Idle)</option>
                <option value="1">1 (Warm Standby)</option>
                <option value="2">2 (High Availability)</option>
                <option value="4">4 (Enterprise Baseline)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Max Replicas
              </label>
              <select
                value={config.maxReplicas}
                onChange={(e) => updateConfig({ maxReplicas: Number(e.target.value) })}
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              >
                <option value="2">2 Replicas</option>
                <option value="5">5 Replicas</option>
                <option value="10">10 Replicas</option>
                <option value="20">20 Replicas</option>
                <option value="32">32 Replicas</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: KEDA Prometheus Metrics Trigger Rules */}
      {config.autoscalerType === 'keda' && (
        <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/50 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h3 className="text-sm font-semibold text-white">2. KEDA Prometheus Trigger Thresholds</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                vLLM native metrics polled from the in-cluster Prometheus server.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400">Targeting :8000/metrics</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Queue Depth Threshold */}
            <div className="p-3 rounded bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-200">Request Queue Backlog</span>
                <span className="font-mono text-sky-400">&gt; {config.kedaQueueThreshold} requests</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={config.kedaQueueThreshold}
                onChange={(e) => updateConfig({ kedaQueueThreshold: Number(e.target.value) })}
                className="w-full accent-sky-500"
              />
              <div className="text-[10px] text-neutral-400 font-mono">
                Metric: vllm:num_requests_waiting
              </div>
              <p className="text-[10px] text-neutral-400">
                Triggers scale-up when requests back up waiting in the scheduler.
              </p>
            </div>

            {/* KV Cache Saturation Factor */}
            <div className="p-3 rounded bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-200">KV Cache Saturation</span>
                <span className="font-mono text-emerald-400">&gt; {Math.round(config.kedaCacheUsageThreshold * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={config.kedaCacheUsageThreshold}
                onChange={(e) => updateConfig({ kedaCacheUsageThreshold: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
              <div className="text-[10px] text-neutral-400 font-mono">
                Metric: vllm:gpu_cache_usage_factor
              </div>
              <p className="text-[10px] text-neutral-400">
                Spawns new replicas before VRAM KV blocks are completely exhausted.
              </p>
            </div>

            {/* Cooldown Period */}
            <div className="p-3 rounded bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-200">Scale-Down Cooldown</span>
                <span className="font-mono text-amber-400">{config.kedaCooldownPeriod} seconds ({Math.round(config.kedaCooldownPeriod / 60)} min)</span>
              </div>
              <select
                value={config.kedaCooldownPeriod}
                onChange={(e) => updateConfig({ kedaCooldownPeriod: Number(e.target.value) })}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
              >
                <option value="120">120s (2 min - Aggressive)</option>
                <option value="300">300s (5 min - Recommended for GPUs)</option>
                <option value="600">600s (10 min - Conservative)</option>
              </select>
              <div className="text-[10px] text-neutral-400 font-mono">
                Stabilization Window
              </div>
              <p className="text-[10px] text-neutral-400">
                Prevents rapid pod spin-down thrashing while weights are loaded in GPU memory.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Cloud GPU Node Pool & Cluster Provisioning */}
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/50 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div>
            <h3 className="text-sm font-semibold text-white">3. Cloud Infrastructure & Node Provisioner</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Generates cloud-native manifest specs for Karpenter, GKE node autoscaler, or NVIDIA GPU Operator.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {cloudPlatforms.map((cp) => (
            <button
              key={cp.id}
              onClick={() => updateConfig({ cloudPlatform: cp.id })}
              className={`p-3 rounded text-left border transition-colors ${
                config.cloudPlatform === cp.id
                  ? 'border-sky-500 bg-sky-950/20 text-white'
                  : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
              }`}
            >
              <div className="text-xs font-semibold">{cp.name}</div>
              <div className="text-[10px] text-neutral-400 mt-1">{cp.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
