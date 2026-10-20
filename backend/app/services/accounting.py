from datetime import datetime
from typing import Dict, Any, List, Optional
import sqlite3
from app.database import migrate_db

def calculate_spending_summary(conn: sqlite3.Connection) -> Dict[str, Any]:
    """
    Computes deterministic accounting summary combining direction and classification:
    - Consumer expenses: debit purchases (excluding self-transfers)
    - P2P Outgoing: money sent to people (outflow)
    - P2P Incoming: money received from people (inflow)
    - Transfers: CC payments and self-transfers (outflow)
    - Gross debit outflow: all money paid out
    - Gross credit inflow: all money received
    - Net cash flow: total income + p2p incoming + refunds - consumer expenses
    """
    migrate_db(conn)
    cur = conn.cursor()

    # Total expenses (consumer debits excluding transfers)
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0.0)
        FROM transactions
        WHERE direction = 'debit' AND type = 'expense' AND category != 'Transfers'
    """)
    total_expenses = float(cur.fetchone()[0])

    # Total income (verified incoming earnings)
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0.0)
        FROM transactions
        WHERE direction = 'credit' AND type = 'income'
    """)
    total_income = float(cur.fetchone()[0])

    # Total refunds (verified merchant credits returned)
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0.0)
        FROM transactions
        WHERE direction = 'credit' AND type = 'refund'
    """)
    total_refunds = float(cur.fetchone()[0])

    # Total transfers (credit card payments / self transfers)
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0.0)
        FROM transactions
        WHERE direction = 'debit' AND (type = 'transfer' OR category = 'Transfers')
    """)
    total_transfers = float(cur.fetchone()[0])

    # Total P2P outgoing debits (money sent to people - OUTFLOW, never counted as income)
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0.0)
        FROM transactions
        WHERE direction = 'debit' AND type = 'p2p'
    """)
    total_p2p_outgoing = float(cur.fetchone()[0])

    # Total P2P incoming credits (money received from people - INFLOW)
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0.0)
        FROM transactions
        WHERE direction = 'credit' AND type = 'p2p'
    """)
    total_p2p_incoming = float(cur.fetchone()[0])

    # Gross Debit Outflow (all money leaving the account)
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0.0)
        FROM transactions
        WHERE direction = 'debit'
    """)
    gross_debit_outflow = float(cur.fetchone()[0])

    # Gross Credit Inflow (all money entering the account)
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0.0)
        FROM transactions
        WHERE direction = 'credit'
    """)
    gross_credit_inflow = float(cur.fetchone()[0])

    # Net cash flow is net earnings after consumer expenses & refunds (excluding non-consumer transfers)
    net_cash_flow = round(total_income + total_p2p_incoming + total_refunds - total_expenses, 2)

    # Total transaction count
    cur.execute("SELECT COUNT(*) FROM transactions")
    tx_count = cur.fetchone()[0]

    # Date range
    cur.execute("SELECT MIN(date), MAX(date) FROM transactions")
    row = cur.fetchone()
    min_date = row[0] if row and row[0] else None
    max_date = row[1] if row and row[1] else None

    # Top Merchants (consumer debit expenses only)
    cur.execute("""
        SELECT clean_merchant, category, SUM(amount) as total_amt, COUNT(*) as txn_count,
               MIN(date) as first_seen, MAX(date) as last_seen
        FROM transactions
        WHERE direction = 'debit' AND type = 'expense' AND category != 'Transfers'
        GROUP BY clean_merchant
        ORDER BY total_amt DESC
        LIMIT 10
    """)
    top_merchants = []
    for r in cur.fetchall():
        top_merchants.append({
            "merchant": r[0],
            "category": r[1],
            "total_amount": round(r[2], 2),
            "count": r[3],
            "avg_amount": round(r[2] / r[3], 2) if r[3] > 0 else 0.0,
            "first_seen": r[4],
            "last_seen": r[5]
        })

    # Category Breakdown (consumer debit expenses only)
    cur.execute("""
        SELECT category, SUM(amount) as total_amt, COUNT(*) as txn_count
        FROM transactions
        WHERE direction = 'debit' AND type = 'expense' AND category != 'Transfers'
        GROUP BY category
        ORDER BY total_amt DESC
    """)
    category_breakdown = []
    for r in cur.fetchall():
        amt = round(r[1], 2)
        pct = round((amt / total_expenses * 100), 1) if total_expenses > 0 else 0.0
        category_breakdown.append({
            "category": r[0],
            "total_amount": amt,
            "count": r[2],
            "percentage": pct
        })

    # Monthly Trends and Pace Calculation
    cur.execute("""
        SELECT strftime('%Y-%m', date) as month, SUM(amount) as monthly_expense
        FROM transactions
        WHERE direction = 'debit' AND type = 'expense' AND category != 'Transfers'
        GROUP BY month
        ORDER BY month ASC
    """)
    monthly_rows = cur.fetchall()
    monthly_trends = [{"month": r[0], "total": round(r[1], 2)} for r in monthly_rows]

    # Calculate current/latest month pace compared to previous months
    current_month_pace = None
    if monthly_rows and max_date:
        latest_month = max_date[:7]
        latest_day = int(max_date[8:10])

        # Current month spending up to latest_day
        cur.execute("""
            SELECT COALESCE(SUM(amount), 0.0)
            FROM transactions
            WHERE direction = 'debit' AND type = 'expense' AND category != 'Transfers'
              AND strftime('%Y-%m', date) = ?
              AND CAST(strftime('%d', date) AS INTEGER) <= ?
        """, (latest_month, latest_day))
        current_m_spend = float(cur.fetchone()[0])

        # Prior months spending up to that same day of the month
        cur.execute("""
            SELECT strftime('%Y-%m', date) as m, COALESCE(SUM(amount), 0.0)
            FROM transactions
            WHERE direction = 'debit' AND type = 'expense' AND category != 'Transfers'
              AND strftime('%Y-%m', date) < ?
              AND CAST(strftime('%d', date) AS INTEGER) <= ?
            GROUP BY m
        """, (latest_month, latest_day))
        prior_spends = [float(r[1]) for r in cur.fetchall()]

        if prior_spends:
            avg_baseline_pace = sum(prior_spends) / len(prior_spends)
            diff_pct = round(((current_m_spend - avg_baseline_pace) / avg_baseline_pace) * 100, 1) if avg_baseline_pace > 0 else 0.0
        else:
            avg_baseline_pace = current_m_spend
            diff_pct = 0.0

        current_month_pace = {
            "month": latest_month,
            "as_of_day": latest_day,
            "current_month_spend": round(current_m_spend, 2),
            "historical_baseline_pace": round(avg_baseline_pace, 2),
            "diff_percentage": diff_pct,
            "status": "higher" if diff_pct > 10 else ("lower" if diff_pct < -10 else "on_track")
        }

    return {
        "total_expenses": round(total_expenses, 2),
        "total_income": round(total_income, 2),
        "total_refunds": round(total_refunds, 2),
        "total_transfers": round(total_transfers, 2),
        "total_p2p_outgoing": round(total_p2p_outgoing, 2),
        "total_p2p_incoming": round(total_p2p_incoming, 2),
        "gross_debit_outflow": round(gross_debit_outflow, 2),
        "gross_credit_inflow": round(gross_credit_inflow, 2),
        "net_cash_flow": net_cash_flow,
        "net_balance_change": round(gross_credit_inflow - gross_debit_outflow, 2),
        "transaction_count": tx_count,
        "date_range": {"min": min_date, "max": max_date} if min_date else None,
        "top_merchants": top_merchants,
        "category_breakdown": category_breakdown,
        "monthly_trends": monthly_trends,
        "current_month_pace": current_month_pace
    }
