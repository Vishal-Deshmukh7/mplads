import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, Project, BoqItem, ProgressClaim, ExpenseClaim, VerificationResult, Contract, ContractorProjectAssignment } from './db.js';
import {
  AuthRequest,
  authenticate,
  requireRole,
  generateToken,
  logAudit,
  normalizeRole,
  requireProjectAccess,
  requireDistrictAccess,
} from './auth.js';
import { runVerificationEngine, calculateHaversineDistance, ALLOWED_GPS_RADIUS_METERS } from './verificationEngine.js';

export const apiRouter = Router();

// -------------------------------------------------------------
// AUTHENTICATION
// -------------------------------------------------------------
apiRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalized = email.toLowerCase().trim();
  const allUsers = db.get().users;
  let user = allUsers.find((u) => u.email.toLowerCase() === normalized);

  // Support aliases
  if (!user) {
    if (normalized === 'authority.pune@jandarpan.demo' || normalized === 'nodal.officer@mplads.gov.in' || normalized === 'authority@mplads.gov.in') {
      user = allUsers.find((u) => normalizeRole(u.role) === 'DISTRICT_AUTHORITY' && (u.district_id === 'pune' || u.district_id === 'varanasi')) || allUsers.find((u) => normalizeRole(u.role) === 'DISTRICT_AUTHORITY');
    } else if (normalized === 'authority.nashik@jandarpan.demo' || normalized === 'da.ayodhya@mplads.gov.in' || normalized === 'authority2@mplads.gov.in') {
      user = allUsers.find((u) => u.id === 'usr-auth-02');
    } else if (normalized === 'mp.demo@jandarpan.demo' || normalized === 'mp@mplads.gov.in') {
      user = allUsers.find((u) => normalizeRole(u.role) === 'MP');
    } else if (normalized === 'contractor.demo@jandarpan.demo' || normalized === 'apex.infra@contractor.in') {
      user = allUsers.find((u) => normalizeRole(u.role) === 'CONTRACTOR' && u.id === 'usr-cont-01');
    } else if (normalized === 'contractor.xyz@jandarpan.demo' || normalized === 'buildwell@contractor.in') {
      user = allUsers.find((u) => u.id === 'usr-cont-02');
    } else if (normalized === 'agency.pune@jandarpan.demo' || normalized === 'pwd.varanasi@up.gov.in' || normalized === 'agency@mplads.gov.in') {
      user = allUsers.find((u) => normalizeRole(u.role) === 'IMPLEMENTING_AGENCY');
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.active_status === false) {
    return res.status(403).json({ error: 'Your account has been deactivated. Please contact the administrator.' });
  }

  const isDemoPassword = password === 'jandarpan123';
  const valid = isDemoPassword || bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = generateToken(user);
  logAudit({
    user,
    action: 'USER_LOGIN',
    resource_type: 'USER',
    resource_id: user.id,
    details: `User logged in from portal (${normalizeRole(user.role)})`,
    result: 'ALLOWED',
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role),
      district_id: user.district_id,
      district: user.district,
      constituency_id: user.constituency_id,
      constituency: user.constituency,
      organization_name: user.organization_name || user.organization,
      organization: user.organization_name || user.organization,
      assigned_project_ids: user.assigned_project_ids,
      active_status: user.active_status,
      designation: user.designation,
    },
  });
});

apiRouter.get('/auth/me', authenticate, (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: normalizeRole(req.user.role),
      district_id: req.user.district_id,
      district: req.user.district,
      constituency_id: req.user.constituency_id,
      constituency: req.user.constituency,
      organization_name: req.user.organization_name || req.user.organization,
      organization: req.user.organization_name || req.user.organization,
      assigned_project_ids: req.user.assigned_project_ids,
      active_status: req.user.active_status,
      designation: req.user.designation,
    },
  });
});

// Demo convenience: List all demo accounts with roles
apiRouter.get('/auth/demo-accounts', (req, res) => {
  const accounts = db.get().users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: normalizeRole(u.role),
    district_id: u.district_id,
    district: u.district,
    organization: u.organization_name || u.organization,
    designation: u.designation,
  }));
  res.json({ accounts });
});

// -------------------------------------------------------------
// CONTRACTORS LIST (For assignment)
// -------------------------------------------------------------
apiRouter.get('/contractors', authenticate, requireRole('DISTRICT_AUTHORITY', 'MP'), (req, res) => {
  const contractors = db
    .get()
    .users.filter((u) => normalizeRole(u.role) === 'CONTRACTOR')
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      district_id: u.district_id,
      organization: u.organization_name || u.organization,
      designation: u.designation,
    }));
  res.json({ contractors });
});

// -------------------------------------------------------------
// PROJECTS MANAGEMENT
// -------------------------------------------------------------
// Helper to enrich project with stats
function enrichProject(proj: Project) {
  const data = db.get();
  const contractor = data.users.find((u) => u.id === proj.contractor_id);
  const boqItems = data.boq_items.filter((b) => b.project_id === proj.id);
  const progressClaims = data.progress_claims.filter((c) => c.project_id === proj.id);
  const expenseClaims = data.expense_claims.filter((c) => c.project_id === proj.id);

  // Calculate cumulative claimed expenditure
  const totalClaimedExpenditure = expenseClaims
    .filter((c) => c.status !== 'REJECTED')
    .reduce((sum, c) => sum + (c.claimed_amount || 0), 0);

  // Latest progress claim
  const latestProgressClaim = [...progressClaims]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const pendingClaimsCount =
    progressClaims.filter((c) => c.status === 'PENDING_VERIFICATION').length +
    expenseClaims.filter((c) => c.status === 'PENDING_VERIFICATION').length;

  return {
    ...proj,
    contractor: contractor
      ? { id: contractor.id, name: contractor.name, organization: contractor.organization, email: contractor.email }
      : null,
    boq_items: boqItems,
    government_payment: proj.government_payment ?? (proj.verified_expenditure || 0),
    total_claimed_expenditure: totalClaimedExpenditure,
    current_submitted_progress: latestProgressClaim ? latestProgressClaim.progress_percent : (proj.verified_progress || 0),
    pending_claims_count: pendingClaimsCount,
    claims_count: progressClaims.length + expenseClaims.length,
  };
}

