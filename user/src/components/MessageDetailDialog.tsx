import type { ParsedMail } from "../api/types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const emailPreviewSandbox = "allow-popups allow-popups-to-escape-sandbox";

export function MessageDetailDialog({ message, onClose }: { message: ParsedMail; onClose: () => void }) {
  const srcDoc = message.html
    ? `<!doctype html><base target="_blank"><style>body{font-family:system-ui,sans-serif;margin:16px;color:#151a27;}</style>${sanitizeEmailHtml(message.html)}`
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#151a27]/35 px-4 py-6 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Card
        role="dialog"
        aria-label={message.subject}
        aria-modal="true"
        className="flex h-[700px] max-h-[calc(100vh-48px)] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-white/70 bg-card shadow-frame backdrop-blur-xl"
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <CardTitle className="break-words text-xl">{message.subject}</CardTitle>
            <p className="mt-2 break-words text-sm text-muted-foreground">
              {message.from} to {message.to}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-auto p-5">
          {srcDoc ? (
            <iframe
              className="min-h-[620px] w-full rounded-[22px] border border-white/70 bg-white"
              sandbox={emailPreviewSandbox}
              srcDoc={srcDoc}
              title="Email preview"
            />
          ) : (
            <pre className="whitespace-pre-wrap rounded-[22px] bg-white/55 p-4 text-sm leading-6 text-foreground">{message.text}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function sanitizeEmailHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
}
