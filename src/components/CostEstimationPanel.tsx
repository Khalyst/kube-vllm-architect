import React, { useState } from 'react';
import { AppConfig, GpuSpec, VramCalculationResult } from '../types';
import { calculateCostEstimation } from '../utils/calculator';
import { GPU_SPECS } from '../data/gpus';
import { DollarSign, TrendingDown, Clock, Zap, Cloud, ShieldCheck, Sparkles, Check } from 'lucide-react';

interface Props {
  config: AppConfig;
  vram: VramCalculationResult;
  updateConfig: (patch: Partial<AppConfig>) => void;
}

export const CostEstimationPanel: React.FC<Props> = ({
  config,
  vram,
  updateConfig
}) => {
  const selectedGpu: GpuSpec = GPU_SPECS.find((g) => g.id === config.selectedGpuId) || GPU_SPECS[0];

  // Provider state (defaults to config cloudPlatform or 'aws')
  const defaultProvider = config.cloudPlatform === 'gcp' ? 'gcp' : config.cloudPlatform === 'azure' ? 'azure' : 'aws';
  const [activeProvider, setActiveProvider] = useState<'aws' | 'gcp' | 'azure'>(defaultProvider);
  const [pricingTier, setPricingTier] = useState<'onDemand' | 'spot' | 'reserved1yr'>('onDemand');

  // Duty cycle / average active replicas state
  // Default: if autoscaling enabled and minReplicas=0, default average is ~1.5 or max(1, maxReplicas * 0.3)
  const initialAvg = config.enableAutoscaling
    ? Math.max(config.minReplicas, Math.round(((config.minReplicas + config.maxReplicas) / 2) * 10) / 10)
    : 1;

  const [averageReplicas, setAverageReplicas] = useState<number>(initialAvg);
  const [dutyPreset, setDutyPreset] = useState<'bursty' | 'business' | 'continuous' | 'custom'>('business');

  const handleDutyPreset = (preset: 'bursty' | 'business' | 'continuous') => {
    setDutyPreset(preset);
    if (preset === 'bursty') {
      // 20% active time
      const avg = Math.max(config.minReplicas, Math.round((config.minReplicas + (config.maxReplicas - config.minReplicas) * 0.2) * 10) / 10);
      setAverageReplicas(avg || 0.5);
    } else if (preset === 'business') {
      // 40% active time
      const avg = Math.max(config.minReplicas, Math.round((config.minReplicas + (config.maxReplicas - config.minReplicas) * 0.45) * 10) / 10);
      setAverageReplicas(avg || 1);
    } else if (preset === 'continuous') {
      // 100% active at maxReplicas
      setAverageReplicas(config.maxReplicas);
    }
  };

  const costResult = calculateCostEstimation(
    config,
    selectedGpu,
    activeProvider,
    pricingTier,
    averageReplicas,
    vram.tokensPerSecEstimate
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: val < 10 ? 2 : 0
    }).format(val);
  };

  const providers = [
    { id: 'aws' as const, name: 'AWS EC2', instance: selectedGpu.awsInstance },
    { id: 'gcp' as const, name: 'Google Cloud (GCP)', instance: selectedGpu.gcpInstance },
    { id: 'azure' as const, name: 'Microsoft Azure', instance: selectedGpu.azureInstance }
  ];

  const tiers = [
    { id: 'onDemand' as const, label: 'On-Demand', desc: 'Pay-as-you-go hourly flexibility' },
    { id: 'spot' as const, label: 'Spot / Preemptible', desc: 'Up to 60-70% savings with Karpenter/GKE' },
    { id: 'reserved1yr' as const, label: '1-Year Reserved / CUD', desc: '35-40% discount for steady workloads' }
  ];

  return (
    <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/50 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">4. Cloud Cost Estimation & Infrastructure TCO</h3>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real-time monthly cloud spend modeling across AWS, GCP, and Azure based on tensor parallelism and KEDA autoscaling.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-neutral-400">Total Pod Hardware:</span>
          <span className="text-emerald-400 font-semibold">
            {costResult.gpusPerReplica}x {selectedGpu.name}
          </span>
        </div>
      </div>

      {/* Provider & Pricing Tier Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cloud Provider Picker */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Cloud Provider Pricing Model
          </label>
          <div className="grid grid-cols-3 gap-2">
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActiveProvider(p.id);
                  updateConfig({ cloudPlatform: p.id });
                }}
                className={`p-2.5 rounded text-left border transition-colors ${
                  activeProvider === p.id
                    ? 'border-emerald-500 bg-emerald-950/20 text-white'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <div className="text-xs font-semibold">{p.name}</div>
                <div className="text-[10px] text-neutral-400 truncate mt-0.5">{p.instance}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Pricing Commitment Tier */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Pricing Commitment Tier
          </label>
          <div className="grid grid-cols-3 gap-2">
            {tiers.map((t) => (
              <button
                key={t.id}
                onClick={() => setPricingTier(t.id)}
                className={`p-2.5 rounded text-left border transition-colors ${
                  pricingTier === t.id
                    ? 'border-emerald-500 bg-emerald-950/20 text-white'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <div className="text-xs font-semibold">{t.label}</div>
                <div className="text-[10px] text-neutral-400 truncate mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Workload Profile & Autoscaling Duty Cycle */}
      <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-semibold text-neutral-200">Workload Profile & Autoscaling Duty Cycle</span>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Simulate actual monthly bill based on fluctuating request traffic and KEDA scale-down behavior.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded">
            <button
              onClick={() => handleDutyPreset('bursty')}
              className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                dutyPreset === 'bursty' ? 'bg-emerald-600 text-white font-medium' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Scale-to-Zero (~20%)
            </button>
            <button
              onClick={() => handleDutyPreset('business')}
              className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                dutyPreset === 'business' ? 'bg-emerald-600 text-white font-medium' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Business Hours (~45%)
            </button>
            <button
              onClick={() => handleDutyPreset('continuous')}
              className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                dutyPreset === 'continuous' ? 'bg-emerald-600 text-white font-medium' : 'text-neutral-400 hover:text-white'
              }`}
            >
              24/7 Peak (100%)
            </button>
          </div>
        </div>

        {/* Average Active Replicas Slider */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-neutral-400">Simulated Average Active Replicas:</span>
            <span className="font-mono text-emerald-400 font-semibold tabular-nums">
              {averageReplicas} {averageReplicas === 1 ? 'Replica' : 'Replicas'} (Min: {config.minReplicas}, Max: {config.maxReplicas})
            </span>
          </div>
          <input
            type="range"
            min={config.minReplicas}
            max={config.maxReplicas}
            step="0.5"
            value={averageReplicas}
            onChange={(e) => {
              setAverageReplicas(Number(e.target.value));
              setDutyPreset('custom');
            }}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-1">
            <span>Scale-to-Zero ({config.minReplicas} pods)</span>
            <span>Peak Capacity ({config.maxReplicas} pods)</span>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Estimated Monthly Spend */}
        <div className="p-4 rounded-lg bg-neutral-950 border border-emerald-900/50 bg-emerald-950/10 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono flex items-center justify-between">
            <span>Est. Monthly Spend</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {formatCurrency(costResult.monthlyEstimatedWithAutoscaling)}
            <span className="text-xs text-neutral-400 font-normal"> / mo</span>
          </div>
          <div className="text-[11px] text-neutral-400 font-mono tabular-nums pt-1">
            ~{formatCurrency(costResult.monthlyEstimatedWithAutoscaling / 30.4)} / day · {averageReplicas} avg pods
          </div>
        </div>

        {/* Hourly Cost per Pod */}
        <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono flex items-center justify-between">
            <span>Hourly Cost / Pod</span>
            <Clock className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {formatCurrency(costResult.hourlyPerReplica)}
            <span className="text-xs text-neutral-400 font-normal"> / hr</span>
          </div>
          <div className="text-[11px] text-neutral-400 font-mono tabular-nums pt-1">
            {costResult.gpusPerReplica}x GPU @ {formatCurrency(costResult.hourlyPerGpu)}/hr
          </div>
        </div>

        {/* Monthly Savings vs Static Peak */}
        <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono flex items-center justify-between">
            <span>KEDA Autoscaling Savings</span>
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
            {costResult.monthlySavingsVsStaticPeak > 0 ? `-${formatCurrency(costResult.monthlySavingsVsStaticPeak)}` : '$0'}
            <span className="text-xs text-neutral-400 font-normal"> / mo</span>
          </div>
          <div className="text-[11px] text-neutral-400 font-mono tabular-nums pt-1">
            vs 24/7 static peak on-demand
          </div>
        </div>

        {/* Cost per 1M Tokens */}
        <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono flex items-center justify-between">
            <span>Unit Economics</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-sky-300 font-mono tabular-nums">
            {costResult.costPerMillionTokens > 0 ? formatCurrency(costResult.costPerMillionTokens) : '$0.00'}
            <span className="text-xs text-neutral-400 font-normal"> / 1M tok</span>
          </div>
          <div className="text-[11px] text-neutral-400 font-mono tabular-nums pt-1">
            @ ~{vram.tokensPerSecEstimate} tok/s pod throughput
          </div>
        </div>
      </div>

      {/* Cross-Cloud Comparison Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-neutral-200">
            Multi-Cloud Cost Comparison Matrix ({costResult.gpusPerReplica}x {selectedGpu.name} per Replica)
          </span>
          <span className="text-neutral-500 text-[11px] font-mono">Baseline 730 hours/month</span>
        </div>

        <div className="overflow-x-auto border border-neutral-800 rounded-lg">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800 text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Cloud Provider</th>
                <th className="py-2.5 px-3">Instance Shape</th>
                <th className="py-2.5 px-3 text-right">Hourly / GPU</th>
                <th className="py-2.5 px-3 text-right">Hourly / Pod</th>
                <th className="py-2.5 px-3 text-right">Spot (Mo)</th>
                <th className="py-2.5 px-3 text-right">On-Demand (Mo)</th>
                <th className="py-2.5 px-3 text-right">1-Yr CUD (Mo)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 bg-neutral-950/40 text-neutral-200">
              {providers.map((p) => {
                const pricing = selectedGpu.hourlyPrice[p.id];
                const podHourlyOnDemand = pricing.onDemand * costResult.gpusPerReplica;
                const podHourlySpot = pricing.spot * costResult.gpusPerReplica;
                const podHourly1yr = pricing.reserved1yr * costResult.gpusPerReplica;
                const isSelected = activeProvider === p.id;

                return (
                  <tr
                    key={p.id}
                    onClick={() => {
                      setActiveProvider(p.id);
                      updateConfig({ cloudPlatform: p.id });
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-950/20 text-white font-medium' : 'hover:bg-neutral-900/60'
                    }`}
                  >
                    <td className="py-2.5 px-3 flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
                      <span>{p.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-400 text-[11px] truncate max-w-[180px]">
                      {p.instance}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-neutral-300">
                      ${pricing.onDemand.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-white">
                      ${podHourlyOnDemand.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-400">
                      {formatCurrency(podHourlySpot * 730 * (averageReplicas || 1))}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-neutral-200">
                      {formatCurrency(podHourlyOnDemand * 730 * (averageReplicas || 1))}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-sky-400">
                      {formatCurrency(podHourly1yr * 730 * (averageReplicas || 1))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost Architecture Insights Callout */}
      <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="space-y-1">
          <span className="font-semibold text-neutral-200 flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            Scale-to-Zero Economy
          </span>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            With KEDA set to <code className="text-neutral-300">minReplicas: 0</code>, idle hours incur $0 compute charges. Pods spin up in ~45s upon incoming traffic.
          </p>
        </div>

        <div className="space-y-1">
          <span className="font-semibold text-neutral-200 flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            Spot & Preemptible Arbitrage
          </span>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Karpenter on AWS or GKE Spot node pools save up to 65% on GPU compute costs while stateless router proxies absorb interruptions.
          </p>
        </div>

        <div className="space-y-1">
          <span className="font-semibold text-neutral-200 flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            KV Cache Prefix Compounding
          </span>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Reusing prefill KV context in vLLM doubles token generation throughput, effectively cutting your cost per 1M generated tokens by 50%.
          </p>
        </div>
      </div>
    </div>
  );
};