// GET /projects - Filtered strictly by RBAC
apiRouter.get('/projects', authenticate, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const userRole = normalizeRole(user.role);
  const data = db.get();

  let projects = data.projects;

  if (userRole === 'CONTRACTOR') {
    // Contractor sees ONLY assigned projects
    const assignedIds = (data.contractor_project_assignments || [])
      .filter((a) => a.contractor_user_id === user.id && a.assignment_status === 'ACTIVE')
      .map((a) => a.project_id);
    projects = projects.filter((p) => assignedIds.includes(p.id) || assignedIds.includes(p.project_code) || p.contractor_id === user.id);
  } else if (userRole === 'DISTRICT_AUTHORITY') {
    // District Authority sees only their district
    const userDist = (user.district_id || user.district || '').toLowerCase();
    if (userDist) {
      projects = projects.filter((p) => {
        const pDist = (p.district_id || p.district || '').toLowerCase();
        return pDist.includes(userDist) || userDist.includes(pDist);
      });
    }
  } else if (userRole === 'IMPLEMENTING_AGENCY') {
    // Agency sees projects assigned to their agency or in their district
    projects = projects.filter(
      (p) => p.implementing_agency_id === user.id || p.district_id === user.district_id
    );
  } else if (userRole === 'MP') {
    // MP sees projects in their district/constituency
    const userDist = (user.district_id || user.district || '').toLowerCase();
    if (userDist) {
      projects = projects.filter((p) => {
        const pDist = (p.district_id || p.district || '').toLowerCase();
        return pDist.includes(userDist) || userDist.includes(pDist);
      });
    }
  }

  const enriched = projects.map(enrichProject);
  res.json({ projects: enriched });
});

// Contractor dedicated endpoint: GET /contractor/projects
apiRouter.get('/contractor/projects', authenticate, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const userRole = normalizeRole(user.role);
  const data = db.get();

  let targetContractorId = user.id;
  if (userRole === 'DISTRICT_AUTHORITY' || userRole === 'MP') {
    const contractorQuery = req.query.contractor_id as string;
    targetContractorId = contractorQuery || 'usr-cont-01';
  }

  const assignedIds = (data.contractor_project_assignments || [])
    .filter((a) => a.contractor_user_id === targetContractorId && a.assignment_status === 'ACTIVE')
    .map((a) => a.project_id);

  const assigned = data.projects.filter(
    (p) => assignedIds.includes(p.id) || assignedIds.includes(p.project_code) || p.contractor_id === targetContractorId
  );
  res.json({ projects: assigned.map(enrichProject) });
});

// GET /projects/:id - Protected with Project-Level Authorization
apiRouter.get('/projects/:id', authenticate, requireProjectAccess, (req: AuthRequest, res: Response) => {
  const project = req.project!;
  const enriched = enrichProject(project);
  res.json({ project: enriched });
});

