"""
元启发式策略 — 基于候选集模型

- SimulatedAnnealing: 从贪心解出发，用候选替换扰动
- LocalSearch: 爬山法，尝试替换/增加候选
"""

import time
import random
import math
import numpy as np
from .base import BaseStrategy, StrategyResult
from ..problem import Problem, Solution, Candidate
from ..evaluator import Evaluator


class SimulatedAnnealing(BaseStrategy):
    """
    模拟退火: 在候选集上搜索

    扰动操作:
    1. 替换: 随机选一个骑手，替换其候选
    2. 添加: 随机添加一个候选（用空闲骑手）
    3. 移除: 随机移除一个候选
    4. 交换: 两个骑手交换候选
    """

    def __init__(self, T_start: float = 200, T_end: float = 0.1, alpha: float = 0.97):
        super().__init__("simulated_annealing")
        self.T_start = T_start
        self.T_end = T_end
        self.alpha = alpha

    def solve(self, problem: Problem, time_budget_ms: float) -> StrategyResult:
        t0 = time.perf_counter()
        deadline = t0 + time_budget_ms / 1000.0
        evaluator = Evaluator(problem)
        cands = problem.candidates
        n_couriers = problem.num_couriers

        # 初始解: 贪心密度
        from .greedy import GreedyDensity
        init_result = GreedyDensity().solve(problem, min(time_budget_ms * 0.1, 500))
        current = init_result.solution.clone()
        evaluator.evaluate(current)
        current_q = evaluator.quality(current)

        best = current.clone()
        best_q = current_q

        # 构建 courier → candidate 映射
        courier_to_cand = [-1] * n_couriers
        selected_set = set(current.selected)
        for idx in current.selected:
            c = cands[idx]
            ci = problem.courier_id_to_idx[c.courier_id]
            courier_to_cand[ci] = idx

        T = self.T_start
        stuck = 0

        while time.perf_counter() < deadline:
            neighbor_selected = self._perturb(
                current.selected, problem, courier_to_cand, selected_set
            )
            if neighbor_selected is None:
                T *= self.alpha
                continue

            neighbor = Solution(selected=neighbor_selected)
            evaluator.evaluate(neighbor)
            neighbor_q = evaluator.quality(neighbor)

            delta = neighbor_q - current_q
            if delta < 0 or (T > 0.01 and random.random() < math.exp(-delta / T)):
                current = neighbor
                current_q = neighbor_q
                selected_set = set(neighbor_selected)
                # 更新 courier_to_cand
                courier_to_cand = [-1] * n_couriers
                for idx in neighbor_selected:
                    c = cands[idx]
                    ci = problem.courier_id_to_idx[c.courier_id]
                    courier_to_cand[ci] = idx

                if current_q < best_q:
                    best = current.clone()
                    best_q = current_q
                    stuck = 0
                else:
                    stuck += 1
            else:
                stuck += 1

            T *= self.alpha

            if stuck > 80:
                T = min(T * 3, self.T_start * 0.5)
                stuck = 0
            if T < self.T_end:
                T = self.T_start * 0.3
                if time.perf_counter() + 0.3 > deadline:
                    break

        elapsed = (time.perf_counter() - t0) * 1000
        return StrategyResult(strategy_name=self.name, solution=best, elapsed_ms=elapsed,
                              converged=(T < self.T_end))

    def _perturb(
        self, selected: list[int], problem: Problem,
        courier_to_cand: list[int], selected_set: set[int],
    ) -> list[int] | None:
        """生成邻域解的 selected 列表"""
        ops = [
            self._replace, self._add, self._remove, self._exchange,
        ]
        op = random.choice(ops)
        return op(selected, problem, courier_to_cand, selected_set)

    def _replace(self, selected, problem, c2c, sset):
        """替换一个骑手的候选"""
        # 找一个已分配的骑手
        used_couriers = [
            ci for ci, cand_idx in enumerate(c2c) if cand_idx >= 0
        ]
        if not used_couriers:
            return None
        ci = random.choice(used_couriers)
        old_idx = c2c[ci]
        cands_for_c = problem.courier_to_candidates[ci]
        other_candidates = [idx for idx in cands_for_c if idx != old_idx]
        if not other_candidates:
            return None
        new_idx = random.choice(other_candidates)
        new_selected = [new_idx if x == old_idx else x for x in selected]
        return new_selected

    def _add(self, selected, problem, c2c, sset):
        """添加一个候选（用空闲骑手）"""
        free_couriers = [ci for ci, idx in enumerate(c2c) if idx < 0]
        if not free_couriers:
            return None
        ci = random.choice(free_couriers)
        cands_for_c = problem.courier_to_candidates[ci]
        if not cands_for_c:
            return None
        new_idx = random.choice(cands_for_c)
        return selected + [new_idx]

    def _remove(self, selected, problem, c2c, sset):
        """移除一个候选"""
        if not selected:
            return None
        idx_to_remove = random.choice(selected)
        return [x for x in selected if x != idx_to_remove]

    def _exchange(self, selected, problem, c2c, sset):
        """两个骑手交换候选"""
        used = [ci for ci, idx in enumerate(c2c) if idx >= 0]
        if len(used) < 2:
            return None
        ci1, ci2 = random.sample(used, 2)
        cands1 = problem.courier_to_candidates[ci1]
        cands2 = problem.courier_to_candidates[ci2]
        old1 = c2c[ci1]
        old2 = c2c[ci2]

        # 尝试从对方候选池中选
        new1_cands = [x for x in cands1 if x != old1]
        new2_cands = [x for x in cands2 if x != old2]
        if not new1_cands and not new2_cands:
            return None

        new_selected = list(selected)
        if new1_cands and random.random() < 0.5:
            new_selected = [random.choice(new1_cands) if x == old1 else x for x in new_selected]
        if new2_cands:
            new_selected = [random.choice(new2_cands) if x == old2 else x for x in new_selected]
        return new_selected


