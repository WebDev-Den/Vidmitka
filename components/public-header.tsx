import type { ReactNode } from "react";

import { Brand } from "@/components/brand";
import { PublicNavigation } from "@/components/public-navigation";

export function PublicHeader({
  toolbar,
  footer,
}: {
  toolbar?: ReactNode;
  footer?: ReactNode;
} = {}) {
  const isWorkspaceHeader = toolbar !== undefined || footer !== undefined;

  return (
    <header className={`public-header${isWorkspaceHeader ? " public-header--workspace" : ""}`}>
      <div className={`public-header-inner${isWorkspaceHeader ? " public-header-inner--workspace" : ""}`}>
        <Brand />
        {toolbar !== undefined
          ? <div className="public-header-toolbar">{toolbar}</div>
          : <PublicNavigation />}
        {footer !== undefined ? <div className="public-header-footer">{footer}</div> : null}
      </div>
    </header>
  );
}
