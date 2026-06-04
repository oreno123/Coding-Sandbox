#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
青铜/掐丝纹样 拆件工具  (bronze-pattern-decompose)
====================================================
把一张"金线纹样图"拆成可复用的小组件 + 可重新上色的矢量。

为什么不用 SAM:
    这是又细又密、左右对称、含大量重复回纹的"金丝线稿",
    "小组件"是按纹样语义切的,不是视觉显著物体 —— SAM(实例分割)不对路。
    正确做法 = 颜色阈值分割 + 形态学清理 + 连通域/封闭格/对称 拆件 + 矢量化。

流水线:
    1. extract_wire_mask  按 LAB 颜色阈值抠出"金丝"二值掩膜(深底图);白底/透明图走 alpha/Otsu
    2. clean_mask         形态学闭运算补断点 + 去碎屑
    3. 输出:
       02_transparent  整图去背景透明 PNG(保留原金色,质量高于即梦)
       03_vector       金丝单色 SVG + 彩色 SVG(矢量化 → 任意重新上色,解决"填色")
       04_connected    连通域自然拆出的组件(透明 PNG)
       05_cells        金丝围成的"封闭格子"(掐丝/景泰蓝要填珐琅色的那一个个小格)
       06_halves       利用左右对称切出的左右半
       visualizations  叠加可视化 + paint-by-number 上色示意 + 组件拼图
       manifest.json   每个组件的 bbox/面积清单

用法:
    python3 decompose.py                                  # 默认跑 input/pattern_dark.jpg
    python3 decompose.py --input input/xxx.jpg --mode dark
    python3 decompose.py --input input/yyy.png --mode auto
