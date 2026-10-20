from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
import sqlite3

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

def detect_habits(conn: sqlite3.Connection, reference_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Longitudinal Habit Memory Engine.
    Examines transaction history across successive statement imports to detect:
    1. Recurring weekday purchases (cadence streak and shifts)
    2. Multi-month merchant consistency (longitudinal memory)
    3. Category spending pace shift (baseline deviation)
    4. Payee-level spending shift (changes in spending to a recurring payee)
    5. Weekend spending surges

    Strict safeguards prevent manufacturing habits from sparse history.
    """
    cur = conn.cursor()

    # Load feedback table to respect muted or confirmed habits
    cur.execute("SELECT habit_key, status, notes FROM habit_feedback")
    feedback_map = {r[0]: {"status": r[1], "notes": r[2]} for r in cur.fetchall()}

    # Load tone setting
    current_tone = "playful"
    try:
        cur.execute("SELECT value FROM user_settings WHERE key = 'tone'")
        tone_row = cur.fetchone()
        if tone_row:
            current_tone = tone_row[0]
    except Exception:
        pass

    # Check overall date range and transaction count
    cur.execute("""
        SELECT COUNT(*), MIN(date), MAX(date)
        FROM transactions
        WHERE type IN ('expense', 'p2p') AND category != 'Transfers'
    """)
    total_txns, min_date_str, max_date_str = cur.fetchone()

    # Sparse history safeguard: minimum 6 transactions required
    if not total_txns or total_txns < 6 or not min_date_str or not max_date_str:
        return []

    today_dt = datetime.strptime(reference_date or max_date_str, "%Y-%m-%d").date()

    habits: List[Dict[str, Any]] = []

    # -------------------------------------------------------------
    # 1. Weekday Recurring Habits (e.g. Swiggy on Wednesdays)
    # -------------------------------------------------------------
    cur.execute("""
        SELECT clean_merchant, category, COUNT(*) as cnt
        FROM transactions
        WHERE type IN ('expense', 'p2p') AND category != 'Transfers'
        GROUP BY clean_merchant
        HAVING cnt >= 4
    """)
    frequent_merchants = cur.fetchall()

    for merchant_row in frequent_merchants:
        merchant = merchant_row[0]
        category = merchant_row[1]

        cur.execute("""
            SELECT date, amount
            FROM transactions
            WHERE clean_merchant = ? AND type IN ('expense', 'p2p')
            ORDER BY date ASC
        """, (merchant,))
        tx_rows = cur.fetchall()
        tx_dates = [datetime.strptime(r[0], "%Y-%m-%d").date() for r in tx_rows]
        amounts = [float(r[1]) for r in tx_rows]
        if not tx_dates:
            continue

        weekday_dates: Dict[int, List[date]] = {i: [] for i in range(7)}
        weekday_amounts: Dict[int, List[float]] = {i: [] for i in range(7)}
        for d, amt in zip(tx_dates, amounts):
            weekday_dates[d.weekday()].append(d)
            weekday_amounts[d.weekday()].append(amt)

        for w_idx, dates_on_w in weekday_dates.items():
            unique_dates = sorted(list(set(dates_on_w)))
            if len(unique_dates) < 3:
                continue

            w_name = WEEKDAY_NAMES[w_idx]
            eval_window_weeks = 5
            
            target_calendar_days = []
            cur_d = today_dt
            while len(target_calendar_days) < eval_window_weeks and cur_d >= (today_dt - timedelta(days=60)):
                if cur_d.weekday() == w_idx:
                    target_calendar_days.append(cur_d)
                cur_d -= timedelta(days=1)

            target_calendar_days_set = set(target_calendar_days)
            matching_in_window = [d for d in unique_dates if d in target_calendar_days_set]
            ratio = len(matching_in_window) / len(target_calendar_days) if target_calendar_days else 0

            if len(matching_in_window) >= 3 and ratio >= 0.6:
                habit_key = f"weekday_{merchant.lower()}_{w_name.lower()}"
                status = feedback_map.get(habit_key, {}).get("status", "active")
                if status == "muted":
                    continue

                last_seen_dt = unique_dates[-1]
                has_order_today = (today_dt.weekday() == w_idx and last_seen_dt == today_dt)
                avg_amt = sum(weekday_amounts[w_idx]) / len(weekday_amounts[w_idx]) if weekday_amounts[w_idx] else 0.0

                evidence = {
                    "merchant": merchant,
                    "target_weekday": w_name,
                    "matching_days_count": len(matching_in_window),
                    "total_target_days": len(target_calendar_days),
                    "matching_dates": [d.strftime("%Y-%m-%d") for d in matching_in_window],
                    "ratio": round(ratio, 2),
                    "avg_amount": round(avg_amt, 2),
                    "today_is_target_day": (today_dt.weekday() == w_idx),
                    "has_order_today": has_order_today,
                    "last_observed_date": last_seen_dt.strftime("%Y-%m-%d"),
                }

                habits.append({
                    "habit_key": habit_key,
                    "habit_type": "weekday_cadence",
                    "merchant": merchant,
                    "category": category,
                    "confidence": min(round(ratio, 2), 0.95),
                    "min_evidence_met": True,
                    "observation_window": f"Last {len(target_calendar_days)} {w_name}s",
                    "last_observed_date": last_seen_dt.strftime("%Y-%m-%d"),
                    "freshness_status": "fresh" if (today_dt - last_seen_dt).days <= 7 else "quiet_recent",
                    "status": status,
                    "tone": current_tone,
                    "evidence": evidence
                })

    # -------------------------------------------------------------
    # 2. Multi-Month Recurrence (Longitudinal Habit)
    # -------------------------------------------------------------
    cur.execute("""
        SELECT DISTINCT strftime('%Y-%m', date) as m
        FROM transactions
        WHERE type IN ('expense', 'p2p') AND category != 'Transfers'
        ORDER BY m ASC
    """)
    all_recorded_months = [r[0] for r in cur.fetchall()]
    total_months_count = len(all_recorded_months)

    if total_months_count >= 3:
        cur.execute("""
            SELECT clean_merchant, category, COUNT(DISTINCT strftime('%Y-%m', date)) as active_months,
                   COUNT(*) as total_orders, SUM(amount) as total_amt, MAX(date) as last_seen
            FROM transactions
            WHERE type IN ('expense', 'p2p') AND category != 'Transfers'
            GROUP BY clean_merchant
            HAVING active_months >= 3
        """)
        recurrent_merchants = cur.fetchall()

        for m_row in recurrent_merchants:
            merchant = m_row[0]
            category = m_row[1]
            active_m_count = m_row[2]
            total_orders = m_row[3]
            total_amt = m_row[4]
            last_seen_str = m_row[5]

            month_ratio = active_m_count / total_months_count
            if month_ratio >= 0.7:
                habit_key = f"multimonth_{merchant.lower()}"
                status = feedback_map.get(habit_key, {}).get("status", "active")
                if status == "muted":
                    continue

                cur_month_str = today_dt.strftime("%Y-%m")
                cur.execute("""
                    SELECT COUNT(*), COALESCE(SUM(amount), 0.0)
                    FROM transactions
                    WHERE clean_merchant = ? AND strftime('%Y-%m', date) = ?
                """, (merchant, cur_month_str))
                cur_m_orders, cur_m_amt = cur.fetchone()

                evidence = {
                    "merchant": merchant,
                    "active_months": active_m_count,
                    "total_months": total_months_count,
                    "monthly_consistency_ratio": round(month_ratio, 2),
                    "total_orders": total_orders,
                    "total_spent": round(total_amt, 2),
                    "current_month": cur_month_str,
                    "current_month_orders": cur_m_orders,
                    "current_month_spent": round(cur_m_amt, 2),
                    "has_order_current_month": (cur_m_orders > 0),
                    "last_observed_date": last_seen_str,
                }

                habits.append({
                    "habit_key": habit_key,
                    "habit_type": "multi_month_recurrent",
                    "merchant": merchant,
                    "category": category,
                    "confidence": min(round(month_ratio, 2), 0.95),
                    "min_evidence_met": True,
                    "observation_window": f"Across {total_months_count} months ({active_m_count} active)",
                    "last_observed_date": last_seen_str,
                    "freshness_status": "fresh" if cur_m_orders > 0 else "quiet_recent",
                    "status": status,
                    "tone": current_tone,
                    "evidence": evidence
                })

    # -------------------------------------------------------------
    # 3. Category Spending Pace Shift
    # -------------------------------------------------------------
    if total_months_count >= 2:
        cur_month_str = today_dt.strftime("%Y-%m")
        cur_day = today_dt.day

        cur.execute("""
            SELECT category, SUM(amount)
            FROM transactions
            WHERE type IN ('expense', 'p2p') AND category NOT IN ('Transfers', 'General')
              AND strftime('%Y-%m', date) = ?
              AND CAST(strftime('%d', date) AS INTEGER) <= ?
            GROUP BY category
            HAVING SUM(amount) >= 1000
        """, (cur_month_str, cur_day))
        current_cat_spends = cur.fetchall()

        for cat_row in current_cat_spends:
            cat_name = cat_row[0]
            current_cat_spend = float(cat_row[1])

            cur.execute("""
                SELECT strftime('%Y-%m', date) as m, SUM(amount)
                FROM transactions
                WHERE category = ? AND type IN ('expense', 'p2p')
                  AND strftime('%Y-%m', date) < ?
                  AND CAST(strftime('%d', date) AS INTEGER) <= ?
                GROUP BY m
            """, (cat_name, cur_month_str, cur_day))
            prior_cat_rows = cur.fetchall()

            if len(prior_cat_rows) >= 2:
                baseline_avg = sum(r[1] for r in prior_cat_rows) / len(prior_cat_rows)
                if baseline_avg > 0:
                    diff_pct = ((current_cat_spend - baseline_avg) / baseline_avg) * 100
                    if abs(diff_pct) >= 30 and abs(current_cat_spend - baseline_avg) >= 800:
                        habit_key = f"pace_shift_{cat_name.lower().replace(' ', '_')}"
                        status = feedback_map.get(habit_key, {}).get("status", "active")
                        if status == "muted":
                            continue

                        evidence = {
                            "category": cat_name,
                            "current_month": cur_month_str,
                            "as_of_day": cur_day,
                            "current_spend": round(current_cat_spend, 2),
                            "baseline_spend": round(baseline_avg, 2),
                            "diff_percentage": round(diff_pct, 1),
                            "is_higher": diff_pct > 0,
                            "prior_months_evaluated": len(prior_cat_rows),
                        }

                        habits.append({
                            "habit_key": habit_key,
                            "habit_type": "pace_shift",
                            "merchant": None,
                            "category": cat_name,
                            "confidence": 0.85,
                            "min_evidence_met": True,
                            "observation_window": f"Month-to-date (Day {cur_day}) vs prior {len(prior_cat_rows)} months",
                            "last_observed_date": today_dt.strftime("%Y-%m-%d"),
                            "freshness_status": "fresh",
                            "status": status,
                            "tone": current_tone,
                            "evidence": evidence
                        })

    # -------------------------------------------------------------
    # 4. Changes in Spending to a Recurring Payee
    # -------------------------------------------------------------
    if total_months_count >= 2:
        cur_month_str = today_dt.strftime("%Y-%m")
        # Check merchants with transactions in current month and prior months
        cur.execute("""
            SELECT clean_merchant, category, AVG(amount), COUNT(*)
            FROM transactions
            WHERE type IN ('expense', 'p2p') AND category != 'Transfers'
              AND strftime('%Y-%m', date) = ?
            GROUP BY clean_merchant
            HAVING COUNT(*) >= 2
        """, (cur_month_str,))
        cur_merchants = cur.fetchall()

        for c_row in cur_merchants:
            merchant_name, cat, cur_avg, cur_cnt = c_row
            cur.execute("""
                SELECT AVG(amount), COUNT(DISTINCT strftime('%Y-%m', date))
                FROM transactions
                WHERE clean_merchant = ? AND type IN ('expense', 'p2p')
                  AND strftime('%Y-%m', date) < ?
            """, (merchant_name, cur_month_str))
            prior_stats = cur.fetchone()

            if prior_stats and prior_stats[0] and prior_stats[1] >= 2:
                prior_avg = float(prior_stats[0])
                avg_diff_pct = ((cur_avg - prior_avg) / prior_avg) * 100
                if abs(avg_diff_pct) >= 25 and abs(cur_avg - prior_avg) >= 150:
                    habit_key = f"payee_shift_{merchant_name.lower().replace(' ', '_')}"
                    status = feedback_map.get(habit_key, {}).get("status", "active")
                    if status != "muted":
                        evidence = {
                            "merchant": merchant_name,
                            "category": cat,
                            "current_avg": round(cur_avg, 2),
                            "prior_avg": round(prior_avg, 2),
                            "diff_percentage": round(avg_diff_pct, 1),
                            "is_higher": avg_diff_pct > 0,
                            "current_month": cur_month_str,
                            "prior_months": prior_stats[1],
                        }
                        habits.append({
                            "habit_key": habit_key,
                            "habit_type": "payee_shift",
                            "merchant": merchant_name,
                            "category": cat,
                            "confidence": 0.80,
                            "min_evidence_met": True,
                            "observation_window": f"{cur_month_str} vs prior {prior_stats[1]} months",
                            "last_observed_date": today_dt.strftime("%Y-%m-%d"),
                            "freshness_status": "fresh",
                            "status": status,
                            "tone": current_tone,
                            "evidence": evidence
                        })

    # -------------------------------------------------------------
    # 5. Weekend vs Weekday Surge
    # -------------------------------------------------------------
    cur.execute("""
        SELECT category, COUNT(*) as cnt, SUM(amount) as total_amt
        FROM transactions
        WHERE type IN ('expense', 'p2p') AND category NOT IN ('Transfers', 'General')
        GROUP BY category
        HAVING cnt >= 12
    """)
    volume_categories = cur.fetchall()

    for v_row in volume_categories:
        cat_name = v_row[0]
        cat_tx_cnt = v_row[1]

        cur.execute("""
            SELECT
                SUM(CASE WHEN CAST(strftime('%w', date) AS INTEGER) IN (0, 6) THEN amount ELSE 0 END) as weekend_amt,
                SUM(CASE WHEN CAST(strftime('%w', date) AS INTEGER) NOT IN (0, 6) THEN amount ELSE 0 END) as weekday_amt,
                SUM(CASE WHEN CAST(strftime('%w', date) AS INTEGER) IN (0, 6) THEN 1 ELSE 0 END) as weekend_txns,
                MAX(date) as last_seen
            FROM transactions
            WHERE category = ? AND type IN ('expense', 'p2p')
        """, (cat_name,))
        we_amt, wd_amt, we_txns, last_seen = cur.fetchone()
        we_amt = we_amt or 0.0
        wd_amt = wd_amt or 0.0
        we_txns = we_txns or 0

        tot = we_amt + wd_amt
        if tot > 0:
            we_share = (we_amt / tot) * 100
            if we_share >= 58.0 and we_txns >= 6:
                habit_key = f"weekend_surge_{cat_name.lower().replace(' ', '_')}"
                status = feedback_map.get(habit_key, {}).get("status", "active")
                if status == "muted":
                    continue

                evidence = {
                    "category": cat_name,
                    "weekend_amount": round(we_amt, 2),
                    "weekday_amount": round(wd_amt, 2),
                    "weekend_percentage": round(we_share, 1),
                    "weekend_txns": we_txns,
                    "total_txns": cat_tx_cnt,
                    "last_observed_date": last_seen,
                }

                habits.append({
                    "habit_key": habit_key,
                    "habit_type": "weekend_surge",
                    "merchant": None,
                    "category": cat_name,
                    "confidence": round(we_share / 100, 2),
                    "min_evidence_met": True,
                    "observation_window": f"Across {cat_tx_cnt} transactions",
                    "last_observed_date": last_seen,
                    "freshness_status": "fresh",
                    "status": status,
                    "tone": current_tone,
                    "evidence": evidence
                })

    return habits
