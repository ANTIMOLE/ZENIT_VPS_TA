import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?:        ReactNode;
  emoji?:       string;
  title:        string;
  description?: string;
  action?:      { label: string; onClick: () => void };
  className?:   string;
}

export function EmptyState({ icon, emoji, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center px-4", className)}>
      {emoji ? (
        <p className="text-4xl mb-4">{emoji}</p>
      ) : icon ? (
        <div className="text-[#ccc] mb-4">{icon}</div>
      ) : null}
      <p className="font-semibold text-[#333] mb-1">{title}</p>
      {description && (
        <p className="text-sm text-[#999] max-w-xs leading-relaxed">{description}</p>
      )}
      {action && (
        <Button
          variant="outline"
          size="sm"
          className="mt-5"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
