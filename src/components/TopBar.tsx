import React from 'react';
import { Download, Terminal } from 'lucide-react';

interface TopBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onExport: () => void;
  issueCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  onExport,
  issueCount
}) => {
  const navItems = [
    { id: 'architecture', label: 'Architecture & KV Routing' },
    { id: 'model_hardware', label: 'Model & Hardware' },
    { id: 'autoscaling', label: 'Autoscaling & KEDA' },
    { id: 'cicd', label: 'CI/CD & GitOps' },
    { id: 'wasm_security', label: 'WASM & Client Security' },
    { id: 'manifests', label: 'Manifest Generator' },
    { id: 'validation', label: `Lint & Verification${issueCount > 0 ? ` (${issueCount})` : ''}` }
  ];

  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-neutral-800 bg-neutral-950 text-neutral-100 shrink-0">
      {/* Zone 1: Brand wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
          <Terminal className="w-4 h-4" />
        </div>
        <a href="/" className="text-base font-semibold tracking-tight text-white whitespace-nowrap">
          KubeVLLM Architect
        </a>
      </div>

      {/* Zone 2: Navigation Links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-400">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`transition-colors whitespace-nowrap py-1 border-b-2 ${
              activeTab === item.id
                ? 'text-white border-sky-500 font-semibold'
                : 'border-transparent hover:text-neutral-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Zone 3: 1 Primary CTA */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-white bg-sky-600 rounded-md hover:bg-sky-500 transition-colors whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          Export All Manifests
        </button>
      </div>
    </header>
  );
};
