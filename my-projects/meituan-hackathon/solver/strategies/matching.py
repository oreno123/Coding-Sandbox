"""
匹配型策略: 将问题建模为二分图匹配/最小费用流

- HungarianStrategy: 经典的匈牙利算法（一对一匹配）
- MinCostFlowStrategy: 最小费用最大流（支持骑手多单）
"""

import time
import numpy as np
from .base import BaseStrategy, StrategyResult
from ..problem import Problem, Solution
from ..evaluator import Evaluator


class HungarianStrategy(BaseStrategy):
    """
    匈牙利算法: 将问题视为二分图最优匹配。

    适用于: 每个骑手只接一单（capacity=1）的场景。
    对于 capacity > 1 的骑手，会将其"复制"成多个虚拟骑手。
    """

    def __init__(self):
        super().__init__("hungarian")

    def solve(self, problem: Problem, time_budget_ms: float) -> StrategyResult:
        t0 = time.perf_counter()

        n, m = problem.shape
        scores = problem.scores
        probs = problem.accept_probs
        caps = problem.rider_capacities

        try:
            from scipy.optimize import linear_sum_assignment
        except ImportError:
            # scipy 不可用，用贪心兜底
            from .greedy import GreedyScore
            fallback = GreedyScore()
            result = fallback.solve(problem, time_budget_ms)
            result.strategy_name = self.name + "(fallback_greedy)"
            return result

        # 将骑手按 capacity 展开
        # rider j 有 cap[j] 个槽位 → 展开成 cap[j] 个虚拟骑手
        expanded_m = sum(caps)
        cost_matrix = np.full((n, expanded_m), fill_value=1e9, dtype=float)

        # rider_idx_map: expanded_col → (real_rider_id, slot_id)
        rider_idx_map = []
        expanded_col = 0
        for j in range(m):
            for slot in range(caps[j]):
                rider_idx_map.append(j)
                for i in range(n):
                    if probs[i][j] > 0:
                        # 用分数作为代价，不可行的 pair 代价极大
                        cost_matrix[i][expanded_col] = scores[i][j]
                expanded_col += 1

        # 如果订单多于槽位，补零行；如果槽位多于订单，补零列
        # 匈牙利算法要求方阵
        size = max(n, expanded_m)
        if size > n or size > expanded_m:
            padded = np.full((size, size), fill_value=1e9, dtype=float)
            padded[:n, :expanded_m] = cost_matrix
            cost_matrix = padded

        # 不可行 pair 设为大代价，匈牙利不会选
        row_ind, col_ind = linear_sum_assignment(cost_matrix)

        assignments = [[] for _ in range(n)]
        for i, c in zip(row_ind, col_ind):
            if i < n and c < expanded_m and cost_matrix[i, c] < 1e8:
                real_rider = rider_idx_map[c]
                assignments[i].append(real_rider)

        elapsed = (time.perf_counter() - t0) * 1000
        solution = Solution(assignments=assignments)
        Evaluator(problem).evaluate(solution)

        return StrategyResult(
            strategy_name=self.name,
            solution=solution,
            elapsed_ms=elapsed,
        )


class MinCostFlowStrategy(BaseStrategy):
    """
    最小费用流: 建模为 min-cost max-flow 问题。

    节点: source → orders → riders → sink
    边:
    - source → order i: capacity=1, cost=0
    - order i → rider j: capacity=1, cost=scores[i][j]
    - rider j → sink: capacity=caps[j], cost=0

    可以使用 networkx 或 OR-Tools 求解。
    """

    def __init__(self):
        super().__init__("min_cost_flow")

    def solve(self, problem: Problem, time_budget_ms: float) -> StrategyResult:
        t0 = time.perf_counter()

        try:
            import networkx as nx
        except ImportError:
            from .greedy import GreedyScore
            fallback = GreedyScore()
            result = fallback.solve(problem, time_budget_ms)
            result.strategy_name = self.name + "(fallback_greedy)"
            return result

        n, m = problem.shape
        scores = problem.scores
        probs = problem.accept_probs
        caps = problem.rider_capacities

        # 建图
        G = nx.DiGraph()
        SOURCE = "source"
        SINK = "sink"

        # source → orders
        for i in range(n):
            G.add_edge(SOURCE, f"o_{i}", capacity=1, weight=0)

        # orders → riders (只加可行 pair)
        for i in range(n):
            for j in range(m):
                if probs[i][j] > 0:
                    G.add_edge(f"o_{i}", f"r_{j}", capacity=1, weight=int(scores[i][j]))

        # riders → sink
        for j in range(m):
            G.add_edge(f"r_{j}", SINK, capacity=int(caps[j]), weight=0)

        # 求解
        try:
            flow_dict = nx.min_cost_flow(G)
        except nx.NetworkXError:
            # 问题无解/不可行，退回贪心
            from .greedy import GreedyScore
            fallback = GreedyScore()
            result = fallback.solve(problem, time_budget_ms)
            result.strategy_name = self.name + "(fallback_greedy)"
            return result

        assignments = [[] for _ in range(n)]
        for i in range(n):
            node = f"o_{i}"
            if node in flow_dict:
                for rider_node, flow_val in flow_dict[node].items():
                    if flow_val > 0 and rider_node.startswith("r_"):
                        j = int(rider_node.split("_")[1])
                        assignments[i].append(j)

        elapsed = (time.perf_counter() - t0) * 1000
        solution = Solution(assignments=assignments)
        Evaluator(problem).evaluate(solution)

        return StrategyResult(
            strategy_name=self.name,
            solution=solution,
            elapsed_ms=elapsed,
        )