// POST /projects - Authority only: Create new project with BOQ
apiRouter.post('/projects', authenticate, requireRole('DISTRICT_AUTHORITY'), (req: AuthRequest, res: Response) => {
  const {
    project_code,
    name,
    description,
    constituency,
    district_id,
    location,
    latitude,
    longitude,
    approved_cost,
    start_date,
    end_date,
    contractor_id,
    implementing_agency_id,
    boq_items,
  } = req.body;

  // Validation
  if (!name || !location || !approved_cost || !start_date || !end_date) {
    return res.status(400).json({ error: 'Project name, location, approved cost, start date and end date are required.' });
  }

  const numCost = Number(approved_cost);
  if (isNaN(numCost) || numCost <= 0) {
    return res.status(422).json({ error: 'Approved cost must be a positive number.' });
  }

  const numLat = Number(latitude);
  const numLng = Number(longitude);
  if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
    return res.status(422).json({ error: 'Valid GPS latitude (-90 to 90) and longitude (-180 to 180) are required.' });
  }

  const data = db.get();
  const projectId = `proj-${Date.now()}`;
  const code = project_code || `MPLADS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  const newProject: Project = {
    id: projectId,
    project_code: code,
    name: name.trim(),
    description: (description || '').trim(),
    district_id: district_id || req.user?.district_id || 'pune',
    district: req.user?.district || 'Pune District',
    constituency_id: constituency || req.user?.constituency_id || 'Pune (PC-34)',
    constituency: constituency || req.user?.constituency || 'Pune (PC-34)',
    location: location.trim(),
    latitude: numLat,
    longitude: numLng,
    approved_cost: numCost,
    start_date,
    end_date,
    contractor_id: contractor_id || null,
    implementing_agency_id: implementing_agency_id || 'usr-agency-01',
    status: contractor_id ? 'IN_PROGRESS' : 'APPROVED',
    approved_by: req.user?.name,
    approved_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    verified_expenditure: 0,
    verified_progress: 0,
  };

  data.projects.unshift(newProject);

  // If contractor assigned at creation, create contract and assignment record
  if (contractor_id) {
    const newContract: Contract = {
      id: `cntr-${Date.now()}`,
      project_id: projectId,
      contractor_id,
      contract_value: numCost,
      assigned_date: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
    };
    data.contracts.push(newContract);

    if (!data.contractor_project_assignments) {
      data.contractor_project_assignments = [];
    }
    data.contractor_project_assignments.push({
      id: `asgn-${Date.now()}`,
      contractor_user_id: contractor_id,
      project_id: projectId,
      assignment_status: 'ACTIVE',
    });
  }

  // Insert BOQ Items if provided
  if (Array.isArray(boq_items) && boq_items.length > 0) {
    boq_items.forEach((item, idx) => {
      const quantity = Number(item.approved_quantity) || 1;
      const rate = Number(item.approved_rate) || 0;
      data.boq_items.push({
        id: `boq-${Date.now()}-${idx}`,
        project_id: projectId,
        item_name: item.item_name || `BOQ Item ${idx + 1}`,
        approved_quantity: quantity,
        unit: item.unit || 'units',
        approved_rate: rate,
        approved_amount: quantity * rate || Number(item.approved_amount) || 0,
      });
    });
  }

  db.save(data);

  logAudit({
    user: req.user!,
    action: 'PROJECT_CREATED',
    resource_type: 'PROJECT',
    resource_id: projectId,
    details: `District Authority created project ${code}: ${name} with approved budget ₹${numCost.toLocaleString('en-IN')}`,
    result: 'ALLOWED',
  });

  res.status(201).json({ project: enrichProject(newProject) });
});

// POST /projects/:id/assign-contractor - District Authority only
apiRouter.post('/projects/:id/assign-contractor', authenticate, requireRole('DISTRICT_AUTHORITY'), requireProjectAccess, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { contractor_id, contract_value } = req.body;

  if (!contractor_id) {
    return res.status(400).json({ error: 'Contractor ID is required.' });
  }

  const data = db.get();
  const project = data.projects.find((p) => p.id === id || p.project_code === id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const contractor = data.users.find((u) => u.id === contractor_id && normalizeRole(u.role) === 'CONTRACTOR');
  if (!contractor) {
    return res.status(404).json({ error: 'Contractor not found.' });
  }

  project.contractor_id = contractor.id;
  if (project.status === 'APPROVED' || project.status === 'RECOMMENDED') {
    project.status = 'IN_PROGRESS';
  }

  // Record contract
  const newContract: Contract = {
    id: `cntr-${Date.now()}`,
    project_id: project.id,
    contractor_id: contractor.id,
    contract_value: Number(contract_value) || project.approved_cost,
    assigned_date: new Date().toISOString().split('T')[0],
    status: 'ACTIVE',
  };
  data.contracts.push(newContract);

  // Record assignment in contractor_project_assignments
  if (!data.contractor_project_assignments) {
    data.contractor_project_assignments = [];
  }
  const existingAsgn = data.contractor_project_assignments.find(
    (a) => a.contractor_user_id === contractor.id && a.project_id === project.id
  );
  if (existingAsgn) {
    existingAsgn.assignment_status = 'ACTIVE';
  } else {
    data.contractor_project_assignments.push({
      id: `asgn-${Date.now()}`,
      contractor_user_id: contractor.id,
      project_id: project.id,
      assignment_status: 'ACTIVE',
    });
  }

  db.save(data);

  logAudit({
    user: req.user!,
    action: 'CONTRACTOR_ASSIGNED',
    resource_type: 'PROJECT',
    resource_id: project.id,
    details: `District Authority assigned project ${project.project_code} to contractor ${contractor.name} (${contractor.organization_name || contractor.organization || ''})`,
    result: 'ALLOWED',
  });

  res.json({ project: enrichProject(project), message: 'Contractor assigned successfully.' });
});

// POST /projects/recommend - MP Recommends New Project under District
apiRouter.post('/projects/recommend', authenticate, requireRole('MP', 'DISTRICT_AUTHORITY'), (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const {
    name,
    description,
    location,
    latitude,
    longitude,
    estimated_cost,
    start_date,
    end_date,
    district_id,
    constituency,
    boq_item_name,
  } = req.body;

  if (!name || !location || !estimated_cost) {
    return res.status(400).json({ error: 'Project name, location and estimated cost are required.' });
  }

  const numCost = Number(estimated_cost);
  if (isNaN(numCost) || numCost <= 0) {
    return res.status(422).json({ error: 'Estimated cost must be a positive number.' });
  }

  const data = db.get();
  const projectId = `proj-${Date.now()}`;
  const targetDistrict = district_id || user.district_id || 'pune';
  const prefix = targetDistrict === 'nashik' ? 'NK' : 'PN';
  const code = `MPLADS-${prefix}-${Math.floor(100 + Math.random() * 900)}`;

  const numLat = Number(latitude) || 18.5204;
  const numLng = Number(longitude) || 73.8567;

  const newProject: Project = {
    id: projectId,
    project_code: code,
    name: name.trim(),
    description: (description || '').trim(),
    district_id: targetDistrict,
    district: targetDistrict === 'nashik' ? 'Nashik District' : 'Pune District',
    constituency_id: constituency || user.constituency_id || (targetDistrict === 'nashik' ? 'Nashik (PC-20)' : 'Pune (PC-34)'),
    constituency: constituency || user.constituency || (targetDistrict === 'nashik' ? 'Nashik (PC-20)' : 'Pune Parliamentary Constituency (PC-34)'),
    location: location.trim(),
    latitude: numLat,
    longitude: numLng,
    approved_cost: numCost,
    start_date: start_date || new Date().toISOString().split('T')[0],
    end_date: end_date || '2025-03-31',
    contractor_id: null,
    status: 'RECOMMENDED',
    recommended_by: user.name,
    recommended_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    verified_expenditure: 0,
    verified_progress: 0,
  };

  data.projects.unshift(newProject);

  if (boq_item_name) {
    data.boq_items.push({
      id: `boq-${Date.now()}-0`,
      project_id: projectId,
      item_name: boq_item_name,
      approved_quantity: 1,
      unit: 'lumpsum',
      approved_rate: numCost,
      approved_amount: numCost,
    });
  }

  db.save(data);

  logAudit({
    user,
    action: 'PROJECT_RECOMMENDED',
    resource_type: 'PROJECT',
    resource_id: projectId,
    details: `Hon'ble MP ${user.name} recommended new project ${code}: "${name}" under ${newProject.district} (Estimated: ₹${numCost.toLocaleString('en-IN')})`,
    result: 'ALLOWED',
  });

  res.status(201).json({
    project: enrichProject(newProject),
    message: 'Project recommendation submitted successfully to District Authority for sanction.',
  });
});

