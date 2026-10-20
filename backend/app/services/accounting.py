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
    cur = conn.cursor()
    # Ensure migration only if needed
    cur.execute("PRAGMA table_info(transactions)")
    cols = [c[1] for c in cur.fetchall()]
    if "direction" not in cols or "ref_id" not in cols:
        migrate_db(conn)

    # Consolidated single-pass aggregation query for all ledger totals and bounds
    cur.execute("""
        SELECT
            COUNT(*),
            MIN(date),
            MAX(date),
            COALESCE(SUM(CASE WHEN direction = 'debit' AND type = 'expense' AND category != 'Transfers' THEN amount ELSE 0 END), 0.0),
            COALESCE(SUM(CASE WHEN direction = 'credit' AND type = 'income' THEN amount ELSE 0 END), 0.0),
            COALESCE(SUM(CASE WHEN direction = 'credit' AND type = 'refund' THEN amount ELSE 0 END), 0.0),
            COALESCE(SUM(CASE WHEN direction = 'debit' AND (type = 'transfer' OR category = 'Transfers') THEN amount ELSE 0 END), 0.0),
            COALESCE(SUM(CASE WHEN direction = 'credit' AND (type = 'transfer' OR category = 'Transfers') THEN amount ELSE 0 END), 0.0),
            COALESCE(SUM(CASE WHEN direction = 'debit' AND type = 'p2p' THEN amount ELSE 0 END), 0.0),
            COALESCE(SUM(CASE WHEN direction = 'credit' AND type = 'p2p' THEN amount ELSE 0 END), 0.0),
            COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END), 0.0),
            COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END), 0.0)
        FROM transactions
    """)
    agg_row = cur.fetchone()
    (
        tx_count,
        min_date,
        max_date,
        total_expenses,
        total_income,
        total_refunds,
        total_transfers,
        total_transfers_in,
        total_p2p_outgoing,
        total_p2p_incoming,
        gross_debit_outflow,
        gross_credit_inflow
    ) = (
        agg_row[0] if agg_row else 0,
        agg_row[1] if agg_row else None,
        agg_row[2] if agg_row else None,
        float(agg_row[3]) if agg_row else 0.0,
        float(agg_row[4]) if agg_row else 0.0,
        float(agg_row[5]) if agg_row else 0.0,
        float(agg_row[6]) if agg_row else 0.0,
        float(agg_row[7]) if agg_row else 0.0,
        float(agg_row[8]) if agg_row else 0.0,
        float(agg_row[9]) if agg_row else 0.0,
        float(agg_row[10]) if agg_row else 0.0,
        float(agg_row[11]) if agg_row else 0.0,
    )

    # Reconciliation equations:
    # 1. Gross account balance change = gross credit inflow - gross debit outflow
    net_balance_change = round(gross_credit_inflow - gross_debit_outflow, 2)

    # 2. Consumer living surplus/margin = external inflows (income + p2p in + refunds) - living expenses
    # Excludes non-consumer internal account transfers
    external_inflows = total_income + total_p2p_incoming + total_refunds
    consumer_margin = round(external_inflows - total_expenses, 2)
    net_cash_flow = consumer_margin

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
        "total_transfers_in": round(total_transfers_in, 2),
        "total_p2p_outgoing": round(total_p2p_outgoing, 2),
        "total_p2p_incoming": round(total_p2p_incoming, 2),
        "gross_debit_outflow": round(gross_debit_outflow, 2),
        "gross_credit_inflow": round(gross_credit_inflow, 2),
        "net_cash_flow": net_cash_flow,
        "consumer_margin": consumer_margin,
        "net_balance_change": net_balance_change,
        "transaction_count": tx_count,
        "date_range": {"min": min_date, "max": max_date} if min_date else None,
        "top_merchants": top_merchants,
        "category_breakdown": category_breakdown,
        "monthly_trends": monthly_trends,
        "current_month_pace": current_month_pace
    }
