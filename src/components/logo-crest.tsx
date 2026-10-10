import brandLogo from "@/assets/brand-logo.jpg";
import { cn } from "@/lib/utils";

/** Company logo inside a circular gold frame with a soft golden glow. */
export function LogoCrest({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("logo-crest inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <img
        src={brandLogo}
        alt="شعار وليد وطلعت"
        className="h-full w-full scale-100 rounded-full border-2 border-[#0A1128] bg-[#0c1a3d] object-contain"
        style={{ padding: "1%" }}
      />
    </span>
  );
}
