import csv
import io
import re
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from app.services.learning_engine import generate_payee_questions_for_batch
from app.database import migrate_db

DATE_PATTERNS = [
    ("%Y-%m-%d", r"^\d{4}-\d{2}-\d{2}$"),
    ("%Y/%m/%d", r"^\d{4}/\d{2}/\d{2}$"),
    ("%d/%m/%Y", r"^\d{1,2}/\d{1,2}/\d{4}$"),
    ("%d-%m-%Y", r"^\d{1,2}-\d{1,2}-\d{4}$"),
    ("%m/%d/%Y", r"^\d{1,2}/\d{1,2}/\d{4}$"),
    ("%d-%b-%Y", r"^\d{1,2}-[A-Za-z]{3}-\d{4}$"),
    ("%d %b %Y", r"^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$"),
    ("%Y-%m-%dT%H:%M:%S", r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}"),
    ("%d-%m-%Y %H:%M:%S", r"^\d{1,2}-\d{1,2}-\d{4}\s+\d{2}:\d{2}:\d{2}"),
    ("%d/%m/%Y %H:%M:%S", r"^\d{1,2}/\d{1,2}/\d{4}\s+\d{2}:\d{2}:\d{2}"),
]

KNOWN_MERCHANT_PATTERNS = [
    (r"(?i)\bswiggy\b", "Swiggy", "Food & Dining", "expense"),
    (r"(?i)\bzomato\b", "Zomato", "Food & Dining", "expense"),
    (r"(?i)\bblinkit\b", "Blinkit", "Groceries", "expense"),
    (r"(?i)\bzepto\b", "Zepto", "Groceries", "expense"),
    (r"(?i)\binstamart\b", "Instamart", "Groceries", "expense"),
    (r"(?i)\bamazon\b|amzn", "Amazon", "Shopping", "expense"),
    (r"(?i)\bflipkart\b", "Flipkart", "Shopping", "expense"),
    (r"(?i)\bmyntra\b", "Myntra", "Shopping", "expense"),
    (r"(?i)\buber\b", "Uber", "Transportation", "expense"),
    (r"(?i)\bola\b", "Ola", "Transportation", "expense"),
    (r"(?i)\brapido\b", "Rapido", "Transportation", "expense"),
    (r"(?i)\bnetflix\b", "Netflix", "Entertainment", "expense"),
    (r"(?i)\bspotify\b", "Spotify", "Entertainment", "expense"),
    (r"(?i)\byoutube\b", "YouTube", "Entertainment", "expense"),
    (r"(?i)\bapple\.com\b|itunes", "Apple", "Subscriptions", "expense"),
    (r"(?i)\bstarbucks\b", "Starbucks", "Food & Dining", "expense"),
    (r"(?i)\bblue tokai\b", "Blue Tokai", "Food & Dining", "expense"),
    (r"(?i)\bmcdonalds?\b", "McDonald's", "Food & Dining", "expense"),
    (r"(?i)\bairtel\b", "Airtel", "Utilities", "expense"),
    (r"(?i)\bjio\b", "Jio", "Utilities", "expense"),
    (r"(?i)\bbescom\b|electricity", "Electricity", "Utilities", "expense"),
    (r"(?i)\bcult(?:\.fit)?\b", "Cult.fit", "Health & Fitness", "expense"),
    (r"(?i)\bapollo\b", "Apollo Pharmacy", "Health & Fitness", "expense"),
    (r"(?i)\bcred\b|cc payment|credit card bill", "CRED Payment", "Transfers", "transfer"),
    (r"(?i)salary|payroll", "Salary", "Income", "income"),
    (r"(?i)refund|cashback", "Merchant Refund", "Refund", "refund"),
    (r"(?i)canteen|snacks|bakery|cafe|restaurant|tea|dhaba", None, "Food & Dining", "expense"),
    (r"(?i)urban transport|metro|bus|rail|irctc|fuel|petrol", None, "Transportation", "expense"),
    (r"(?i)books|gift|stationery|store|retail", None, "Shopping", "expense"),
    (r"(?i)grocessory|grocery|supermarket|mart|vegetables|dairy", None, "Groceries", "expense"),
]

