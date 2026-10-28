/** Stand-in for next/image: a plain lazy <img> with published-relative URLs. */
import type { CSSProperties, ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> & {
  src: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  unoptimized?: boolean;
  placeholder?: string;
  blurDataURL?: string;
};

export default function Image({ src, width, height, fill, priority, quality: _q, unoptimized: _u, placeholder: _ph, blurDataURL: _b, sizes: _s, style, loading, ...rest }: Props) {
  const url = src.startsWith("/") ? src.slice(1) : src;
  const fillStyle: CSSProperties | undefined = fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...rest} src={url} width={fill ? undefined : width} height={fill ? undefined : height} style={fillStyle} loading={priority ? "eager" : (loading ?? "lazy")} decoding="async" />;
}
