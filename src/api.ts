import { User, Project, Claim, AuditLog } from './types';

const TOKEN_KEY = 'jandarpan_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredToken();
    }
    const errorMsg = data.error || data.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  getToken: getStoredToken,
  setToken: setStoredToken,
  clearToken: clearStoredToken,
  request,

  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/auth/me');
  },

  async getDemoAccounts(): Promise<{ accounts: User[] }> {
    return request<{ accounts: User[] }>('/auth/demo-accounts');
  },

  // Projects
  async getProjects(): Promise<{ projects: Project[] }> {
    return request<{ projects: Project[] }>('/projects');
  },

  async getContractorProjects(): Promise<{ projects: Project[] }> {
    return request<{ projects: Project[] }>('/contractor/projects');
  },

  async getProject(id: string): Promise<{ project: Project }> {
    return request<{ project: Project }>(`/projects/${id}`);
  },

  async createProject(projectData: Partial<Project> & { boq_items?: any[] }): Promise<{ project: Project }> {
    return request<{ project: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  },

  async recommendProject(payload: {
    name: string;
    description?: string;
    location: string;
    estimated_cost: number;
    latitude?: number;
    longitude?: number;
    start_date?: string;
    end_date?: string;
    boq_item_name?: string;
  }): Promise<{ project: Project; message: string }> {
    return request<{ project: Project; message: string }>('/projects/recommend', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateProjectStatus(projectId: string, status: string, remarks?: string): Promise<{ project: Project; message: string }> {
    return request<{ project: Project; message: string }>(`/projects/${projectId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, remarks }),
    });
  },

  async updateContractorProgressNotes(projectId: string, progress_notes: string): Promise<{ project: Project; message: string }> {
    return request<{ project: Project; message: string }>(`/projects/${projectId}/contractor-update`, {
      method: 'PATCH',
      body: JSON.stringify({ progress_notes }),
    });
  },

  async assignContractor(projectId: string, contractorId: string, contractValue?: number): Promise<{ project: Project; message: string }> {
    return request<{ project: Project; message: string }>(`/projects/${projectId}/assign-contractor`, {
      method: 'POST',
      body: JSON.stringify({ contractor_id: contractorId, contract_value: contractValue }),
    });
  },

  async getContractors(): Promise<{ contractors: Array<{ id: string; name: string; email: string; organization?: string }> }> {
    return request<{ contractors: Array<{ id: string; name: string; email: string; organization?: string }> }>('/contractors');
  },

  // Claims
  async getClaims(filters: { status?: string; risk_level?: string; project_id?: string; type?: string } = {}): Promise<{ claims: Claim[] }> {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters.risk_level && filters.risk_level !== 'ALL') params.set('risk_level', filters.risk_level);
    if (filters.project_id && filters.project_id !== 'ALL') params.set('project_id', filters.project_id);
    if (filters.type && filters.type !== 'ALL') params.set('type', filters.type);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ claims: Claim[] }>(`/claims${qs}`);
  },

  async getContractorClaims(): Promise<{ claims: Claim[] }> {
    return request<{ claims: Claim[] }>('/contractor/claims');
  },

  async getClaim(id: string): Promise<{ claim: Claim }> {
    return request<{ claim: Claim }>(`/claims/${id}`);
  },

  async submitProgressClaim(
    projectId: string,
    payload: {
      progress_percent: number;
      description: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
      mock_detected?: boolean;
      evidence_url: string;
      evidence_path?: string;
      captured_at?: string;
    }
  ): Promise<{ claim: Claim; message: string }> {
    return request<{ claim: Claim; message: string }>(`/projects/${projectId}/progress-claim`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async submitExpenseClaim(
    projectId: string,
    payload: {
      claimed_amount: number;
      invoice_number: string;
      invoice_date: string;
      boq_item_id?: string;
      document_url?: string;
      document_path?: string;
    }
  ): Promise<{ claim: Claim; message: string }> {
    return request<{ claim: Claim; message: string }>(`/projects/${projectId}/expense-claim`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Authority verification actions
  async verifyClaim(claimId: string, remarks?: string): Promise<{ claim: Claim; message: string }> {
    return request<{ claim: Claim; message: string }>(`/claims/${claimId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  async rejectClaim(claimId: string, remarks: string): Promise<{ claim: Claim; message: string }> {
    return request<{ claim: Claim; message: string }>(`/claims/${claimId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  async requestClarification(claimId: string, query: string): Promise<{ claim: Claim; message: string }> {
    return request<{ claim: Claim; message: string }>(`/claims/${claimId}/clarification`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  },

  async respondClarification(claimId: string, response_text: string): Promise<{ claim: Claim; message: string }> {
    return request<{ claim: Claim; message: string }>(`/claims/${claimId}/respond-clarification`, {
      method: 'POST',
      body: JSON.stringify({ response_text }),
    });
  },

  // Audit Logs
  async getAuditLogs(): Promise<{ audit_logs: AuditLog[] }> {
    return request<{ audit_logs: AuditLog[] }>('/audit-logs');
  },

  async logUnauthorizedAttempt(url: string, reason: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>('/audit-logs/unauthorized-attempt', {
      method: 'POST',
      body: JSON.stringify({ url, reason }),
    });
  },

  // Reset demo
  async resetDemo(): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>('/reset-demo', {
      method: 'POST',
    });
  },
};
