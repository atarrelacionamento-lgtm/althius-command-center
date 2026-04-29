import { AppSidebar } from "./AppSidebar";
import { CROCopilot } from "./CROCopilot";
import { TopBar } from "./TopBar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-background althius-dot-bg dark">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
        <CROCopilot />
      </div>
    </div>
  );
}
