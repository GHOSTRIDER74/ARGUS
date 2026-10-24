import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function Layout() {
  return (
    <div className="min-h-screen bg-background text-on-surface antialiased flex selection:bg-coral-subtle selection:text-primary">
      {/* Sleek Fixed Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-6 md:p-8 max-w-[1360px] w-full mx-auto space-y-6 flex-1">
          <Header />
          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
