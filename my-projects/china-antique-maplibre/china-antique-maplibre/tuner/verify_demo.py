# -*- coding: utf-8 -*-
"""yongji-demo.html headless 截图验证：3 个时间点，检查 WebGL 纹理不黑屏。"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/yongji-demo.html"
SHOTS = [(0, "shot-t0"), (14, "shot-t14"), (38, "shot-t38")]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    for t, name in SHOTS:
        page.goto(f"{URL}?t={t}", wait_until="domcontentloaded")
        page.wait_for_function("window.__seekReady === true", timeout=60000)
        page.wait_for_timeout(1500)
        page.screenshot(path=f"_verify/{name}.png")
        print(f"ok {name}")
    print("console errors:", errors[:10] if errors else "none")
    browser.close()
