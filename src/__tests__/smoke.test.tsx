import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import App from "../App";

describe("App", () => {
  it("renders the user portal shell", () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(screen.getByRole("heading", { name: "Temporary mail." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Log in to V-Mail" })).toBeInTheDocument();
  });
});
