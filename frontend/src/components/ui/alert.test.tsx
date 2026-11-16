import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "./alert";

afterEach(cleanup);

describe("Alert (shadcn/ui)", () => {
  it("announces itself with the alert role and composes title/description", () => {
    render(
      <Alert>
        <AlertTitle>Working on it</AlertTitle>
        <AlertDescription>Your sign-ins are kept safe.</AlertDescription>
      </Alert>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-slot", "alert");
    expect(screen.getByText("Working on it")).toHaveAttribute(
      "data-slot",
      "alert-title",
    );
    expect(screen.getByText("Your sign-ins are kept safe.")).toHaveAttribute(
      "data-slot",
      "alert-description",
    );
  });

  it("uses the destructive variant for errors", () => {
    render(
      <Alert variant="destructive">
        <AlertTitle>Switch failed</AlertTitle>
        <AlertDescription>Try again.</AlertDescription>
        <AlertAction>Retry</AlertAction>
      </Alert>,
    );
    expect(screen.getByRole("alert").className).toContain("text-destructive");
    expect(screen.getByText("Retry")).toHaveAttribute(
      "data-slot",
      "alert-action",
    );
  });
});
