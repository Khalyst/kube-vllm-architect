import { AppConfig, GeneratedFile, ModelPreset } from '../types';
import { GPU_SPECS } from '../data/gpus';

export function generateAllManifests(config: AppConfig, preset: ModelPreset): GeneratedFile[] {
  const gpu = GPU_SPECS.find((g) => g.id === config.selectedGpuId) || GPU_SPECS[0];
  const modelIdentifier = config.modelId === 'custom-model' ? config.customRepoId : preset.repoId;
  const servedName = config.servedModelName || modelIdentifier.split('/').pop() || 'llm-model';
  const totalGpus = config.tensorParallelSize * config.pipelineParallelSize;

  const files: GeneratedFile[] = [];

  // 1. Namespace & RBAC
  const namespaceRbac = `apiVersion: v1
kind: Namespace
metadata:
  name: ${config.namespace}
  labels:
    app.kubernetes.io/part-of: vllm-serving-stack
    app.kubernetes.io/managed-by: kube-vllm-architect
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: vllm-sa
  namespace: ${config.namespace}
  labels:
    app.kubernetes.io/name: vllm-engine
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: vllm-reader-role
  namespace: ${config.namespace}
rules:
- apiGroups: [""]
  resources: ["pods", "services", "endpoints", "configmaps"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: vllm-reader-binding
  namespace: ${config.namespace}
subjects:
- kind: ServiceAccount
  name: vllm-sa
  namespace: ${config.namespace}
roleRef:
  kind: Role
  name: vllm-reader-role
  apiGroup: rbac.authorization.k8s.io
`;

  files.push({
    name: '01-namespace-rbac.yaml',
    path: `${config.namespace}/01-namespace-rbac.yaml`,
    category: 'core',
    content: namespaceRbac,
    description: 'Kubernetes Namespace, ServiceAccount, and RBAC reader roles for pod discovery.'
  });

  // 2. Storage & Secrets
  let storageSecrets = `apiVersion: v1
kind: Secret
metadata:
  name: ${config.hfTokenSecretName}
  namespace: ${config.namespace}
type: Opaque
stringData:
  ${config.hfTokenSecretKey}: "hf_PLACEHOLDER_TOKEN_REPLACE_ME"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: vllm-runtime-config
  namespace: ${config.namespace}
data:
  VLLM_LOGGING_LEVEL: "INFO"
  NCCL_DEBUG: "WARN"
  NCCL_IB_DISABLE: "0"
  VLLM_ENGINE_ITERATION_TIMEOUT_S: "60"
  OMP_NUM_THREADS: "8"
`;

  if (config.modelSource === 'pvc') {
    storageSecrets += `---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${config.pvcName}
  namespace: ${config.namespace}
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 250Gi
  storageClassName: efs-sc # or premium-rwx / fast-nvme
`;
  }

  files.push({
    name: '02-storage-and-secrets.yaml',
    path: `${config.namespace}/02-storage-and-secrets.yaml`,
    category: 'storage',
    content: storageSecrets,
    description: 'Hugging Face auth token secret, persistent storage PVC (if selected), and NCCL/vLLM environment settings.'
  });

  // Build CLI arguments for vLLM
  const vllmArgs: string[] = [
    '--model', modelIdentifier,
    '--served-model-name', servedName,
    '--tensor-parallel-size', String(config.tensorParallelSize),
    '--max-model-len', String(config.maxModelLen),
    '--gpu-memory-utilization', String(config.gpuMemoryUtilization),
    '--port', '8000',
    '--host', '0.0.0.0',
    '--max-num-seqs', String(config.maxNumSeqs)
  ];

  if (config.pipelineParallelSize > 1) {
    vllmArgs.push('--pipeline-parallel-size', String(config.pipelineParallelSize));
  }

  if (config.precision !== 'bfloat16') {
    if (config.precision === 'awq' || config.precision === 'gptq') {
      vllmArgs.push('--quantization', config.precision);
    } else if (config.precision === 'fp8') {
      vllmArgs.push('--quantization', 'fp8');
      vllmArgs.push('--dtype', 'auto');
    } else if (config.precision === 'float16') {
      vllmArgs.push('--dtype', 'float16');
    }
  } else {
    vllmArgs.push('--dtype', 'bfloat16');
  }

  if (config.enablePrefixCaching) {
    vllmArgs.push('--enable-prefix-caching');
  }

  if (config.enableChunkedPrefill) {
    vllmArgs.push('--enable-chunked-prefill');
  }

  if (config.kvCacheDtype === 'fp8') {
    vllmArgs.push('--kv-cache-dtype', 'fp8');
  }

  if (config.enforceEager) {
    vllmArgs.push('--enforce-eager');
  }

  if (config.speculativeModel && config.numSpeculativeTokens > 0) {
    vllmArgs.push('--speculative-model', config.speculativeModel);
    vllmArgs.push('--num-speculative-tokens', String(config.numSpeculativeTokens));
  }

  // 3. vLLM Engine Deployment
  const formattedArgs = vllmArgs.map((arg) => `        - "${arg}"`).join('\n');

  const vllmDeployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${config.deploymentName}
  namespace: ${config.namespace}
  labels:
    app.kubernetes.io/name: vllm-engine
    app.kubernetes.io/instance: ${config.deploymentName}
    app.kubernetes.io/component: inference
spec:
  replicas: ${config.enableAutoscaling ? config.minReplicas : 1}
  selector:
    matchLabels:
      app.kubernetes.io/name: vllm-engine
      app.kubernetes.io/instance: ${config.deploymentName}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: vllm-engine
        app.kubernetes.io/instance: ${config.deploymentName}
        app.kubernetes.io/component: inference
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: vllm-sa
      terminationGracePeriodSeconds: 120
      containers:
      - name: vllm-server
        image: ${config.containerImage}:${config.containerTag}
        imagePullPolicy: IfNotPresent
        command: ["python3", "-m", "vllm.entrypoints.openai.api_server"]
        args:
${formattedArgs}
        ports:
        - name: http
          containerPort: 8000
          protocol: TCP
        env:
        - name: HUGGING_FACE_HUB_TOKEN
          valueFrom:
            secretKeyRef:
              name: ${config.hfTokenSecretName}
              key: ${config.hfTokenSecretKey}
              optional: true
        - name: HF_HOME
          value: /root/.cache/huggingface
        envFrom:
        - configMapRef:
            name: vllm-runtime-config
        resources:
          limits:
            nvidia.com/gpu: "${totalGpus}"
            cpu: "${config.cpuLimit}"
            memory: "${config.memoryLimitGi}Gi"
          requests:
            nvidia.com/gpu: "${totalGpus}"
            cpu: "${config.cpuRequest}"
            memory: "${config.memoryRequestGi}Gi"
        # Crucial for PyTorch IPC and multi-GPU NCCL tensor parallel execution
        volumeMounts:
        - name: dshm
          mountPath: /dev/shm
        - name: model-cache
          mountPath: /root/.cache/huggingface
        # Probes ensure traffic is only routed when KV cache & model weights are fully loaded into GPU
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 45
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 6
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 120
          periodSeconds: 15
          timeoutSeconds: 5
          failureThreshold: 3
      volumes:
      - name: dshm
        emptyDir:
          medium: Memory
          sizeLimit: ${config.shmSizeGi}Gi
      - name: model-cache
        ${
          config.modelSource === 'pvc'
            ? `persistentVolumeClaim:\n          claimName: ${config.pvcName}`
            : 'emptyDir: {}'
        }
      tolerations:
      - key: "${config.gpuTolerationKey}"
        operator: "Exists"
        effect: "NoSchedule"
      nodeSelector:
        ${config.nodeSelectorKey}: "${config.nodeSelectorValue}"
`;

  files.push({
    name: '03-vllm-deployment.yaml',
    path: `${config.namespace}/03-vllm-deployment.yaml`,
    category: 'core',
    content: vllmDeployment,
    description: `Primary vLLM engine Deployment configured for ${totalGpus}x ${gpu.name} with PyTorch /dev/shm IPC memory.`
  });

  // 4. Services (ClusterIP & Headless)
  const serviceManifest = `apiVersion: v1
kind: Service
metadata:
  name: ${config.deploymentName}-svc
  namespace: ${config.namespace}
  labels:
    app.kubernetes.io/name: vllm-engine
    app.kubernetes.io/instance: ${config.deploymentName}
spec:
  type: ClusterIP
  ports:
  - name: http-inference
    port: ${config.servicePort}
    targetPort: 8000
    protocol: TCP
  selector:
    app.kubernetes.io/name: vllm-engine
    app.kubernetes.io/instance: ${config.deploymentName}
---
# Headless service for peer discovery and smart router replica tracking
apiVersion: v1
kind: Service
metadata:
  name: ${config.deploymentName}-headless
  namespace: ${config.namespace}
  labels:
    app.kubernetes.io/name: vllm-engine
    app.kubernetes.io/instance: ${config.deploymentName}
spec:
  clusterIP: None
  publishNotReadyAddresses: false
  ports:
  - name: http-inference
    port: 8000
    targetPort: 8000
  selector:
    app.kubernetes.io/name: vllm-engine
    app.kubernetes.io/instance: ${config.deploymentName}
`;

  files.push({
    name: '04-vllm-service.yaml',
    path: `${config.namespace}/04-vllm-service.yaml`,
    category: 'core',
    content: serviceManifest,
    description: 'ClusterIP service for inference traffic and Headless service for smart router pod tracking.'
  });

  // 5. Smart Router / API Gateway (KV Caching affinity)
  const routerManifest = `apiVersion: v1
kind: ConfigMap
metadata:
  name: vllm-router-config
  namespace: ${config.namespace}
data:
  router_config.yaml: |
    # vLLM Smart Prefix-Aware Router Configuration
    # Eliminates redundant matrix multiplication by routing identical prompt prefixes to cached replicas
    strategy: ${config.routingStrategy === 'smart_prefix' ? 'prefix_cache_affinity' : 'round_robin'}
    backend_service: "${config.deploymentName}-headless.${config.namespace}.svc.cluster.local:8000"
    health_check_path: "/health"
    prefix_caching:
      enabled: ${config.enablePrefixCaching}
      hash_algorithm: "sha256"
      min_prefix_tokens: 64
      session_affinity_header: "${config.sessionAffinityHeader}"
    metrics:
      prometheus_port: 9090
      track_kv_cache_hits: true
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-smart-router
  namespace: ${config.namespace}
  labels:
    app.kubernetes.io/name: vllm-router
    app.kubernetes.io/component: api-gateway
spec:
  replicas: ${config.routerReplicas}
  selector:
    matchLabels:
      app.kubernetes.io/name: vllm-router
  template:
    metadata:
      labels:
        app.kubernetes.io/name: vllm-router
        app.kubernetes.io/component: api-gateway
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      containers:
      - name: router
        image: ghcr.io/vllm-project/vllm-router:latest
        imagePullPolicy: IfNotPresent
        args:
        - "--config"
        - "/etc/vllm-router/router_config.yaml"
        - "--port"
        - "80"
        ports:
        - name: http-gateway
          containerPort: 80
        - name: metrics
          containerPort: 9090
        resources:
          limits:
            cpu: "2"
            memory: "2Gi"
          requests:
            cpu: "500m"
            memory: "512Mi"
        volumeMounts:
        - name: config
          mountPath: /etc/vllm-router
        livenessProbe:
          httpGet:
            path: /healthz
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /healthz
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: config
        configMap:
          name: vllm-router-config
---
apiVersion: v1
kind: Service
metadata:
  name: vllm-smart-router-gateway
  namespace: ${config.namespace}
  labels:
    app.kubernetes.io/name: vllm-router
spec:
  type: LoadBalancer
  ports:
  - name: http
    port: 80
    targetPort: 80
  selector:
    app.kubernetes.io/name: vllm-router
`;

  files.push({
    name: '05-vllm-smart-router.yaml',
    path: `${config.namespace}/05-vllm-smart-router.yaml`,
    category: 'routing',
    content: routerManifest,
    description: 'Smart API Gateway with Prefix Cache Affinity to route prompts to warm KV cache replicas.'
  });

  // 6. Autoscaling (KEDA or HPA)
  if (config.autoscalerType === 'keda') {
    const kedaManifest = `apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: vllm-gpu-scaledobject
  namespace: ${config.namespace}
  labels:
    app.kubernetes.io/name: vllm-engine
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${config.deploymentName}
  minReplicaCount: ${config.minReplicas} # Supports 0 for scale-to-zero GPU cost efficiency
  maxReplicaCount: ${config.maxReplicas}
  cooldownPeriod: ${config.kedaCooldownPeriod} # 5 minutes cooldown to avoid GPU churn
  pollingInterval: 15 # Poll Prometheus metrics every 15 seconds
  advanced:
    restoreToOriginalReplicaCount: false
    horizontalPodAutoscalerConfig:
      behavior:
        scaleUp:
          stabilizationWindowSeconds: 0
          policies:
          - type: Percent
            value: 100
            periodSeconds: 15
        scaleDown:
          stabilizationWindowSeconds: ${config.kedaCooldownPeriod}
          policies:
          - type: Pods
            value: 1
            periodSeconds: 60
  triggers:
  # Trigger 1: vLLM Request Queue Backlog
  # Scales up immediately when requests are waiting in the PagedAttention queue
  - type: prometheus
    metadata:
      serverAddress: ${config.prometheusAddress}
      metricName: vllm_num_requests_waiting
      threshold: "${config.kedaQueueThreshold}"
      query: |
        sum(vllm:num_requests_waiting{namespace="${config.namespace}", deployment="${config.deploymentName}"}) or vector(0)
  # Trigger 2: GPU KV Cache Saturation Factor
  # Scales out when replica KV cache utilization exceeds threshold (${Math.round(config.kedaCacheUsageThreshold * 100)}%)
  - type: prometheus
    metadata:
      serverAddress: ${config.prometheusAddress}
      metricName: vllm_gpu_cache_usage_factor
      threshold: "${config.kedaCacheUsageThreshold}"
      query: |
        avg(vllm:gpu_cache_usage_factor{namespace="${config.namespace}", deployment="${config.deploymentName}"}) or vector(0)
`;

    files.push({
      name: '06-keda-autoscaler.yaml',
      path: `${config.namespace}/06-keda-autoscaler.yaml`,
      category: 'autoscaling',
      content: kedaManifest,
      description: 'KEDA ScaledObject with Prometheus triggers on vLLM queue depth and GPU KV cache usage.'
    });
  } else {
    // Kubernetes native HPA
    const hpaManifest = `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${config.deploymentName}-hpa
  namespace: ${config.namespace}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${config.deploymentName}
  minReplicas: ${Math.max(1, config.minReplicas)}
  maxReplicas: ${config.maxReplicas}
  metrics:
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: ${config.kedaCooldownPeriod}
    scaleUp:
      stabilizationWindowSeconds: 0
`;
    files.push({
      name: '06-kubernetes-hpa.yaml',
      path: `${config.namespace}/06-kubernetes-hpa.yaml`,
      category: 'autoscaling',
      content: hpaManifest,
      description: 'Native Kubernetes HorizontalPodAutoscaler for replica scaling.'
    });
  }

  // 7. Cloud Hardware / Karpenter NodePool
  let cloudInfraManifest = '';
  if (config.cloudPlatform === 'aws') {
    cloudInfraManifest = `apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: vllm-gpu-nodepool
spec:
  template:
    metadata:
      labels:
        accelerator: nvidia
        gpu-model: "${gpu.id}"
    spec:
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: vllm-gpu-nodeclass
      requirements:
        - key: "karpenter.k8s.aws/instance-family"
          operator: In
          values: ["${gpu.awsInstance.split('.')[0] || 'g5'}", "p4de", "p5"]
        - key: "karpenter.sh/capacity-type"
          operator: In
          values: ["on-demand", "spot"]
        - key: "kubernetes.io/arch"
          operator: In
          values: ["amd64"]
      taints:
        - key: "${config.gpuTolerationKey}"
          value: "true"
          effect: NoSchedule
  disruption:
    consolidationPolicy: WhenEmpty
    consolidateAfter: 5m
---
apiVersion: karpenter.k8s.aws/v1
kind: EC2NodeClass
metadata:
  name: vllm-gpu-nodeclass
spec:
  amiFamily: AL2
  role: "KarpenterNodeRole-Cluster"
  subnetSelectorTerms:
    - tags:
        karpenter.sh/discovery: "vllm-cluster"
  securityGroupSelectorTerms:
    - tags:
        karpenter.sh/discovery: "vllm-cluster"
  blockDeviceMappings:
    - deviceName: /dev/xvda
      ebs:
        volumeSize: 200Gi
        volumeType: gp3
        iops: 10000
        throughput: 500
`;
  } else if (config.cloudPlatform === 'gcp') {
    cloudInfraManifest = `# Google Kubernetes Engine (GKE) GPU Node Pool Provisioning command
# gcloud container node-pools create vllm-gpu-pool \\
#   --cluster=vllm-cluster \\
#   --machine-type=${gpu.gcpInstance.split(' ')[0]} \\
#   --accelerator=type=nvidia-${gpu.name.toLowerCase().includes('h100') ? 'h100-80gb' : gpu.name.toLowerCase().includes('l4') ? 'l4' : 'tesla-a100'},count=${totalGpus} \\
#   --enable-autoscaling --min-nodes=0 --max-nodes=${config.maxReplicas} \\
#   --node-taints=${config.gpuTolerationKey}=true:NoSchedule \\
#   --enable-image-streaming
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: nvidia
handler: nvidia
`;
  } else {
    cloudInfraManifest = `# Generic NVIDIA GPU Operator ClusterPolicy check
apiVersion: nvidia.com/v1
kind: ClusterPolicy
metadata:
  name: gpu-cluster-policy
spec:
  operator:
    defaultRuntime: containerd
  daemonsets:
    tolerations:
    - key: "${config.gpuTolerationKey}"
      operator: Exists
      effect: NoSchedule
`;
  }

  files.push({
    name: '07-gpu-node-provisioner.yaml',
    path: `${config.namespace}/07-gpu-node-provisioner.yaml`,
    category: 'infrastructure',
    content: cloudInfraManifest,
    description: `Cloud GPU auto-provisioner (${config.cloudPlatform.toUpperCase()}) for dynamically provisioning ${gpu.name} instances.`
  });

  // 8. Modern Kubernetes Gateway API (Gateway & HTTPRoute) with WASM Security Guardrail
  // Replaces legacy Ingress NGINX (EOL March 2026) with standard Gateway API (NGINX Gateway Fabric / kgateway)
  const wasmSecurityManifest = `apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: vllm-api-gateway
  namespace: ${config.namespace}
  labels:
    app.kubernetes.io/name: vllm-gateway
    app.kubernetes.io/component: ingress-gateway
spec:
  # Supported controllers: nginx (NGINX Gateway Fabric), kgateway (Envoy/Gloo), or istio
  gatewayClassName: nginx
  listeners:
  - name: http
    port: 80
    protocol: HTTP
    allowedRoutes:
      namespaces:
        from: Same
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: vllm-inference-route
  namespace: ${config.namespace}
  labels:
    app.kubernetes.io/name: vllm-gateway
spec:
  parentRefs:
  - name: vllm-api-gateway
    sectionName: http
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /
    # Standard Gateway API filter setting browser Cross-Origin Isolation headers
    # Replaces legacy NGINX annotation snippets with declarative Kubernetes Gateway standards
    filters:
    - type: ResponseHeaderModifier
      responseHeaderModifier:
        add:
        - name: Cross-Origin-Opener-Policy
          value: same-origin
        - name: Cross-Origin-Embedder-Policy
          value: require-corp
        - name: Content-Security-Policy
          value: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:;"
        - name: X-Content-Type-Options
          value: nosniff
    backendRefs:
    - name: vllm-smart-router-gateway
      port: 80
      weight: 100
---
# Envoy WASM L7 Prompt Inspection & Guardrail Filter
apiVersion: networking.istio.io/v1alpha3
kind: EnvoyFilter
metadata:
  name: vllm-wasm-security-guardrail
  namespace: ${config.namespace}
spec:
  workloadSelector:
    labels:
      app.kubernetes.io/name: vllm-router
  configPatches:
  - applyTo: HTTP_FILTER
    match:
      context: SIDECAR_INBOUND
      listener:
        filterChain:
          filter:
            name: "envoy.filters.network.http_connection_manager"
            subFilter:
              name: "envoy.filters.http.router"
    patch:
      operation: INSERT_BEFORE
      value:
        name: envoy.filters.http.wasm
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.http.wasm.v3.Wasm
          config:
            name: "wasm_prompt_guardrail"
            root_id: "prompt_injection_sanitizer"
            configuration:
              "@type": type.googleapis.com/google.protobuf.StringValue
              value: |
                {
                  "block_prompt_injection": true,
                  "mask_pii_at_edge": true,
                  "max_token_length": ${config.maxModelLen}
                }
            vm_config:
              vm_id: "wasm_sec_vm"
              runtime: "envoy.wasm.runtime.v8"
              code:
                local:
                  filename: "/etc/envoy/wasm/prompt_guard.wasm"
`;

  files.push({
    name: '08-gateway-api-and-wasm-security.yaml',
    path: `${config.namespace}/08-gateway-api-and-wasm-security.yaml`,
    category: 'routing',
    content: wasmSecurityManifest,
    description: 'Kubernetes Gateway API (Gateway & HTTPRoute) with standard ResponseHeaderModifier for WASM COOP/COEP isolation and Envoy WASM prompt filter.'
  });

  // 09. Enterprise Scalability Guarantee: PodDisruptionBudget for Zero-Downtime Node Maintenance
  const pdbManifest = `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ${config.deploymentName}-pdb
  namespace: ${config.namespace}
  labels:
    app.kubernetes.io/name: vllm-engine
    app.kubernetes.io/part-of: enterprise-sla-guarantee
spec:
  minAvailable: ${config.pdbMinAvailable || 1}
  selector:
    matchLabels:
      app.kubernetes.io/name: vllm-engine
      app.kubernetes.io/instance: ${config.deploymentName}
`;

  files.push({
    name: '09-pod-disruption-budget.yaml',
    path: `${config.namespace}/09-pod-disruption-budget.yaml`,
    category: 'core',
    content: pdbManifest,
    description: 'Enterprise Scalability Guarantee: PodDisruptionBudget ensuring minimum available replicas during Karpenter node reclaims or cluster upgrades.'
  });

  // 10. Enterprise Experimentation Guarantee: Multi-Engine Canary & Traffic Splitting
  const canaryManifest = `# Enterprise Experimentation Guarantee:
# Clean Decoupled Serving Layer allows zero-downtime A/B testing and engine swapping
# (vLLM vs. TensorRT-LLM vs. ONNX Runtime GenAI) behind the exact same upstream API endpoint.
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: vllm-multi-engine-experiment
  namespace: ${config.namespace}
  labels:
    app.kubernetes.io/name: vllm-gateway
    app.kubernetes.io/part-of: enterprise-experimentation
spec:
  parentRefs:
  - name: vllm-api-gateway
    sectionName: http
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /v1/chat/completions
    backendRefs:
    - name: ${config.deploymentName}-svc
      port: ${config.servicePort}
      weight: ${config.canaryEngine !== 'none' ? 100 - config.canaryTrafficWeight : 100}
    ${
      config.canaryEngine !== 'none'
        ? `- name: ${config.canaryEngine}-inference-svc
      port: 8000
      weight: ${config.canaryTrafficWeight}`
        : '# Canary engine disabled: 100% routed to primary vLLM inference engine'
    }
`;

  files.push({
    name: '10-multi-engine-canary-route.yaml',
    path: `${config.namespace}/10-multi-engine-canary-route.yaml`,
    category: 'routing',
    content: canaryManifest,
    description: 'Enterprise Experimentation Guarantee: Gateway API traffic splitting allowing live comparison of vLLM vs. TensorRT-LLM vs. ONNX without client changes.'
  });

  // 11. Enterprise Reliability Guarantee: Prometheus ServiceMonitor & SLA Alert Rules
  const observabilityManifest = `# Enterprise Reliability Guarantee:
# Decoupled architecture with Prometheus ServiceMonitor and SLA breach alerting rules.
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ${config.deploymentName}-monitor
  namespace: ${config.namespace}
  labels:
    release: prometheus
    app.kubernetes.io/name: vllm-engine
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: vllm-engine
  endpoints:
  - port: http-inference
    path: /metrics
    interval: 15s
---
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: vllm-sla-alerts
  namespace: ${config.namespace}
  labels:
    role: alert-rules
    app.kubernetes.io/part-of: enterprise-reliability
spec:
  groups:
  - name: vllm.sla.rules
    rules:
    - alert: LLMQueueBacklogHigh
      expr: sum(vllm:num_requests_waiting{namespace="${config.namespace}"}) > ${config.alertQueueBacklogThreshold || 10}
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "Inference queue backlog exceeded SLA threshold (${config.alertQueueBacklogThreshold || 10} requests)"
        description: "Monday morning spike or traffic surge detected. Requests are waiting in vLLM scheduler queue. Check autoscaling."
    - alert: LLMGpuCacheNearExhaustion
      expr: avg(vllm:gpu_cache_usage_factor{namespace="${config.namespace}"}) > 0.95
      for: 1m
      labels:
        severity: warning
      annotations:
        summary: "GPU KV Cache allocation > 95%"
        description: "PagedAttention KV blocks are near exhaustion. Recommend enabling FP8 KV cache or increasing max replica count."
`;

  files.push({
    name: '11-observability-alerts-sla.yaml',
    path: `${config.namespace}/11-observability-alerts-sla.yaml`,
    category: 'infrastructure',
    content: observabilityManifest,
    description: 'Enterprise Reliability Guarantee: Prometheus ServiceMonitor and production alerting rules for SLA and queue depth compliance.'
  });

  // 12. Kustomization package
  const kustomizeManifest = `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: ${config.namespace}

resources:
  - 01-namespace-rbac.yaml
  - 02-storage-and-secrets.yaml
  - 03-vllm-deployment.yaml
  - 04-vllm-service.yaml
  - 05-vllm-smart-router.yaml
  - 06-${config.autoscalerType === 'keda' ? 'keda-autoscaler' : 'kubernetes-hpa'}.yaml
  - 07-gpu-node-provisioner.yaml
  - 08-gateway-api-and-wasm-security.yaml
  - 09-pod-disruption-budget.yaml
  - 10-multi-engine-canary-route.yaml
  - 11-observability-alerts-sla.yaml

commonLabels:
  app.kubernetes.io/part-of: vllm-production-stack
  app.kubernetes.io/tier: enterprise-grade
  environment: production
`;

  files.push({
    name: 'kustomization.yaml',
    path: `${config.namespace}/kustomization.yaml`,
    category: 'package',
    content: kustomizeManifest,
    description: 'Kustomize master manifest allowing complete stack deployment via "kubectl apply -k .".'
  });

  // 9. Helm values file
  const helmValues = `# Production Helm values for official vLLM Helm chart
replicaCount: ${config.minReplicas || 1}

model:
  id: "${modelIdentifier}"
  servedName: "${servedName}"

engine:
  tensorParallelSize: ${config.tensorParallelSize}
  pipelineParallelSize: ${config.pipelineParallelSize}
  maxModelLen: ${config.maxModelLen}
  gpuMemoryUtilization: ${config.gpuMemoryUtilization}
  enablePrefixCaching: ${config.enablePrefixCaching}
  enableChunkedPrefill: ${config.enableChunkedPrefill}
  dtype: "${config.precision === 'bfloat16' ? 'bfloat16' : 'auto'}"

resources:
  limits:
    nvidia.com/gpu: ${totalGpus}
    cpu: "${config.cpuLimit}"
    memory: "${config.memoryLimitGi}Gi"
  requests:
    nvidia.com/gpu: ${totalGpus}
    cpu: "${config.cpuRequest}"
    memory: "${config.memoryRequestGi}Gi"

autoscaling:
  enabled: ${config.enableAutoscaling}
  provider: "${config.autoscalerType}"
  minReplicas: ${config.minReplicas}
  maxReplicas: ${config.maxReplicas}

router:
  enabled: ${config.enableSmartRouter}
  strategy: "${config.routingStrategy}"
  prefixCacheAware: ${config.enablePrefixCaching}
`;

  files.push({
    name: 'helm-values.yaml',
    path: `${config.namespace}/helm-values.yaml`,
    category: 'package',
    content: helmValues,
    description: 'Helm values.yaml compatible with standard vLLM chart repositories.'
  });

  // 10. Client test scripts
  const curlTest = `#!/bin/bash
# Test vLLM OpenAI-compatible endpoint
ROUTER_HOST=\${1:-"localhost"}
PORT=\${2:-80}

echo "1. Checking vLLM Health Check..."
curl -s -f "http://\${ROUTER_HOST}:\${PORT}/health" && echo " [OK] Cluster Healthy" || echo " [ERR] Health Check Failed"

echo -e "\\n2. Listing Loaded Models..."
curl -s "http://\${ROUTER_HOST}:\${PORT}/v1/models" | jq .

echo -e "\\n3. Sending Streaming Chat Completion with KV Cache Testing..."
curl -X POST "http://\${ROUTER_HOST}:\${PORT}/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "${config.sessionAffinityHeader}: test-session-001" \\
  -d '{
    "model": "${servedName}",
    "messages": [
      {"role": "system", "content": "You are a Kubernetes and AI systems engineer. Respond concisely."},
      {"role": "user", "content": "Explain why prefix caching optimizes GPU VRAM in vLLM."}
    ],
    "temperature": 0.2,
    "max_tokens": 150
  }' | jq .
