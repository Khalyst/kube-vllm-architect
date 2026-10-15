# KubeVLLM Architect 🚀

> **Production Kubernetes Manifest Generator & Autoscaling Architect for vLLM with Smart KV Cache Routing, KEDA Event-Driven GPU Scaling, and AI-Agnostic Model Serving.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Kubernetes Gateway API](https://img.shields.io/badge/Kubernetes-Gateway_API_v1-326CE5.svg?logo=kubernetes&logoColor=white)](https://gateway-api.sigs.k8s.io/)
[![vLLM](https://img.shields.io/badge/vLLM-v0.7.x-orange.svg)](https://github.com/vllm-project/vllm)
[![Docker Compose](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)

---

## 📖 Overview

Deploying large language models (LLMs) on Kubernetes with **vLLM** requires navigating complex infrastructure decisions: sizing GPU VRAM, allocating PyTorch IPC shared memory (`/dev/shm`), tuning Tensor Parallelism (TP), configuring KEDA autoscaling on waiting queues, and avoiding catastrophic compute waste from round-robin routing.

**KubeVLLM Architect** is an open-source visual architect and manifest generator that automates this entire stack. It produces production-ready, validated YAML manifests and provides an interactive simulation of **Smart Prefix Routing** vs. **Dumb Round-Robin Routing**.

```
[Client Traffic] ───► [Kubernetes Gateway API (Gateway & HTTPRoute)]
                             │
                             ▼
               [API Gateway / vLLM Router]
             (Consistent Prompt-Prefix Hashing)
                 │                       │
      (Prefix Match: Warm Cache)   (Cold Prefix)
                 │                       │
                 ▼                       ▼
      [GPU Worker Replica 1]   [GPU Worker Replica 2]
         ┌──────────────┐         ┌──────────────┐
         │ Open Weights │         │ Open Weights │
         │ vLLM Engine  │         │ vLLM Engine  │
         │ Warm KV Cache│         │ Fresh Prefill│
         │ Physical GPU │         │ Physical GPU │
         └──────────────┘         └──────────────┘
                 ▲                       ▲
                 └───────────┬───────────┘
                             │
               [KEDA ScaledObject Auto-Scaler]
         (Triggers on vllm:num_requests_waiting &
              vllm:gpu_cache_usage_factor)
```

---

## ✨ Key Features

- **Interactive Architecture & KV Caching Simulator**: Visually demonstrates how prompt-prefix routing avoids redundant matrix multiplication (prefill phase) and cuts Time-to-First-Token (TTFT) by up to 80%.
- **GPU VRAM & Throughput Sizing Calculator**: Computes exact model weight footprints, CUDA overhead, available PagedAttention KV Cache pools, and max concurrent token capacity across NVIDIA H100, H200, A100, L40S, L4, A10G, T4, and AMD MI300X.
- **Universal AI-Agnostic Model Support**: One-click presets for DeepSeek-R1 Distill (32B / 8B), Llama 3.3 70B, Qwen 2.5 (72B / 14B), Mistral Small 24B, Gemma 2, Phi-4, DeepSeek-V3 671B MoE, or custom HuggingFace / S3 / PVC models.
- **KEDA Event-Driven Autoscaling**: Scales GPU worker pods dynamically based on live Prometheus metrics (`vllm:num_requests_waiting` and `vllm:gpu_cache_usage_factor`), with full **Scale-to-Zero ($0 idle GPU cost)** support.
- **Modern Kubernetes Gateway API (`gateway.networking.k8s.io/v1`)**: Future-proof architecture replacing legacy Ingress NGINX (EOL March 2026) with standard `Gateway` and `HTTPRoute` resources using declarative `ResponseHeaderModifier` filters for browser WASM / WebGPU Cross-Origin Isolation (`COOP` & `COEP`).
- **WASM Client Security & Envoy Guardrails**: Test client-side in-browser WASM PII redaction and generate Envoy WASM L7 prompt injection filters.
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

| File | Resource Kind | Description |
| :--- | :--- | :--- |
| `01-namespace-rbac.yaml` | `Namespace`, `ServiceAccount`, `Role`, `RoleBinding` | Isolated namespace and RBAC permissions for pod discovery |
| `02-storage-and-secrets.yaml` | `Secret`, `ConfigMap`, `PVC` | Hugging Face credentials, NCCL tuning, and model weight mounts |
| `03-vllm-deployment.yaml` | `Deployment` | Core inference engine with `/dev/shm` IPC volume, GPU limits, and `/health` probes |
| `04-vllm-service.yaml` | `Service` (ClusterIP + Headless) | High-performance ClusterIP service and Headless service for peer discovery |
| `05-vllm-smart-router.yaml` | `Deployment`, `Service`, `ConfigMap` | API Gateway implementing prompt-prefix hash routing |
| `06-keda-autoscaler.yaml` | `ScaledObject` | KEDA autoscaler polling vLLM waiting queue depth and KV cache saturation |
| `07-gpu-node-provisioner.yaml` | `NodePool`, `EC2NodeClass` | Karpenter (AWS) or GKE GPU node autoscaler specs |
| `08-gateway-api-and-wasm-security.yaml` | `Gateway`, `HTTPRoute`, `EnvoyFilter` | Kubernetes Gateway API with COOP/COEP headers and Envoy WASM guardrail |
| `deploy-vllm-stack.yml` | GitHub Actions Workflow | Automated CI/CD pipeline: Buildx, Trivy container CVE scanning, registry push, and kubectl rollout |
| `pr-manifest-lint.yml` | GitHub Actions Workflow | Pull Request validator: Kustomize dry-run, GPU limit verification, and `/dev/shm` IPC check |
| `kustomization.yaml` | `Kustomization` | Master Kustomize manifest allowing `kubectl apply -k .` |
| `helm-values.yaml` | YAML | Production values file compatible with standard vLLM Helm charts |
| `test-inference.sh` | Bash Script | Pre-configured curl test verifying health, models, and streaming inference |

---

## ⚡ Applying to Your Kubernetes Cluster

Once exported from KubeVLLM Architect:

```bash
# Apply the entire stack using Kustomize
kubectl apply -k ./vllm-serving

# Check pod and GPU provisioning status
kubectl get pods -n vllm-serving -w

# Check KEDA ScaledObject status
kubectl get scaledobject -n vllm-serving

# Test inference via the Gateway
./vllm-serving/test-inference.sh localhost 80
```

---

## 🛡️ Security & Browser WASM

- **Linear Memory Sandbox**: WASM runs in an isolated linear memory space, preventing memory corruption or unauthorized host OS access.
- **Zero-Data-Leak Local Inference**: Execute lightweight client-side models or tokenizers locally via WebGPU/WASM to scrub PII before transmitting tokens to the cluster.
- **Cross-Origin Isolation**: Automated injection of `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers to protect against speculative execution side-channel attacks (Spectre).

---

## 🤝 Contributing

Contributions from MLOps and Kubernetes engineers are warmly welcomed!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/awesome-feature`)
3. Commit your Changes (`git commit -m 'Add awesome feature'`)
4. Push to the Branch (`git push origin feature/awesome-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **Apache 2.0 License**. See `LICENSE` for more information.
