import React, { useState, useMemo } from 'react';
import { AppConfig, ModelPreset, Precision, RoutingStrategy } from './types';
import { MODEL_PRESETS } from './data/models';
import { GPU_SPECS } from './data/gpus';
import { calculateVramRequirements } from './utils/calculator';
import { generateAllManifests } from './utils/generator';
import { validateConfiguration } from './utils/validator';
import { TopBar } from './components/TopBar';
import { ArchitectureVisualizer } from './components/ArchitectureVisualizer';
import { ModelHardwareConfig } from './components/ModelHardwareConfig';
import { AutoscalingConfig } from './components/AutoscalingConfig';
import { ManifestViewer } from './components/ManifestViewer';
import { ValidationView } from './components/ValidationView';
import { WasmSecurityView } from './components/WasmSecurityView';
import { CiCdView } from './components/CiCdView';
import { EnterpriseGuaranteesView } from './components/EnterpriseGuaranteesView';
import { Sparkles, Terminal, Cpu, Zap, Download } from 'lucide-react';
import JSZip from 'jszip';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('architecture');

  // Application configuration state
  const [config, setConfig] = useState<AppConfig>({
    modelId: 'deepseek-r1-distill-32b',
    customRepoId: '',
    modelSource: 'huggingface',
    pvcName: 'vllm-weights-pvc',
    pvcMountPath: '/root/.cache/huggingface',
    bucketUri: 's3://my-ml-models/vllm/',
    hfTokenSecretName: 'hf-token-secret',
    hfTokenSecretKey: 'token',
    precision: 'bfloat16',
    servedModelName: 'DeepSeek-R1-Distill-Qwen-32B',

    tensorParallelSize: 2,
    pipelineParallelSize: 1,
    maxModelLen: 32768,
    gpuMemoryUtilization: 0.90,
    enablePrefixCaching: true,
    enableChunkedPrefill: true,
    maxNumSeqs: 256,
    kvCacheDtype: 'auto',
    enforceEager: false,
    speculativeModel: '',
    numSpeculativeTokens: 0,

    selectedGpuId: 'nvidia-h100-sxm5-80gb',
    cloudPlatform: 'aws',
    shmSizeGi: 16,
    cpuRequest: 8,
    cpuLimit: 16,
    memoryRequestGi: 32,
    memoryLimitGi: 64,
    nodeSelectorKey: 'accelerator',
    nodeSelectorValue: 'nvidia',
    gpuTolerationKey: 'nvidia.com/gpu',

    enableAutoscaling: true,
    autoscalerType: 'keda',
    minReplicas: 0, // Scale to zero!
    maxReplicas: 5,
    kedaQueueThreshold: 4,
    kedaCacheUsageThreshold: 0.85,
    kedaCooldownPeriod: 300,
    prometheusAddress: 'http://prometheus-k8s.monitoring:9090',

    enableSmartRouter: true,
    routingStrategy: 'smart_prefix',
    routerReplicas: 2,
    sessionAffinityHeader: 'X-Session-ID',
    gatewayType: 'vllm_router',

    namespace: 'vllm-serving',
    deploymentName: 'vllm-inference',
    servicePort: 8000,
    containerImage: 'vllm/vllm-openai',
    containerTag: 'v0.7.2',

    // CI/CD & GitOps Automation
    ciRegistryProvider: 'ghcr',
    ciImageRepo: '',
    ciScanner: 'trivy',
    ciFailOnSeverity: 'CRITICAL,HIGH',
    ciDeployMethod: 'kubectl',
    ciK8sClusterContext: 'production-us-east-1',
    ciEnableScanBlock: true,

    // Enterprise Guarantees & Multi-Engine Experimentation
    primaryEngine: 'vllm',
    canaryEngine: 'none',
    canaryTrafficWeight: 10,
    enablePdb: true,
    pdbMinAvailable: 1,
    enableServiceMonitor: true,
    alertQueueBacklogThreshold: 10
  });

  const updateConfig = (patch: Partial<AppConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const activePreset = useMemo(() => {
    return MODEL_PRESETS.find((m) => m.id === config.modelId) || MODEL_PRESETS[0];
  }, [config.modelId]);

  const vram = useMemo(() => {
    return calculateVramRequirements(config, activePreset);
  }, [config, activePreset]);

  const files = useMemo(() => {
    return generateAllManifests(config, activePreset);
  }, [config, activePreset]);

  const issues = useMemo(() => {
    return validateConfiguration(config, activePreset, vram);
  }, [config, activePreset, vram]);

  const handleExportZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder(config.namespace || 'vllm-stack');
    files.forEach((file) => {
      folder?.file(file.name, file.content);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.namespace || 'vllm-serving'}-k8s-manifests.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Blueprint presets for 1-click configuration
  const applyBlueprint = (blueprint: 'deepseek_r1' | 'llama_awq' | 'scale_to_zero' | 'qwen_flagship') => {
    if (blueprint === 'deepseek_r1') {
      updateConfig({
        modelId: 'deepseek-r1-distill-32b',
        precision: 'bfloat16',
        selectedGpuId: 'nvidia-h100-sxm5-80gb',
        tensorParallelSize: 2,
        maxModelLen: 32768,
        enablePrefixCaching: true,
        enableChunkedPrefill: true,
        routingStrategy: 'smart_prefix',
        autoscalerType: 'keda',
        minReplicas: 1,
        maxReplicas: 6,
        servedModelName: 'DeepSeek-R1-Distill-Qwen-32B'
      });
    } else if (blueprint === 'llama_awq') {
      updateConfig({
        modelId: 'llama-3.3-70b-instruct',
        precision: 'awq',
        selectedGpuId: 'nvidia-a100-sxm4-80gb',
        tensorParallelSize: 2,
        maxModelLen: 32768,
        enablePrefixCaching: true,
        enableChunkedPrefill: true,
        routingStrategy: 'smart_prefix',
        autoscalerType: 'keda',
        minReplicas: 1,
        maxReplicas: 8,
        servedModelName: 'Llama-3.3-70B-AWQ'
      });
    } else if (blueprint === 'scale_to_zero') {
      updateConfig({
        modelId: 'qwen-2.5-14b-instruct',
        precision: 'bfloat16',
        selectedGpuId: 'nvidia-l4-24gb',
        tensorParallelSize: 1,
        maxModelLen: 16384,
        enablePrefixCaching: true,
        enableChunkedPrefill: true,
        routingStrategy: 'smart_prefix',
        autoscalerType: 'keda',
        minReplicas: 0,
        maxReplicas: 4,
        kedaCooldownPeriod: 180,
        servedModelName: 'Qwen2.5-14B-ScaleZero'
      });
    } else if (blueprint === 'qwen_flagship') {
      updateConfig({
        modelId: 'qwen-2.5-72b-instruct',
        precision: 'bfloat16',
        selectedGpuId: 'nvidia-h100-sxm5-80gb',
        tensorParallelSize: 4,
        maxModelLen: 32768,
        enablePrefixCaching: true,
        enableChunkedPrefill: true,
        routingStrategy: 'smart_prefix',
        autoscalerType: 'keda',
        minReplicas: 1,
        maxReplicas: 8,
        servedModelName: 'Qwen2.5-72B-Flagship'
      });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-sky-500/30">
      {/* 3-Zone Top Bar */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExport={handleExportZip}
        issueCount={issues.filter((i) => i.severity === 'error' || i.severity === 'warning').length}
      />

      {/* Production Blueprint Strip */}
      <div className="border-b border-neutral-800 bg-neutral-900/40 px-6 py-2.5 flex items-center justify-between text-xs overflow-x-auto gap-4">
        <div className="flex items-center gap-2 text-neutral-400 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-medium text-neutral-300">Architecture Blueprints:</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => applyBlueprint('deepseek_r1')}
            className={`px-2.5 py-1 rounded transition-colors text-xs font-medium ${
              config.modelId === 'deepseek-r1-distill-32b'
                ? 'bg-sky-950 text-sky-300 border border-sky-700/50'
                : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800'
            }`}
          >
            DeepSeek-R1 Distill (2x H100)
          </button>
          <button
            onClick={() => applyBlueprint('llama_awq')}
            className={`px-2.5 py-1 rounded transition-colors text-xs font-medium ${
              config.modelId === 'llama-3.3-70b-instruct'
                ? 'bg-sky-950 text-sky-300 border border-sky-700/50'
                : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800'
            }`}
          >
            Llama 3.3 70B AWQ (2x A100)
          </button>
          <button
            onClick={() => applyBlueprint('scale_to_zero')}
            className={`px-2.5 py-1 rounded transition-colors text-xs font-medium ${
              config.minReplicas === 0
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800'
            }`}
          >
            Scale-to-Zero Qwen (1x L4)
          </button>
          <button
            onClick={() => applyBlueprint('qwen_flagship')}
            className={`px-2.5 py-1 rounded transition-colors text-xs font-medium ${
              config.modelId === 'qwen-2.5-72b-instruct'
                ? 'bg-sky-950 text-sky-300 border border-sky-700/50'
                : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800'
            }`}
          >
            Qwen 2.5 72B (4x H100 TP=4)
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {activeTab === 'architecture' && (
          <ArchitectureVisualizer
            config={config}
            preset={activePreset}
            updateConfig={updateConfig}
          />
        )}

        {activeTab === 'model_hardware' && (
          <ModelHardwareConfig
            config={config}
            preset={activePreset}
            vram={vram}
            updateConfig={updateConfig}
          />
        )}

        {activeTab === 'autoscaling' && (
          <AutoscalingConfig
            config={config}
            updateConfig={updateConfig}
          />
        )}

        {activeTab === 'enterprise' && (
          <EnterpriseGuaranteesView
            config={config}
            preset={activePreset}
            updateConfig={updateConfig}
          />
        )}

        {activeTab === 'cicd' && (
          <CiCdView
            config={config}
            updateConfig={updateConfig}
            servedName={activePreset.repoId.split('/').pop() || 'model'}
          />
        )}

        {activeTab === 'wasm_security' && (
          <WasmSecurityView
            config={config}
            updateConfig={updateConfig}
          />
        )}

        {activeTab === 'manifests' && (
          <ManifestViewer
            files={files}
            issues={issues}
          />
        )}

        {activeTab === 'validation' && (
          <ValidationView
            issues={issues}
          />
        )}
      </main>

      {/* Footer with clean copyright and summary */}
      <footer className="border-t border-neutral-900 px-6 py-4 text-neutral-500 text-xs flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
        <div className="flex items-center gap-2">
          <span>KubeVLLM Architect</span>
          <span>·</span>
          <span>AI-Agnostic vLLM & Kubernetes Manifest Generator</span>
          <span>·</span>
          <span>KEDA GPU Autoscaling & KV Prefix Caching</span>
        </div>
        <div className="font-mono text-[11px] text-neutral-400">
          Target: vLLM v0.7.x / Kubernetes 1.28+ / CUDA 12.4
        </div>
      </footer>
    </div>
  );
}
