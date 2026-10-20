import { AppConfig, CostEstimationResult, GpuSpec, ModelPreset, Precision, VramCalculationResult } from '../types';
import { GPU_SPECS } from '../data/gpus';

export function getBytesPerParam(precision: Precision): number {
  switch (precision) {
    case 'bfloat16':
    case 'float16':
      return 2.0;
    case 'fp8':
    case 'bitsandbytes':
      return 1.05;
    case 'awq':
    case 'gptq':
      return 0.65; // ~4 bits plus layer scales
    default:
      return 2.0;
  }
}

export function calculateVramRequirements(
  config: AppConfig,
  preset: ModelPreset
): VramCalculationResult {
  const gpu = GPU_SPECS.find((g) => g.id === config.selectedGpuId) || GPU_SPECS[0];
  const bytesPerParam = getBytesPerParam(config.precision);

  // Model weights size in GB
  // Formula: params_billions * bytes_per_param
  const rawWeightsGB = preset.paramsBillions * bytesPerParam;

  // Framework overhead (PyTorch context, CUDA graphs, communication buffers for NCCL)
  // Higher with Tensor Parallelism
  const overheadFactor = 1.12 + (config.tensorParallelSize > 1 ? 0.05 * Math.log2(config.tensorParallelSize) : 0);
  const weightsWithOverheadGB = rawWeightsGB * overheadFactor;

  // Total VRAM across all GPUs in this replica pod
  const totalGpusInPod = config.tensorParallelSize * config.pipelineParallelSize;
  const totalVramAvailableGB = gpu.vramGB * totalGpusInPod;

  // Usable VRAM according to gpuMemoryUtilization (e.g. 0.90)
  const usableVramGB = totalVramAvailableGB * config.gpuMemoryUtilization;

  // Remaining memory allocated by vLLM for PagedAttention KV Cache
  const kvCachePoolGB = Math.max(0, usableVramGB - weightsWithOverheadGB);

  // Check if Out-Of-Memory (OOM)
  // Pod is OOM if weights exceed usable VRAM or if KV cache pool is less than 1.5 GB
  const isOom = weightsWithOverheadGB >= usableVramGB || (usableVramGB - weightsWithOverheadGB) < 1.5;

  const vramUtilizationPct = Math.min(100, Math.round((weightsWithOverheadGB / usableVramGB) * 100));

  // KV Cache calculation:
  // Bytes per token = 2 (keys + values) * layers * kv_heads * head_dim * (kv_cache_dtype == 'fp8' ? 1 : 2)
  const kvPrecisionBytes = config.kvCacheDtype === 'fp8' ? 1 : 2;
  const bytesPerToken = 2 * preset.layers * preset.kvHeads * preset.headDim * kvPrecisionBytes;
  
  // Convert kvCachePoolGB to bytes
  const kvCachePoolBytes = kvCachePoolGB * 1024 * 1024 * 1024;
  const estimatedTokensCapacity = Math.max(0, Math.floor(kvCachePoolBytes / bytesPerToken));

  // Throughput estimate (tokens/sec) based on memory bandwidth and GPU compute
  const totalBandwidth = gpu.bandwidthGBs * totalGpusInPod;
  // In autoregressive generation, memory bandwidth dominates: tokens/sec ~= Bandwidth / Model_Size_GB
  const rawGenThroughput = rawWeightsGB > 0 ? (totalBandwidth / rawWeightsGB) * 0.75 : 50;
  const tokensPerSecEstimate = Math.round(isOom ? 0 : Math.min(2500, rawGenThroughput * Math.min(8, config.maxNumSeqs / 8 + 1)));

  // Minimum recommended GPUs for this model at this precision
  const minVramNeeded = rawWeightsGB * 1.25;
  const recommendedGpuCount = Math.max(1, Math.ceil(minVramNeeded / (gpu.vramGB * 0.85)));
  // Round to nearest power of 2 for tensor parallelism: 1, 2, 4, 8
  const recommendedTp = Math.min(8, Math.max(1, Math.pow(2, Math.ceil(Math.log2(recommendedGpuCount)))));

  return {
    weightsVramGB: Math.round(rawWeightsGB * 10) / 10,
    overheadVramGB: Math.round((weightsWithOverheadGB - rawWeightsGB) * 10) / 10,
    kvCachePoolGB: Math.round(kvCachePoolGB * 10) / 10,
    totalVramPerReplicaGB: totalVramAvailableGB,
    totalVramAvailableGB,
    isOom,
    vramUtilizationPct: isNaN(vramUtilizationPct) ? 100 : vramUtilizationPct,
    estimatedTokensCapacity,
    tokensPerSecEstimate,
    recommendedGpuCount,
    recommendedTp
  };
}