FOOTER_DISCLAIMER_KEYWORDS = [
    "automatically generated statement",
    "terms & conditions",
    "terms-conditions",
    "privacy policy",
    "fictitious offers",
    "confidential and intended for the recipient",
    "support.phonepe.com",
    "customer(s) are requested to immediately notify",
    "strictly forbidden to share",
    "confidential information such as otp",
    "unauthorized transaction",
    "report an unauthorized transaction",
    "do not fall prey to fictitious",
    "end of statement",
    "*** end of statement ***",
    "this statement is computer generated",
]

def is_footer_disclaimer_row(row: List[str]) -> bool:
    if not row:
        return False
    combined = " ".join(row).lower()
    if any(keyword in combined for keyword in FOOTER_DISCLAIMER_KEYWORDS):
        return True
    first_cell = row[0].strip().lower()
    if first_cell.startswith("note:") or first_cell.startswith("disclaimer:") or first_cell.startswith("important:"):
        return True
    return False

def is_header_candidate_row(row: List[str]) -> bool:
    lower_row = [c.strip().lower() for c in row if c.strip()]
    if len(lower_row) < 2:
        return False
    has_date = any("date" in c or "time" in c or "day" in c for c in lower_row)
    has_amount_or_details = any(
        any(k in c for k in [
            "amount", "debit", "credit", "withdrawal", "deposit",
            "details", "narration", "description", "particulars",
            "spent", "received", "balance", "total", "dr", "cr"
        ])
        for c in lower_row
    )
    return has_date and has_amount_or_details

def clean_merchant_and_category(
    raw_desc: str,
    learned_rules: Optional[Dict[str, Tuple[str, str, str]]] = None
) -> Tuple[str, str, str]:
    cleaned = raw_desc.strip()
    lowered = cleaned.lower()

    if learned_rules:
        for p_key, (learned_name, learned_cat, learned_type) in learned_rules.items():
            if p_key in lowered:
                return learned_name, learned_cat, learned_type

    phonepe_paid = re.search(r"Paid to\s+(.+)$", cleaned, re.IGNORECASE)
    phonepe_recv = re.search(r"Received from\s+(.+)$", cleaned, re.IGNORECASE)

    extracted_name = None
    inferred_type = "expense"

    if phonepe_paid:
        extracted_name = phonepe_paid.group(1).strip()
        inferred_type = "expense"
    elif phonepe_recv:
        extracted_name = phonepe_recv.group(1).strip()
        inferred_type = "p2p"
    elif cleaned.startswith("Paid -"):
        extracted_name = cleaned.replace("Paid -", "").strip() or "Voucher"
        inferred_type = "expense"

    target_for_lookup = extracted_name or cleaned
    target_lowered = target_for_lookup.lower()

    for pattern, clean_name, category, tx_type in KNOWN_MERCHANT_PATTERNS:
        if re.search(pattern, target_lowered):
            final_name = clean_name if clean_name else target_for_lookup.title()
            return final_name, category, (inferred_type if inferred_type != "expense" else tx_type)

    upi_match = re.search(r"UPI/(?:[^/]+/)?([A-Za-z0-9 _.-]{3,30})", target_for_lookup, re.IGNORECASE)
    if upi_match:
        extracted = upi_match.group(1).strip()
        if len(extracted) > 2 and not extracted.isdigit():
            return extracted.title(), "General", inferred_type

    pos_match = re.search(r"(?:POS|CARD|TXN)\s+\d*\s*([A-Za-z0-9 &.-]{3,25})", target_for_lookup, re.IGNORECASE)
    if pos_match:
        extracted = pos_match.group(1).strip()
        if len(extracted) > 2:
            return extracted.title(), "General", inferred_type

    sanitized = re.sub(r"[^A-Za-z0-9 &.-]", " ", target_for_lookup)
    words = sanitized.split()
    if words:
        name = " ".join(words[:4]).title()
        return name, "General", inferred_type

    return target_for_lookup.title() if target_for_lookup else "Unknown Payee", "General", inferred_type

