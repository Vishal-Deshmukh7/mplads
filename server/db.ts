import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export type UserRole = 'MP' | 'DISTRICT_AUTHORITY' | 'IMPLEMENTING_AGENCY' | 'CONTRACTOR';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole | string;
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
  district: string;
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
  sanction_order_number?: string;
  sanctioned_amount?: number;
  sanction_date?: string;
  progress_notes?: string;
  created_at: string;
  boq_items?: BoqItem[];
  government_payment?: number; // Official government disbursed payment
  verified_expenditure?: number;
  verified_progress?: number;
}

export interface Contract {
  id: string;
  project_id: string;
  contractor_id: string;
  contract_value: number;
  assigned_date: string;
  status: 'ACTIVE' | 'TERMINATED' | 'COMPLETED';
}

export interface ProgressClaim {
  id: string;
  claim_code: string;
  type: 'PROGRESS';
  project_id: string;
  contractor_id: string;
  progress_percent: number;
  description: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  mock_detected?: boolean;
  captured_at: string;
  server_received_at?: string;
  evidence_hash?: string;
  distance_meters?: number;
  gps_status?: 'MATCHED' | 'MISMATCH' | 'REQUIRES_VERIFICATION';
  evidence_path?: string;
  evidence_url?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'CLARIFICATION';
  remarks?: string;
  clarification_request?: string;
  clarification_response?: string;
  created_at: string;
}

export interface ExpenseClaim {
  id: string;
  claim_code: string;
  type: 'EXPENSE';
  project_id: string;
  contractor_id: string;
  boq_item_id?: string;
  claimed_amount: number;
  invoice_number: string;
  invoice_date: string;
  document_path?: string;
  document_url?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'CLARIFICATION';
  remarks?: string;
  clarification_request?: string;
  clarification_response?: string;
  created_at: string;
}

export type Claim = (ProgressClaim | ExpenseClaim) & {
  type: 'PROGRESS' | 'EXPENSE';
  verification_result?: VerificationResult;
  project?: Project;
  contractor?: User;
  boq_item?: BoqItem;
};

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

