# -*- coding: utf-8 -*-
"""诊断 yongji-demo.html：抓 console/pageerror + 关键全局状态。"""
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/yongji-demo.html?t=0"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    msgs = []
    page.on("console", lambda m: msgs.append(f"[{m.type}] {m.text[:300]}"))
    page.on("pageerror", lambda e: msgs.append(f"[pageerror] {str(e)[:500]}"))
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_timeout(20000)
    state = page.evaluate("""() => ({
        title: document.title,
        maplibre: typeof maplibregl,
        waterData: typeof window.CHINA_WATER_DATA,
        hanCity: typeof window.HanCity3D,
        mapCreated: !!window.__map,
        mapLoaded: !!(window.__map && window.__map.loaded()),
        ready: !!window.__ready,
        seekReady: !!window.__seekReady,
        canvasFilter: (document.querySelector('.maplibregl-canvas-container')||{}).style ?
            document.querySelector('.maplibre-canvas-container')?.style.filter : null,
    })""")
    print("STATE:", state)
    print("CONSOLE:", *msgs[:30], sep="\n  ")
    browser.close()
