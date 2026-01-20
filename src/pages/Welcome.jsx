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
  Sparkles,
  MessageCircle } from
"lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Welcome() {
  const { user, loading } = useAuth();
  const [greeting, setGreeting] = useState("Good evening");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");else
    if (hour < 18) setGreeting("Good afternoon");else
    setGreeting("Good evening");
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.filter({ owner_user_id: user?.id }),
    enabled: !!user
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.filter({ owner_user_id: user?.id }),
    enabled: !!user
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => base44.entities.Quote.filter({ owner_user_id: user?.id }),
    enabled: !!user
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => base44.entities.Job.filter({ owner_user_id: user?.id }),
    enabled: !!user
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    staleTime: 0,
    cacheTime: 0,
    queryFn: () => base44.entities.Settings.filter({ owner_user_id: user.id })
  });

  const activeJobs = jobs.filter((j) => j.status !== "completed").length;
  const pendingQuotes = quotes.filter((q) => q.status === "Draft" || q.status === "Sent").length;

  const getFirstName = () => {
    const userName = settings[0]?.user_name;
    if (userName) return userName;
    if (!user?.full_name) return "Maker";
    return user.full_name.split(" ")[0];
  };

  const userName = getFirstName();

  const encouragingQuotes = [
    "Your creativity is your superpower. Keep making magic!",
    "Every masterpiece starts with a single cut. You've got this!",
    "Success is the sum of small efforts, repeated day in and day out.",
    "The only way to do great work is to love what you do.",
    "Your passion is your profit. Keep creating with purpose!",
    "Dream big, work hard, stay focused. Your vision matters!",
    "Today's challenges are tomorrow's success stories.",
    "Innovation distinguishes between a leader and a follower.",
    "Quality is not an act, it's a habit. Keep crafting excellence!",
    "Your next breakthrough is just one project away.",
    "Believe in your craft. Your hands create what your heart imagines.",
    "Progress over perfection. Every cut brings you closer!",
    "The best time to start was yesterday. The next best time is now.",
    "Your unique perspective is what makes your work irreplaceable.",
    "Stay curious, stay creative, stay committed to your craft."
  ];

  const quoteOfTheDay = encouragingQuotes[new Date().getDate() % encouragingQuotes.length];

  const quickActions = [
  {
    icon: Users,
    label: "New Customer",
    description: "Add customer details",
    color: "bg-blue-50",
    iconColor: "text-blue-600",
    page: "Customers"
  },
  {
    icon: FileText,
    label: "Create Quote",
    description: "Generate professional quote",
    color: "bg-purple-50",
    iconColor: "text-purple-600",
    page: "Quotes"
  },
  {
    icon: Calculator,
    label: "Profit Calculator",
    description: "Estimate product costs",
    color: "bg-emerald-50",
    iconColor: "text-emerald-600",
    page: "Tools"
  }];


  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400">Loading...</div>
      </div>);

  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <div className="inline-block px-4 py-1.5 bg-white rounded-full shadow-sm border border-stone-200 mb-4">
            <span className="text-xs font-medium text-stone-600 uppercase tracking-wide">
              Welcome Home
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-3">
            {greeting}, {userName}!
          </h1>
          <p className="text-stone-600 text-lg">
            Ready to bring your next vision to life? Here's a look at your workshop today.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link to={createPageUrl("Products")}>
            <Card className="bg-white/80 backdrop-blur border-stone-200 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-orange-50 rounded-lg">
                    <Package className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-stone-900">{products.length}</div>
                    <div className="text-xs text-stone-500 uppercase tracking-wide">Products</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl("Customers")}>
            <Card className="bg-white/80 backdrop-blur border-stone-200 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 rounded-lg">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-stone-900">{customers.length}</div>
                    <div className="text-xs text-stone-500 uppercase tracking-wide">Customers</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl("Quotes")}>
            <Card className="bg-white/80 backdrop-blur border-stone-200 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-50 rounded-lg">
                    <FileText className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-stone-900">{pendingQuotes}</div>
                    <div className="text-xs text-stone-500 uppercase tracking-wide">Pending Quotes</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl("Production")}>
            <Card className="bg-white/80 backdrop-blur border-stone-200 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 rounded-lg">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-stone-900">{activeJobs}</div>
                    <div className="text-xs text-stone-500 uppercase tracking-wide">Active Jobs</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {quickActions.map((action) =>
          <Link key={action.label} to={createPageUrl(action.page)}>
              <Card className="bg-white/80 backdrop-blur border-stone-200 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer group">
                <CardContent className="p-6 text-center">
                  <div className={`w-14 h-14 ${action.color} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                    <action.icon className={`w-7 h-7 ${action.iconColor}`} />
                  </div>
                  <h3 className="font-semibold text-stone-900 mb-1">{action.label}</h3>
                  <p className="text-sm text-stone-500">{action.description}</p>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>

        {/* Maker Mantra */}
        <Card className="bg-gradient-to-br from-stone-800 to-stone-900 border-none shadow-xl">
          <CardContent className="bg-gray-700 p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-medium text-amber-400 uppercase tracking-wide">
                Quote of the Day
              </span>
            </div>
            <blockquote className="text-2xl md:text-3xl text-stone-100 font-light italic mb-4">
              "{quoteOfTheDay}"
            </blockquote>
            <p className="text-xs text-stone-400 uppercase tracking-widest">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </CardContent>
        </Card>

        {/* Footer Navigation */}
        <div className="mt-8 flex justify-center gap-3">
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="outline" className="gap-2">
              Go to Dashboard
            </Button>
          </Link>
          <a href={base44.agents.getWhatsAppConnectURL('onboarding_assistant')} target="_blank" rel="noopener noreferrer">
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <MessageCircle className="w-4 h-4" />
              Chat with Assistant
            </Button>
          </a>
        </div>

        {/* Terms of Service */}
        <div className="mt-16 pt-8 border-t border-stone-200">
          <h2 className="text-2xl font-bold text-stone-900 mb-6">Terms of Service</h2>
          <p className="text-sm text-stone-600 mb-6">Last Updated: January 20, 2026</p>

          <div className="space-y-6 text-stone-700">
            <section>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">Overview</h3>
              <p>
                When you use Etsy Maker's Profit Pilot products or services, you are agreeing to these Terms of Service ("Terms"). Violation of these terms may, at our discretion, result in us terminating your account.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">Definitions</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>"Company", "we", "our", or "us" refers to Etsy Maker's Profit Pilot.</li>
                <li>"Services" refers to our websites and any product created and maintained by Etsy Maker's Profit Pilot, including but not limited to our profit tracking, quote generation, order management, and production planning tools.</li>
                <li>"You" or "your" refers to the people or organizations that own an account with one or more of our Services.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">Account Terms</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>You are responsible for maintaining the security of your account and password. The Company cannot and will not be liable for any loss or damage from your failure to comply with this security obligation.</li>
                <li>You are responsible for all content posted to and activity that occurs under your account.</li>
                <li>You must be a human. Accounts registered by "bots" or other automated methods are not permitted.</li>
                <li>You are responsible for the accuracy of the financial data you input into the Services. The Company does not verify the accuracy of your data.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">Financial Data & Liability</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Data Accuracy:</strong> Etsy Maker's Profit Pilot is a tool for tracking and analyzing financial data. You acknowledge that calculations, reports, and recommendations generated by the Service are based on the data you provide. We are not liable for inaccurate results due to incorrect input data.</li>
                <li><strong>Tax & Legal Advice:</strong> The Services do not provide tax, accounting, or legal advice. You are solely responsible for consulting with qualified professionals regarding your business finances, tax obligations, and legal compliance.</li>
                <li><strong>Etsy Integration:</strong> The Services may integrate with Etsy's platform. We are not affiliated with, endorsed by, or responsible for Etsy's services, data accuracy, or any changes Etsy makes to their fees or policies.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">Payment & Subscriptions</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>If you are using a free version of one of our Services, it is really free: we do not ask you for your credit card.</li>
                <li>For paid Services, you need to pay in advance to keep using the Service. If you do not pay, we will freeze your account and it will be inaccessible until you make payment.</li>
                <li>All fees are exclusive of all taxes, levies, or duties imposed by taxing authorities. You are responsible for payment of all such taxes, levies, or duties.</li>
                <li>Refunds are processed at our sole discretion.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">Cancellation & Termination</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>You are solely responsible for properly canceling your account. You can cancel your account at any time from your account settings.</li>
                <li>We reserve the right to suspend or terminate your account and refuse any and all current or future use of our Services for any reason at any time.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">Liability Limitation</h3>
              <p>
                You agree that the Company is not liable to you or to any third party for damages of any kind that result from the use of or inability to access the Services, inaccurate financial calculations, or unauthorized access to your data.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">Intellectual Property</h3>
              <p>
                The Company or its licensors own all right, title, and interest in and to the Services, including all intellectual property rights therein. You may not duplicate, copy, or reuse any portion of the code, design, or content of the Services without express written permission from the Company.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>);

}