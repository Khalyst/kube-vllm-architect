# KubeVLLM Architect: Step-by-Step Platform Guide 🚀

> **Comprehensive operational guide for designing, sizing, simulating, and deploying production LLM inference clusters on Kubernetes.**

---

## 📑 Table of Contents
1. [Introduction & Core Philosophy](#1-introduction--core-philosophy)
2. [Quick-Start: Using Production Blueprints](#2-quick-start-using-production-blueprints)
3. [Step 1: Model Selection & Precision Tuning](#3-step-1-model-selection--precision-tuning)
4. [Step 2: Hardware Sizing & VRAM Memory Budgeting](#4-step-2-hardware-sizing--vram-memory-budgeting)
5. [Step 3: Simulating Performance & The 4 Core Inference Metrics](#5-step-3-simulating-performance--the-4-core-inference-metrics)
6. [Step 4: Estimating Cloud Spend & Cost Arbitrage](#6-step-4-estimating-cloud-spend--cost-arbitrage)
7. [Step 5: Testing Smart Prefix Routing vs. Round-Robin](#7-step-5-testing-smart-prefix-routing-vs-round-robin)
8. [Step 6: Configuring KEDA GPU Autoscaling & Scale-to-Zero](#8-step-6-configuring-keda-gpu-autoscaling--scale-to-zero)
9. [Step 7: Validating Enterprise-Grade Guarantees](#9-step-7-validating-enterprise-grade-guarantees)
10. [Step 8: Setting Up CI/CD & Security Vulnerability Scanning](#10-step-8-setting-up-cicd--security-vulnerability-scanning)
11. [Step 9: Testing Client-Side WASM & Edge Guardrails](#11-step-9-testing-client-side-wasm--edge-guardrails)
12. [Step 10: Manifest Verification, Export & Deployment](#12-step-10-manifest-verification-export--deployment)

---

## 1. Introduction & Core Philosophy

**KubeVLLM Architect** bridges the gap between AI model development and production Kubernetes infrastructure engineering. 

Rather than manually authoring dozens of interrelated Kubernetes manifests and guessing GPU requirements, the platform provides:
- **Math-grounded sizing**: Deterministic calculation of model weights, CUDA runtime overhead, and KV cache pool capacity.
- **Traffic-aware simulation**: Real-time modeling of **TTFT**, **TPOT**, **Throughput**, and **End-to-End Latency**.
- **Modern Kubernetes standards**: Pure Kubernetes Gateway API (`gateway.networking.k8s.io/v1`) replacing end-of-life Ingress NGINX.
- **Enterprise SLA guarantees**: Automatic inclusion of PodDisruptionBudgets, multi-engine canary traffic splitting, and Prometheus alerting rules.

---

## 2. Quick-Start: Using Production Blueprints

At the top of the application, locate the **Architecture Blueprints** strip for 1-click configurations:

| Blueprint Button | Target Workload | Pre-Configured Hardware & Sizing |
| :--- | :--- | :--- |
| **DeepSeek-R1 Distill (2x H100)** | Reasoning & complex coding agents | 32B model, BF16 native precision, TP=2 on 2x NVIDIA H100 80GB, 32K context window, KEDA autoscaling enabled. |
| **Llama 3.3 70B AWQ (2x A100)** | High-throughput enterprise general chat | 70B model quantized to 4-bit AWQ, TP=2 on 2x NVIDIA A100 80GB, Prefix Caching active. |
| **Scale-to-Zero Qwen (1x L4)** | Cost-optimized internal tooling & off-peak workloads | 14B model on 1x NVIDIA L4 (24GB), KEDA `minReplicas: 0` for 100% idle cost savings. |
| **Qwen 2.5 72B (4x H100 TP=4)** | Maximum context reasoning & flagship API | 72B model, TP=4 across 4x NVIDIA H100 SXM5, Chunked Prefill enabled. |

---

## 3. Step 1: Model Selection & Precision Tuning

Navigate to the **Model & Hardware** tab:

1. **Select an AI Model**:
   - Choose from built-in presets (DeepSeek-R1, Llama 3.3, Qwen 2.5, Gemma 2, Mistral Small, Phi-4) or select **Custom Hugging Face / Model Store**.
2. **Choose Precision**:
   - **bfloat16 / float16 (16-bit)**: Maximum quality, ~2.0 GB per billion parameters.
   - **FP8 (8-bit)**: Hopper/Ada native acceleration, ~1.05 GB per billion parameters.
   - **AWQ / GPTQ (4-bit)**: Extreme memory compression, ~0.65 GB per billion parameters.
3. **Configure Model Source**:
   - **Hugging Face Hub**: Pulls weights directly using a Kubernetes secret for your Hugging Face API token.
   - **Pre-mounted PVC**: Uses high-speed Kubernetes Persistent Volumes with pre-downloaded weights to eliminate cold-start download delays.
   - **Cloud Object Storage (S3 / GCS)**: Downloads weights directly from private enterprise buckets.

---

## 4. Step 2: Hardware Sizing & VRAM Memory Budgeting

Under the **Hardware & GPU Sizing** section:

1. **Select GPU Accelerator**:
   - Choose from NVIDIA H100 SXM5, H200 (141GB), A100 (80GB/40GB), L40S, L4, A10G, T4, or AMD Instinct MI300X.
2. **Set Tensor Parallelism (TP)**:
   - TP shards model layers across multiple GPUs on the same node. Ensure your TP count evenly divides the number of attention heads.
3. **Inspect the VRAM Budget Breakdown Bar**:
   - **Red**: Static Model Weights in VRAM.
   - **Amber**: PyTorch/CUDA runtime overhead.
   - **Emerald**: Available PagedAttention KV Cache Pool (determines concurrent token capacity).
   - **OOM Warning**: If the bar exceeds 100%, increase TP or switch to AWQ/FP8.
4. **PyTorch Shared Memory (`/dev/shm`)**:
   - Ensure the `/dev/shm` slider is set to at least 16 GiB for multi-GPU NCCL inter-process communication.

---

## 5. Step 3: Simulating Performance & The 4 Core Inference Metrics

In the **Performance & Scalability Estimation** panel, experiment with the live sliders:

1. **Set Active Concurrency**: Adjust from 10 to 300 simultaneous users.
2. **Set Cache Hit Rate**: Adjust prefix caching effectiveness (0% cold to 95% warm).
3. **Select Prompt Size & Output Tokens**: Choose standard sizes (e.g. 1024 input / 256 output).
4. **Switch between the 4 Core Metric Tabs**:
   - **Throughput (tok/s)**: View how aggregate tokens processed per second scale linearly with replica pods, boosted by prefix caching.
   - **TTFT (Time To First Token)**: Compare warm prefix cache hits (~18 ms) against cold prefill (~200+ ms) and queue wait time.
   - **TPOT (Time Per Output Token)**: Measure autoregressive generation pacing (ms/token) and tokens/sec per user stream.
   - **End-to-End Latency**: View total turnaround time according to `E2E = Queue Delay + TTFT + (Tokens × TPOT)`.

---

## 6. Step 4: Estimating Cloud Spend & Cost Arbitrage

In the **Cloud Cost Estimation & Infrastructure TCO** panel:

1. **Select Cloud Provider**: Toggle between **AWS**, **GCP**, or **Azure**.
2. **Select Purchasing Model**:
   - **On-Demand**: Standard baseline pricing.
   - **Spot / Preemptible**: Up to 70% savings.
   - **1-Year Reserved / CUD**: Committed usage discounts.
3. **Adjust Daily Duty Cycle**: Simulate working-hour patterns (e.g. 10 hours/day vs. 24/7).
4. **Review Metrics**:
   - Monthly spend at minimum vs. maximum replicas.
   - Monthly dollar savings realized by KEDA autoscaling.
   - **Unit Cost per 1M Tokens**: Compare against proprietary API pricing.

---

## 7. Step 5: Testing Smart Prefix Routing vs. Round-Robin

Navigate to the **Architecture & KV Routing** tab:

1. **Choose Routing Strategy**:
   - **Smart Routing (Prefix Cache Affinity)**: Hashes incoming prompt prefixes and routes identical sessions to warm GPU pods.
   - **Dumb Routing (Round Robin)**: Distributes requests uniformly, wiping cache affinity.
2. **Click "Simulate Traffic Batch"**:
   - Watches 6 realistic enterprise prompts (legal reviews, coding sessions, generic queries) hit the cluster.
   - Observe **KV Cache Hits**, **Wasted Matrix Multiplications**, and **Average TTFT** in real time.

---

## 8. Step 6: Configuring KEDA GPU Autoscaling & Scale-to-Zero

Navigate to the **Autoscaling & KEDA** tab:

1. **Select Scaler Type**: Pick **KEDA (Event-Driven)** for production or standard HPA.
2. **Configure Scale-to-Zero**:
   - Set `minReplicas: 0` to shut down GPUs completely during idle periods.
   - Set `minReplicas: 1` if you require an always-warm replica with zero cold-start delay.
3. **Set Scaling Triggers**:
   - **Queue Depth (`vllm:num_requests_waiting`)**: Recommended threshold: 4 requests.
   - **KV Cache Saturation (`vllm:gpu_cache_usage_factor`)**: Recommended threshold: 85% (0.85).
4. **Tune Cooldown Period**: Recommended 300 seconds (5 minutes) to prevent GPU thrashing.

---

## 9. Step 7: Validating Enterprise-Grade Guarantees

Navigate to the **Enterprise Guarantees** tab:

1. **Pillar 1: Cost Control**:
   - Verify active engine optimizations (PagedAttention, Prefix Caching, FP8 KV Cache, Chunked Prefill).
   - Review live monthly cost arbitrage calculations.
2. **Pillar 2: Scalability (Monday Morning Spike Defense)**:
   - Configure **PodDisruptionBudget (PDB)** with `minAvailable: 1` so node drains never evict all active workers.
   - Click **"Simulate Monday Spike"** to test a sudden +450 req/s surge and watch the scaling reaction.
3. **Pillar 3: Experimentation & Engine Swapping**:
   - Change your **Primary Engine** (vLLM, TensorRT-LLM, ONNX Runtime GenAI, SGLang).
   - Enable the **Canary Engine** and set the traffic weight slider (e.g. 10% canary, 90% primary) to test new engines with zero client SDK changes.
4. **Pillar 4: Reliability & Day-2 Operations**:
   - Configure Prometheus `ServiceMonitor` polling intervals.
   - Set the `alertQueueBacklogThreshold` for firing `LLMQueueBacklogHigh` alerts.

---

## 10. Step 8: Setting Up CI/CD & Security Vulnerability Scanning

Navigate to the **CI/CD & GitOps** tab:

1. **Select Container Registry**:
   - GitHub Container Registry (GHCR), AWS ECR, Google Artifact Registry (GCR), Azure ACR, or Docker Hub.
2. **Configure Security Scanner**:
   - Select **Trivy** (Aqua Security), **Grype** (Anchore), or **Snyk**.
   - Choose failure severity: `CRITICAL` or `CRITICAL,HIGH`.
   - Enable **Block Pipeline on Critical Vulnerabilities** to stop infected images before they reach Kubernetes.
3. **Select Deployment Automation**:
   - **Direct Kubectl Rollout**: Runs `kubectl apply -k` and verifies rollout status.
   - **GitOps Sync**: Triggers ArgoCD or Flux application synchronization.
4. **Copy or Export Workflow**:
   - Workflows are automatically placed in `.github/workflows/deploy-vllm-stack.yml` and `pr-manifest-lint.yml`.

---

## 11. Step 9: Testing Client-Side WASM & Edge Guardrails

Navigate to the **WASM & Security** tab:

1. **Test In-Browser WASM Sanitization**:
   - Type or paste text containing simulated PII (Social Security Numbers, API keys, emails).
   - Run the client-side WebAssembly sanitizer to see instant redacting before data ever leaves the browser.
2. **Review Envoy WASM L7 Filter**:
   - Inspect the generated Envoy WASM filter for gateway-level prompt injection protection.
3. **Verify Cross-Origin Isolation**:
   - Review declarative `COOP` and `COEP` headers injected via standard Kubernetes Gateway API `HTTPRoute` filters.

---

## 12. Step 10: Manifest Verification, Export & Deployment

### Verification
1. Navigate to the **Lint & Verification** tab.
2. Confirm there are **0 Critical Errors**. If warnings appear (such as undersized `/dev/shm` or high canary weights), review the automated remediation advice.

### Export
1. Click the **Export All Manifests** button in the top navigation bar.
2. An archive named `<namespace>-k8s-manifests.zip` will download containing all 11 YAML manifests, Helm values, GitHub Actions workflows, and test scripts.

### Deploying to Your Cluster
Unpack the files and deploy using Kustomize:

```bash
# 1. Apply all resources into your cluster
kubectl apply -k ./vllm-serving

# 2. Monitor pod provisioning and GPU weight loading
kubectl get pods -n vllm-serving -w

# 3. Verify the PodDisruptionBudget is active
kubectl get pdb -n vllm-serving

# 4. Verify Gateway API HTTPRoutes
kubectl get httproute -n vllm-serving

# 5. Check KEDA ScaledObject status
kubectl get scaledobject -n vllm-serving

# 6. Execute the automated smoke test script
./vllm-serving/test-inference.sh localhost 80
```
