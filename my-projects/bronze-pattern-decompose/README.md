# 青铜/掐丝纹样 拆件工具（bronze-pattern-decompose）

把一张「金线纹样图」拆成**可复用的小组件** + **可重新上色的矢量**。
针对的就是「想拆图案里的小组件、SAM 精度不够、即梦去背景后填色又是问题」这个场景。

## 核心结论：别用 SAM

这是又细又密、左右对称、含大量重复回纹的**金丝线稿**，「小组件」是按纹样语义切的、
不是视觉显著物体 —— SAM（实例分割）方向就不对，怎么调精度都不够。

正确做法是**图像处理**链路：

```
颜色阈值分割  →  形态学清理  →  连通域 / 封闭格 / 对称  拆件  →  矢量化
```

关键观察：放大看，纹样是**双轮廓金丝**（掐丝/错金风格）。所以提取目标是「金丝本身」，
用颜色就能干净分割 —— 实测金线在 LAB 的黄色通道 `b*` 最高 +55，墨绿底 `b*≈−6`，**完美可分**。

## 怎么跑

```bash
# 默认跑深底原图（推荐，保真度最高、不依赖即梦）
python3 decompose.py --input input/pattern_dark.jpg --mode dark

# 自动判断深底/白底；白底或透明PNG也支持
python3 decompose.py --input input/xxx.png --mode auto

# 生成一页式可视化报告
python3 gallery.py        # → 打开 gallery.html
```

依赖：`numpy scipy scikit-image pillow matplotlib vtracer cairosvg`（均已装）。**不需要 cv2 / SAM**。

## 输出（`output/`）

| 目录 | 内容 | 解决什么 |
|---|---|---|
| `01_mask/` | 金丝二值掩膜（raw + 清理后） | 替代 SAM 抠图，干净可调 |
| `02_transparent/` | 整图去背景透明 PNG（保留金色 + 纯金重铸两版） | **替代即梦**，质量更高 |
| `03_vector/` | `wire_mono.svg`（金丝单色，改 `fill` 换色）、`pattern_color.svg`（彩色矢量） | **解决「填色」**：矢量后任意改色、无限缩放 |
| `04_connected/` | 连通域自然拆出的组件，各一张透明 PNG | 小组件提取（眼睛、回纹块、卷云…） |
| `05_cells/` | 金丝围成的「封闭格子」剪影，各一张 | 掐丝/景泰蓝**逐格填珐琅色**的单元 |
| `06_halves/` | 左右对称半 | 做一半镜像，工作量减半 |
| `visualizations/` | 掩膜对比、组件叠加图、填色示意、组件拼图 | 一眼看清拆得对不对 |
| `manifest.json` | 每个组件/格子的 bbox、面积 | 程序化后处理 |

本次结果：**连通域组件 35 块 · 封闭格子 44 个 · 对称轴 x=541**（图像正中 540，检测几乎完美）。

## 两种「填色」都覆盖了

- **给金丝换色** → 用 `03_vector/wire_mono.svg`，在 AI/Inkscape/浏览器里改 `fill` 即可。
- **往格子里填珐琅色** → `05_cells/` 每个格子是一个独立填色单元；`visualizations/03_cells_paint.png`
  就是把 44 格各上一色的成品示意。

## 关键函数（`decompose.py`，可改/可复用）

- `extract_wire_mask` — LAB 颜色阈值抠金丝（dark/white/带 alpha 自动适配）
- `clean_mask` — 闭运算补断点 + 去碎屑
- `decompose_connected` — 连通域拆件
- `extract_cells` — 封闭格子提取（填色单元）
- `find_symmetry_axis` / `split_halves` — 对称轴检测与切半
- `find_repeats` — **模板匹配找重复模块**：给一个组件 bbox，自动定位所有副本（归一化互相关 + 峰值检测）。
  适合「四角回纹方块」这类重复件批量提取。
- `mask_to_svg` / `color_to_svg` — vtracer 矢量化

## 调参 & 收尾建议

- 抠不干净 → 调 `extract_wire_mask` 里的 `b*`/`L` 阈值；碎屑多 → 调 `clean_mask` 的 `min_size`。
- 连通域过碎或过粘 → 调 `--min-comp-area`，或先对掩膜做一次更大半径闭运算把断笔连上。
- **一次性出设计素材**：自动拆 + 在 Illustrator/Inkscape 里手动选几下归组，是最省时的组合，
  不必追求纯自动。本工具已把 90% 的脏活（抠图/去背景/矢量化/分件）做掉。
- **做成通用工具**：`find_repeats` + 对称先验可进一步自动化「重复模块」识别。