`;

  files.push({
    name: 'test-inference.sh',
    path: `${config.namespace}/test-inference.sh`,
    category: 'package',
    content: curlTest,
    description: 'Ready-to-run Bash curl test verifying OpenAI-compatible endpoints and session affinity headers.'
  });

  // 11. CI/CD GitHub Actions: Build, Security Scan (Trivy), Push & Deploy Pipeline
  const deployWorkflowYaml = generateCiWorkflow(config, servedName);

  files.push({
    name: 'deploy-vllm-stack.yml',
    path: `.github/workflows/deploy-vllm-stack.yml`,
    category: 'cicd',
    content: deployWorkflowYaml,
    description: 'GitHub Actions CI/CD pipeline with Trivy container vulnerability scanning, image registry push, and Kubernetes deployment.'
  });

  // 12. CI/CD GitHub Actions: PR Validation & Manifest Lint Check
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

  files.push({
    name: 'pr-manifest-lint.yml',
    path: `.github/workflows/pr-manifest-lint.yml`,
    category: 'cicd',
    content: prLintWorkflowYaml,
    description: 'GitHub Actions PR check validating Kustomize builds, GPU allocation limits, and /dev/shm volume presence.'
  });

  return files;
}

export function generateCiWorkflow(config: AppConfig, servedName: string): string {
  const registryUrl =
    config.ciRegistryProvider === 'ghcr'
      ? 'ghcr.io'
      : config.ciRegistryProvider === 'ecr'
      ? '123456789012.dkr.ecr.us-east-1.amazonaws.com'
      : config.ciRegistryProvider === 'gcr'
      ? 'us-docker.pkg.dev/my-gcp-project/vllm-repo'
      : config.ciRegistryProvider === 'acr'
      ? 'myvllmregistry.azurecr.io'
      : 'docker.io';

  const imageName = config.ciImageRepo || `${registryUrl}/${config.namespace}/vllm-custom-engine`;

  let registryLoginSnippet = '';
  if (config.ciRegistryProvider === 'ghcr') {
    registryLoginSnippet = `    - name: Log in to GitHub Container Registry (GHCR)
      uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: \${{ github.actor }}
        password: \${{ secrets.GITHUB_TOKEN }}`;
  } else if (config.ciRegistryProvider === 'ecr') {
    registryLoginSnippet = `    - name: Configure AWS Credentials (OIDC)
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: \${{ secrets.AWS_ROLE_ARN }}
        aws-region: us-east-1

    - name: Log in to Amazon ECR
      uses: aws-actions/amazon-ecr-login@v2`;
  } else if (config.ciRegistryProvider === 'gcr') {
    registryLoginSnippet = `    - name: Authenticate to Google Cloud (Workload Identity)
      uses: google-github-actions/auth@v2
      with:
        workload_identity_provider: \${{ secrets.GCP_WIF_PROVIDER }}
        service_account: \${{ secrets.GCP_WIF_SERVICE_ACCOUNT }}

    - name: Configure Docker for Google Artifact Registry
      run: gcloud auth configure-docker us-docker.pkg.dev --quiet`;
  } else if (config.ciRegistryProvider === 'acr') {
    registryLoginSnippet = `    - name: Log in to Azure Container Registry (ACR)
      uses: azure/docker-login@v2
      with:
        login-server: \${{ secrets.ACR_LOGIN_SERVER }}
        username: \${{ secrets.ACR_USERNAME }}
        password: \${{ secrets.ACR_PASSWORD }}`;
  } else {
    registryLoginSnippet = `    - name: Log in to Docker Hub
      uses: docker/login-action@v3
      with:
        username: \${{ secrets.DOCKERHUB_USERNAME }}
        password: \${{ secrets.DOCKERHUB_TOKEN }}`;
  }

  let deploySnippet = '';
  if (config.ciDeployMethod === 'kubectl') {
    deploySnippet = `  deploy-kubernetes:
    name: Deploy to Kubernetes Cluster
    needs: build-scan-and-push
    runs-on: ubuntu-latest
    environment: production
    steps:
    - name: Checkout Repository
      uses: actions/checkout@v4

    - name: Set up Kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.30.0'

    - name: Authenticate to Kubernetes
      uses: azure/k8s-set-context@v4
      with:
        method: kubeconfig
        kubeconfig: \${{ secrets.KUBECONFIG }}

    - name: Verify Cluster Connectivity
      run: kubectl get nodes -o wide

    - name: Apply vLLM Production Manifests (Kustomize)
      run: |
        echo "Applying manifests from ./${config.namespace}..."
        kubectl apply -k ./${config.namespace}

    - name: Await vLLM Inference Engine Rollout
      run: |
        echo "Waiting for vLLM pods to load weights and pass readiness probes..."
        kubectl rollout status deployment/${config.deploymentName} -n ${config.namespace} --timeout=900s

    - name: Await Smart Router Rollout
      run: |
        kubectl rollout status deployment/vllm-smart-router -n ${config.namespace} --timeout=300s

    - name: Post-Deployment Smoke Test
      run: |
        echo "Running cluster internal health check..."
        kubectl run curl-test --image=curlimages/curl --rm -i --restart=Never -- \\
          curl -s -f http://${config.deploymentName}-svc.${config.namespace}.svc.cluster.local:${config.servicePort}/health || echo "Endpoint warming up..."`;
  } else {
    deploySnippet = `  gitops-sync:
    name: Trigger GitOps Sync (ArgoCD / Flux)
    needs: build-scan-and-push
    runs-on: ubuntu-latest
    steps:
    - name: Checkout GitOps Repository
      uses: actions/checkout@v4

    - name: Trigger ArgoCD Application Sync
      run: |
        echo "Triggering ArgoCD Application sync for '${config.deploymentName}'..."
        curl -s -X POST \${{ secrets.ARGOCD_SERVER }}/api/v1/applications/${config.deploymentName}/sync \\
          -H "Authorization: Bearer \${{ secrets.ARGOCD_TOKEN }}" \\
          -H "Content-Type: application/json" \\
          -d '{"revision": "'\${{ github.sha }}'", "prune": true}'
        echo "GitOps sync initiated."`;
  }

  return `name: Build, Security Scan, Push & Deploy vLLM Stack

on:
  push:
    branches: [ main ]
    paths:
      - '${config.namespace}/**'
      - 'Dockerfile*'
      - '.github/workflows/deploy-vllm-stack.yml'
  workflow_dispatch:

permissions:
  contents: read
  packages: write
  id-token: write
  security-events: write

env:
  IMAGE_NAME: "${imageName}"
  NAMESPACE: "${config.namespace}"

jobs:
  build-scan-and-push:
    name: Build, Vulnerability Scan & Push Container
    runs-on: ubuntu-latest
    outputs:
      image_tag: \${{ steps.meta.outputs.version }}

    steps:
    - name: Checkout Source Code
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

${registryLoginSnippet}

    - name: Extract Docker Image Metadata & Tags
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: \${{ env.IMAGE_NAME }}
        tags: |
          type=sha,format=short,prefix=sha-
          type=raw,value=latest,enable=\${{ github.ref == 'refs/heads/main' }}

    - name: Build Container Image (Local Tarball for Scanning)
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./Dockerfile
        push: false
        load: true
        tags: \${{ env.IMAGE_NAME }}:\${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

    # -------------------------------------------------------------
    # Container Security Scanning: Blocks CVEs Before Registry Push
    # -------------------------------------------------------------
    - name: Run Trivy Container Vulnerability Scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: \${{ env.IMAGE_NAME }}:\${{ github.sha }}
        format: 'sarif'
        output: 'trivy-results.sarif'
        severity: '${config.ciFailOnSeverity}'
        exit-code: '${config.ciEnableScanBlock ? '1' : '0'}' # Block pipeline if critical CVEs found
        ignore-unfixed: true

    - name: Upload Security Vulnerability Scan SARIF to GitHub
      uses: github/codeql-action/upload-sarif@v3
      if: always()
      with:
        sarif_file: 'trivy-results.sarif'

    - name: Push Verified Container Image to Registry
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./Dockerfile
        push: true
        tags: \${{ steps.meta.outputs.tags }}
        labels: \${{ steps.meta.outputs.labels }}

${deploySnippet}
`;
}