export interface DatabaseSchema {
  users: User[];
  projects: Project[];
  contracts: Contract[];
  contractor_project_assignments: ContractorProjectAssignment[];
  boq_items: BoqItem[];
  progress_claims: ProgressClaim[];
  expense_claims: ExpenseClaim[];
  verification_results: VerificationResult[];
  audit_logs: AuditLog[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Default initial seed data
export function getInitialSeedData(): DatabaseSchema {
  const salt = bcrypt.genSaltSync(10);
  const defaultPasswordHash = bcrypt.hashSync('jandarpan123', salt);

  const users: User[] = [
    {
      id: 'usr-mp-01',
      name: 'Shri Anand Mohan Sharma',
      email: 'mp.demo@jandarpan.demo',
      password_hash: defaultPasswordHash,
      role: 'MP',
      district_id: 'pune',
      district: 'Pune District',
      constituency_id: 'Pune (PC-34)',
      constituency: 'Pune Parliamentary Constituency (PC-34)',
      organization_name: 'Parliament of India • Lok Sabha',
      organization: 'Parliament of India • Lok Sabha',
      active_status: true,
      designation: "Hon'ble Member of Parliament (Lok Sabha)",
      created_at: '2024-01-05T09:00:00.000Z',
    },
    {
      id: 'usr-auth-01',
      name: 'Dr. Rajesh Sharma, IAS',
      email: 'authority.pune@jandarpan.demo',
      password_hash: defaultPasswordHash,
      role: 'DISTRICT_AUTHORITY',
      district_id: 'pune',
      district: 'Pune District',
      constituency_id: 'Pune (PC-34)',
      constituency: 'Pune (PC-34)',
      organization_name: 'District Collectorate & DRDA, Pune',
      organization: 'District Collectorate & DRDA, Pune',
      active_status: true,
      designation: 'District Collector & Nodal Officer (MPLADS)',
      created_at: '2024-01-10T09:00:00.000Z',
    },
    {
      id: 'usr-auth-02',
      name: 'Smt. Sujata Patil, IAS',
      email: 'authority.nashik@jandarpan.demo',
      password_hash: defaultPasswordHash,
      role: 'DISTRICT_AUTHORITY',
      district_id: 'nashik',
      district: 'Nashik District',
      constituency_id: 'Nashik (PC-20)',
      constituency: 'Nashik (PC-20)',
      organization_name: 'District Collectorate, Nashik',
      organization: 'District Collectorate, Nashik',
      active_status: true,
      designation: 'District Collector & Nodal Officer, Nashik',
      created_at: '2024-01-10T09:00:00.000Z',
    },
    {
      id: 'usr-agency-01',
      name: 'Public Works Division - Pune Rural',
      email: 'agency.pune@jandarpan.demo',
      password_hash: defaultPasswordHash,
      role: 'IMPLEMENTING_AGENCY',
      district_id: 'pune',
      district: 'Pune District',
      constituency_id: 'Pune (PC-34)',
      constituency: 'Pune (PC-34)',
      organization_name: 'Maharashtra State PWD (Execution Wing)',
      organization: 'Maharashtra State PWD (Execution Wing)',
      active_status: true,
      designation: 'Executive Engineer, PWD Pune',
      created_at: '2024-01-12T09:00:00.000Z',
    },
    {
      id: 'usr-cont-01',
      name: 'ABC Construction',
      email: 'contractor.demo@jandarpan.demo',
      password_hash: defaultPasswordHash,
      role: 'CONTRACTOR',
      district_id: 'pune',
      district: 'Pune District',
      organization_name: 'ABC Construction Pvt. Ltd.',
      organization: 'ABC Construction Pvt. Ltd.',
      active_status: true,
      assigned_project_ids: ['proj-001'],
      designation: 'Empanelled Contractor (Class A)',
      created_at: '2024-01-15T10:00:00.000Z',
    },
    {
      id: 'usr-cont-02',
      name: 'XYZ Infrastructure',
      email: 'contractor.xyz@jandarpan.demo',
      password_hash: defaultPasswordHash,
      role: 'CONTRACTOR',
      district_id: 'pune',
      district: 'Pune District',
      organization_name: 'XYZ Infrastructure Ltd.',
      organization: 'XYZ Infrastructure Ltd.',
      active_status: true,
      assigned_project_ids: ['proj-002'],
      designation: 'Empanelled Contractor (Roads & Bridges)',
      created_at: '2024-01-15T10:00:00.000Z',
    },
    {
      id: 'usr-cont-03',
      name: 'PQR Developers',
      email: 'contractor.pqr@jandarpan.demo',
      password_hash: defaultPasswordHash,
      role: 'CONTRACTOR',
      district_id: 'nashik',
      district: 'Nashik District',
      organization_name: 'PQR Developers',
      organization: 'PQR Developers',
      active_status: true,
      assigned_project_ids: ['proj-003'],
      designation: 'Empanelled Contractor, Nashik',
      created_at: '2024-01-16T10:00:00.000Z',
    },
  ];

  const projects: Project[] = [
    {
      id: 'proj-001',
      project_code: 'MPLADS-PN-001',
      name: 'Construction of Community Health Sub-Centre',
      description: 'Building modern 4-bed maternal care room, pharmacy, diagnostic point, and solar backup in Haveli Taluka.',
      district_id: 'pune',
      district: 'Pune District',
      constituency_id: 'Pune (PC-34)',
      constituency: 'Pune (PC-34)',
      location: 'Haveli Taluka, Pune District',
      latitude: 18.5204,
      longitude: 73.8567,
      approved_cost: 2500000, // 25 Lakhs
      start_date: '2024-02-01',
      end_date: '2024-11-30',
      recommended_by: 'Shri Anand Mohan Sharma (MP)',
      recommended_date: '2024-01-12',
      approved_by: 'Dr. Rajesh Sharma, IAS (Nodal Officer)',
      approved_date: '2024-01-20',
      implementing_agency_id: 'usr-agency-01',
      contractor_id: 'usr-cont-01',
      status: 'IN_PROGRESS',
      created_at: '2024-01-22T10:00:00.000Z',
      verified_expenditure: 750000,
      verified_progress: 35,
      government_payment: 750000,
    },
    {
      id: 'proj-002',
      project_code: 'MPLADS-PN-002',
      name: 'Construction of Public Community Hall',
      description: 'Multi-purpose community center with solar power backup and rainwater harvesting for public assemblies.',
      district_id: 'pune',
      district: 'Pune District',
      constituency_id: 'Pune (PC-34)',
      constituency: 'Pune (PC-34)',
      location: 'Ambegaon Village, Pune District',
      latitude: 18.4574,
      longitude: 73.8508,
      approved_cost: 1800000, // 18 Lakhs
      start_date: '2024-03-01',
      end_date: '2024-12-15',
      recommended_by: 'Shri Anand Mohan Sharma (MP)',
      recommended_date: '2024-02-05',
      approved_by: 'Dr. Rajesh Sharma, IAS (Nodal Officer)',
      approved_date: '2024-02-18',
      implementing_agency_id: 'usr-agency-01',
      contractor_id: 'usr-cont-02',
      status: 'IN_PROGRESS',
      created_at: '2024-02-10T11:00:00.000Z',
      government_payment: 400000,
      verified_expenditure: 400000,
      verified_progress: 20,
    },
    {
      id: 'proj-003',
      project_code: 'MPLADS-NK-001',
      name: 'Improvement of Public Road',
      description: 'Widening and bituminous macadam road with concrete cross-drainage culverts in Dindori Link Road.',
      district_id: 'nashik',
      district: 'Nashik District',
      constituency_id: 'Nashik (PC-20)',
      constituency: 'Nashik (PC-20)',
      location: 'Dindori Link Road, Nashik District',
      latitude: 19.9975,
      longitude: 73.7898,
      approved_cost: 3200000, // 32 Lakhs
      start_date: '2024-03-01',
      end_date: '2024-12-31',
      recommended_by: 'Shri Hemant Godse (MP)',
      recommended_date: '2024-02-10',
      approved_by: 'Smt. Sujata Patil, IAS',
      approved_date: '2024-02-25',
      implementing_agency_id: 'usr-agency-nashik',
      contractor_id: 'usr-cont-03',
      status: 'IN_PROGRESS',
      created_at: '2024-02-25T09:30:00.000Z',
      verified_expenditure: 900000,
      verified_progress: 28,
      government_payment: 900000,
    },
    {
      id: 'proj-004',
      project_code: 'MPLADS-PN-003',
      name: 'Solar High-Mast Lighting & Rural Water Station',
      description: 'Installation of 10 high-mast solar lighting poles, pedestrian paving, and automated clean drinking water station in Baramati.',
      district_id: 'pune',
      district: 'Pune District',
      constituency_id: 'Pune (PC-34)',
      constituency: 'Pune (PC-34)',
      location: 'Baramati Rural Hub, Pune District',
      latitude: 18.5314,
      longitude: 73.8446,
      approved_cost: 1200000, // 12 Lakhs
      start_date: '2024-06-01',
      end_date: '2025-01-31',
      recommended_by: 'Shri Anand Mohan Sharma (MP)',
      recommended_date: '2024-05-10',
      implementing_agency_id: 'usr-agency-01',
      contractor_id: null,
      status: 'RECOMMENDED', // Ready for Direct Sanction by District Authority!
      created_at: '2024-05-10T14:20:00.000Z',
      verified_expenditure: 0,
      verified_progress: 0,
    },
  ];

  const contractor_project_assignments: ContractorProjectAssignment[] = [
    {
      id: 'asgn-01',
      contractor_user_id: 'usr-cont-01',
      project_id: 'proj-001',
      assignment_status: 'ACTIVE',
    },
    {
      id: 'asgn-02',
      contractor_user_id: 'usr-cont-02',
      project_id: 'proj-002',
      assignment_status: 'ACTIVE',
    },
    {
      id: 'asgn-03',
      contractor_user_id: 'usr-cont-03',
      project_id: 'proj-003',
      assignment_status: 'ACTIVE',
    },
  ];

  const boq_items: BoqItem[] = [
    {
      id: 'boq-001',
      project_id: 'proj-002',
      item_name: 'Sub-grade earth excavation and mechanical compaction (600mm)',
      approved_quantity: 4800,
      unit: 'cu.m',
      approved_rate: 50,
      approved_amount: 240000,
    },
    {
      id: 'boq-002',
      project_id: 'proj-002',
      item_name: 'Granular Sub-Base (GSB) grading material laying and compaction',
      approved_quantity: 1200,
      unit: 'cu.m',
      approved_rate: 260,
      approved_amount: 312000,
    },
    {
      id: 'boq-003',
      project_id: 'proj-002',
      item_name: 'Dense Bituminous Macadam (DBM) 50mm thickness layer',
      approved_quantity: 7200,
      unit: 'sq.m',
      approved_rate: 350,
      approved_amount: 252000,
    },
    {
      id: 'boq-004',
      project_id: 'proj-002',
      item_name: 'Reinforced Concrete Hume Pipe Culverts (900mm dia with wing walls)',
      approved_quantity: 4,
      unit: 'sets',
      approved_rate: 49000,
      approved_amount: 196000,
    },
    {
      id: 'boq-101',
      project_id: 'proj-001',
      item_name: 'RCC Foundation, Grade Beam & Plinth masonry works',
      approved_quantity: 120,
      unit: 'cu.m',
      approved_rate: 6500,
      approved_amount: 780000,
    },
    {
      id: 'boq-102',
      project_id: 'proj-001',
      item_name: 'AAC Block Superstructure with earthquake band detailing',
      approved_quantity: 180,
      unit: 'cu.m',
      approved_rate: 4200,
      approved_amount: 756000,
    },
    {
      id: 'boq-103',
      project_id: 'proj-001',
      item_name: 'Hospital grade vitrified flooring, electrical wiring & plumbing',
      approved_quantity: 1,
      unit: 'lumpsum',
      approved_rate: 964000,
      approved_amount: 964000,
    },
    {
      id: 'boq-201',
      project_id: 'proj-003',
      item_name: 'Supply and erection of 1000 LPH multi-stage RO purification skid',
      approved_quantity: 3,
      unit: 'units',
      approved_rate: 350000,
      approved_amount: 1050000,
    },
    {
      id: 'boq-202',
      project_id: 'proj-003',
      item_name: '5 KW Hybrid Solar Power Plant with lithium battery pack',
      approved_quantity: 3,
      unit: 'systems',
      approved_rate: 150000,
      approved_amount: 450000,
    },
    {
      id: 'boq-301',
      project_id: 'proj-004',
      item_name: 'Digital Interactive Flat Panels & Classroom Computer Terminals',
      approved_quantity: 1,
      unit: 'lumpsum',
      approved_rate: 800000,
      approved_amount: 800000,
    },
  ];

  const contracts: Contract[] = [
    {
      id: 'cntr-001',
      project_id: 'proj-001',
      contractor_id: 'usr-cont-01',
      contract_value: 2500000,
      assigned_date: '2024-01-25',
      status: 'ACTIVE',
    },
    {
      id: 'cntr-002',
      project_id: 'proj-002',
      contractor_id: 'usr-cont-02',
      contract_value: 1800000,
      assigned_date: '2024-02-15',
      status: 'ACTIVE',
    },
    {
      id: 'cntr-003',
      project_id: 'proj-003',
      contractor_id: 'usr-cont-03',
      contract_value: 3200000,
      assigned_date: '2024-02-25',
      status: 'ACTIVE',
    },
  ];

  // Preset claims demonstrating all requested test scenarios under Varanasi District:
  const progress_claims: ProgressClaim[] = [
    {
      id: 'clm-prg-001',
      claim_code: 'CLM-PRG-2024-001',
      type: 'PROGRESS',
      project_id: 'proj-001',
      contractor_id: 'usr-cont-01',
      progress_percent: 35,
      description: 'Plinth masonry completed along with DPC coat and preliminary backfilling in Rohaniya.',
      latitude: 25.2613, // exact location match (~15 meters)
      longitude: 82.9146,
      captured_at: '2024-04-12T10:30:00.000Z',
      evidence_path: 'demo_plinth_site.jpg',
      evidence_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f8?w=800&auto=format&fit=crop&q=80',
      status: 'VERIFIED',
      remarks: 'Inspected and verified by Assistant Engineer on site.',
      created_at: '2024-04-12T11:00:00.000Z',
    },
    {
      id: 'clm-prg-002',
      claim_code: 'CLM-PRG-2024-002',
      type: 'PROGRESS',
      project_id: 'proj-002',
      contractor_id: 'usr-cont-01',
      progress_percent: 25,
      description: 'Sub-base soil excavation completed up to Chainage 1.20 km in Pindra Block. GSB material procured at transit yard.',
      latitude: 25.5412,
      longitude: 82.8520,
      captured_at: '2024-05-10T14:15:00.000Z',
      evidence_path: 'demo_road_cut.jpg',
      evidence_url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800&auto=format&fit=crop&q=80',
      status: 'PENDING_VERIFICATION',
      created_at: '2024-05-10T14:30:00.000Z',
    },
    {
      id: 'clm-prg-005',
      claim_code: 'CLM-PRG-2024-005',
      type: 'PROGRESS',
      project_id: 'proj-001',
      contractor_id: 'usr-cont-01',
      progress_percent: 90,
      description: 'Premature claim of 90% completion submitted before roof slab curing period elapsed.',
      latitude: 25.2612,
      longitude: 82.9145,
      captured_at: '2024-05-02T11:00:00.000Z',
      evidence_path: 'demo_slab.jpg',
      evidence_url: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=800&auto=format&fit=crop&q=80',
      status: 'REJECTED',
      remarks: 'Rejected during joint physical inspection. Roof curing pending; electrical conduits not laid.',
      created_at: '2024-05-02T11:30:00.000Z',
    },
  ];

  const expense_claims: ExpenseClaim[] = [
    {
      id: 'clm-exp-001',
      claim_code: 'CLM-EXP-2024-001',
      type: 'EXPENSE',
      project_id: 'proj-001',
      contractor_id: 'usr-cont-01',
      boq_item_id: 'boq-101',
      claimed_amount: 750000,
      invoice_number: 'INV-APX-2024-011',
      invoice_date: '2024-04-10',
      document_path: 'tax_inv_011.pdf',
      document_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
      status: 'VERIFIED',
      remarks: 'Matched with Measurement Book (MB) Record No 44/24.',
      created_at: '2024-04-11T10:00:00.000Z',
    },
    {
      id: 'clm-exp-002',
      claim_code: 'CLM-EXP-2024-002',
      type: 'EXPENSE',
      project_id: 'proj-002', // Approved cost 10,00,000. Progress is 25%. Claimed 8,50,000! (High Risk Scenario)
      contractor_id: 'usr-cont-01',
      boq_item_id: 'boq-002',
      claimed_amount: 850000,
      invoice_number: 'INV-APX-2024-089',
      invoice_date: '2024-05-12',
      document_path: 'tax_inv_089.pdf',
      document_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
      status: 'PENDING_VERIFICATION',
      created_at: '2024-05-12T12:00:00.000Z',
    },
    {
      id: 'clm-exp-003',
      claim_code: 'CLM-EXP-2024-003',
      type: 'EXPENSE',
      project_id: 'proj-002',
      contractor_id: 'usr-cont-01',
      boq_item_id: 'boq-003',
      claimed_amount: 250000,
      invoice_number: 'INV-APX-2024-089', // DUPLICATE invoice number on same project & contractor!
      invoice_date: '2024-05-15',
      document_path: 'tax_inv_089_dup.pdf',
      document_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
      status: 'PENDING_VERIFICATION',
      created_at: '2024-05-15T16:00:00.000Z',
    },
  ];

  const verification_results: VerificationResult[] = [
    {
      id: 'vr-001',
      claim_id: 'clm-prg-001',
      claim_type: 'PROGRESS',
      financial_score: 0,
      progress_score: 0,
      evidence_score: 0,
      timeline_score: 0,
      duplicate_score: 0,
      total_risk_score: 0,
      risk_level: 'LOW',
      reasons: ['All checks within normal parameters'],
      checks_detail: {
        financial: { flag: false, score: 0, detail: 'Cumulative expenditure ₹7,50,000 is 30% of approved budget.' },
        progress_vs_expense: { flag: false, score: 0, detail: 'Reported progress (35%) is consistent with expenditure (30%).' },
        gps: { flag: false, score: 0, detail: 'GPS verified within 15 meters of site.', distance_meters: 15 },
        timeline: { flag: false, score: 0, detail: 'Claim date is within approved timeline.' },
        duplicate: { flag: false, score: 0, detail: 'No duplicate claim detected.' },
      },
      created_at: '2024-04-12T11:00:00.000Z',
    },
    {
      id: 'vr-002',
      claim_id: 'clm-exp-002', // The 70/100 HIGH RISK scenario
      claim_type: 'EXPENSE',
      financial_score: 40,
      progress_score: 30,
      evidence_score: 0,
      timeline_score: 0,
      duplicate_score: 0,
      total_risk_score: 70,
      risk_level: 'HIGH',
      reasons: [
        'Disproportionate expenditure compared with reported progress (Claimed: 85% of budget vs Progress: 25%)',
        'Cumulative claimed expenditure approaches or exceeds approved project cost limit',
      ],
      checks_detail: {
        financial: { flag: true, score: 40, detail: 'Claimed ₹8,50,000 on approved cost ₹10,00,000 represents 85% expenditure.' },
        progress_vs_expense: { flag: true, score: 30, detail: 'Progress is only 25% while expenditure claim is 85% (60% gap).' },
        gps: { flag: false, score: 0, detail: 'Not applicable for expense claim.' },
        timeline: { flag: false, score: 0, detail: 'Invoice date 2024-05-12 is within project dates.' },
        duplicate: { flag: false, score: 0, detail: 'First submission of invoice INV-APX-2024-089.' },
      },
      created_at: '2024-05-12T12:00:00.000Z',
    },
    {
      id: 'vr-004',
      claim_id: 'clm-exp-003', // Duplicate invoice scenario
      claim_type: 'EXPENSE',
      financial_score: 40,
      progress_score: 0,
      evidence_score: 0,
      timeline_score: 0,
      duplicate_score: 40,
      total_risk_score: 80,
      risk_level: 'HIGH',
      reasons: [
        'Possible duplicate expense claim — invoice number "INV-APX-2024-089" was already submitted for this project',
        'Total cumulative expenditure (₹11,00,000) exceeds approved project cost (₹10,00,000)',
      ],
      checks_detail: {
        financial: { flag: true, score: 40, detail: 'Total claimed expenditure exceeds 100% of approved budget.' },
        progress_vs_expense: { flag: false, score: 0, detail: 'Checked separately.' },
        gps: { flag: false, score: 0, detail: 'N/A' },
        timeline: { flag: false, score: 0, detail: 'Within dates.' },
        duplicate: { flag: true, score: 40, detail: 'Invoice INV-APX-2024-089 previously submitted on 2024-05-12.' },
      },
      created_at: '2024-05-15T16:00:00.000Z',
    },
  ];

  const audit_logs: AuditLog[] = [
    {
      id: 'aud-000',
      user_id: 'usr-mp-01',
      user_name: 'Shri Anand Mohan Sharma',
      user_role: 'mp',
      action: 'PROJECT_RECOMMENDED',
      entity_type: 'PROJECT',
      entity_id: 'proj-004',
      details: 'Hon\'ble MP recommended Digital Smart Classrooms for GGIC Chiraigaon under Varanasi District',
      timestamp: '2024-05-18T14:20:00.000Z',
    },
    {
      id: 'aud-001',
      user_id: 'usr-auth-01',
      user_name: 'Dr. Rajesh Sharma, IAS',
      user_role: 'authority',
      action: 'PROJECT_APPROVED',
      entity_type: 'PROJECT',
      entity_id: 'proj-003',
      details: 'Nodal Officer approved & sanctioned RO Water ATM Plants (Outlay: ₹15,00,000) in Sevapuri Block',
      timestamp: '2024-03-25T10:00:00.000Z',
    },
    {
      id: 'aud-002',
      user_id: 'usr-auth-01',
      user_name: 'Dr. Rajesh Sharma, IAS',
      user_role: 'authority',
      action: 'CONTRACTOR_ASSIGNED',
      entity_type: 'PROJECT',
      entity_id: 'proj-001',
      details: 'Assigned M/s Apex Infrastructure Pvt. Ltd. (Rahul Verma) for Rohaniya Sub-Centre',
      timestamp: '2024-01-25T11:00:00.000Z',
    },
    {
      id: 'aud-003',
      user_id: 'usr-cont-01',
      user_name: 'Rahul Verma',
      user_role: 'contractor',
      action: 'PROGRESS_UPDATED',
      entity_type: 'PROGRESS_CLAIM',
      entity_id: 'clm-prg-001',
      details: 'Contractor submitted progress update (35%) with geotagged live evidence in Rohaniya',
      timestamp: '2024-04-12T11:00:00.000Z',
    },
    {
      id: 'aud-004',
      user_id: 'usr-auth-01',
      user_name: 'Dr. Rajesh Sharma, IAS',
      user_role: 'authority',
      action: 'CLAIM_VERIFIED',
      entity_type: 'PROGRESS_CLAIM',
      entity_id: 'clm-prg-001',
      details: 'Nodal Officer verified claim CLM-PRG-2024-001 after MB measurement audit',
      timestamp: '2024-04-14T15:30:00.000Z',
    },
    {
      id: 'aud-005',
      user_id: 'usr-cont-01',
      user_name: 'Rahul Verma',
      user_role: 'contractor',
      action: 'EXPENSE_CLAIMED',
      entity_type: 'EXPENSE_CLAIM',
      entity_id: 'clm-exp-002',
      details: 'Submitted expense claim ₹8,50,000 for invoice INV-APX-2024-089 (Road project)',
      timestamp: '2024-05-12T12:00:00.000Z',
    },
    {
      id: 'aud-006',
      user_id: 'SYSTEM',
      user_name: 'Verification Engine',
      user_role: 'system',
      action: 'AUTOMATED_RISK_EVALUATION',
      entity_type: 'EXPENSE_CLAIM',
      entity_id: 'clm-exp-002',
      details: 'Risk score computed: 70/100 (HIGH RISK). Reason: High expenditure compared with reported progress.',
      timestamp: '2024-05-12T12:00:05.000Z',
    },
  ];

  return {
    users,
    projects,
    contracts,
    contractor_project_assignments,
    boq_items,
    progress_claims,
    expense_claims,
    verification_results,
    audit_logs,
  };
}

// Database store with atomic disk persistence
class JsonDatabase {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDir();
    this.data = this.load();
  }

  private ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.users && parsed.projects && parsed.contractor_project_assignments) {
          const hasPuneAuth = parsed.users.some((u: any) => u.email === 'authority.pune@jandarpan.demo' || u.role === 'DISTRICT_AUTHORITY');
          const hasMP = parsed.users.some((u: any) => u.email === 'mp.demo@jandarpan.demo' || u.role === 'MP');
          if (hasPuneAuth && hasMP) {
            return parsed;
          }
          console.log('Database missing RBAC seed accounts. Resetting to full JANDARPAN RBAC seed data.');
        }
      }
    } catch (err) {
      console.error('Failed to parse db.json, re-seeding:', err);
    }
    const seed = getInitialSeedData();
    this.save(seed);
    return seed;
  }

  public save(data?: DatabaseSchema) {
    if (data) {
      this.data = data;
    }
    this.ensureDir();
    fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  public resetToSeed() {
    const seed = getInitialSeedData();
    this.save(seed);
    return this.data;
  }

  public get(): DatabaseSchema {
    return this.data;
  }
}

export const db = new JsonDatabase();