class LocalSearch(BaseStrategy):
    """局部搜索: 对当前解的每个骑手尝试所有候选，选最佳改进"""

    def __init__(self, max_iter: int = 3):
        super().__init__("local_search")
        self.max_iter = max_iter

    def solve(self, problem: Problem, time_budget_ms: float) -> StrategyResult:
        t0 = time.perf_counter()
        deadline = t0 + time_budget_ms / 1000.0
        evaluator = Evaluator(problem)
        cands = problem.candidates
        n_couriers = problem.num_couriers

        # 从贪心密度出发
        from .greedy import GreedyDensity
        init_result = GreedyDensity().solve(problem, min(time_budget_ms * 0.05, 300))
        best = init_result.solution.clone()
        evaluator.evaluate(best)
        best_q = evaluator.quality(best)

        current = best.clone()
        current_q = best_q
        selected_set = set(current.selected)

        for _ in range(self.max_iter):
            if time.perf_counter() > deadline:
                break
            improved = False

            # 尝试替换每个骑手的候选
            for old_idx in list(current.selected):
                if time.perf_counter() > deadline:
                    break
                cand = cands[old_idx]
                ci = problem.courier_id_to_idx[cand.courier_id]
                cands_for_c = problem.courier_to_candidates[ci]

                for new_idx in cands_for_c:
                    if new_idx == old_idx:
                        continue
                    new_selected = [new_idx if x == old_idx else x for x in current.selected]
                    neighbor = Solution(selected=new_selected)
                    evaluator.evaluate(neighbor)
                    nq = evaluator.quality(neighbor)
                    if nq < current_q:
                        current = neighbor
                        current_q = nq
                        if nq < best_q:
                            best = neighbor.clone()
                            best_q = nq
                        improved = True
                        break  # 找到改进就跳下一个骑手

            if not improved:
                break

        elapsed = (time.perf_counter() - t0) * 1000
        return StrategyResult(strategy_name=self.name, solution=best, elapsed_ms=elapsed)
