"""
美团 AI 黑客松 — AutoSolver Agent 入口

用法:
    python main.py large_seed301.txt
    python main.py large_seed301.txt --time 10 --verbose
    python main.py --test --cases 5
"""

import sys
import time
import argparse
from solver.problem import Problem, Solution, Candidate
from solver.agent import create_agent


# ============================================================
# 数据解析
# ============================================================

def parse_problem(input_text: str) -> Problem:
    """
    解析 TSV 格式输入

    格式: task_id_list\tcourier_id\ttotal_score\twillingness
      - task_id_list: "T0037,T0039" (逗号分隔的 task ID 字符串)
      - courier_id: "C028"
      - total_score: 浮点数
      - willingness: 浮点数 [0, 1]
    """
    lines = input_text.strip().splitlines()
    start = 1 if lines and lines[0].startswith("task_id_list") else 0

    candidates: list[Candidate] = []
    task_ids_set: set[str] = set()
    courier_ids_set: set[str] = set()

    for line in lines[start:]:
        line = line.strip()
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) < 4:
            continue

        task_id_str, courier_id, score_str, willingness_str = parts[:4]
        try:
            score = float(score_str)
            willingness = float(willingness_str)
        except ValueError:
            continue

        task_ids = tuple(t.strip() for t in task_id_str.split(","))
        candidates.append(Candidate(
            task_ids=task_ids,
            courier_id=courier_id.strip(),
            score=score,
            willingness=willingness,
        ))
        task_ids_set.update(task_ids)
        courier_ids_set.add(courier_id.strip())

    task_ids = sorted(task_ids_set)
    courier_ids = sorted(courier_ids_set)
    task_id_to_idx = {t: i for i, t in enumerate(task_ids)}
    courier_id_to_idx = {c: i for i, c in enumerate(courier_ids)}

    # 构建索引: task → candidate indices, courier → candidate indices
    num_tasks = len(task_ids)
    num_couriers = len(courier_ids)
    tasks_to_candidates: list[list[int]] = [[] for _ in range(num_tasks)]
    courier_to_candidates: list[list[int]] = [[] for _ in range(num_couriers)]

    for idx, cand in enumerate(candidates):
        ci = courier_id_to_idx[cand.courier_id]
        courier_to_candidates[ci].append(idx)
        for t in cand.task_ids:
            ti = task_id_to_idx[t]
            tasks_to_candidates[ti].append(idx)

    return Problem(
        candidates=candidates,
        task_ids=task_ids,
        courier_ids=courier_ids,
        tasks_to_candidates=tasks_to_candidates,
        courier_to_candidates=courier_to_candidates,
        task_id_to_idx=task_id_to_idx,
        courier_id_to_idx=courier_id_to_idx,
    )


# ============================================================
# 输出格式化（符合官方接口规范）
# ============================================================

def format_solution(solution: Solution, problem: Problem) -> list:
    """
    将 Solution 转为官方要求的输出格式:
    [(task_id_list_str, [courier_id, ...]), ...]
    """
    result = []
    for idx in solution.selected:
        cand = problem.candidates[idx]
        task_str = ",".join(cand.task_ids)
        result.append((task_str, [cand.courier_id]))
    return result


# ============================================================
# 测试数据生成（用官方 large_seed 的结构生成随机小样例）
# ============================================================

def generate_random_problem(
    num_tasks: int = 10,
    num_couriers: int = 20,
    seed: int = 42,
) -> Problem:
    """生成随机小测试用例（结构与官方数据一致）"""
    import numpy as np
    rng = np.random.default_rng(seed)

    task_ids = [f"T{i:04d}" for i in range(num_tasks)]
    courier_ids = [f"C{i:03d}" for i in range(num_couriers)]

    candidates = []
    for ci, courier in enumerate(courier_ids):
        for _ in range(rng.integers(50, 200)):  # 每个骑手 50-200 个候选
            bundle_size = 1 if rng.random() < 0.2 else 2
            task_sample = rng.choice(task_ids, size=min(bundle_size, num_tasks), replace=False)
            score = rng.uniform(10, 100)
            willingness = rng.uniform(0.01, 0.9)
            candidates.append(Candidate(
                task_ids=tuple(sorted(task_sample)),
                courier_id=courier,
                score=score,
                willingness=willingness,
            ))

    # 构建索引
    task_id_to_idx = {t: i for i, t in enumerate(task_ids)}
    courier_id_to_idx = {c: i for i, c in enumerate(courier_ids)}
    tasks_to_candidates: list[list[int]] = [[] for _ in range(num_tasks)]
    courier_to_candidates: list[list[int]] = [[] for _ in range(num_couriers)]

    for idx, cand in enumerate(candidates):
        ci = courier_id_to_idx[cand.courier_id]
        courier_to_candidates[ci].append(idx)
        for t in cand.task_ids:
            ti = task_id_to_idx[t]
            tasks_to_candidates[ti].append(idx)

    return Problem(
        candidates=candidates,
        task_ids=task_ids,
        courier_ids=courier_ids,
        tasks_to_candidates=tasks_to_candidates,
        courier_to_candidates=courier_to_candidates,
        task_id_to_idx=task_id_to_idx,
        courier_id_to_idx=courier_id_to_idx,
    )


