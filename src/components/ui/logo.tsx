'use client';
import Image from 'next/image';
import { cn } from "@/lib/utils";

export function Logo({ className, src }: { className?: string; src?: string | null }) {
  // Use a default path to /logo.png if no src is provided.
  const logoSrc = src || '/logo.png';
  
  return (
    <div className={cn("relative", className)}>
      <Image 
        src={logoSrc} 
        alt="Logo" 
        fill
        className="object-contain"
        sizes="(max-width: 768px) 50vw, 96px"
        priority
        // In case of error (e.g., in dev environments or if src is invalid), fallback to the default.
        // The key forces a re-render if the src changes, which can help with some Next.js image caching issues.
        key={logoSrc}
        onError={(e) => {
          // If the provided src fails, try falling back to the default logo path.
          if (logoSrc !== '/logo.png') {
            e.currentTarget.src = '/logo.png';
          }
        }}
      />
    </div>
  );
}
