import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-16 w-16", className)}
    >
      <circle cx="32" cy="32" r="30" fill="hsl(var(--primary))" />
      <path
        d="M32 17.5L35.5 28.5L46.5 32L35.5 35.5L32 46.5L28.5 35.5L17.5 32L28.5 28.5L32 17.5Z"
        fill="hsl(var(--primary-foreground))"
      />
    </svg>
  );
}
