"""
美团 AI 黑客松 — AutoSolver (pure Python, no external deps)
"""

import time


# ============================================================
# Data model
# ============================================================

class Candidate:
    __slots__ = ("task_ids", "task_str", "courier_id", "score", "willingness")

    def __init__(self, task_ids, task_str, courier_id, score, willingness):
        self.task_ids = task_ids
        self.task_str = task_str
        self.courier_id = courier_id
        self.score = score
        self.willingness = willingness


# ============================================================
# Parsing
# ============================================================

def parse_input(input_text):
    lines = input_text.strip().splitlines()
    start = 1 if lines and lines[0].startswith("task_id_list") else 0

    candidates = []
    task_set = set()
    courier_set = set()

    for line in lines[start:]:
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) < 4:
            continue
        try:
            score = float(parts[2])
            willingness = float(parts[3])
        except ValueError:
            continue

        task_str = parts[0].strip()
        task_ids = tuple(t.strip() for t in task_str.split(","))

        candidates.append(Candidate(
            task_ids=task_ids,
            task_str=task_str,
            courier_id=parts[1].strip(),
            score=score,
            willingness=willingness,
        ))
        task_set.update(task_ids)
        courier_set.add(parts[1].strip())

    return candidates, sorted(task_set), sorted(courier_set)


# ============================================================
# Evaluation
# ============================================================

def evaluate(candidates, selected_indices):
    """Return (expected_accepted, total_score, courier_violations)."""
    prob_not = {}
    total_score = 0.0
    couriers_used = set()
    violations = 0

    for idx in selected_indices:
        cand = candidates[idx]
        total_score += cand.score
        if cand.courier_id in couriers_used:
            violations += 1
        else:
            couriers_used.add(cand.courier_id)
        for t in cand.task_ids:
            prob_not[t] = prob_not.get(t, 1.0) * (1.0 - cand.willingness)

    expected_accepted = sum(1.0 - p for p in prob_not.values())
    return expected_accepted, total_score, violations


def is_better(exp1, score1, viol1, exp2, score2, viol2):
    """Lexicographic: fewer violations > more accepted > lower score."""
    if viol1 != viol2:
        return viol1 < viol2
    if abs(exp1 - exp2) > 1e-8:
        return exp1 > exp2
    return score1 < score2


def format_output(candidates, selected_indices):
    return [(candidates[idx].task_str, [candidates[idx].courier_id]) for idx in selected_indices]


# ============================================================
# Strategy A: Doubao (task-unique, no courier limit) — 949 pts
# ============================================================

def strategy_doubao(candidates):
    """Exact Doubao clone: sort by score/willingness, task-unique, couriers unlimited."""
    indexed = [(c.score / (c.willingness + 1e-6), i) for i, c in enumerate(candidates)]
    indexed.sort(key=lambda x: x[0])

    assigned_tasks = set()
    selected = []

    for __, idx in indexed:
        cand = candidates[idx]
        conflict = any(t in assigned_tasks for t in cand.task_ids)
        if conflict:
            continue
        for t in cand.task_ids:
            assigned_tasks.add(t)
        selected.append(idx)

    return selected


# ============================================================
# Strategy B: Doubao + courier uniqueness
# ============================================================

def strategy_doubao_courier(candidates):
    """Sort by efficiency, enforce task + courier uniqueness."""
    indexed = [(c.score / (c.willingness + 1e-6), i) for i, c in enumerate(candidates)]
    indexed.sort(key=lambda x: x[0])

    assigned_tasks = set()
    used_couriers = set()
    selected = []

    for __, idx in indexed:
        cand = candidates[idx]
        if cand.courier_id in used_couriers:
            continue
        if any(t in assigned_tasks for t in cand.task_ids):
            continue
        for t in cand.task_ids:
            assigned_tasks.add(t)
        used_couriers.add(cand.courier_id)
        selected.append(idx)

    return selected


# ============================================================
# Strategy C: Multi-coverage (courier-unique, task multi-cover)
# ============================================================

