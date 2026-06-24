import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import indexHtml from "../../index.html?raw";
import { VmailLogo } from "../components/ui/vmail-logo";

describe("logo assets", () => {
  it("renders the generated V-Mail logo image asset", () => {
    render(<VmailLogo className="h-10 w-10" />);

    expect(screen.getByRole("img", { name: "V-Mail technology logo" })).toHaveAttribute(
      "src",
      "/assets/vmail-logo-generated.png",
    );
  });

  it("uses the generated logo for the browser tab icon", () => {
    expect(indexHtml).toContain('rel="icon"');
    expect(indexHtml).toContain('href="/favicon.png"');
  });
});
