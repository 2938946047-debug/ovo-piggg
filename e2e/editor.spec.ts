import { expect, test } from "@playwright/test";

test("dashboard opens the editor and keeps a white page", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "我的摄影书" })).toBeVisible();
  await page.getByRole("button", { name: /编辑 白色海岸练习/ }).click();
  await expect(page.getByLabel("内容工具")).toBeVisible();
  await expect(page.getByTestId("canvas-shell")).toBeVisible();
  await expect.poll(() => page.locator("canvas").evaluateAll((canvases) => {
    return canvases.reduce((total, item) => {
      const canvas = item as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (!context) return total;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 0 && (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245)) count += 1;
      }
      return total + count;
    }, 0);
  }), { timeout: 10_000 }).toBeGreaterThan(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "添加文字" }).click();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "属性" }).click();
    await expect(page.locator(".mobile-inspector-sheet").getByLabel("元素属性")).toBeVisible();
  } else {
    await expect(page.getByLabel("元素属性")).toBeVisible();
  }
  const inspector = testInfo.project.name === "mobile" ? page.locator(".mobile-inspector-sheet") : page.locator(".desktop-inspector");
  await expect(inspector.getByLabel("字体")).toHaveValue("serif");
  await expect(inspector.getByLabel("字体").locator("option")).toHaveCount(7);
  await inspector.getByLabel("字体").selectOption("kai");
  await expect(inspector.getByLabel("字体")).toHaveValue("kai");
});

test("export dialog offers a page image and a complete transition video", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /编辑 白色海岸练习/ }).click();
  await page.getByRole("button", { name: "导出" }).click();
  await expect(page.getByRole("heading", { name: "导出摄影书" })).toBeVisible();
  await expect(page.getByRole("button", { name: "导出当前页图片" })).toBeVisible();
  await expect(page.getByRole("button", { name: "导出完整视频" })).toBeVisible();
  await expect(page.getByLabel("单页格式")).toHaveValue("png");
  await expect(page.getByLabel("每页时长")).toHaveValue("5");
  await expect.poll(() => page.evaluate(() => typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function")).toBe(true);
});

test("reader AI requires email verification and has an in-memory demo flow", async ({ page }) => {
  await page.goto("/?book=white-coast-study");
  await page.getByRole("button", { name: /问问 AI/ }).click();
  await expect(page.getByRole("heading", { name: "登录后继续提问" })).toBeVisible();
  await page.getByPlaceholder("name@example.com").fill("reader@example.com");
  await page.getByRole("button", { name: "发送验证码" }).click();
  await page.getByPlaceholder("246810").fill("246810");
  await page.getByRole("button", { name: "验证并登录" }).click();
  await expect(page.getByRole("heading", { name: "从这一页开始" })).toBeVisible();
});

test("public reader is read-only and a verified visitor can comment", async ({ page }) => {
  await page.goto("/?book=white-coast-study");
  await expect(page.getByRole("button", { name: "添加文字" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /发布/ })).toHaveCount(0);
  await page.getByRole("button", { name: "查看评论" }).click();
  await expect(page.getByRole("heading", { name: "登录后发表评论" })).toBeVisible();
  await page.locator(".comments-panel").evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const panelBox = await page.locator(".comments-panel").boundingBox();
  const viewport = page.viewportSize();
  expect(panelBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.y).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(viewport!.height + 1);
  await page.getByPlaceholder("name@example.com").fill("reader@example.com");
  await page.getByRole("button", { name: "发送验证码" }).click();
  await page.getByPlaceholder("六位验证码").fill("246810");
  await page.getByRole("button", { name: "验证并登录" }).click();
  await page.getByPlaceholder("写下你的评论…").fill("很喜欢这一页的留白节奏。 ");
  await page.getByRole("button", { name: "发布评论" }).click();
  await expect(page.locator(".comment-item p").last()).toHaveText("很喜欢这一页的留白节奏。", { timeout: 10_000 });
});
