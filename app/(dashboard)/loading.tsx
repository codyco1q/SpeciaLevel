import { Monogram } from "@/components/brand";

export default function DashboardLoading() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none backdrop-blur-[2px] bg-background/30"
    >
      <div className="relative flex flex-col items-center justify-center">
        {/* Ambient Glow */}
        <div className="absolute -inset-6 rounded-full bg-primary/25 blur-2xl animate-pulse" />

        {/* High-Tech Dual-Ring Spinner */}
        <div className="relative flex items-center justify-center size-20">
          {/* Outer Ring */}
          <div className="size-20 rounded-full border-2 border-primary/20 border-t-primary border-r-primary/80 animate-spin" />

          {/* Inner Reverse Ring */}
          <div
            className="absolute size-14 rounded-full border-2 border-primary/10 border-b-primary border-l-primary/60"
            style={{
              animation: "spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite reverse",
            }}
          />

          {/* Center Logo / Monogram */}
          <div className="absolute flex items-center justify-center">
            <Monogram className="size-8 text-xs shadow-md shadow-primary/40 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
