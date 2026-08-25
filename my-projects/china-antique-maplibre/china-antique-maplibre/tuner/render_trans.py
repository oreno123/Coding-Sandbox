# -*- coding: utf-8 -*-
"""逐帧渲染两个衔接转场小片（各 6s）：
mode=transA 总览→俯冲洛阳（片头，末帧对齐主线 t=3.2s）
mode=transB 蓟县终景→拉起到总览（片尾，航线满辉）
输出 _frames_transA / _frames_transB → ffmpeg 合成 mp4
"""
import os, shutil, time
from playwright.sync_api import sync_playwright

FPS = 30
BASE = "http://localhost:8765/yongji-demo.html"
OUTS = {"transA": "_frames_transA", "transB": "_frames_transB"}

for d in OUTS.values():
    if os.path.exists(d):
        shutil.rmtree(d)
    os.makedirs(d)

t_start = time.time()
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for mode, out in OUTS.items():
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        page.goto(f"{BASE}?t=0&mode={mode}", wait_until="domcontentloaded")
        page.wait_for_function("window.__ready === true", timeout=60000)
        total_ms = page.evaluate("window.__total")
        print(f"[{mode}] total_ms: {total_ms}")

        pts = list(range(0, int(total_ms) + 1, 300))
        for t in pts:
            page.evaluate(f"window.__render({t}, true)")
            page.wait_for_timeout(120)
        page.wait_for_timeout(4000)
        print(f"[{mode}] warm done ({len(pts)} pts), rendering frames...")

        n = int(total_ms // (1000 / FPS)) + 1
        m_start = time.time()
        for i in range(n):
            t = int(round(i * 1000 / FPS))
            page.evaluate(f"window.__renderShot({t})")
            page.screenshot(path=f"{out}/frame_{i:05d}.jpg", type="jpeg", quality=92)
            if i % 60 == 0:
                print(f"[{mode}] frame {i}/{n}  {time.time()-m_start:.0f}s", flush=True)
        print(f"[{mode}] frames: {n} in {time.time()-m_start:.0f}s")
        page.close()
    browser.close()
print(f"all done in {time.time()-t_start:.0f}s")
