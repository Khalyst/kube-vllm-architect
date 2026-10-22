export type Precision = 'bfloat16' | 'float16' | 'awq' | 'gptq' | 'fp8' | 'bitsandbytes';

export type ModelProviderSource = 'huggingface' | 's3_gcs' | 'pvc' | 'hostpath';

export type CloudPlatform = 'aws' | 'gcp' | 'azure' | 'baremetal';

export type RoutingStrategy = 'smart_prefix' | 'dumb_round_robin' | 'least_connections';

export interface ModelPreset {
  id: string;
  name: string;
  repoId: string;
  architecture: string;
  paramsBillions: number;
  layers: number;
  heads: number;
  kvHeads: number;
  headDim: number;
  defaultMaxLen: number;
  defaultPrecision: Precision;
  recommendedTP: number;
  description: string;
}

export interface GpuPricing {
  onDemand: number;
  spot: number;
  reserved1yr: number;
}

export interface GpuSpec {
  id: string;
  name: string;
  vendor: 'NVIDIA' | 'AMD';
  vramGB: number;
  bandwidthGBs: number;
  tensorCores: string;
  awsInstance: string;
  gcpInstance: string;
  azureInstance: string;
  fp16Tflops: number;
  hourlyPrice: {
    aws: GpuPricing;
    gcp: GpuPricing;
    azure: GpuPricing;
  };
}

export interface AppConfig {
  // Model Settings
  modelId: string;
  customRepoId: string;
  modelSource: ModelProviderSource;
  pvcName: string;
  pvcMountPath: string;
  bucketUri: string;
  hfTokenSecretName: string;
  hfTokenSecretKey: string;
  precision: Precision;
  servedModelName: string;

  // Inference Engine & vLLM Settings
  tensorParallelSize: number;
  pipelineParallelSize: number;
  maxModelLen: number;
  gpuMemoryUtilization: number;
  enablePrefixCaching: boolean;
  enableChunkedPrefill: boolean;
  maxNumSeqs: number;
  kvCacheDtype: 'auto' | 'fp8';
  enforceEager: boolean;
  speculativeModel: string;
  numSpeculativeTokens: number;

  // Hardware & Node
  selectedGpuId: string;
  cloudPlatform: CloudPlatform;
  shmSizeGi: number;
  cpuRequest: number;
  cpuLimit: number;
  memoryRequestGi: number;
  memoryLimitGi: number;
  nodeSelectorKey: string;
  nodeSelectorValue: string;
  gpuTolerationKey: string;

  // Autoscaling & KEDA
  enableAutoscaling: boolean;
  autoscalerType: 'keda' | 'hpa';
  minReplicas: number;
  maxReplicas: number;
  kedaQueueThreshold: number; // vllm:num_requests_waiting threshold
  kedaCacheUsageThreshold: number; // vllm:gpu_cache_usage_factor (0.0 - 1.0)
  kedaCooldownPeriod: number; // in seconds (e.g. 300)
  prometheusAddress: string;

  // Smart Routing & Gateway
  enableSmartRouter: boolean;
  routingStrategy: RoutingStrategy;
  routerReplicas: number;
  sessionAffinityHeader: string;
  gatewayType: 'vllm_router' | 'litellm' | 'envoy';

  // Kubernetes Metadata
  namespace: string;
  deploymentName: string;
  servicePort: number;
  containerImage: string;
  containerTag: string;

  // CI/CD & GitOps Automation
  ciRegistryProvider: 'ghcr' | 'ecr' | 'gcr' | 'dockerhub' | 'acr';
  ciImageRepo: string;
  ciScanner: 'trivy' | 'grype' | 'snyk';
  ciFailOnSeverity: 'CRITICAL' | 'CRITICAL,HIGH';
  ciDeployMethod: 'kubectl' | 'argocd' | 'flux';
  ciK8sClusterContext: string;
  ciEnableScanBlock: boolean;

  // Enterprise Guarantees & Multi-Engine Experimentation
  primaryEngine: 'vllm' | 'tensorrt' | 'onnx' | 'sglang';
  canaryEngine: 'none' | 'tensorrt' | 'onnx' | 'vllm';
  canaryTrafficWeight: number;
  enablePdb: boolean;
  pdbMinAvailable: number;
  enableServiceMonitor: boolean;
  alertQueueBacklogThreshold: number;
}

export interface VramCalculationResult {
  weightsVramGB: number;
  overheadVramGB: number;
  kvCachePoolGB: number;
  totalVramPerReplicaGB: number;
  totalVramAvailableGB: number;
  isOom: boolean;
  vramUtilizationPct: number;
  estimatedTokensCapacity: number;
  tokensPerSecEstimate: number;
  recommendedGpuCount: number;
  recommendedTp: number;
}

export interface CostEstimationResult {
  gpusPerReplica: number;
  hourlyPerGpu: number;
  hourlyPerReplica: number;
  monthlyPerReplica24x7: number;
  monthlyAtMinReplicas: number;
  monthlyAtMaxReplicas: number;
  monthlyEstimatedWithAutoscaling: number;
  monthlySavingsVsStaticPeak: number;
  monthlySavingsVsOnDemand: number;
  costPerMillionTokens: number;
}

export interface GeneratedFile {
  name: string;
  path: string;
  category: 'core' | 'storage' | 'autoscaling' | 'routing' | 'infrastructure' | 'package' | 'cicd';
  content: string;
  description: string;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  remedy?: string;
}