// POST /projects/:id/direct-sanction & /projects/:id/sanction - District Authority Directly Sanctions Recommended Project
const handleDirectSanction = (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const {
    sanction_order_number,
    sanctioned_amount,
    implementing_agency_id,
    contractor_id,
    remarks,
  } = req.body;

  const data = db.get();
  const project = data.projects.find((p) => p.id === id || p.project_code === id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  // Enforce District Authority matching district
  const userDistrict = (user.district_id || user.district || '').toLowerCase();
  const projDistrict = (project.district_id || project.district || '').toLowerCase();
  if (userDistrict && projDistrict && !projDistrict.includes(userDistrict) && !userDistrict.includes(projDistrict)) {
    logAudit({
      user,
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      resource_type: 'DISTRICT',
      resource_id: project.project_code || project.id,
      details: `District Authority (${user.district_id}) attempted direct sanction on project in unauthorized district (${project.district_id})`,
      result: 'DENIED',
    });
    return res.status(403).json({ error: 'You are not authorized to sanction projects in another district.' });
  }

  const oldStatus = project.status;
  const orderNum = sanction_order_number || `SANCTION-${project.project_code}-${Date.now().toString().slice(-4)}`;
  const finalCost = Number(sanctioned_amount) > 0 ? Number(sanctioned_amount) : project.approved_cost;

  project.status = contractor_id ? 'IN_PROGRESS' : 'APPROVED';
  project.approved_by = user.name;
  project.approved_date = new Date().toISOString().split('T')[0];
  project.sanction_order_number = orderNum;
  project.sanctioned_amount = finalCost;
  project.approved_cost = finalCost;
  project.sanction_date = new Date().toISOString().split('T')[0];
  if (implementing_agency_id) {
    project.implementing_agency_id = implementing_agency_id;
  }
  if (remarks) {
    project.progress_notes = remarks;
  }

  if (contractor_id) {
    project.contractor_id = contractor_id;
    // Update or create assignment
    if (!data.contractor_project_assignments) {
      data.contractor_project_assignments = [];
    }
    const existing = data.contractor_project_assignments.find(
      (a) => a.contractor_user_id === contractor_id && a.project_id === project.id
    );
    if (existing) {
      existing.assignment_status = 'ACTIVE';
    } else {
      data.contractor_project_assignments.push({
        id: `asgn-${Date.now()}`,
        contractor_user_id: contractor_id,
        project_id: project.id,
        assignment_status: 'ACTIVE',
      });
    }

    // Add contract
    data.contracts.push({
      id: `cntr-${Date.now()}`,
      project_id: project.id,
      contractor_id,
      contract_value: finalCost,
      assigned_date: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
    });
  }

  db.save(data);

  logAudit({
    user,
    action: 'PROJECT_DIRECT_SANCTION',
    resource_type: 'PROJECT',
    resource_id: project.id,
    details: `District Authority ${user.name} directly sanctioned project ${project.project_code} (Order: ${orderNum}, Amount: ₹${finalCost.toLocaleString('en-IN')}). Prior status: ${oldStatus}`,
    result: 'ALLOWED',
  });

  res.json({
    project: enrichProject(project),
    message: `Project ${project.project_code} successfully sanctioned by District Authority with Order ${orderNum}.`,
  });
};

apiRouter.post('/projects/:id/direct-sanction', authenticate, requireRole('DISTRICT_AUTHORITY'), handleDirectSanction);
apiRouter.post('/projects/:id/sanction', authenticate, requireRole('DISTRICT_AUTHORITY'), handleDirectSanction);

// PATCH /projects/:id/status - District Authority updates status
apiRouter.patch('/projects/:id/status', authenticate, requireRole('DISTRICT_AUTHORITY'), requireProjectAccess, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  if (!status || !['RECOMMENDED', 'UNDER_REVIEW', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'HALTED'].includes(status)) {
    return res.status(400).json({ error: 'Valid status is required.' });
  }

  const data = db.get();
  const project = data.projects.find((p) => p.id === id || p.project_code === id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const oldStatus = project.status;
  project.status = status;
  if (remarks) {
    project.progress_notes = remarks;
  }

  if (status === 'APPROVED' && !project.approved_by) {
    project.approved_by = req.user!.name;
    project.approved_date = new Date().toISOString().split('T')[0];
  }

  db.save(data);

  logAudit({
    user: req.user!,
    action: status === 'APPROVED' ? 'PROJECT_APPROVED' : 'PROJECT_STATUS_UPDATED',
    resource_type: 'PROJECT',
    resource_id: project.id,
    details: `District Authority ${req.user!.name} updated project ${project.project_code} status from ${oldStatus} to ${status}. Notes: ${remarks || 'None'}`,
    result: 'ALLOWED',
  });

  res.json({ project: enrichProject(project), message: `Project status successfully updated to ${status}.` });
});

// PATCH /projects/:id/contractor-update - Contractor updates work status or progress notes
apiRouter.patch('/projects/:id/contractor-update', authenticate, requireRole('CONTRACTOR'), requireProjectAccess, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { progress_notes } = req.body;

  const data = db.get();
  const project = data.projects.find((p) => p.id === id || p.project_code === id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  if (progress_notes) {
    project.progress_notes = progress_notes;
  }

  db.save(data);

  logAudit({
    user,
    action: 'PROGRESS_NOTES_UPDATED',
    resource_type: 'PROJECT',
    resource_id: project.id,
    details: `Contractor ${user.name} logged progress update notes for ${project.project_code}: ${progress_notes || ''}`,
    result: 'ALLOWED',
  });

  res.json({ project: enrichProject(project), message: 'Work progress note saved successfully.' });
});

// -------------------------------------------------------------
// CLAIMS SUBMISSION & MANAGEMENT
// -------------------------------------------------------------

// Helper to bundle claim with its verification result, project, contractor, boq
function bundleClaim(claim: ProgressClaim | ExpenseClaim) {
  const data = db.get();
  const vr = data.verification_results.find((v) => v.claim_id === claim.id);
  const project = data.projects.find((p) => p.id === claim.project_id);
  const contractor = data.users.find((u) => u.id === claim.contractor_id);
  const boqItem =
    claim.type === 'EXPENSE' && (claim as ExpenseClaim).boq_item_id
      ? data.boq_items.find((b) => b.id === (claim as ExpenseClaim).boq_item_id)
      : undefined;

  return {
    ...claim,
    verification_result: vr,
    project: project
      ? {
          id: project.id,
          project_code: project.project_code,
          name: project.name,
          location: project.location,
          latitude: project.latitude,
          longitude: project.longitude,
          approved_cost: project.approved_cost,
          verified_expenditure: project.verified_expenditure,
          verified_progress: project.verified_progress,
          district: project.district,
          district_id: project.district_id,
          start_date: project.start_date,
          end_date: project.end_date,
        }
      : undefined,
    contractor: contractor
      ? {
          id: contractor.id,
          name: contractor.name,
          organization: contractor.organization_name || contractor.organization,
          email: contractor.email,
        }
      : undefined,
    boq_item: boqItem,
  };
}

// GET /claims - Authority gets all claims, with filtering (District Authority restricted to their district)
apiRouter.get('/claims', authenticate, requireRole('DISTRICT_AUTHORITY', 'MP'), (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const userRole = normalizeRole(user.role);
  const { status, risk_level, project_id, type } = req.query;
  const data = db.get();

  let allClaims: Array<ProgressClaim | ExpenseClaim> = [
    ...data.progress_claims,
    ...data.expense_claims,
  ];

  if (project_id) {
    allClaims = allClaims.filter((c) => c.project_id === project_id);
  }
  if (status) {
    allClaims = allClaims.filter((c) => c.status === status);
  }
  if (type) {
    allClaims = allClaims.filter((c) => c.type === type);
  }

  let bundled = allClaims.map(bundleClaim);

  // District Authority sees only claims for projects in their district
  if (userRole === 'DISTRICT_AUTHORITY') {
    const userDist = (user.district_id || user.district || '').toLowerCase();
    bundled = bundled.filter((c) => {
      const p = data.projects.find((pr) => pr.id === c.project_id);
      if (!p) return true;
      const pDist = (p.district_id || p.district || '').toLowerCase();
      return pDist.includes(userDist) || userDist.includes(pDist);
    });
  }

  if (risk_level) {
    bundled = bundled.filter((c) => c.verification_result?.risk_level === risk_level);
  }

  // Sort by date descending
  bundled.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({ claims: bundled });
});

// GET /contractor/claims - Contractor gets only their claims (or authority preview)
apiRouter.get('/contractor/claims', authenticate, requireRole('CONTRACTOR', 'DISTRICT_AUTHORITY'), (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const userRole = normalizeRole(user.role);
  const data = db.get();

  let targetContractorId = user.id;
  if (userRole === 'DISTRICT_AUTHORITY') {
    const contractorQuery = req.query.contractor_id as string;
    targetContractorId = contractorQuery || 'usr-cont-01';
  }

  const myProgress = data.progress_claims.filter((c) => c.contractor_id === targetContractorId);
  const myExpense = data.expense_claims.filter((c) => c.contractor_id === targetContractorId);

  const bundled = [...myProgress, ...myExpense].map(bundleClaim);
  bundled.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({ claims: bundled });
});

// GET /claims/:id - Get single claim with verification details
apiRouter.get('/claims/:id', authenticate, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const userRole = normalizeRole(user.role);
  const { id } = req.params;
  const data = db.get();

  const claim =
    data.progress_claims.find((c) => c.id === id) ||
    data.expense_claims.find((c) => c.id === id);

  if (!claim) {
    return res.status(404).json({ error: 'Claim not found.' });
  }

  const project = data.projects.find((p) => p.id === claim.project_id);

  // AUTHORIZATION CHECK: Contractor can only view their own claims!
  if (userRole === 'CONTRACTOR' && claim.contractor_id !== user.id) {
    logAudit({
      user,
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      resource_type: 'CLAIM',
      resource_id: claim.id,
      details: `Contractor ${user.name} attempted unauthorized view of claim ${claim.id} belonging to another contractor`,
      result: 'DENIED',
    });
    return res.status(403).json({ error: 'You are not authorized to access this claim.' });
  }

  // AUTHORIZATION CHECK: District Authority can only view claims in their district!
  if (userRole === 'DISTRICT_AUTHORITY' && project) {
    const userDist = (user.district_id || user.district || '').toLowerCase();
    const projDist = (project.district_id || project.district || '').toLowerCase();
    if (userDist && projDist && !projDist.includes(userDist) && !userDist.includes(projDist)) {
      logAudit({
        user,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        resource_type: 'CLAIM',
        resource_id: claim.id,
        details: `District Authority (${user.district_id}) attempted unauthorized view of claim in ${project.district_id}`,
        result: 'DENIED',
      });
      return res.status(403).json({ error: 'You are not authorized to view claims for another district.' });
    }
  }

  const bundled = bundleClaim(claim);
  res.json({ claim: bundled });
});

