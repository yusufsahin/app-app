import { expect, type Page } from "@playwright/test";

export class ArtifactsPage {
  constructor(private readonly page: Page) {}

  async openFromProjectRoot(orgSlug: string) {
    await this.page.waitForURL(new RegExp(`/${orgSlug}/[a-z0-9-]+`), { timeout: 10000 });
    const url = new URL(this.page.url());
    const parts = url.pathname.split("/").filter(Boolean);
    const projectSlug = parts[1];
    if (!projectSlug) throw new Error("Unable to resolve project slug from URL");
    await this.page.goto(`/${orgSlug}/${projectSlug}/artifacts`);
    await this.page.waitForURL(/\/artifacts/, { timeout: 10000 });
    await expect(this.page.getByRole("heading", { name: /artifacts/i })).toBeVisible({ timeout: 10000 });
  }

  async createArtifact(title: string) {
    await this.page.getByRole("button", { name: /New (artifact|work item|epic|issue)/i }).click();
    const menuItem = this.page.getByRole("menuitem", { name: /epic|issue/i }).first();
    if (await menuItem.isVisible().catch(() => false)) await menuItem.click();
    const createDialog = this.page.getByRole("dialog").first();
    await createDialog.waitFor({ state: "visible", timeout: 10000 });
    const titleByTestId = createDialog.getByTestId("artifact-title-input");
    if (await titleByTestId.isVisible().catch(() => false)) {
      await titleByTestId.fill(title);
    } else {
      await createDialog.getByRole("textbox", { name: /title|enter title/i }).fill(title);
    }
    const saveByTestId = createDialog.getByTestId("artifact-save-button");
    if (await saveByTestId.isVisible().catch(() => false)) {
      await saveByTestId.click();
    } else {
      await createDialog.getByRole("button", { name: "Save" }).click();
    }
    await expect(this.page.getByText(title)).toBeVisible({ timeout: 15000 });
  }
}

