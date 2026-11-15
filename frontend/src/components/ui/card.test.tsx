import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

afterEach(cleanup);

describe("Card (shadcn/ui)", () => {
  it("composes header, title, description, action, content and footer", () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>gustavo@example.com</CardTitle>
          <CardDescription>Pro plan</CardDescription>
          <CardAction>Manage</CardAction>
        </CardHeader>
        <CardContent>5-hour usage</CardContent>
        <CardFooter>Ready when you are</CardFooter>
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveAttribute("data-slot", "card");
    expect(screen.getByText("gustavo@example.com")).toHaveAttribute(
      "data-slot",
      "card-title",
    );
    expect(screen.getByText("Pro plan")).toHaveAttribute(
      "data-slot",
      "card-description",
    );
    expect(screen.getByText("Manage")).toHaveAttribute(
      "data-slot",
      "card-action",
    );
    expect(screen.getByText("5-hour usage")).toHaveAttribute(
      "data-slot",
      "card-content",
    );
    expect(screen.getByText("Ready when you are")).toHaveAttribute(
      "data-slot",
      "card-footer",
    );
  });

  it("supports the compact size and custom classes", () => {
    render(
      <Card size="sm" className="account-card" data-testid="card">
        <CardHeader data-testid="header">Compact</CardHeader>
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveAttribute("data-size", "sm");
    expect(screen.getByTestId("card").className).toContain("account-card");
    expect(screen.getByTestId("header")).toHaveAttribute(
      "data-slot",
      "card-header",
    );
  });
});
