import { cn } from "../../lib/utils";

export function VmailLogo({ className }: { className?: string }) {
  return (
    <img
      src="/assets/vmail-logo-generated.png"
      alt="V-Mail technology logo"
      className={cn("h-8 w-8 flex-none object-contain", className)}
      decoding="async"
      draggable={false}
    />
  );
}
