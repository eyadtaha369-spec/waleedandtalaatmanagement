import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-kit";
import { TripsSection } from "@/components/trips-section";

export const Route = createFileRoute("/trips")({
  head: () => ({ meta: [{ title: "إدارة الرحلات والتنبيهات | وليد وطلعت" }] }),
  component: TripsPage,
});

function TripsPage() {
  return (
    <AppShell>
      <PageHeader title="إدارة الرحلات والتنبيهات" subtitle="متاحة أيضًا داخل «الحركة والورديات» في تبويب مستقل" />
      <TripsSection />
    </AppShell>
  );
}
