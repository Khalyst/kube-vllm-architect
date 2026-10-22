import { AppConfig, ModelPreset, ValidationIssue, VramCalculationResult } from '../types';

export function validateConfiguration(
  config: AppConfig,
  preset: ModelPreset,
  vram: VramCalculationResult
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. OOM Check
  if (vram.isOom) {
    issues.push({
      severity: 'error',
      title: 'GPU Out-Of-Memory (OOM) Detected',
      message: `Model weights (${vram.weightsVramGB} GB) exceed usable VRAM on selected GPU (${vram.totalVramAvailableGB} GB at ${Math.round(config.gpuMemoryUtilization * 100)}% util).`,
      remedy: `Increase Tensor Parallelism (TP) to ${vram.recommendedTp}, pick a GPU with larger VRAM (e.g. H100 80GB), or switch precision to AWQ / FP8.`
    });
  }

  // 2. Shared Memory (/dev/shm) check
  if (config.tensorParallelSize > 1 && config.shmSizeGi < 8) {
    issues.push({
      severity: 'warning',
      title: 'Shared Memory (/dev/shm) Sizing Too Small',
      message: `Multi-GPU Tensor Parallelism (TP=${config.tensorParallelSize}) requires substantial shared memory for PyTorch NCCL inter-process communication. Currently set to ${config.shmSizeGi}Gi.`,
      remedy: 'Increase Shared Memory limit to at least 16Gi in Hardware settings.'
    });
  }

  // 3. Smart Routing & Prefix Caching Alignment
  if (config.routingStrategy === 'smart_prefix' && !config.enablePrefixCaching) {
    issues.push({
      severity: 'warning',
      title: 'Prefix Caching Disabled with Smart Router',
      message: 'Smart Router is configured to route traffic based on prompt prefix hash, but vLLM --enable-prefix-caching is currently toggled OFF.',
      remedy: 'Enable Prefix Caching in vLLM Engine settings to unlock prompt KV cache reuse and avoid redundant matrix multiplication.'
    });
  }

  // 4. Scale to Zero Safety Check
  if (config.enableAutoscaling && config.minReplicas === 0 && config.autoscalerType !== 'keda') {
    issues.push({
      severity: 'error',
      title: 'Standard HPA Does Not Support Scale-to-Zero',
      message: 'Kubernetes native HPA requires minReplicas >= 1. Standard HPA cannot wake pods from 0 replicas upon new HTTP traffic.',
      remedy: 'Switch Autoscaler Type to KEDA with Prometheus triggers or increase minReplicas to 1.'
    });
  }

  // 5. Context Window vs KV Cache Pool
  if (vram.kvCachePoolGB < 4 && config.maxModelLen > 8192) {
    issues.push({
      severity: 'warning',
      title: 'Constrained KV Cache Pool for Long Context',
      message: `Available KV cache pool is only ${vram.kvCachePoolGB} GB while max context length is set to ${config.maxModelLen} tokens. Concurrent queries with long contexts may queue or stall.`,
      remedy: 'Enable FP8 KV cache dtype (--kv-cache-dtype fp8) or allocate additional GPUs.'
    });
  }

  // 6. Enterprise PDB vs Min Replicas check
  if (config.enablePdb && config.minReplicas > 0 && config.pdbMinAvailable >= config.maxReplicas) {
    issues.push({
      severity: 'warning',
      title: 'PodDisruptionBudget minAvailable equals Max Replicas',
      message: `PDB minAvailable is set to ${config.pdbMinAvailable}, which matches maxReplicas (${config.maxReplicas}). This may prevent rolling node maintenance or cluster draining.`,
      remedy: 'Set PDB minAvailable to 1 or lower than maxReplicas.'
    });
  }

  // 7. Enterprise Canary Traffic Validation
  if (config.canaryEngine !== 'none' && config.canaryTrafficWeight > 50) {
    issues.push({
      severity: 'warning',
      title: 'Canary Traffic Exceeds 50%',
      message: `Canary engine (${config.canaryEngine}) is configured with ${config.canaryTrafficWeight}% of total production traffic.`,
      remedy: 'Canary traffic is recommended to remain <= 20% during initial A/B experimentation.'
    });
  }

  // 8. Good Configuration Accolades (Info)
  if (!vram.isOom && config.enablePrefixCaching && config.routingStrategy === 'smart_prefix') {
    issues.push({
      severity: 'info',
      title: 'Production KV Cache Affinity Active',
      message: 'Smart router and vLLM prefix caching are synchronized. Identical system prompts and user conversation prefixes will achieve zero-redundancy matrix multiplication.'
    });
  }

  if (config.enablePdb && config.enableServiceMonitor) {
    issues.push({
      severity: 'info',
      title: 'Enterprise High-Availability & SLA Active',
      message: `PodDisruptionBudget (minAvailable: ${config.pdbMinAvailable}) and Prometheus SLA Alert Rules are configured for zero-downtime operations.`
    });
  }

  return issues;
}
