from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Tuple

class Transaction(BaseModel):
    id: Optional[int] = None
    import_batch_id: Optional[str] = None
    date: str
    raw_description: str
    clean_merchant: str
    category: str
    amount: float
    direction: str = "debit"  # "debit", "credit", "unknown"
    type: str  # "expense", "income", "refund", "transfer", "p2p"
    currency: str = "INR"
    fingerprint: str
    is_user_modified: bool = False
    created_at: Optional[str] = None

class CSVPreviewRow(BaseModel):
    row_index: int
    raw_data: Dict[str, str]
    parsed_date: Optional[str] = None
    parsed_merchant: Optional[str] = None
    parsed_category: Optional[str] = None
    parsed_amount: Optional[float] = None
    parsed_direction: Optional[str] = "debit"
    parsed_type: Optional[str] = None
    status: str  # "valid", "error", "ambiguous"
    error_message: Optional[str] = None

class CSVPreviewResponse(BaseModel):
    filename: str
    headers: List[str]
    suggested_mapping: Dict[str, str]
    total_rows: int
    preview_rows: List[CSVPreviewRow]
    valid_count: int
    error_count: int
    ambiguous_count: int
    confidence_score: float = 0.0
    is_confident: bool = False
    needs_mapping: bool = True
    confidence_reasons: List[str] = []
    detected_date_range: Optional[Tuple[str, str]] = None
    sample_total_expenses: float = 0.0

class CSVImportResult(BaseModel):
    batch_id: str
    filename: str
    total_rows: int
    accepted_rows: int
    duplicate_rows: int
    rejected_rows: int
    errors: List[Dict[str, Any]] = []
    newly_unlocked_habits: int = 0
    pending_questions_count: int = 0
    date_range: Optional[Tuple[str, str]] = None
    total_spent: float = 0.0
    gross_debit_outflow: float = 0.0
    gross_credit_inflow: float = 0.0
    classified_expenses: float = 0.0
    transfers_outflow: float = 0.0
    p2p_outgoing: float = 0.0
    p2p_incoming: float = 0.0
    refunds_inflow: float = 0.0
    net_spending: float = 0.0
    blank_rows_skipped: int = 0

class HabitObservation(BaseModel):
    habit_key: str
    title: str
    headline: str
    message: str
    habit_type: str
    merchant: Optional[str] = None
    category: Optional[str] = None
    confidence: float
    min_evidence_met: bool
    evidence: Dict[str, Any]
    observation_window: str
    last_observed_date: Optional[str] = None
    freshness_status: str  # "fresh", "quiet_recent", "dormant"
    status: str = "active"  # "active", "confirmed", "muted"
    generated_by: str = "deterministic_engine"
    tone: str = "playful"

class SpendingSummaryResponse(BaseModel):
    total_expenses: float
    total_income: float
    total_refunds: float
    total_transfers: float
    total_p2p_outgoing: float = 0.0
    total_p2p_incoming: float = 0.0
    gross_debit_outflow: float = 0.0
    gross_credit_inflow: float = 0.0
    net_cash_flow: float
    transaction_count: int
    date_range: Optional[Dict[str, str]] = None
    top_merchants: List[Dict[str, Any]] = []
    category_breakdown: List[Dict[str, Any]] = []
    current_month_pace: Optional[Dict[str, Any]] = None

class TransactionUpdate(BaseModel):
    clean_merchant: Optional[str] = None
    category: Optional[str] = None
    direction: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    type: Optional[str] = None

class HabitFeedbackRequest(BaseModel):
    habit_key: str
    status: str  # "confirmed", "muted", "active"
    notes: Optional[str] = None

class PayeeQuestionOption(BaseModel):
    id: str
    label: str
    category: str
    transaction_type: str
    description: Optional[str] = None

class PayeeQuestion(BaseModel):
    id: str
    payee_key: str
    payee_name: str
    prompt: str
    options: List[PayeeQuestionOption]
    transaction_count: int
    total_amount: float
    status: str = "pending"  # "pending", "answered", "dismissed"
    created_at: str

class PayeeAnswerRequest(BaseModel):
    question_id: str
    selected_option_id: str
    custom_category: Optional[str] = None
    custom_type: Optional[str] = None
    notes: Optional[str] = None

class UserSettingsUpdate(BaseModel):
    tone: Optional[str] = None  # "playful", "dry", "minimal"

class SystemHealthResponse(BaseModel):
    status: str
    db_connected: bool
    transaction_count: int
    batch_count: int
    ollama_available: bool
    ollama_model: str
    is_demo_mode: bool
    pending_questions_count: int = 0
    current_tone: str = "playful"
    active_context: str = "personal"
    has_personal_data: bool = False
