import { auth } from "@clerk/nextjs/server";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/brand";

export async function PublicHeader() {
  const { userId } = await auth();

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
          href={userId ? "/dashboard" : "/sign-in"}
        >
          {userId ? "Відкрити кабінет" : "Увійти"}
          <ArrowUpRight size={17} />
        </Link>
      </div>
    </header>
  );
}
