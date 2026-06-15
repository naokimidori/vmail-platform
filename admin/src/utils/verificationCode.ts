import type { MailMessage } from "../api/types";

export function extractMessageVerificationCode(message: MailMessage) {
  const rawMessage = message.rawContent ?? message.preview;
  const htmlSearchText = message.htmlContent ? htmlToSearchableText(message.htmlContent) : "";

  return extractVerificationCode([message.subject, message.preview, htmlSearchText, rawMessage].join("\n"));
}

function htmlToSearchableText(html: string) {
  if (typeof DOMParser === "undefined") {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script, style").forEach((node) => node.remove());

  return (document.body.textContent ?? document.documentElement.textContent ?? "").replace(/\s+/g, " ").trim();
}

function extractVerificationCode(text: string) {
  const normalized = text.replace(/\s+/g, " ");
  const keyword =
    "verification(?:\\s+code)?|security(?:\\s+code)?|login(?:\\s+code)?|auth(?:entication)?(?:\\s+code)?|one[-\\s]?time(?:\\s+code)?|otp|passcode|code|验证码|校验码|动态码|一次性(?:验证码|代码)?";
  const patterns = [
    new RegExp(`(?:${keyword})(?:\\s+(?:is|为|是)|\\s*[:：#=-])\\s*([A-Z0-9]{4,8})\\b`, "gi"),
    new RegExp(`\\b([A-Z0-9]{4,8})\\b\\s*(?:is|为|是|[:：#=-])\\s*(?:${keyword})`, "gi"),
    new RegExp(`(?:${keyword})[^A-Z0-9]{0,40}\\b([A-Z0-9]{4,8})\\b`, "gi"),
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const candidate = match[1]?.toUpperCase();
      if (candidate && /^(?=.*\d)[A-Z0-9]{4,8}$/.test(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}
