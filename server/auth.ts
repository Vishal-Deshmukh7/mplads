import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, User, AuditLog, UserRole, Project } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'jandarpan-mplads-secure-jwt-key-2026';

export interface AuthRequest extends Request {
  user?: User;
  project?: Project;
}

export function normalizeRole(role?: string): UserRole {
  if (!role) return 'CONTRACTOR';
  const upper = role.toUpperCase().trim();
  if (upper === 'MP') return 'MP';
  if (upper === 'DISTRICT_AUTHORITY' || upper === 'AUTHORITY' || upper === 'NODAL_OFFICER') {
    return 'DISTRICT_AUTHORITY';
  }
  if (upper === 'IMPLEMENTING_AGENCY' || upper === 'AGENCY') {
    return 'IMPLEMENTING_AGENCY';
  }
  return 'CONTRACTOR';
}

export function generateToken(user: User): string {
  const normalizedRole = normalizeRole(user.role);
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: normalizedRole,
      district_id: user.district_id,
      constituency_id: user.constituency_id,
      organization_name: user.organization_name || user.organization,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email?: string;
      role?: string;
    };
    const allUsers = db.get().users;
    let user = allUsers.find((u) => u.id === decoded.id);

    // Fallback: match by email or alias if id was modified or reseeded
    if (!user && decoded.email) {
      const emailLower = decoded.email.toLowerCase().trim();
      user = allUsers.find((u) => u.email.toLowerCase() === emailLower);
      if (!user) {
        if (emailLower === 'authority.pune@jandarpan.demo' || emailLower === 'nodal.officer@mplads.gov.in' || emailLower === 'authority@mplads.gov.in') {
          user = allUsers.find((u) => u.role === 'DISTRICT_AUTHORITY' && u.district_id === 'pune');
        } else if (emailLower === 'mp.demo@jandarpan.demo' || emailLower === 'mp@mplads.gov.in') {
          user = allUsers.find((u) => u.role === 'MP');
        } else if (emailLower === 'contractor.demo@jandarpan.demo' || emailLower === 'apex.infra@contractor.in') {
          user = allUsers.find((u) => u.role === 'CONTRACTOR' && u.id === 'usr-cont-01');
        }
      }
    }

    // Fallback: match by role for demo tokens
    if (!user && decoded.role) {
      const norm = normalizeRole(decoded.role);
      user = allUsers.find((u) => normalizeRole(u.role) === norm);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    }

    if (user.active_status === false) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact administrator.' });
    }

    req.user = {
      ...user,
      role: normalizeRole(user.role),
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...allowedRoles: Array<UserRole | string>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required. Please login.' });
    }
    const userRole = normalizeRole(req.user.role);
    const normalizedAllowed = allowedRoles.map(normalizeRole);

    if (!normalizedAllowed.includes(userRole)) {
      logAudit({
        user: req.user,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        resource_type: 'ROLE_GUARD',
        resource_id: req.originalUrl,
        details: `Role ${userRole} attempted unauthorized access to route requiring [${normalizedAllowed.join(', ')}]`,
        result: 'DENIED',
      });

      return res.status(403).json({
        error: 'You do not have permission to access this resource.',
      });
    }
    next();
  };
}

