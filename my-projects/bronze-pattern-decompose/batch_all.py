#!/usr/bin/env python3
"""单脚本批量跑 decompose + group，不用 subprocess。"""
import json, shutil, sys
from pathlib import Path

# 直接 import decompose 和 group 的核心函数
sys.path.insert(0, str(Path(__file__).parent))

from decompose import (
    load_image, detect_mode, extract_wire_mask, clean_mask,
    decompose_connected, extract_cells, find_symmetry_axis, split_halves,
    save_transparent, mask_to_svg, color_to_svg, distinct_colors
)
from skimage.measure import label as sklabel, regionprops
from scipy import ndimage as ndi
from collections import defaultdict
import numpy as np
from PIL import Image

INPUT_DIR = Path(r"D:\desktop\纹样照片")
SCRIPT_DIR = Path(__file__).parent

IMAGES = [
    ("tuanlong",  "transparent_jimeng-2026-05-23-2864-*"),
    ("lianhua",   "transparent_jimeng-2026-05-23-3301-*"),
    ("huiwen",    "transparent_jimeng-2026-05-23-6545-*"),
    ("yunlei",    "transparent_jimeng-2026-05-23-6731-*"),
    ("juancao",   "transparent_jimeng-2026-05-23-8828-*"),
    ("juanco2",   "transparent_jimeng-2026-05-23-2632-*"),
]


