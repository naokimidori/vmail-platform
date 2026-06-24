import { describe, expect, it } from "vitest";

import { parseMailboxDomains } from "../config/env";

describe("mailbox domain env parsing", () => {
  it("parses comma-separated mailbox domains and removes duplicates", () => {
    expect(parseMailboxDomains("vinoz.tech, vino.cc.cd, vinoss.us.ci, vinoz.tech")).toEqual([
      "vinoz.tech",
      "vino.cc.cd",
      "vinoss.us.ci",
    ]);
  });

  it("defaults to example.com when undefined", () => {
    expect(parseMailboxDomains(undefined)).toEqual(["example.com"]);
  });

  it("defaults to example.com when the domain list is empty", () => {
    expect(parseMailboxDomains(" , ")).toEqual(["example.com"]);
  });
});
