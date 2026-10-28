"""Capture every routed frontend view against the local seeded demo backend.

Run through webapp-testing's with_server.py helper after starting backend and Vite.
The screenshots are reference material only; application pages remain editable React/CSS.
"""

import json
import os
from html import escape
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.environ.get("HENGJIAN_OUTPUT_DIR", str(ROOT / "screenshots" / "baseline-2026-10-28")))
BASE = os.environ.get("HENGJIAN_BASE_URL", "http://127.0.0.1:5173")
API = os.environ.get("HENGJIAN_API_URL", "http://127.0.0.1:8000")

ROUTES = {
    "admin": [
        ("home", "/"), ("question-bank", "/question-bank"),
        ("paper-assembly", "/paper-assembly"), ("exam-management", "/exam-management"),
        ("data-import", "/data-import"), ("grading", "/grading"),
        ("scan-grading", "/scan-grading"), ("print-management", "/print-management"),
        ("tag-management", "/tag-management"), ("archive-center", "/archive-center"),
        ("assessment-report", "/assessment-report"),
        ("proctor-dashboard", "/proctor-dashboard"), ("command", "/command"),
        ("system", "/system"), ("ai-question-generator", "/ai-question-generator"),
        ("exam-recording", "/exam-recording"), ("organization", "/organization"),
        ("question-bank-manage", "/question-bank-manage"),
        ("certificate", "/certificate"), ("command-center", "/command-center"),
        ("demo-center", "/demo-center"), ("mobile-preview", "/mobile-preview"),
        ("live-classroom", "/live-classroom"), ("survey", "/survey"),
        ("forum", "/forum"), ("knowledge-graph", "/knowledge-graph"),
        ("learning-loop", "/learning-loop"), ("exam-analysis", "/exam-analysis"),
        ("teacher-dashboard", "/teacher-dashboard"),
        ("course-objective", "/course-objective"), ("ai-grading", "/ai-grading"),
    ],
    "teacher": [("home", "/")],
    "student": [
        ("home", "/"), ("portrait", "/portrait"),
        ("student-dashboard", "/student-dashboard"),
        ("adaptive-learning", "/adaptive-learning"), ("wrong-book", "/wrong-book"),
        ("speaking-test", "/speaking-test"), ("exam-room", "/exam-room/1"),
        ("checkin", "/checkin/1"), ("result", "/result/1"),
        ("info-collection", "/info-collection"),
    ],
    "proctor": [("home", "/")],
}

