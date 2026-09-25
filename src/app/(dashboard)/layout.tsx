import { DashboardShell } from "@/components/layout/DashboardShell";
import { RequireAdmin } from "@/components/layout/RequireAdmin";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RequireAdmin>
      <DashboardShell>{children}</DashboardShell>
    </RequireAdmin>
  );
}
