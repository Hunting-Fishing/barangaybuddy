import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { jeepneyPhotoUrl } from "@/lib/jeepney-media";

type Props = {
  path?: string | null;
  alt: string;
  className?: string;
};

/** Renders a jeepney landmark photo from its stored (private) path. */
export function JeepneyPhotoThumb({ path, alt, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (!path) {
      setUrl(null);
      return;
    }
    void jeepneyPhotoUrl(path).then((u) => {
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [path]);

  if (!path) return null;
  if (!url) {
    return (
      <div
        className={
          className ?? "flex h-14 w-14 items-center justify-center rounded-md border border-border"
        }
      >
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={className ?? "h-14 w-14 rounded-md border border-border object-cover"}
    />
  );
}
