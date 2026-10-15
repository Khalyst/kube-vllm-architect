import React, { useState } from 'react';
import { AppConfig } from '../types';
import { Shield, ShieldAlert, ShieldCheck, Lock, Cpu, EyeOff, FileCode, Check, Copy, ArrowRight, Zap, RefreshCw } from 'lucide-react';

interface Props {
  config: AppConfig;
  updateConfig: (patch: Partial<AppConfig>) => void;
}

export const WasmSecurityView: React.FC<Props> = ({ config, updateConfig }) => {
  const [testPrompt, setTestPrompt] = useState(
    'Patient John Doe (SSN: 000-12-3456, API Key: sk_live_9988aabb) reports acute headache. Please evaluate dosage.'
  );
  const [redactedOutput, setRedactedOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedWasmYaml, setCopiedWasmYaml] = useState(false);

  // In-browser WASM-style client-side sanitization simulation
  const runWasmClientSanitization = () => {
    setIsProcessing(true);
    setTimeout(() => {
      let result = testPrompt;
      // SSN redaction
      result = result.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN_TOKEN_HASH]');
      // API Key redaction
      result = result.replace(/\b(sk_[a-zA-Z0-9_-]+|AKIA[0-9A-Z]{16})\b/g, '[REDACTED_API_KEY]');
      // PII Name redaction
      result = result.replace(/\b(John Doe|Jane Smith)\b/g, '[ANONYMIZED_PATIENT_01]');
      setRedactedOutput(result);
      setIsProcessing(false);
    }, 250);
  };

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
    # Modern Gateway API ResponseHeaderModifier replacing deprecated Ingress NGINX annotations
    # Enforces Cross-Origin Isolation required for WebGPU & multi-threaded WASM in browsers
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

  return (
    <div className="space-y-6">
      {/* Header Verdict Card */}
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Security Architecture: WebAssembly (WASM) & Browser Utilization
              </h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Evaluating client-side sandbox isolation, zero-data-leak privacy, cross-origin security boundaries, and Kubernetes edge guards.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-mono text-xs">
              WASM Sandbox: Cryptographically Isolated
            </span>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mt-4 text-xs text-neutral-300 leading-relaxed space-y-2">
          <p>
            <strong>Yes, working with WASM in the browser is exceptionally secure</strong> and represents the gold standard for zero-trust client execution. Because WebAssembly executes inside a strictly sandboxed, capability-restricted linear memory block, it cannot inspect the host OS, corrupt kernel memory, or make arbitrary network requests without explicit browser permissions.
          </p>
          <p className="text-neutral-400">
            When applied to AI and LLM architectures, in-browser WASM / WebGPU creates a <strong>zero-data-leak paradigm</strong>: sensitive prompts, patient medical records, financial data, and proprietary code can be tokenized, sanitized, or even inferred locally on the user's GPU without transmitting raw confidential information to the cloud.
          </p>
        </div>
      </div>

      {/* 4 Pillars of WASM Browser Security */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1 */}
        <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-950 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
            <Lock className="w-4 h-4" />
            <span>1. Linear Memory Sandbox</span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            WASM code only sees a continuous array of raw bytes (<code className="text-neutral-300">WebAssembly.Memory</code>). It has no direct pointers to host JavaScript objects, browser DOM, or native OS memory addresses, preventing buffer overflow escape attacks.
          </p>
        </div>

        {/* Pillar 2 */}
        <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-950 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <EyeOff className="w-4 h-4" />
            <span>2. Zero-Exfiltration Privacy</span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Client-side inference (via WebGPU + WASM runtimes like WebLLM / ONNX Runtime Web) processes raw user inputs directly on the user's machine. Zero bytes leave the laptop, eliminating man-in-the-middle and cloud storage compliance exposure (GDPR / HIPAA).
          </p>
        </div>

        {/* Pillar 3 */}
        <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-950 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
            <Shield className="w-4 h-4" />
            <span>3. Cross-Origin Isolation</span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Multi-threaded WASM and WebGPU shaders require <code className="text-neutral-300">SharedArrayBuffer</code>, locked down behind COOP and COEP headers. This blocks cross-origin Spectre and Meltdown timing side-channels.
          </p>
        </div>

        {/* Pillar 4 */}
        <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-950 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
            <ShieldAlert className="w-4 h-4" />
            <span>4. Model Weight Security</span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Open-weight models (Llama, Mistral, Qwen) thrive in browser WASM. However, proprietary closed-source weights downloaded to client browser caches can be inspected by users. Closed IP weights should stay protected behind server-side vLLM.
          </p>
        </div>
      </div>

      {/* Interactive Simulator: Client-Side WASM PII Sanitizer & Pre-Processor */}
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/50 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Interactive Hybrid Pattern: Client WASM Sanitizer &rarr; Kubernetes vLLM
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Simulate how a client-side WASM module scrubs PII locally in the browser before dispatching context to the backend GPU cluster.
            </p>
          </div>
          <span className="text-xs font-mono text-sky-400">Client-Side Isolation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Input Box */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-300">
              Raw Browser Client Input (Contains Confidential Data)
            </label>
            <textarea
              rows={4}
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded p-3 text-xs text-neutral-200 font-mono focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={runWasmClientSanitization}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sky-600 text-white rounded hover:bg-sky-500 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              Run In-Browser WASM Sanitization
            </button>
          </div>

          {/* Sanitized Output */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-300">
              Sanitized Payload Dispatched to Kubernetes vLLM
            </label>
            <div className="min-h-[96px] bg-neutral-950 border border-neutral-800 rounded p-3 text-xs font-mono text-emerald-400 select-text">
              {redactedOutput || (
                <span className="text-neutral-500 italic">
                  Click 'Run In-Browser WASM Sanitization' to execute client-side token scrubbing...
                </span>
              )}
            </div>
            <div className="text-[10px] text-neutral-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero sensitive credentials leave browser boundary. Kubernetes GPU processes only anonymized tokens.</span>
            </div>
          </div>
        </div>
      </div>

      {/* WASM at the Kubernetes Gateway (EnvoyFilter & Security Headers) */}
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-950 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Kubernetes Gateway API (Gateway & HTTPRoute) with Envoy WASM Security Filter
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Replaces deprecated Ingress NGINX (EOL March 2026) using standard Gateway API (NGINX Gateway Fabric / kgateway) with declarative ResponseHeaderModifier and Envoy WASM guardrail.
            </p>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(wasmSecurityManifest);
              setCopiedWasmYaml(true);
              setTimeout(() => setCopiedWasmYaml(false), 2000);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition-colors"
          >
            {copiedWasmYaml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedWasmYaml ? 'Copied' : 'Copy WASM Filter YAML'}</span>
          </button>
        </div>

        <div className="p-4 bg-neutral-900/80 rounded border border-neutral-800 font-mono text-xs text-neutral-300 max-h-[360px] overflow-y-auto">
          <pre>
            <code>{wasmSecurityManifest}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
