export interface Transaction {
  id: number;
  import_batch_id?: string;
  date: string;
  raw_description: string;
  clean_merchant: string;
  category: string;
  amount: number;
  type: 'expense' | 'income' | 'refund' | 'transfer' | 'p2p';
  currency: string;
  fingerprint: string;
  is_user_modified: boolean;
  created_at?: string;
}

export interface CSVPreviewRow {
  row_index: number;
  raw_data: Record<string, string>;
  parsed_date?: string;
  parsed_merchant?: string;
  parsed_category?: string;
  parsed_amount?: number;
  parsed_type?: string;
  status: 'valid' | 'error' | 'ambiguous';
  error_message?: string;
}

export interface CSVPreviewResponse {
  filename: string;
  headers: string[];
  suggested_mapping: Record<string, string>;
  total_rows: number;
  preview_rows: CSVPreviewRow[];
  valid_count: number;
  error_count: number;
  ambiguous_count: number;
  confidence_score: number;
  is_confident: boolean;
  needs_mapping: boolean;
  confidence_reasons: string[];
  detected_date_range?: [string, string];
  sample_total_expenses: number;
}

export interface CSVImportResult {
  batch_id: string;
  filename: string;
  total_rows: number;
  accepted_rows: number;
  duplicate_rows: number;
  rejected_rows: number;
  errors: Array<{ row: number; error: string }>;
  newly_unlocked_habits: number;
  pending_questions_count: number;
  date_range?: [string, string];
  total_spent: number;
}

export interface HabitObservation {
  habit_key: string;
  title: string;
  headline: string;
  message: string;
  habit_type: string;
  merchant?: string;
  category?: string;
  confidence: number;
  min_evidence_met: boolean;
  evidence: Record<string, any>;
  observation_window: string;
  last_observed_date?: string;
  freshness_status: 'fresh' | 'quiet_recent' | 'dormant';
  status: 'active' | 'confirmed' | 'muted';
  generated_by: 'ollama_gemma' | 'deterministic_engine';
  tone?: 'playful' | 'dry' | 'minimal';
}

export interface SpendingSummaryResponse {
  total_expenses: number;
  total_income: number;
  total_refunds: number;
  total_transfers: number;
  net_cash_flow: number;
  transaction_count: number;
  date_range?: { min: string; max: string };
  top_merchants: Array<{
    merchant: string;
    category: string;
    total_amount: number;
    count: number;
    avg_amount: number;
    first_seen: string;
    last_seen: string;
  }>;
  category_breakdown: Array<{
    category: string;
    total_amount: number;
    count: number;
    percentage: number;
  }>;
  monthly_trends: Array<{
    month: string;
    total: number;
  }>;
  current_month_pace?: {
    month: string;
    as_of_day: number;
    current_month_spend: number;
    historical_baseline_pace: number;
    diff_percentage: number;
    status: 'higher' | 'lower' | 'on_track';
  };
}

export interface PayeeQuestionOption {
  id: string;
  label: string;
  category: string;
  transaction_type: string;
  description?: string;
}

export interface PayeeQuestion {
  id: string;
  payee_key: string;
  payee_name: string;
  prompt: string;
  options: PayeeQuestionOption[];
  transaction_count: number;
  total_amount: number;
  status: 'pending' | 'answered' | 'dismissed';
  created_at: string;
}

export interface SystemHealthResponse {
  status: string;
  db_connected: boolean;
  transaction_count: number;
  batch_count: number;
  ollama_available: boolean;
  ollama_model: string;
  is_demo_mode: boolean;
  pending_questions_count: number;
  current_tone: 'playful' | 'dry' | 'minimal';
}
