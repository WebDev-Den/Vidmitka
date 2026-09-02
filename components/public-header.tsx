import { Brand } from "@/components/brand";
import { PublicNavigation } from "@/components/public-navigation";

export function PublicHeader() {
  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Brand />
        <PublicNavigation />
      </div>
    </header>
  );
}
