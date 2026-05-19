/**
 * 扩展包内图标（public/icons；由 end.png 生成，外层背景已去透明）
 */

const ICON_DIR = "public/icons";

function iconUrl(file: string): string {
  const rel = `${ICON_DIR}/${file}`;
  if (typeof chrome !== "undefined" && typeof chrome.runtime?.getURL === "function") {
    return chrome.runtime.getURL(rel);
  }
  return `/${rel}`;
}

export type MadokaIconVariant = "toolbar" | "hero";

type Props = {
  className?: string;
  variant: MadokaIconVariant;
  imgSizes?: string;
};

export function MadokaIcon({ className, variant, imgSizes }: Props) {
  const base = ["block max-w-full", className].filter(Boolean).join(" ");

  if (variant === "hero") {
    const u48 = iconUrl("icon48.png");
    const u128 = iconUrl("icon128.png");
    return (
      <img
        src={u128}
        srcSet={`${u48} 48w, ${u128} 128w`}
        sizes={imgSizes ?? "56px"}
        className={base}
        draggable={false}
        alt="Madoka"
        decoding="sync"
      />
    );
  }

  const u32 = iconUrl("icon32.png");
  const u48 = iconUrl("icon48.png");
  return (
    <img
      src={u48}
      srcSet={`${u32} 32w, ${u48} 48w`}
      sizes="28px"
      className={base}
      draggable={false}
      alt=""
      decoding="sync"
    />
  );
}
