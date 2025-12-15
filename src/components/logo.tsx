'use client';
import Image from 'next/image';
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("relative rounded-full overflow-hidden", className)}>
      <Image 
        src="/logo.png" 
        alt="Konimba Logo" 
        fill
        className="object-contain"
        sizes="96px"
        priority
      />
    </div>
  );
}
