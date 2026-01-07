import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import {
  LayoutDashboard,
  ShoppingBag,
  Wrench,
  Package,
  Layers,
  Receipt,
  Settings,
  Calculator,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Zap
} from "lucide-react";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Orders", icon: ShoppingBag, page: "Orders" },
  { name: "Jobs", icon: Wrench, page: "Jobs" },
  { name: "Products", icon: Package, page: "Products" },
  { name: "Materials", icon: Layers, page: "Materials" },
  { name: "Expenses", icon: Receipt, page: "Expenses" },
  { name: "Settings", icon: Settings, page: "Settings" },
];

const toolsItems = [
  { name: "Profit Calculator", icon: Calculator, page: "Calculator" },
  { name: "Raster Assistant", icon: Zap, page: "RasterAssistant" },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(true);

  return (
    <div className="min-h-screen bg-stone-50">
      <style>{`
        :root {
          --color-primary: #1a1a1a;
          --color-accent: #059669;
          --color-accent-light: #d1fae5;
          --color-warm: #fef3c7;
          --color-danger: #dc2626;
        }
      `}</style>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-stone-200 z-50 flex items-center px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6 text-stone-700" />
        </button>
        <span className="ml-4 font-semibold text-stone-900 text-lg">MakerLedger</span>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-stone-200 z-50 transform transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-stone-100">
          <span className="font-bold text-xl text-stone-900 tracking-tight">MakerLedger</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-stone-100 rounded-lg"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-emerald-600" : "text-stone-400 group-hover:text-stone-600"
                  }`}
                />
                {item.name}
                {isActive && (
                  <ChevronRight className="w-4 h-4 ml-auto text-emerald-500" />
                )}
              </Link>
            );
          })}

          {/* Tools Section */}
          <div className="pt-4 mt-4 border-t border-stone-100">
            <button
              onClick={() => setToolsExpanded(!toolsExpanded)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 w-full transition-all duration-200 group"
            >
              <Wrench className="w-5 h-5 text-stone-400 group-hover:text-stone-600" />
              <span>Tools</span>
              <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${toolsExpanded ? "rotate-180" : ""}`} />
            </button>
            
            {toolsExpanded && (
              <div className="mt-1 ml-4 space-y-1">
                {toolsItems.map((item) => {
                  const isActive = currentPageName === item.page;
                  return (
                    <Link
                      key={item.page}
                      to={createPageUrl(item.page)}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                      }`}
                    >
                      <item.icon
                        className={`w-4 h-4 transition-colors ${
                          isActive ? "text-emerald-600" : "text-stone-400 group-hover:text-stone-600"
                        }`}
                      />
                      {item.name}
                      {isActive && (
                        <ChevronRight className="w-3.5 h-3.5 ml-auto text-emerald-500" />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}