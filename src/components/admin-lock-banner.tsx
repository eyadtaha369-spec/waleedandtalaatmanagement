import { ADMIN_ONLY_MESSAGE } from "@/lib/permissions";

/** شريط وضع القراءة لغير المدير + تحذير أحمر عند محاولة تعديل/حذف. */
export function AdminLockBanner({ isAdmin, role, notice, onDismiss }: { isAdmin: boolean; role: string | null; notice: boolean; onDismiss: () => void }) {
  if (isAdmin || role === null) return null;
  return (
    <div className="no-print mb-4 grid gap-2">
      <p className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">🔒 وضع القراءة: التعديل والحذف في السجلات المالية متاحان للمدير فقط.</p>
      {notice && (
        <p className="flex items-center justify-between gap-2 rounded-lg border border-[#EF4444]/50 bg-[#EF4444]/10 px-3 py-2 text-sm font-bold text-[#EF4444]" role="alert">
          <span>{ADMIN_ONLY_MESSAGE}</span>
          <button type="button" className="text-xs underline" onClick={onDismiss}>إغلاق</button>
        </p>
      )}
    </div>
  );
}
