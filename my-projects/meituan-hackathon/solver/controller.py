"""
元控制器 — AutoSolver 的策略调度大脑

三阶段调度:
  Phase 1 (~15% 时间): 跑全部策略各一次，拿到多样性基线
  Phase 2 (~70% 时间): UCB 驱动的迭代改进，每个策略至少跑 2 次
  Phase 3 (~10% 时间): 用局部搜索精化当前最优解
  保留 ~5% 作为缓冲
"""

import time
import math
from dataclasses import dataclass
from typing import Optional

from .problem import Problem, Solution
from .evaluator import Evaluator
from .strategies.base import BaseStrategy, StrategyResult


@dataclass
class StrategyStats:
    strategy: BaseStrategy
    runs: int = 0
    total_time_ms: float = 0.0
    improvements: int = 0
    best_delta: float = 0.0
    avg_improvement: float = 0.0
    last_used: float = 0.0

    @property
    def improvement_rate(self) -> float:
        if self.runs == 0:
            return 1.0
        return self.improvements / self.runs

    def ucb_score(self, total_runs: int, exploration_weight: float = 1.0) -> float:
        if self.runs == 0:
            return float("inf")
        # 利用项 = 改善率 × 改善幅度（归一化），近期表现差则自然降低
        exploit = self.improvement_rate * min(self.avg_improvement, 1e6) / 1e6
        explore = exploration_weight * math.sqrt(
            math.log(total_runs + 1) / self.runs
        )
        return exploit + explore