def do_decompose(img_path, out_dir, min_comp_area=200):
    out = Path(out_dir)
    dirs = {k: out / k for k in
            ["01_mask", "02_transparent", "04_connected", "05_cells"]}
    for d in dirs.values():
        d.mkdir(parents=True, exist_ok=True)

    rgb, alpha = load_image(img_path)
    H, W = rgb.shape[:2]
    mode = detect_mode(rgb)

    raw = extract_wire_mask(rgb, mode="dark", alpha=alpha)
    mask = clean_mask(raw)
    Image.fromarray((raw * 255).astype(np.uint8)).save(dirs["01_mask"] / "mask_raw.png")
    Image.fromarray((mask * 255).astype(np.uint8)).save(dirs["01_mask"] / "mask_clean.png")

    full_bbox = (0, 0, H, W)
    save_transparent(rgb, mask, full_bbox, dirs["02_transparent"] / "pattern_transparent.png")
    save_transparent(rgb, mask, full_bbox, dirs["02_transparent"] / "pattern_gold_flat.png",
                     solid_color=(212, 175, 55))

    comps = decompose_connected(mask, min_area=min_comp_area)
    manifest_comps = []
    for i, (cm, bbox, area) in enumerate(comps):
        save_transparent(rgb, cm, bbox, dirs["04_connected"] / f"comp_{i:02d}.png")
        manifest_comps.append({"id": i, "bbox": list(bbox), "area": int(area)})

    manifest = {
        "input": Path(img_path).name, "size": [W, H], "mode": mode,
        "components": {"connected": manifest_comps}
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return mask, manifest


def do_group(mask, manifest_data, out_dir, eps=200, min_area=500):
    out = Path(out_dir)
    elem_dir = out / "elements"
    elem_dir.mkdir(exist_ok=True)

    H, W = mask.shape
    comps = manifest_data["components"]["connected"]
    total = H * W
    filtered = [c for c in comps if c["area"] >= min_area and c["area"] < total * 0.15]
    if not filtered:
        return []

    # DBSCAN
    centroids = np.array([((c["bbox"][0]+c["bbox"][2])/2, (c["bbox"][1]+c["bbox"][3])/2) for c in filtered])
    try:
        from sklearn.cluster import DBSCAN
        labels = DBSCAN(eps=eps, min_samples=1).fit(centroids).labels_
    except ImportError:
        grid_size = eps
        labels = np.array([int(cy // grid_size) * 100 + int(cx // grid_size) for cy, cx in centroids])

    clusters = defaultdict(list)
    for i, lbl in enumerate(labels):
        clusters[int(lbl)].append(filtered[i])

    labeled = sklabel(mask, connectivity=2)
    elements = []

    for cid, members in sorted(clusters.items(), key=lambda x: -sum(c["area"] for c in x[1])):
        sub = np.zeros_like(mask)
        for c in members:
            r0, c0, r1, c1 = c["bbox"]
            for prop in regionprops(labeled):
                pr0, pc0, pr1, pc1 = prop.bbox
                if pr0 == r0 and pc0 == c0 and pr1 == r1 and pc1 == c1 and prop.area == c["area"]:
                    sub[labeled == prop.label] = True
                    break

        if sub.sum() == 0:
            continue

        ys, xs = np.where(sub)
        pad = 8
        r0, c0 = max(0, ys.min() - pad), max(0, xs.min() - pad)
        r1, c1 = min(mask.shape[0], ys.max() + pad + 1), min(mask.shape[1], xs.max() + pad + 1)

        crop = sub[r0:r1, c0:c1]
        dist = ndi.distance_transform_edt(crop)
        alpha = np.clip(dist / 1.5, 0, 1) * 255
        rgba = np.zeros((*crop.shape, 4), np.uint8)
        rgba[crop, 0] = 212
        rgba[crop, 1] = 175
        rgba[crop, 2] = 55
        rgba[:, :, 3] = alpha.astype(np.uint8)
        img = Image.fromarray(rgba, "RGBA")

        fname = f"elem_{cid:02d}.png"
        img.save(elem_dir / fname)
        elements.append({
            "id": int(cid), "components": len(members),
            "area": int(sum(c["area"] for c in members)),
            "bbox": [int(r0), int(c0), int(r1), int(c1)],
            "file": fname, "source": out_dir.name.replace("output_", ""),
        })

    (elem_dir / "manifest.json").write_text(
        json.dumps({"elements": elements}, ensure_ascii=False, indent=2), encoding="utf-8")
    return elements


def main():
    all_elements = []

    for name, pattern in IMAGES:
        matches = list(INPUT_DIR.glob(pattern))
        if not matches:
            print(f"[SKIP] {name}: no match")
            continue
        img = matches[0]
        outdir = SCRIPT_DIR / f"output_{name}"

        print(f"\n[{name}] ", end="", flush=True)

        # decompose
        mask, manifest = do_decompose(img, outdir)
        n_comp = len(manifest["components"]["connected"])
        print(f"decompose({n_comp} comps) ", end="", flush=True)

        # group
        elems = do_group(mask, manifest, outdir, eps=200, min_area=500)
        print(f"group({len(elems)} elems)")
        all_elements.extend(elems)

    # Unified output
    unified = SCRIPT_DIR / "all_elements"
    unified.mkdir(exist_ok=True)

    for e in all_elements:
        src = SCRIPT_DIR / f"output_{e['source']}" / "elements" / e["file"]
        new_name = f"{e['source']}_{e['file']}"
        dst = unified / new_name
        if src.exists():
            shutil.copy2(src, dst)
            e["unified_file"] = new_name

    # Gallery
    cards = []
    for e in sorted(all_elements, key=lambda x: -x["area"]):
        cards.append(
            f'<figure><img src="{e.get("unified_file","")}">'
            f'<figcaption>{e["source"]} · {e["components"]}c · {e["area"]}px</figcaption></figure>')

    sources = sorted(set(e["source"] for e in all_elements))
    source_stats = ""
    for s in sources:
        n = sum(1 for e in all_elements if e["source"] == s)
        source_stats += f'<div class="stat">{s} <b>{n}</b></div>'

    html = f"""<!doctype html><html><head><meta charset="utf-8">
<title>纹脉元素库</title>
<style>
body{{font-family:sans-serif;margin:0;background:#1a1a1a;color:#eee;padding:20px}}
h1{{font-size:22px;color:#C9A84C}} p{{color:#888;font-size:13px}}
.cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:16px}}
figure{{margin:0;background:conic-gradient(#333 90deg,#222 0 180deg,#333 0 270deg,#222 0) 0 0/20px 20px;
border:1px solid #444;border-radius:8px;padding:8px;text-align:center}}
figure img{{max-width:100%;max-height:150px;object-fit:contain}}
figcaption{{font-size:10px;color:#888;margin-top:4px}}
.stats{{display:flex;gap:12px;margin:10px 0;flex-wrap:wrap}}
.stat{{background:#252525;padding:6px 12px;border-radius:6px;font-size:13px}}
.stat b{{color:#C9A84C}}
</style></head><body>
<h1>纹脉 · 全量元素库</h1>
<p>6 张纹样图 × decompose + DBSCAN 语义分组</p>
<div class="stats"><div class="stat">总元素 <b>{len(all_elements)}</b></div>{source_stats}</div>
<div class="cards">{"".join(cards)}</div>
</body></html>"""

    (unified / "gallery.html").write_text(html, encoding="utf-8")
    (unified / "manifest.json").write_text(
        json.dumps({"total": len(all_elements), "elements": all_elements},
                   ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nDONE: {len(all_elements)} total elements")
    print(f"Gallery: {unified / 'gallery.html'}")


if __name__ == "__main__":
    main()
