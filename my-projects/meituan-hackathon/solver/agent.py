"""
AutoSolver Agent — 顶层入口（候选集模型版本）

组装策略池 + 控制器，暴露统一的 solve() 接口。
"""

from .problem import Problem, Solution
from .controller import StrategyController
from .strategies.base import BaseStrategy
from .strategies.greedy import GreedyScore, GreedyDensity, GreedyCoverage
from .strategies.metaheuristic import SimulatedAnnealing, LocalSearch


class AutoSolverAgent:
    """AutoSolver Agent: 自主策略探索求解器"""

    def __init__(self, time_budget_ms: float = 10_000):
        self.time_budget_ms = time_budget_ms
        self.controller = StrategyController(total_time_ms=time_budget_ms)
        self._strategies: list[BaseStrategy] = []

    def setup(self) -> "AutoSolverAgent":
        defaults = [
            GreedyScore(),           # 官方基线
            GreedyDensity(),         # 性价比贪心
            GreedyCoverage(),        # 覆盖优先 + backup
            SimulatedAnnealing(),    # 模拟退火
            LocalSearch(),           # 局部搜索
        ]
        self.controller.register_all(defaults)
        self._strategies = defaults
        return self

    def add_strategy(self, strategy: BaseStrategy) -> None:
        self._strategies.append(strategy)
        self.controller.register(strategy)

    def solve(self, problem: Problem) -> Solution:
        return self.controller.run(problem)

    def report(self) -> str:
        return self.controller.summary()

    @property
    def best_solution(self) -> Solution | None:
        return self.controller.best_solution


def create_agent(time_budget_ms: float = 10_000) -> AutoSolverAgent:
    return AutoSolverAgent(time_budget_ms=time_budget_ms).setup()
