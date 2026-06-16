import { describe, expect, it } from "vitest";

import { formatDatabaseDateTime } from "../../admin/utils/date";

describe("formatDatabaseDateTime", () => {
  it("treats bare database datetime strings as UTC and formats them in the requested timezone", () => {
    expect(formatDatabaseDateTime("2026-06-11 09:17:02", { timeZone: "Asia/Shanghai" })).toBe(
      "2026/6/11 17:17:02",
    );
  });

  it("can omit seconds after converting to the requested timezone", () => {
    expect(formatDatabaseDateTime("2026-06-03 08:50:00", { seconds: false, timeZone: "Asia/Shanghai" })).toBe(
      "2026/6/3 16:50",
    );
  });
});
