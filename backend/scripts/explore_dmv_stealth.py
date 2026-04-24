"""Stealth-ish exploration: try to defeat the F5 BIG-IP anti-bot challenge.

Approach (escalating):
  1. Real Chromium channel (not headless shell)
  2. Headed mode (visible browser)
  3. Patch obvious automation markers (navigator.webdriver, plugins, languages)
  4. Wait long enough for the TSPD challenge to resolve
  5. Pre-set cookies if a successful session is supplied via DMV_COOKIE env
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

DMV_URL = "https://process.dmv.ny.gov/WebSummonsInquiry/"
OUT = Path(__file__).parent / "dmv-debug"
OUT.mkdir(parents=True, exist_ok=True)

STEALTH_INIT_JS = """
// Defeat the most common automation signatures.
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
window.chrome = { runtime: {} };
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (params) =>
  params.name === 'notifications'
    ? Promise.resolve({ state: Notification.permission })
    : originalQuery(params);
"""


async def main() -> int:
    async with async_playwright() as p:
        # Use full Chromium channel (not headless shell), headed when allowed.
        headless = os.environ.get("HEADED", "0") != "1"
        try:
            browser = await p.chromium.launch(
                headless=headless,
                channel="chromium",
                args=[
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                ],
            )
        except Exception as exc:  # noqa: BLE001
            print(f"Falling back to default channel: {exc}")
            browser = await p.chromium.launch(
                headless=headless,
                args=[
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                ],
            )

        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/130.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
            locale="en-US",
            timezone_id="America/New_York",
        )
        await context.add_init_script(STEALTH_INIT_JS)

        page = await context.new_page()
        print(f"→ {DMV_URL}  (headless={headless})")
        try:
            response = await page.goto(DMV_URL, timeout=45000, wait_until="load")
        except Exception as exc:  # noqa: BLE001
            print(f"❌ goto failed: {exc}")
            await browser.close()
            return 1

        print(f"   status={response.status if response else 'n/a'}")
        # Give TSPD plenty of time to issue its challenge cookies.
        await page.wait_for_timeout(10000)
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:  # noqa: BLE001
            pass

        # Capture
        await page.screenshot(path=str(OUT / "02_post_challenge.png"), full_page=True)
        html = await page.content()
        (OUT / "02_post_challenge.html").write_text(html)
        print(f"   📄 02_post_challenge.html ({len(html)} chars)")

        forms = await page.locator("form").count()
        inputs = await page.locator("input").count()
        buttons = await page.locator("button, input[type=submit]").count()
        radios = await page.locator("input[type=radio]").count()
        print(f"   forms={forms}  inputs={inputs}  buttons={buttons}  radios={radios}")

        # Is there still a challenge marker?
        if "Please enable JavaScript" in html or "support ID" in html:
            print("   ⚠️  Still on challenge page — TSPD not satisfied")

        if forms or inputs:
            try:
                texts = await page.locator("body").inner_text()
                print("\n   First 600 chars of body text:\n" + texts[:600])
            except Exception:  # noqa: BLE001
                pass

        await browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
