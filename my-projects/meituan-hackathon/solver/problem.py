"""
外卖配送任务分配 — 候选集模型

实际数据格式:
- 每条候选 = (task_bundle, courier, score, willingness)
- task_bundle: 1~2 个 task ID 的元组（预计算的合单组合）
- courier: 骑手 ID
- score: 该分配的总分（越小越好）
- willingness: 骑手对该 bundle 的接单概率 [0, 1]

约束:
- 每个骑手最多被分配一个候选
- 同一个 task 可以被多个候选覆盖（多派——最先接的骑手获得订单）

目标 (lexicographic):
1. 最大化期望接单数 = Σ_t P(task t 被至少一个骑手接起)
2. 最小化总分数 = Σ 被选中候选的 score
"""

from dataclasses import dataclass, field
from typing import Optional
import numpy as np


@dataclass
class Candidate:
    """一个候选分配: 把 task_bundle 分配给 courier"""
    task_ids: tuple[str, ...]   # 1~2 个 task ID
    courier_id: str
    score: float
    willingness: float          # 接单概率 [0, 1]

    @property
    def bundle_size(self) -> int:
        return len(self.task_ids)


@dataclass
class Problem:
    """
    一个测试用例的完整描述

    candidates: 所有候选分配
    task_ids: 所有 task ID 列表
    courier_ids: 所有骑手 ID 列表
    tasks_to_candidates: task_id → 包含该 task 的候选 index 列表
    courier_to_candidates: courier_id → 该骑手的候选 index 列表
    """
    candidates: list[Candidate]
    task_ids: list[str]
    courier_ids: list[str]
    tasks_to_candidates: list[list[int]]        # task_idx → [candidate_idx, ...]
    courier_to_candidates: list[list[int]]      # courier_idx → [candidate_idx, ...]
    task_id_to_idx: dict[str, int] = field(default_factory=dict)
    courier_id_to_idx: dict[str, int] = field(default_factory=dict)

    @property
    def num_tasks(self) -> int:
        return len(self.task_ids)

    @property
    def num_couriers(self) -> int:
        return len(self.courier_ids)

    @property
    def num_candidates(self) -> int:
        return len(self.candidates)


@dataclass
class Solution:
    """
    分配方案

    selected: 被选中的候选 index 列表
    courier_assignment: courier_idx → candidate_idx or -1
    """
    selected: list[int]

    # 缓存值（由 Evaluator 填充）
    num_accepted: int = 0       # 期望接单数 (取整)
    total_score: float = 0.0    # 总分数
    task_probs: list[float] = field(default_factory=list)  # 每个 task 的被接概率

    @classmethod
    def empty(cls) -> "Solution":
        return cls(selected=[])

    def is_better_than(self, other: "Solution") -> bool:
        """lexicographic: 先比接单数（多好），再比分数（低好）"""
        if self.num_accepted != other.num_accepted:
            return self.num_accepted > other.num_accepted
        return self.total_score < other.total_score

    def clone(self) -> "Solution":
        return Solution(
            selected=list(self.selected),
            num_accepted=self.num_accepted,
            total_score=self.total_score,
            task_probs=list(self.task_probs),
        )
