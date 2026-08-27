import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/brand";
import { getOptionalAppUser } from "@/lib/auth/session";

export async function PublicHeader() {
  const user = await getOptionalAppUser();

  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Brand />
        <nav className="public-navigation" aria-label="Публічна навігація">
          <Link href="/schedule">Розклад</Link>
          <a href="#roles">Можливості</a>
        </nav>
        <Link
          className="button button-light header-action"
          href={user ? "/dashboard" : "/sign-in"}
        >
          {user ? "Відкрити кабінет" : "Увійти"}
          <ArrowUpRight size={17} />
        </Link>
      </div>
    </header>
  );
}
