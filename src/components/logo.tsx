'use client';
import Image from 'next/image';
import { cn } from "@/lib/utils";

export function Logo({ className, src }: { className?: string; src?: string | null }) {
  return (
    <div className={cn("relative", className)}>
      <Image 
        src={src || "/logo.png"} 
        alt="Konimba Logo" 
        fill
        className="object-contain"
        sizes="(max-width: 768px) 50vw, 96px"
        priority
      />
    </div>
  );
}
