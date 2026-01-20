import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Users,
  FileText,
  ShoppingBag,
  Plus,
  Calculator,
  Settings,
  Sparkles
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Welcome() {
  const { user, loading } = useAuth();
  const [greeting, setGreeting] = useState("Good evening");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => base44.entities.Quote.list(),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => base44.entities.Job.list(),
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const results = await base44.entities.Settings.filter({ owner_user_id: user?.id });
      return results[0];
    },
    enabled: !!user,
  });

  const activeJobs = jobs.filter((j) => j.status !== "completed").length;
  const pendingQuotes = quotes.filter((q) => q.status === "Draft" || q.status === "Sent").length;

  const userName = user?.full_name || settings?.user_name || "Maker";

  const quickActions = [
    {
      icon: Users,
      label: "New Customer",
      description: "Add customer details",
      color: "bg-blue-50",
      iconColor: "text-blue-600",
      page: "Customers",
    },
    {
      icon: FileText,
      label: "Create Quote",
      description: "Generate professional quote",
      color: "bg-purple-50",
      iconColor: "text-purple-600",
      page: "Quotes",
    },
    {
      icon: Calculator,
      label: "Profit Calculator",
      description: "Estimate product costs",
      color: "bg-emerald-50",
      iconColor: "text-emerald-600",
      page: "Tools",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        {/* Hero Section */}
        <div className="mb-20">
          <div className="flex items-baseline gap-3 mb-8">
            <h1 className="text-7xl md:text-8xl font-light text-black">
              {greeting.split(" ")[0]}
            </h1>
            <div className="h-2 w-2 rounded-full bg-emerald-500 mt-8" />
          </div>
          <p className="text-2xl md:text-3xl text-stone-400 font-light max-w-2xl">
            Your workshop at a glance
          </p>
        </div>

        {/* Stats Grid - Minimal */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-24">
          <div className="group cursor-default">
            <div className="text-5xl font-light text-black mb-2 group-hover:text-emerald-600 transition-colors">
              {products.length}
            </div>
            <div className="text-sm text-stone-400 uppercase tracking-widest">Products</div>
          </div>
          
          <div className="group cursor-default">
            <div className="text-5xl font-light text-black mb-2 group-hover:text-emerald-600 transition-colors">
              {customers.length}
            </div>
            <div className="text-sm text-stone-400 uppercase tracking-widest">Customers</div>
          </div>
          
          <div className="group cursor-default">
            <div className="text-5xl font-light text-black mb-2 group-hover:text-emerald-600 transition-colors">
              {pendingQuotes}
            </div>
            <div className="text-sm text-stone-400 uppercase tracking-widest">Quotes</div>
          </div>
          
          <div className="group cursor-default">
            <div className="text-5xl font-light text-black mb-2 group-hover:text-emerald-600 transition-colors">
              {activeJobs}
            </div>
            <div className="text-sm text-stone-400 uppercase tracking-widest">Active</div>
          </div>
        </div>

        {/* Quick Actions - Minimal Links */}
        <div className="space-y-1 mb-24">
          <div className="text-xs text-stone-400 uppercase tracking-widest mb-6">Quick Start</div>
          {quickActions.map((action, idx) => (
            <Link 
              key={action.label} 
              to={createPageUrl(action.page)}
              className="block group"
            >
              <div className="flex items-center justify-between py-5 border-b border-stone-100 hover:border-emerald-500 transition-colors">
                <div className="flex items-center gap-6">
                  <span className="text-sm text-stone-300 font-mono w-6">0{idx + 1}</span>
                  <span className="text-xl font-light text-black group-hover:text-emerald-600 transition-colors">
                    {action.label}
                  </span>
                </div>
                <div className="text-stone-300 group-hover:text-emerald-600 group-hover:translate-x-2 transition-all">
                  →
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="flex items-center justify-between py-12 border-t border-stone-100">
          <div>
            <div className="text-sm text-stone-400 mb-1">Ready to dive in?</div>
            <div className="text-lg font-light text-black">View your complete dashboard</div>
          </div>
          <Link to={createPageUrl("Dashboard")}>
            <Button 
              variant="outline" 
              className="rounded-full px-8 border-black text-black hover:bg-black hover:text-white transition-all"
            >
              Dashboard →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}