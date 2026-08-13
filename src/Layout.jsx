import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "./utils";
import { useQueryClient } from "@tanstack/react-query";
import { AuthProvider } from "@/components/auth/AuthProvider";
import Footer from "@/components/Footer";
import MakerAssistantWidget from "@/components/MakerAssistantWidget";
import PullToRefresh from "@/components/ui/PullToRefresh";
import {
  LayoutDashboard,
  ShoppingBag,
  Wrench,
  Package,
  Layers,
  Receipt,
  Menu,
  X,
  ChevronRight,
  Settings as SettingsIcon,
  FileText,
  FileCheck,
  Users,
  Factory,
  DollarSign,
  ChevronLeft,
} from "lucide-react";

const navItems = [
        { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
        { name: "Etsy Sales", icon: ShoppingBag, page: "Orders" },
        { name: "Custom Sales", icon: ShoppingBag, page: "CustomSales" },
        { name: "Customers", icon: Users, page: "Customers" },
        { name: "Quotes", icon: FileText, page: "Quotes" },
        { name: "Invoices", icon: Receipt, page: "Invoices" },
        { name: "Expenses", icon: Receipt, page: "Expenses" },
        { name: "Products", icon: Package, page: "Products" },
        { name: "Inventory", icon: Layers, page: "Inventory" },
        { name: "Jobs", icon: Factory, page: "Production" },
        { name: "Tools", icon: Wrench, page: "Tools" },
        { name: "Settings", icon: SettingsIcon, page: "Settings" },
      ];

const bottomTabs = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Sales", icon: ShoppingBag, page: "Orders" },
  { name: "Expenses", icon: Receipt, page: "Expenses" },
  { name: "Tools", icon: Wrench, page: "Tools" },
  { name: "Settings", icon: SettingsIcon, page: "Settings" },
];

// Pages that get native pull-to-refresh on mobile
const PULL_TO_REFRESH_PAGES = ["Dashboard", "Orders", "Expenses"];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const ROOT_PAGES = new Set([...navItems.map((i) => i.page), "Welcome"]);
  const isSubRoute = !ROOT_PAGES.has(currentPageName);
  const pageTitle =
    (navItems.find((i) => i.page === currentPageName)?.name) ||
    (currentPageName === "Welcome" ? "Home" : currentPageName);

  const handlePullRefresh = async () => {
    await queryClient.invalidateQueries();
  };

  const wrappedChildren = PULL_TO_REFRESH_PAGES.includes(currentPageName) ? (
    <PullToRefresh onRefresh={handlePullRefresh}>{children}</PullToRefresh>
  ) : (
    children
  );

  return (
    <AuthProvider>
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
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
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 z-50 flex items-center px-3 safe-area-pt" style={{ paddingBottom: "0.5rem" }}>
        {isSubRoute ? (
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center min-h-[44px] px-2 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-stone-700 dark:text-stone-200"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
            <span className="text-sm font-medium ml-0.5">Back</span>
          </button>
        ) : (
          <button
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center justify-center min-h-[44px] w-11 p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-6 h-6 text-stone-700 dark:text-stone-200" />
          </button>
        )}
        <span className="ml-2 font-semibold text-stone-900 dark:text-stone-100 text-lg truncate">
          {pageTitle}
        </span>
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
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 z-50 transform transition-transform duration-300 ease-out lg:translate-x-0 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-stone-100 dark:border-stone-800 flex-shrink-0 gap-2">
          <Link to={createPageUrl("Welcome")} className="font-bold text-lg text-stone-900 dark:text-stone-100 tracking-tight hover:text-emerald-600 transition-colors flex-1 min-w-0">
            Etsy Maker's Profit Pilot
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
          >
            <X className="w-5 h-5 text-stone-500 dark:text-stone-400" />
          </button>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto flex-1">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                    : "text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300"
                  }`}
                />
                {item.name}
                {isActive && (
                  <ChevronRight className="w-4 h-4 ml-auto text-emerald-500" />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
          {wrappedChildren}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 z-40 safe-area-pb">
        <div className="flex items-stretch justify-around">
          {bottomTabs.map((tab) => {
            const isActive = currentPageName === tab.page;
            return (
              <Link
                key={tab.page}
                to={createPageUrl(tab.page)}
                onClick={(e) => {
                  if (isActive) {
                    e.preventDefault();
                    navigate(createPageUrl(tab.page), { replace: true });
                  }
                }}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] flex-1 transition-colors ${
                  isActive ? "text-emerald-600 dark:text-emerald-400" : "text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <Footer />
      <MakerAssistantWidget />
      </div>
      </AuthProvider>
      );
      }