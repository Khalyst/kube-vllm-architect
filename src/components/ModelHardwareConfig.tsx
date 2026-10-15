import React from 'react';
import { AppConfig, ModelPreset, Precision, VramCalculationResult } from '../types';
import { MODEL_PRESETS } from '../data/models';
import { GPU_SPECS } from '../data/gpus';
import { AlertCircle, CheckCircle, Cpu, Database, Info, Layers, Zap } from 'lucide-react';

interface Props {
  config: AppConfig;
  preset: ModelPreset;
  vram: VramCalculationResult;
  updateConfig: (patch: Partial<AppConfig>) => void;
}

export const ModelHardwareConfig: React.FC<Props> = ({
  config,
  preset,
  vram,
  updateConfig
}) => {
  const selectedGpu = GPU_SPECS.find((g) => g.id === config.selectedGpuId) || GPU_SPECS[0];

  const handleModelChange = (modelId: string) => {
    const found = MODEL_PRESETS.find((m) => m.id === modelId);
    if (found) {
      updateConfig({
        modelId,
        precision: found.defaultPrecision,
        maxModelLen: found.defaultMaxLen,
        tensorParallelSize: found.recommendedTP,
        servedModelName: found.repoId.split('/').pop() || 'model'
      });
    } else {
      updateConfig({ modelId });
    }
  };

  const precisions: { id: Precision; label: string; desc: string }[] = [
    { id: 'bfloat16', label: 'BF16 (16-bit)', desc: 'Full native precision, ~2 bytes/param' },
    { id: 'float16', label: 'FP16 (16-bit)', desc: 'Standard float16 precision' },
    { id: 'awq', label: 'AWQ (4-bit)', desc: 'Activation-aware 4-bit, ~0.65 bytes/param' },
    { id: 'gptq', label: 'GPTQ (4-bit)', desc: '4-bit matrix quantization' },
    { id: 'fp8', label: 'FP8 (8-bit)', desc: 'Hopper/Ada Lovelace native FP8, ~1.05 bytes/param' }
  ];

  return (
    <div className="space-y-6">
      {/* Section 1: AI Model Selection (AI-Agnostic Concept) */}
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/50 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div>
            <h3 className="text-sm font-semibold text-white">1. AI Model Architecture & Source</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              AI-agnostic runtime serving any Hugging Face open weights, private S3/GCS model store, or pre-mounted PVC.
            </p>
          </div>
          <span className="text-xs font-mono text-sky-400">
            {preset.paramsBillions}B Parameters · {preset.architecture}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Preset Model Dropdown */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Model Selection Preset
            </label>
            <select
              value={config.modelId}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            >
              {MODEL_PRESETS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.paramsBillions}B)
                </option>
              ))}
            </select>
          </div>

          {/* Model Hub / Source */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Weight Source Provider
            </label>
            <select
              value={config.modelSource}
              onChange={(e) => updateConfig({ modelSource: e.target.value as any })}
              className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="huggingface">Hugging Face Hub (Automated Download & Cache)</option>
              <option value="pvc">Pre-Downloaded Weights on PersistentVolumeClaim (PVC)</option>
              <option value="s3_gcs">Cloud Object Storage (S3 / Google Cloud Storage)</option>
              <option value="hostpath">Node HostPath / NVMe Mount</option>
            </select>
          </div>
        </div>

        {/* Custom Model ID if custom chosen */}
        {config.modelId === 'custom-model' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Custom HuggingFace Repo ID or Local Path
              </label>
              <input
                type="text"
                value={config.customRepoId}
                onChange={(e) => updateConfig({ customRepoId: e.target.value })}
                placeholder="e.g. meta-llama/Llama-3.1-8B-Instruct"
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                API Served Model Name Alias
              </label>
              <input
                type="text"
                value={config.servedModelName}
                onChange={(e) => updateConfig({ servedModelName: e.target.value })}
                placeholder="e.g. production-reasoning-model"
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>
        )}

        {/* Precision & Quantization */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Model Precision & Quantization Scheme
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {precisions.map((p) => (
              <button
                key={p.id}
                onClick={() => updateConfig({ precision: p.id })}
                className={`p-2.5 rounded text-left border transition-colors ${
                  config.precision === p.id
                    ? 'border-sky-500 bg-sky-950/30 text-white'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <div className="text-xs font-semibold">{p.label}</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section 2: GPU Hardware & Tensor Parallelism */}
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/50 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div>
            <h3 className="text-sm font-semibold text-white">2. GPU Hardware & Cluster Sizing</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Select target GPU accelerator, tensor parallelism (TP), and PyTorch shared memory allocations.
            </p>
          </div>
          <span className="text-xs font-mono text-sky-400">
            {selectedGpu.vramGB * config.tensorParallelSize} GB Total VRAM per Pod
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* GPU Model Picker */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              GPU Accelerator Model
            </label>
            <select
              value={config.selectedGpuId}
              onChange={(e) => updateConfig({ selectedGpuId: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            >
              {GPU_SPECS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.vramGB}GB · {g.bandwidthGBs} GB/s)
                </option>
              ))}
            </select>
            <div className="text-[10px] text-neutral-400 mt-1 font-mono">
              AWS: {selectedGpu.awsInstance}
            </div>
          </div>

          {/* Tensor Parallelism (TP) */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Tensor Parallelism (TP GPUs per Pod)
            </label>
            <div className="flex items-center gap-1.5 p-1 bg-neutral-950 border border-neutral-800 rounded">
              {[1, 2, 4, 8].map((tp) => (
                <button
                  key={tp}
                  onClick={() => updateConfig({ tensorParallelSize: tp })}
                  className={`flex-1 py-1.5 text-xs font-mono font-medium rounded transition-colors ${
                    config.tensorParallelSize === tp
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  TP={tp}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">
              Recommended for {preset.paramsBillions}B: <span className="text-sky-400 font-mono">TP={vram.recommendedTp}</span>
            </div>
          </div>

          {/* Max Model Length (Context Window) */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Max Context Window (--max-model-len)
            </label>
            <select
              value={config.maxModelLen}
              onChange={(e) => updateConfig({ maxModelLen: Number(e.target.value) })}
              className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value="4096">4,096 tokens</option>
              <option value="8192">8,192 tokens</option>
              <option value="16384">16,384 tokens</option>
              <option value="32768">32,768 tokens</option>
              <option value="65536">65,536 tokens</option>
              <option value="131072">131,072 tokens</option>
            </select>
          </div>
        </div>

        {/* Real-Time VRAM & KV Cache Allocation Gauge */}
        <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-neutral-200">Pod VRAM Allocation Breakdown</span>
            <div className="flex items-center gap-2 font-mono">
              <span className={vram.isOom ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                {vram.isOom ? 'OUT OF MEMORY' : 'VRAM Sizing Healthy'}
              </span>
              <span className="text-neutral-500">|</span>
              <span className="text-neutral-300">
                {vram.weightsVramGB + vram.overheadVramGB} GB / {vram.totalVramAvailableGB} GB
              </span>
            </div>
          </div>

          {/* Segmented Visual Bar */}
          <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden flex">
            {/* Weights */}
            <div
              style={{ width: `${Math.min(100, (vram.weightsVramGB / vram.totalVramAvailableGB) * 100)}%` }}
              className="bg-indigo-500 h-full"
              title={`Model Weights: ${vram.weightsVramGB} GB`}
            />
            {/* Overhead */}
            <div
              style={{ width: `${Math.min(100, (vram.overheadVramGB / vram.totalVramAvailableGB) * 100)}%` }}
              className="bg-amber-500 h-full"
              title={`PyTorch & CUDA Overhead: ${vram.overheadVramGB} GB`}
            />
            {/* KV Cache Pool */}
            <div
              style={{ width: `${Math.min(100, (vram.kvCachePoolGB / vram.totalVramAvailableGB) * 100)}%` }}
              className="bg-emerald-500 h-full"
              title={`PagedAttention KV Cache Pool: ${vram.kvCachePoolGB} GB`}
            />
          </div>

          {/* Bar Legend & Key Values */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
              <span className="text-neutral-400">Model Weights:</span>
              <span className="font-mono text-neutral-200">{vram.weightsVramGB} GB</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
              <span className="text-neutral-400">Overhead:</span>
              <span className="font-mono text-neutral-200">{vram.overheadVramGB} GB</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span className="text-neutral-400">KV Cache Pool:</span>
              <span className="font-mono text-emerald-400 font-semibold">{vram.kvCachePoolGB} GB</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-sky-400" />
              <span className="text-neutral-400">Est. Throughput:</span>
              <span className="font-mono text-sky-300">~{vram.tokensPerSecEstimate} tok/s</span>
            </div>
          </div>

          {vram.isOom && (
            <div className="flex items-start gap-2 p-3 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong>Out-Of-Memory Risk:</strong> Model weights and CUDA context require more VRAM than available on {config.tensorParallelSize}x {selectedGpu.name}. Increase Tensor Parallelism to <code className="font-mono text-white">TP={vram.recommendedTp}</code> or select 4-bit AWQ / FP8 quantization.
              </div>
            </div>
          )}
        </div>

        {/* vLLM Performance Optimizations (Switches) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* Prefix Caching */}
          <div
            onClick={() => updateConfig({ enablePrefixCaching: !config.enablePrefixCaching })}
            className={`p-3 rounded border cursor-pointer transition-colors ${
              config.enablePrefixCaching
                ? 'border-sky-500 bg-sky-950/20'
                : 'border-neutral-800 bg-neutral-950 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">--enable-prefix-caching</span>
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${config.enablePrefixCaching ? 'border-sky-500 bg-sky-500' : 'border-neutral-600'}`}>
                {config.enablePrefixCaching && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Enables PagedAttention automatic prompt prefix caching for high KV cache hit rates.
            </p>
          </div>

          {/* Chunked Prefill */}
          <div
            onClick={() => updateConfig({ enableChunkedPrefill: !config.enableChunkedPrefill })}
            className={`p-3 rounded border cursor-pointer transition-colors ${
              config.enableChunkedPrefill
                ? 'border-sky-500 bg-sky-950/20'
                : 'border-neutral-800 bg-neutral-950 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">--enable-chunked-prefill</span>
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${config.enableChunkedPrefill ? 'border-sky-500 bg-sky-500' : 'border-neutral-600'}`}>
                {config.enableChunkedPrefill && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Interleaves prompt prefill with decode tokens to eliminate compute starvation and variance.
            </p>
          </div>

          {/* FP8 KV Cache */}
          <div
            onClick={() => updateConfig({ kvCacheDtype: config.kvCacheDtype === 'fp8' ? 'auto' : 'fp8' })}
            className={`p-3 rounded border cursor-pointer transition-colors ${
              config.kvCacheDtype === 'fp8'
                ? 'border-sky-500 bg-sky-950/20'
                : 'border-neutral-800 bg-neutral-950 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">--kv-cache-dtype fp8</span>
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${config.kvCacheDtype === 'fp8' ? 'border-sky-500 bg-sky-500' : 'border-neutral-600'}`}>
                {config.kvCacheDtype === 'fp8' && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Compresses KV cache into 8-bit, doubling the concurrent token capacity in VRAM pool.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
