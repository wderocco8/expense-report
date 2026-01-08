"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function generateBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  const staticRouteLabels: Record<string, string> = {
    "expense-report-jobs": "Expense Report Jobs",
    admin: "Admin",
    dashboard: "Dashboard",
    // Add more mappings here
  };

  const breadcrumbs = [{ label: "Home", href: "/" }];

  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    currentPath += `/${segments[i]}`;
    const segment = segments[i];
    const label = staticRouteLabels[segment] ?? segment;

    breadcrumbs.push({ label, href: currentPath });
  }

  return breadcrumbs;
}

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const breadcrumbs = generateBreadcrumbs(pathname);

  if (breadcrumbs.length <= 1) return null; // only "Home"

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <span key={item.href} className="contents">
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
