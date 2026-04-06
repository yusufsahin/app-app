import { test, expect } from "@playwright/test";

/**
 * Requires a real backend with demo seed (admin@example.com / Admin123!, org demo).
 * Same as auth.setup.ts — use Docker stack or PLAYWRIGHT_START_BACKEND + DB seed.
 */
const DEMO_ORG = "demo";
const SAMPLE_PROJECT = "sample-project";

function attachBrowserLogging(page: import("@playwright/test").Page, testSlug: string) {
  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      console.log(`[e2e:${testSlug}][browser:${type}]`, msg.text());
    }
    if (type === "info" && msg.text().includes("[alm:backlog]")) {
      console.log(`[e2e:${testSlug}][browser:info]`, msg.text());
    }
  });
  page.on("pageerror", (err) => {
    console.log(`[e2e:${testSlug}][pageerror]`, err.message);
  });
}

test.describe("Demo-seeded backlog (E2E)", () => {
  test("sample project backlog shows seeded items, not empty state", async ({ page }, testInfo) => {
    test.setTimeout(45000);
    attachBrowserLogging(page, testInfo.title.slice(0, 40));

    await test.step("open app (authenticated storage state)", async () => {
      console.log("[e2e:demo-backlog] navigating to /");
      await page.goto("/");
      await expect(page).not.toHaveURL(/\/login/);
      await page.waitForLoadState("networkidle");
    });

    await test.step(`open backlog /${DEMO_ORG}/${SAMPLE_PROJECT}/backlog`, async () => {
      const backlogUrl = `/${DEMO_ORG}/${SAMPLE_PROJECT}/backlog`;
      console.log("[e2e:demo-backlog] navigating to", backlogUrl);
      await page.goto(backlogUrl);
      await page.waitForLoadState("networkidle");
    });

    await test.step("wait for project shell (not stuck loading)", async () => {
      await expect(page.getByText("Loading project…")).not.toBeVisible({ timeout: 15000 });
    });

    await test.step("assert backlog is not empty-state", async () => {
      const emptyTitle = page.getByText("No backlog items yet");
      await expect(emptyTitle).not.toBeVisible({ timeout: 12000 });
    });

    await test.step("assert seeded demo row visible", async () => {
      // Demo hydrate / full seed creates at least this titled leaf under requirement tree (basic template).
      await expect(page.getByText("Sample work item", { exact: false }).first()).toBeVisible({
        timeout: 15000,
      });
      console.log("[e2e:demo-backlog] saw Sample work item — ok");
    });
  });
});
