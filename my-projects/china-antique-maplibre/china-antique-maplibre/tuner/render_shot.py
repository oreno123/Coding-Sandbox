# -*- coding: utf-8 -*-
"""单镜头确定性渲染：mode=solo&shot=N&dur=ms&base=ms
pass1 预热 → pass2 逐帧 __renderShot + screenshot → _frames_shot{N}/frame_%05d.jpg
"""
import os, sys, time
from playwright.sync_api import sync_playwright

FPS = 30
BASE = "http://localhost:8765/yongji-demo.html"

SHOT = sys.argv[1] if len(sys.argv) > 1 else "0"
DUR = sys.argv[2] if len(sys.argv) > 2 else "5000"
S_BASE = sys.argv[3] if len(sys.argv) > 3 else "0"
OUT = f"_frames_shot{SHOT}"

if os.path.exists(OUT):
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
else:
    os.makedirs(OUT)

t_start = time.time()
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto(f"{BASE}?t=0&mode=solo&shot={SHOT}&dur={DUR}&base={S_BASE}", wait_until="domcontentloaded")
    page.wait_for_function("window.__ready === true", timeout=60000)
    total_ms = page.evaluate("window.__total")
    print("total_ms:", total_ms, " shot:", SHOT, " dur:", DUR)

    pts = list(range(0, int(total_ms) + 1, 300))
    for t in pts:
        page.evaluate(f"window.__render({t}, true)")
        page.wait_for_timeout(120)
    page.wait_for_timeout(4000)
    print(f"warm done ({len(pts)} pts), rendering...")

    n = int(total_ms // (1000 / FPS)) + 1
    for i in range(n):
        t = int(round(i * 1000 / FPS))
        page.evaluate(f"window.__renderShot({t})")
        page.screenshot(path=f"{OUT}/frame_{i:05d}.jpg", type="jpeg", quality=92)
        if i % 60 == 0:
            print(f"frame {i}/{n}  {time.time()-t_start:.0f}s", flush=True)
    print("frames:", n)
    browser.close()
print(f"done in {time.time()-t_start:.0f}s -> {OUT}/frame_*.jpg")