class StrategyController:
    def __init__(self, total_time_ms: float = 10_000):
        self.total_time_ms = total_time_ms
        self.strategies: dict[str, StrategyStats] = {}

        self.best_solution: Optional[Solution] = None
        self.best_quality: float = float("inf")
        self.total_runs: int = 0
        self.start_time: float = 0.0
        self.history: list[dict] = []

        # 分类策略
        self.constructive_names: set[str] = set()
        self.improvement_names: set[str] = set()
        self._deadline: float = 0.0

    def register(self, strategy: BaseStrategy, category: str = "improvement") -> None:
        self.strategies[strategy.name] = StrategyStats(strategy=strategy)
        if category == "constructive":
            self.constructive_names.add(strategy.name)
        else:
            self.improvement_names.add(strategy.name)

    def register_all(self, strategies: list[BaseStrategy]) -> None:
        constructive = {"greedy_score", "greedy_density", "greedy_coverage"}
        for s in strategies:
            cat = "constructive" if s.name in constructive else "improvement"
            self.register(s, cat)

    # ============================================================
    # 主循环
    # ============================================================

    def run(self, problem: Problem) -> Solution:
        self.start_time = time.perf_counter()
        self._deadline = self.start_time + self.total_time_ms / 1000.0

        # —— Phase 1: 全策略基线 (15% 时间预算) ——
        phase1_end = self.start_time + self.total_time_ms * 0.15 / 1000.0
        self._run_phase1(problem, phase1_end)

        # —— Phase 2: UCB 迭代改进 (到 90% 时间) ——
        phase2_end = self.start_time + self.total_time_ms * 0.90 / 1000.0
        self._run_phase2(problem, phase2_end)

        # —— Phase 3: 精化 ——
        self._run_phase3(problem)

        return self.best_solution or Solution.empty(problem.num_orders)

    # ============================================================
    # Phase 实现
    # ============================================================

    def _run_phase1(self, problem: Problem, phase1_end: float) -> None:
        """跑全部策略各一次，建立基线"""
        all_stats = list(self.strategies.values())

        # 按名字排序保证确定性: 先构造型，后改进型
        all_stats.sort(key=lambda s: (s.strategy.name not in self.constructive_names, s.strategy.name))

        time_per = max(100, (phase1_end - time.perf_counter()) * 1000 / len(all_stats))

        for stats in all_stats:
            if time.perf_counter() > phase1_end:
                break
            budget = min(time_per, max(200, (phase1_end - time.perf_counter()) * 1000))
            if budget < 50:
                break
            result = self._run_strategy(stats, problem, budget)
            improved = self._update_best(result)
            self.history.append({
                "phase": 1, "strategy": stats.strategy.name,
                "elapsed_ms": result.elapsed_ms,
                "num_accepted": result.solution.num_accepted,
                "total_score": result.solution.total_score,
                "improved": improved,
            })

    def _run_phase2(self, problem: Problem, phase2_end: float) -> None:
        """UCB 驱动的迭代改进"""
        improvement_stats = [
            s for s in self.strategies.values()
            if s.strategy.name in self.improvement_names
        ]
        if not improvement_stats:
            improvement_stats = list(self.strategies.values())

        # 先给每个改进策略至少 1 次公平机会
        for stats in improvement_stats:
            if time.perf_counter() > phase2_end:
                return
            if stats.runs == 0:
                budget = min(1500, max(300, (phase2_end - time.perf_counter()) * 1000))
                result = self._run_strategy(stats, problem, budget)
                improved = self._update_best(result)
                self.history.append({
                    "phase": 2, "strategy": stats.strategy.name,
                    "elapsed_ms": result.elapsed_ms,
                    "num_accepted": result.solution.num_accepted,
                    "total_score": result.solution.total_score,
                    "improved": improved,
                })

        # UCB 选择循环
        while time.perf_counter() < phase2_end:
            remaining_ms = (phase2_end - time.perf_counter()) * 1000
            if remaining_ms < 150:
                break

            stats = self._select_ucb(improvement_stats)
            if stats is None:
                break

            # 时间预算: 剩余时间的 1/3，最多 2 秒
            budget = min(remaining_ms * 0.35, 2000)
            if budget < 100:
                break

            result = self._run_strategy(stats, problem, budget)
            improved = self._update_best(result)
            self.history.append({
                "phase": 2, "strategy": stats.strategy.name,
                "elapsed_ms": result.elapsed_ms,
                "num_accepted": result.solution.num_accepted,
                "total_score": result.solution.total_score,
                "improved": improved,
            })

    def _run_phase3(self, problem: Problem) -> None:
        """Phase 3: 局部搜索 + 智能 backup 补充"""
        remaining_ms = (self._deadline - time.perf_counter()) * 1000
        if remaining_ms < 100 or self.best_solution is None:
            return

        evaluator = Evaluator(problem)

        # Step 1: 在最优解上跑一次局部搜索
        for name in ("local_search", "simulated_annealing"):
            stats = self.strategies.get(name)
            if stats is not None:
                budget = min(remaining_ms * 0.4, 2000)
                result = self._run_strategy(stats, problem, budget)
                self._update_best(result)
                self.history.append({
                    "phase": 3, "strategy": stats.strategy.name,
                    "elapsed_ms": result.elapsed_ms,
                    "num_accepted": result.solution.num_accepted,
                    "total_score": result.solution.total_score,
                    "improved": self._is_current_best(result.solution),
                })
                break

        # Step 2: 用剩余空闲骑手给低概率 task 加 backup
        self._add_smart_backups(problem, evaluator)

    def _add_smart_backups(self, problem: Problem, evaluator) -> None:
        """对最优解中 P(accepted) < 0.85 的 task，用空闲骑手加 backup"""
        if self.best_solution is None:
            return

        solution = self.best_solution.clone()
        evaluator.evaluate(solution)
        cands = problem.candidates
        best_q = evaluator.quality(solution)

        used_couriers = set()
        for idx in solution.selected:
            used_couriers.add(cands[idx].courier_id)

        MIN_EFFICIENCY = 0.003  # ΔP / score 最小效率

        changed = True
        while changed:
            changed = False
            deadline = self._deadline - 0.05  # 留 50ms 缓冲
            if time.perf_counter() > deadline:
                break

            task_probs = solution.task_probs
            # 找到 P 低于 0.85 的 task，按 P 升序
            low_tasks = [
                ti for ti, p in enumerate(task_probs) if p < 0.85
            ]
            low_tasks.sort(key=lambda ti: task_probs[ti])

            for ti in low_tasks:
                best_cand_idx = None
                best_efficiency = MIN_EFFICIENCY

                for cand_idx in problem.tasks_to_candidates[ti]:
                    cand = cands[cand_idx]
                    if cand.courier_id in used_couriers:
                        continue
                    improvement = task_probs[ti] * cand.willingness
                    # improvement = (1-(1-P)*(1-w)) - P = P*w (for backup to a covered task)
                    # Wait, that's wrong. Let me recalculate:
                    # new_P = 1 - (1-P)*(1-w) = 1 - (1-P-w+Pw) = P + w - Pw
                    # improvement = new_P - P = w - P*w = w*(1-P)
                    improvement = cand.willingness * (1 - task_probs[ti])
                    efficiency = improvement / (cand.score + 0.01)
                    if efficiency > best_efficiency:
                        best_efficiency = efficiency
                        best_cand_idx = cand_idx

                if best_cand_idx is not None and time.perf_counter() < deadline:
                    cand = cands[best_cand_idx]
                    new_selected = solution.selected + [best_cand_idx]
                    neighbor = Solution(selected=new_selected)
                    evaluator.evaluate(neighbor)
                    nq = evaluator.quality(neighbor)
                    if nq < best_q:
                        solution = neighbor
                        best_q = nq
                        used_couriers.add(cand.courier_id)
                        changed = True
                        break  # 重新扫描 task 列表

        if solution is not self.best_solution and len(solution.selected) > len(self.best_solution.selected):
            self.best_solution = solution.clone()
            self.best_quality = best_q
            self.history.append({
                "phase": 3, "strategy": "smart_backup",
                "elapsed_ms": 0,
                "num_accepted": solution.num_accepted,
                "total_score": solution.total_score,
                "improved": True,
            })

    # ============================================================
    # 策略选择与执行
    # ============================================================

    def _select_ucb(self, candidates: list[StrategyStats]) -> Optional[StrategyStats]:
        now = time.perf_counter()
        best_score = -1.0
        best_stats = None
        for stats in candidates:
            # 冷却: 刚跑完 200ms 内不重复选
            if stats.last_used > 0 and (now - stats.last_used) < 0.2:
                continue
            score = stats.ucb_score(self.total_runs)
            if score > best_score:
                best_score = score
                best_stats = stats
        # 如果全在冷却，选 UCB 最高的
        if best_stats is None and candidates:
            for stats in candidates:
                score = stats.ucb_score(self.total_runs)
                if score > best_score:
                    best_score = score
                    best_stats = stats
        return best_stats

    def _run_strategy(
        self, stats: StrategyStats, problem: Problem, time_budget_ms: float
    ) -> StrategyResult:
        result = stats.strategy.solve(problem, time_budget_ms)
        stats.runs += 1
        stats.total_time_ms += result.elapsed_ms
        stats.last_used = time.perf_counter()
        self.total_runs += 1
        return result

    def _update_best(self, result: StrategyResult) -> bool:
        sol = result.solution
        quality = -sol.num_accepted * 1e5 + sol.total_score

        if self.best_solution is None or quality < self.best_quality:
            delta = self.best_quality - quality if self.best_solution else float("inf")
            self.best_solution = sol.clone()
            self.best_quality = quality

            if result.strategy_name in self.strategies:
                stats = self.strategies[result.strategy_name]
                stats.improvements += 1
                stats.best_delta = max(stats.best_delta, delta)
                n = stats.improvements
                stats.avg_improvement = (
                    stats.avg_improvement * (n - 1) + min(delta, 1e6)
                ) / n

            return True
        return False

    def _is_current_best(self, solution: Solution) -> bool:
        if self.best_solution is None:
            return False
        return (solution.num_accepted == self.best_solution.num_accepted
                and abs(solution.total_score - self.best_solution.total_score) < 0.01)

    # ============================================================
    # 报告
    # ============================================================

    def summary(self) -> str:
        lines = ["[AutoSolver 执行报告]"]
        total_time = sum(h["elapsed_ms"] for h in self.history)
        lines.append(f"总耗时: {total_time:.0f}ms | 策略执行次数: {len(self.history)}")
        if self.best_solution:
            lines.append(
                f"最优解: 接单 {self.best_solution.num_accepted} 单, "
                f"总分 {self.best_solution.total_score:.1f}"
            )
        lines.append("策略统计:")
        for name, stats in self.strategies.items():
            if stats.runs > 0:
                lines.append(
                    f"  {name:30s} | runs={stats.runs:2d} | "
                    f"improved={stats.improvements:2d} | "
                    f"avg_delta={stats.avg_improvement:.0f} | "
                    f"time={stats.total_time_ms:.0f}ms"
                )
        lines.append("执行时间线:")
        for h in self.history:
            marker = " *" if h["improved"] else "  "
            lines.append(
                f"  [{h['phase']}]{marker} {h['strategy']:30s} "
                f"→ accepted={h['num_accepted']} score={h['total_score']:.1f}"
            )
        return "\n".join(lines)