# ============================================================
# CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="美团黑客松 AutoSolver Agent")
    parser.add_argument("input_file", nargs="?", help="TSV 输入文件路径")
    parser.add_argument("--test", action="store_true", help="跑内置随机测试")
    parser.add_argument("--cases", type=int, default=3, help="测试用例数量")
    parser.add_argument("--tasks", type=int, default=10, help="随机测试的 task 数")
    parser.add_argument("--couriers", type=int, default=20, help="随机测试的 courier 数")
    parser.add_argument("--time", type=float, default=10.0, help="每个用例的时间预算(秒)")
    parser.add_argument("--output", type=str, help="输出 JSON 文件路径")
    parser.add_argument("--verbose", action="store_true", help="打印详细报告")
    parser.add_argument("--weight", type=float, default=1e5,
                        help="质量权重: 1e6=接单优先, 1e5=平衡, 1e4=性价比优先")
    args = parser.parse_args()

    # 设置全局权重
    from solver.evaluator import Evaluator
    Evaluator.ACCEPTANCE_WEIGHT = args.weight

    if args.test:
        run_benchmark(args)
    elif args.input_file:
        run_single(args)
    else:
        parser.print_help()


def run_single(args):
    """求解单个输入文件"""
    with open(args.input_file, "r", encoding="utf-8") as f:
        input_text = f.read()

    problem = parse_problem(input_text)
    print(f"加载: {problem.num_tasks} tasks, {problem.num_couriers} couriers, "
          f"{problem.num_candidates} candidates")

    agent = create_agent(time_budget_ms=args.time * 1000)
    t0 = time.perf_counter()
    solution = agent.solve(problem)
    elapsed = time.perf_counter() - t0

    output = format_solution(solution, problem)
    print(f"求解完成, 耗时 {elapsed:.2f}s")
    print(f"期望接单: {solution.num_accepted:.1f}/{problem.num_tasks}, 总分: {solution.total_score:.1f}")
    print(f"选中候选: {len(output)}/{problem.num_couriers} couriers")

    if args.verbose:
        print(agent.report())

    # 输出前 10 个分配
    print("\n分配示例 (前10):")
    for task_str, courier_list in output[:10]:
        cand_indices = [i for i in solution.selected
                        if problem.candidates[i].courier_id == courier_list[0]]
        willingness = problem.candidates[cand_indices[0]].willingness if cand_indices else "?"
        print(f"  tasks=[{task_str}] → courier={courier_list[0]}, willingness={willingness}")

    if args.output:
        import json
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f"结果已写入 {args.output}")


def run_benchmark(args):
    """批量随机测试"""
    print(f"跑 {args.cases} 个随机测试用例 "
          f"({args.tasks} tasks x {args.couriers} couriers, {args.time}s/case)\n")

    results = []
    for case in range(args.cases):
        problem = generate_random_problem(
            num_tasks=args.tasks,
            num_couriers=args.couriers,
            seed=42 + case,
        )
        agent = create_agent(time_budget_ms=args.time * 1000)
        t0 = time.perf_counter()
        solution = agent.solve(problem)
        elapsed = time.perf_counter() - t0

        results.append({
            "case": case + 1,
            "accepted": solution.num_accepted,
            "score": solution.total_score,
            "time_s": elapsed,
        })
        print(f"Case {case+1:2d}: "
              f"接单 {solution.num_accepted:2d}/{problem.num_tasks:2d}, "
              f"分数 {solution.total_score:8.1f}, "
              f"耗时 {elapsed:.2f}s")

        if args.verbose:
            print(agent.report())
            print()

    import numpy as np
    avg_acc = np.mean([r["accepted"] for r in results])
    avg_score = np.mean([r["score"] for r in results])
    avg_time = np.mean([r["time_s"] for r in results])
    print(f"\n汇总: 平均接单 {avg_acc:.1f}, 平均分数 {avg_score:.1f}, 平均耗时 {avg_time:.2f}s")


# ============================================================
# 官方兼容接口: solve(input_text: str) -> list
# 用法: python3 judge_server.py --test main.py --case large_seed301.txt
# ============================================================

def solve(input_text: str) -> list:
    """
    AutoSolver 主入口（兼容官方 judge 接口）

    输入: TSV 格式文本 (task_id_list\tcourier_id\tscore\twillingness)
    输出: [(task_id_list_str, [courier_id, ...]), ...]
    """
    problem = parse_problem(input_text)
    agent = create_agent(time_budget_ms=10_000)
    solution = agent.solve(problem)
    return format_solution(solution, problem)


if __name__ == "__main__":
    main()
