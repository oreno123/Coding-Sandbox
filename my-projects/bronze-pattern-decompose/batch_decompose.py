#!/usr/bin/env python3
"""批量跑 decompose + group，汇总所有元素。"""
import subprocess, sys, json, shutil
from pathlib import Path

IMAGES = {
    "tuanlong":  "transparent_jimeng-2026-05-23-2864-*",
    "lianhua":   "transparent_jimeng-2026-05-23-3301-*",
    "huiwen":    "transparent_jimeng-2026-05-23-6545-*",
    "yunlei":    "transparent_jimeng-2026-05-23-6731-*",
    "juancao":   "transparent_jimeng-2026-05-23-8828-*",
    "juanco2":   "transparent_jimeng-2026-05-23-2632-*",
}

INPUT_DIR = Path(r"D:\desktop\纹样照片")
SCRIPT_DIR = Path(__file__).parent
DECOMPOSE = SCRIPT_DIR / "decompose.py"
GROUP = SCRIPT_DIR / "group_elements.py"

def find_image(pattern):
    matches = list(INPUT_DIR.glob(pattern))
    return matches[0] if matches else None

def main():
    all_elements = []

    for name, pattern in IMAGES.items():
        img = find_image(pattern)
        if not img:
            print(f"[SKIP] {name}: no match for {pattern}")
            continue

        outdir = f"output_{name}"
        print(f"\n{'='*60}")
        print(f"[{name}] {img.name[:60]}...")
        print(f"{'='*60}")

        # Step 1: decompose
        cmd = [sys.executable, str(DECOMPOSE),
               "--input", str(img), "--mode", "dark", "--outdir", outdir]
        r = subprocess.run(cmd, cwd=str(SCRIPT_DIR),
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            print(f"  decompose FAILED")
            continue
        print(f"  decompose OK")

        # Step 2: group
        cmd = [sys.executable, str(GROUP),
               "--outdir", outdir, "--eps", "200", "--min-area", "500"]
        r = subprocess.run(cmd, cwd=str(SCRIPT_DIR),
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            print(f"  group FAILED")
            continue
        print(f"  group OK")

        # Collect elements
        elem_dir = SCRIPT_DIR / outdir / "elements"
        manifest = json.loads((elem_dir / "manifest.json").read_text(encoding="utf-8"))
        for e in manifest["elements"]:
            e["source"] = name
        all_elements.extend(manifest["elements"])
        print(f"  {len(manifest['elements'])} elements from {name}")

    # Copy all elements to unified directory
    unified = SCRIPT_DIR / "all_elements"
    unified.mkdir(exist_ok=True)

    for e in all_elements:
        src = SCRIPT_DIR / f"output_{e['source']}" / "elements" / e["file"]
        new_name = f"{e['source']}_{e['file']}"
        dst = unified / new_name
        if src.exists():
            shutil.copy2(src, dst)
            e["file"] = new_name

    # Generate unified gallery
    cards = []
    for e in sorted(all_elements, key=lambda x: -x["area"]):
        cards.append(
            f'<figure><img src="{e["file"]}">'
            f'<figcaption>{e["source"]} · {e["components"]}comps · {e["area"]}px</figcaption></figure>')

    html = f"""<!doctype html><html><head><meta charset="utf-8">
<title>纹脉元素库</title>
<style>
body{{font-family:sans-serif;margin:0;background:#1a1a1a;color:#eee;padding:20px}}
h1{{font-size:22px;color:#C9A84C}} p{{color:#888;font-size:13px}}
.cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:16px}}
figure{{margin:0;background:conic-gradient(#333 90deg,#222 0 180deg,#333 0 270deg,#222 0) 0 0/20px 20px;
border:1px solid #444;border-radius:8px;padding:8px;text-align:center}}
figure img{{max-width:100%;max-height:160px;object-fit:contain}}
figcaption{{font-size:10px;color:#888;margin-top:4px}}
.stats{{display:flex;gap:20px;margin:10px 0;flex-wrap:wrap}}
.stat{{background:#252525;padding:6px 12px;border-radius:6px;font-size:13px}}
.stat b{{color:#C9A84C}}
</style></head><body>
<h1>纹脉 · 全量元素库</h1>
<p>decompose + DBSCAN 语义分组 · eps=200</p>
<div class="stats">
<div class="stat">总元素 <b>{len(all_elements)}</b></div>
<div class="stat">来源图 <b>{len(set(e["source"] for e in all_elements))}</b></div>
</div>
<div class="cards">{"".join(cards)}</div>
</body></html>"""

    (unified / "gallery.html").write_text(html, encoding="utf-8")
    (unified / "manifest.json").write_text(
        json.dumps({"elements": all_elements}, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{'='*60}")
    print(f"DONE: {len(all_elements)} total elements")
    print(f"Gallery: {unified / 'gallery.html'}")

if __name__ == "__main__":
    main()