// POST /projects/:id/progress-claim - Contractor submits progress claim
apiRouter.post('/projects/:id/progress-claim', authenticate, requireRole('CONTRACTOR'), requireProjectAccess, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const project = req.project!;
  const {
    progress_percent,
    description,
    latitude,
    longitude,
    accuracy,
    mock_detected,
    evidence_url,
    captured_at,
  } = req.body;

  const data = db.get();
  const effectiveContractorId = user.id;

  // VALIDATION
  const numProgress = Number(progress_percent);
  if (isNaN(numProgress) || numProgress < 0 || numProgress > 100) {
    return res.status(422).json({ error: 'Progress must be a number between 0 and 100 percent.' });
  }

  if (!description || description.trim().length === 0) {
    return res.status(422).json({ error: 'Work description is required.' });
  }

  const numLat = Number(latitude);
  const numLng = Number(longitude);
  if (isNaN(numLat) || isNaN(numLng)) {
    return res.status(422).json({ error: 'Valid GPS coordinates are required for live evidence progress claim.' });
  }

  if (!evidence_url && !req.body.evidence_path) {
    return res.status(422).json({ error: 'Live captured evidence photograph is mandatory for progress claims.' });
  }

  const claimId = `clm-prg-${Date.now()}`;
  const claimCode = `CLM-PRG-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  const nowStr = new Date().toISOString();
  const serverReceivedAt = nowStr;

  // Cryptographic SHA-256 hash calculation for evidence integrity validation
  const rawEvidenceString = String(evidence_url || req.body.evidence_path || '');
  const evidenceHash = crypto.createHash('sha256').update(rawEvidenceString).digest('hex');

  // Haversine distance from registered project coordinates
  const distanceMeters =
    project.latitude !== undefined && project.longitude !== undefined
      ? calculateHaversineDistance(numLat, numLng, project.latitude, project.longitude)
      : undefined;

  const isMock = Boolean(mock_detected);
  const isSuspiciousAccuracy = accuracy !== undefined && (Number(accuracy) <= 0 || Number(accuracy) > 1000);
  const isMismatch = distanceMeters !== undefined && distanceMeters > ALLOWED_GPS_RADIUS_METERS;
  const gpsStatus: 'MATCHED' | 'MISMATCH' | 'REQUIRES_VERIFICATION' =
    isMock || isSuspiciousAccuracy
      ? 'REQUIRES_VERIFICATION'
      : isMismatch
      ? 'MISMATCH'
      : 'MATCHED';

  const newClaim: ProgressClaim = {
    id: claimId,
    claim_code: claimCode,
    type: 'PROGRESS',
    project_id: project.id,
    contractor_id: effectiveContractorId,
    progress_percent: numProgress,
    description: description.trim(),
    latitude: numLat,
    longitude: numLng,
    accuracy: accuracy !== undefined ? Number(accuracy) : 8,
    mock_detected: isMock,
    captured_at: captured_at || nowStr,
    server_received_at: serverReceivedAt,
    evidence_hash: evidenceHash,
    distance_meters: distanceMeters,
    gps_status: gpsStatus,
    evidence_url: evidence_url || 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f8?w=800&auto=format&fit=crop&q=80',
    evidence_path: req.body.evidence_path || `jandarpan_live_${claimCode}.jpg`,
    status: 'PENDING_VERIFICATION',
    created_at: nowStr,
  };

  // Run Automated Verification Engine
  const projectExpenses = data.expense_claims.filter((c) => c.project_id === project.id);
  const engineResult = runVerificationEngine({
    claimType: 'PROGRESS',
    project,
    contractorId: effectiveContractorId,
    progressPercent: numProgress,
    latitude: numLat,
    longitude: numLng,
    accuracy: accuracy !== undefined ? Number(accuracy) : 8,
    mockDetected: isMock,
    claimTimestamp: captured_at || nowStr,
    evidenceUrl: newClaim.evidence_url,
    allProjectExpenseClaims: projectExpenses,
    currentClaimId: claimId,
  });

  const vrId = `vr-${Date.now()}`;
  const verificationResult: VerificationResult = {
    ...engineResult,
    id: vrId,
    claim_id: claimId,
    created_at: nowStr,
  };

  data.progress_claims.unshift(newClaim);
  data.verification_results.unshift(verificationResult);
  db.save(data);

  logAudit({
    user,
    action: 'CLAIM_SUBMITTED',
    resource_type: 'PROGRESS_CLAIM',
    resource_id: claimId,
    details: `Contractor submitted live evidence claim ${claimCode} (${numProgress}%) on project ${project.project_code} [Integrity Hash SHA-256: ${evidenceHash.substring(0, 16)}... | Server Receipt: ${serverReceivedAt}]`,
    result: 'ALLOWED',
  });

  logAudit({
    user: { id: 'SYSTEM', name: 'Risk Verification Engine', role: 'SYSTEM' as any } as any,
    action: 'AUTOMATED_VERIFICATION_RAN',
    resource_type: 'PROGRESS_CLAIM',
    resource_id: claimId,
    details: `Automated checks complete. Score: ${verificationResult.total_risk_score}/100 (${verificationResult.risk_level}). Reasons: ${verificationResult.reasons.join('; ')}`,
    result: 'ALLOWED',
  });

  res.status(201).json({
    claim: bundleClaim(newClaim),
    message:
      verificationResult.risk_level === 'HIGH'
        ? 'Claim submitted and flagged for Authority Verification due to risk indicators.'
        : 'Progress claim submitted successfully and awaiting Authority review.',
  });
});

// POST /projects/:id/expense-claim - Contractor submits expenditure claim
apiRouter.post('/projects/:id/expense-claim', authenticate, requireRole('CONTRACTOR'), requireProjectAccess, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const project = req.project!;
  const { claimed_amount, invoice_number, invoice_date, boq_item_id, document_url } = req.body;

  const data = db.get();
  const effectiveContractorId = user.id;

  // VALIDATION
  const numAmount = Number(claimed_amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(422).json({ error: 'Claimed expenditure must be a positive amount greater than 0.' });
  }

  if (!invoice_number || invoice_number.trim().length === 0) {
    return res.status(422).json({ error: 'Invoice / bill number is required.' });
  }

  if (!invoice_date) {
    return res.status(422).json({ error: 'Invoice date is required.' });
  }

  if (boq_item_id) {
    const boqExists = data.boq_items.some((b) => b.id === boq_item_id && b.project_id === project.id);
    if (!boqExists) {
      return res.status(422).json({ error: 'Selected BOQ item does not belong to this project.' });
    }
  }

  const claimId = `clm-exp-${Date.now()}`;
  const claimCode = `CLM-EXP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  const nowStr = new Date().toISOString();

  const newClaim: ExpenseClaim = {
    id: claimId,
    claim_code: claimCode,
    type: 'EXPENSE',
    project_id: project.id,
    contractor_id: effectiveContractorId,
    boq_item_id: boq_item_id || undefined,
    claimed_amount: numAmount,
    invoice_number: invoice_number.trim(),
    invoice_date,
    document_url: document_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
    document_path: req.body.document_path || 'invoice_doc.pdf',
    status: 'PENDING_VERIFICATION',
    created_at: nowStr,
  };

  // Run Automated Verification Engine
  const projectExpenses = data.expense_claims.filter((c) => c.project_id === project.id);
  const latestProgress = data.progress_claims
    .filter((c) => c.project_id === project.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const currentProgressPercent = latestProgress ? latestProgress.progress_percent : (project.verified_progress || 0);

  const engineResult = runVerificationEngine({
    claimType: 'EXPENSE',
    project,
    contractorId: effectiveContractorId,
    claimedAmount: numAmount,
    progressPercent: currentProgressPercent,
    invoiceNumber: invoice_number.trim(),
    invoiceDate: invoice_date,
    documentUrl: newClaim.document_url,
    claimTimestamp: nowStr,
    allProjectExpenseClaims: projectExpenses,
    currentClaimId: claimId,
  });

  const vrId = `vr-${Date.now()}`;
  const verificationResult: VerificationResult = {
    ...engineResult,
    id: vrId,
    claim_id: claimId,
    created_at: nowStr,
  };

  data.expense_claims.unshift(newClaim);
  data.verification_results.unshift(verificationResult);
  db.save(data);

  logAudit({
    user,
    action: 'CLAIM_SUBMITTED',
    resource_type: 'EXPENSE_CLAIM',
    resource_id: claimId,
    details: `Contractor submitted expense claim ${claimCode} for ₹${numAmount.toLocaleString('en-IN')} (Invoice: ${invoice_number})`,
    result: 'ALLOWED',
  });

  logAudit({
    user: { id: 'SYSTEM', name: 'Risk Verification Engine', role: 'SYSTEM' as any } as any,
    action: 'AUTOMATED_VERIFICATION_RAN',
    resource_type: 'EXPENSE_CLAIM',
    resource_id: claimId,
    details: `Risk Score: ${verificationResult.total_risk_score}/100 (${verificationResult.risk_level}). Reasons: ${verificationResult.reasons.join('; ')}`,
    result: 'ALLOWED',
  });

  res.status(201).json({
    claim: bundleClaim(newClaim),
    message:
      verificationResult.risk_level === 'HIGH'
        ? 'Claim submitted and flagged for Authority Verification due to high expenditure indicators.'
        : 'Expenditure claim submitted successfully and awaiting Authority review.',
  });
});

