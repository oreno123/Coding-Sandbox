# -*- coding: utf-8 -*-
"""录制 yongji-demo：?t=0 预载（瓦片热）→ __play() 起播 → 录到 __done。
输出 webm 到 _record/，rAF 节流则带参数重启。"""
import sys, time
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/yongji-demo.html?t=0"
OUT = "_record"

def run(launch_kwargs):
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kwargs)
        ctx = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=OUT,
            record_video_size={"width": 1920, "height": 1080},
        )
        page = ctx.new_page()
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("window.__ready === true", timeout=60000)
        page.wait_for_timeout(1200)  # 瓦片热身

        # rAF 是否被节流（headless 可能 0fps）
        raf = page.evaluate("""() => new Promise(res => {
            let n = 0; const t0 = performance.now();
            (function loop(){ n++; if (performance.now()-t0 < 500) requestAnimationFrame(loop); else res(n); })();
        })""")
        print("rAF ticks / 500ms:", raf)
        if raf < 10:
            browser.close()
            return None, raf

        total_ms = page.evaluate("window.__total")
        print("timeline total:", round(total_ms/1000, 1), "s")
        page.evaluate("window.__play()")
        page.wait_for_function("window.__done === true", timeout=int(total_ms + 40000))
        page.wait_for_timeout(2000)
        video = page.video.path()
        ctx.close()
        browser.close()
        return video, raf

video, raf = run({"headless": True})
if video is None:
    print("rAF throttled, retry with unthrottle flags")
    video, raf = run({
        "headless": True,
        "args": [
            "--run-all-compositor-stages-before-draw",
            "--disable-new-content-rendering-timeout",
            "--disable-frame-rate-limit",
        ],
    })
print("VIDEO:", video)
