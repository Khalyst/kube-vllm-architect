import React, { useState } from 'react';
import { GeneratedFile, ValidationIssue } from '../types';
import { Check, Copy, Download, FileCode, Folder, Terminal, AlertTriangle, ShieldCheck } from 'lucide-react';
import JSZip from 'jszip';

interface Props {
  files: GeneratedFile[];
  issues: ValidationIssue[];
}

export const ManifestViewer: React.FC<Props> = ({ files, issues }) => {
  const [selectedFileName, setSelectedFileName] = useState<string>(files[0]?.name || '');
  const [copiedFile, setCopiedFile] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const selectedFile = files.find((f) => f.name === selectedFileName) || files[0];

  const handleCopyContent = () => {
    if (selectedFile) {
      navigator.clipboard.writeText(selectedFile.content);
      setCopiedFile(true);
      setTimeout(() => setCopiedFile(false), 2000);
    }
  };

  const handleCopyKubeCmd = () => {
    const cmd = `kubectl apply -k ./${selectedFile?.path.split('/')[0] || 'vllm-serving'}`;
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleDownloadSingle = () => {
    if (!selectedFile) return;
    const blob = new Blob([selectedFile.content], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    const folderName = selectedFile?.path.split('/')[0] || 'vllm-k8s-manifests';
    const folder = zip.folder(folderName);

    files.forEach((file) => {
      folder?.file(file.name, file.content);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folderName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const categories = [
    { id: 'all', label: 'All Files' },
    { id: 'core', label: 'Core Inference' },
    { id: 'routing', label: 'Smart Router' },
    { id: 'autoscaling', label: 'KEDA Autoscaling' },
    { id: 'infrastructure', label: 'Cloud GPU Node' },
    { id: 'package', label: 'Kustomize & Helm' },
    { id: 'cicd', label: 'CI/CD Workflows' }
  ];

  const filteredFiles = activeCategory === 'all'
    ? files
    : files.filter((f) => f.category === activeCategory);

  return (
    <div className="space-y-4">
      {/* Top Action & Verification Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-neutral-800 rounded-lg bg-neutral-900/60">
        <div>
          <h3 className="text-sm font-semibold text-white">Generated Kubernetes Manifests</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Production-grade YAML specifications ready for GitOps, Helm, and Kustomize deployment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Apply Command */}
          <button
            onClick={handleCopyKubeCmd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-neutral-950 border border-neutral-700 text-neutral-300 rounded hover:text-white hover:border-neutral-600 transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-sky-400" />
            <span>kubectl apply -k .</span>
            {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
          </button>

          {/* Download Complete ZIP */}
          <button
            onClick={handleDownloadZip}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sky-600 text-white rounded hover:bg-sky-500 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download All (.zip)</span>
          </button>
        </div>
      </div>

      {/* Main Workspace: File Browser on Left + Code Viewer on Right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Column: File Tree */}
        <div className="md:col-span-4 border border-neutral-800 rounded-lg bg-neutral-950 p-3 space-y-3">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-1 pb-2 border-b border-neutral-800 text-[11px]">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-2 py-1 rounded transition-colors ${
                  activeCategory === c.id
                    ? 'bg-neutral-800 text-white font-medium'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* File Items List */}
          <div className="space-y-1">
            {filteredFiles.map((file) => {
              const isSelected = file.name === selectedFileName;
              return (
                <button
                  key={file.name}
                  onClick={() => setSelectedFileName(file.name)}
                  className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'bg-sky-950/40 border border-sky-600/40 text-white'
                      : 'text-neutral-300 hover:bg-neutral-900 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-sky-400' : 'text-neutral-500'}`} />
                    <span className="truncate font-mono">{file.name}</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 uppercase font-mono shrink-0 ml-2">
                    {file.category}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Validation Status Pill */}
          <div className="pt-3 border-t border-neutral-800">
            <div className="flex items-center justify-between text-xs p-2 rounded bg-neutral-900/80">
              <span className="text-neutral-400">Stack Verification:</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                {issues.some((i) => i.severity === 'error') ? (
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Action Required
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Valid
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Code Viewer */}
        <div className="md:col-span-8 border border-neutral-800 rounded-lg bg-neutral-950 flex flex-col overflow-hidden">
          {/* Code Viewer Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/40 text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono font-medium text-white">{selectedFile?.name}</span>
              <span className="text-neutral-500 text-[11px] truncate">({selectedFile?.description})</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyContent}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors text-[11px]"
              >
                {copiedFile ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedFile ? 'Copied' : 'Copy YAML'}</span>
              </button>
              <button
                onClick={handleDownloadSingle}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors text-[11px]"
              >
                <Download className="w-3 h-3" />
                <span>Save File</span>
              </button>
            </div>
          </div>

          {/* YAML Code Display */}
          <div className="p-4 overflow-x-auto text-xs font-mono text-neutral-300 bg-neutral-950/90 max-h-[580px] leading-relaxed select-text">
            <pre>
              <code>{selectedFile?.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
