export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="rounded-[18px] border border-white/70 bg-white/62 p-6 text-sm font-black text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]"
    >
      {label}...
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-[18px] border border-red-200 bg-red-50/86 p-4 text-sm font-bold text-red-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
    >
      {message}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-white/80 bg-white/44 p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <h2 className="text-lg font-black text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
