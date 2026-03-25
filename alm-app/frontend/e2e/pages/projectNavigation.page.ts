import { expect, type Page } from "@playwright/test";

export class ProjectNavigationPage {
  constructor(private readonly page: Page) {}

  async openProjectQuality() {
    await this.page.goto("/");
    await expect(this.page).not.toHaveURL(/\/login/);
    await this.page.waitForLoadState("networkidle");
    const orgPath = new URL(this.page.url()).pathname;
    const segments = orgPath.split("/").filter(Boolean);
    const orgSlug = segments[0];
    expect(orgSlug).toBeTruthy();
    await this.page.getByTestId("project-card").first().click({ timeout: 10000 });
    await this.page.waitForURL(new RegExp(`/${orgSlug}/[a-z0-9-]+`), { timeout: 10000 });
    await this.page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Quality" }).click();
    await this.page.waitForURL(new RegExp(`/${orgSlug}/[^/]+/quality`), { timeout: 10000 });
    return orgSlug;
  }
}

