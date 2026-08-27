import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={compact ? "brand brand-compact" : "brand"} href="/">
      <BrandMark />
      <span className="brand-copy">
        <strong>Відмітка</strong>
        {!compact && <small>Навчальний розклад</small>}
      </span>
    </Link>
  );
}
