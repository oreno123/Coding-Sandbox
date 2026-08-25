# -*- coding: utf-8 -*-
"""逐帧确定性渲染 yongji-demo：
pass1 预热（0.5s 步进扫时间轴，瓦片进缓存）
pass2 逐帧 __renderShot(t) + screenshot（30fps JPEG）
输出 _frames/frame_%05d.jpg
"""
import os, shutil, time
from playwright.sync_api import sync_playwright

FPS = 30
URL = "http://localhost:8765/yongji-demo.html?t=0"
OUT = "_frames"

if os.path.exists(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)

t_start = time.time()
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_function("window.__ready === true", timeout=60000)
    total_ms = page.evaluate("window.__total")
    print("total_ms:", total_ms)

    # pass1 预热：只 seek 不等渲染完成，浏览器会把整条路径的瓦片都拉下来
    pts = list(range(0, int(total_ms) + 1, 500))
    for i, t in enumerate(pts):
        page.evaluate(f"window.__render({t}, true)")
        page.wait_for_timeout(120)
    print(f"warm pass done ({len(pts)} pts), settle...")
    page.wait_for_timeout(4000)

    # pass2 逐帧截图
    n = int(total_ms // (1000 / FPS)) + 1
    for i in range(n):
        t = int(round(i * 1000 / FPS))
        page.evaluate(f"window.__renderShot({t})")
        page.screenshot(path=f"{OUT}/frame_{i:05d}.jpg", type="jpeg", quality=92)
        if i % 150 == 0:
            el = time.time() - t_start
            print(f"frame {i}/{n}  elapsed {el:.0f}s", flush=True)
    print("frames:", n)
    browser.close()
print(f"done in {time.time()-t_start:.0f}s")