ACCOUNTS = {
    "admin": ("admin", "admin123"),
    "teacher": ("teacher", "teacher123"),
    "student": ("stu01", "123456"),
    "proctor": ("proctor", "proctor123"),
}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        login_context = browser.new_context(viewport={"width": 1600, "height": 900}, device_scale_factor=1)
        login_page = login_context.new_page()
        login_page.goto(BASE + "/login", wait_until="domcontentloaded")
        login_page.wait_for_load_state("networkidle", timeout=10000)
        if not (OUTPUT / "login.png").exists():
            login_page.screenshot(path=str(OUTPUT / "login.png"), full_page=True)
        manifest.append({"role": "public", "route": "/login", "file": "login.png", "url": login_page.url})
        login_context.close()

        selected_roles = os.environ.get("HENGJIAN_CAPTURE_ROLES", "student,proctor,teacher,admin").split(",")
        selected_routes = set(filter(None, os.environ.get("HENGJIAN_CAPTURE_ROUTES", "").split(",")))
        for role in selected_roles:
            routes = [(name, route) for name, route in ROUTES[role] if not selected_routes or name in selected_routes]
            pending = [(name, route) for name, route in routes
                       if not (OUTPUT / f"{role}-{name}.png").exists() or (role, name) == ("teacher", "home")]
            if not pending:
                manifest.extend({"role": role, "route": route, "file": f"{role}-{name}.png", "status": "captured"}
                                for name, route in routes)
                continue
            username, password = ACCOUNTS[role]
            request_context = playwright.request.new_context(timeout=12000)
            response = request_context.post(
                API + "/api/auth/login",
                data=json.dumps({"username": username, "password": password}),
                headers={"Content-Type": "application/json"},
            )
            if not response.ok:
                raise RuntimeError(f"Demo login failed for {role}: HTTP {response.status} {response.text()[:180]}")
            identity = response.json()
            request_context.dispose()
            context = browser.new_context(
                viewport={"width": 1600, "height": 900},
                device_scale_factor=1,
                color_scheme="dark",
                permissions=["camera", "microphone"],
            )
            context.add_init_script(
                "localStorage.setItem('token', %s); localStorage.setItem('user', %s);"
                % (json.dumps(identity["token"]), json.dumps(json.dumps(identity["user"], ensure_ascii=False)))
            )
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            for name, route in routes:
                file_name = f"{role}-{name}.png"
                entry = {"role": role, "route": route, "file": file_name}
                if (name, route) not in pending:
                    entry["status"] = "captured"
                    manifest.append(entry)
                    continue
                try:
                    page.goto(BASE + route, wait_until="domcontentloaded", timeout=20000)
                    try:
                        page.wait_for_load_state("networkidle", timeout=8000)
                    except PlaywrightTimeoutError:
                        pass
                    if (role, name) == ("teacher", "home"):
                        try:
                            page.get_by_text("加载教学工作台...").wait_for(state="hidden", timeout=20000)
                        except PlaywrightTimeoutError:
                            pass
                    page.wait_for_timeout(700)
                    page.screenshot(path=str(OUTPUT / file_name), full_page=True, animations="disabled")
                    entry.update(url=page.url, title=page.title(), h1=page.locator("h1").all_text_contents()[:3], errors=errors[-3:])
                    print(f"CAPTURED {role:8} {route}", flush=True)
                except Exception as exc:
                    entry["error"] = str(exc)[:300]
                    print(f"FAILED   {role:8} {route}: {exc}", flush=True)
                manifest.append(entry)
                (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
                errors.clear()
            context.close()
        browser.close()
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    cards = "\n".join(
        f'<a class="shot" href="{escape(item["file"])}" target="_blank">'
        f'<img src="{escape(item["file"])}" alt="{escape(item["route"])}" loading="lazy">'
        f'<strong>{escape(item["role"])} · {escape(item["route"])}</strong></a>'
        for item in manifest if (OUTPUT / item["file"]).exists()
    )
    gallery = f"""<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>衡鉴智考 · 前端页面截图索引</title>
<style>body{{margin:0;background:#071632;color:#e6f5ff;font:14px system-ui,'Microsoft YaHei',sans-serif}}
header{{padding:30px 34px;border-bottom:1px solid #2d8dd0;background:linear-gradient(90deg,#0b2f68,#071632)}}
h1{{margin:0 0 8px;font-size:26px}}p{{margin:0;color:#a3c9e7}}main{{padding:26px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}}
.shot{{display:block;overflow:hidden;border:1px solid #2677b8;border-radius:12px;background:#0a2146;color:inherit;text-decoration:none;box-shadow:0 7px 22px #0005}}
.shot:hover{{border-color:#59d3ff;transform:translateY(-2px)}}img{{display:block;width:100%;height:180px;object-fit:cover;object-position:top;border-bottom:1px solid #245e91}}
strong{{display:block;padding:12px 14px;font-weight:600}}</style>
<header><h1>衡鉴智考 · 页面截图索引</h1><p>共 {len(manifest)} 个页面视图，点击卡片查看完整截图。截图仅用于设计复核，网页本身由可编辑源码构成。</p></header><main>{cards}</main></html>"""
    (OUTPUT / "index.html").write_text(gallery, encoding="utf-8")
    print(f"Saved {len(manifest)} route records to {OUTPUT}")


if __name__ == "__main__":
    main()