def parse_date_safely(raw_val: str) -> Optional[str]:
    raw_str = raw_val.strip().lstrip("\t").strip()
    if not raw_str:
        return None

    for fmt, pattern in DATE_PATTERNS:
        if re.search(pattern, raw_str):
            try:
                if "T" in raw_str and fmt == "%Y-%m-%dT%H:%M:%S":
                    dt = datetime.fromisoformat(raw_str.replace("Z", "+00:00"))
                    return dt.strftime("%Y-%m-%d")
                dt = datetime.strptime(raw_str[:19], fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    for sep in ["-", "/", "."]:
        if sep in raw_str:
            parts = raw_str.split(sep)
            if len(parts) == 3:
                if len(parts[0]) == 4:
                    try:
                        y = int(parts[0])
                        m = int(parts[1])
                        d = int(parts[2].split()[0])
                        return datetime(y, m, d).strftime("%Y-%m-%d")
                    except (ValueError, IndexError):
                        pass
                elif len(parts[2].split()[0]) == 4:
                    try:
                        y = int(parts[2].split()[0])
                        p1 = int(parts[0])
                        p2 = int(parts[1])
                        if p1 > 12 and p2 <= 12:
                            return datetime(y, p2, p1).strftime("%Y-%m-%d")
                        return datetime(y, p2, p1).strftime("%Y-%m-%d")
                    except (ValueError, IndexError):
                        pass

    return None

def parse_amount_str(raw_val: str) -> Optional[Tuple[float, bool]]:
    if raw_val is None:
        return None
    val = str(raw_val).strip().lstrip("\t").strip()
    if not val:
        return None

    is_negative = False
    if val.startswith("(") and val.endswith(")"):
        is_negative = True
        val = val[1:-1].strip()
    elif val.startswith("-"):
        is_negative = True
        val = val[1:].strip()
    elif val.endswith("CR") or val.endswith("Cr"):
        val = val[:-2].strip()
    elif val.endswith("DR") or val.endswith("Dr"):
        val = val[:-2].strip()

    cleaned_num = re.sub(r"[^\d.]", "", val)
    if not cleaned_num:
        return None

    try:
        amount_num = float(cleaned_num)
        return (amount_num, is_negative)
    except ValueError:
        return None

def detect_column_headers(headers: List[str]) -> Dict[str, str]:
    """
    Analyzes headers and returns mapping dictionary.
    """
    mapping = {}
    lower_headers = {h.strip().lower(): h for h in headers}

    date_candidates = ["transaction date", "txn date", "trans date", "date", "value date", "posted date", "time", "timestamp"]
    for cand in date_candidates:
        for lh, orig in lower_headers.items():
            if cand in lh and "date" not in mapping:
                mapping["date"] = orig
                break
        if "date" in mapping:
            break

    desc_candidates = ["transaction details", "narration", "description", "particulars", "remarks", "payee", "merchant", "details", "note"]
    for cand in desc_candidates:
        for lh, orig in lower_headers.items():
            if cand in lh and "description" not in mapping:
                mapping["description"] = orig
                break
        if "description" in mapping:
            break

    debit_candidates = ["debit", "withdrawal", "dr amount", "dr", "debit amount", "paid out", "spent"]
    credit_candidates = ["credit", "deposit", "cr amount", "cr", "credit amount", "paid in", "received"]

    found_debit = None
    for cand in debit_candidates:
        for lh, orig in lower_headers.items():
            if cand == lh or (cand in lh and "instrument" not in lh):
                if not found_debit:
                    found_debit = orig
                    break
        if found_debit:
            break

    found_credit = None
    for cand in credit_candidates:
        for lh, orig in lower_headers.items():
            if cand == lh or (cand in lh and "instrument" not in lh):
                if not found_credit:
                    found_credit = orig
                    break
        if found_credit:
            break

    if found_debit and found_credit:
        mapping["debit"] = found_debit
        mapping["credit"] = found_credit
    else:
        amt_candidates = ["amount", "txn amount", "transaction amount", "total", "net amount"]
        for cand in amt_candidates:
            for lh, orig in lower_headers.items():
                if cand == lh or (cand in lh and "amount" not in mapping):
                    mapping["amount"] = orig
                    break
            if "amount" in mapping:
                break

    type_candidates = ["transaction type", "type", "cr/dr", "dr/cr", "txn type", "entry type"]
    for cand in type_candidates:
        for lh, orig in lower_headers.items():
            if cand in lh and "type" not in mapping:
                mapping["type"] = orig
                break
        if "type" in mapping:
            break

    ref_candidates = ["transaction id", "txn id", "reference no", "reference", "ref", "utr", "cheque no"]
    for cand in ref_candidates:
        for lh, orig in lower_headers.items():
            if cand in lh and "ref_id" not in mapping:
                mapping["ref_id"] = orig
                break
        if "ref_id" in mapping:
            break

    return mapping

def assess_column_confidence(headers: List[str], mapping: Dict[str, str]) -> Tuple[float, List[str]]:
    reasons = []
    confidence = 0.0

    if "date" in mapping:
        confidence += 0.35
        reasons.append(f"Mapped Date to column '{mapping['date']}'")
    if "description" in mapping:
        confidence += 0.35
        reasons.append(f"Mapped Description to column '{mapping['description']}'")
    if "debit" in mapping and "credit" in mapping:
        confidence += 0.30
        reasons.append(f"Mapped separate Debit and Credit columns")
    elif "amount" in mapping:
        confidence += 0.25
        reasons.append(f"Mapped combined Amount to column '{mapping['amount']}'")

    if "type" in mapping:
        reasons.append(f"Mapped Transaction Direction/Type to '{mapping['type']}'")
    if "ref_id" in mapping:
        reasons.append(f"Mapped Reference ID to '{mapping['ref_id']}'")

    return min(round(confidence, 2), 1.0), reasons

def extract_rows_and_headers(csv_content: str) -> Tuple[List[str], List[List[str]], Dict[str, str], int]:
    normalized = csv_content.replace("\r\n", "\n").replace("\r", "\n")
    raw_lines = normalized.split("\n")

    candidate_delimiters = [",", "\t", ";", "|"]
    header_idx: Optional[int] = None
    detected_delimiter: Optional[str] = None
    headers: List[str] = []

    # 1. Scan the first 50 lines with candidate delimiters to find the authoritative header row
    for line_idx, line in enumerate(raw_lines[:50]):
        trimmed = line.strip()
        if not trimmed:
            continue
        for delim in candidate_delimiters:
            try:
                row_cells = next(csv.reader([trimmed], delimiter=delim))
                cleaned_cells = [c.strip().lstrip("\t").strip() for c in row_cells if c.strip()]
                if is_header_candidate_row(cleaned_cells):
                    header_idx = line_idx
                    detected_delimiter = delim
                    headers = [c.strip().lstrip("\t").strip() for c in row_cells]
                    break
            except Exception:
                continue
        if header_idx is not None:
            break

    # 2. If no candidate header row recognized yet, fall back to safe sniffing constrained strictly to single-char delimiters
    if detected_delimiter is None:
        try:
            sample_lines = [l for l in raw_lines[:50] if l.strip()]
            sample_text = "\n".join(sample_lines[:20])
            sniffed = csv.Sniffer().sniff(sample_text, delimiters=[",", "\t", ";", "|"])
            if sniffed.delimiter in candidate_delimiters:
                detected_delimiter = sniffed.delimiter
            else:
                detected_delimiter = ","
        except Exception:
            detected_delimiter = ","

    # 3. Parse full file with the validated delimiter
    reader = csv.reader(io.StringIO(normalized), delimiter=detected_delimiter)
    all_parsed_lines = list(reader)

    metadata: Dict[str, str] = {}
    if header_idx is None:
        for idx, r in enumerate(all_parsed_lines[:50]):
            cleaned_r = [c.strip().lstrip("\t").strip() for c in r if c.strip()]
            if is_header_candidate_row(cleaned_r):
                header_idx = idx
                headers = [c.strip().lstrip("\t").strip() for c in r]
                break
            else:
                if len(r) == 2 and r[0].strip() and r[1].strip():
                    metadata[r[0].strip()] = r[1].strip()
                elif len(r) == 1 and ":" in r[0]:
                    k, v = r[0].split(":", 1)
                    metadata[k.strip()] = v.strip()
    else:
        for r in all_parsed_lines[:header_idx]:
            if len(r) == 2 and r[0].strip() and r[1].strip():
                metadata[r[0].strip()] = r[1].strip()
            elif len(r) == 1 and ":" in r[0]:
                k, v = r[0].split(":", 1)
                metadata[k.strip()] = v.strip()

    if header_idx is None:
        if all_parsed_lines:
            headers = [c.strip().lstrip("\t").strip() for c in all_parsed_lines[0]]
            post_header_lines = all_parsed_lines[1:]
        else:
            post_header_lines = []
    else:
        post_header_lines = all_parsed_lines[header_idx + 1:]

    data_rows: List[List[str]] = []
    footer_rows: List[List[str]] = []
    blank_rows_skipped = 0

    for r in post_header_lines:
        if not r or not any(c.strip() for c in r):
            blank_rows_skipped += 1
            continue
        if is_footer_disclaimer_row(r):
            footer_rows.append(r)
            continue
        cleaned_row = [c.strip().lstrip("\t").strip() for c in r]
        data_rows.append(cleaned_row)

    metadata["ignored_footer_rows_count"] = str(len(footer_rows))

    return headers, data_rows, metadata, blank_rows_skipped

def parse_row_financials(
    row: List[str],
    header_indices: Dict[str, int],
    mapping: Dict[str, str],
    raw_desc: str,
    default_type: str,
    category: str
) -> Tuple[Optional[float], str, str, str, Optional[str]]:
    """
    Unified authoritative parser for amount, direction ('debit'/'credit'), and classification ('expense'/'transfer'/'p2p'/'refund'/'income').
    Returns (amount, direction, type, status, error_message).
    status is 'valid', 'ambiguous', or 'error'.
    """
    debit_col = mapping.get("debit")
    credit_col = mapping.get("credit")
    amount_col = mapping.get("amount")
    type_col = mapping.get("type")

    if debit_col and credit_col and debit_col in header_indices and credit_col in header_indices:
        raw_deb = row[header_indices[debit_col]] if header_indices[debit_col] < len(row) else ""
        raw_cred = row[header_indices[credit_col]] if header_indices[credit_col] < len(row) else ""
        p_deb = parse_amount_str(raw_deb)
        p_cred = parse_amount_str(raw_cred)

        has_deb = p_deb is not None and p_deb[0] > 0
        has_cred = p_cred is not None and p_cred[0] > 0

        if has_deb and not has_cred:
            parsed_amount = p_deb[0]
            parsed_direction = "debit"
        elif has_cred and not has_deb:
            parsed_amount = p_cred[0]
            parsed_direction = "credit"
        elif has_deb and has_cred:
            return p_deb[0], "debit", "expense", "ambiguous", f"Both Debit ({raw_deb}) and Credit ({raw_cred}) populated"
        else:
            return None, "debit", "expense", "error", "Incomplete record: Debit and Credit both empty or zero"
    elif amount_col and amount_col in header_indices:
        raw_amt = row[header_indices[amount_col]] if header_indices[amount_col] < len(row) else ""
        p_amt = parse_amount_str(raw_amt)
        if not p_amt or p_amt[0] == 0:
            return None, "debit", "expense", "error", f"Incomplete record: invalid or missing amount '{raw_amt}'"
        abs_amt, is_neg = p_amt
        parsed_amount = abs_amt

        if type_col and type_col in header_indices and header_indices[type_col] < len(row):
            raw_t = row[header_indices[type_col]].strip().lower()
            if "debit" in raw_t or "dr" == raw_t:
                parsed_direction = "debit"
            elif "credit" in raw_t or "cr" == raw_t:
                parsed_direction = "credit"
            elif is_neg:
                parsed_direction = "debit"
            elif "received from" in raw_desc.lower():
                parsed_direction = "credit"
            else:
                parsed_direction = "debit"
        elif is_neg:
            parsed_direction = "debit"
        elif "received from" in raw_desc.lower():
            parsed_direction = "credit"
        else:
            parsed_direction = "debit"
    else:
        return None, "debit", "expense", "error", "No amount column configured"

    # Preserved separate classification (type)
    if parsed_direction == "debit":
        if default_type == "transfer" or category == "Transfers":
            parsed_type = "transfer"
        elif default_type == "p2p":
            parsed_type = "p2p"
        else:
            parsed_type = "expense"
    else:  # credit
        if "refund" in raw_desc.lower() or "cashback" in raw_desc.lower() or default_type == "refund":
            parsed_type = "refund"
        elif default_type == "p2p" or "received from" in raw_desc.lower():
            parsed_type = "p2p"
        elif "salary" in raw_desc.lower() or "payroll" in raw_desc.lower() or default_type == "income":
            parsed_type = "income"
        else:
            parsed_type = "income"

    return parsed_amount, parsed_direction, parsed_type, "valid", None

def generate_fingerprint(
    date_str: str,
    clean_merchant: str,
    amount: float,
    tx_type: str,
    ref_id: Optional[str],
    occurrence_counter: int,
    direction: str = "debit"
) -> str:
    ref_part = f"ref:{ref_id.strip()}" if ref_id and ref_id.strip() else f"occ:{occurrence_counter}"
    raw_key = f"{date_str}|{clean_merchant.strip().lower()}|{amount:.2f}|{direction.lower()}|{tx_type.lower()}|{ref_part}"
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

def parse_and_preview_csv(
    csv_content: str,
    user_mapping: Optional[Dict[str, str]] = None,
    max_preview_rows: int = 50
) -> Dict[str, Any]:
    headers, all_raw_rows, metadata, blank_rows_skipped = extract_rows_and_headers(csv_content)
    ignored_footer_rows = int(metadata.get("ignored_footer_rows_count", 0))

    if not headers:
        return {
            "headers": [],
            "suggested_mapping": {},
            "total_rows": 0,
            "preview_rows": [],
            "valid_count": 0,
            "error_count": 0,
            "ambiguous_count": 0,
            "confidence_score": 0.0,
            "is_confident": False,
            "needs_mapping": True,
            "confidence_reasons": ["No recognizable header row found"],
            "detected_date_range": None,
            "sample_total_expenses": 0.0,
            "blank_rows_skipped": blank_rows_skipped,
            "ignored_footer_rows": ignored_footer_rows,
        }

    header_indices = {h: idx for idx, h in enumerate(headers)}
    suggested = detect_column_headers(headers)
    initial_confidence, reasons = assess_column_confidence(headers, suggested)
    mapping = user_mapping if user_mapping else suggested

    date_col = mapping.get("date")
    desc_col = mapping.get("description")
    amount_col = mapping.get("amount")
    debit_col = mapping.get("debit")
    credit_col = mapping.get("credit")
    type_col = mapping.get("type")

    preview_rows = []
    valid_count = 0
    error_count = 0
    ambiguous_count = 0
    detected_dates = []
    sample_total_expenses = 0.0

    for row_idx, row in enumerate(all_raw_rows):
        row_dict = {}
        for h, idx in header_indices.items():
            row_dict[h] = row[idx] if idx < len(row) else ""

        parsed_date = None
        parsed_merchant = None
        parsed_category = None
        parsed_amount = None
        parsed_type = None
        status = "valid"
        error_msg = None

        if is_footer_disclaimer_row(row):
            ignored_footer_rows += 1
            continue
        elif not date_col or date_col not in header_indices or header_indices[date_col] >= len(row):
            status = "error"
            error_msg = "Date column missing or unmapped"
        else:
            raw_date = row[header_indices[date_col]].strip().lstrip("\t").strip()
            parsed_date = parse_date_safely(raw_date)
            if not parsed_date:
                status = "error"
                error_msg = f"Cannot parse date: '{raw_date}'"

        raw_desc = ""
        if desc_col and desc_col in header_indices and header_indices[desc_col] < len(row):
            raw_desc = row[header_indices[desc_col]].strip()

        if status == "valid" and not raw_desc:
            status = "error"
            error_msg = "Incomplete record: missing transaction details"

        clean_m, cat, t_type = clean_merchant_and_category(raw_desc)
        parsed_merchant = clean_m
        parsed_category = cat

        fin_amt, fin_dir, fin_type, fin_status, fin_error = parse_row_financials(
            row, header_indices, mapping, raw_desc, t_type, cat
        )
        parsed_amount = fin_amt
        parsed_direction = fin_dir
        parsed_type = fin_type

        if status == "valid":
            status = fin_status
            error_msg = fin_error

        if status == "valid":
            valid_count += 1
            if parsed_date:
                detected_dates.append(parsed_date)
            if parsed_direction == "debit" and parsed_type == "expense" and parsed_amount:
                sample_total_expenses += parsed_amount
            elif parsed_direction == "credit" and parsed_type == "refund" and parsed_amount:
                sample_total_expenses -= parsed_amount
        elif status == "ambiguous":
            ambiguous_count += 1
        else:
            error_count += 1

        if row_idx < max_preview_rows:
            preview_rows.append({
                "row_index": row_idx + 1,
                "raw_data": row_dict,
                "parsed_date": parsed_date,
                "parsed_merchant": parsed_merchant,
                "parsed_category": parsed_category,
                "parsed_amount": parsed_amount,
                "parsed_direction": parsed_direction,
                "parsed_type": parsed_type,
                "status": status,
                "error_message": error_msg,
            })

    date_range = None
    if detected_dates:
        detected_dates.sort()
        date_range = (detected_dates[0], detected_dates[-1])

    total_r = len(all_raw_rows)
    valid_ratio = valid_count / total_r if total_r > 0 else 0
    final_confidence = initial_confidence * (0.8 + 0.2 * valid_ratio)
    if error_count > 0:
        final_confidence -= min((error_count / total_r) * 0.4, 0.1)
    final_confidence = max(0.0, min(round(final_confidence, 2), 1.0))

    is_confident = (final_confidence >= 0.80 and valid_ratio >= 0.90)
    needs_mapping = not is_confident

    return {
        "headers": headers,
        "suggested_mapping": suggested,
        "total_rows": total_r,
        "preview_rows": preview_rows,
        "valid_count": valid_count,
        "error_count": error_count,
        "ambiguous_count": ambiguous_count,
        "confidence_score": final_confidence,
        "is_confident": is_confident,
        "needs_mapping": needs_mapping,
        "confidence_reasons": reasons,
        "detected_date_range": date_range,
        "sample_total_expenses": round(sample_total_expenses, 2),
        "blank_rows_skipped": blank_rows_skipped,
        "ignored_footer_rows": ignored_footer_rows,
    }

def execute_import(
    conn,
    batch_id: str,
    filename: str,
    csv_content: str,
    mapping: Dict[str, str],
    currency: str = "INR"
) -> Dict[str, Any]:
    migrate_db(conn)
    headers, all_raw_rows, metadata, blank_rows_skipped = extract_rows_and_headers(csv_content)
    ignored_footer_rows = int(metadata.get("ignored_footer_rows_count", 0))

    header_indices = {h: idx for idx, h in enumerate(headers)}
    date_col = mapping.get("date")
    desc_col = mapping.get("description")
    amount_col = mapping.get("amount")
    debit_col = mapping.get("debit")
    credit_col = mapping.get("credit")
    type_col = mapping.get("type")
    ref_col = mapping.get("ref_id")

    accepted_rows = 0
    duplicate_rows = 0
    rejected_rows = 0
    errors = []

    gross_debit_outflow = 0.0
    gross_credit_inflow = 0.0
    classified_expenses = 0.0
    transfers_outflow = 0.0
    p2p_outgoing = 0.0
    p2p_incoming = 0.0
    refunds_inflow = 0.0

    cur = conn.cursor()
    learned_rules = {}
    try:
        cur.execute("SELECT payee_key, clean_name, category, transaction_type FROM learned_payees")
        learned_rules = {r[0]: (r[1], r[2], r[3]) for r in cur.fetchall()}
    except Exception:
        pass

    existing_fps = set()
    existing_ref_keys = set()
    try:
        cur.execute("SELECT fingerprint, ref_id, direction, amount FROM transactions")
        for row in cur.fetchall():
            if row[0]:
                existing_fps.add(row[0])
            if row[1]:
                existing_ref_keys.add((row[1], row[2], float(row[3])))
    except Exception:
        pass

    batch_occurrence: Dict[Tuple[str, str, float, str], int] = {}
    transactions_to_insert = []
    now_iso = datetime.now().isoformat()
    detected_dates = []

    for idx, row in enumerate(all_raw_rows):
        row_num = idx + 1

        if is_footer_disclaimer_row(row):
            ignored_footer_rows += 1
            continue

        if not date_col or date_col not in header_indices or header_indices[date_col] >= len(row):
            rejected_rows += 1
            errors.append({"row": row_num, "error": "Incomplete record: missing or unmapped date column"})
            continue

        raw_date = row[header_indices[date_col]].strip().lstrip("\t").strip()
        parsed_date = parse_date_safely(raw_date)
        if not parsed_date:
            rejected_rows += 1
            errors.append({"row": row_num, "error": f"Invalid date: '{raw_date}'"})
            continue

        raw_desc = ""
        if desc_col and desc_col in header_indices and header_indices[desc_col] < len(row):
            raw_desc = row[header_indices[desc_col]].strip()

        if not raw_desc:
            rejected_rows += 1
            errors.append({"row": row_num, "error": "Incomplete record: missing transaction details"})
            continue

        clean_m, category, default_type = clean_merchant_and_category(raw_desc, learned_rules=learned_rules)

        parsed_amount, parsed_direction, parsed_type, fin_status, fin_error = parse_row_financials(
            row, header_indices, mapping, raw_desc, default_type, category
        )
        if fin_status != "valid":
            rejected_rows += 1
            errors.append({"row": row_num, "error": fin_error or "Invalid financial data"})
            continue

        ref_id = None
        if ref_col and ref_col in header_indices and header_indices[ref_col] < len(row):
            ref_val = row[header_indices[ref_col]].strip()
            if ref_val:
                ref_id = ref_val

        # Duplicate check 1: source transaction reference ID with direction & amount
        ref_key = (ref_id, parsed_direction, parsed_amount) if ref_id else None
        if ref_key and ref_key in existing_ref_keys:
            duplicate_rows += 1
            continue

        key = (parsed_date, clean_m.lower(), parsed_amount, parsed_direction, parsed_type)
        batch_occurrence[key] = batch_occurrence.get(key, 0) + 1
        occ = batch_occurrence[key]

        fp = generate_fingerprint(parsed_date, clean_m, parsed_amount, parsed_type, ref_id, occ, direction=parsed_direction)

        # Duplicate check 2: canonical fingerprint
        if fp in existing_fps:
            duplicate_rows += 1
            continue

        # Duplicate check 3: legacy fingerprints (without direction, or with default type)
        ref_part = f"ref:{ref_id.strip()}" if ref_id and ref_id.strip() else f"occ:{occ}"
        legacy_fp1 = hashlib.sha256(f"{parsed_date}|{clean_m.strip().lower()}|{parsed_amount:.2f}|{parsed_type.lower()}|{ref_part}".encode("utf-8")).hexdigest()
        legacy_fp2 = hashlib.sha256(f"{parsed_date}|{clean_m.strip().lower()}|{parsed_amount:.2f}|{default_type.lower()}|{ref_part}".encode("utf-8")).hexdigest()
        if legacy_fp1 in existing_fps or legacy_fp2 in existing_fps:
            duplicate_rows += 1
            continue

        existing_fps.add(fp)
        if ref_key:
            existing_ref_keys.add(ref_key)
        accepted_rows += 1
        detected_dates.append(parsed_date)

        if parsed_direction == "debit":
            gross_debit_outflow += parsed_amount
            if parsed_type == "expense" and category != "Transfers":
                classified_expenses += parsed_amount
            elif parsed_type == "transfer" or category == "Transfers":
                transfers_outflow += parsed_amount
            elif parsed_type == "p2p":
                p2p_outgoing = p2p_outgoing + parsed_amount if 'p2p_outgoing' in locals() else parsed_amount
        else:  # credit
            gross_credit_inflow += parsed_amount
            if parsed_type == "refund":
                refunds_inflow += parsed_amount
            elif parsed_type == "p2p":
                p2p_incoming += parsed_amount

        transactions_to_insert.append((
            batch_id,
            parsed_date,
            raw_desc,
            clean_m,
            category,
            parsed_amount,
            parsed_direction,
            parsed_type,
            currency,
            fp,
            1 if clean_m.lower() in learned_rules else 0,
            now_iso,
            ref_id
        ))

    with conn:
        conn.execute("""
            INSERT INTO import_batches (id, filename, imported_at, total_rows, accepted_rows, duplicate_rows, rejected_rows)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (batch_id, filename, now_iso, len(all_raw_rows), accepted_rows, duplicate_rows, rejected_rows))

        if transactions_to_insert:
            conn.executemany("""
                INSERT INTO transactions (
                    import_batch_id, date, raw_description, clean_merchant, category,
                    amount, direction, type, currency, fingerprint, is_user_modified, created_at, ref_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, transactions_to_insert)

    try:
        pending_q_count = generate_payee_questions_for_batch(conn, batch_id)
    except Exception:
        pending_q_count = 0

    date_range = None
    if detected_dates:
        detected_dates.sort()
        date_range = (detected_dates[0], detected_dates[-1])

    net_spending = round(classified_expenses - refunds_inflow, 2)

    return {
        "batch_id": batch_id,
        "filename": filename,
        "total_rows": accepted_rows + duplicate_rows + rejected_rows,
        "accepted_rows": accepted_rows,
        "duplicate_rows": duplicate_rows,
        "rejected_rows": rejected_rows,
        "errors": errors[:50],
        "newly_unlocked_habits": 0,
        "pending_questions_count": pending_q_count,
        "date_range": date_range,
        "total_spent": net_spending,
        "gross_debit_outflow": round(gross_debit_outflow, 2),
        "gross_credit_inflow": round(gross_credit_inflow, 2),
        "classified_expenses": round(classified_expenses, 2),
        "transfers_outflow": round(transfers_outflow, 2),
        "p2p_outgoing": round(p2p_outgoing, 2),
        "p2p_incoming": round(p2p_incoming, 2),
        "refunds_inflow": round(refunds_inflow, 2),
        "net_spending": net_spending,
        "blank_rows_skipped": blank_rows_skipped,
        "ignored_footer_rows": ignored_footer_rows,
    }
