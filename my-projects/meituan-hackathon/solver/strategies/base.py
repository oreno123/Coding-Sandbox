"""
策略基类 — 所有求解策略的抽象接口
"""

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from ..problem import Problem, Solution


@dataclass
class StrategyResult:
    """一次策略执行的结果"""
    strategy_name: str
    solution: Solution
    elapsed_ms: float
    converged: bool = True


class BaseStrategy(ABC):
    """求解策略抽象基类"""

    def __init__(self, name: str = "base"):
        self.name = name

    @abstractmethod
    def solve(self, problem: Problem, time_budget_ms: float) -> StrategyResult:
        """
        在 time_budget_ms 毫秒内求解

        返回 StrategyResult。若 time_budget_ms 为 inf，则运行到自然结束。
        """
        ...

    def __repr__(self) -> str:
        return f"Strategy({self.name})"


class AnytimeStrategy(BaseStrategy):
    """
    支持随时中断的策略 — 基类提供
    - run_improvement_loop(start_solution, problem, deadline)
    子类只需实现 improve_one_step()
    """

    def improve_one_step(self, solution: Solution, problem: Problem) -> Solution:
        """执行一步改进，返回新解（可能相同）"""
        raise NotImplementedError

    def solve(self, problem: Problem, time_budget_ms: float) -> StrategyResult:
        t0 = time.perf_counter()
        budget_s = time_budget_ms / 1000.0
        deadline = t0 + budget_s

        solution = self.build_initial(problem)
        iteration = 0
        converged = True

        while time.perf_counter() < deadline:
            improved = self.improve_one_step(solution, problem)
            if improved is solution or improved.num_accepted <= solution.num_accepted:
                # 没改进
                if iteration > 100 and improved is solution:
                    converged = False
                break
            solution = improved
            iteration += 1

        elapsed = (time.perf_counter() - t0) * 1000
        return StrategyResult(
            strategy_name=self.name,
            solution=solution,
            elapsed_ms=elapsed,
            converged=converged,
        )

    def build_initial(self, problem: Problem) -> Solution:
        """构建初始可行解（子类可覆盖）"""
        return Solution.empty(problem.num_orders)
