"""
贪心策略 — 基于候选集模型

- GreedyScore: 按 score 排序，骑手/task 不重复（示例 baseline）
- GreedyDensity: 按 score/bundle_size 排序
- GreedyWillingness: 按 willingness 降序
- GreedyCoverage: 优先覆盖未覆盖的 task，再加 backup
"""

import time
from .base import BaseStrategy, StrategyResult
from ..problem import Problem, Solution, Candidate
from ..evaluator import Evaluator


class GreedyScore(BaseStrategy):
    """按 score 升序贪心（与官方示例一致）"""

    def __init__(self):
        super().__init__("greedy_score")

    def solve(self, problem: Problem, time_budget_ms: float) -> StrategyResult:
        t0 = time.perf_counter()

        cands = problem.candidates
        n = len(cands)
        order = sorted(range(n), key=lambda i: (cands[i].score, -cands[i].willingness))

        used_couriers = set()
        used_tasks = set()
        selected = []

        for idx in order:
            cand = cands[idx]
            if cand.courier_id in used_couriers:
                continue
            if any(t in used_tasks for t in cand.task_ids):
                continue
            used_couriers.add(cand.courier_id)
            for t in cand.task_ids:
                used_tasks.add(t)
            selected.append(idx)

        elapsed = (time.perf_counter() - t0) * 1000
        solution = Solution(selected=selected)
        Evaluator(problem).evaluate(solution)

        return StrategyResult(strategy_name=self.name, solution=solution, elapsed_ms=elapsed)


class GreedyDensity(BaseStrategy):
    """按 score/bundle_size（性价比）贪心，允许 task 多派"""

    def __init__(self):
        super().__init__("greedy_density")

    def solve(self, problem: Problem, time_budget_ms: float) -> StrategyResult:
        t0 = time.perf_counter()

        cands = problem.candidates
        n = len(cands)
        order = sorted(range(n), key=lambda i: cands[i].score / len(cands[i].task_ids))

        used_couriers = set()
        selected = []

        for idx in order:
            cand = cands[idx]
            if cand.courier_id in used_couriers:
                continue
            used_couriers.add(cand.courier_id)
            selected.append(idx)

        elapsed = (time.perf_counter() - t0) * 1000
        solution = Solution(selected=selected)
        Evaluator(problem).evaluate(solution)

        return StrategyResult(strategy_name=self.name, solution=solution, elapsed_ms=elapsed)


class GreedyCoverage(BaseStrategy):
    """
    覆盖优先贪心:
    1. 先确保每个 task 至少有一个骑手（覆盖率最大化）
    2. 剩下骑手槽位用来加 backup（低概率 task 优先）
    """

    def __init__(self, prob_threshold: float = 0.7):
        super().__init__("greedy_coverage")
        self.threshold = prob_threshold

    def solve(self, problem: Problem, time_budget_ms: float) -> StrategyResult:
        t0 = time.perf_counter()

        cands = problem.candidates
        tasks = problem.num_tasks
        couriers = problem.num_couriers
        n = len(cands)

        used_couriers = set()
        task_covered = [False] * tasks       # 至少一个骑手覆盖
        task_best_prob = [0.0] * tasks       # 最佳覆盖概率
        selected = []

        # Phase 1: 覆盖所有 task — 贪心选 score 最低且覆盖新 task 的候选
        # 按 score 排序，优先选能覆盖"尚未被覆盖 task"的候选
        order = sorted(range(n), key=lambda i: cands[i].score)

        for idx in order:
            cand = cands[idx]
            if cand.courier_id in used_couriers:
                continue
            # 检查是否覆盖了新 task
            covers_new = any(
                not task_covered[problem.task_id_to_idx[t]]
                for t in cand.task_ids
            )
            if covers_new or len(selected) < len(used_couriers) + 1:
                used_couriers.add(cand.courier_id)
                selected.append(idx)
                for t in cand.task_ids:
                    ti = problem.task_id_to_idx[t]
                    task_covered[ti] = True
                    task_best_prob[ti] = max(
                        task_best_prob[ti],
                        1 - (1 - task_best_prob[ti]) * (1 - cand.willingness)
                    )

        # Phase 2: 用剩余骑手槽位给低概率 task 加 backup
        remaining_couriers = [
            cid for cid in problem.courier_ids if cid not in used_couriers
        ]
        for cid in remaining_couriers:
            ci = problem.courier_id_to_idx[cid]
            candidates_for_courier = problem.courier_to_candidates[ci]
            if not candidates_for_courier:
                continue

            # 选能最大提升覆盖概率的候选
            best_idx = None
            best_gain = 0.0
            for idx in candidates_for_courier:
                cand = cands[idx]
                gain = 0.0
                for t in cand.task_ids:
                    ti = problem.task_id_to_idx[t]
                    current_p = task_best_prob[ti]
                    new_p = 1 - (1 - current_p) * (1 - cand.willingness)
                    gain += new_p - current_p
                if gain > best_gain:
                    best_gain = gain
                    best_idx = idx

            if best_idx is not None:
                cand = cands[best_idx]
                used_couriers.add(cand.courier_id)
                selected.append(best_idx)
                for t in cand.task_ids:
                    ti = problem.task_id_to_idx[t]
                    task_best_prob[ti] = 1 - (1 - task_best_prob[ti]) * (1 - cand.willingness)

        elapsed = (time.perf_counter() - t0) * 1000
        solution = Solution(selected=selected)
        Evaluator(problem).evaluate(solution)

        return StrategyResult(strategy_name=self.name, solution=solution, elapsed_ms=elapsed)