def strategy_multicover(candidates, task_ids, courier_ids):
    """
    Phase 1: Cover all tasks with best efficiency (task + courier unique).
    Phase 2: Use remaining couriers as backup for low-probability tasks.
    """
    cands = candidates

    # Group by courier
    courier_to_cands = {cid: [] for cid in courier_ids}
    for idx, c in enumerate(cands):
        courier_to_cands[c.courier_id].append(idx)

    # Pre-sort each courier's candidates by efficiency
    for cid in courier_ids:
        courier_to_cands[cid].sort(
            key=lambda i: cands[i].score / (cands[i].willingness + 1e-6)
        )

    # --- Phase 1: cover all tasks ---
    task_prob_not = {t: 1.0 for t in task_ids}
    used_couriers = set()
    selected = []

    # Sort couriers by their best candidate's efficiency
    courier_best = []
    for cid in courier_ids:
        if courier_to_cands[cid]:
            best_idx = courier_to_cands[cid][0]
            best_eff = cands[best_idx].score / (cands[best_idx].willingness + 1e-6)
            courier_best.append((best_eff, cid))
    courier_best.sort(key=lambda x: x[0])

    for __, cid in courier_best:
        # Find the candidate that covers the most uncovered tasks with best efficiency
        best_idx = None
        best_gain = 0.0
        best_eff = float("inf")

        for idx in courier_to_cands[cid]:
            cand = cands[idx]
            # Count uncovered tasks this candidate would cover
            uncovered = sum(1.0 for t in cand.task_ids if task_prob_not[t] > 0.999)
            if uncovered > best_gain:
                best_gain = uncovered
                best_eff = cand.score / (cand.willingness + 1e-6)
                best_idx = idx
            elif uncovered == best_gain and uncovered > 0:
                eff = cand.score / (cand.willingness + 1e-6)
                if eff < best_eff:
                    best_eff = eff
                    best_idx = idx

        if best_idx is not None:
            cand = cands[best_idx]
            used_couriers.add(cid)
            selected.append(best_idx)
            for t in cand.task_ids:
                task_prob_not[t] *= (1.0 - cand.willingness)

    # --- Phase 2: backup ---
    remaining = [cid for cid in courier_ids if cid not in used_couriers]

    for cid in remaining:
        best_idx = None
        best_efficiency = 0.0

        for idx in courier_to_cands[cid]:
            cand = cands[idx]
            gain = 0.0
            for t in cand.task_ids:
                old_pn = task_prob_not[t]
                new_pn = old_pn * (1.0 - cand.willingness)
                gain += old_pn - new_pn
            eff = gain / (cand.score + 1e-6)
            if eff > best_efficiency:
                best_efficiency = eff
                best_idx = idx

        # MIN_GAIN: skip backups with negligible marginal contribution
        # (avoids inflating total_score for microscopic gains in expected acceptance)
        MIN_GAIN = 1e-6
        if best_idx is not None and best_efficiency > MIN_GAIN:
            cand = cands[best_idx]
            used_couriers.add(cid)
            selected.append(best_idx)
            for t in cand.task_ids:
                task_prob_not[t] *= (1.0 - cand.willingness)

    return selected


# ============================================================
# Strategy D: Greedy marginal gain (best (courier, candidate) iteratively)
# ============================================================

def strategy_marginal(candidates, task_ids, courier_ids):
    """
    Iteratively pick (courier, candidate) with best marginal gain/score.
    Each courier used at most once.
    """
    cands = candidates

    # Group by courier
    courier_to_cands = {cid: [] for cid in courier_ids}
    for idx, c in enumerate(cands):
        courier_to_cands[c.courier_id].append(idx)

    task_prob_not = {t: 1.0 for t in task_ids}
    used_couriers = set()
    selected = []

    # Pre-sort each courier's candidates by efficiency for fast lookup
    for cid in courier_ids:
        courier_to_cands[cid].sort(
            key=lambda i: cands[i].score / (cands[i].willingness + 1e-6)
        )

    # Pre-compute top candidate index for each courier
    top_idx = {}
    for cid in courier_ids:
        top_idx[cid] = 0

    MIN_EFFICIENCY = 1e-6

    while len(used_couriers) < len(courier_ids):
        best_cid = None
        best_idx = None
        best_efficiency = MIN_EFFICIENCY

        for cid in courier_ids:
            if cid in used_couriers:
                continue
            idx_list = courier_to_cands[cid]
            ti = top_idx[cid]
            if ti >= len(idx_list):
                continue

            # Check a few top candidates for this courier
            for offset in range(min(5, len(idx_list) - ti)):
                idx = idx_list[ti + offset]
                cand = cands[idx]
                gain = 0.0
                for t in cand.task_ids:
                    old_pn = task_prob_not[t]
                    new_pn = old_pn * (1.0 - cand.willingness)
                    gain += old_pn - new_pn
                eff = gain / (cand.score + 1e-6)
                if eff > best_efficiency:
                    best_efficiency = eff
                    best_idx = idx
                    best_cid = cid

        if best_cid is None:
            break

        cand = cands[best_idx]
        used_couriers.add(best_cid)
        selected.append(best_idx)
        for t in cand.task_ids:
            task_prob_not[t] *= (1.0 - cand.willingness)

    return selected


