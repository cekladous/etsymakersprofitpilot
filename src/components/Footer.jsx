import React, { useState } from "react";
import { X, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Footer() {
  const [openModal, setOpenModal] = useState(null);

  const termsOfService = (
    <div className="space-y-4 text-sm text-stone-700 max-h-96 overflow-y-auto">
      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Overview</h4>
        <p>
          When you use Etsy Maker's Profit Pilot products or services, you are agreeing to these Terms of Service ("Terms"). Violation of these terms may, at our discretion, result in us terminating your account.
        </p>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Definitions</h4>
        <ul className="list-disc pl-6 space-y-1">
          <li>"Company", "we", "our", or "us" refers to Etsy Maker's Profit Pilot.</li>
          <li>"Services" refers to our websites and any product created and maintained by Etsy Maker's Profit Pilot.</li>
          <li>"You" or "your" refers to the people or organizations that own an account with one or more of our Services.</li>
        </ul>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Account Terms</h4>
        <ul className="list-disc pl-6 space-y-1">
          <li>You are responsible for maintaining the security of your account and password.</li>
          <li>You are responsible for all content posted to and activity that occurs under your account.</li>
          <li>You must be a human. Accounts registered by "bots" or other automated methods are not permitted.</li>
          <li>You are responsible for the accuracy of the financial data you input into the Services.</li>
        </ul>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Financial Data & Liability</h4>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Data Accuracy:</strong> Calculations and reports are based on data you provide. We are not liable for inaccurate results due to incorrect input data.</li>
          <li><strong>Tax & Legal Advice:</strong> The Services do not provide tax, accounting, or legal advice. Consult qualified professionals regarding your business finances.</li>
          <li><strong>Etsy Integration:</strong> We are not affiliated with, endorsed by, or responsible for Etsy's services or any changes they make to their policies.</li>
        </ul>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Payment & Subscriptions</h4>
        <ul className="list-disc pl-6 space-y-1">
          <li>Free versions do not require credit card information.</li>
          <li>For paid Services, you must pay in advance. Non-payment will result in account suspension.</li>
          <li>All fees are exclusive of taxes, levies, or duties imposed by taxing authorities.</li>
          <li>Refunds are processed at our sole discretion.</li>
        </ul>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Cancellation & Termination</h4>
        <ul className="list-disc pl-6 space-y-1">
          <li>You can cancel your account at any time from your account settings.</li>
          <li>We reserve the right to suspend or terminate your account for any reason at any time.</li>
        </ul>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Liability Limitation</h4>
        <p>
          The Company is not liable for damages resulting from the use of or inability to access the Services, inaccurate financial calculations, or unauthorized access to your data.
        </p>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Intellectual Property</h4>
        <p>
          The Company owns all right, title, and interest in and to the Services. You may not duplicate, copy, or reuse any portion without express written permission.
        </p>
      </section>
    </div>
  );

  const privacyPolicy = (
    <div className="space-y-4 text-sm text-stone-700 max-h-96 overflow-y-auto">
      <p className="text-xs text-stone-600">Last Updated: January 20, 2026</p>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Overview</h4>
        <p>
          Etsy Maker's Profit Pilot is dedicated to collecting only what we need. This policy explains what data we collect, why we collect it, and how we handle it.
        </p>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">What We Collect and Why</h4>
        <ul className="space-y-2">
          <li>
            <strong>Identity & Access:</strong> When you sign up, we collect your name and email address to personalize your account and send product updates.
          </li>
          <li>
            <strong>Billing Information:</strong> Credit card information is submitted directly to our payment processor (Stripe) and doesn't hit our servers. We store a record of transactions for billing support.
          </li>
          <li>
            <strong>Product Data:</strong> We store content you upload or create (business data, quotes, product information, settings) so you can use our products as intended.
          </li>
          <li>
            <strong>Website Interactions:</strong> We collect information about your browsing activity for analytics purposes, including browser version and pages visited.
          </li>
        </ul>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Cookies</h4>
        <p>
          We use persistent first-party cookies and some third-party cookies to store preferences, make it easier to use our applications, and perform analytics.
        </p>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">When We Access Your Information</h4>
        <ul className="list-disc pl-6 space-y-1">
          <li>To provide products or services you've requested.</li>
          <li>To help you troubleshoot (with your consent).</li>
          <li>When required by applicable law with a legally binding order.</li>
        </ul>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Data Security</h4>
        <p>
          All data is encrypted via SSL/TLS when transmitted from our servers to your browser. Database backups are also encrypted. We use industry-standard security measures through Supabase.
        </p>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Data Retention</h4>
        <p>
          We keep your information for the time necessary for its stated purpose. If you delete your account, we'll delete your content within 60 days.
        </p>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Data Location</h4>
        <p>
          Our products are hosted in the United States. By using our services, you consent to the transfer and storage of your information in the United States.
        </p>
      </section>

      <section>
        <h4 className="font-semibold text-stone-900 mb-2">Questions</h4>
        <p>
          If you have questions about this policy, please contact us at <a href="mailto:craftedxdesginco@gmail.com" className="text-emerald-600 hover:text-emerald-700">craftedxdesginco@gmail.com</a>.
        </p>
      </section>
    </div>
  );

  return (
    <>
      <footer className="bg-stone-900 text-stone-400 py-8 px-4 mt-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <p className="font-semibold text-stone-200 mb-2 pr-4">Built by Etsy Maker's Profit Pilot</p>
            </div>
            <div className="flex flex-wrap gap-4 md:justify-end">
              <button
                onClick={() => setOpenModal("terms")}
                className="text-sm hover:text-stone-200 transition-colors"
              >
                Terms
              </button>
              <button
                onClick={() => setOpenModal("privacy")}
                className="text-sm hover:text-stone-200 transition-colors"
              >
                Privacy
              </button>
              <a
                href="mailto:craftedxdesginco@gmail.com"
                className="text-sm hover:text-stone-200 transition-colors flex items-center gap-1"
              >
                <Mail className="w-4 h-4" />
                Contact
              </a>
            </div>
          </div>
          <div className="border-t border-stone-800 pt-4 text-xs text-center">
            <p>&copy; 2026 Etsy Maker's Profit Pilot. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Modal */}
      {openModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full">
            <div className="flex justify-between items-center p-6 border-b border-stone-200">
              <h2 className="text-2xl font-bold text-stone-900">
                {openModal === "terms" ? "Terms of Service" : "Privacy Policy"}
              </h2>
              <button
                onClick={() => setOpenModal(null)}
                className="p-1 hover:bg-stone-100 rounded-lg"
              >
                <X className="w-6 h-6 text-stone-500" />
              </button>
            </div>
            <div className="p-6">
              {openModal === "terms" ? termsOfService : privacyPolicy}
            </div>
            <div className="p-6 border-t border-stone-200 flex justify-end">
              <Button
                onClick={() => setOpenModal(null)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}