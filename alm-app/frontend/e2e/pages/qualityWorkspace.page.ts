import { expect, type Page } from "@playwright/test";

export class QualityWorkspacePage {
  constructor(private readonly page: Page) {}

  private getRouteContext() {
    const current = new URL(this.page.url());
    const seg = current.pathname.split("/").filter(Boolean);
    const orgSlug = seg[0];
    const projectSlug = seg[1];
    return { current, orgSlug, projectSlug };
  }

  async openTests() {
    await this.page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Tests" }).click();
    await this.page.waitForURL(/\/quality\/tests/, { timeout: 10000 });
  }

  async openSuites() {
    await this.page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Suites" }).click();
    await this.page.waitForURL(/\/quality\/suites/, { timeout: 10000 });
  }

  async openRuns() {
    await this.page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Runs" }).click();
    await this.page.waitForURL(/\/quality\/runs/, { timeout: 10000 });
  }

  async selectFirstQualityFolder() {
    const folderByType = this.page.locator('[data-artifact-type="quality-folder"]').first();
    if (await folderByType.isVisible().catch(() => false)) {
      await folderByType.click({ timeout: 10000 });
    } else {
      // Legacy fallback when node metadata is unavailable
      await this.page.locator("aside").getByRole("button").nth(1).click({ timeout: 10000 });
    }
    await expect(this.page).toHaveURL(/under=[0-9a-f-]{36}/i, { timeout: 10000 });
  }

  private async ensureUnderParam() {
    const current = new URL(this.page.url());
    if (current.searchParams.get("under")) return;
    await this.selectFirstQualityFolder().catch(() => undefined);
    const afterClick = new URL(this.page.url());
    if (afterClick.searchParams.get("under")) return;

    // Fallback: use root-quality id when no concrete folder is visible.
    const seg = afterClick.pathname.split("/").filter(Boolean);
    const orgSlug = seg[0];
    const projectSlug = seg[1];
    if (!orgSlug || !projectSlug) return;
    const rootRes = await this.page.request.get(`/api/v1/orgs/${orgSlug}/projects/${projectSlug}/artifacts?tree=quality&include_system_roots=true&limit=200`);
    if (!rootRes.ok()) return;
    const data = (await rootRes.json()) as { items?: Array<{ id: string; artifact_type: string }> };
    const root = (data.items ?? []).find((i) => i.artifact_type === "root-quality");
    if (!root) return;
    afterClick.searchParams.set("under", root.id);
    await this.page.goto(afterClick.toString());
    await expect(this.page).toHaveURL(/under=[0-9a-f-]{36}/i, { timeout: 10000 });
  }

  async createItemFromModal(title: string) {
    await this.ensureUnderParam();
    const createButtonByTestId = this.page.getByTestId("quality-create-button");
    const createButtonByRole = this.page.getByRole("button", { name: /Create (test case|suite|run|campaign)/i });
    if (await createButtonByTestId.isVisible().catch(() => false)) await createButtonByTestId.click();
    else await createButtonByRole.click();

    const dialog = this.page.getByRole("dialog");
    const modalTitleInputByTestId = this.page.getByTestId("artifact-modal-title-input");
    const modalTitleInputByRole = dialog.getByRole("textbox", { name: /enter title|title/i }).first();
    const hasModal = await dialog.isVisible().catch(() => false);
    if (hasModal || (await modalTitleInputByTestId.isVisible().catch(() => false))) {
      if (await modalTitleInputByTestId.isVisible().catch(() => false)) await modalTitleInputByTestId.fill(title);
      else await modalTitleInputByRole.fill(title);
      const createModalButton = this.page.getByTestId("artifact-modal-create").or(dialog.getByRole("button", { name: /Create/i }).first());
      if (await createModalButton.isDisabled().catch(() => false)) {
        // Test-case modal requires at least one valid step.
        const addStepButton = this.page.getByTestId("step-add-button");
        if (await addStepButton.isVisible().catch(() => false)) {
          await addStepButton.click();
          await dialog.getByLabel(/action/i).first().fill("Open the target page");
          await dialog.getByLabel(/expected result/i).first().fill("Page loads successfully");
        }
      }
      await createModalButton.click();
    } else {
      // Legacy inline create fallback
      await this.page.getByPlaceholder(/Create .* title/i).fill(title);
      await createButtonByRole.click();
    }
    await expect(this.page.getByText(title).first()).toBeVisible({ timeout: 20000 });
  }

