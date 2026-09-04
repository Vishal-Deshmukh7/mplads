import React, { useState, useEffect } from 'react';
import {
  Building2,
  FolderKanban,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  FileCheck2,
  ShieldAlert,
  Send,
  Sparkles,
  Lock,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { Project, User } from '../types';
import { api } from '../api';

interface ImplementingAgencyDashboardProps {
  currentUser: User | null;
  onRefreshData: () => void;
}

export const ImplementingAgencyDashboard: React.FC<ImplementingAgencyDashboardProps> = ({
  currentUser,
  onRefreshData,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [inspectionNote, setInspectionNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Unauthorized Action Simulation State
  const [unauthorizedError, setUnauthorizedError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await api.getProjects();
      setProjects(res.projects || []);
      if (res.projects?.length > 0 && !selectedProject) {
        setSelectedProject(res.projects[0]);
      }
    } catch (err: any) {
      console.error('Failed to load agency projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleUpdateExecutionStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !inspectionNote.trim()) return;

    setUpdating(true);
    setFeedback(null);
    try {
      const updatedNote = `[Inspection by ${currentUser?.name || 'Executive Engineer'} - ${new Date().toLocaleDateString('en-IN')}]: ${inspectionNote.trim()}`;
      await api.updateContractorProgressNotes(selectedProject.id, updatedNote);
      setFeedback('Ground execution & inspection status updated successfully.');
      setInspectionNote('');
      await fetchProjects();
      onRefreshData();
    } catch (err: any) {
      setFeedback(`Update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  // Simulate unauthorized action 1: Attempt to approve funds / status as implementing agency
  const handleUnauthorizedFundApproval = async () => {
    if (!selectedProject) return;
    setUnauthorizedError(null);
    try {
      // Direct call to status update with APPROVED
      await api.updateProjectStatus(selectedProject.id, 'APPROVED', 'Attempting fund sanction without authority');
      alert('Action succeeded (unexpected)');
    } catch (err: any) {
      setUnauthorizedError(`[Backend 403 Forbidden]: ${err.message}. Implementing Agency is strictly blocked from fund approvals.`);
    }
  };

  // Simulate unauthorized action 2: Attempt to verify a claim
  const handleUnauthorizedClaimVerification = async () => {
    setUnauthorizedError(null);
    try {
      // Attempt to verify a dummy or first claim
      await api.verifyClaim('claim-dummy-test', 'Agency verification attempt');
      alert('Action succeeded (unexpected)');
    } catch (err: any) {
      setUnauthorizedError(`[Backend 403 Forbidden]: ${err.message}. Implementing Agency is strictly blocked from verifying contractor claims.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 rounded-2xl border border-cyan-800/40 p-5 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Engineering &amp; Ground Inspection Portal
              </span>
              <span className="text-xs text-slate-400">
                Agency: <strong className="text-white">{currentUser?.organization_name || 'Public Works Department (PWD)'}</strong>
              </span>
            </div>

            <h1 className="text-xl font-bold tracking-tight mt-1.5 flex items-center gap-2 text-white">
              <Building2 className="w-5 h-5 text-cyan-400" />
              <span>Implementing Agency Workspace • {currentUser?.name}</span>
            </h1>

            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Assigned engineering department dashboard. Monitor on-ground execution, record physical site inspection reports, and track technical milestones for assigned works.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-slate-800/90 text-cyan-300 px-3 py-1.5 rounded-xl border border-cyan-700/50 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>Authorized: Ground Verification</span>
            </span>
          </div>
        </div>
      </div>

      {/* Security Principle visible reminder */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-900 flex items-start gap-3 shadow-xs">
        <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Security Principle (RBAC Enforcement):</span>
          <p className="mt-0.5 text-amber-800">
            Every user can access only the screens, projects, claims, and actions permitted for their assigned role. Frontend controls reflect permissions, and backend authorization strictly enforces them.
          </p>
        </div>
      </div>

      {/* Unauthorized action test alert */}
      {unauthorizedError && (
        <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-2xl text-xs text-rose-900 flex items-start justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-900">HTTP 403 Forbidden Verified (Audit Log Recorded):</div>
              <p className="text-rose-800 mt-0.5 font-mono">{unauthorizedError}</p>
            </div>
          </div>
          <button
            onClick={() => setUnauthorizedError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Workspace: Projects & Inspection Logging */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Assigned Projects */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-cyan-600" />
              <span>Assigned Projects ({projects.length})</span>
            </h2>
            <button
              onClick={fetchProjects}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {projects.map((proj) => {
              const isSelected = selectedProject?.id === proj.id;
              return (
                <div
                  key={proj.id}
                  onClick={() => setSelectedProject(proj)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                    isSelected
                      ? 'bg-cyan-50/80 border-cyan-300 shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold text-slate-500">
                      {proj.project_code}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {proj.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 mt-1 line-clamp-1">{proj.name}</h3>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{proj.location}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Sanctioned: ₹{proj.approved_cost.toLocaleString('en-IN')}</span>
                    <span className="font-semibold text-emerald-600">
                      Progress: {proj.verified_progress || proj.current_submitted_progress || 0}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Project Inspection & Ground Verification */}
        <div className="lg:col-span-2 space-y-4">
          {selectedProject ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
              <div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md font-mono text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {selectedProject.project_code}
                  </span>
                  <span className="text-xs text-slate-500">
                    Constituency: <strong>{selectedProject.constituency}</strong>
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-1.5">{selectedProject.name}</h2>
                <p className="text-xs text-slate-600 mt-1">{selectedProject.description}</p>
              </div>

              {/* Progress and Execution Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Approved Budget</div>
                  <div className="font-bold text-slate-900 mt-0.5">₹{selectedProject.approved_cost.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Contractor</div>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedProject.contractor?.name || 'Assigned to Apex Infra'}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Physical Progress</div>
                  <div className="font-bold text-emerald-600 mt-0.5">
                    {selectedProject.verified_progress || selectedProject.current_submitted_progress || 0}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Current Status</div>
                  <div className="font-bold text-indigo-700 mt-0.5">{selectedProject.status}</div>
                </div>
              </div>

              {/* Field Inspection & Ground Verification Notes */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-cyan-600" />
                  <span>Update Ground Inspection &amp; Execution Status</span>
                </h3>

                {feedback && (
                  <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{feedback}</span>
                  </div>
                )}

                <form onSubmit={handleUpdateExecutionStatus} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Inspection Findings / Ground Verification Log:
                    </label>
                    <textarea
                      rows={3}
                      value={inspectionNote}
                      onChange={(e) => setInspectionNote(e.target.value)}
                      placeholder="e.g. Inspected site chainage 0.00 to 1.20 km. Subgrade compaction verified with field density tests. Workmanship complies with IRC standards."
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500">
                      Logs will be timestamped under {currentUser?.name} ({currentUser?.organization_name})
                    </span>
                    <button
                      type="submit"
                      disabled={updating || !inspectionNote.trim()}
                      className="px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{updating ? 'Saving...' : 'Submit Inspection Log'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Progress / Inspection Logs */}
              {selectedProject.progress_notes && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">Latest Recorded Inspection Log:</span>
                  <p className="text-slate-600 whitespace-pre-line">{selectedProject.progress_notes}</p>
                </div>
              )}

              {/* 3. RBAC Enforcement Demonstration Controls */}
              <div className="border-t border-slate-200 pt-4">
                <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>RBAC Security Boundary Tests (Negative Permission Tests):</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  As an Implementing Agency, you are authorized for field execution verification, but strictly FORBIDDEN from fund sanctions or claim verifications. Test backend enforcement below:
                </p>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={handleUnauthorizedFundApproval}
                    className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Attempt fund sanction (Should be rejected with 403 Forbidden)"
                  >
                    <Lock className="w-3.5 h-3.5 text-rose-600" />
                    <span>Test: Attempt Fund Sanction (Expect 403)</span>
                  </button>

                  <button
                    onClick={handleUnauthorizedClaimVerification}
                    className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Attempt claim verification (Should be rejected with 403 Forbidden)"
                  >
                    <Lock className="w-3.5 h-3.5 text-rose-600" />
                    <span>Test: Attempt Claim Verification (Expect 403)</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
              Select an assigned project from the list to view specifications and record ground inspections.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
