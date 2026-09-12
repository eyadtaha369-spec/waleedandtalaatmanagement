import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bus,
  Building2,
  ClipboardList,
  Coins,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Route as RouteIcon,
  Search,
  Truck,
  Users,
  Wallet,
  Wrench,
  Bell,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { fetchMyProfile, fetchAlerts, globalSearch, type Profile, type AlertRow, type SearchResult } from "@/lib/queries";
import brandLogo from "@/assets/brand-logo.jpeg.asset.json";

const nav = [
  { to: "/", label: "لوحة التحكّم", icon: LayoutDashboard, roles: null },
  { to: "/fleet", label: "الأسطول والسائقون", icon: Bus, roles: null },
  { to: "/dispatch", label: "الحركة والورديات اليومية", icon: Truck, roles: ["admin", "accountant", "dispatcher"] },
  { to: "/operations", label: "الخطوط والاشتراكات", icon: RouteIcon, roles: null },
  { to: "/clients", label: "كشف حساب الشركات", icon: Building2, roles: ["admin", "accountant"] },
  { to: "/workshop", label: "الورشة والمخزون والسولار", icon: Wrench, roles: null },
  { to: "/finance", label: "المالية والخزينة", icon: Coins, roles: ["admin", "accountant"] },
  { to: "/payroll", label: "التشغيل اليومي والمرتبات", icon: Wallet, roles: ["admin", "accountant"] },
  { to: "/ledger", label: "كشف حساب المديونيات", icon: Receipt, roles: ["admin", "accountant"] },
  { to: "/audit", label: "سجل التعديلات", icon: ClipboardList, roles: ["admin"] },
  { to: "/team", label: "الفريق والصلاحيات", icon: Users, roles: ["admin"] },
  { to: "/backup", label: "النسخ الاحتياطي", icon: Database, roles: ["admin"] },
] as const;

const roleLabels: Record<string, string> = {
  admin: "مدير",
  accountant: "محاسب",
  dispatcher: "منسق تشغيل",
  staff: "موظف",
  pending: "بانتظار الموافقة",
};

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [loading, session, navigate]);

  useEffect(() => {
    if (session) {
      fetchMyProfile().then(setProfile).catch(() => setProfile(null));
      fetchAlerts().then(setAlerts).catch(() => setAlerts([]));
    }
  }, [session]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        setSearchResults(await globalSearch(searchTerm));
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchTerm]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">جارِ التحقق من الدخول...</p>
      </div>
    );
  }

  if (profile && profile.role === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
        <div className="max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-extrabold text-primary">حسابك بانتظار الموافقة</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            تم إنشاء حسابك بنجاح، لكن يجب أن يوافق أحد المديرين على صلاحياتك قبل أن تتمكن من الدخول إلى البيانات.
          </p>
          <button
            onClick={() => signOut()}
            className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  const visibleNav = nav.filter((item) => !item.roles || (profile && (item.roles as readonly string[]).includes(profile.role)));

  return (
    <div className="flex min-h-screen w-full" dir="rtl">
      <aside
        className={cn(
          "no-print sticky top-0 hidden h-screen shrink-0 flex-col border-l border-sidebar-border bg-sidebar transition-all md:flex",
          open ? "w-72" : "w-20",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
          <img src={brandLogo.url} alt="شعار وليد وطلعت" className="h-11 w-11 rounded-xl object-cover ring-1 ring-primary/50" />
          {open && (
            <div className="leading-tight">
              <p className="text-sm font-extrabold text-gold-gradient">وليد وطلعت</p>
              <p className="text-[11px] text-muted-foreground">إدارة التشغيل والأسطول</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {visibleNav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "border border-primary/40 bg-primary/12 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-primary/70")} />
                {open && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {open && (
          <div className="m-3 rounded-xl border border-primary/30 bg-primary/8 p-3 text-xs text-muted-foreground">
            شركة وليد وطلعت لخدمات النقل والرحلات
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-border p-2 text-primary hover:bg-accent"
            aria-label="طي القائمة"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder="بحث عام: كود أتوبيس، سائق، طالب، خط سير..."
              className="border-border bg-input/60 pr-9 placeholder:text-muted-foreground"
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                {searchResults.map((r, i) => (
                  <Link
                    key={i}
                    to={r.page}
                    className="block border-b border-border px-3 py-2 text-sm last:border-0 hover:bg-secondary/40"
                    onClick={() => setSearchOpen(false)}
                  >
                    <p className="font-bold">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.sublabel}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="mr-auto flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative rounded-lg border border-border p-2">
                  <Bell className="h-5 w-5 text-primary" />
                  {alerts.length > 0 && (
                    <span className="absolute -left-1 -top-1 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                      {alerts.length}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>التنبيهات</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {alerts.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">لا توجد تنبيهات حالياً</p>
                ) : (
                  alerts.slice(0, 8).map((a) => (
                    <DropdownMenuItem key={a.id} className="whitespace-normal text-xs">
                      <span className={cn("ml-2 shrink-0 font-bold", a.level === "عاجل" ? "text-destructive" : "text-warning")}>
                        [{a.type}]
                      </span>
                      {a.text}
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/" className="justify-center text-xs text-primary">عرض كل التنبيهات في اللوحة الرئيسية</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-bold">{profile?.fullName || session.user.email}</p>
              <p className="text-[11px] text-muted-foreground">{profile ? roleLabels[profile.role] : "—"}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="rounded-lg border border-border p-2 text-destructive hover:bg-destructive/10"
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