// -------------------------------------------------------------
// AUTHORITY ACTIONS: VERIFY / REJECT / CLARIFICATION
// -------------------------------------------------------------

// POST /claims/:id/verify - District Authority only
apiRouter.post('/claims/:id/verify', authenticate, requireRole('DISTRICT_AUTHORITY'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { remarks } = req.body;
  const user = req.user!;
  const data = db.get();

  const prg = data.progress_claims.find((c) => c.id === id);
  const exp = data.expense_claims.find((c) => c.id === id);
  const claim = prg || exp;

  if (!claim) {
    return res.status(404).json({ error: 'Claim not found.' });
  }

  const project = data.projects.find((p) => p.id === claim.project_id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  // District authorization check
  const userDist = (user.district_id || user.district || '').toLowerCase();
  const projDist = (project.district_id || project.district || '').toLowerCase();
  if (userDist && projDist && !projDist.includes(userDist) && !userDist.includes(projDist)) {
    logAudit({
      user,
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      resource_type: 'CLAIM',
      resource_id: claim.id,
      details: `District Authority (${user.district_id}) attempted to verify claim for project in unauthorized district (${project.district_id})`,
      result: 'DENIED',
    });
    return res.status(403).json({ error: 'You are not authorized to verify claims outside your district.' });
  }

  claim.status = 'VERIFIED';
  claim.remarks = remarks || 'Verified by Competent District Authority under MPLADS guidelines.';

  // Update verified project records
  if (claim.type === 'PROGRESS') {
    project.verified_progress = Math.max(project.verified_progress || 0, (claim as ProgressClaim).progress_percent);
  } else if (claim.type === 'EXPENSE') {
    project.verified_expenditure = (project.verified_expenditure || 0) + (claim as ExpenseClaim).claimed_amount;
  }

  db.save(data);

  logAudit({
    user,
    action: 'CLAIM_VERIFIED',
    resource_type: claim.type === 'PROGRESS' ? 'PROGRESS_CLAIM' : 'EXPENSE_CLAIM',
    resource_id: claim.id,
    details: `District Authority verified claim ${claim.claim_code}. Remarks: ${claim.remarks}`,
    result: 'ALLOWED',
  });

  res.json({ claim: bundleClaim(claim), message: 'Claim verified and official project records updated.' });
});

// POST /claims/:id/reject - District Authority only
apiRouter.post('/claims/:id/reject', authenticate, requireRole('DISTRICT_AUTHORITY'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { remarks } = req.body;
  const user = req.user!;

  if (!remarks || remarks.trim().length === 0) {
    return res.status(400).json({ error: 'Rejection remarks/reason are required.' });
  }

  const data = db.get();
  const prg = data.progress_claims.find((c) => c.id === id);
  const exp = data.expense_claims.find((c) => c.id === id);
  const claim = prg || exp;

  if (!claim) {
    return res.status(404).json({ error: 'Claim not found.' });
  }

  const project = data.projects.find((p) => p.id === claim.project_id);
  if (project) {
    const userDist = (user.district_id || user.district || '').toLowerCase();
    const projDist = (project.district_id || project.district || '').toLowerCase();
    if (userDist && projDist && !projDist.includes(userDist) && !userDist.includes(projDist)) {
      logAudit({
        user,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        resource_type: 'CLAIM',
        resource_id: claim.id,
        details: `District Authority (${user.district_id}) attempted to reject claim in unauthorized district`,
        result: 'DENIED',
      });
      return res.status(403).json({ error: 'You are not authorized to reject claims outside your district.' });
    }
  }

  claim.status = 'REJECTED';
  claim.remarks = remarks.trim();
  db.save(data);

  logAudit({
    user,
    action: 'CLAIM_REJECTED',
    resource_type: claim.type === 'PROGRESS' ? 'PROGRESS_CLAIM' : 'EXPENSE_CLAIM',
    resource_id: claim.id,
    details: `District Authority rejected claim ${claim.claim_code}. Reason: ${remarks}`,
    result: 'ALLOWED',
  });

  res.json({ claim: bundleClaim(claim), message: 'Claim has been marked as REJECTED.' });
});

// POST /claims/:id/clarification - District Authority only
apiRouter.post('/claims/:id/clarification', authenticate, requireRole('DISTRICT_AUTHORITY'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { query } = req.body;
  const user = req.user!;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Clarification query description is required.' });
  }

  const data = db.get();
  const prg = data.progress_claims.find((c) => c.id === id);
  const exp = data.expense_claims.find((c) => c.id === id);
  const claim = prg || exp;

  if (!claim) {
    return res.status(404).json({ error: 'Claim not found.' });
  }

  const project = data.projects.find((p) => p.id === claim.project_id);
  if (project) {
    const userDist = (user.district_id || user.district || '').toLowerCase();
    const projDist = (project.district_id || project.district || '').toLowerCase();
    if (userDist && projDist && !projDist.includes(userDist) && !userDist.includes(projDist)) {
      logAudit({
        user,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        resource_type: 'CLAIM',
        resource_id: claim.id,
        details: `District Authority (${user.district_id}) attempted to request clarification outside district`,
        result: 'DENIED',
      });
      return res.status(403).json({ error: 'You are not authorized to request clarification outside your district.' });
    }
  }

  claim.status = 'CLARIFICATION';
  claim.clarification_request = query.trim();
  db.save(data);

  logAudit({
    user,
    action: 'CLARIFICATION_REQUESTED',
    resource_type: claim.type === 'PROGRESS' ? 'PROGRESS_CLAIM' : 'EXPENSE_CLAIM',
    resource_id: claim.id,
    details: `District Authority requested clarification on ${claim.claim_code}: ${query}`,
    result: 'ALLOWED',
  });

  res.json({ claim: bundleClaim(claim), message: 'Clarification request sent to contractor.' });
});