export function requireProjectAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }

  const projectId = req.params.id || req.params.projectId || req.body?.project_id;
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required.' });
  }

  const data = db.get();
  const project = data.projects.find(
    (p) => p.id === projectId || p.project_code?.toLowerCase() === projectId.toLowerCase()
  );

  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const userRole = normalizeRole(req.user.role);

  // 1. CONTRACTOR project-level authorization
  if (userRole === 'CONTRACTOR') {
    const isAssigned = (data.contractor_project_assignments || []).some(
      (a) =>
        a.contractor_user_id === req.user?.id &&
        (a.project_id === project.id || a.project_id === project.project_code) &&
        a.assignment_status === 'ACTIVE'
    ) || project.contractor_id === req.user.id;

    if (!isAssigned) {
      logAudit({
        user: req.user,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        resource_type: 'PROJECT',
        resource_id: project.project_code || project.id,
        details: `Contractor ${req.user.name} attempted unauthorized access to unassigned project ${project.project_code}`,
        result: 'DENIED',
      });

      return res.status(403).json({
        error: 'You are not authorized to access this project.',
      });
    }
  }

  // 2. DISTRICT_AUTHORITY district-level authorization
  if (userRole === 'DISTRICT_AUTHORITY') {
    const userDistrict = (req.user.district_id || req.user.district || '').toLowerCase();
    const projDistrict = (project.district_id || project.district || '').toLowerCase();

    if (userDistrict && projDistrict && !projDistrict.includes(userDistrict) && !userDistrict.includes(projDistrict)) {
      logAudit({
        user: req.user,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        resource_type: 'DISTRICT',
        resource_id: project.project_code || project.id,
        details: `District Authority (${req.user.district_id}) attempted access to project ${project.project_code} in unauthorized district (${project.district_id || project.district})`,
        result: 'DENIED',
      });

      return res.status(403).json({
        error: 'You are not authorized to access this district.',
      });
    }
  }

  // 3. IMPLEMENTING_AGENCY project-level authorization
  if (userRole === 'IMPLEMENTING_AGENCY') {
    const isAgencyAssigned =
      project.implementing_agency_id === req.user.id ||
      !project.implementing_agency_id ||
      (req.user.district_id && project.district_id === req.user.district_id);

    if (!isAgencyAssigned) {
      logAudit({
        user: req.user,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        resource_type: 'PROJECT',
        resource_id: project.project_code || project.id,
        details: `Implementing Agency ${req.user.name} attempted access to unassigned project ${project.project_code}`,
        result: 'DENIED',
      });

      return res.status(403).json({
        error: 'You are not authorized to access projects belonging to another agency.',
      });
    }
  }

  req.project = project;
  next();
}

export function requireDistrictAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }

  const requestedDistrict = (req.params.districtId || req.params.district || req.query.district || '').toString().toLowerCase().trim();
  const userRole = normalizeRole(req.user.role);

  if (userRole === 'DISTRICT_AUTHORITY' && requestedDistrict) {
    const userDistrict = (req.user.district_id || req.user.district || '').toLowerCase().trim();
    if (userDistrict && !requestedDistrict.includes(userDistrict) && !userDistrict.includes(requestedDistrict)) {
      logAudit({
        user: req.user,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        resource_type: 'DISTRICT',
        resource_id: requestedDistrict,
        details: `District Authority (${req.user.district_id}) attempted unauthorized access to district ${requestedDistrict}`,
        result: 'DENIED',
      });

      return res.status(403).json({
        error: 'You are not authorized to access this district.',
      });
    }
  }

  next();
}

export function logAudit(options: {
  user?: User | { id: string; name?: string; role?: string };
  action: string;
  resource_type: string;
  resource_id: string;
  details?: string;
  result?: 'ALLOWED' | 'DENIED';
  entity_type?: string;
  entity_id?: string;
}) {
  const currentUser = options.user;
  const role = currentUser ? normalizeRole(currentUser.role) : 'ANONYMOUS';

  const newLog: AuditLog = {
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: currentUser?.id || 'ANONYMOUS',
    user_name: currentUser?.name || 'Anonymous / Unauthenticated',
    user_role: role,
    role: role,
    action: options.action,
    resource_type: options.resource_type,
    resource_id: options.resource_id,
    entity_type: options.entity_type || options.resource_type,
    entity_id: options.entity_id || options.resource_id,
    details: options.details || '',
    result: options.result || 'ALLOWED',
    timestamp: new Date().toISOString(),
  };

  const data = db.get();
  if (!data.audit_logs) {
    data.audit_logs = [];
  }
  data.audit_logs.unshift(newLog);
  db.save(data);
}