export function calculateCostEstimation(
  config: AppConfig,
  gpu: GpuSpec,
  provider: 'aws' | 'gcp' | 'azure',
  pricingTier: 'onDemand' | 'spot' | 'reserved1yr',
  activeReplicaAverage: number,
  tokensPerSecEstimate: number
): CostEstimationResult {
  const gpusPerReplica = config.tensorParallelSize * config.pipelineParallelSize;
  const pricing = gpu.hourlyPrice[provider] || gpu.hourlyPrice.aws;
  const hourlyPerGpu = pricing[pricingTier];
  const hourlyOnDemandPerGpu = pricing.onDemand;

  const hourlyPerReplica = hourlyPerGpu * gpusPerReplica;
  const hourlyOnDemandPerReplica = hourlyOnDemandPerGpu * gpusPerReplica;

  const hoursPerMonth = 730;

  // Monthly 24x7 cost for a single replica
  const monthlyPerReplica24x7 = Math.round(hourlyPerReplica * hoursPerMonth);

  // Min replicas (supports scale-to-zero)
  const monthlyAtMinReplicas = Math.round(config.minReplicas * hourlyPerReplica * hoursPerMonth);

  // Max replicas peak 100% load
  const monthlyAtMaxReplicas = Math.round(config.maxReplicas * hourlyPerReplica * hoursPerMonth);

  // Estimated actual monthly with autoscaling duty cycle
  const effectiveReplicas = config.enableAutoscaling ? activeReplicaAverage : 1;
  const monthlyEstimatedWithAutoscaling = Math.round(effectiveReplicas * hourlyPerReplica * hoursPerMonth);

  // Static Peak monthly cost using On-Demand (what users would pay without KEDA/Autoscaling)
  const staticPeakOnDemand = Math.round(config.maxReplicas * hourlyOnDemandPerReplica * hoursPerMonth);
  const monthlySavingsVsStaticPeak = Math.max(0, staticPeakOnDemand - monthlyEstimatedWithAutoscaling);

  // Savings of chosen tier (e.g. Spot or Reserved) vs On-Demand for the same workload
  const onDemandSameWorkload = Math.round(effectiveReplicas * hourlyOnDemandPerReplica * hoursPerMonth);
  const monthlySavingsVsOnDemand = Math.max(0, onDemandSameWorkload - monthlyEstimatedWithAutoscaling);

  // Cost per 1M tokens:
  let costPerMillionTokens = 0;
  if (tokensPerSecEstimate > 0) {
    const tokensPerHour = tokensPerSecEstimate * 3600;
    costPerMillionTokens = Math.round((hourlyPerReplica / tokensPerHour) * 1_000_000 * 100) / 100;
  }

  return {
    gpusPerReplica,
    hourlyPerGpu: Math.round(hourlyPerGpu * 100) / 100,
    hourlyPerReplica: Math.round(hourlyPerReplica * 100) / 100,
    monthlyPerReplica24x7,
    monthlyAtMinReplicas,
    monthlyAtMaxReplicas,
    monthlyEstimatedWithAutoscaling,
    monthlySavingsVsStaticPeak,
    monthlySavingsVsOnDemand,
    costPerMillionTokens
  };
}
