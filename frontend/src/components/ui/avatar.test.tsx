import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "./avatar";

afterEach(cleanup);

describe("Avatar (shadcn/ui)", () => {
  it("shows the fallback initial while no image is loaded", () => {
    render(
      <Avatar>
        <AvatarImage src="" alt="Gustavo" />
        <AvatarFallback>G</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("G")).toHaveAttribute(
      "data-slot",
      "avatar-fallback",
    );
  });

  it("supports sizes and the status badge", () => {
    render(
      <Avatar size="lg" data-testid="avatar">
        <AvatarFallback>G</AvatarFallback>
        <AvatarBadge data-testid="badge" />
      </Avatar>,
    );
    expect(screen.getByTestId("avatar")).toHaveAttribute("data-size", "lg");
    expect(screen.getByTestId("badge")).toHaveAttribute(
      "data-slot",
      "avatar-badge",
    );
  });

  it("groups avatars with an overflow count", () => {
    render(
      <AvatarGroup data-testid="group">
        <Avatar>
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>B</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>,
    );
    expect(screen.getByTestId("group")).toHaveAttribute(
      "data-slot",
      "avatar-group",
    );
    expect(screen.getByText("+3")).toHaveAttribute(
      "data-slot",
      "avatar-group-count",
    );
  });
});
