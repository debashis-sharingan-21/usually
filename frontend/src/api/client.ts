import type {
  Transaction,
  CSVPreviewResponse,
  CSVImportResult,
  HabitObservation,
  SpendingSummaryResponse,
  SystemHealthResponse,
  PayeeQuestion
} from '../types';

const API_BASE = '/api';
const TOKEN_KEY = 'usually_auth_token';
const CONTEXT_KEY = 'usually_workspace_context';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearStoredToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getActiveWorkspaceContext(): 'personal' | 'demo' {
  if (typeof window === 'undefined') return 'demo';
  const val = localStorage.getItem(CONTEXT_KEY);
  return val === 'personal' ? 'personal' : 'demo';
}

export function setActiveWorkspaceContext(context: 'personal' | 'demo'): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CONTEXT_KEY, context);
  }
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const ctx = getActiveWorkspaceContext();
  if (ctx) {
    headers['X-Workspace-Context'] = ctx;
  }
  return headers;
}

export async function createGuestWorkspace(): Promise<{ token: string; user: any; workspace_type: string }> {
  const res = await fetch(`${API_BASE}/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to create instant private workspace');
  const data = await res.json();
  if (data.token) {
    setStoredToken(data.token);
    setActiveWorkspaceContext('personal');
  }
  return data;
}

export async function registerUser(email: string, password: string): Promise<{ token: string; user: any; workspace_type: string }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail || 'Registration failed');
  }
  const data = await res.json();
  if (data.token) {
    setStoredToken(data.token);
    setActiveWorkspaceContext('personal');
  }
  return data;
}

export async function loginUser(email: string, password: string): Promise<{ token: string; user: any; workspace_type: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(err.detail || 'Login failed');
  }
  const data = await res.json();
  if (data.token) {
    setStoredToken(data.token);
    setActiveWorkspaceContext('personal');
  }
  return data;
}

export async function fetchMe(): Promise<{ workspace_type: string; user_id?: string; email?: string; is_guest: boolean; is_authenticated: boolean }> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to resolve workspace session');
  return res.json();
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } finally {
    clearStoredToken();
    setActiveWorkspaceContext('demo');
  }
}

export async function deleteWorkspace(): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/workspace`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to delete workspace' }));
    throw new Error(err.detail || 'Failed to delete workspace');
  }
  clearStoredToken();
  setActiveWorkspaceContext('demo');
}

export async function fetchHealth(): Promise<SystemHealthResponse> {
  const res = await fetch(`${API_BASE}/system/health`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch system health');
  return res.json();
}

export async function updateTone(tone: 'playful' | 'dry' | 'minimal') {
  const res = await fetch(`${API_BASE}/system/tone`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ tone }),
  });
  if (!res.ok) throw new Error('Failed to update tone');
  return res.json();
}

export async function switchContext(context: 'personal' | 'demo') {
  setActiveWorkspaceContext(context);
  const res = await fetch(`${API_BASE}/system/context`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ context }),
  });
  if (!res.ok) throw new Error('Failed to switch context');
  return res.json();
}

export async function fetchSummary(): Promise<SpendingSummaryResponse> {
  const res = await fetch(`${API_BASE}/accounting/summary`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch spending summary');
  return res.json();
}

export async function fetchNotifications(): Promise<HabitObservation[]> {
  const res = await fetch(`${API_BASE}/notifications`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
}

export async function fetchHabits(): Promise<HabitObservation[]> {
  const res = await fetch(`${API_BASE}/habits`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch habits');
  return res.json();
}

export async function sendHabitFeedback(habit_key: string, status: 'confirmed' | 'muted' | 'active', notes?: string) {
  const res = await fetch(`${API_BASE}/habits/feedback`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ habit_key, status, notes }),
  });
  if (!res.ok) throw new Error('Failed to submit feedback');
  return res.json();
}

export async function fetchQuestions(): Promise<PayeeQuestion[]> {
  const res = await fetch(`${API_BASE}/learning/questions`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch payee questions');
  return res.json();
}

export async function answerQuestion(question_id: string, selected_option_id: string) {
  const res = await fetch(`${API_BASE}/learning/answer`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question_id, selected_option_id }),
  });
  if (!res.ok) throw new Error('Failed to submit answer');
  return res.json();
}

export async function dismissQuestion(question_id: string) {
  const res = await fetch(`${API_BASE}/learning/dismiss/${question_id}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to dismiss question');
  return res.json();
}

export async function previewCSV(
  file: File,
  mapping?: Record<string, string>,
  signal?: AbortSignal
): Promise<CSVPreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (mapping) {
    formData.append('mapping', JSON.stringify(mapping));
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/transactions/preview`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
      signal,
      cache: 'no-store',
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err;
    }
    throw new Error(`Unable to reach the backend server (${err.message || 'connection failed'}). Make sure Usually backend is running.`);
  }

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errJson.message || '';
    } catch {
      try {
        errorDetail = await res.text();
      } catch {
        errorDetail = '';
      }
    }
    if (res.status === 404) {
      throw new Error('CSV preview endpoint not found (HTTP 404). Check API server routes.');
    } else if (res.status === 413) {
      throw new Error('CSV file exceeds maximum upload size limit.');
    } else if (res.status >= 500) {
      throw new Error(errorDetail || `Backend error while processing CSV statement (HTTP ${res.status}).`);
    } else {
      throw new Error(errorDetail || `CSV preview failed with status ${res.status}.`);
    }
  }
  return res.json();
}

export async function importCSV(
  file: File,
  mapping: Record<string, string>,
  currency: string = 'INR',
  signal?: AbortSignal
): Promise<CSVImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mapping', JSON.stringify(mapping));
  formData.append('currency', currency);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/transactions/import`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
      signal,
      cache: 'no-store',
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err;
    }
    throw new Error(`Unable to reach the backend server (${err.message || 'connection failed'}). Make sure Usually backend is running.`);
  }

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errJson.message || '';
    } catch {
      try {
        errorDetail = await res.text();
      } catch {
        errorDetail = '';
      }
    }
    throw new Error(errorDetail || `Import failed with status ${res.status}.`);
  }
  return res.json();
}

export async function fetchTransactions(params: {
  limit?: number;
  offset?: number;
  category?: string;
  merchant?: string;
  direction?: string;
  tx_type?: string;
  search?: string;
}): Promise<{ total: number; items: Transaction[]; limit: number; offset: number }> {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  if (params.category) query.set('category', params.category);
  if (params.merchant) query.set('merchant', params.merchant);
  if (params.direction) query.set('direction', params.direction);
  if (params.tx_type) query.set('tx_type', params.tx_type);
  if (params.search) query.set('search', params.search);

  const res = await fetch(`${API_BASE}/transactions?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export async function updateTransaction(id: number, data: { clean_merchant?: string; category?: string; direction?: string; type?: string }) {
  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update transaction');
  return res.json();
}

export async function seedDemoData() {
  const res = await fetch(`${API_BASE}/system/seed-demo`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to seed demo data');
  return res.json();
}

export async function clearAllData() {
  const res = await fetch(`${API_BASE}/system/clear-data`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to clear data');
  return res.json();
}
