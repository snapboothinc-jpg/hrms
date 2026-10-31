import { expect, test } from "@playwright/test";

function isLoopback(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (isLoopback(url.hostname)) {
      await route.continue();
      return;
    }

    await route.abort();
  });
});

test("renders the sign-in form and development demo disclosure", async ({ page }) => {
  await page.goto("/auth");

  await expect(page).toHaveTitle("Sign in — Priority Handling Logistics, Inc.");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email *" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Password *" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("Demo accounts")).toBeVisible();
});

test("rejects invalid sign-in input before making an authentication request", async ({ page }) => {
  const authenticationRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/auth/v1/")) {
      authenticationRequests.push(request.url());
    }
  });

  await page.goto("/auth");
  await page.waitForLoadState("networkidle");
  const email = page.getByRole("textbox", { name: "Email *" });
  const password = page.getByRole("textbox", { name: "Password *" });
  await email.fill("not-an-email");
  await password.fill("");
  await expect(email).toHaveValue("not-an-email");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Enter a valid email", { exact: true })).toBeVisible();
  await expect(page.getByText("Enter your password", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/auth$/);
  expect(authenticationRequests).toEqual([]);
});

test("redirects anonymous dashboard navigation to sign-in", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/auth\?redirect=%2Fdashboard$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
});

test("keeps the sign-in form within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  const fitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fitsViewport).toBe(true);
});
