import Image from 'next/image';
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("relative rounded-full overflow-hidden", className)}>
      <Image 
        src="/logo.png" 
        alt="Konimba Logo" 
        width={60} 
        height={60} 
        className="object-cover"
        priority
      />
    </div>
  );
}
