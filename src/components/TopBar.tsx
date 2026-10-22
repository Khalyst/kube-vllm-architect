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
    { id: 'enterprise', label: 'Enterprise Guarantees' },
    { id: 'cicd', label: 'CI/CD & GitOps' },
    { id: 'wasm_security', label: 'WASM & Security' },
    { id: 'manifests', label: 'Manifest Generator' },
    { id: 'validation', label: `Lint & Verification${issueCount > 0 ? ` (${issueCount})` : ''}` }
  ];

  return (
    <header className="w-full max-w-full overflow-hidden flex items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3 border-b border-neutral-800 bg-neutral-950 text-neutral-100 shrink-0">
      {/* Zone 1: Brand wordmark */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
          <Terminal className="w-4 h-4" />
        </div>
        <a href="/" className="text-sm sm:text-base font-semibold tracking-tight text-white whitespace-nowrap">
          KubeVLLM Architect
        </a>
      </div>

      {/* Zone 2: Navigation Links (Desktop: horizontal scrollable pills with no overflow blowouts) */}
      <nav className="hidden md:flex items-center gap-1 xl:gap-2 text-xs lg:text-sm font-medium text-neutral-400 overflow-x-auto scrollbar-none min-w-0 py-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`transition-all whitespace-nowrap px-2.5 py-1 rounded-md text-xs lg:text-[13px] ${
              activeTab === item.id
                ? 'bg-neutral-800 text-white font-semibold border border-neutral-700/80 shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Mobile Tab Selector for screens < md */}
      <div className="md:hidden flex-1 max-w-[200px] px-2">
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-sky-500"
        >
          {navItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {/* Zone 3: 1 Primary CTA */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 text-xs font-medium text-white bg-sky-600 rounded-md hover:bg-sky-500 transition-colors whitespace-nowrap shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export All Manifests</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>
    </header>
  );
};
