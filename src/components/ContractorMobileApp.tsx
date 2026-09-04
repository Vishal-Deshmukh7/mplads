import React, { useState, useEffect, useRef } from 'react';
import {
  FolderKanban,
  Clock,
  CheckCircle2,
  AlertCircle,
  Camera,
  MapPin,
  Upload,
  Plus,
  ArrowLeft,
  Calendar,
  Building2,
  FileText,
  IndianRupee,
  Layers,
  Send,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  RotateCcw,
  Lock,
  Radio,
} from 'lucide-react';
import { User, Project, Claim, BoqItem } from '../types';
import { api } from '../api';
import { LiveEvidenceCamera, CapturedEvidenceData } from './LiveEvidenceCamera';

interface ContractorMobileAppProps {
  currentUser: User;
  onRefreshData: () => void;
}

type ContractorScreen =
  | 'DASHBOARD'
  | 'PROJECTS_LIST'
  | 'PROJECT_DETAIL'
  | 'SUBMIT_PROGRESS'
  | 'LIVE_CAMERA'
  | 'EVIDENCE_PREVIEW'
  | 'SUBMISSION_SUCCESS'
  | 'SUBMIT_EXPENSE'
  | 'MY_CLAIMS'
  | 'CLAIM_DETAIL';

export const ContractorMobileApp: React.FC<ContractorMobileAppProps> = ({
  currentUser,
}) => {
  const [currentScreen, setCurrentScreen] = useState<ContractorScreen>('DASHBOARD');
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [myClaims, setMyClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Forms State: Progress Claim
  const [progressPercent, setProgressPercent] = useState<number>(25);
  const [workDescription, setWorkDescription] = useState<string>('Subgrade excavation and compaction completed for Chainage 0.00 to 1.20 km');
  const [capturedEvidence, setCapturedEvidence] = useState<CapturedEvidenceData | null>(null);
  const [submittedClaim, setSubmittedClaim] = useState<{ claim: Claim; message: string } | null>(null);

  // Forms State: Expense Claim
  const [selectedBoqId, setSelectedBoqId] = useState<string>('');
  const [claimedAmount, setClaimedAmount] = useState<string>('850000'); // Exact scenario 8.5 Lakhs
  const [invoiceNumber, setInvoiceNumber] = useState<string>('INV-APX-2024-089');
  const [invoiceDate, setInvoiceDate] = useState<string>('2024-05-12');
  const [documentUrl, setDocumentUrl] = useState<string>(
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80'
  );
  const [documentName, setDocumentName] = useState<string>('tax_invoice_receipt_850k.pdf');
  const [documentSize, setDocumentSize] = useState<string>('1.4 MB');
  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocumentName(file.name);
    setDocumentSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setDocumentUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Clarification response state
  const [clarificationText, setClarificationText] = useState<string>('');
  const [submittingClarification, setSubmittingClarification] = useState(false);

  // Fetch Contractor-specific data (strictly isolated!)
  const fetchContractorData = async () => {
    setLoading(true);
    try {
      const [projRes, claimsRes] = await Promise.all([
        api.getContractorProjects(),
        api.getContractorClaims(),
      ]);
      const projects = projRes?.projects || [];
      const claims = claimsRes?.claims || [];
      setAssignedProjects(projects);
      setMyClaims(claims);

      // If active project is selected, refresh its details
      if (selectedProject) {
        const refreshedProj = projects.find((p) => p.id === selectedProject.id);
        if (refreshedProj) setSelectedProject(refreshedProj);
      }
    } catch (err: any) {
      console.error('Contractor data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContractorData();
  }, [currentUser]);

  // Sync BOQ with selected project if present
  useEffect(() => {
    if (selectedProject) {
      if (selectedProject.boq_items && selectedProject.boq_items.length > 0) {
        setSelectedBoqId(selectedProject.boq_items[0].id);
      }
    }
  }, [selectedProject]);

  // Open Live Camera Flow
  const handleOpenLiveCamera = () => {
    // Ensure a project is selected
    if (!selectedProject && assignedProjects.length > 0) {
      setSelectedProject(assignedProjects[0]);
    }
    // Auto-fill default description if empty so user is never blocked from opening camera
    if (!workDescription.trim()) {
      setWorkDescription('Subgrade excavation, compaction, and construction progress verification completed as per technical specifications.');
    }
    setFeedbackMessage(null);
    setCurrentScreen('LIVE_CAMERA');
  };

  // Callback when live camera completes capture
  const handleCapturedEvidence = (data: CapturedEvidenceData) => {
    setCapturedEvidence(data);
    setCurrentScreen('EVIDENCE_PREVIEW');
  };

  // Retake evidence: clear temporary capture and reopen live camera
  const handleRetakeEvidence = () => {
    setCapturedEvidence(null);
    setCurrentScreen('LIVE_CAMERA');
  };

  // Submit Progress Claim Handler with Live Evidence
  const handleConfirmSubmitClaim = async () => {
    if (!selectedProject || !capturedEvidence) return;

    setLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await api.submitProgressClaim(selectedProject.id, {
        progress_percent: progressPercent,
        description: workDescription,
        latitude: capturedEvidence.latitude,
        longitude: capturedEvidence.longitude,
        accuracy: capturedEvidence.accuracy,
        mock_detected: capturedEvidence.mockDetected,
        evidence_url: capturedEvidence.dataUrl,
        captured_at: capturedEvidence.timestamp,
      });

      // Strict security: purge local temporary evidence from memory immediately
      setCapturedEvidence(null);
      setSubmittedClaim({ claim: res.claim, message: res.message });
      setCurrentScreen('SUBMISSION_SUCCESS');
      await fetchContractorData();
    } catch (err: any) {
      setFeedbackMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Submit Expense Claim Handler
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    setLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await api.submitExpenseClaim(selectedProject.id, {
        claimed_amount: Number(claimedAmount),
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        boq_item_id: selectedBoqId || undefined,
        document_url: documentUrl,
        document_path: 'tax_invoice_receipt.pdf',
      });

      setFeedbackMessage(`✅ ${res.message}`);
      await fetchContractorData();
      setTimeout(() => {
        setCurrentScreen('MY_CLAIMS');
        setFeedbackMessage(null);
      }, 1200);
    } catch (err: any) {
      setFeedbackMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Respond to Clarification
  const handleSendClarification = async (claimId: string) => {
    if (!clarificationText.trim()) return;
    setSubmittingClarification(true);
    try {
      await api.respondClarification(claimId, clarificationText);
      setClarificationText('');
      await fetchContractorData();
      // Reload selected claim
      const updated = await api.getClaim(claimId);
      setSelectedClaim(updated.claim);
    } catch (err: any) {
      alert(err.message || 'Failed to submit clarification');
    } finally {
      setSubmittingClarification(false);
    }
  };

  // Metrics
  const pendingCount = myClaims.filter((c) => c.status === 'PENDING_VERIFICATION').length;
  const verifiedCount = myClaims.filter((c) => c.status === 'VERIFIED').length;
  const clarificationCount = myClaims.filter((c) => c.status === 'CLARIFICATION').length;

  return (
    <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-3xl shadow-xl overflow-hidden flex flex-col min-h-[720px] text-slate-800">
      {/* Mobile Top AppBar */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-xs border-b border-slate-200">
        {/* Status bar notch simulation */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2">
          <span className="font-mono">09:41</span>
          <span className="font-bold text-indigo-600">JANDARPAN Mobile</span>
          <div className="flex items-center gap-1">
            <span>5G</span>
            <span className="w-3 h-2 bg-emerald-500 rounded-xs inline-block" />
          </div>
        </div>

        {/* Action Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {currentScreen !== 'DASHBOARD' && (
              <button
                onClick={() => setCurrentScreen('DASHBOARD')}
                className="p-1 rounded-full hover:bg-slate-100 transition text-slate-600 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="text-sm font-bold text-slate-900 leading-tight">
                {currentScreen === 'DASHBOARD' && 'Contractor Portal'}
                {currentScreen === 'PROJECTS_LIST' && 'Assigned Projects'}
                {currentScreen === 'PROJECT_DETAIL' && 'Project Scope & BOQ'}
                {currentScreen === 'SUBMIT_PROGRESS' && 'Submit Progress Claim'}
                {currentScreen === 'SUBMIT_EXPENSE' && 'Submit Expenditure Claim'}
                {currentScreen === 'MY_CLAIMS' && 'My Submitted Claims'}
                {currentScreen === 'CLAIM_DETAIL' && 'Claim Status & Audit'}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {currentUser.name} • {currentUser.organization || 'Verified Contractor'}
              </div>
            </div>
          </div>

          <button
            onClick={fetchContractorData}
            title="Refresh"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Screen Container */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs bg-slate-50">
        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-medium shadow-xs">
            {feedbackMessage}
          </div>
        )}

        {/* -------------------------------------------------------------
            SCREEN 1: CONTRACTOR DASHBOARD
        ------------------------------------------------------------- */}
        {currentScreen === 'DASHBOARD' && (
          <div className="space-y-4">
            {/* Clarification Alert Banner */}
            {clarificationCount > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 shadow-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-amber-900">
                    {clarificationCount} Claim(s) Require Clarification
                  </div>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Authority requested additional documentation or explanation.
                  </p>
                  <button
                    onClick={() => setCurrentScreen('MY_CLAIMS')}
                    className="mt-2 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1 rounded-lg transition cursor-pointer shadow-xs"
                  >
                    Review Inquiries
                  </button>
                </div>
              </div>
            )}

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div
                onClick={() => setCurrentScreen('PROJECTS_LIST')}
                className="bg-white border border-slate-200 p-3 rounded-2xl cursor-pointer hover:border-indigo-300 hover:shadow-xs transition shadow-xs"
              >
                <FolderKanban className="w-4 h-4 text-indigo-600 mx-auto" />
                <div className="text-lg font-bold text-slate-900 mt-1">{assignedProjects.length}</div>
                <div className="text-[10px] text-slate-500 font-medium">Assigned Projects</div>
              </div>

              <div
                onClick={() => setCurrentScreen('MY_CLAIMS')}
                className="bg-white border border-slate-200 p-3 rounded-2xl cursor-pointer hover:border-indigo-300 hover:shadow-xs transition shadow-xs"
              >
                <Clock className="w-4 h-4 text-amber-600 mx-auto" />
                <div className="text-lg font-bold text-amber-600 mt-1">{pendingCount}</div>
                <div className="text-[10px] text-slate-500 font-medium">Pending Review</div>
              </div>

              <div
                onClick={() => setCurrentScreen('MY_CLAIMS')}
                className="bg-white border border-slate-200 p-3 rounded-2xl cursor-pointer hover:border-indigo-300 hover:shadow-xs transition shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                <div className="text-lg font-bold text-green-700 mt-1">{verifiedCount}</div>
                <div className="text-[10px] text-slate-500 font-medium">Verified Claims</div>
              </div>
            </div>

            {/* Assigned Projects Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">My Assigned Projects</span>
                <button
                  onClick={() => setCurrentScreen('PROJECTS_LIST')}
                  className="text-indigo-600 text-[11px] font-semibold hover:underline cursor-pointer"
                >
                  View All
                </button>
              </div>

              {(assignedProjects || []).length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  No projects currently assigned to this contractor account.
                </div>
              ) : (
                (assignedProjects || []).map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => {
                      setSelectedProject(proj);
                      setCurrentScreen('PROJECT_DETAIL');
                    }}
                    className="p-3.5 bg-white hover:border-indigo-300 border border-slate-200 rounded-2xl cursor-pointer transition space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 font-semibold">
                        {proj.project_code}
                      </span>
                      <span className="text-[10px] font-bold text-green-700">
                        {proj.verified_progress || 0}% Verified
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-xs line-clamp-1">{proj.name}</h4>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                      <span>Approved Budget:</span>
                      <span className="font-bold text-slate-900">₹{proj.approved_cost.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Claim Actions */}
            {assignedProjects.length > 0 && (
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-xs">
                <span className="font-bold text-slate-800 block">Submit Evidence-Based Claim</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setSelectedProject(assignedProjects[0]);
                      setCurrentScreen('SUBMIT_PROGRESS');
                    }}
                    className="p-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Progress Claim</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedProject(assignedProjects[0]);
                      setCurrentScreen('SUBMIT_EXPENSE');
                    }}
                    className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <IndianRupee className="w-4 h-4" />
                    <span>Expense Claim</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            SCREEN 2: ASSIGNED PROJECTS LIST
        ------------------------------------------------------------- */}
        {currentScreen === 'PROJECTS_LIST' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Feature 1 — Controlled Access:</strong> You can only see projects sanctioned and assigned to your firm.
              </span>
            </div>

            {(assignedProjects || []).length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs">
                No projects assigned to your firm yet.
              </div>
            ) : (
              (assignedProjects || []).map((proj) => (
                <div
                  key={proj.id}
                onClick={() => {
                  setSelectedProject(proj);
                  setCurrentScreen('PROJECT_DETAIL');
                }}
                className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2.5 cursor-pointer hover:border-indigo-300 transition shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 font-semibold">
                    {proj.project_code}
                  </span>
                  <span className="text-[10px] font-bold text-green-700 uppercase">
                    {proj.status}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900">{proj.name}</h3>

                <p className="text-[11px] text-slate-500 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{proj.location}</span>
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Approved Budget</span>
                    <span className="font-bold text-slate-900">₹{proj.approved_cost.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Verified Progress</span>
                    <span className="font-bold text-indigo-600">{proj.verified_progress || 0}%</span>
                  </div>
                </div>
              </div>
            )))}
          </div>
        )}

        {/* -------------------------------------------------------------
            SCREEN 3: PROJECT DETAILS & BOQ
        ------------------------------------------------------------- */}
        {currentScreen === 'PROJECT_DETAIL' && selectedProject && (
          <div className="space-y-4">
            {/* Project Header */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2 shadow-xs">
              <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 font-semibold">
                {selectedProject.project_code}
              </span>
              <h3 className="text-sm font-bold text-slate-900">{selectedProject.name}</h3>
              <p className="text-[11px] text-slate-500">{selectedProject.description}</p>
              <div className="flex items-center gap-1 text-[11px] text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{selectedProject.location}</span>
              </div>
            </div>

            {/* Approved Financial Model */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2.5 shadow-xs">
              <span className="font-bold text-slate-900 block text-xs">Financial Overview</span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Approved Cost:</span>
                  <span className="font-bold text-slate-900 text-xs">
                    ₹{selectedProject.approved_cost.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Verified Expenditure:</span>
                  <span className="font-bold text-green-700 text-xs">
                    ₹{(selectedProject.verified_expenditure || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                  <span className="text-slate-500 block">Timeline:</span>
                  <span className="text-slate-800 font-medium">
                    {selectedProject.start_date} to {selectedProject.end_date}
                  </span>
                </div>
              </div>
            </div>

            {/* BOQ Items */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2.5 shadow-xs">
              <span className="font-bold text-slate-900 block text-xs">Approved Bill of Quantities (BOQ)</span>
              {(!selectedProject.boq_items || selectedProject.boq_items.length === 0) ? (
                <div className="text-slate-500 text-[11px]">Standard lump-sum sanctioned works.</div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedProject.boq_items.map((b) => (
                    <div key={b.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                      <div className="font-semibold text-slate-800">{b.item_name}</div>
                      <div className="text-slate-500 mt-1 flex justify-between">
                        <span>{b.approved_quantity} {b.unit} @ ₹{b.approved_rate}</span>
                        <span className="font-bold text-green-700">₹{b.approved_amount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setCurrentScreen('SUBMIT_PROGRESS')}
                className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold text-white text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Submit Progress</span>
              </button>

              <button
                onClick={() => setCurrentScreen('SUBMIT_EXPENSE')}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 font-semibold text-white text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Submit Expense</span>
              </button>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            SCREEN 4: SUBMIT PROGRESS CLAIM (CONTROLLED LIVE EVIDENCE)
        ------------------------------------------------------------- */}
        {currentScreen === 'SUBMIT_PROGRESS' && selectedProject && (
          <div className="space-y-3.5">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Project</span>
              <div className="font-bold text-slate-900">{selectedProject.name}</div>
              <div className="text-[11px] text-slate-500 font-mono">
                {selectedProject.project_code} • {selectedProject.location}
              </div>
            </div>

            {/* Progress Percentage */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 text-xs">Progress Percentage *</label>
                <span className="text-base font-bold text-indigo-600 font-mono">{progressPercent}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={progressPercent}
                onChange={(e) => setProgressPercent(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>0%</span>
                <span className="text-indigo-600 font-semibold">Demo Scenario Target: 25%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Work Description */}
            <div className="space-y-1">
              <label className="font-bold text-slate-800 text-xs">Work Description *</label>
              <textarea
                rows={2}
                required
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="Describe specific work completed on site..."
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            {/* 🔒 Controlled Live Site Evidence Capture Card */}
            <div className="p-5 bg-white rounded-2xl border-2 border-dashed border-indigo-200 text-center space-y-3.5 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
                <Lock className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">LIVE SITE EVIDENCE</h3>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                  <Lock className="w-3 h-3 text-slate-500" />
                  <span>Controlled JANDARPAN Capture</span>
                </div>
              </div>

              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                No gallery upload permitted. Evidence is captured live and linked to this project.
              </p>

              <button
                id="btn-open-live-camera"
                type="button"
                onClick={handleOpenLiveCamera}
                className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold text-white text-xs flex items-center justify-center gap-2 shadow-sm shadow-indigo-200 transition cursor-pointer active:scale-[0.99]"
              >
                <Camera className="w-4 h-4" />
                <span>TAKE EVIDENCE</span>
              </button>
              <p className="text-[10px] text-slate-400 leading-tight">
                GPS and timestamp provide supporting evidence that the submission was made from the reported project location and time.
              </p>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            SCREEN: LIVE CAMERA FULL-SCREEN MODAL/VIEW
        ------------------------------------------------------------- */}
        {currentScreen === 'LIVE_CAMERA' && (selectedProject || assignedProjects[0]) && (
          <LiveEvidenceCamera
            project={selectedProject || assignedProjects[0]}
            currentUser={currentUser}
            onCapture={handleCapturedEvidence}
            onCancel={() => setCurrentScreen('SUBMIT_PROGRESS')}
          />
        )}

        {/* -------------------------------------------------------------
            SCREEN: EVIDENCE PREVIEW & INTEGRITY CONFIRMATION
        ------------------------------------------------------------- */}
        {currentScreen === 'EVIDENCE_PREVIEW' && selectedProject && capturedEvidence && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center space-y-1.5 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">LIVE EVIDENCE CAPTURED ✓</h2>
              <p className="text-xs text-slate-500">
                Visual telemetry and GPS coordinates bound to project record.
              </p>
            </div>

            {/* Evidence Preview Image */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 shadow-md">
              <img
                src={capturedEvidence.dataUrl}
                alt="Live Captured Evidence"
                className="w-full h-56 object-cover"
              />
              <div className="absolute top-2 left-2 bg-slate-900/85 backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] font-mono text-emerald-400 border border-slate-700 flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                <span>In-Memory Evidence • Tamper-Sealed</span>
              </div>
            </div>

            {/* Telemetry Summary Card */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2.5 text-xs shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Project:</span>
                <span className="font-bold text-slate-900">{selectedProject.project_code}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Location:</span>
                <span
                  className={`font-bold ${
                    capturedEvidence.status === 'MATCHED'
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }`}
                >
                  {capturedEvidence.status === 'MATCHED'
                    ? '✓ Matched'
                    : '⚠ Requires Authority Verification'}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">GPS Accuracy:</span>
                <span className="font-mono text-slate-800 font-semibold">
                  ±{capturedEvidence.accuracy} m
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Timestamp:</span>
                <span className="font-mono text-slate-800 font-semibold">
                  ✓ Recorded ({new Date(capturedEvidence.timestamp).toLocaleTimeString('en-IN')})
                </span>
              </div>
            </div>

            {/* Actions: SUBMIT EVIDENCE or RETAKE */}
            <div className="space-y-2 pt-1">
              <button
                id="btn-submit-live-evidence"
                type="button"
                disabled={loading}
                onClick={handleConfirmSubmitClaim}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-white text-xs shadow-sm shadow-emerald-200 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? 'Transmitting Evidence...' : 'SUBMIT EVIDENCE'}</span>
              </button>

              <button
                id="btn-retake-live-evidence"
                type="button"
                disabled={loading}
                onClick={handleRetakeEvidence}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer border border-slate-200 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>RETAKE</span>
              </button>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            SCREEN: SUBMISSION SUCCESS & SUMMARY
        ------------------------------------------------------------- */}
        {currentScreen === 'SUBMISSION_SUCCESS' && selectedProject && submittedClaim && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">CLAIM SUBMITTED ✓</h2>
              <div className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-mono border border-slate-200">
                {submittedClaim.claim.claim_code}
              </div>
            </div>

            {/* Structured Submission Breakdown matching Requirement */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 text-xs shadow-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Project:</span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">
                  {selectedProject.name}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {selectedProject.project_code} • {selectedProject.location}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Progress:</span>
                  <span className="text-base font-bold text-indigo-600 font-mono">
                    {submittedClaim.claim.progress_percent}%
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Evidence:</span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>✓ Successfully Submitted</span>
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Location:</span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>✓ Captured</span>
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Timestamp:</span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>✓ Recorded</span>
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold border border-amber-200">
                    PENDING VERIFICATION
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Risk:</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                    UNDER AUTOMATED CHECK
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                🔒 The submitted evidence is securely stored for authority verification. No local copies or gallery files were retained on this device.
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setCurrentScreen('MY_CLAIMS')}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold text-white text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>VIEW IN MY CLAIMS</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentScreen('PROJECTS_LIST')}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>RETURN TO PROJECTS</span>
              </button>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            SCREEN 5: SUBMIT EXPENDITURE CLAIM (SIH Scenario: ₹8,50,000)
        ------------------------------------------------------------- */}
        {currentScreen === 'SUBMIT_EXPENSE' && selectedProject && (
          <form onSubmit={handleExpenseSubmit} className="space-y-3.5">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-1 shadow-xs">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Project</span>
              <div className="font-bold text-slate-900">{selectedProject.name}</div>
              <div className="text-[11px] text-slate-500">
                Approved Budget: <strong className="text-slate-900">₹{selectedProject.approved_cost.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {/* Linked BOQ Item */}
            <div className="space-y-1">
              <label className="font-bold text-slate-800">Linked BOQ Item</label>
              <select
                value={selectedBoqId}
                onChange={(e) => setSelectedBoqId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 shadow-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {selectedProject.boq_items?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.item_name} (Allocated: ₹{b.approved_amount.toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>

            {/* Claimed Amount */}
            <div className="space-y-1">
              <label className="font-bold text-slate-800 flex items-center justify-between">
                <span>Claimed Expenditure (₹) *</span>
                <span className="text-indigo-600 text-[11px] font-semibold">Prompt Target: ₹8,50,000</span>
              </label>
              <input
                type="number"
                min="100"
                required
                value={claimedAmount}
                onChange={(e) => setClaimedAmount(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-mono text-slate-900 font-bold text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
              <span className="text-[10px] text-slate-500 font-medium">
                ₹{Number(claimedAmount || 0).toLocaleString('en-IN')} (
                {(((Number(claimedAmount || 0)) / selectedProject.approved_cost) * 100).toFixed(1)}% of total approved cost)
              </span>
            </div>

            {/* Invoice Details */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-800 block mb-1">Invoice / Bill # *</label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Invoice Date *</label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
                />
              </div>
            </div>

            {/* Supporting Document / Evidence Upload (Dedicated single-option upload) */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 text-xs">Supporting Document *</label>
                <span className="text-[10px] text-slate-400 font-medium">Invoice / Bill Evidence</span>
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={documentInputRef}
                onChange={handleDocumentFileChange}
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
              />

              {documentUrl ? (
                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {documentName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {documentSize} • Attached Evidence
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-600 font-bold shrink-0">✓ Attached</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => documentInputRef.current?.click()}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Supporting Document</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => documentInputRef.current?.click()}
                  className="w-full py-6 px-4 border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/40 hover:bg-indigo-50 text-center flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Upload className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-700">Upload Supporting Document</span>
                  <span className="text-[10px] text-slate-500">Click to select invoice, bill or receipt evidence</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold text-white text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Transmitting Claim...' : 'Submit Expenditure Claim'}</span>
            </button>
          </form>
        )}

        {/* -------------------------------------------------------------
            SCREEN 6: MY CLAIMS (STATUS & CLARIFICATIONS)
        ------------------------------------------------------------- */}
        {currentScreen === 'MY_CLAIMS' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">Claims Submitted by Me</span>
              <span className="text-[11px] text-slate-500 font-mono font-medium">{(myClaims || []).length} records</span>
            </div>

            {(myClaims || []).length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs">
                You have not submitted any claims yet.
              </div>
            ) : (
              (myClaims || []).map((claim) => {
                const vr = claim.verification_result;
                return (
                  <div
                    key={claim.id}
                    onClick={() => {
                      setSelectedClaim(claim);
                      setCurrentScreen('CLAIM_DETAIL');
                    }}
                    className="p-3.5 bg-white hover:border-indigo-300 border border-slate-200 rounded-2xl space-y-2 cursor-pointer transition shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {claim.claim_code}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                          claim.status === 'VERIFIED'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : claim.status === 'REJECTED'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : claim.status === 'CLARIFICATION'
                            ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {claim.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-800 font-medium line-clamp-1">{claim.project?.name}</div>

                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                      <div>
                        {claim.type === 'PROGRESS' ? (
                          <span className="text-indigo-600 font-bold">{claim.progress_percent}% Progress</span>
                        ) : (
                          <span className="text-slate-900 font-bold">
                            ₹{claim.claimed_amount?.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>

                      {vr && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">Risk:</span>
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              vr.risk_level === 'HIGH'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : vr.risk_level === 'MEDIUM'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-green-50 text-green-700 border border-green-200'
                            }`}
                          >
                            {vr.risk_level} ({vr.total_risk_score})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            SCREEN 7: CLAIM DETAIL & CLARIFICATION RESPONSE
        ------------------------------------------------------------- */}
        {currentScreen === 'CLAIM_DETAIL' && selectedClaim && (
          <div className="space-y-3.5">
            {/* Claim Card Header */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{selectedClaim.claim_code}</span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                    selectedClaim.status === 'VERIFIED'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : selectedClaim.status === 'REJECTED'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : selectedClaim.status === 'CLARIFICATION'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}
                >
                  {selectedClaim.status.replace('_', ' ')}
                </span>
              </div>
              <div className="font-bold text-slate-900">{selectedClaim.project?.name}</div>
            </div>

            {/* Financial / Progress Summary */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2 text-xs shadow-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Claim Type:</span>
                <span className="font-bold text-slate-900">{selectedClaim.type}</span>
              </div>
              {selectedClaim.type === 'PROGRESS' ? (
                <div className="flex justify-between">
                  <span className="text-slate-500">Reported Progress:</span>
                  <span className="font-bold text-indigo-600">{selectedClaim.progress_percent}%</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Claimed Expenditure:</span>
                    <span className="font-bold text-slate-900">
                      ₹{selectedClaim.claimed_amount?.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice:</span>
                    <span className="font-mono text-slate-800 font-semibold">{selectedClaim.invoice_number}</span>
                  </div>
                </>
              )}
            </div>

            {/* Evidence Image & Live Telemetry */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs">
              <div className="relative">
                <img
                  src={selectedClaim.evidence_url || selectedClaim.document_url || 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f8?w=800&auto=format&fit=crop&q=80'}
                  alt="Submitted Evidence"
                  referrerPolicy="no-referrer"
                  className="w-full h-44 object-cover"
                />
                <div className="absolute top-2 left-2 bg-slate-900/85 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] font-mono text-emerald-400 border border-slate-700 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>JANDARPAN Verified</span>
                </div>
              </div>

              <div className="p-3 text-xs space-y-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Location Status:</span>
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      selectedClaim.gps_status === 'MATCHED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {selectedClaim.gps_status === 'MATCHED' ? '✓ MATCHED' : '⚠ REQUIRES VERIFICATION'}
                  </span>
                </div>

                {selectedClaim.latitude !== undefined && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">GPS Coordinates:</span>
                    <span className="font-mono text-slate-800">
                      {selectedClaim.latitude.toFixed(4)}, {selectedClaim.longitude?.toFixed(4)} (±{selectedClaim.accuracy ?? 8}m)
                    </span>
                  </div>
                )}

                {selectedClaim.evidence_hash && (
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-mono space-y-0.5">
                    <span className="text-slate-400 block font-sans font-semibold">Evidence Integrity (SHA-256):</span>
                    <span className="text-slate-600 break-all">{selectedClaim.evidence_hash}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Automated Risk Status */}
            {selectedClaim.verification_result && (
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Automated Risk Status</span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                      selectedClaim.verification_result.risk_level === 'HIGH'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : selectedClaim.verification_result.risk_level === 'MEDIUM'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-green-50 text-green-700 border-green-200'
                    }`}
                  >
                    {selectedClaim.verification_result.risk_level} ({selectedClaim.verification_result.total_risk_score}/100)
                  </span>
                </div>
                {selectedClaim.verification_result.reasons && selectedClaim.verification_result.reasons.length > 0 ? (
                  <ul className="space-y-1.5 text-[11px] text-slate-600">
                    {selectedClaim.verification_result.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[11px] text-green-700 flex items-center gap-1.5">
                    <span>✓</span>
                    <span>All automated verification checks passed within thresholds.</span>
                  </div>
                )}
              </div>
            )}

            {/* Authority Remarks */}
            {selectedClaim.remarks && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Authority Remarks:</span>
                <p className="text-xs text-slate-800 font-medium">{selectedClaim.remarks}</p>
              </div>
            )}

            {/* Clarification Response Section */}
            {selectedClaim.status === 'CLARIFICATION' && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2.5 shadow-xs">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>Authority Inquiry</span>
                </div>
                <p className="text-xs text-amber-900 bg-white/80 p-2.5 rounded-xl border border-amber-100">
                  {selectedClaim.clarification_request}
                </p>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] text-slate-700 font-semibold">Your Response / Explanation:</label>
                  <textarea
                    rows={3}
                    value={clarificationText}
                    onChange={(e) => setClarificationText(e.target.value)}
                    placeholder="Provide additional details or references for verification..."
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-xs"
                  />
                  <button
                    onClick={() => handleSendClarification(selectedClaim.id)}
                    disabled={submittingClarification}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 font-bold text-white rounded-xl text-xs transition cursor-pointer shadow-xs"
                  >
                    {submittingClarification ? 'Submitting...' : 'Submit Clarification to Authority'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="bg-white border-t border-slate-200 px-4 py-2.5 flex items-center justify-around text-slate-500 text-[10px]">
        <button
          onClick={() => setCurrentScreen('DASHBOARD')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${
            currentScreen === 'DASHBOARD' ? 'text-indigo-600 font-bold' : 'hover:text-slate-800'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setCurrentScreen('PROJECTS_LIST')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${
            currentScreen === 'PROJECTS_LIST' || currentScreen === 'PROJECT_DETAIL'
              ? 'text-indigo-600 font-bold'
              : 'hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Projects</span>
        </button>

        <button
          onClick={() => {
            if (assignedProjects.length > 0) {
              setSelectedProject(assignedProjects[0]);
              setCurrentScreen('SUBMIT_PROGRESS');
            }
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer ${
            currentScreen === 'SUBMIT_PROGRESS' || currentScreen === 'SUBMIT_EXPENSE'
              ? 'text-indigo-600 font-bold'
              : 'hover:text-slate-800'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>New Claim</span>
        </button>

        <button
          onClick={() => setCurrentScreen('MY_CLAIMS')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${
            currentScreen === 'MY_CLAIMS' || currentScreen === 'CLAIM_DETAIL'
              ? 'text-indigo-600 font-bold'
              : 'hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>My Claims</span>
        </button>
      </div>
    </div>
  );
};
