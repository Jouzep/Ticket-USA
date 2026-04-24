"""Exploration script — visit the DMV page once and dump structure.

Goal: understand the actual form fields, button labels, and any obstacles
(CAPTCHA, JS gating, redirects) before refining the production scraper.

Usage:
    PYTHONPATH=. python scripts/explore_dmv.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

DMV_URL = "https://process.dmv.ny.gov/WebSummonsInquiry/"
OUT_DIR = Path(__file__).parent.parent / "scripts" / "dmv-debug"
OUT_DIR.mkdir(parents=True, exist_ok=True)


async def main() -> int:
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=os.environ.get("HEADED", "0") != "1",
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/130.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        print(f"→ Navigating to {DMV_URL}")
        try:
            response = await page.goto(DMV_URL, timeout=30000, wait_until="domcontentloaded")
        except Exception as exc:  # noqa: BLE001
            print(f"❌ Navigation failed: {exc}")
            await browser.close()
            return 1

        print(f"   status={response.status if response else 'n/a'}")
        print(f"   url={page.url}")

        await page.wait_for_load_state("networkidle", timeout=15000)

        # Snapshot
        screenshot = OUT_DIR / "01_landing.png"
        await page.screenshot(path=str(screenshot), full_page=True)
        print(f"   📸 {screenshot.name}")

        html = await page.content()
        (OUT_DIR / "01_landing.html").write_text(html)
        print(f"   📄 01_landing.html ({len(html)} chars)")

        # Inventory
        forms = await page.locator("form").count()
        inputs = await page.locator("input").count()
        buttons = await page.locator("button, input[type=submit]").count()
        radios = await page.locator("input[type=radio]").count()
        links = await page.locator("a").count()
        print(f"   forms={forms}  inputs={inputs}  buttons={buttons}  radios={radios}  links={links}")

        # CAPTCHA
        captcha_selectors = [
            "iframe[src*='recaptcha']",
            "iframe[src*='hcaptcha']",
            "div.g-recaptcha",
            "[name*='captcha' i]",
        ]
        for sel in captcha_selectors:
            count = await page.locator(sel).count()
            if count:
                print(f"   ⚠️  CAPTCHA marker present: {sel} ({count})")

        # Look for any "no license" affordance
        candidates = [
            "text=No, I do not have a NY State license",
            "text=No, I do not have a NY State driver license",
            "text=I do not have",
            "text=No license",
            "label:has(input[type=radio])",
            "input[type=radio]",
        ]
        for sel in candidates:
            count = await page.locator(sel).count()
            if count:
                first_text = await page.locator(sel).first.inner_text()
                print(f"   ✓ {sel} ({count}) → {first_text!r}")

        # Print all visible button/link labels for sanity
        try:
            button_texts = await page.locator("button, a").all_inner_texts()
            interesting = [t.strip() for t in button_texts if t.strip()]
            print(f"\n   Button/link labels ({len(interesting)}):")
            for t in interesting[:25]:
                print(f"     • {t}")
        except Exception:  # noqa: BLE001
            pass

        await browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