// POST /claims/:id/respond-clarification - Contractor only
apiRouter.post('/claims/:id/respond-clarification', authenticate, requireRole('CONTRACTOR'), (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { response_text } = req.body;

  if (!response_text || response_text.trim().length === 0) {
    return res.status(400).json({ error: 'Clarification response text is required.' });
  }

  const data = db.get();
  const prg = data.progress_claims.find((c) => c.id === id);
  const exp = data.expense_claims.find((c) => c.id === id);
  const claim = prg || exp;

  if (!claim) {
    return res.status(404).json({ error: 'Claim not found.' });
  }

  if (claim.contractor_id !== user.id) {
    logAudit({
      user,
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      resource_type: 'CLAIM',
      resource_id: claim.id,
      details: `Contractor ${user.name} attempted unauthorized clarification response to claim belonging to another contractor`,
      result: 'DENIED',
    });
    return res.status(403).json({ error: 'You are not authorized to respond to this claim.' });
  }

  claim.clarification_response = response_text.trim();
  claim.status = 'PENDING_VERIFICATION'; // Resubmitted back to pending verification
  db.save(data);

  logAudit({
    user,
    action: 'CLARIFICATION_RESPONDED',
    resource_type: claim.type === 'PROGRESS' ? 'PROGRESS_CLAIM' : 'EXPENSE_CLAIM',
    resource_id: claim.id,
    details: `Contractor submitted clarification for ${claim.claim_code}. Status returned to PENDING_VERIFICATION.`,
    result: 'ALLOWED',
  });

  res.json({ claim: bundleClaim(claim), message: 'Clarification submitted. Claim returned to Pending Verification.' });
});

