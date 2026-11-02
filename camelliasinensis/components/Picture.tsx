import { imageSources } from '@/lib/images';

type Props = {
  src: string;
  alt: string;
  sizes: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
};

/** <picture> s AVIF i WebP derivatima; za slike izvan manifesta (npr. s backenda) običan <img>. */
export function Picture({ src, alt, sizes, width, height, className, priority }: Props) {
  const s = imageSources(src);
  const common = {
    className,
    width: s?.width ?? width,
    height: s?.height ?? height,
    loading: priority ? ('eager' as const) : ('lazy' as const),
    decoding: 'async' as const,
    ...(priority ? { fetchPriority: 'high' as const } : {}),
  };
  if (!s) return <img src={src} alt={alt} {...common} />;
  return (
    <picture>
      <source type="image/avif" srcSet={s.avif} sizes={sizes} />
      <source type="image/webp" srcSet={s.webp} sizes={sizes} />
      <img src={s.src} alt={alt} {...common} />
    </picture>
  );
}

/** Kad proizvod nema fotografiju: znak trgovine umjesto teksta ("bez vidljivih placeholdera"). */
export function NoImage() {
  return (
    <span className="x-noimg" aria-hidden="true">
      <img src="/brand/znak.svg" alt="" width={56} height={45} style={{ width: '28%', height: 'auto', opacity: 0.55 }} />
    </span>
  );
}
