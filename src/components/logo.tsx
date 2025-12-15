import Image from 'next/image';
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Image 
        src="/logo.png" 
        alt="Konimba Logo" 
        width={150} 
        height={40} 
        className="object-contain"
        priority
      />
    </div>
  );
}
