type DateTimeFormatOptions = { seconds?: boolean; timeZone?: string };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(options: DateTimeFormatOptions = {}) {
  const seconds = options.seconds !== false;
  const timeZone = options.timeZone ?? getLocalTimeZone();
  const cacheKey = `${timeZone}:${seconds ? "seconds" : "minutes"}`;
  const cached = formatterCache.get(cacheKey);

  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hourCycle: "h23",
  });
  formatterCache.set(cacheKey, formatter);
  return formatter;
}

function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
}

export function formatBeijingDateTime(value: string, options: { seconds?: boolean } = {}) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return formatDateParts(date, { ...options, timeZone: "Asia/Shanghai" }, true);
}

export function formatDatabaseDateTime(value: string, options: DateTimeFormatOptions = {}) {
  if (!value) return "";

  const parsed = parseDatabaseDateTime(value);
  if (!parsed) return value;

  return formatDateParts(parsed.date, options, parsed.hasTime);
}

function parseDatabaseDateTime(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/,
  );

  if (!match) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : { date, hasTime: true };
  }

  const [, year, month, day, hour, minute, second] = match;
  const hasTime = Boolean(hour && minute);
  const hasExplicitTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const date = hasExplicitTimeZone
    ? new Date(trimmed)
    : new Date(
        Date.UTC(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour ?? "0"),
          Number(minute ?? "0"),
          Number(second ?? "0"),
        ),
      );

  return Number.isNaN(date.getTime()) ? null : { date, hasTime };
}

function formatDateParts(date: Date, options: DateTimeFormatOptions, hasTime: boolean) {
  const parts = getDateTimeFormatter(options)
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});

  const formattedDate = `${Number(parts.year)}/${Number(parts.month)}/${Number(parts.day)}`;
  if (!hasTime) return formattedDate;

  const formattedTime = `${parts.hour}:${parts.minute}${options.seconds === false ? "" : `:${parts.second ?? "00"}`}`;

  return `${formattedDate} ${formattedTime}`;
}
