import { AlertCircle, Loader2 } from "lucide-react";

import { Card, CardContent } from "./ui/card";

export function LoadingState({ label = "Loading data" }: { label?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>{label}...</span>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <strong className="text-foreground">{title}</strong>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Card className="border-red-200/80 bg-red-50/80 text-red-900">
      <CardContent className="flex gap-3 p-6">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
        <div>
          <strong>Something went wrong</strong>
          <p className="mt-2 text-sm leading-6">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
