"""
解评估器 — 基于候选集模型

对选中的候选集，计算:
- 期望接单数: Σ_t (1 - Π_{c 覆盖 t} (1 - w_c))
- 总分数: Σ_c score_c
- 骑手唯一性约束违规惩罚
"""

import numpy as np
from .problem import Problem, Solution


class Evaluator:
    def __init__(self, problem: Problem):
        self.p = problem

    def evaluate(self, solution: Solution) -> Solution:
        """计算 solution 的目标值，原地填充并返回"""
        selected = solution.selected
        tasks = self.p.num_tasks
        couriers = self.p.num_couriers
        cands = self.p.candidates

        # 检查骑手唯一性
        courier_used = [False] * couriers
        violations = 0
        for c_idx in selected:
            courier_idx = self._courier_idx(cands[c_idx].courier_id)
            if courier_used[courier_idx]:
                violations += 1
            else:
                courier_used[courier_idx] = True

        # 每个 task 的 (1 - willingness) 乘积
        prob_not = np.ones(tasks, dtype=float)

        total_score = 0.0
        for c_idx in selected:
            cand = cands[c_idx]
            total_score += cand.score
            w = cand.willingness
            for task_id in cand.task_ids:
                ti = self.p.task_id_to_idx[task_id]
                prob_not[ti] *= (1.0 - w)

        prob_accepted = 1.0 - prob_not
        expected_accepted = float(np.sum(prob_accepted))

        # 约束惩罚
        PENALTY = 1e9
        total_score += violations * PENALTY

        solution.num_accepted = expected_accepted   # 连续值，用于优化
        solution.total_score = total_score
        solution.task_probs = prob_accepted.tolist()
        return solution

    def _courier_idx(self, courier_id: str) -> int:
        return self.p.courier_id_to_idx[courier_id]

    ACCEPTANCE_WEIGHT = 1e5  # 质量权重: 1e6=接单优先, 1e5=平衡, 1e4=性价比

    def quality(self, solution: Solution) -> float:
        """标量质量: 越小越好 = -expected_accepted * W + total_score"""
        if solution.num_accepted == 0 and solution.total_score == 0:
            self.evaluate(solution)
        return -solution.num_accepted * self.ACCEPTANCE_WEIGHT + solution.total_score
