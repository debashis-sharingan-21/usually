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

export async function fetchHealth(): Promise<SystemHealthResponse> {
  const res = await fetch(`${API_BASE}/system/health`);
  if (!res.ok) throw new Error('Failed to fetch system health');
  return res.json();
}

export async function updateTone(tone: 'playful' | 'dry' | 'minimal') {
  const res = await fetch(`${API_BASE}/system/tone`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tone }),
  });
  if (!res.ok) throw new Error('Failed to update tone');
  return res.json();
}

export async function switchContext(context: 'personal' | 'demo') {
  const res = await fetch(`${API_BASE}/system/context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context }),
  });
  if (!res.ok) throw new Error('Failed to switch context');
  return res.json();
}

export async function fetchSummary(): Promise<SpendingSummaryResponse> {
  const res = await fetch(`${API_BASE}/accounting/summary`);
  if (!res.ok) throw new Error('Failed to fetch spending summary');
  return res.json();
}

export async function fetchNotifications(): Promise<HabitObservation[]> {
  const res = await fetch(`${API_BASE}/notifications`);
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
}

export async function fetchHabits(): Promise<HabitObservation[]> {
  const res = await fetch(`${API_BASE}/habits`);
  if (!res.ok) throw new Error('Failed to fetch habits');
  return res.json();
}

export async function sendHabitFeedback(habit_key: string, status: 'confirmed' | 'muted' | 'active', notes?: string) {
  const res = await fetch(`${API_BASE}/habits/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ habit_key, status, notes }),
  });
  if (!res.ok) throw new Error('Failed to submit feedback');
  return res.json();
}

export async function fetchQuestions(): Promise<PayeeQuestion[]> {
  const res = await fetch(`${API_BASE}/learning/questions`);
  if (!res.ok) throw new Error('Failed to fetch payee questions');
  return res.json();
}

export async function answerQuestion(question_id: string, selected_option_id: string) {
  const res = await fetch(`${API_BASE}/learning/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id, selected_option_id }),
  });
  if (!res.ok) throw new Error('Failed to submit answer');
  return res.json();
}

export async function dismissQuestion(question_id: string) {
  const res = await fetch(`${API_BASE}/learning/dismiss/${question_id}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to dismiss question');
  return res.json();
}

export async function previewCSV(file: File, mapping?: Record<string, string>): Promise<CSVPreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (mapping) {
    formData.append('mapping', JSON.stringify(mapping));
  }
  const res = await fetch(`${API_BASE}/transactions/preview`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Preview failed' }));
    throw new Error(err.detail || 'Preview failed');
  }
  return res.json();
}

export async function importCSV(file: File, mapping: Record<string, string>, currency: string = 'INR'): Promise<CSVImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mapping', JSON.stringify(mapping));
  formData.append('currency', currency);

  const res = await fetch(`${API_BASE}/transactions/import`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Import failed' }));
    throw new Error(err.detail || 'Import failed');
  }
  return res.json();
}

export async function fetchTransactions(params: {
  limit?: number;
  offset?: number;
  category?: string;
  merchant?: string;
  tx_type?: string;
  search?: string;
}): Promise<{ total: number; items: Transaction[]; limit: number; offset: number }> {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  if (params.category) query.set('category', params.category);
  if (params.merchant) query.set('merchant', params.merchant);
  if (params.tx_type) query.set('tx_type', params.tx_type);
  if (params.search) query.set('search', params.search);

  const res = await fetch(`${API_BASE}/transactions?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export async function updateTransaction(id: number, data: { clean_merchant?: string; category?: string; type?: string }) {
  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update transaction');
  return res.json();
}

export async function seedDemoData() {
  const res = await fetch(`${API_BASE}/system/seed-demo`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to seed demo data');
  return res.json();
}

export async function clearAllData() {
  const res = await fetch(`${API_BASE}/system/clear-data`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to clear data');
  return res.json();
}