// -------------------------------------------------------------
// AUDIT LOGS (District Authority & MP only)
// -------------------------------------------------------------
apiRouter.get('/audit-logs', authenticate, requireRole('DISTRICT_AUTHORITY', 'MP'), (req: AuthRequest, res: Response) => {
  const data = db.get();
  res.json({ audit_logs: data.audit_logs });
});

// POST /audit-logs/unauthorized-attempt - Record direct URL protection violations
apiRouter.post('/audit-logs/unauthorized-attempt', authenticate, (req: AuthRequest, res: Response) => {
  const { url, reason } = req.body;
  logAudit({
    user: req.user!,
    action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
    resource_type: 'ROUTE',
    resource_id: url || 'DIRECT_URL',
    details: reason || `Direct URL access attempt to ${url} blocked by RBAC frontend/backend guard`,
    result: 'DENIED',
  });
  res.json({ success: true, message: 'Unauthorized access attempt logged' });
});

// -------------------------------------------------------------
// RESET DEMO TO SEED
// -------------------------------------------------------------
apiRouter.post('/reset-demo', authenticate, (req: AuthRequest, res: Response) => {
  db.resetToSeed();
  logAudit({
    user: req.user!,
    action: 'DEMO_DATA_RESET',
    resource_type: 'DATABASE',
    resource_id: 'SEED',
    details: 'User reset prototype database to initial demo state',
    result: 'ALLOWED',
  });
  res.json({ success: true, message: 'Database reset to initial demo data.' });
});
