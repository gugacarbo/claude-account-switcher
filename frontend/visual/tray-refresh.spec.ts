import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  test(`tray refresh is reachable by keyboard at native width (${colorScheme})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 340, height: 350 });
    await page.emulateMedia({ colorScheme });
    await page.clock.setFixedTime(new Date("2030-01-01T10:00:00Z"));
    await page.goto(
      "/iframe.html?id=app-tray--tray-three-accounts&viewMode=story",
    );
    const menu = page.getByRole("menu", { name: "Application menu" });
    const refresh = menu.getByRole("menuitem", { name: "Refresh usage" });
    await expect(menu.getByRole("heading", { name: "Accounts" })).toBeVisible();
    await expect(refresh).toBeEnabled();
    await expect(page.locator("html")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(menu).toHaveCSS(
      "background-color",
      colorScheme === "dark" ? "rgb(45, 45, 40)" : "rgb(255, 254, 250)",
    );
    const accounts = menu.locator(".tray-accounts");
    await expect(accounts).toHaveCSS("margin-top", "4px");
    await expect(accounts).toHaveCSS("margin-bottom", "4px");
    await page.evaluate(() => document.fonts.ready);
    await testInfo.attach("tray", {
      body: await menu.screenshot(),
      contentType: "image/png",
    });

    const quit = menu.getByRole("menuitem", { name: "Quit" });
    await expect(quit).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Tab");
    await expect(refresh).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(refresh).toBeEnabled();
    await expect(
      menu.getByRole("menuitemradio", { checked: true }),
    ).toBeVisible();
    await refresh.focus();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitemradio").nth(1)).toBeFocused();
  });
}
