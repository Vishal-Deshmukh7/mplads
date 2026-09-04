import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  FolderKanban,
  Plus,
  Filter,
  Search,
  ExternalLink,
  Building2,
  UserCheck,
  FileCheck2,
  AlertCircle,
  History,
  MapPin,
  IndianRupee,
  Landmark,
  ArrowRight,
  Check,
  Sparkles,
  Send,
  Calendar,
} from 'lucide-react';
import { Project, Claim, AuditLog, User } from '../types';
import { api } from '../api';
import { ClaimVerificationModal } from './ClaimVerificationModal';
import { CreateProjectModal } from './CreateProjectModal';
import { MPRecommendModal } from './MPRecommendModal';

interface AuthorityDashboardProps {
  currentUser: User | null;
  onRefreshData: () => void;
}

export const AuthorityDashboard: React.FC<AuthorityDashboardProps> = ({
  currentUser,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'PROPOSALS' | 'CLAIMS' | 'PROJECTS' | 'AUDIT'>('PROPOSALS');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [proposalFilter, setProposalFilter] = useState<'ALL' | 'RECOMMENDED' | 'APPROVED' | 'IN_PROGRESS'>('ALL');

  // Modals
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isRecommendModalOpen, setIsRecommendModalOpen] = useState(false);

  // Contractor assignment quick state
  const [assigningProjectId, setAssigningProjectId] = useState<string | null>(null);
  const [assignContractorId, setAssignContractorId] = useState('');
  const [contractorsList, setContractorsList] = useState<Array<{ id: string; name: string; organization?: string }>>([]);

  // Active inspected claim for Claim Insight Panel
  const [inspectedClaimId, setInspectedClaimId] = useState<string | null>(null);

  // Action status loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [claimsRes, projectsRes, auditRes, contRes] = await Promise.all([
        api.getClaims({ status: statusFilter, risk_level: riskFilter }),
        api.getProjects(),
        api.getAuditLogs(),
        api.getContractors(),
      ]);
      setClaims(claimsRes?.claims || []);
      setProjects(projectsRes?.projects || []);
      setAuditLogs(auditRes?.audit_logs || []);
      setContractorsList(contRes?.contractors || []);
    } catch (err: any) {
      console.warn('Authority data fetch error:', err);
      if (err?.message?.includes('token') || err?.message?.includes('authentication')) {
        api.clearToken();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, riskFilter]);

  // Handle Nodal Officer Approving Project Proposal
  const handleApproveProposal = async (projectId: string) => {
    setActionLoadingId(projectId);
    try {
      await api.updateProjectStatus(
        projectId,
        'APPROVED',
        'Technical sanction granted and approved by District Nodal Officer Dr. Rajesh Sharma, IAS.'
      );
      await fetchData();
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve project proposal.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Nodal Officer Forwarding / Marking Under Review
  const handleReviewProposal = async (projectId: string) => {
    setActionLoadingId(projectId);
    try {
      await api.updateProjectStatus(
        projectId,
        'UNDER_REVIEW',
        'Forwarded to District Engineering Cell for feasibility scrutiny and BOQ estimation.'
      );
      await fetchData();
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to update proposal status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Contractor Assignment directly from card or table
  const handleAssignContractor = async (projectId: string, contractorIdToAssign?: string) => {
    const targetContractor = contractorIdToAssign || assignContractorId || contractorsList[0]?.id;
    if (!targetContractor) {
      alert('Please select a contractor to assign.');
      return;
    }
    setActionLoadingId(projectId);
    try {
      await api.assignContractor(projectId, targetContractor);
      setAssigningProjectId(null);
      setAssignContractorId('');
      await fetchData();
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to assign contractor');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Metrics calculations
  const totalProjects = projects.length;
  const recommendedProjects = projects.filter((p) => p.status === 'RECOMMENDED' || p.status === 'UNDER_REVIEW').length;
  const approvedProjects = projects.filter((p) => p.status === 'APPROVED').length;
  const executingProjects = projects.filter((p) => p.status === 'IN_PROGRESS' || p.contractor_id).length;
  const pendingClaims = claims.filter((c) => c.status === 'PENDING_VERIFICATION').length;
  const highRiskClaims = claims.filter(
    (c) => c.verification_result?.risk_level === 'HIGH' && c.status === 'PENDING_VERIFICATION'
  ).length;

  // Filtered proposals list
  const filteredProposals = projects.filter((p) => {
    if (proposalFilter === 'RECOMMENDED') {
      return p.status === 'RECOMMENDED' || p.status === 'UNDER_REVIEW';
    }
    if (proposalFilter === 'APPROVED') {
      return p.status === 'APPROVED';
    }
    if (proposalFilter === 'IN_PROGRESS') {
      return p.status === 'IN_PROGRESS';
    }
    return true;
  });

  // Filtered claims list
  const filteredClaims = claims.filter((c) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const projName = c.project?.name?.toLowerCase() || '';
      const projCode = c.project?.project_code?.toLowerCase() || '';
      const contName = c.contractor?.name?.toLowerCase() || '';
      const claimCode = c.claim_code?.toLowerCase() || '';
      return (
        projName.includes(query) ||
        projCode.includes(query) ||
        contName.includes(query) ||
        claimCode.includes(query)
      );
    }
    return true;
  });

  // Selected inspected claim for Claim Insight Panel
  const inspectedClaim =
    filteredClaims.find((c) => c.id === inspectedClaimId) ||
    filteredClaims.find((c) => c.verification_result?.risk_level === 'HIGH') ||
    filteredClaims[0] ||
    claims[0] ||
    null;

  const roleUpper = (currentUser?.role || '').toUpperCase();
  const isMP = roleUpper === 'MP';
  const isNodal = roleUpper === 'DISTRICT_AUTHORITY' || roleUpper === 'AUTHORITY';

  return (
    <div className="space-y-6">
      {/* 1. Official Workflow Banner: MP -> District -> Nodal Officer -> Contractor */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl border border-slate-800 p-5 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                RBAC Protected Portal
              </span>
              <span className="text-xs text-slate-400">
                Jurisdiction: <strong className="text-white">{currentUser?.district || 'Varanasi District (PC-77)'}</strong>
              </span>
            </div>

            <h1 className="text-xl font-bold tracking-tight mt-1.5 flex items-center gap-2 text-white">
              {isMP ? (
                <>
                  <Landmark className="w-5 h-5 text-amber-400" />
                  <span>Hon&apos;ble MP Portal • {currentUser?.name || 'Shri Anand Mohan Sharma'}</span>
                </>
              ) : (
                <>
                  <Building2 className="w-5 h-5 text-indigo-400" />
                  <span>District Authority Portal • {currentUser?.name || 'Dr. Rajesh Sharma, IAS'}</span>
                </>
              )}
            </h1>

            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              {isMP
                ? 'Recommend development projects under the Parliamentary Constituency. Track technical scrutiny, sanctions, and execution progress in real time.'
                : 'Review MP recommendations, issue direct sanctions, assign works to empanelled contractors, and verify evidence claims.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* MP Recommend Project Button (Visible to MP and District Authority) */}
            <button
              onClick={() => setIsRecommendModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Landmark className="w-4 h-4" />
              <span>+ Recommend Project</span>
            </button>

            {/* Direct Sanction Button (Strictly District Authority only) */}
            {isNodal && (
              <button
                onClick={() => setIsCreateProjectOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                title="Direct Technical Sanction (District Authority Role Only)"
              >
                <Plus className="w-4 h-4" />
                <span>+ Direct Sanction</span>
              </button>
            )}
          </div>
        </div>

        {/* Visual Workflow Steps Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
            <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-[11px] border border-amber-400/30">
              1
            </span>
            <div>
              <div className="font-semibold text-white">MP Recommends</div>
              <div className="text-[10px] text-slate-400">Shri Anand Mohan Sharma</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
            <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-[11px] border border-indigo-400/30">
              2
            </span>
            <div>
              <div className="font-semibold text-white">Nodal Officer Reviews</div>
              <div className="text-[10px] text-slate-400">Dr. Rajesh Sharma, IAS</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-[11px] border border-emerald-400/30">
              3
            </span>
            <div>
              <div className="font-semibold text-white">Assign to Contractor</div>
              <div className="text-[10px] text-slate-400">Apex Infrastructure</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
            <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-[11px] border border-cyan-400/30">
              4
            </span>
            <div>
              <div className="font-semibold text-white">Execution &amp; Claims</div>
              <div className="text-[10px] text-slate-400">Live GPS &amp; Evidence Engine</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Recommended Proposals */}
        <div
          onClick={() => {
            setActiveTab('PROPOSALS');
            setProposalFilter('RECOMMENDED');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-amber-400 transition"
        >
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>MP Proposals</span>
            <Landmark className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-amber-700">{recommendedProjects}</div>
          <div className="text-xs text-amber-700 mt-2 font-medium">Awaiting / Under Nodal Review</div>
        </div>

        {/* Approved Projects */}
        <div
          onClick={() => {
            setActiveTab('PROPOSALS');
            setProposalFilter('APPROVED');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-400 transition"
        >
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Approved Projects</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-3xl font-bold text-indigo-800">{approvedProjects}</div>
          <div className="text-xs text-indigo-600 mt-2 font-medium">Ready for Contractor Assignment</div>
        </div>

        {/* Executing Projects */}
        <div
          onClick={() => {
            setActiveTab('PROJECTS');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-emerald-400 transition"
        >
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Under Execution</span>
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold text-emerald-700">{executingProjects}</div>
          <div className="text-xs text-emerald-700 mt-2 font-medium">Contractor: Apex Infra</div>
        </div>

        {/* Evidence Claims / Verification */}
        <div
          onClick={() => {
            setActiveTab('CLAIMS');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-rose-400 transition"
        >
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Pending Claims</span>
            {highRiskClaims > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {pendingClaims}
            {highRiskClaims > 0 && (
              <span className="text-sm font-semibold text-red-600 ml-2">({highRiskClaims} High Risk)</span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-2 font-medium">Automated Verification Engine</div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('PROPOSALS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            activeTab === 'PROPOSALS'
              ? 'bg-amber-50 text-amber-900 border border-amber-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Landmark className="w-4 h-4 text-amber-600" />
          <span>1. MP Proposals &amp; Workflow ({projects.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('CLAIMS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            activeTab === 'CLAIMS'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-indigo-600" />
          <span>2. Claims &amp; Verification Engine ({claims.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('PROJECTS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            activeTab === 'PROJECTS'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4 text-slate-700" />
          <span>3. Sanctioned Projects Directory</span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            activeTab === 'AUDIT'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4 text-slate-700" />
          <span>4. District Audit Trail ({auditLogs.length})</span>
        </button>
      </div>

      {/* -------------------------------------------------------------
          TAB 1: MP PROPOSALS & ADMINISTRATIVE WORKFLOW
      ------------------------------------------------------------- */}
      {activeTab === 'PROPOSALS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <span>District Project Proposals (Varanasi District)</span>
                <span className="text-[11px] font-normal text-slate-500 lowercase">
                  — tracking MP recommendation to contractor execution
                </span>
              </h2>
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setProposalFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  proposalFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({projects.length})
              </button>
              <button
                onClick={() => setProposalFilter('RECOMMENDED')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  proposalFilter === 'RECOMMENDED'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                MP Proposals ({recommendedProjects})
              </button>
              <button
                onClick={() => setProposalFilter('APPROVED')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  proposalFilter === 'APPROVED'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                Approved ({approvedProjects})
              </button>
              <button
                onClick={() => setProposalFilter('IN_PROGRESS')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  proposalFilter === 'IN_PROGRESS'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                Under Execution ({executingProjects})
              </button>
            </div>
          </div>

          {/* Proposals List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredProposals.map((proj) => {
              const isRecommended = proj.status === 'RECOMMENDED';
              const isUnderReview = proj.status === 'UNDER_REVIEW';
              const isApproved = proj.status === 'APPROVED';
              const isInProgress = proj.status === 'IN_PROGRESS';
              const isCompleted = proj.status === 'COMPLETED';

              return (
                <div
                  key={proj.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-xs hover:border-indigo-300 hover:shadow-md transition space-y-4"
                >
                  <div className="space-y-3">
                    {/* Header: Code & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] bg-slate-100 text-slate-800 font-semibold px-2 py-0.5 rounded-md border border-slate-200">
                        {proj.project_code}
                      </span>

                      {isRecommended && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>MP Proposal • Awaiting Nodal Review</span>
                        </span>
                      )}
                      {isUnderReview && (
                        <span className="text-[10px] font-bold text-purple-800 bg-purple-100 border border-purple-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Search className="w-3 h-3" />
                          <span>Under Technical Review</span>
                        </span>
                      )}
                      {isApproved && (
                        <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 border border-indigo-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Approved • Ready to Assign</span>
                        </span>
                      )}
                      {isInProgress && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          <span>Contractor Executing</span>
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Completed
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">
                      {proj.name}
                    </h3>

                    {/* Location */}
                    <p className="text-xs text-slate-500 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <span>{proj.location}</span>
                    </p>

                    {/* Workflow Actors Timeline */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">1. Recommending MP:</span>
                        <span className="font-semibold text-slate-800">
                          {proj.recommended_by || 'Shri Anand Mohan Sharma (MP)'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">2. Nodal Approval:</span>
                        <span className="font-semibold text-slate-800">
                          {proj.approved_by ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <span>✓ {proj.approved_by}</span>
                              {proj.approved_date && <span className="text-[10px] font-normal text-slate-500">({proj.approved_date})</span>}
                            </span>
                          ) : (
                            <span className="text-amber-700 italic">Pending Nodal Review</span>
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">3. Assigned Contractor:</span>
                        <span className="font-semibold text-slate-800">
                          {proj.contractor ? (
                            <span className="text-indigo-700 font-bold">
                              {proj.contractor.name} ({proj.contractor.organization})
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Not Yet Assigned</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Budget & Progress stats */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block font-medium">Estimated / Approved Budget:</span>
                        <span className="font-bold text-slate-900">
                          ₹{proj.approved_cost.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block font-medium">Physical Progress:</span>
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${proj.verified_progress || 0}%` }}
                            />
                          </div>
                          <span className="font-bold text-indigo-700 text-xs shrink-0">
                            {proj.verified_progress || 0}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Notes if any */}
                    {proj.progress_notes && (
                      <div className="text-[11px] p-2 bg-amber-50/70 border border-amber-200/60 rounded-lg text-amber-900">
                        <span className="font-bold">Latest Update Note: </span>
                        {proj.progress_notes}
                      </div>
                    )}
                  </div>

                  {/* Action Controls for District Authority according to Workflow */}
                  <div className="pt-3 border-t border-slate-100">
                    {/* Stage 1: Recommended Proposal Actions */}
                    {isRecommended && (
                      isNodal ? (
                        <div className="flex items-center gap-2">
                          <button
                            disabled={actionLoadingId === proj.id}
                            onClick={() => handleReviewProposal(proj.id)}
                            className="flex-1 py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-xs transition cursor-pointer text-center"
                          >
                            Technical Scrutiny
                          </button>
                          <button
                            disabled={actionLoadingId === proj.id}
                            onClick={() => handleApproveProposal(proj.id)}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer text-center flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve Proposal</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg font-medium text-center">
                          Proposal Submitted • Awaiting District Authority Scrutiny
                        </div>
                      )
                    )}

                    {/* Stage 2: Under Review Actions */}
                    {isUnderReview && (
                      isNodal ? (
                        <div className="flex items-center gap-2">
                          <button
                            disabled={actionLoadingId === proj.id}
                            onClick={() => handleApproveProposal(proj.id)}
                            className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer text-center flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Grant Technical Sanction &amp; Approve</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-purple-700 bg-purple-50 p-2 rounded-lg font-medium text-center">
                          Under Technical Scrutiny by District Authority
                        </div>
                      )
                    )}

                    {/* Stage 3: Approved - Assign to Contractor */}
                    {isApproved && !proj.contractor_id && (
                      isNodal ? (
                        <div className="space-y-2">
                          <button
                            disabled={actionLoadingId === proj.id}
                            onClick={() => handleAssignContractor(proj.id, contractorsList[0]?.id)}
                            className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition cursor-pointer text-center flex items-center justify-center gap-1.5"
                          >
                            <Building2 className="w-4 h-4" />
                            <span>Assign to Contractor (Apex Infrastructure)</span>
                          </button>
                          <span className="text-[10px] text-slate-500 block text-center">
                            Authorized District Action: Contract Execution Assignment
                          </span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-indigo-700 bg-indigo-50 p-2 rounded-lg font-medium text-center">
                          Technical Sanction Granted • Awaiting Contractor Assignment by District Authority
                        </div>
                      )
                    )}

                    {/* Stage 4: In Progress - Contractor Executing */}
                    {isInProgress && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Execution Monitored</span>
                        </span>
                        <button
                          onClick={() => setActiveTab('CLAIMS')}
                          className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer text-[11px]"
                        >
                          View Work &amp; Evidence Claims →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 2: CLAIMS & RISK REVIEW WITH SLEEK CLAIM INSIGHT PANEL
      ------------------------------------------------------------- */}
      {activeTab === 'CLAIMS' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left: Active Monitoring Grid (col-span-8) */}
          <div className="xl:col-span-8 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3 px-1">
              <h2 className="text-base font-bold text-slate-800 uppercase tracking-tight">
                Active Evidence &amp; Claims Grid
              </h2>
              <div className="flex items-center gap-2">
                <div className="flex border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
                  <button
                    onClick={() => setRiskFilter('ALL')}
                    className={`px-3 py-1.5 text-xs font-bold transition ${
                      riskFilter === 'ALL'
                        ? 'bg-slate-100 text-slate-800 border-r border-slate-200'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    ALL
                  </button>
                  <button
                    onClick={() => setRiskFilter('HIGH')}
                    className={`px-3 py-1.5 text-xs font-bold transition ${
                      riskFilter === 'HIGH'
                        ? 'bg-red-100 text-red-700'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    HIGH RISK
                  </button>
                </div>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search claims by project, contractor, code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING_VERIFICATION">Pending Review</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="CLARIFICATION">Clarification Requested</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            {/* Claims Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Claim Code</th>
                      <th className="py-3 px-4">Project &amp; Location</th>
                      <th className="py-3 px-4">Type &amp; Claim</th>
                      <th className="py-3 px-4 text-center">Risk Assessment</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Loading claims data...
                        </td>
                      </tr>
                    ) : filteredClaims.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No claims match your filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredClaims.map((claim) => {
                        const vr = claim.verification_result;
                        const isHighRisk = vr?.risk_level === 'HIGH';
                        const isMediumRisk = vr?.risk_level === 'MEDIUM';
                        const isSelected = inspectedClaim?.id === claim.id;

                        return (
                          <tr
                            key={claim.id}
                            onClick={() => setInspectedClaimId(claim.id)}
                            className={`cursor-pointer transition hover:bg-slate-50 ${
                              isSelected ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                              {claim.claim_code}
                            </td>

                            <td className="py-3 px-4 max-w-[220px]">
                              <div className="font-semibold text-slate-900 truncate">
                                {claim.project?.name || 'Project'}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {claim.project?.location}
                              </div>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              {claim.type === 'PROGRESS' ? (
                                <div>
                                  <span className="font-bold text-slate-900 text-xs">
                                    {claim.progress_percent}% Progress
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">Physical</span>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-bold text-slate-900 text-xs">
                                    ₹{((claim.claimed_amount || 0) / 100000).toFixed(1)}L
                                  </span>
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    {claim.invoice_number}
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isHighRisk
                                    ? 'bg-red-100 text-red-700 border border-red-200'
                                    : isMediumRisk
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-green-100 text-green-700 border border-green-200'
                                }`}
                              >
                                {isHighRisk && '⚠️ HIGH RISK'}
                                {isMediumRisk && '⚡ MEDIUM'}
                                {!isHighRisk && !isMediumRisk && '✓ LOW RISK'}
                              </span>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                  claim.status === 'VERIFIED'
                                    ? 'bg-green-100 text-green-800'
                                    : claim.status === 'PENDING_VERIFICATION'
                                    ? 'bg-amber-100 text-amber-800'
                                    : claim.status === 'CLARIFICATION'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {claim.status}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClaim(claim);
                                  setIsVerificationModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-[11px] transition cursor-pointer"
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right: Sleek Claim Insight Panel (col-span-4) */}
          <div className="xl:col-span-4">
            {inspectedClaim ? (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Claim Verification Inspector
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm mt-0.5">
                    {inspectedClaim.claim_code} • {inspectedClaim.project?.name}
                  </h3>
                </div>

                <div className="p-4 space-y-4 text-xs">
                  {/* Automated Risk Score */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700">Verification Engine Score</span>
                      <span
                        className={`text-base font-black ${
                          inspectedClaim.verification_result?.risk_level === 'HIGH'
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}
                      >
                        {inspectedClaim.verification_result?.total_risk_score ?? 0}/100 Risk
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      {inspectedClaim.verification_result?.reasons &&
                      inspectedClaim.verification_result.reasons.length > 0 ? (
                        inspectedClaim.verification_result.reasons.map((r, i) => (
                          <div key={i} className="text-red-700 flex items-start gap-1">
                            <span>•</span>
                            <span>{r}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-green-700 flex items-center gap-1">
                          <span>✓</span>
                          <span>Passed GPS boundary, photo integrity, and BOQ rate checks.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Geotagged Evidence preview */}
                  {inspectedClaim.evidence_url && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                        <span>Live Geotagged Camera Photo</span>
                        <span className="font-mono text-indigo-600">
                          {inspectedClaim.latitude?.toFixed(4)}, {inspectedClaim.longitude?.toFixed(4)}
                        </span>
                      </div>
                      <img
                        src={inspectedClaim.evidence_url}
                        alt="Evidence"
                        className="w-full h-36 object-cover rounded-xl border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setSelectedClaim(inspectedClaim);
                      setIsVerificationModalOpen(true);
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer text-center"
                  >
                    Open Official Verification Modal
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                Select a claim to inspect live evidence and verification engine results.
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 3: SANCTIONED PROJECTS DIRECTORY
      ------------------------------------------------------------- */}
      {activeTab === 'PROJECTS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">Sanctioned Projects Directory</h2>
              <p className="text-xs text-slate-500">
                Single Sample District: Varanasi District • Dedicated Nodal Officer: Dr. Rajesh Sharma, IAS
              </p>
            </div>
            <button
              onClick={() => setIsCreateProjectOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Project</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-indigo-300 hover:shadow-md transition"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-md border border-indigo-200">
                      {proj.project_code}
                    </span>
                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {proj.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug">
                    {proj.name}
                  </h3>

                  <p className="text-xs text-slate-500 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{proj.location}</span>
                  </p>

                  <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Approved Budget:</span>
                      <span className="font-bold text-slate-900">
                        ₹{proj.approved_cost.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Verified Progress:</span>
                      <span className="font-bold text-indigo-600">
                        {proj.verified_progress || 0}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Assigned Contractor */}
                <div className="pt-3 border-t border-slate-100 text-xs">
                  <span className="text-[10px] text-slate-400 block font-medium">Executing Contractor:</span>
                  <span className="font-semibold text-slate-800">
                    {proj.contractor ? proj.contractor.name : 'Rahul Verma (Apex Infrastructure)'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 4: DISTRICT AUDIT LOG TRAIL
      ------------------------------------------------------------- */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">Varanasi District Audit Log Trail</h2>
              <p className="text-xs text-slate-500">
                Immutable chronological record of MP recommendations, Nodal Officer reviews, approvals, contractor assignments, and claim decisions.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-xs">
              Total Log Entries: {auditLogs.length}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Administrative Actor</th>
                    <th className="py-3.5 px-4">Action</th>
                    <th className="py-3.5 px-4">Entity</th>
                    <th className="py-3.5 px-4">Details &amp; Audit Trail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'medium',
                        })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{log.user_name}</div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          {log.user_role === 'mp' ? '🏛️ MP' : log.user_role === 'authority' ? '🏢 Nodal Officer' : '🏗️ Contractor'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {log.entity_type}: {log.entity_id}
                      </td>
                      <td className="py-3 px-4 text-slate-700 text-xs">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Claim Verification Modal */}
      <ClaimVerificationModal
        claim={selectedClaim}
        isOpen={isVerificationModalOpen}
        onClose={() => {
          setIsVerificationModalOpen(false);
          setSelectedClaim(null);
        }}
        currentUser={currentUser}
        onClaimUpdated={() => {
          fetchData();
          setIsVerificationModalOpen(false);
        }}
      />

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onProjectCreated={fetchData}
      />

      {/* MP Project Recommendation Modal */}
      <MPRecommendModal
        isOpen={isRecommendModalOpen}
        onClose={() => setIsRecommendModalOpen(false)}
        onRecommended={() => {
          fetchData();
          onRefreshData();
          setActiveTab('PROPOSALS');
        }}
        mpName={isMP ? currentUser?.name || 'Shri Anand Mohan Sharma' : 'Shri Anand Mohan Sharma'}
      />
    </div>
  );
};