  /** Create a test-case artifact with N steps (action text per step). Requires Tests page + steps editor. */
  async createTestCaseWithStepActions(title: string, actions: string[]) {
    await this.ensureUnderParam();
    const createButtonByTestId = this.page.getByTestId("quality-create-button");
    const createButtonByRole = this.page.getByRole("button", { name: /Create test case/i });
    if (await createButtonByTestId.isVisible().catch(() => false)) await createButtonByTestId.click();
    else await createButtonByRole.click();

    const dialog = this.page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await this.page.getByTestId("artifact-modal-title-input").fill(title);

    for (let i = 0; i < actions.length; i++) {
      await dialog.getByTestId("step-add-button").click();
      await dialog.getByLabel(/action/i).nth(i).fill(actions[i]!);
    }

    await this.page.getByTestId("artifact-modal-create").click();
    await expect(this.page.getByText(title).first()).toBeVisible({ timeout: 20000 });
  }

  async findQualityArtifactIdByTitle(title: string, artifactType: string) {
    const { orgSlug, projectSlug } = this.getRouteContext();
    expect(orgSlug).toBeTruthy();
    expect(projectSlug).toBeTruthy();
    const res = await this.page.request.get(
      `/api/v1/orgs/${orgSlug}/projects/${projectSlug}/artifacts?tree=quality&include_system_roots=true&limit=500`,
    );
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()) as {
      items?: Array<{ id: string; artifact_type: string; title: string }>;
    };
    const item = (data.items ?? []).find((i) => i.artifact_type === artifactType && i.title === title);
    expect(item?.id).toBeTruthy();
    return item!.id;
  }

  async openLeafEditFromTree(artifactId: string) {
    await this.page.getByTestId(`quality-tree-leaf-menu-${artifactId}`).click();
    await this.page.getByTestId(`quality-tree-leaf-edit-${artifactId}`).click();
    await expect(this.page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
  }

  async clearFolderFilter() {
    const clearByTestId = this.page.getByTestId("quality-tree-clear-filter");
    if (await clearByTestId.isVisible().catch(() => false)) {
      await clearByTestId.click({ timeout: 10000 });
    } else {
      await this.page.getByRole("button", { name: /Clear folder filter/i }).click({ timeout: 10000 });
    }
    await expect(this.page).not.toHaveURL(/under=/i, { timeout: 10000 });
  }

  async selectedFolderIdFromUrl() {
    const { current } = this.getRouteContext();
    const under = current.searchParams.get("under");
    expect(under).toMatch(/^[0-9a-f-]{36}$/i);
    return under as string;
  }

  async createSubfolderUnder(parentFolderId: string, title: string) {
    await this.page.getByTestId(`quality-tree-folder-menu-${parentFolderId}`).click();
    const createSubfolder = this.page.getByTestId(`quality-tree-create-subfolder-${parentFolderId}`);
    await expect(createSubfolder).toBeVisible({ timeout: 10000 });
    await createSubfolder.click();
    const dialog = this.page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await this.page.getByTestId("artifact-modal-title-input").fill(title);
    await this.page.getByTestId("artifact-modal-create").click();
    await expect(this.page.getByText(title).first()).toBeVisible({ timeout: 20000 });
  }

  async findFolderIdByTitle(title: string) {
    const { orgSlug, projectSlug } = this.getRouteContext();
    expect(orgSlug).toBeTruthy();
    expect(projectSlug).toBeTruthy();
    const res = await this.page.request.get(
      `/api/v1/orgs/${orgSlug}/projects/${projectSlug}/artifacts?tree=quality&include_system_roots=true&limit=500`,
    );
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()) as {
      items?: Array<{ id: string; artifact_type: string; title: string }>;
    };
    const item = (data.items ?? []).find((i) => i.artifact_type === "quality-folder" && i.title === title);
    expect(item?.id).toBeTruthy();
    return item!.id;
  }

  async renameFolderById(folderId: string, newTitle: string) {
    await this.page.getByTestId(`quality-tree-folder-menu-${folderId}`).click();
    await this.page.getByTestId(`quality-tree-folder-rename-${folderId}`).click();
    const dialog = this.page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await this.page.getByTestId("artifact-modal-title-input").fill(newTitle);
    await this.page.getByTestId("artifact-modal-save").click();
    await expect(this.page.getByText(newTitle).first()).toBeVisible({ timeout: 20000 });
  }

  async deleteFolderById(folderId: string, titleToDisappear: string) {
    await this.page.getByTestId(`quality-tree-folder-menu-${folderId}`).click();
    await this.page.getByTestId(`quality-tree-folder-delete-${folderId}`).click();
    await this.page.getByTestId("artifact-modal-delete-confirm").click();
    await expect(this.page.getByText(titleToDisappear).first()).toHaveCount(0, { timeout: 20000 });
  }
}

