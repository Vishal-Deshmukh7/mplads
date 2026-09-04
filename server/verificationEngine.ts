import { Project, ProgressClaim, ExpenseClaim, VerificationResult, DatabaseSchema } from './db.js';

// Haversine formula to compute great-circle distance between two GPS coordinates in meters
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Configurable prototype radius for GPS geofencing verification (in meters)
export const ALLOWED_GPS_RADIUS_METERS = 500;

export interface VerificationInput {
  claimType: 'PROGRESS' | 'EXPENSE';
  project: Project;
  contractorId: string;
  progressPercent?: number;
  claimedAmount?: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  mockDetected?: boolean;
  claimTimestamp: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  evidenceUrl?: string;
  documentUrl?: string;
  allProjectExpenseClaims?: ExpenseClaim[];
  currentClaimId?: string;
}

export function runVerificationEngine(
  input: VerificationInput
): Omit<VerificationResult, 'id' | 'claim_id' | 'created_at'> {
  const reasons: string[] = [];
  let financialScore = 0;
  let progressScore = 0;
  let gpsScore = 0;
  let evidenceExistsScore = 0;
  let timelineScore = 0;
  let duplicateScore = 0;

  const project = input.project;
  const approvedCost = project.approved_cost || 1;
  const governmentPayment = project.government_payment ?? project.verified_expenditure ?? 0;

  // Calculate cumulative claimed expenditure on this project
  const otherExpenses = (input.allProjectExpenseClaims || [])
    .filter((c) => c.id !== input.currentClaimId && c.status !== 'REJECTED')
    .reduce((sum, c) => sum + (c.claimed_amount || 0), 0);

  const currentExpense = input.claimedAmount || 0;
  const totalCumulativeExpense = otherExpenses + currentExpense;
  const expensePercentageOfApproved = (totalCumulativeExpense / approvedCost) * 100;

  // Determine current project progress
  const reportedProgress =
    input.progressPercent !== undefined
      ? input.progressPercent
      : project.verified_progress || 0;

  const checksDetail: VerificationResult['checks_detail'] = {
    financial: {
      flag: false,
      score: 0,
      detail: 'Expenditure within approved limits.',
      approved_cost: approvedCost,
      claimed_expenditure: totalCumulativeExpense,
      government_payment: governmentPayment,
    },
    progress_vs_expense: {
      flag: false,
      score: 0,
      detail: 'Expenditure ratio is consistent with progress.',
      reported_progress: reportedProgress,
      claimed_expenditure_pct: Number(expensePercentageOfApproved.toFixed(1)),
    },
    evidence_exists: {
      flag: false,
      score: 0,
      detail: '✓ Supporting evidence submitted.',
      submitted: true,
    },
    gps: { flag: false, score: 0, detail: 'GPS verified within approved radius.' },
    timeline: { flag: false, score: 0, detail: 'Claim timestamp is within project timeline.' },
    duplicate: { flag: false, score: 0, detail: 'No duplicate claim detected.' },
  };

  // -------------------------------------------------------------
  // 8. FINANCIAL VERIFICATION (Uses 3 numbers: Approved Cost, Claimed Expenditure, Government Payment)
  // Example:
  // Approved Cost: ₹10,00,000 | Claimed Expenditure: ₹8,50,000 | Government Payment: ₹4,00,000
  // → ⚠️ MISMATCH (+40)
  // This becomes a verification alert, not a fraud verdict.
  // -------------------------------------------------------------
  if (input.claimType === 'EXPENSE' || input.claimedAmount) {
    if (totalCumulativeExpense > approvedCost) {
      financialScore = 40;
      checksDetail.financial = {
        flag: true,
        score: 40,
        detail: `⚠️ Financial Mismatch: Total claimed expenditure (₹${totalCumulativeExpense.toLocaleString('en-IN')}) exceeds approved project cost (₹${approvedCost.toLocaleString('en-IN')}).`,
        approved_cost: approvedCost,
        claimed_expenditure: totalCumulativeExpense,
        government_payment: governmentPayment,
      };
      reasons.push(
        `Financial mismatch — Total claimed expenditure (₹${totalCumulativeExpense.toLocaleString('en-IN')}) exceeds approved project cost (₹${approvedCost.toLocaleString('en-IN')})`
      );
    } else if (
      governmentPayment > 0 &&
      totalCumulativeExpense > governmentPayment &&
      (totalCumulativeExpense - governmentPayment >= 200000 || expensePercentageOfApproved >= 70)
    ) {
      financialScore = 40;
      checksDetail.financial = {
        flag: true,
        score: 40,
        detail: `⚠️ Financial Mismatch: Approved Cost ₹${approvedCost.toLocaleString('en-IN')}, Claimed Expenditure ₹${totalCumulativeExpense.toLocaleString('en-IN')}, Government Payment ₹${governmentPayment.toLocaleString('en-IN')} (Gap: ₹${(totalCumulativeExpense - governmentPayment).toLocaleString('en-IN')}).`,
        approved_cost: approvedCost,
        claimed_expenditure: totalCumulativeExpense,
        government_payment: governmentPayment,
      };
      reasons.push(
        `Financial mismatch — Claimed expenditure (₹${totalCumulativeExpense.toLocaleString('en-IN')}) vs official Government payment (₹${governmentPayment.toLocaleString('en-IN')}) on Approved Cost ₹${approvedCost.toLocaleString('en-IN')}`
      );
    } else if (expensePercentageOfApproved >= 85) {
      financialScore = 25;
      checksDetail.financial = {
        flag: true,
        score: 25,
        detail: `Claimed expenditure approaches approved limit (${expensePercentageOfApproved.toFixed(1)}% of ₹${approvedCost.toLocaleString('en-IN')}).`,
        approved_cost: approvedCost,
        claimed_expenditure: totalCumulativeExpense,
        government_payment: governmentPayment,
      };
      reasons.push(
        `Cumulative claimed expenditure approaches approved cost limit (${expensePercentageOfApproved.toFixed(1)}% reached)`
      );
    } else {
      checksDetail.financial = {
        flag: false,
        score: 0,
        detail: `Approved Cost: ₹${approvedCost.toLocaleString('en-IN')}, Claimed: ₹${totalCumulativeExpense.toLocaleString('en-IN')}, Government Payment: ₹${governmentPayment.toLocaleString('en-IN')}. Within acceptable limits.`,
        approved_cost: approvedCost,
        claimed_expenditure: totalCumulativeExpense,
        government_payment: governmentPayment,
      };
    }
  }

  // -------------------------------------------------------------
  // 9. PROGRESS VERIFICATION (Compare Reported Progress + Claimed Expenditure)
  // Example: Progress = 25%, Expenditure Claim = 80-85%
  // → 🔴 HIGH RISK (+30)
  // -------------------------------------------------------------
  const expenditureProgressRatioGap = expensePercentageOfApproved - reportedProgress;

  if (
    (expensePercentageOfApproved >= 60 && reportedProgress <= 30) ||
    (expensePercentageOfApproved > 40 && expenditureProgressRatioGap >= 25) ||
    (expensePercentageOfApproved > 80 && reportedProgress < 50)
  ) {
    progressScore = 30;
    checksDetail.progress_vs_expense = {
      flag: true,
      score: 30,
      detail: `⚠️ Progress Mismatch: Reported progress is ${reportedProgress}% while claimed expenditure represents ${expensePercentageOfApproved.toFixed(1)}% of total approved cost. High claimed expenditure against low verified progress.`,
      reported_progress: reportedProgress,
      claimed_expenditure_pct: Number(expensePercentageOfApproved.toFixed(1)),
    };
    reasons.push(
      `Progress mismatch — High claimed expenditure (${expensePercentageOfApproved.toFixed(1)}%) compared with low reported progress (${reportedProgress}%)`
    );
  } else {
    checksDetail.progress_vs_expense = {
      flag: false,
      score: 0,
      detail: `Reported progress (${reportedProgress}%) aligns with claimed expenditure (${expensePercentageOfApproved.toFixed(1)}%).`,
      reported_progress: reportedProgress,
      claimed_expenditure_pct: Number(expensePercentageOfApproved.toFixed(1)),
    };
  }

  // -------------------------------------------------------------
  // 10. EVIDENCE VERIFICATION (Only 3 checks: Check A GPS, Check B Timestamp, Check C Evidence Exists)
  // -------------------------------------------------------------

  // Check A — GPS (Project Location vs Submission Location)
  if (
    input.latitude !== undefined &&
    input.longitude !== undefined &&
    project.latitude &&
    project.longitude
  ) {
    const distMeters = calculateHaversineDistance(
      input.latitude,
      input.longitude,
      project.latitude,
      project.longitude
    );

    const isMock = Boolean(input.mockDetected);
    const isSuspiciousAccuracy =
      input.accuracy !== undefined && (input.accuracy <= 0 || input.accuracy > 1000);
    const isMismatch = distMeters > ALLOWED_GPS_RADIUS_METERS;

    let gpsStatus: 'MATCHED' | 'MISMATCH' | 'REQUIRES_VERIFICATION' = 'MATCHED';
    let gpsDetail = '';

    if (isMock || isSuspiciousAccuracy) {
      gpsScore = 30;
      gpsStatus = 'REQUIRES_VERIFICATION';
      gpsDetail = `Suspicious location data detected (Accuracy: ±${input.accuracy ?? 'unknown'}m, Mock flag: ${
        isMock ? 'YES' : 'NO'
      }). Location information requires authority verification.`;
      reasons.push('Location telemetry — mock location provider or abnormal accuracy detected');
    } else if (isMismatch) {
      gpsScore = 30;
      const distKm = (distMeters / 1000).toFixed(2);
      gpsStatus = 'MISMATCH';
      gpsDetail = `🔴 Location mismatch: Submitted GPS is ${distKm} km from registered project site (${project.location}). Allowed radius: ${(
        ALLOWED_GPS_RADIUS_METERS / 1000
      ).toFixed(1)} km. Requires authority verification.`;
      reasons.push(
        `Location mismatch — submitted GPS is ${distKm} km away from registered project site`
      );
    } else {
      gpsStatus = 'MATCHED';
      gpsDetail = `GPS and timestamp provide supporting evidence that the submission was made from the reported project location and time (${distMeters}m from site, accuracy ±${input.accuracy ?? 8}m).`;
    }

    checksDetail.gps = {
      flag: isMismatch || isMock || isSuspiciousAccuracy,
      score: gpsScore,
      detail: gpsDetail,
      distance_meters: distMeters,
      accuracy: input.accuracy,
      mock_detected: isMock,
      status: gpsStatus,
    };
  } else {
    checksDetail.gps = {
      flag: false,
      score: 0,
      detail: 'GPS coordinates not submitted or not required for this claim type.',
      status: 'MATCHED',
    };
  }

  // Check B — Timestamp (Submission Timestamp vs Project Timeline)
  const claimDateStr = input.invoiceDate || input.claimTimestamp;
  if (claimDateStr && project.start_date && project.end_date) {
    const claimTime = new Date(claimDateStr).getTime();
    const startTime = new Date(project.start_date).getTime();
    const endTime = new Date(project.end_date).getTime() + 24 * 60 * 60 * 1000; // end of day

    if (claimTime < startTime || claimTime > endTime) {
      timelineScore = 15;
      checksDetail.timeline = {
        flag: true,
        score: 15,
        detail: `🟠 Timeline issue: Submission date (${claimDateStr.split('T')[0]}) is outside the permitted project period (${project.start_date} to ${project.end_date}).`,
      };
      reasons.push(
        `Timeline issue — submission date falls outside permitted project period (${project.start_date} to ${project.end_date})`
      );
    } else {
      checksDetail.timeline = {
        flag: false,
        score: 0,
        detail: `Submission timestamp falls within the approved project timeline (${project.start_date} to ${project.end_date}).`,
      };
    }
  }

  // Check C — Evidence Exists (Required evidence? submitted? YES -> ✓, NO -> ⚠️)
  const hasEvidence =
    input.claimType === 'PROGRESS'
      ? Boolean(input.evidenceUrl || (input as any).evidence_url)
      : Boolean(input.documentUrl || (input as any).document_url || input.invoiceNumber);

  if (!hasEvidence) {
    evidenceExistsScore = 20;
    checksDetail.evidence_exists = {
      flag: true,
      score: 20,
      detail: '⚠️ Required supporting evidence is missing.',
      submitted: false,
    };
    reasons.push('Required supporting evidence is missing');
  } else {
    checksDetail.evidence_exists = {
      flag: false,
      score: 0,
      detail: '✓ Required supporting evidence is submitted and attached.',
      submitted: true,
    };
  }

  // Duplicate Check for Invoices
  if (input.claimType === 'EXPENSE' && input.invoiceNumber) {
    const cleanInvoice = input.invoiceNumber.trim().toUpperCase();
    const isDuplicate = (input.allProjectExpenseClaims || []).some((c) => {
      if (c.id === input.currentClaimId) return false;
      const otherInvoice = (c.invoice_number || '').trim().toUpperCase();
      return (
        otherInvoice === cleanInvoice &&
        c.project_id === project.id &&
        c.contractor_id === input.contractorId
      );
    });

    if (isDuplicate) {
      duplicateScore = 40;
      checksDetail.duplicate = {
        flag: true,
        score: 40,
        detail: `Invoice number '${input.invoiceNumber}' has already been submitted for this project by this contractor.`,
      };
      reasons.push(
        `Possible duplicate expense claim — invoice number '${input.invoiceNumber}' was already submitted`
      );
    } else {
      checksDetail.duplicate = {
        flag: false,
        score: 0,
        detail: `Invoice number '${input.invoiceNumber}' is unique for this contractor on this project.`,
      };
    }
  }

  // Total Evidence score = GPS + Missing Evidence
  const totalEvidenceScore = Math.min(40, gpsScore + evidenceExistsScore);

  // -------------------------------------------------------------
  // 11. RISK ENGINE (Explainable scoring: Financial mismatch +40, Progress mismatch +30, GPS mismatch +30)
  // Max score: 100
  // Bands: 0–29 LOW, 30–59 MEDIUM, 60–100 HIGH
  // Strictly named "Risk Score" (indicates the need for review, NOT "fraud probability")
  // -------------------------------------------------------------
  const rawScore =
    financialScore + progressScore + totalEvidenceScore + timelineScore + duplicateScore;
  const totalRiskScore = Math.min(100, rawScore);

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (totalRiskScore >= 60) {
    riskLevel = 'HIGH';
  } else if (totalRiskScore >= 30) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  if (reasons.length === 0) {
    reasons.push('All parameters verified within acceptable project thresholds.');
  }

  return {
    claim_type: input.claimType,
    financial_score: financialScore,
    progress_score: progressScore,
    evidence_score: totalEvidenceScore,
    timeline_score: timelineScore,
    duplicate_score: duplicateScore,
    total_risk_score: totalRiskScore,
    risk_level: riskLevel,
    reasons,
    checks_detail: checksDetail,
  };
}
