import { MapPin } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  name: string;
  /** Tailwind size class for the wrapper. Defaults to h-12 w-12. */
  className?: string;
  /** Render plain (no gradient frame) — used in compact rows. */
  bare?: boolean;
};

/**
 * Renders an official locality flag/seal when available, falling back to a
 * stylised MapPin tile so the UI never breaks for rows without imagery.
 */
export function LocalityFlag({ src, name, className, bare = false }: Props) {
  const [errored, setErrored] = useState(false);
  const showImage = !!src && !errored;

  if (bare) {
    return showImage ? (
      <img
        src={src!}
        alt={`Flag or seal of ${name}`}
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
        className={cn("h-12 w-12 rounded-md object-contain bg-secondary/40", className)}
      />
    ) : (
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-md bg-secondary/60 text-muted-foreground",
          className,
        )}
        aria-hidden
      >
        <MapPin className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl",
        showImage ? "bg-background ring-1 ring-border" : "bg-gradient-sun shadow-sun",
        className,
      )}
    >
      {showImage ? (
        <img
          src={src!}
          alt={`Flag or seal of ${name}`}
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <MapPin className="h-6 w-6 text-sun-foreground" aria-hidden />
      )}
    </div>
  );
}
