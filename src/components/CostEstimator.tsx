import React, { useState, useMemo } from 'react';
import { GPU_SPECS } from '../data/gpus';
import { GpuSpec } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  DollarSign,
  TrendingDown,
  Clock,
  Zap,
  Server,
  Layers,
  Sparkles,
  Check,
  ArrowRight,
  Copy,
  CheckCircle2,
  Sliders,
  Cpu
} from 'lucide-react';

export interface CostEstimatorProps {
  selectedGpuId?: string;
  gpuCountPerReplica?: number;
  replicaCount?: number;
  onGpuChange?: (gpuId: string) => void;
  onReplicaChange?: (replicas: number) => void;
  onGpuCountChange?: (gpusPerReplica: number) => void;
}

export const CostEstimator: React.FC<CostEstimatorProps> = ({
  selectedGpuId: propGpuId,
  gpuCountPerReplica: propGpuCount,
  replicaCount: propReplicas,
  onGpuChange,
  onReplicaChange,
  onGpuCountChange
}) => {
  // State with props fallback
  const [selectedGpuId, setSelectedGpuId] = useState<string>(
    propGpuId || 'nvidia-h100-sxm5-80gb'
  );
  const [replicas, setReplicas] = useState<number>(propReplicas || 2);
  const [gpusPerReplica, setGpusPerReplica] = useState<number>(propGpuCount || 2);
  const [timeHorizon, setTimeHorizon] = useState<'hourly' | 'daily' | 'monthly'>('hourly');
  const [selectedTier, setSelectedTier] = useState<'onDemand' | 'spot' | 'reserved1yr'>('onDemand');
  const [copied, setCopied] = useState<boolean>(false);

  // Sync state if props change
  React.useEffect(() => {
    if (propGpuId && propGpuId !== selectedGpuId) setSelectedGpuId(propGpuId);
  }, [propGpuId]);

  React.useEffect(() => {
    if (propReplicas && propReplicas !== replicas) setReplicas(propReplicas);
  }, [propReplicas]);

  React.useEffect(() => {
    if (propGpuCount && propGpuCount !== gpusPerReplica) setGpusPerReplica(propGpuCount);
  }, [propGpuCount]);

  const selectedGpu: GpuSpec = useMemo(() => {
    return GPU_SPECS.find((g) => g.id === selectedGpuId) || GPU_SPECS[0];
  }, [selectedGpuId]);

  const totalGpus = replicas * gpusPerReplica;

  // Time multiplier: 1 hr, 24 hrs, 730 hrs
  const timeMultiplier = timeHorizon === 'hourly' ? 1 : timeHorizon === 'daily' ? 24 : 730;
  const timeLabel = timeHorizon === 'hourly' ? '/hr' : timeHorizon === 'daily' ? '/day' : '/mo';

  // Providers data
  const providers = useMemo(() => {
    const awsPrices = selectedGpu.hourlyPrice.aws;
    const gcpPrices = selectedGpu.hourlyPrice.gcp;
    const azurePrices = selectedGpu.hourlyPrice.azure;

    return [
      {
        id: 'aws' as const,
        name: 'Amazon Web Services (AWS)',
        shortName: 'AWS EC2',
        instance: selectedGpu.awsInstance,
        hourlyGpu: awsPrices.onDemand,
        spotGpu: awsPrices.spot,
        reservedGpu: awsPrices.reserved1yr,
        hourlyCluster: awsPrices.onDemand * totalGpus,
        spotCluster: awsPrices.spot * totalGpus,
        reservedCluster: awsPrices.reserved1yr * totalGpus,
        spotSavingsPct: Math.round(((awsPrices.onDemand - awsPrices.spot) / awsPrices.onDemand) * 100),
        color: '#f59e0b' // Amber/orange for AWS
      },
      {
        id: 'gcp' as const,
        name: 'Google Cloud Platform (GCP)',
        shortName: 'GCP Compute',
        instance: selectedGpu.gcpInstance,
        hourlyGpu: gcpPrices.onDemand,
        spotGpu: gcpPrices.spot,
        reservedGpu: gcpPrices.reserved1yr,
        hourlyCluster: gcpPrices.onDemand * totalGpus,
        spotCluster: gcpPrices.spot * totalGpus,
        reservedCluster: gcpPrices.reserved1yr * totalGpus,
        spotSavingsPct: Math.round(((gcpPrices.onDemand - gcpPrices.spot) / gcpPrices.onDemand) * 100),
        color: '#0ea5e9' // Sky blue for GCP
      },
      {
        id: 'azure' as const,
        name: 'Microsoft Azure',
        shortName: 'Azure Virtual Machines',
        instance: selectedGpu.azureInstance,
        hourlyGpu: azurePrices.onDemand,
        spotGpu: azurePrices.spot,
        reservedGpu: azurePrices.reserved1yr,
        hourlyCluster: azurePrices.onDemand * totalGpus,
        spotCluster: azurePrices.spot * totalGpus,
        reservedCluster: azurePrices.reserved1yr * totalGpus,
        spotSavingsPct: Math.round(((azurePrices.onDemand - azurePrices.spot) / azurePrices.onDemand) * 100),
        color: '#6366f1' // Indigo for Azure
      }
    ];
  }, [selectedGpu, totalGpus]);

  // Determine the lowest price provider for on-demand
  const lowestCostProvider = useMemo(() => {
    return [...providers].sort((a, b) => a.hourlyCluster - b.hourlyCluster)[0];
  }, [providers]);

  // Generate replica scaling curve data (1 to 16 replicas)
  const scalingChartData = useMemo(() => {
    const data = [];
    const maxCurveReplicas = Math.max(8, Math.min(16, replicas * 2));

    for (let r = 1; r <= maxCurveReplicas; r++) {
      const gpus = r * gpusPerReplica;
      const awsSpend = (selectedTier === 'onDemand' ? selectedGpu.hourlyPrice.aws.onDemand : selectedTier === 'spot' ? selectedGpu.hourlyPrice.aws.spot : selectedGpu.hourlyPrice.aws.reserved1yr) * gpus;
      const gcpSpend = (selectedTier === 'onDemand' ? selectedGpu.hourlyPrice.gcp.onDemand : selectedTier === 'spot' ? selectedGpu.hourlyPrice.gcp.spot : selectedGpu.hourlyPrice.gcp.reserved1yr) * gpus;
      const azureSpend = (selectedTier === 'onDemand' ? selectedGpu.hourlyPrice.azure.onDemand : selectedTier === 'spot' ? selectedGpu.hourlyPrice.azure.spot : selectedGpu.hourlyPrice.azure.reserved1yr) * gpus;

      data.push({
        replicas: `${r} Pod${r > 1 ? 's' : ''}`,
        replicaCount: r,
        totalGpus: gpus,
        AWS: Math.round(awsSpend * 100) / 100,
        GCP: Math.round(gcpSpend * 100) / 100,
        Azure: Math.round(azureSpend * 100) / 100
      });
    }
    return data;
  }, [replicas, gpusPerReplica, selectedGpu, selectedTier]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: val < 10 ? 2 : 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const handleCopyBudget = () => {
    const text = `KubeVLLM Cloud Cost Estimate:
Hardware: ${replicas} Replicas x ${gpusPerReplica} GPUs (${totalGpus}x ${selectedGpu.name})
- AWS: ${formatCurrency(providers[0].hourlyCluster)}/hr (Spot: ${formatCurrency(providers[0].spotCluster)}/hr)
- GCP: ${formatCurrency(providers[1].hourlyCluster)}/hr (Spot: ${formatCurrency(providers[1].spotCluster)}/hr)
- Azure: ${formatCurrency(providers[2].hourlyCluster)}/hr (Spot: ${formatCurrency(providers[2].spotCluster)}/hr)
Lowest Cost Provider: ${lowestCostProvider.shortName}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const updateGpu = (gpuId: string) => {
    setSelectedGpuId(gpuId);
    if (onGpuChange) onGpuChange(gpuId);
  };

  const updateReplicas = (val: number) => {
    setReplicas(val);
    if (onReplicaChange) onReplicaChange(val);
  };

  const updateGpuCount = (val: number) => {
    setGpusPerReplica(val);
    if (onGpuCountChange) onGpuCountChange(val);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-neutral-900/60 to-neutral-950 border border-emerald-800/30 rounded-xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide uppercase">
              <DollarSign className="w-3.5 h-3.5" />
              Cloud GPU Cost Estimator
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Real-World Cloud Spend Calculator
            </h2>
            <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
              Calculate and compare hourly, daily, and monthly cloud spend across AWS, GCP, and Azure
              for your selected GPU accelerators and Kubernetes replica counts.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleCopyBudget}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-neutral-900 border border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-neutral-400" />}
              <span>{copied ? 'Summary Copied!' : 'Copy Budget Summary'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Controls Bar */}
      <div className="border border-neutral-800 rounded-xl p-5 bg-neutral-900/50 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 text-xs">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Hardware &amp; Scaling Parameters</span>
          </div>
          <span className="font-mono text-emerald-400 font-bold">
            Total Cluster GPUs: {totalGpus}x {selectedGpu.name.split(' ')[0]} ({totalGpus * selectedGpu.vramGB} GB VRAM)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. GPU Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300 block">
              Selected GPU Accelerator
            </label>
            <select
              value={selectedGpuId}
              onChange={(e) => updateGpu(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            >
              {GPU_SPECS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.vramGB}GB VRAM
                </option>
              ))}
            </select>
            <div className="flex justify-between text-[11px] text-neutral-400 font-mono">
              <span>{selectedGpu.bandwidthGBs} GB/s Bandwidth</span>
              <span>{selectedGpu.fp16Tflops} FP16 TFLOPS</span>
            </div>
          </div>

          {/* 2. Replica Count */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-300">Replica Pod Count</span>
              <span className="font-mono text-emerald-400 font-bold tabular-nums">
                {replicas} {replicas === 1 ? 'Pod' : 'Pods'}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={16}
              step={1}
              value={replicas}
              onChange={(e) => updateReplicas(Number(e.target.value))}
              className="w-full accent-emerald-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
            <div className="flex gap-1.5 pt-0.5">
              {[1, 2, 4, 8, 12, 16].map((num) => (
                <button
                  key={num}
                  onClick={() => updateReplicas(num)}
                  className={`flex-1 py-1 text-[10px] rounded font-mono transition-colors ${
                    replicas === num
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {num}p
                </button>
              ))}
            </div>
          </div>

          {/* 3. GPUs Per Replica (TP) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-300">GPUs per Pod (Tensor Parallelism)</span>
              <span className="font-mono text-sky-400 font-bold tabular-nums">
                {gpusPerReplica} GPU{gpusPerReplica > 1 ? 's' : ''} / Pod
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 4, 8].map((tp) => (
                <button
                  key={tp}
                  onClick={() => updateGpuCount(tp)}
                  className={`py-2 rounded-lg text-xs font-mono font-medium transition-colors border ${
                    gpusPerReplica === tp
                      ? 'bg-sky-950/60 border-sky-500 text-white font-bold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {tp}x GPU
                </button>
              ))}
            </div>
            <div className="text-[11px] text-neutral-400 text-center font-mono">
              {totalGpus} total physical GPUs deployed
            </div>
          </div>
        </div>

        {/* Time Horizon Selector */}
        <div className="pt-3 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-neutral-400">
            Displaying estimates for <span className="text-white font-medium">{totalGpus}x {selectedGpu.name}</span>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-neutral-950 border border-neutral-800 rounded-lg">
            <button
              onClick={() => setTimeHorizon('hourly')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                timeHorizon === 'hourly'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Hourly Rate ($/hr)
            </button>
            <button
              onClick={() => setTimeHorizon('daily')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                timeHorizon === 'daily'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Daily Rate ($/day)
            </button>
            <button
              onClick={() => setTimeHorizon('monthly')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                timeHorizon === 'monthly'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Monthly Rate ($/mo)
            </button>
          </div>
        </div>
      </div>

      {/* Cloud Provider Cards (AWS vs GCP vs Azure) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map((p) => {
          const isBestValue = p.id === lowestCostProvider.id;
          const displayOnDemand = p.hourlyCluster * timeMultiplier;
          const displaySpot = p.spotCluster * timeMultiplier;
          const displayReserved = p.reservedCluster * timeMultiplier;
          const savingsAmount = displayOnDemand - displaySpot;

          return (
            <div
              key={p.id}
              className={`p-5 rounded-xl border relative transition-all ${
                isBestValue
                  ? 'bg-neutral-900/90 border-emerald-500/70 shadow-lg shadow-emerald-950/20'
                  : 'bg-neutral-950/70 border-neutral-800'
              }`}
            >
              {isBestValue && (
                <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-emerald-500 text-neutral-950 text-[10px] font-bold uppercase tracking-wider shadow">
                  Lowest Cost Provider
                </div>
              )}

              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-neutral-400" />
                    {p.shortName}
                  </h3>
                  <div className="text-[11px] text-neutral-400 font-mono truncate max-w-[220px] mt-0.5">
                    {p.instance}
                  </div>
                </div>
                <div className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-2 py-1 rounded border border-neutral-800">
                  ${p.hourlyGpu.toFixed(2)}/GPU/hr
                </div>
              </div>

              {/* Main Spend Display */}
              <div className="space-y-3 pb-4 border-b border-neutral-800/80">
                <div>
                  <div className="text-[11px] text-neutral-400 uppercase font-mono">
                    On-Demand Spend
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">
                    {formatCurrency(displayOnDemand)}
                    <span className="text-xs text-neutral-400 font-normal ml-1">{timeLabel}</span>
                  </div>
                </div>

                {/* Spot Rate with Savings Badge */}
                <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-emerald-400 font-semibold uppercase">
                      Spot / Preemptible Rate
                    </div>
                    <div className="text-lg font-bold font-mono text-emerald-300 tabular-nums">
                      {formatCurrency(displaySpot)}
                      <span className="text-[11px] font-normal text-emerald-400 ml-1">{timeLabel}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 font-mono">
                      -{p.spotSavingsPct}%
                    </span>
                    <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                      Save {formatCurrency(savingsAmount)}{timeLabel}
                    </div>
                  </div>
                </div>

                {/* 1-Year Reserved Rate */}
                <div className="flex items-center justify-between text-xs font-mono pt-1">
                  <span className="text-neutral-400">1-Year Committed / Reserved:</span>
                  <span className="text-sky-300 font-semibold tabular-nums">
                    {formatCurrency(displayReserved)}{timeLabel}
                  </span>
                </div>
              </div>

              {/* Quick specs footnote */}
              <div className="pt-3 text-[11px] text-neutral-400 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Single Pod Hourly:</span>
                  <span className="text-neutral-200">${(p.hourlyGpu * gpusPerReplica).toFixed(2)}/hr</span>
                </div>
                <div className="flex justify-between">
                  <span>24-Hour Day Run:</span>
                  <span className="text-neutral-200">{formatCurrency(p.hourlyCluster * 24)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scaling Curve Chart */}
      <div className="border border-neutral-800 rounded-xl p-5 bg-neutral-900/50 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">
                Hourly Cloud Spend Scaling Curve (1 to 16 Replicas)
              </h3>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Projected hourly cost trajectory as your Kubernetes cluster scales pods up or down.
            </p>
          </div>

          {/* Pricing Tier Toggle */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-950 border border-neutral-800 rounded-lg">
            <button
              onClick={() => setSelectedTier('onDemand')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                selectedTier === 'onDemand' ? 'bg-neutral-800 text-white font-semibold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              On-Demand
            </button>
            <button
              onClick={() => setSelectedTier('spot')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                selectedTier === 'spot' ? 'bg-emerald-600 text-white font-semibold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Spot (Up to 70% Off)
            </button>
            <button
              onClick={() => setSelectedTier('reserved1yr')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                selectedTier === 'reserved1yr' ? 'bg-sky-600 text-white font-semibold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              1-Year Reserved
            </button>
          </div>
        </div>

        <div className="h-[280px] w-full text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scalingChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey="replicas" stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 11 }} />
              <YAxis stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 11 }} tickFormatter={(val) => `$${val}/hr`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '6px', fontSize: '11px', color: '#e5e5e5' }}
                formatter={(val: any, name: any) => [`$${Number(val).toFixed(2)}/hr`, name]}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Line type="monotone" dataKey="AWS" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="GCP" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Azure" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cross-Cloud Matrix Table */}
      <div className="border border-neutral-800 rounded-xl p-5 bg-neutral-900/50 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white">
            Comprehensive Real-World Pricing Matrix ({selectedGpu.name})
          </span>
          <span className="text-neutral-400 font-mono text-[11px]">
            {gpusPerReplica} GPU{gpusPerReplica > 1 ? 's' : ''} / pod · {replicas} pod{replicas > 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800 text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Cloud Provider</th>
                <th className="py-2.5 px-3">Standard Instance Shape</th>
                <th className="py-2.5 px-3 text-right">Hourly / GPU</th>
                <th className="py-2.5 px-3 text-right">Cluster Hourly</th>
                <th className="py-2.5 px-3 text-right">Cluster Daily</th>
                <th className="py-2.5 px-3 text-right">Cluster Monthly</th>
                <th className="py-2.5 px-3 text-right text-emerald-400">Spot Monthly</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 bg-neutral-950/40 text-neutral-200">
              {providers.map((p) => {
                const hourlyOnDemand = p.hourlyCluster;
                const spotHourly = p.spotCluster;

                return (
                  <tr key={p.id} className="hover:bg-neutral-900/60 transition-colors">
                    <td className="py-3 px-3 font-medium text-white flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span>{p.name}</span>
                    </td>
                    <td className="py-3 px-3 text-neutral-400 text-[11px] truncate max-w-[200px]">
                      {p.instance}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-neutral-300">
                      ${p.hourlyGpu.toFixed(2)}/hr
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-white">
                      ${hourlyOnDemand.toFixed(2)}/hr
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-neutral-300">
                      {formatCurrency(hourlyOnDemand * 24)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-neutral-200">
                      {formatCurrency(hourlyOnDemand * 730)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-emerald-400">
                      {formatCurrency(spotHourly * 730)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
