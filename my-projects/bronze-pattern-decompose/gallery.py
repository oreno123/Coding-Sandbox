#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""扫描 output/ 生成一页式 gallery.html,方便浏览全部拆件结果。"""
import json
from pathlib import Path

root = Path(__file__).parent
out = root / "output"
mani = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
n_comp = len(mani["components"]["connected"])
n_cell = len(mani["components"]["cells"])
axis = mani.get("symmetry_axis_x")


def grid(folder, prefix, items):
    """items: [(id, area)]，按 area 排序的卡片。"""
    cards = []
    for it in items:
        i, a = it["id"], it["area"]
        cards.append(
            f'<figure><img src="output/{folder}/{prefix}_{i:02d}.png">'
            f'<figcaption>#{i} · {a}px</figcaption></figure>')
    return "\n".join(cards)


comp_cards = grid("04_connected", "comp", mani["components"]["connected"])
cell_cards = grid("05_cells", "cell", mani["components"]["cells"])

html = f"""<!doctype html><html lang="zh"><head><meta charset="utf-8">
<title>青铜纹样拆件结果</title>
<style>
 body{{font-family:-apple-system,"PingFang SC",sans-serif;margin:0;background:#f4f1ea;color:#222}}
 header{{background:#1e3d3a;color:#e9d59a;padding:24px 32px}}
 header h1{{margin:0 0 6px;font-size:22px}} header p{{margin:0;opacity:.85;font-size:14px}}
 .stat{{display:inline-block;margin-right:18px;font-size:13px}}
 section{{padding:20px 32px;border-bottom:1px solid #e0dccf}}
 h2{{font-size:17px;color:#1e3d3a;border-left:4px solid #c9a84a;padding-left:10px}}
 .note{{font-size:13px;color:#666;margin:-4px 0 14px}}
 .big img{{max-width:100%;border:1px solid #ddd;background:
   conic-gradient(#eee 90deg,#fff 0 180deg,#eee 0 270deg,#fff 0) 0 0/20px 20px}}
 .row{{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}}
 .row .col{{flex:1;min-width:280px}}
 .cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}}
 figure{{margin:0;background:
   conic-gradient(#e8e8e8 90deg,#fff 0 180deg,#e8e8e8 0 270deg,#fff 0) 0 0/16px 16px;
   border:1px solid #ddd;border-radius:6px;padding:6px;text-align:center}}
 figure img{{max-width:100%;max-height:120px;object-fit:contain}}
 figcaption{{font-size:11px;color:#777;margin-top:4px}}
 a.btn{{display:inline-block;background:#1e3d3a;color:#e9d59a;text-decoration:none;
   padding:6px 12px;border-radius:5px;font-size:13px;margin-right:8px}}
</style></head><body>
<header>
 <h1>青铜纹样拆件结果 · bronze-pattern-decompose</h1>
 <p>源图 {mani['input']} · {mani['size'][0]}×{mani['size'][1]} · mode={mani['mode']}</p>
 <p style="margin-top:10px">
   <span class="stat">连通域组件 <b>{n_comp}</b></span>
   <span class="stat">封闭格子 <b>{n_cell}</b></span>
   <span class="stat">对称轴 x=<b>{axis}</b></span></p>
</header>

<section><h2>1 · 抠金丝掩膜(替代 SAM)</h2>
 <p class="note">LAB 黄色通道阈值分割 → 形态学清理。比 SAM 干净、可调、可复现。</p>
 <div class="big"><img src="output/visualizations/01_mask_compare.png"></div></section>

<section><h2>2 · 整图去背景(透明 PNG,质量优于即梦)</h2>
 <p class="note">左:保留原金色质感;右:重铸为统一金色。背景完全透明(棋盘格为透明示意)。</p>
 <div class="row">
  <div class="col"><div class="big"><img src="output/02_transparent/pattern_transparent.png"></div></div>
  <div class="col"><div class="big"><img src="output/02_transparent/pattern_gold_flat.png"></div></div>
 </div></section>

<section><h2>3 · 矢量化(解决"填色":矢量后任意改色/缩放)</h2>
 <p class="note">wire_mono.svg = 金丝单色路径,改 fill 即换色;pattern_color.svg = 保留金色质感的彩色矢量。</p>
 <p><a class="btn" href="output/03_vector/wire_mono.svg">⬇ wire_mono.svg</a>
    <a class="btn" href="output/03_vector/pattern_color.svg">⬇ pattern_color.svg</a></p>
 <div class="row">
  <div class="col"><div class="big"><img src="output/03_vector/preview_wire.png"></div></div>
  <div class="col"><div class="big"><img src="output/03_vector/preview_color.png"></div></div>
 </div></section>

<section><h2>4 · 连通域拆件 · {n_comp} 块</h2>
 <p class="note">自然分离的纹样各成一件:眼睛螺旋、四角回纹方块/圆点、卷云、小方块都被拆出。粉色虚线为对称轴。</p>
 <div class="big"><img src="output/visualizations/02_components.png"></div>
 <h3 style="font-size:14px">全部组件(透明 PNG,按面积排序)</h3>
 <div class="cards">{comp_cards}</div></section>

<section><h2>5 · 封闭格子填色 · {n_cell} 格(掐丝/景泰蓝逐格上色)</h2>
 <p class="note">金丝围成的每个封闭格子=一个填色单元。下图给每格上不同色演示"填色";每格也单独导出为剪影 PNG。</p>
 <div class="big"><img src="output/visualizations/03_cells_paint.png"></div>
 <h3 style="font-size:14px">全部格子剪影</h3>
 <div class="cards">{cell_cards}</div></section>

<section><h2>6 · 左右对称半</h2>
 <p class="note">沿对称轴 x={axis} 切分,做完一半镜像即可,工作量减半。</p>
 <div class="row">
  <div class="col"><div class="big"><img src="output/06_halves/left.png"></div></div>
  <div class="col"><div class="big"><img src="output/06_halves/right.png"></div></div>
 </div></section>

<footer style="padding:20px 32px;font-size:12px;color:#888">
 重新生成:<code>python3 decompose.py --input input/pattern_dark.jpg --mode dark &amp;&amp; python3 gallery.py</code>
</footer>
</body></html>"""

(root / "gallery.html").write_text(html, encoding="utf-8")
print("gallery.html 已生成 ->", root / "gallery.html")