# ============================================================
# Local improvement: coordinate descent
# ============================================================

def local_improve(candidates, task_ids, courier_ids, selected, deadline):
    """
    Coordinate descent: for each assigned courier, try all their candidates
    and pick the one that maximizes marginal gain. Repeat until convergence.
    """
    cands = candidates

    # Group by courier
    courier_to_cands = {cid: [] for cid in courier_ids}
    for idx, c in enumerate(cands):
        courier_to_cands[c.courier_id].append(idx)

    # Build courier → current candidate index mapping
    courier_to_sel_idx = {}
    for idx in selected:
        courier_to_sel_idx[cands[idx].courier_id] = idx

    # Compute current task probabilities
    def compute_probs(sel_indices):
        prob_not = {t: 1.0 for t in task_ids}
        total_score = 0.0
        for idx in sel_indices:
            c = cands[idx]
            total_score += c.score
            for t in c.task_ids:
                prob_not[t] *= (1.0 - c.willingness)
        exp_acc = sum(1.0 - p for p in prob_not.values())
        return prob_not, exp_acc, total_score

    EPS = 1e-12
    prob_not, best_exp, best_score = compute_probs(selected)
    best_selected = list(selected)

    improved = True
    while improved and time.perf_counter() < deadline:
        improved = False

        for cid in list(courier_to_sel_idx.keys()):
            if time.perf_counter() > deadline:
                break

            old_idx = courier_to_sel_idx[cid]
            best_new_idx = old_idx
            best_new_exp = best_exp
            best_new_score = best_score

            # Remove this courier's contribution
            temp_prob_not = dict(prob_not)
            temp_score = best_score - cands[old_idx].score
            old_cand = cands[old_idx]
            for t in old_cand.task_ids:
                divisor = 1.0 - old_cand.willingness
                if divisor > EPS:
                    temp_prob_not[t] /= divisor
                else:
                    temp_prob_not[t] = 1.0  # w≈1 means task was certainly accepted

            # Try all candidates for this courier
            for new_idx in courier_to_cands[cid]:
                if new_idx == old_idx:
                    continue

                new_cand = cands[new_idx]
                new_prob_not = dict(temp_prob_not)
                for t in new_cand.task_ids:
                    new_prob_not[t] *= (1.0 - new_cand.willingness)
                new_exp = sum(1.0 - p for p in new_prob_not.values())
                new_score = temp_score + new_cand.score

                # Lexicographic comparison with tolerance
                TOL = 1e-9
                if new_exp > best_new_exp + TOL:
                    best_new_exp = new_exp
                    best_new_score = new_score
                    best_new_idx = new_idx
                elif abs(new_exp - best_new_exp) <= TOL and new_score < best_new_score:
                    best_new_score = new_score
                    best_new_idx = new_idx

            if best_new_idx != old_idx:
                new_cand = cands[best_new_idx]
                for t in old_cand.task_ids:
                    divisor = 1.0 - old_cand.willingness
                    if divisor > EPS:
                        prob_not[t] /= divisor
                    else:
                        prob_not[t] = 1.0
                for t in new_cand.task_ids:
                    prob_not[t] *= (1.0 - new_cand.willingness)
                best_exp = best_new_exp
                best_score = best_new_score
                courier_to_sel_idx[cid] = best_new_idx
                best_selected = list(courier_to_sel_idx.values())
                improved = True

    return best_selected