"""

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from skimage import color, morphology, measure, filters, segmentation, feature
from scipy import ndimage as ndi

try:
    import vtracer
    HAS_VTRACER = True
except Exception:
    HAS_VTRACER = False


# --------------------------------------------------------------------------- #
# 1. 读图 + 抠金丝掩膜
# --------------------------------------------------------------------------- #
def load_image(path):
    """返回 (rgb float[0,1] HxWx3, alpha 或 None)。"""
    im = Image.open(path)
    alpha = None
    if im.mode == "RGBA":
        a = np.asarray(im)[..., 3]
        if (a < 250).mean() > 0.05:          # 确实存在透明区域才当作 alpha 掩膜
            alpha = a
    rgb = np.asarray(im.convert("RGB")) / 255.0
    return rgb, alpha


def detect_mode(rgb):
    """根据整体亮度自动判断 dark / white。"""
    L = color.rgb2lab(rgb)[..., 0]
    return "dark" if np.median(L) < 50 else "white"


def extract_wire_mask(rgb, mode="auto", alpha=None):
    """
    抠出"金丝"二值掩膜。
    - dark : 金线在 LAB 中 L 高且 b*(黄度)高,而墨绿底 b*<0 → 黄色通道完美可分
    - white: 金/棕线比白底暗 → 灰度 Otsu 取暗部
    - 若图本身带 alpha(如即梦透明输出),直接用 alpha 当掩膜
    """
    if alpha is not None:
        return (alpha > 128)

    if mode == "auto":
        mode = detect_mode(rgb)

    lab = color.rgb2lab(rgb)
    L, b = lab[..., 0], lab[..., 2]

    if mode == "dark":
        # 自适应: b* 用 Otsu 但不低于 8;L 给个下限避免暗噪点
        b_thr = max(8.0, filters.threshold_otsu(b))
        mask = (b > b_thr) & (L > 30)
    else:  # white
        gray = color.rgb2gray(rgb)
        thr = filters.threshold_otsu(gray)
        mask = gray < thr                      # 线条比白底暗
    return mask


def clean_mask(mask, close_radius=1, min_size=60):
    """闭运算补抗锯齿断点 → 去小碎屑。"""
    m = morphology.binary_closing(mask, morphology.disk(close_radius))
    m = morphology.remove_small_objects(m, min_size=min_size)
    m = morphology.remove_small_holes(m, area_threshold=8)   # 填掉极小针孔
    return m


# --------------------------------------------------------------------------- #
# 2. 各种拆件策略
# --------------------------------------------------------------------------- #
def decompose_connected(mask, min_area=200):
    """连通域:自然分离的纹样各成一件。返回 [(label_mask, bbox, area), ...]。"""
    lab = measure.label(mask, connectivity=2)
    out = []
    for r in measure.regionprops(lab):
        if r.area >= min_area:
            out.append((lab == r.label, r.bbox, int(r.area)))
    out.sort(key=lambda t: t[2], reverse=True)
    return out


def extract_cells(mask, min_area=40, max_area_frac=0.25):
    """
    金丝围成的"封闭格子"= 掩膜取反后、不与画面边框相连的连通域。
    这些就是掐丝/景泰蓝里要逐格填珐琅色的天然小单元。
    """
    inv = ~mask
    interior = segmentation.clear_border(inv)   # 去掉与边框相连的外部背景
    lab = measure.label(interior, connectivity=1)
    H, W = mask.shape
    cells = []
    for r in measure.regionprops(lab):
        if min_area <= r.area <= max_area_frac * H * W:
            cells.append((lab == r.label, r.bbox, int(r.area)))
    cells.sort(key=lambda t: t[2], reverse=True)
    return cells


def find_symmetry_axis(mask, search=40):
    """在图像中线附近搜索使左右镜像重叠最大的竖轴列号。"""
    H, W = mask.shape
    c0 = W // 2
    best_x, best_score = c0, -1
    for x in range(c0 - search, c0 + search + 1):
        half = min(x, W - x)
        if half < W // 4:
            continue
        left = mask[:, x - half:x]
        right = mask[:, x:x + half][:, ::-1]
        score = np.logical_and(left, right).sum()
        if score > best_score:
            best_score, best_x = score, x
    return best_x


def split_halves(mask, axis):
    left = mask.copy();  left[:, axis:] = False
    right = mask.copy(); right[:, :axis] = False
    return left, right


def find_repeats(mask, template_bbox, threshold=0.6, min_dist=20):
    """
    模板匹配:给一个组件的 bbox 当模板,自动找出所有重复副本(归一化互相关 + NMS)。
    template_bbox = (minr, minc, maxr, maxc)
    返回匹配中心点列表 [(r, c, score), ...]
    """
    m = mask.astype(float)
    r0, c0, r1, c1 = template_bbox
    tmpl = m[r0:r1, c0:c1]
    if tmpl.shape[0] < 3 or tmpl.shape[1] < 3:
        return []
    res = feature.match_template(m, tmpl, pad_input=True)
    peaks = feature.peak_local_max(res, threshold_abs=threshold, min_distance=min_dist)
    return [(int(p[0]), int(p[1]), float(res[p[0], p[1]])) for p in peaks]


# --------------------------------------------------------------------------- #
# 3. 导出
# --------------------------------------------------------------------------- #
def save_transparent(rgb, comp_mask, bbox, path, solid_color=None, pad=4):
    """把一个组件存成透明 PNG(裁到 bbox,alpha=掩膜)。"""
    H, W = comp_mask.shape
    r0, c0, r1, c1 = bbox
    r0, c0 = max(0, r0 - pad), max(0, c0 - pad)
    r1, c1 = min(H, r1 + pad), min(W, c1 + pad)
    m = comp_mask[r0:r1, c0:c1]
    if solid_color is None:
        crop = (rgb[r0:r1, c0:c1] * 255).astype(np.uint8)
    else:
        crop = np.zeros((*m.shape, 3), np.uint8)
        crop[m] = solid_color
    rgba = np.dstack([crop, (m * 255).astype(np.uint8)])
    Image.fromarray(rgba, "RGBA").save(path)


def save_silhouette(comp_mask, bbox, path, fill=(60, 130, 200), pad=4):
    """把一个'格子'存成纯色剪影透明 PNG(用于演示填色)。"""
    H, W = comp_mask.shape
    r0, c0, r1, c1 = bbox
    r0, c0 = max(0, r0 - pad), max(0, c0 - pad)
    r1, c1 = min(H, r1 + pad), min(W, c1 + pad)
    m = comp_mask[r0:r1, c0:c1]
    crop = np.zeros((*m.shape, 3), np.uint8); crop[m] = fill
    rgba = np.dstack([crop, (m * 255).astype(np.uint8)])
    Image.fromarray(rgba, "RGBA").save(path)


def mask_to_svg(mask, out_svg, tmp_png):
    """金丝单色矢量:黑底白线 PNG → vtracer binary trace → 可任意改 fill 的 SVG。"""
    if not HAS_VTRACER:
        return False
    # 反相成"白底黑线":让金丝本身成为被填充的路径(改 fill 即可重新上色),
    # 而不是把黑背景当主体、金丝变成挖空。
    Image.fromarray(((~mask) * 255).astype(np.uint8)).save(tmp_png)
    vtracer.convert_image_to_svg_py(
        str(tmp_png), str(out_svg),
        colormode="binary", mode="spline",
        filter_speckle=4, corner_threshold=60, path_precision=6,
    )
    return True


def color_to_svg(png_path, out_svg):
    """彩色矢量(保留金色渐变质感)。"""
    if not HAS_VTRACER:
        return False
    vtracer.convert_image_to_svg_py(
        str(png_path), str(out_svg),
        colormode="color", hierarchical="stacked", mode="spline",
        filter_speckle=6, color_precision=6, path_precision=6,
    )
    return True


def distinct_colors(n):
    """生成 n 个区分度高的 RGB 颜色(HSV 均匀取色)。"""
    import colorsys
    out = []
    for i in range(n):
        h = (i * 0.61803398875) % 1.0          # 黄金角,相邻色差大
        r, g, b = colorsys.hsv_to_rgb(h, 0.55, 0.95)
        out.append((int(r * 255), int(g * 255), int(b * 255)))
    return out


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(description="青铜纹样拆件工具")
    ap.add_argument("--input", default="input/pattern_dark.jpg")
    ap.add_argument("--outdir", default="output")
    ap.add_argument("--mode", default="auto", choices=["auto", "dark", "white"])
    ap.add_argument("--min-comp-area", type=int, default=200)
    args = ap.parse_args()

    root = Path(__file__).parent
    inp = (root / args.input) if not Path(args.input).is_absolute() else Path(args.input)
    out = (root / args.outdir) if not Path(args.outdir).is_absolute() else Path(args.outdir)

    dirs = {k: out / k for k in
            ["01_mask", "02_transparent", "03_vector",
             "04_connected", "05_cells", "06_halves", "visualizations"]}
    for d in dirs.values():
        d.mkdir(parents=True, exist_ok=True)

    print(f"[1/6] 读图 {inp.name}")
    rgb, alpha = load_image(inp)
    H, W = rgb.shape[:2]
    mode = detect_mode(rgb) if args.mode == "auto" else args.mode
    print(f"      尺寸 {W}x{H} | mode={mode} | alpha={'有' if alpha is not None else '无'}")

    print("[2/6] 抠金丝掩膜 + 清理")
    raw = extract_wire_mask(rgb, mode=mode, alpha=alpha)
    mask = clean_mask(raw)
    Image.fromarray((raw * 255).astype(np.uint8)).save(dirs["01_mask"] / "mask_raw.png")
    Image.fromarray((mask * 255).astype(np.uint8)).save(dirs["01_mask"] / "mask_clean.png")
    print(f"      金丝像素占比 {mask.mean()*100:.1f}%")

    # ---- 整图透明 PNG(去背景,保留原金色) ----
    full_bbox = (0, 0, H, W)
    save_transparent(rgb, mask, full_bbox, dirs["02_transparent"] / "pattern_transparent.png")
    # 纯金色重铸版(干净配色)
    save_transparent(rgb, mask, full_bbox,
                     dirs["02_transparent"] / "pattern_gold_flat.png",
                     solid_color=(212, 175, 55))
    print("[3/6] 整图去背景透明 PNG 已出")

    # ---- 矢量化 ----
    print("[4/6] 矢量化 (vtracer)")
    if HAS_VTRACER:
        mask_to_svg(mask, dirs["03_vector"] / "wire_mono.svg",
                    dirs["03_vector"] / "_tmp_mask.png")
        color_to_svg(dirs["02_transparent"] / "pattern_transparent.png",
                     dirs["03_vector"] / "pattern_color.svg")
        (dirs["03_vector"] / "_tmp_mask.png").unlink(missing_ok=True)
        print("      wire_mono.svg(单色可改填充) + pattern_color.svg 已出")
    else:
        print("      [跳过] 未安装 vtracer")

    manifest = {"input": inp.name, "size": [W, H], "mode": mode, "components": {}}

    # ---- 连通域组件 ----
    comps = decompose_connected(mask, min_area=args.min_comp_area)
    print(f"[5/6] 连通域拆件: {len(comps)} 块")
    for i, (cm, bbox, area) in enumerate(comps):
        save_transparent(rgb, cm, bbox, dirs["04_connected"] / f"comp_{i:02d}.png")
    manifest["components"]["connected"] = [
        {"id": i, "bbox": list(b), "area": a} for i, (_, b, a) in enumerate(comps)]

    # ---- 封闭格子(填色单元) ----
    cells = extract_cells(mask)
    print(f"      封闭格子: {len(cells)} 个 (填色用)")
    cell_colors = distinct_colors(len(cells))
    for i, (cm, bbox, area) in enumerate(cells):
        save_silhouette(cm, bbox, dirs["05_cells"] / f"cell_{i:02d}.png",
                        fill=cell_colors[i])
    manifest["components"]["cells"] = [
        {"id": i, "bbox": list(b), "area": a} for i, (_, b, a) in enumerate(cells)]

    # ---- 对称切半 ----
    axis = find_symmetry_axis(mask)
    left, right = split_halves(mask, axis)
    save_transparent(rgb, left,  (0, 0, H, axis), dirs["06_halves"] / "left.png")
    save_transparent(rgb, right, (0, axis, H, W), dirs["06_halves"] / "right.png")
    manifest["symmetry_axis_x"] = int(axis)
    print(f"      对称轴 x={axis} → 左右半已出")

    # ----------------------------------------------------------------- #
    # 可视化
    # ----------------------------------------------------------------- #
    print("[6/6] 生成可视化")
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle
    plt.rcParams["font.sans-serif"] = ["Arial Unicode MS", "Hiragino Sans GB", "STHeiti"]
    plt.rcParams["axes.unicode_minus"] = False

    # (a) 掩膜对比
    fig, ax = plt.subplots(1, 3, figsize=(18, 4))
    ax[0].imshow(rgb);                       ax[0].set_title("原图")
    ax[1].imshow(raw, cmap="gray");          ax[1].set_title("金丝掩膜(原始)")
    ax[2].imshow(mask, cmap="gray");         ax[2].set_title("金丝掩膜(清理后)")
    for a in ax: a.axis("off")
    fig.tight_layout(); fig.savefig(dirs["visualizations"] / "01_mask_compare.png", dpi=110)
    plt.close(fig)

    # (b) 连通域着色 + bbox + 对称轴
    lab = measure.label(mask, connectivity=2)
    overlay = color.label2rgb(lab, bg_label=0, bg_color=(1, 1, 1))
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.imshow(overlay)
    cc = distinct_colors(len(comps))
    for i, (_, b, _) in enumerate(comps):
        r0, c0, r1, c1 = b
        ax.add_patch(Rectangle((c0, r0), c1 - c0, r1 - r0,
                     fill=False, ec=np.array(cc[i]) / 255, lw=1.5))
        ax.text(c0, r0 - 2, str(i), color="red", fontsize=8)
    ax.axvline(axis, color="magenta", ls="--", lw=1)
    ax.set_title(f"连通域组件 ({len(comps)}) + 对称轴"); ax.axis("off")
    fig.tight_layout(); fig.savefig(dirs["visualizations"] / "02_components.png", dpi=110)
    plt.close(fig)

    # (c) paint-by-number: 每个封闭格子上不同色 —— 直接演示"填色"
    canvas = np.ones((H, W, 3))
    for i, (cm, _, _) in enumerate(cells):
        canvas[cm] = np.array(cell_colors[i]) / 255
    canvas[mask] = (0.1, 0.1, 0.1)            # 金丝描成深色边
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.imshow(canvas)
    ax.set_title(f"封闭格子填色示意 ({len(cells)} 格) — 掐丝/景泰蓝逐格上色"); ax.axis("off")
    fig.tight_layout(); fig.savefig(dirs["visualizations"] / "03_cells_paint.png", dpi=110)
    plt.close(fig)

    # (d) 组件拼图(前若干大件)
    topk = comps[:12]
    if topk:
        n = len(topk); cols = 4; rows = (n + cols - 1) // cols
        fig, ax = plt.subplots(rows, cols, figsize=(cols * 3, rows * 2))
        ax = np.array(ax).reshape(-1)
        for i, (cm, b, a) in enumerate(topk):
            r0, c0, r1, c1 = b
            ax[i].imshow(rgb[r0:r1, c0:c1])
            ax[i].imshow(cm[r0:r1, c0:c1], cmap="Reds", alpha=0.25)
            ax[i].set_title(f"#{i}  area={a}", fontsize=8); ax[i].axis("off")
        for j in range(n, len(ax)): ax[j].axis("off")
        fig.suptitle("前 12 大连通域组件")
        fig.tight_layout(); fig.savefig(dirs["visualizations"] / "04_components_grid.png", dpi=110)
        plt.close(fig)

    with open(out / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print("\n完成 ✅  输出目录:", out)
    print(f"  连通域组件 {len(comps)} | 封闭格子 {len(cells)} | 对称轴 x={axis}")


if __name__ == "__main__":
    main()
