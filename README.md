# KubeVLLM Architect 🚀

> **Production Kubernetes Manifest Generator & Autoscaling Architect for vLLM, TensorRT-LLM, and ONNX Runtime GenAI with Smart KV Cache Routing, KEDA Event-Driven GPU Scaling, and Enterprise SLA Guarantees.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Kubernetes Gateway API](https://img.shields.io/badge/Kubernetes-Gateway_API_v1-326CE5.svg?logo=kubernetes&logoColor=white)](https://gateway-api.sigs.k8s.io/)
[![vLLM](https://img.shields.io/badge/vLLM-v0.7.x-orange.svg)](https://github.com/vllm-project/vllm)
[![Docker Compose](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![CI/CD Verified](https://img.shields.io/badge/GitHub_Actions-Trivy_Scanned-2088FF.svg?logo=github-actions&logoColor=white)](https://github.com/features/actions)

---

## 📖 Overview

Deploying large language models (LLMs) into production Kubernetes environments requires solving critical infrastructure challenges: sizing GPU VRAM, allocating PyTorch IPC shared memory (`/dev/shm`), tuning Tensor Parallelism (TP), configuring KEDA event-driven autoscaling, and preventing compute thrashing.

**KubeVLLM Architect** is an open-source visual architect and Kubernetes manifest generator that designs, tunes, and validates production-grade LLM inference clusters. It eliminates guesswork and generates 11 fully functional, validated manifests deployable via Kustomize (`kubectl apply -k .`), Helm, or GitOps pipelines (ArgoCD, Flux).

```
                      [Client Applications / OpenAI SDK]
                                      │
                                      ▼
             [Tier 1: Kubernetes Gateway API (Gateway & HTTPRoute)]
             (WASM Prompt Guardrails + Cross-Origin Isolation Headers)
                                      │
                                      ├──────────────────────────────┐
                    (Primary Route: e.g. 90%)         (Canary Route: e.g. 10%)
                                      │                              │
                                      ▼                              ▼
                 [Tier 2: vLLM Smart Prefix Router]    [Canary Engine Service]
                 (Consistent Prompt-Prefix Hashing)    (TensorRT-LLM / ONNX)
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        [Tier 3: GPU Worker 1]                [Tier 3: GPU Worker 2]
     ┌───────────────────────────┐         ┌───────────────────────────┐
     │ vLLM Engine (PagedAttn)   │         │ vLLM Engine (PagedAttn)   │
     │ Warm Prefix KV Cache Pool │         │ Fresh Prefill Context     │
     │ /dev/shm IPC Shared Memory│         │ /dev/shm IPC Shared Memory│
     │ Physical GPU (H100 / L40S)│         │ Physical GPU (H100 / L40S)│
     └───────────────────────────┘         └───────────────────────────┘
                   ▲                                     ▲
                   └──────────────────┬──────────────────┘
                                      │
                   [Tier 4: KEDA Scaler & SLA Telemetry]
     ┌─────────────────────────────────────────────────────────────────┐
     │ • KEDA ScaledObject: Triggers on vllm:num_requests_waiting      │
     │ • PodDisruptionBudget (PDB): Zero-downtime node drain guarantee │
     │ • Prometheus ServiceMonitor & SLA AlertRules (Queue / VRAM)     │
     └─────────────────────────────────────────────────────────────────┘
```

---

## 🏆 Enterprise-Grade Guarantees

KubeVLLM Architect provides guaranteed infrastructure contracts across four essential enterprise pillars:

| Pillar | Enterprise Challenge | KubeVLLM Guarantee & Implementation |
| :--- | :--- | :--- |
| **1. Cost Control** | Idle GPUs cost thousands of dollars per month; long prompts cause redundant prefill. | **Engine-Level Optimizations**: PagedAttention (0% internal fragmentation), KV Prefix Caching (`--enable-prefix-caching`), FP8 KV cache pools (`--kv-cache-dtype fp8`), Chunked Prefill, and KEDA Scale-to-Zero (`minReplicas: 0`) delivering up to **68% cloud spend reduction**. |
| **2. Scalability** | "Monday morning" 10x traffic spikes cause 503s, dropped connections, and cold-start latency. | **Spike-Hardened Serving Layer**: KEDA aggressive scale-up profile (`stabilizationWindowSeconds: 0`, 100% pod increase rate every 15s) combined with `PodDisruptionBudget` (`minAvailable: 1`) ensuring zero evictions during node drains. |
| **3. Experimentation** | Upgrading or swapping inference backends requires risky API migrations and code rewrites. | **Clean Decoupled Gateway API Layer**: Upstream clients talk to standard `/v1/chat/completions`. Gateway API `HTTPRoute` enables canary traffic splitting (e.g. 90% vLLM / 10% TensorRT-LLM / ONNX Runtime GenAI) with **zero client SDK or DNS modifications**. |
| **4. Reliability** | Hard-to-debug crashes, silent GPU OOMs, and unmonitored scheduler backlogs. | **Decoupled 4-Tier Operations & SLA Alerting**: Native Prometheus `ServiceMonitor` and `PrometheusRule` alerting on queue backlogs (`LLMQueueBacklogHigh`) and KV cache exhaustion (`LLMGpuCacheNearExhaustion`) with `/health` and `/v1/models` readiness probes. |

---

## ✨ Complete Feature Matrix

- **Interactive Architecture & KV Caching Simulator**: Visually demonstrates how prompt-prefix routing avoids redundant matrix multiplication (prefill phase) and cuts Time-to-First-Token (TTFT) by up to 80%.
- **GPU VRAM & Throughput Sizing Calculator**: Computes exact model weight footprints, CUDA overhead, available PagedAttention KV Cache pools, and max concurrent token capacity across NVIDIA H100, H200, A100, L40S, L4, A10G, T4, and AMD MI300X.
- **Universal AI-Agnostic Model Support**: One-click presets for DeepSeek-R1 Distill (32B / 8B), Llama 3.3 70B, Qwen 2.5 (72B / 14B), Mistral Small 24B, Gemma 2, Phi-4, DeepSeek-V3 671B MoE, or custom HuggingFace / S3 / PVC models.
- **Performance & Scalability Estimation (Recharts)**: Interactive charts modeling aggregate cluster throughput (tokens/s) and latency curves (TTFT & ITL) as pods scale out, comparing Smart Prefix Routing against cold prefill.
- **Cloud Cost Estimation & Infrastructure TCO**: Real-time monthly spend calculator comparing AWS EC2, GCP, and Azure pricing across On-Demand, Spot (up to 70% savings), and 1-Year Reserved/CUD tiers with interactive duty cycle and unit cost per 1M tokens.
- **Modern Kubernetes Gateway API (`gateway.networking.k8s.io/v1`)**: Future-proof architecture replacing legacy Ingress NGINX (EOL March 2026) with standard `Gateway` and `HTTPRoute` resources using declarative `ResponseHeaderModifier` filters for browser WASM / WebGPU Cross-Origin Isolation (`COOP` & `COEP`).
- **WASM Client Security & Envoy Guardrails**: Test client-side in-browser WASM PII redaction and generate Envoy WASM L7 prompt injection filters.
- **Production CI/CD Pipelines**: Pre-configured GitHub Actions workflows featuring Trivy container CVE vulnerability scanning, multi-registry publishing (GHCR, AWS ECR, GCP WIF, ACR), and automated Kustomize rollouts.
- **1-Click Export**: Download all manifests in a single ZIP package or apply directly using `kubectl apply -k .`.

---

## 🚀 Quick Start with Docker Compose (Recommended)

Run the application locally in seconds using Docker Compose:

```bash
# 1. Clone the repository
git clone https://github.com/your-username/kube-vllm-architect.git
cd kube-vllm-architect

# 2. Start the container in the background
docker compose up -d

# 3. Access the web interface
open http://localhost:3000
```

To stop the container:
```bash
docker compose down
```

---

## 💻 Local Development (Node.js)

If you prefer running without Docker:

```bash
# Prerequisites: Node.js 18+ and npm
npm install

# Start development server
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 📦 Generated Kubernetes Manifest Suite

The tool generates a complete, production-grade manifest package ready for GitOps (ArgoCD, Flux) or Kustomize:

| File | Resource Kind | Category | Description |
| :--- | :--- | :--- | :--- |
| `01-namespace-rbac.yaml` | `Namespace`, `ServiceAccount`, `Role`, `RoleBinding` | Core | Isolated namespace and RBAC permissions for pod and endpoint discovery |
| `02-storage-and-secrets.yaml` | `Secret`, `ConfigMap`, `PVC` | Storage | Hugging Face credentials, NCCL tuning variables, and model weight mounts |
| `03-vllm-deployment.yaml` | `Deployment` | Core | Core inference engine with `/dev/shm` IPC volume, GPU limits, and `/health` probes |
| `04-vllm-service.yaml` | `Service` (ClusterIP + Headless) | Core | High-performance ClusterIP service and Headless service for peer discovery |
| `05-vllm-smart-router.yaml` | `Deployment`, `Service`, `ConfigMap` | Routing | API Gateway implementing prompt-prefix hash routing to warm KV cache replicas |
| `06-keda-autoscaler.yaml` | `ScaledObject` | Autoscaling | KEDA autoscaler polling vLLM waiting queue depth and KV cache saturation (supports Scale-to-Zero) |
| `07-gpu-node-provisioner.yaml` | `NodePool`, `EC2NodeClass` | Infra | Karpenter (AWS) or GKE GPU node autoscaler specs with Spot capacity arbitrage |
| `08-gateway-api-and-wasm-security.yaml` | `Gateway`, `HTTPRoute`, `EnvoyFilter` | Routing | Kubernetes Gateway API with COOP/COEP headers and Envoy WASM prompt guardrail |
| `09-pod-disruption-budget.yaml` | `PodDisruptionBudget` | Enterprise SLA | Zero-downtime PDB ensuring minimum available pods during node draining & cluster maintenance |
| `10-multi-engine-canary-route.yaml` | `HTTPRoute` | Experimentation | Gateway API canary traffic splitting for live vLLM vs. TensorRT vs. ONNX experimentation |
| `11-observability-alerts-sla.yaml` | `ServiceMonitor`, `PrometheusRule` | Reliability | Production Prometheus metrics scraping and SLA breach alerting (queue depth, VRAM) |
| `deploy-vllm-stack.yml` | GitHub Actions Workflow | CI/CD | Automated CI/CD pipeline: Buildx, Trivy container CVE scanning, registry push, and kubectl rollout |
| `pr-manifest-lint.yml` | GitHub Actions Workflow | CI/CD | Pull Request validator: Kustomize dry-run, GPU limit verification, and `/dev/shm` IPC check |
| `kustomization.yaml` | `Kustomization` | Package | Master Kustomize manifest allowing `kubectl apply -k .` |
| `helm-values.yaml` | YAML | Package | Production values file compatible with standard vLLM Helm charts |
| `test-inference.sh` | Bash Script | Package | Pre-configured curl test verifying health, models, and streaming inference |

---

## ⚡ Applying to Your Kubernetes Cluster

Once exported from KubeVLLM Architect:

```bash
# 1. Apply the entire stack using Kustomize
kubectl apply -k ./vllm-serving

# 2. Check pod and GPU provisioning status
kubectl get pods -n vllm-serving -w

# 3. Check KEDA ScaledObject status
kubectl get scaledobject -n vllm-serving

# 4. Check PodDisruptionBudget SLA guard
kubectl get pdb -n vllm-serving

# 5. Check Gateway API routes
kubectl get httproute -n vllm-serving

# 6. Test inference via the Gateway
./vllm-serving/test-inference.sh localhost 80
```

---

## 🛡️ Security & Browser WASM

- **Linear Memory Sandbox**: WASM runs in an isolated linear memory space, preventing memory corruption or unauthorized host OS access.
- **Zero-Data-Leak Local Inference**: Execute lightweight client-side models or tokenizers locally via WebGPU/WASM to scrub PII before transmitting tokens to the cluster.
- **Cross-Origin Isolation**: Automated injection of `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers to protect against speculative execution side-channel attacks (Spectre).

---

## 🤝 Contributing

Contributions from MLOps, DevOps, and Kubernetes engineers are warmly welcomed!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/awesome-feature`)
3. Commit your Changes (`git commit -m 'Add awesome feature'`)
4. Push to the Branch (`git push origin feature/awesome-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **Apache 2.0 License**. See `LICENSE` for more information.
