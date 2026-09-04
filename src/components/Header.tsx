import React from 'react';
import { Shield, RotateCcw, Smartphone, Monitor, LogOut, CheckCircle2, Building2, ShieldCheck } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onResetDemo: () => void;
  onQuickSwitchUser: (email: string) => void;
  onOpenAcceptanceTests: () => void;
  viewMode: 'desktop' | 'mobile';
  onToggleViewMode: () => void;
  resetLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onResetDemo,
  onQuickSwitchUser,
  onOpenAcceptanceTests,
  viewMode,
  onToggleViewMode,
  resetLoading,
}) => {
  const roleNorm = (user?.role || '').toUpperCase();

  return (
    <header className="bg-white text-slate-900 border-b border-slate-200 shadow-sm sticky top-0 z-40">
      {/* Top National Emblem & Identity Bar */}
      <div className="bg-slate-900 px-4 py-1.5 text-xs text-slate-300 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-slate-200">
            Government of India • Ministry of Statistics and Programme Implementation (MoSPI)
          </span>
          <span className="hidden md:inline text-slate-600">|</span>
          <span className="hidden md:inline text-slate-400">MPLADS Division • JANDARPAN RBAC Protected</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAcceptanceTests}
            className="flex items-center gap-1.5 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-0.5 rounded font-bold shadow-xs transition cursor-pointer"
            title="Execute automated verification for all 13 Acceptance Tests"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verify 13 Acceptance Tests</span>
          </button>

          <button
            onClick={onResetDemo}
            disabled={resetLoading}
            title="Reset to pristine initial demo database"
            className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
          >
            <RotateCcw className={`w-3 h-3 ${resetLoading ? 'animate-spin' : ''}`} />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Logo & Tagline */}
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-sm flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-indigo-900 leading-none">JANDARPAN</h1>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded uppercase">
                MPLADS
              </span>
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded">
                RBAC Enforced
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mt-1">
              Role-Based Access Control &amp; Risk Verification Portal
            </p>
          </div>
        </div>

        {/* Action Controls & User Profile Switcher */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {/* View Mode Toggle (Desktop vs Mobile Contractor view) */}
          <button
            onClick={onToggleViewMode}
            className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
            title={viewMode === 'desktop' ? 'Switch to Mobile Contractor App Preview' : 'Switch to Desktop Portal View'}
          >
            {viewMode === 'desktop' ? (
              <>
                <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Contractor App</span>
              </>
            ) : (
              <>
                <Monitor className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Desktop Portal</span>
              </>
            )}
          </button>

          {/* Quick Role Switcher Dropdown */}
          <div className="relative inline-flex items-center bg-slate-50 rounded-lg border border-slate-200 text-xs px-2.5 py-1.5">
            <span className="text-slate-500 mr-1.5 text-[11px] hidden sm:inline font-medium">Switch Role:</span>
            <select
              value={user?.email || ''}
              onChange={(e) => onQuickSwitchUser(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer text-xs pr-1 max-w-[220px] sm:max-w-none truncate"
            >
              <option value="mp@mplads.gov.in" className="text-slate-900">
                🏛️ Role 1: MP (Shri Anand Mohan Sharma)
              </option>
              <option value="nodal.officer@mplads.gov.in" className="text-slate-900">
                🏢 Role 2: DISTRICT_AUTHORITY (Dr. Rajesh Sharma, IAS)
              </option>
              <option value="pwd.varanasi@up.gov.in" className="text-slate-900">
                ⚙️ Role 3: IMPLEMENTING_AGENCY (PWD Execution Division)
              </option>
              <option value="apex.infra@contractor.in" className="text-slate-900">
                🏗️ Role 4: CONTRACTOR (Apex Infrastructure)
              </option>
              <option value="buildwell@contractor.in" className="text-slate-900">
                🏗️ Contractor 2: XYZ / Buildwell (Unassigned to proj-01)
              </option>
              <option value="da.ayodhya@mplads.gov.in" className="text-slate-900">
                🏢 District Authority 2: Ayodhya District
              </option>
            </select>
          </div>

          {/* User Status Badge & Avatar Circle */}
          {user && (
            <div className="flex items-center space-x-3 pl-2 border-l border-slate-200">
              <div className="hidden lg:flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                  <span>{user.name}</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {roleNorm === 'MP'
                    ? "Hon'ble MP • Lok Sabha"
                    : roleNorm === 'DISTRICT_AUTHORITY'
                    ? `District Authority • ${user.district || 'District'}`
                    : roleNorm === 'IMPLEMENTING_AGENCY'
                    ? `Implementing Agency • ${user.organization_name || 'PWD'}`
                    : `Contractor • ${user.organization_name || 'Apex Infra'}`}
                </span>
              </div>
              <div
                className={`w-9 h-9 rounded-full border-2 flex items-center justify-center font-bold text-xs ${
                  roleNorm === 'MP'
                    ? 'bg-amber-100 border-amber-300 text-amber-900'
                    : roleNorm === 'DISTRICT_AUTHORITY'
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                    : roleNorm === 'IMPLEMENTING_AGENCY'
                    ? 'bg-cyan-100 border-cyan-300 text-cyan-800'
                    : 'bg-emerald-100 border-emerald-300 text-emerald-800'
                }`}
                title={`${user.name} (${roleNorm})`}
              >
                {roleNorm === 'MP'
                  ? 'MP'
                  : roleNorm === 'DISTRICT_AUTHORITY'
                  ? 'DA'
                  : roleNorm === 'IMPLEMENTING_AGENCY'
                  ? 'IA'
                  : 'CT'}
              </div>
              <button
                onClick={onLogout}
                title="Log out"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
