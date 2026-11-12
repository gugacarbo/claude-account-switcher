import { expect, test } from "bun:test";
import { violation } from "./check-architecture";

test("features cannot import another feature", () => {
  expect(
    violation(
      "frontend/src/features/accounts/Card.tsx",
      "frontend/src/features/settings/Settings",
    ),
  ).toBe(true);
  expect(
    violation(
      "frontend/src/features/accounts/Card.tsx",
      "frontend/src/features/accounts/Meter",
    ),
  ).toBe(false);
  expect(
    violation("frontend/src/App.tsx", "frontend/src/features/accounts/Card"),
  ).toBe(false);
  expect(
    violation("frontend/src/features/accounts/Card.tsx", "frontend/src/bridge"),
  ).toBe(false);
});
