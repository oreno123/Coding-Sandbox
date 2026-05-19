"""
Backup 优化策略: 在已有解的基础上，用空闲骑手给低概率 task 加 backup
"""

import time
from .base import BaseStrategy, StrategyResult
from ..problem import Problem, Solution
from ..evaluator import Evaluator


class BackupOptimizer(BaseStrategy):
    """
    Greedy backup: 对 P(accepted) < threshold 的 task，
    从未使用的骑手中选最佳候选加入。
    """

    def __init__(self, prob_threshold: float = 0.75, min_efficiency: float = 0.005):
        """
        prob_threshold: P(accepted) 低于此值的 task 才考虑加 backup
        min_efficiency: 最小效率 = ΔP / score (0.005 = 0.5% improvement per score point)
        """
        super().__init__("backup_optimizer")
        self.threshold = prob_threshold
        self.min_efficiency = min_efficiency

    def solve(self, problem: Problem, time_budget_ms: float) -> StrategyResult:
        t0 = time.perf_counter()
        deadline = t0 + time_budget_ms / 1000.0
        evaluator = Evaluator(problem)
        cands = problem.candidates

        # 从贪心密度出发
        from .greedy import GreedyDensity
        init_result = GreedyDensity().solve(problem, min(time_budget_ms * 0.1, 300))
        current = init_result.solution.clone()
        evaluator.evaluate(current)
        best = current.clone()
        best_q = evaluator.quality(best)

        used_couriers = set()
        for idx in current.selected:
            used_couriers.add(cands[idx].courier_id)

        # 迭代: 每次找一个最需要 backup 的 task，加一个骑手
        changed = True
        while changed and time.perf_counter() < deadline:
            changed = False
            task_probs = best.task_probs

            # 找到 P 最低的 tasks
            low_tasks = [
                ti for ti, p in enumerate(task_probs)
                if p < self.threshold
            ]
            low_tasks.sort(key=lambda ti: task_probs[ti])  # 最低优先

            for ti in low_tasks:
                task_id = problem.task_ids[ti]
                # 找能覆盖这个 task 且骑手未使用的候选
                best_candidate_idx = None
                best_improvement = 0.0

                for cand_idx in problem.tasks_to_candidates[ti]:
                    cand = cands[cand_idx]
                    if cand.courier_id in used_couriers:
                        continue
                    # 计算加入后的改进
                    new_prob = 1 - (1 - task_probs[ti]) * (1 - cand.willingness)
                    improvement = new_prob - task_probs[ti]
                    # 性价比 = improvement / score
                    efficiency = improvement / (cand.score + 0.01)
                    if efficiency > best_improvement:
                        best_improvement = efficiency
                        best_candidate_idx = cand_idx

                if best_candidate_idx is not None and best_improvement >= self.min_efficiency:
                    cand = cands[best_candidate_idx]
                    new_selected = best.selected + [best_candidate_idx]
                    neighbor = Solution(selected=new_selected)
                    evaluator.evaluate(neighbor)
                    nq = evaluator.quality(neighbor)
                    if nq < best_q:
                        best = neighbor.clone()
                        best_q = nq
                        used_couriers.add(cand.courier_id)
                        changed = True
                        break  # 重新扫描

        elapsed = (time.perf_counter() - t0) * 1000
        return StrategyResult(strategy_name=self.name, solution=best, elapsed_ms=elapsed)
