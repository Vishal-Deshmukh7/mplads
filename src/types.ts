export type UserRole = 'MP' | 'DISTRICT_AUTHORITY' | 'IMPLEMENTING_AGENCY' | 'CONTRACTOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole | 'mp' | 'authority' | 'contractor';
  district_id?: string;
  district?: string;
  constituency_id?: string;
  constituency?: string;
  organization_name?: string;
  organization?: string;
  active_status?: boolean;
  assigned_project_ids?: string[];
  designation?: string;
  created_at: string;
}

export interface ContractorProjectAssignment {
  id: string;
  contractor_user_id: string;
  project_id: string;
  assignment_status: 'ACTIVE' | 'COMPLETED' | 'REVOKED';
}

export interface BoqItem {
  id: string;
  project_id: string;
  item_name: string;
  approved_quantity: number;
  unit: string;
  approved_rate: number;
  approved_amount: number;
}

export interface Project {
  id: string;
  project_code: string;
  name: string;
  description: string;
  district_id?: string;
  district?: string;
  constituency_id?: string;
  constituency: string;
  location: string;
  latitude: number;
  longitude: number;
  approved_cost: number;
  start_date: string;
  end_date: string;
  implementing_agency_id?: string;
  contractor_id: string | null;
  status: 'RECOMMENDED' | 'UNDER_REVIEW' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'HALTED';
  recommended_by?: string;
  recommended_date?: string;
  approved_by?: string;
  approved_date?: string;
  progress_notes?: string;
  created_at: string;
  contractor?: {
    id: string;
    name: string;
    organization?: string;
    email: string;
  } | null;
  boq_items?: BoqItem[];
  government_payment?: number;
  total_claimed_expenditure?: number;
  current_submitted_progress?: number;
  verified_expenditure?: number;
  verified_progress?: number;
  pending_claims_count?: number;
  claims_count?: number;
}

export interface VerificationResult {
  id: string;
  claim_id: string;
  claim_type: 'PROGRESS' | 'EXPENSE';
  financial_score: number;
  progress_score: number;
  evidence_score: number;
  timeline_score: number;
  duplicate_score: number;
  total_risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
  checks_detail: {
    financial: { flag: boolean; score: number; detail: string; approved_cost?: number; claimed_expenditure?: number; government_payment?: number };
    progress_vs_expense: { flag: boolean; score: number; detail: string; reported_progress?: number; claimed_expenditure_pct?: number };
    evidence_exists?: { flag: boolean; score: number; detail: string; submitted: boolean };
    gps: {
      flag: boolean;
      score: number;
      detail: string;
      distance_meters?: number;
      accuracy?: number;
      mock_detected?: boolean;
      status?: 'MATCHED' | 'MISMATCH' | 'REQUIRES_VERIFICATION';
    };
    timeline: { flag: boolean; score: number; detail: string };
    duplicate: { flag: boolean; score: number; detail: string };
  };
  created_at: string;
}

export interface Claim {
  id: string;
  claim_code: string;
  type: 'PROGRESS' | 'EXPENSE';
  project_id: string;
  contractor_id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'CLARIFICATION';
  remarks?: string;
  clarification_request?: string;
  clarification_response?: string;
  created_at: string;

  // Progress specific & Live Evidence Telemetry
  progress_percent?: number;
  description?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  mock_detected?: boolean;
  captured_at?: string;
  server_received_at?: string;
  evidence_hash?: string;
  distance_meters?: number;
  gps_status?: 'MATCHED' | 'MISMATCH' | 'REQUIRES_VERIFICATION';
  evidence_path?: string;
  evidence_url?: string;

  // Expense specific
  boq_item_id?: string;
  claimed_amount?: number;
  invoice_number?: string;
  invoice_date?: string;
  document_path?: string;
  document_url?: string;

  // Bundled relations
  verification_result?: VerificationResult;
  project?: {
    id: string;
    project_code: string;
    name: string;
    location: string;
    latitude: number;
    longitude: number;
    approved_cost: number;
    verified_expenditure?: number;
    verified_progress?: number;
    start_date: string;
    end_date: string;
  };
  contractor?: {
    id: string;
    name: string;
    organization?: string;
    email: string;
  };
  boq_item?: BoqItem;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string;
  user_role?: string;
  role?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  resource_type?: string;
  resource_id?: string;
  details?: string;
  result?: 'ALLOWED' | 'DENIED';
  timestamp: string;
}
