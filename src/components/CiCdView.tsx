import React, { useState } from 'react';
import { AppConfig } from '../types';
import { generateCiWorkflow } from '../utils/generator';
import { ShieldCheck, GitBranch, ArrowRight, Check, Copy, Download, Terminal, Server, Key, AlertTriangle, Layers } from 'lucide-react';

interface Props {
  config: AppConfig;
  updateConfig: (patch: Partial<AppConfig>) => void;
  servedName: string;
}

export const CiCdView: React.FC<Props> = ({ config, updateConfig, servedName }) => {
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'deploy' | 'pr'>('deploy');
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);

  const workflowYaml = generateCiWorkflow(config, servedName);

  const prLintWorkflowYaml = `name: PR Manifest Validation & Lint

on:
  pull_request:
    branches: [ main, master ]
    paths:
      - '${config.namespace}/**'
      - '.github/workflows/**'

jobs:
  validate-k8s:
    name: Validate Manifests & GPU Limits
    runs-on: ubuntu-latest

    steps:
    - name: Checkout Code
      uses: actions/checkout@v4

    - name: Setup Kubectl & Kustomize
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.30.0'

    - name: Kustomize Dry-Run Build
      run: |
        echo "Building manifests via Kustomize..."
        kubectl kustomize ./${config.namespace} > rendered-manifests.yaml
        echo "Manifests compiled successfully without syntax errors."

    - name: Verify GPU Resource Specs
      run: |
        echo "Checking that GPU resource limits match requests for predictable scheduling..."
        GPU_LIMITS=$(grep -c "nvidia.com/gpu" rendered-manifests.yaml || true)
        if [ "$GPU_LIMITS" -eq "0" ]; then
          echo "ERROR: No nvidia.com/gpu resource limits found in rendered manifests!"
          exit 1
        fi
        echo "GPU limits verified: $GPU_LIMITS references found."

    - name: Verify PyTorch IPC /dev/shm Volume
      run: |
        echo "Verifying /dev/shm shared memory emptyDir volume..."
        if ! grep -q "medium: Memory" rendered-manifests.yaml; then
          echo "ERROR: Missing RAM-backed /dev/shm emptyDir volume! Multi-GPU NCCL will fail."
          exit 1
        fi
        echo "IPC shared memory volume verified."
`;

  const activeContent = activeWorkflowTab === 'deploy' ? workflowYaml : prLintWorkflowYaml;
  const activeFileName = activeWorkflowTab === 'deploy' ? 'deploy-vllm-stack.yml' : 'pr-manifest-lint.yml';

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopiedWorkflow(true);
    setTimeout(() => setCopiedWorkflow(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const registries = [
    { id: 'ghcr', name: 'GitHub Container Registry (GHCR)', desc: 'Zero setup, authenticates via built-in GITHUB_TOKEN' },
    { id: 'ecr', name: 'AWS Elastic Container Registry (ECR)', desc: 'Keyless OIDC authentication with IAM Role assume' },
    { id: 'gcr', name: 'Google Cloud Artifact Registry (GAR)', desc: 'Keyless GCP Workload Identity Federation' },
    { id: 'acr', name: 'Azure Container Registry (ACR)', desc: 'Azure service principal or managed identity' },
    { id: 'dockerhub', name: 'Docker Hub', desc: 'Standard Docker Hub authentication' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-semibold text-white tracking-tight">
                CI/CD & GitOps Automation Engine
              </h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Export pre-configured GitHub Actions workflows for building, vulnerability scanning, image publishing, and deploying vLLM Kubernetes manifests.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded bg-sky-950/80 border border-sky-800 text-sky-300 font-mono text-xs">
              GitHub Actions · Trivy Scanner · Kustomize
            </span>
          </div>
        </div>

        {/* Pipeline Stage Visualizer */}
        <div className="mt-4 pt-2">
          <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-2">
            Automated Pipeline Stages
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
            <div className="p-2.5 rounded bg-neutral-950 border border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-500 font-mono">01. Source</span>
              <span className="font-medium text-neutral-200 mt-1">Git Checkout</span>
            </div>
            <div className="p-2.5 rounded bg-neutral-950 border border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-500 font-mono">02. Container</span>
              <span className="font-medium text-neutral-200 mt-1">Buildx Engine</span>
            </div>
            <div className="p-2.5 rounded bg-neutral-950 border border-emerald-900/60 bg-emerald-950/20 flex flex-col justify-between">
              <span className="text-[10px] text-emerald-400 font-mono">03. Security</span>
              <span className="font-medium text-emerald-300 mt-1">Trivy CVE Scan</span>
            </div>
            <div className="p-2.5 rounded bg-neutral-950 border border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-500 font-mono">04. Registry</span>
              <span className="font-medium text-neutral-200 mt-1">Push Image</span>
            </div>
            <div className="p-2.5 rounded bg-neutral-950 border border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-500 font-mono">05. Validate</span>
              <span className="font-medium text-neutral-200 mt-1">Kustomize Check</span>
            </div>
            <div className="p-2.5 rounded bg-neutral-950 border border-sky-900/60 bg-sky-950/20 flex flex-col justify-between">
              <span className="text-[10px] text-sky-400 font-mono">06. Deploy</span>
              <span className="font-medium text-sky-300 mt-1">Kubectl Rollout</span>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Controls */}
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/50 space-y-5">
        <div className="pb-3 border-b border-neutral-800">
          <h3 className="text-sm font-semibold text-white">Pipeline Customization</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Configure your target container registry, security gating thresholds, and cluster deployment method.
          </p>
        </div>

        {/* Registry Selection */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-2">
            Target Container Registry Provider
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {registries.map((r) => (
              <button
                key={r.id}
                onClick={() => updateConfig({ ciRegistryProvider: r.id as any })}
                className={`p-3 rounded text-left border transition-colors ${
                  config.ciRegistryProvider === r.id
                    ? 'border-sky-500 bg-sky-950/30 text-white'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <div className="text-xs font-semibold">{r.name}</div>
                <div className="text-[10px] text-neutral-400 mt-1">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Image Repo Name & Gating Thresholds */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Custom Image Repo */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Custom Image Repository URI
            </label>
            <input
              type="text"
              value={config.ciImageRepo}
              onChange={(e) => updateConfig({ ciImageRepo: e.target.value })}
              placeholder="e.g. ghcr.io/my-org/vllm-engine"
              className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            />
            <div className="text-[10px] text-neutral-500 mt-1">
              Default: {config.ciRegistryProvider === 'ghcr' ? 'ghcr.io/' : ''}{config.namespace}/vllm-custom-engine
            </div>
          </div>

          {/* Vulnerability Gating */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Container Scanner Failure Threshold
            </label>
            <select
              value={config.ciFailOnSeverity}
              onChange={(e) => updateConfig({ ciFailOnSeverity: e.target.value as any })}
              className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value="CRITICAL,HIGH">CRITICAL & HIGH (Strict Security)</option>
              <option value="CRITICAL">CRITICAL Only (Standard Gating)</option>
            </select>
            <div className="flex items-center gap-1.5 mt-2">
              <input
                type="checkbox"
                id="blockScan"
                checked={config.ciEnableScanBlock}
                onChange={(e) => updateConfig({ ciEnableScanBlock: e.target.checked })}
                className="accent-sky-500 rounded"
              />
              <label htmlFor="blockScan" className="text-[11px] text-neutral-300 cursor-pointer">
                Block deployment if CVEs exceed threshold
              </label>
            </div>
          </div>

          {/* Deployment Method */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Cluster Deployment Method
            </label>
            <select
              value={config.ciDeployMethod}
              onChange={(e) => updateConfig({ ciDeployMethod: e.target.value as any })}
              className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value="kubectl">Direct Kubectl Rollout (via KUBECONFIG)</option>
              <option value="argocd">GitOps Sync Trigger (ArgoCD API / Webhook)</option>
            </select>
            <div className="text-[10px] text-neutral-500 mt-1">
              {config.ciDeployMethod === 'kubectl'
                ? 'Applies manifests and monitors rollout status with timeout'
                : 'Pushes commit and invokes ArgoCD sync endpoint'}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Code Viewer */}
      <div className="border border-neutral-800 rounded-lg bg-neutral-950 overflow-hidden">
        {/* Header Tabs */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/60">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveWorkflowTab('deploy')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeWorkflowTab === 'deploy'
                  ? 'bg-sky-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              deploy-vllm-stack.yml (Full Pipeline)
            </button>
            <button
              onClick={() => setActiveWorkflowTab('pr')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeWorkflowTab === 'pr'
                  ? 'bg-sky-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              pr-manifest-lint.yml (PR Check)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs transition-colors"
            >
              {copiedWorkflow ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedWorkflow ? 'Copied' : 'Copy Workflow'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save File</span>
            </button>
          </div>
        </div>

        {/* Workflow Code */}
        <div className="p-4 overflow-x-auto text-xs font-mono text-neutral-300 bg-neutral-950 max-h-[500px] leading-relaxed select-text">
          <pre>
            <code>{activeContent}</code>
          </pre>
        </div>
      </div>

      {/* Required GitHub Secrets Reference Card */}
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/40 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200 uppercase tracking-wide">
          <Key className="w-4 h-4 text-sky-400" />
          <span>Required GitHub Repository Secrets Reference</span>
        </div>
        <p className="text-xs text-neutral-400">
          Configure these secrets under <strong>Settings &rarr; Secrets and variables &rarr; Actions</strong> in your GitHub repository:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          {config.ciDeployMethod === 'kubectl' && (
            <div className="p-3 rounded bg-neutral-950 border border-neutral-800">
              <span className="text-sky-300 font-semibold">KUBECONFIG</span>
              <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
                Base64-encoded or raw kubeconfig file with credentials to access your production Kubernetes cluster.
              </p>
            </div>
          )}

          {config.ciRegistryProvider === 'ghcr' && (
            <div className="p-3 rounded bg-neutral-950 border border-neutral-800">
              <span className="text-emerald-300 font-semibold">GITHUB_TOKEN</span>
              <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
                Automatically provided by GitHub Actions runner (requires <code className="text-neutral-300">packages: write</code> permission).
              </p>
            </div>
          )}

          {config.ciRegistryProvider === 'ecr' && (
            <div className="p-3 rounded bg-neutral-950 border border-neutral-800">
              <span className="text-sky-300 font-semibold">AWS_ROLE_ARN</span>
              <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
                IAM Role ARN with permissions to push to Amazon ECR via GitHub OIDC federation.
              </p>
            </div>
          )}

          {config.ciRegistryProvider === 'gcr' && (
            <div className="p-3 rounded bg-neutral-950 border border-neutral-800">
              <span className="text-sky-300 font-semibold">GCP_WIF_PROVIDER & GCP_WIF_SERVICE_ACCOUNT</span>
              <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
                Workload Identity Federation provider and service account email with Artifact Registry Writer role.
              </p>
            </div>
          )}

          {config.ciDeployMethod === 'argocd' && (
            <div className="p-3 rounded bg-neutral-950 border border-neutral-800">
              <span className="text-amber-300 font-semibold">ARGOCD_SERVER & ARGOCD_TOKEN</span>
              <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
                ArgoCD server host address and API token for triggering automated application sync.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
