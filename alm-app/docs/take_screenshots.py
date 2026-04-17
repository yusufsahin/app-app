"""Take screenshots of Pamera app for the PPTX presentation."""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = Path(__file__).parent / "screenshots"
SCREENSHOTS_DIR.mkdir(exist_ok=True)

BASE    = "http://localhost:9001"
EMAIL   = "admin@example.com"
PASSWORD = "Admin123!"
ORG     = "demo"
PROJ    = "sample-project"

def shot(page, name, wait=1.5):
    page.wait_for_load_state("networkidle")
    time.sleep(wait)
    path = str(SCREENSHOTS_DIR / name)
    page.screenshot(path=path, full_page=False)
    print(f"  saved {name}")

def take_screenshots():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        # Login
        print("Logging in...")
        page.goto(f"{BASE}/login", wait_until="networkidle")
        page.fill('input[type="email"]', EMAIL)
        page.fill('input[type="password"]', PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        print(f"After login URL: {page.url}")

        # 1. Projects list
        print("Taking screenshots...")
        page.goto(f"{BASE}/{ORG}", wait_until="networkidle")
        shot(page, "01_projects.png")

        # 2. Dashboard
        page.goto(f"{BASE}/{ORG}/dashboard", wait_until="networkidle")
        shot(page, "02_dashboard.png")

        # 3. Backlog
        page.goto(f"{BASE}/{ORG}/{PROJ}/backlog", wait_until="networkidle")
        shot(page, "03_backlog.png")

        # 4. Board
        page.goto(f"{BASE}/{ORG}/{PROJ}/board", wait_until="networkidle")
        shot(page, "04_board.png")

        # 5. Quality - Catalog
        page.goto(f"{BASE}/{ORG}/{PROJ}/quality/catalog", wait_until="networkidle")
        shot(page, "05_quality_catalog.png")

        # 6. Quality - Traceability
        page.goto(f"{BASE}/{ORG}/{PROJ}/quality/traceability", wait_until="networkidle")
        shot(page, "06_traceability.png")

        # 7. Planning
        page.goto(f"{BASE}/{ORG}/{PROJ}/planning", wait_until="networkidle")
        shot(page, "07_planning.png")

        browser.close()
        print(f"\nDone! {len(list(SCREENSHOTS_DIR.glob('*.png')))} screenshots in: {SCREENSHOTS_DIR}")

if __name__ == "__main__":
    take_screenshots()