# ============================================================
# Main entry point
# ============================================================

def solve(input_text):
    """
    AutoSolver main entry point.

    Input: TSV text (task_id_list, courier_id, score, willingness)
    Output: [(task_id_list_str, [courier_id, ...]), ...]
    """
    try:
        return _solve_inner(input_text)
    except Exception:
        return _solve_fallback(input_text)


def _solve_inner(input_text):
    candidates, task_ids, courier_ids = parse_input(input_text)
    n_tasks = len(task_ids)

    if n_tasks == 0:
        return []

    # Time budget: adaptive based on problem size
    if n_tasks <= 10:
        budget_ms = 500
    elif n_tasks <= 30:
        budget_ms = 1500
    elif n_tasks <= 60:
        budget_ms = 3000
    else:
        budget_ms = 5000

    t_start = time.perf_counter()
    deadline = t_start + budget_ms / 1000.0

    best_exp = -1.0
    best_score = float("inf")
    best_viol = float("inf")
    best_selected = []

    def update(selected):
        nonlocal best_exp, best_score, best_viol, best_selected
        exp, sc, viol = evaluate(candidates, selected)
        if is_better(exp, sc, viol, best_exp, best_score, best_viol):
            best_exp = exp
            best_score = sc
            best_viol = viol
            best_selected = list(selected)

    # --- Phase 1: Run greedy strategies (~30% of budget) ---
    phase1_end = t_start + budget_ms * 0.30 / 1000.0

    # Strategy 1: Doubao (proven 949, always run first)
    update(strategy_doubao(candidates))

    # Strategy 2: Doubao + courier constraint
    if time.perf_counter() < phase1_end:
        update(strategy_doubao_courier(candidates))

    # Strategy 3: Multi-coverage (primary + backup)
    if time.perf_counter() < phase1_end:
        update(strategy_multicover(candidates, task_ids, courier_ids))

    # Strategy 4: Marginal gain greedy
    if n_tasks <= 50 and time.perf_counter() < phase1_end:
        update(strategy_marginal(candidates, task_ids, courier_ids))

    # --- Phase 2: Local improvement on best solution (~60% of budget) ---
    if best_selected and n_tasks <= 100:
        ls_deadline = min(deadline, t_start + budget_ms * 0.90 / 1000.0)
        improved = local_improve(
            candidates, task_ids, courier_ids, best_selected, ls_deadline
        )
        update(improved)

    return format_output(candidates, best_selected)


def _solve_fallback(input_text):
    """Minimal working solver as last-resort fallback (Doubao algorithm)."""
    lines = input_text.strip().splitlines()
    start = 1 if lines and lines[0].startswith("task_id_list") else 0

    candidates = []
    for line in lines[start:]:
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) < 4:
            continue
        try:
            score = float(parts[2])
            willingness = float(parts[3])
        except ValueError:
            continue
        task_str = parts[0].strip()
        courier = parts[1].strip()
        candidates.append((score, willingness, task_str, courier))

    candidates.sort(key=lambda x: x[0] / (x[1] + 1e-6))

    assigned_tasks = set()
    result = []
    for score, willingness, task_str, courier in candidates:
        tasks = task_str.split(",")
        if any(t in assigned_tasks for t in tasks):
            continue
        for t in tasks:
            assigned_tasks.add(t)
        result.append((task_str, [courier]))

    return result


# ============================================================
# Local test
# ============================================================

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            text = f.read()
        t0 = time.perf_counter()
        output = solve(text)
        elapsed = time.perf_counter() - t0

        print(f"{len(output)} assignments, {elapsed:.3f}s")

        # Quick evaluation
        candidates, task_ids, courier_ids = parse_input(text)
        exp, sc, viol = evaluate(candidates, [
            i for i, c in enumerate(candidates)
            for task_str, courier_list in output
            if c.task_str == task_str and c.courier_id == courier_list[0]
        ])
        print(f"Expected accepted: {exp:.2f}/{len(task_ids)}, Score: {sc:.1f}, Violations: {viol}")

        for task_str, courier_list in output[:5]:
            print(f"  {task_str} -> {courier_list}")
    else:
        print("Usage: python solver.py <input_file>")
