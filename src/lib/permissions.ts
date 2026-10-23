import { useEffect, useState } from "react";
import { fetchMyProfile, type Profile } from "@/lib/queries";

export type RoleName = Profile["role"];

export const ROLE_LABELS: Record<RoleName, string> = {
  pending: "بانتظار الموافقة",
  admin: "مدير النظام (صلاحيات كاملة)",
  accountant: "محاسب",
  dispatcher: "منسق تشغيل",
  staff: "موظف",
  storekeeper: "أمين مخزن",
  workshop_keeper: "أمين ورشة",
  maintenance_manager: "مدير صيانة",
};

/**
 * Roles whose page list is fixed by policy. admin sees everything; dispatcher and staff keep the
 * default per-page rules (`roles` on each navigation item) exactly as before.
 */
const FIXED_PAGES: Partial<Record<RoleName, readonly string[]>> = {
  accountant: ["/fleet-performance", "/dispatch", "/rented", "/trips", "/clients", "/suppliers", "/workshop", "/payroll"],
  storekeeper: ["/workshop"],
  workshop_keeper: ["/workshop"],
  maintenance_manager: ["/workshop", "/fleet-performance", "/fleet"],
};

const matches = (path: string, page: string) => (page === "/" ? path === "/" : path === page || path.startsWith(`${page}/`));

/** `defaultRoles` is the navigation item's own rule (null = every active user). */
export function canAccessPath(role: RoleName | null | undefined, path: string, defaultRoles: readonly string[] | null): boolean {
  if (!role || role === "pending") return false;
  if (role === "admin") return true;
  const fixed = FIXED_PAGES[role];
  if (fixed) return fixed.some((p) => matches(path, p));
  return !defaultRoles || defaultRoles.includes(role);
}

/** Where a restricted role lands instead of the dashboard. */
export function homePathFor(role: RoleName): string {
  const fixed = FIXED_PAGES[role];
  return fixed?.[0] ?? "/";
}

export interface WorkshopRights {
  /** fuel tab, fuel figures and fuel buttons */
  fuel: boolean;
  /** the inventory (المخزن) tab */
  inventory: boolean;
  /** any print / PDF button */
  print: boolean;
  /** immediate-payment fields on stock inward (finance roles only) */
  payments: boolean;
}

export function workshopRights(role: RoleName | null | undefined): WorkshopRights {
  switch (role) {
    case "storekeeper":
      return { fuel: false, inventory: true, print: true, payments: false };
    case "workshop_keeper":
      return { fuel: false, inventory: false, print: false, payments: false };
    case "maintenance_manager":
      return { fuel: true, inventory: true, print: true, payments: false };
    default:
      return { fuel: true, inventory: true, print: true, payments: true };
  }
}

let cached: Promise<Profile | null> | null = null;
/** The signed-in user's role (loaded once per page load). */
export function useMyRole(): RoleName | null {
  const [role, setRole] = useState<RoleName | null>(null);
  useEffect(() => {
    cached ??= fetchMyProfile().catch(() => null);
    cached.then((p) => setRole(p?.role ?? null));
  }, []);
  return role;
}
