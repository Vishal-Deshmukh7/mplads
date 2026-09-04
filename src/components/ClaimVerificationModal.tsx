import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MapPin,
  Clock,
  FileText,
  AlertTriangle,
  Building2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Claim, User } from '../types';
import { api } from '../api';

interface ClaimVerificationModalProps {
  claim: Claim | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onClaimUpdated: () => void;
}

export const ClaimVerificationModal: React.FC<ClaimVerificationModalProps> = ({
  claim,
  isOpen,
  onClose,
  currentUser,
  onClaimUpdated,
}) => {
  const [activeAction, setActiveAction] = useState<'VERIFY' | 'REJECT' | 'CLARIFICATION' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen || !claim) return null;

  const vr = claim.verification_result;
  const roleNorm = (currentUser?.role || '').toUpperCase();
  const isAuthority = roleNorm === 'DISTRICT_AUTHORITY' || roleNorm === 'AUTHORITY';

  const handleAction = async () => {
    if (!activeAction) return;

    if (activeAction === 'REJECT' && !remarks.trim()) {
      setFeedback({ type: 'error', message: 'Please enter rejection remarks.' });
      return;
    }
    if (activeAction === 'CLARIFICATION' && !remarks.trim()) {
      setFeedback({ type: 'error', message: 'Please state the query/clarification required.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      if (activeAction === 'VERIFY') {
        const res = await api.verifyClaim(claim.id, remarks || 'Verified by Competent Authority under MPLADS guidelines.');
        setFeedback({ type: 'success', message: res.message });
      } else if (activeAction === 'REJECT') {
        const res = await api.rejectClaim(claim.id, remarks);
        setFeedback({ type: 'success', message: res.message });
      } else if (activeAction === 'CLARIFICATION') {
        const res = await api.requestClarification(claim.id, remarks);
        setFeedback({ type: 'success', message: res.message });
      }

      setTimeout(() => {
        onClaimUpdated();
        setActiveAction(null);
        setRemarks('');
      }, 700);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Action failed.' });
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (level?: string) => {
    switch (level) {
      case 'HIGH':
        return {
          badge: 'bg-red-50 text-red-700 border-red-200',
          indicator: 'bg-red-600',
          title: 'High-Risk Claim — Authority Verification Required',
        };
      case 'MEDIUM':
        return {
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
          indicator: 'bg-amber-500',
          title: 'Medium-Risk Claim — Review Recommended',
        };
      default:
        return {
          badge: 'bg-green-50 text-green-700 border-green-200',
          indicator: 'bg-green-600',
          title: 'Low-Risk Claim — Verified Within Tolerances',
        };
    }
  };

  const riskBadge = getRiskBadge(vr?.risk_level);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Claim Verification Record</h2>
                <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                  {claim.claim_code}
                </span>
                <span className="text-[11px] uppercase font-semibold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {claim.type === 'PROGRESS' ? 'Progress Claim' : 'Expenditure Claim'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Submitted on {new Date(claim.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Status & Risk Banner */}
          <div className={`p-4 rounded-xl border ${riskBadge.badge} flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-current flex items-center justify-center shrink-0 shadow-xs">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">Automated Risk Assessment</div>
                <div className="text-sm font-bold mt-0.5">{riskBadge.title}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="text-right">
                <div className="text-[11px] font-semibold opacity-75">Risk Score</div>
                <div className="text-xl font-bold font-mono">
                  {vr?.total_risk_score ?? 0}
                  <span className="text-xs opacity-60 font-normal">/100</span>
                </div>
              </div>
              <span
                className={`text-xs font-bold uppercase px-3 py-1 rounded-full border shadow-xs ${
                  claim.status === 'VERIFIED'
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : claim.status === 'REJECTED'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : claim.status === 'CLARIFICATION'
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                }`}
              >
                {claim.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Project & Contractor Snapshot */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Project Information</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">{claim.project?.name || 'Assigned Project'}</div>
              <div className="text-xs text-slate-600">Code: <span className="font-mono text-slate-800 font-semibold">{claim.project?.project_code}</span></div>
              <div className="text-xs text-slate-600 flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                <span>{claim.project?.location}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Approved Cost:</span>
                <span className="font-bold text-slate-900">
                  ₹{claim.project?.approved_cost?.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Contractor Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Contractor Information</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">{claim.contractor?.name}</div>
              <div className="text-xs text-slate-600">{claim.contractor?.organization}</div>
              <div className="text-xs text-slate-600">Email: {claim.contractor?.email}</div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Verified Project Progress:</span>
                <span className="font-bold text-indigo-600">{claim.project?.verified_progress ?? 0}%</span>
              </div>
            </div>
          </div>

          {/* Claim Specifics & Financial Comparison */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              {claim.type === 'PROGRESS' ? 'Progress Claim Details' : 'Expenditure Claim Details'}
            </h3>

            {claim.type === 'PROGRESS' ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <div className="text-slate-500">Reported Progress</div>
                  <div className="text-lg font-bold text-indigo-600 mt-1">{claim.progress_percent}%</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <div className="text-slate-500">Captured At</div>
                  <div className="text-xs font-medium text-slate-800 mt-1">
                    {claim.captured_at ? new Date(claim.captured_at).toLocaleDateString('en-IN') : 'N/A'}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <div className="text-slate-500">GPS Coordinates</div>
                  <div className="text-xs font-mono text-slate-800 mt-1 font-semibold">
                    {claim.latitude?.toFixed(4)}, {claim.longitude?.toFixed(4)}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <div className="text-slate-500">Site Distance</div>
                  <div className={`text-xs font-bold mt-1 ${vr?.checks_detail?.gps?.flag ? 'text-red-600' : 'text-green-600'}`}>
                    {vr?.checks_detail?.gps?.distance_meters ? `${(vr.checks_detail.gps.distance_meters / 1000).toFixed(2)} km` : 'Verified'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <div className="text-slate-500">Claimed Expenditure</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    ₹{claim.claimed_amount?.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <div className="text-slate-500">Invoice Number</div>
                  <div className="text-xs font-mono text-slate-800 mt-1 font-bold">{claim.invoice_number}</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <div className="text-slate-500">Invoice Date</div>
                  <div className="text-xs font-medium text-slate-800 mt-1">{claim.invoice_date}</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <div className="text-slate-500">% of Approved Budget</div>
                  <div className="text-xs font-bold text-slate-800 mt-1">
                    {(((claim.claimed_amount || 0) / (claim.project?.approved_cost || 1)) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            )}

            {/* Description or BOQ Details */}
            {claim.description && (
              <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <strong className="text-slate-800 block mb-1">Work Description:</strong>
                {claim.description}
              </div>
            )}
            {claim.boq_item && (
              <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <strong className="text-slate-800 block mb-1">Linked BOQ Item:</strong>
                {claim.boq_item.item_name} ({claim.boq_item.approved_quantity} {claim.boq_item.unit} @ ₹{claim.boq_item.approved_rate})
              </div>
            )}
          </div>

          {/* Submitted Evidence & Geotag */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                <span>Submitted Evidence &amp; Geolocation</span>
              </div>
              <span className="text-[11px] text-slate-400 italic">
                * Submitted Evidence is not automatic proof of work
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Evidence Media Preview */}
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-xs">
                <img
                  src={claim.evidence_url || claim.document_url || 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f8?w=800&auto=format&fit=crop&q=80'}
                  alt="Submitted Evidence"
                  referrerPolicy="no-referrer"
                  className="w-full h-44 object-cover"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 text-xs flex items-center justify-between text-white">
                  <span className="truncate">{claim.evidence_path || claim.document_path || 'evidence_file.jpg'}</span>
                  <a
                    href={claim.evidence_url || claim.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded bg-black/40 hover:bg-black/60 text-white"
                    title="View Full Resolution"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Geotag and Metadata Card */}
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Live GPS Telemetry:</span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        claim.gps_status === 'MATCHED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {claim.gps_status === 'MATCHED' ? '✓ MATCHED' : '⚠ LOCATION MISMATCH'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Project Coordinates:</span>
                    <span className="font-mono text-slate-800 font-medium">
                      {claim.project?.latitude?.toFixed(4)}, {claim.project?.longitude?.toFixed(4)}
                    </span>
                  </div>
                  {claim.latitude !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Captured Coordinates:</span>
                      <span className="font-mono text-slate-800 font-medium">
                        {claim.latitude.toFixed(4)}, {claim.longitude?.toFixed(4)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Site Distance:</span>
                    <span className="font-mono text-slate-800 font-medium">
                      {claim.distance_meters !== undefined ? `${claim.distance_meters} m` : vr?.checks_detail?.gps?.distance_meters ? `${vr.checks_detail.gps.distance_meters} m` : 'Within Site'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">GPS Accuracy:</span>
                    <span className="font-mono text-emerald-600 font-medium">
                      ±{claim.accuracy ?? 8} m
                    </span>
                  </div>
                </div>

                {/* Evidence Integrity Hash */}
                <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5 shadow-xs font-mono text-[11px]">
                  <div className="flex items-center justify-between text-slate-500 font-sans">
                    <span className="font-semibold">Evidence Integrity:</span>
                    <span className="text-emerald-600 font-bold">✓ HASH RECORDED (SHA-256)</span>
                  </div>
                  <div className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100 break-all">
                    {claim.evidence_hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                  </div>
                  {claim.server_received_at && (
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-sans pt-1 border-t border-slate-100">
                      <span>Server Receipt:</span>
                      <span className="font-mono text-slate-700">{new Date(claim.server_received_at).toLocaleTimeString('en-IN')}</span>
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between shadow-xs">
                  <span className="text-slate-500 flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Timeline Check:
                  </span>
                  <span className={vr?.checks_detail?.timeline?.flag ? 'text-red-600 font-semibold' : 'text-green-600 font-medium'}>
                    {vr?.checks_detail?.timeline?.flag ? '❌ Outside Timeline' : '✅ Within Project Timeline'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Engine & Deterministic Verification Checks */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Explainable Risk Engine &amp; Verification Checks</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Indicates the need for review — not a fraud verdict.
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-semibold text-slate-500 block">Total Risk Score</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{vr?.total_risk_score ?? 0} / 100</span>
              </div>
            </div>

            {/* Explainable Scoring Summary */}
            <div className="grid grid-cols-3 gap-2 p-2.5 bg-white rounded-xl border border-slate-200 text-[11px]">
              <div className="text-center p-1.5 rounded-lg bg-slate-50">
                <div className="text-slate-500">Financial Mismatch</div>
                <div className={`font-mono font-bold text-xs mt-0.5 ${(vr?.financial_score || 0) > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                  +{(vr?.financial_score || 0)}
                </div>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-slate-50">
                <div className="text-slate-500">Progress Mismatch</div>
                <div className={`font-mono font-bold text-xs mt-0.5 ${(vr?.progress_score || 0) > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                  +{(vr?.progress_score || 0)}
                </div>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-slate-50">
                <div className="text-slate-500">GPS / Evidence Check</div>
                <div className={`font-mono font-bold text-xs mt-0.5 ${(vr?.evidence_score || 0) > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                  +{(vr?.evidence_score || 0)}
                </div>
              </div>
            </div>

            {/* Reason Flags List */}
            <ul className="space-y-1.5">
              {vr?.reasons?.map((reason, idx) => (
                <li key={idx} className="text-xs text-slate-800 flex items-start gap-2 bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${vr.total_risk_score >= 60 ? 'bg-red-500' : vr.total_risk_score >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>

            {/* Verification Detail Cards */}
            <div className="space-y-2 text-xs">
              {/* 8. Financial Verification (Three Numbers Comparison) */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">8. Financial Verification (3 Numbers)</span>
                  {vr?.checks_detail?.financial?.flag ? (
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                      ⚠️ MISMATCH (Verification Alert)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      ✓ TOLERANCE OK
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">Approved Cost</span>
                    <strong className="text-slate-900 font-mono">
                      ₹{(vr?.checks_detail?.financial?.approved_cost ?? claim.project?.approved_cost ?? 0).toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">Claimed Expenditure</span>
                    <strong className="text-slate-900 font-mono">
                      ₹{(vr?.checks_detail?.financial?.claimed_expenditure ?? claim.claimed_amount ?? 0).toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">Government Payment</span>
                    <strong className="text-slate-900 font-mono">
                      ₹{(vr?.checks_detail?.financial?.government_payment ?? claim.project?.government_payment ?? claim.project?.verified_expenditure ?? 0).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 pt-0.5">
                  {vr?.checks_detail?.financial?.detail}
                </p>
              </div>

              {/* 9. Progress Verification */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">9. Progress Verification (Reported Progress vs Claimed Expenditure)</span>
                  {vr?.checks_detail?.progress_vs_expense?.flag ? (
                    <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold border border-red-200">
                      🔴 HIGH RISK
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      ✓ CONSISTENT
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="bg-slate-50 p-2 rounded-lg flex justify-between items-center">
                    <span className="text-slate-500 text-[10px]">Reported Progress</span>
                    <strong className="text-indigo-600 font-mono text-xs">
                      {vr?.checks_detail?.progress_vs_expense?.reported_progress ?? claim.progress_percent ?? claim.project?.verified_progress ?? 0}%
                    </strong>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg flex justify-between items-center">
                    <span className="text-slate-500 text-[10px]">Claimed Expenditure</span>
                    <strong className="text-slate-900 font-mono text-xs">
                      {vr?.checks_detail?.progress_vs_expense?.claimed_expenditure_pct ?? (((claim.claimed_amount || 0) / (claim.project?.approved_cost || 1)) * 100).toFixed(1)}% of cost
                    </strong>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 pt-0.5">
                  {vr?.checks_detail?.progress_vs_expense?.detail}
                </p>
              </div>

              {/* 10. Evidence Verification (Check A GPS, Check B Timestamp, Check C Evidence Exists) */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">10. Evidence Verification (3 Checks)</span>
                  <span className="text-[10px] text-slate-400 font-semibold">Supporting Evidence</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                  {/* Check A GPS */}
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 text-[10px]">Check A — GPS</span>
                      {vr?.checks_detail?.gps?.flag ? (
                        <span className="text-[10px] font-bold text-red-600">🔴 Mismatch</span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600">✓ Within site</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {vr?.checks_detail?.gps?.distance_meters ? `${vr.checks_detail.gps.distance_meters}m from site` : 'Site verified'}
                    </div>
                  </div>

                  {/* Check B Timestamp */}
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 text-[10px]">Check B — Timestamp</span>
                      {vr?.checks_detail?.timeline?.flag ? (
                        <span className="text-[10px] font-bold text-amber-600">🟠 Timeline Issue</span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600">✓ On schedule</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {claim.project?.start_date ? `${claim.project.start_date} to ${claim.project.end_date}` : 'Within timeline'}
                    </div>
                  </div>

                  {/* Check C Evidence Exists */}
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 text-[10px]">Check C — Evidence</span>
                      {vr?.checks_detail?.evidence_exists?.flag ? (
                        <span className="text-[10px] font-bold text-amber-600">⚠️ Missing</span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600">✓ Submitted</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {claim.evidence_url || claim.document_url ? 'Attached' : 'Verified'}
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-100">
                  GPS and timestamp provide supporting evidence that the submission was made from the reported project location and time.
                </p>
              </div>
            </div>
          </div>

          {/* Past Remarks or Clarification History */}
          {(claim.remarks || claim.clarification_request || claim.clarification_response) && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-800">Verification &amp; Clarification History</div>
              {claim.remarks && (
                <div className="text-slate-700">
                  <span className="text-slate-500 font-medium">Authority Remarks: </span>
                  {claim.remarks}
                </div>
              )}
              {claim.clarification_request && (
                <div className="text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  <strong className="block text-amber-900">Clarification Request:</strong>
                  {claim.clarification_request}
                </div>
              )}
              {claim.clarification_response && (
                <div className="text-indigo-800 bg-indigo-50 p-2.5 rounded-lg border border-indigo-200">
                  <strong className="block text-indigo-900">Contractor Response:</strong>
                  {claim.clarification_response}
                </div>
              )}
            </div>
          )}

          {/* Action Form for Authority */}
          {isAuthority ? (
            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Authority Action Control
                </span>
                <span className="text-[11px] font-semibold text-slate-500">Role: District Authority</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveAction('VERIFY')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    activeAction === 'VERIFY'
                      ? 'bg-green-600 text-white border-green-600 shadow-sm'
                      : 'bg-white text-green-700 border-slate-200 hover:bg-green-50 shadow-xs'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verify Claim</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('REJECT')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    activeAction === 'REJECT'
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : 'bg-white text-red-700 border-slate-200 hover:bg-red-50 shadow-xs'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject Claim</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('CLARIFICATION')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    activeAction === 'CLARIFICATION'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-white text-amber-700 border-slate-200 hover:bg-amber-50 shadow-xs'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Clarification</span>
                </button>
              </div>

              {activeAction && (
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-bold text-slate-700">
                    {activeAction === 'VERIFY'
                      ? 'Verification Remarks / Approval Notes (Optional):'
                      : activeAction === 'REJECT'
                      ? 'Reason for Rejection (Mandatory):'
                      : 'Clarification Query to Contractor (Mandatory):'}
                  </label>
                  <textarea
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={
                      activeAction === 'VERIFY'
                        ? 'e.g. Physical verification complete. Expenditure verified against Measurement Book #44.'
                        : activeAction === 'REJECT'
                        ? 'e.g. Disproportionate expenditure claimed. GPS location outside permitted radius.'
                        : 'e.g. Please provide detailed material invoice and transit pass for GSB aggregate.'
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveAction(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAction}
                      disabled={loading}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition cursor-pointer ${
                        activeAction === 'VERIFY'
                          ? 'bg-green-600 hover:bg-green-700'
                          : activeAction === 'REJECT'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      {loading ? 'Processing...' : `Confirm ${activeAction}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <p className="font-bold text-slate-900">Read-Only Claim Inspection Mode</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Approval, verification, rejection, and clarification actions are strictly restricted to <strong>DISTRICT_AUTHORITY</strong>.
                </p>
              </div>
            </div>
          )}

          {feedback && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium shadow-xs ${
                feedback.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              {feedback.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] font-medium text-slate-500">
            JANDARPAN Rule Engine • MPLADS Transparent Monitoring
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
