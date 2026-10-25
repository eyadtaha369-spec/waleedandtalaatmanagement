import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-kit";
import { RentedSection } from "@/components/rented-section";

export const Route = createFileRoute("/rented")({
  head: () => ({ meta: [{ title: "السيارات المستأجرة والخارجية | وليد وطلعت" }] }),
  component: RentedPage,
});

function RentedPage() {
  return (
    <AppShell>
      <PageHeader title="السيارات المستأجرة والخارجية" subtitle="متاحة أيضًا داخل «الحركة والورديات» في تبويب مستقل" />
      <RentedSection />
    </AppShell>
  );
}
