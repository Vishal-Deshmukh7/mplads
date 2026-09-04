import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SecurityNotice } from './components/SecurityNotice';
import { AuthorityDashboard } from './components/AuthorityDashboard';
import { ContractorMobileApp } from './components/ContractorMobileApp';
import { ImplementingAgencyDashboard } from './components/ImplementingAgencyDashboard';
import { AccessDeniedScreen } from './components/AccessDeniedScreen';
import { RBACAcceptanceModal } from './components/RBACAcceptanceModal';
import { User, UserRole } from './types';
import { api } from './api';
import {
  ShieldAlert,
  Smartphone,
  Monitor,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Building2,
  Landmark,
  ShieldCheck,
  Compass,
  Lock,
  ExternalLink,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [globalRefreshTrigger, setGlobalRefreshTrigger] = useState<number>(0);
  const [isAcceptanceModalOpen, setIsAcceptanceModalOpen] = useState<boolean>(false);

  // Hash-based route management & direct URL protection
  const [currentRoute, setCurrentRoute] = useState<string>(window.location.hash || '#/dashboard');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/dashboard';
      setCurrentRoute(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      try {
        if (api.getToken()) {
          try {
            const res = await api.getMe();
            setCurrentUser(res.user);
            const roleNorm = (res.user.role || '').toUpperCase();
            if (roleNorm === 'CONTRACTOR') {
              setViewMode('mobile');
            } else {
              setViewMode('desktop');
            }
            setLoading(false);
            return;
          } catch {
            api.clearToken();
          }
        }

        // Default initial persona: District Authority Dr. Rajesh Sharma, IAS
        try {
          const res = await api.login('nodal.officer@mplads.gov.in', 'jandarpan123');
          setCurrentUser(res.user);
        } catch {
          const res = await api.login('authority@mplads.gov.in', 'jandarpan123');
          setCurrentUser(res.user);
        }
      } catch (err) {
        console.warn('Initial login note:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [globalRefreshTrigger]);

  // Quick switch user
  const handleQuickSwitch = async (email: string) => {
    setLoading(true);
    try {
      const res = await api.login(email, 'jandarpan123');
      setCurrentUser(res.user);
      const roleNorm = (res.user.role || '').toUpperCase();
      if (roleNorm === 'CONTRACTOR') {
        setViewMode('mobile');
      } else {
        setViewMode('desktop');
      }
      // If currently on an access denied or role-specific URL, reset hash to dashboard
      window.location.hash = '#/dashboard';
      setGlobalRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error('Failed to switch user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    api.clearToken();
    handleQuickSwitch('nodal.officer@mplads.gov.in');
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset all demo projects and claims back to pristine Varanasi District prototype state?')) {
      return;
    }
    setResetLoading(true);
    try {
      await api.resetDemo();
      setGlobalRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setResetLoading(false);
    }
  };

  const handleToggleViewMode = () => {
    if (viewMode === 'desktop') {
      handleQuickSwitch('apex.infra@contractor.in');
    } else {
      handleQuickSwitch('nodal.officer@mplads.gov.in');
    }
  };

  // Route Permission Evaluator
  const evaluateRoutePermission = (): { allowed: boolean; reason?: string } => {
    if (!currentUser) return { allowed: true };

    const roleNorm = (currentUser.role || '').toUpperCase();
    const route = currentRoute.toLowerCase();

    // Verify Claims Screen
    if (route.startsWith('#/verify-claims')) {
      if (roleNorm !== 'DISTRICT_AUTHORITY') {
        const reason = `Role '${roleNorm}' does not have permission to verify or approve claims. Only DISTRICT_AUTHORITY is authorized to verify claims.`;
        return { allowed: false, reason };
      }
    }

    // Direct Sanction Screen
    if (route.startsWith('#/direct-sanction')) {
      if (roleNorm !== 'DISTRICT_AUTHORITY') {
        const reason = `Direct Technical Sanctions are strictly reserved for DISTRICT_AUTHORITY. Role '${roleNorm}' cannot issue sanctions directly.`;
        return { allowed: false, reason };
      }
    }

    // Recommend Project Screen
    if (route.startsWith('#/recommend')) {
      if (roleNorm !== 'MP' && roleNorm !== 'DISTRICT_AUTHORITY') {
        const reason = `Only MP and DISTRICT_AUTHORITY may recommend development projects. Role '${roleNorm}' is unauthorized.`;
        return { allowed: false, reason };
      }
    }

    // Implementing Agency Field Inspections
    if (route.startsWith('#/agency/inspections')) {
      if (roleNorm !== 'IMPLEMENTING_AGENCY' && roleNorm !== 'DISTRICT_AUTHORITY') {
        const reason = `Ground inspection logging is restricted to IMPLEMENTING_AGENCY and DISTRICT_AUTHORITY. Role '${roleNorm}' is unauthorized.`;
        return { allowed: false, reason };
      }
    }

    // Contractor Claim Submissions
    if (route.startsWith('#/contractor/claims')) {
      if (roleNorm !== 'CONTRACTOR' && roleNorm !== 'DISTRICT_AUTHORITY') {
        const reason = `Contractor Claims screen is accessible only to CONTRACTOR and DISTRICT_AUTHORITY. Role '${roleNorm}' is unauthorized.`;
        return { allowed: false, reason };
      }
    }

    // Audit Logs
    if (route.startsWith('#/audit')) {
      if (roleNorm !== 'DISTRICT_AUTHORITY' && roleNorm !== 'MP') {
        const reason = `Audit log review is confidential and restricted to DISTRICT_AUTHORITY and MP. Role '${roleNorm}' is unauthorized.`;
        return { allowed: false, reason };
      }
    }

    return { allowed: true };
  };

  const routeCheck = evaluateRoutePermission();

  // If unauthorized route accessed, trigger backend logging
  useEffect(() => {
    if (!routeCheck.allowed && currentUser) {
      api.logUnauthorizedAttempt(currentRoute, routeCheck.reason || 'Unauthorized direct URL access')
        .catch((e) => console.warn('Failed to log unauthorized URL access:', e));
    }
  }, [currentRoute, routeCheck.allowed, currentUser]);

  const roleNorm = (currentUser?.role || '').toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* 1. Official Government Header */}
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onResetDemo={handleResetDemo}
        onQuickSwitchUser={handleQuickSwitch}
        onOpenAcceptanceTests={() => setIsAcceptanceModalOpen(true)}
        viewMode={viewMode}
        onToggleViewMode={handleToggleViewMode}
        resetLoading={resetLoading}
      />

      {/* 2. Explainable Principles and 3 Pillars Banner */}
      <SecurityNotice />

      {/* 3. Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {loading ? (
          <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <span className="text-sm font-medium text-slate-500">
              Loading JANDARPAN Verified Data Engine...
            </span>
          </div>
        ) : (
          <div>
            {/* View Mode & Persona Switching Bar */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 text-xs shadow-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  Active Persona:
                </span>
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                  {currentUser?.name}
                </span>
                <span className="text-slate-300">|</span>
                <span
                  className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] border ${
                    roleNorm === 'MP'
                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                      : roleNorm === 'DISTRICT_AUTHORITY'
                      ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                      : roleNorm === 'IMPLEMENTING_AGENCY'
                      ? 'bg-cyan-50 text-cyan-900 border-cyan-200'
                      : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  }`}
                >
                  {roleNorm === 'MP'
                    ? '🏛️ Role 1: MP'
                    : roleNorm === 'DISTRICT_AUTHORITY'
                    ? '🏢 Role 2: DISTRICT_AUTHORITY'
                    : roleNorm === 'IMPLEMENTING_AGENCY'
                    ? '⚙️ Role 3: IMPLEMENTING_AGENCY'
                    : '🏗️ Role 4: CONTRACTOR'}
                </span>
                <span className="text-slate-400 text-[11px]">
                  ({currentUser?.district || 'Varanasi District'})
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* 1. MP Switcher */}
                <button
                  onClick={() => handleQuickSwitch('mp@mplads.gov.in')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 text-xs cursor-pointer ${
                    roleNorm === 'MP'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="Switch to MP (Shri Anand Mohan Sharma)"
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span>1. MP</span>
                </button>

                {/* 2. District Authority Switcher */}
                <button
                  onClick={() => handleQuickSwitch('nodal.officer@mplads.gov.in')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 text-xs cursor-pointer ${
                    roleNorm === 'DISTRICT_AUTHORITY' && viewMode === 'desktop'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="Switch to District Authority (Dr. Rajesh Sharma, IAS)"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>2. Authority</span>
                </button>

                {/* 3. Implementing Agency Switcher */}
                <button
                  onClick={() => handleQuickSwitch('pwd.varanasi@up.gov.in')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 text-xs cursor-pointer ${
                    roleNorm === 'IMPLEMENTING_AGENCY'
                      ? 'bg-cyan-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="Switch to Implementing Agency (PWD Division)"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>3. Agency</span>
                </button>

                {/* 4. Contractor Switcher */}
                <button
                  onClick={() => handleQuickSwitch('apex.infra@contractor.in')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 text-xs cursor-pointer ${
                    roleNorm === 'CONTRACTOR' || viewMode === 'mobile'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="Switch to Contractor (Apex Infrastructure)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>4. Contractor</span>
                </button>

                {/* Verification Suite Modal Trigger */}
                <button
                  onClick={() => setIsAcceptanceModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition flex items-center gap-1.5 text-xs cursor-pointer ml-1"
                  title="Open the 13 automated acceptance tests"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>13 Acceptance Tests</span>
                </button>
              </div>
            </div>

            {/* Direct URL Protection Testing Simulator */}
            <div className="mb-4 bg-slate-900 text-white p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-bold text-slate-200">Direct URL Protection Tester:</span>
                <span className="text-slate-400 text-[11px]">
                  Simulate entering direct URL routes to test frontend route guarding &amp; backend 403 enforcement
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 text-[11px]">Jump to:</span>
                <button
                  onClick={() => (window.location.hash = '#/dashboard')}
                  className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition ${
                    currentRoute === '#/dashboard' || currentRoute === '#/'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  #/dashboard
                </button>
                <button
                  onClick={() => (window.location.hash = '#/verify-claims')}
                  className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition flex items-center gap-1 ${
                    currentRoute === '#/verify-claims'
                      ? 'bg-rose-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Requires DISTRICT_AUTHORITY (Contractor / MP will be blocked)"
                >
                  <Lock className="w-3 h-3 text-rose-400" />
                  <span>#/verify-claims</span>
                </button>
                <button
                  onClick={() => (window.location.hash = '#/direct-sanction')}
                  className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition flex items-center gap-1 ${
                    currentRoute === '#/direct-sanction'
                      ? 'bg-rose-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Requires DISTRICT_AUTHORITY (MP / Contractor blocked)"
                >
                  <Lock className="w-3 h-3 text-rose-400" />
                  <span>#/direct-sanction</span>
                </button>
                <button
                  onClick={() => (window.location.hash = '#/recommend')}
                  className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition ${
                    currentRoute === '#/recommend'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  #/recommend
                </button>
                <button
                  onClick={() => (window.location.hash = '#/agency/inspections')}
                  className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition ${
                    currentRoute === '#/agency/inspections'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  #/agency/inspections
                </button>
              </div>
            </div>

            {/* Dynamic Content View based on Route Authorization & Role */}
            {!routeCheck.allowed ? (
              <AccessDeniedScreen
                attemptedUrl={currentRoute}
                reason={routeCheck.reason || 'You do not have permission to access this screen.'}
                user={currentUser}
                onReturn={() => {
                  window.location.hash = '#/dashboard';
                }}
              />
            ) : roleNorm === 'IMPLEMENTING_AGENCY' ? (
              <ImplementingAgencyDashboard
                currentUser={currentUser}
                onRefreshData={() => setGlobalRefreshTrigger((prev) => prev + 1)}
              />
            ) : roleNorm === 'CONTRACTOR' || viewMode === 'mobile' ? (
              <div className="py-2">
                <ContractorMobileApp
                  currentUser={
                    roleNorm === 'CONTRACTOR'
                      ? currentUser
                      : {
                          id: 'usr-cont-01',
                          name: 'Rahul Verma',
                          email: 'apex.infra@contractor.in',
                          role: 'CONTRACTOR',
                          organization_name: 'M/s Apex Infrastructure Pvt. Ltd.',
                          organization: 'M/s Apex Infrastructure Pvt. Ltd.',
                          district_id: 'pune',
                          district: 'Varanasi District',
                          designation: 'Managing Director & Empanelled Contractor',
                          created_at: new Date().toISOString(),
                        }
                  }
                  onRefreshData={() => setGlobalRefreshTrigger((prev) => prev + 1)}
                />
              </div>
            ) : (
              <AuthorityDashboard
                currentUser={currentUser}
                onRefreshData={() => setGlobalRefreshTrigger((prev) => prev + 1)}
              />
            )}
          </div>
        )}
      </main>

      {/* 4. Administrative Hierarchy & RBAC Enforcement Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-xs py-3 px-6 text-slate-400 sticky bottom-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
          <div className="flex items-center gap-2 text-[11px] text-slate-300 flex-wrap justify-center md:justify-start">
            <span className="font-bold text-amber-400">RBAC FLOW:</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 font-medium">
              1. MP (Recommends)
            </span>
            <span className="text-slate-500 font-bold">→</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-indigo-300 font-medium">
              2. District Authority (Sanctions &amp; Verifies)
            </span>
            <span className="text-slate-500 font-bold">→</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-medium">
              3. Implementing Agency (Inspects)
            </span>
            <span className="text-slate-500 font-bold">→</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-300 font-medium">
              4. Contractor (Executes Claims)
            </span>
          </div>

          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span>Dual-Layer Enforcement: UI Route Guards + Backend Express Middleware</span>
          </div>
        </div>
      </footer>

      {/* 5. Automated RBAC 13 Acceptance Tests Modal */}
      <RBACAcceptanceModal
        isOpen={isAcceptanceModalOpen}
        onClose={() => setIsAcceptanceModalOpen(false)}
        onSwitchUser={handleQuickSwitch}
      />
    </div>
  );
}

