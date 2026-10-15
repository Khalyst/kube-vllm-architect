import React from 'react';
import { ValidationIssue } from '../types';
import { AlertCircle, AlertTriangle, CheckCircle, Info, ShieldCheck } from 'lucide-react';

interface Props {
  issues: ValidationIssue[];
}

export const ValidationView: React.FC<Props> = ({ issues }) => {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  return (
    <div className="space-y-6">
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/50">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div>
            <h3 className="text-sm font-semibold text-white">Kubernetes Stack Linter & Verification Engine</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Automated pre-flight checks validating GPU resource boundaries, PyTorch NCCL shared memory, and KEDA triggers.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className={errors.length > 0 ? 'text-red-400 font-semibold' : 'text-neutral-400'}>
              {errors.length} Errors
            </span>
            <span className={warnings.length > 0 ? 'text-amber-400 font-semibold' : 'text-neutral-400'}>
              {warnings.length} Warnings
            </span>
            <span className="text-emerald-400 font-semibold">
              {infos.length} Passed
            </span>
          </div>
        </div>

        {/* Issues List */}
        <div className="mt-4 space-y-3">
          {issues.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-neutral-800 rounded-lg text-neutral-400 text-xs">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              All pre-flight verification rules passed cleanly! The stack is optimized for production serving.
            </div>
          ) : (
            issues.map((issue, idx) => {
              const isError = issue.severity === 'error';
              const isWarning = issue.severity === 'warning';

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border text-xs space-y-2 ${
                    isError
                      ? 'border-red-800/60 bg-red-950/20 text-red-200'
                      : isWarning
                      ? 'border-amber-800/60 bg-amber-950/20 text-amber-200'
                      : 'border-emerald-800/60 bg-emerald-950/20 text-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {isError ? (
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span>{issue.title}</span>
                  </div>

                  <p className="text-neutral-300 leading-relaxed pl-6">
                    {issue.message}
                  </p>

                  {issue.remedy && (
                    <div className="pl-6 pt-1 text-[11px] text-neutral-400">
                      <span className="font-semibold text-neutral-300">Recommended Fix: </span>
                      {issue.remedy}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Production Best Practices Reference Checklist */}
      <div className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/40">
        <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">
          vLLM on Kubernetes Production Checklist
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-neutral-400">
          <div className="p-2.5 rounded bg-neutral-950 border border-neutral-800">
            <span className="font-medium text-neutral-200">Shared Memory (/dev/shm):</span> PyTorch IPC requires RAM-backed shared memory to avoid bus errors during NCCL all-reduce operations across GPUs.
          </div>
          <div className="p-2.5 rounded bg-neutral-950 border border-neutral-800">
            <span className="font-medium text-neutral-200">Termination Grace Period:</span> Must be &gt;= 120s so active streaming inference requests can conclude before the pod terminates.
          </div>
          <div className="p-2.5 rounded bg-neutral-950 border border-neutral-800">
            <span className="font-medium text-neutral-200">Readiness vs Liveness Probes:</span> Readiness probe checks <code className="text-neutral-300">/health</code> with initialDelay ~45s to allow weight loading before receiving ingress traffic.
          </div>
          <div className="p-2.5 rounded bg-neutral-950 border border-neutral-800">
            <span className="font-medium text-neutral-200">Scale-Down Stabilization:</span> KEDA or HPA should have at least 300s scale-down stabilization window to avoid cold start thrashing.
          </div>
        </div>
      </div>
    </div>
  );
};
