#!/usr/bin/env python3
"""
语义分组：把连通域组件按空间邻近性合并成有意义的纹样元素。
策略：
  1. 去掉超大组件（外框、整体轮廓）
  2. 按空间距离聚类（DBSCAN）
  3. 每个聚类合并成一张透明 PNG + 一个 SVG 片段
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from skimage.measure import label as sklabel, regionprops
from scipy import ndimage as ndi
from collections import defaultdict

try:
    from sklearn.cluster import DBSCAN
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

def load_mask(output_dir):
    """加载清理后的金丝掩膜。"""
    mask_path = Path(output_dir) / "01_mask" / "mask_clean.png"
    m = np.array(Image.open(mask_path))
    return m > 128

def load_manifest(output_dir):
    p = Path(output_dir) / "manifest.json"
    return json.loads(p.read_text(encoding="utf-8"))

def component_centroid(bbox):
    r0, c0, r1, c1 = bbox
    return ((r0 + r1) / 2, (c0 + c1) / 2)

def filter_components(comps, img_h, img_w, max_area_frac=0.15, min_area=500):
    """过滤：去掉太大（外框）和太小（碎屑）的组件。"""
    total = img_h * img_w
    return [c for c in comps
            if c["area"] >= min_area and c["area"] < total * max_area_frac]

def cluster_components(comps, eps=200):
    """用 DBSCAN 按质心距离聚类。"""
    if not comps:
        return {}
    centroids = np.array([component_centroid(c["bbox"]) for c in comps])

    if HAS_SKLEARN:
        db = DBSCAN(eps=eps, min_samples=1).fit(centroids)
        labels = db.labels_
    else:
        # fallback: 简单网格聚类
        grid_size = eps
        labels = []
        label_map = {}
        next_label = 0
        for cy, cx in centroids:
            gy, gx = int(cy // grid_size), int(cx // grid_size)
            key = (gy, gx)
            if key not in label_map:
                label_map[key] = next_label
                next_label += 1
            labels.append(label_map[key])
        labels = np.array(labels)

    clusters = defaultdict(list)
    for i, lbl in enumerate(labels):
        clusters[int(lbl)].append(comps[i])
    return dict(clusters)

def merge_cluster(mask, cluster_comps, pad=8):
    """把一个聚类里所有组件合并成一张透明 PNG。"""
    # 只保留属于这个聚类的连通域
    sub = np.zeros_like(mask)
    for c in cluster_comps:
        r0, c0, r1, c1 = c["bbox"]
        # 在 bbox 范围内找属于这个 area 的区域
        # 直接用连通域 label 更精确，这里简化用 bbox 茁切
        sub[r0:r1, c0:c1] = mask[r0:r1, c0:c1]

    # 但这会包含不属于这个聚类的部分，需要更精确
    # 用连通域标注来精确匹配
    labeled = sklabel(mask, connectivity=2)
    sub = np.zeros_like(mask)
    for c in cluster_comps:
        # 用 area + bbox 双重匹配找到正确的 label
        r0, c0, r1, c1 = c["bbox"]
        region = labeled[r0:r1, c0:c1]
        for prop in regionprops(labeled):
            pr0, pc0, pr1, pc1 = prop.bbox
            if pr0 == r0 and pc0 == c0 and pr1 == r1 and pc1 == c1:
                sub[labeled == prop.label] = True
                break

    if sub.sum() == 0:
        return None, None

    # 裁切 bbox
    ys, xs = np.where(sub)
    r0, c0 = max(0, ys.min() - pad), max(0, xs.min() - pad)
    r1, c1 = min(mask.shape[0], ys.max() + pad + 1), min(mask.shape[1], xs.max() + pad + 1)

    crop_mask = sub[r0:r1, c0:c1]
    # 抗锯齿 alpha
    dist = ndi.distance_transform_edt(crop_mask)
    alpha = np.clip(dist / 1.5, 0, 1) * 255

    # 金色填充
    rgba = np.zeros((*crop_mask.shape, 4), np.uint8)
    rgba[crop_mask, 0] = 212  # R
    rgba[crop_mask, 1] = 175  # G
    rgba[crop_mask, 2] = 55   # B
    rgba[:, :, 3] = alpha.astype(np.uint8)

    return Image.fromarray(rgba, "RGBA"), (r0, c0, r1, c1)

def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--outdir", default="output_tuanlong")
    ap.add_argument("--eps", type=int, default=200, help="DBSCAN 聚类距离（像素）")
    ap.add_argument("--min-area", type=int, default=500)
    args = ap.parse_args()

    root = Path(__file__).parent
    out = root / args.outdir
    elem_dir = out / "elements"
    elem_dir.mkdir(exist_ok=True)

    manifest = load_manifest(out)
    mask = load_mask(out)
    H, W = mask.shape
    print(f"Mask: {W}x{H}")

    comps = manifest["components"]["connected"]
    print(f"Total components: {len(comps)}")

    filtered = filter_components(comps, H, W, max_area_frac=0.15, min_area=args.min_area)
    print(f"After filter (area {args.min_area}~15%): {len(filtered)} components")

    clusters = cluster_components(filtered, eps=args.eps)
    print(f"Clusters (eps={args.eps}): {len(clusters)}")

    elements = []
    for cid, members in sorted(clusters.items(), key=lambda x: -sum(c["area"] for c in x[1])):
        total_area = sum(c["area"] for c in members)
        img, bbox = merge_cluster(mask, members)
        if img is None:
            continue

        path = elem_dir / f"elem_{cid:02d}.png"
        img.save(path)
        elements.append({
            "id": int(cid),
            "components": len(members),
            "area": int(total_area),
            "bbox": [int(b) for b in bbox],
            "file": str(path.name),
        })
        print(f"  elem_{cid:02d}: {len(members)} comps, area={total_area}, size={img.size}")

    # Save element manifest
    elem_manifest = {"source": manifest["input"], "eps": args.eps, "elements": elements}
    (elem_dir / "manifest.json").write_text(
        json.dumps(elem_manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    # Generate HTML gallery
    cards = []
    for e in sorted(elements, key=lambda x: -x["area"]):
        cards.append(
            f'<figure><img src="{e["file"]}">'
            f'<figcaption>elem_{e["id"]:02d} · {e["components"]}comps · {e["area"]}px</figcaption></figure>')

    html = f"""<!doctype html><html><head><meta charset="utf-8">
<title>语义分组元素</title>
<style>
body{{font-family:sans-serif;margin:0;background:#1a1a1a;color:#eee;padding:20px}}
h1{{font-size:20px;color:#C9A84C}}
.cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-top:16px}}
figure{{margin:0;background:conic-gradient(#333 90deg,#222 0 180deg,#333 0 270deg,#222 0) 0 0/20px 20px;
border:1px solid #444;border-radius:8px;padding:8px;text-align:center}}
figure img{{max-width:100%;max-height:180px;object-fit:contain}}
figcaption{{font-size:11px;color:#888;margin-top:4px}}
</style></head><body>
<h1>语义分组元素 · eps={args.eps} · {len(elements)} elements</h1>
<div class="cards">{"".join(cards)}</div>
</body></html>"""

    gallery_path = elem_dir / "gallery.html"
    gallery_path.write_text(html, encoding="utf-8")
    print(f"\nGallery: {gallery_path}")
    print(f"Elements: {len(elements)} saved to {elem_dir}/")

if __name__ == "__main__":
    main()
