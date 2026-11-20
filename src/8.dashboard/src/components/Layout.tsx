import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function Layout() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 antialiased flex selection:bg-rose-100 selection:text-rose-900">
      {/* Sleek Fixed Sidebar */}
      <Sidebar />

      {/* Main Content Area with subtle micro-grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
        <div className="p-6 md:p-8 max-w-[1440px] w-full mx-auto space-y-6 flex-1">
          <Header />
          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
