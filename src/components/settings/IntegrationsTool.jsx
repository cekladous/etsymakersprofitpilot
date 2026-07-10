import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ShoppingBag, Square, Upload, Link2, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import PlatformSalesImport from '@/components/imports/PlatformSalesImport';

export default function IntegrationsTool() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [squareLocationId, setSquareLocationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [importPlatform, setImportPlatform] = useState(null);

  const { data: settings = [] } = useQuery({
    queryKey: ['settings', user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Settings.filter({ owner_user_id: user.id })
  });

  useEffect(() => {
    if (settings.length > 0) {
      setSquareLocationId(settings[0]?.square_location_id || '');
    }
  }, [settings]);

  const saveSquareSettings = async () => {
    if (!settings[0]) return;
    setSaving(true);
    try {
      await base44.entities.Settings.update(settings[0].id, {
        square_location_id: squareLocationId || null
      });
      queryClient.invalidateQueries({ queryKey: ['settings', user?.id] });
      alert('Square settings saved successfully!');
    } catch (error) {
      alert('Error saving settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-1">Data Import & Integrations</h3>
        <p className="text-sm text-blue-800">
          Connect your sales channels and payment processors to import data into Profit Pilot.
          This is a bookkeeping tool — no checkout or customer-facing features.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Etsy */}
        <Card className="border-stone-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-6 h-6 text-orange-600" />
                <CardTitle className="text-lg">Etsy</CardTitle>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Available
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-stone-600">
              Import your Etsy sales data via CSV. No API connection needed — just download from Etsy and upload.
            </p>
            <div className="bg-stone-50 rounded-lg p-3 space-y-2 text-sm">
              <p className="font-semibold text-stone-700">How to import:</p>
              <ol className="list-decimal list-inside space-y-1 text-stone-600 text-xs">
                <li>Go to Etsy → <strong>Finances → Payment Account → Download CSV</strong></li>
                <li>Save the Monthly Statement CSV file</li>
                <li>Go to the Etsy Sales page and click "Import Etsy Data"</li>
              </ol>
            </div>
            <Link to="/Orders">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                <Upload className="w-4 h-4 mr-2" />
                Go to Etsy Sales Import
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Square */}
        <Card className="border-stone-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Square className="w-6 h-6 text-blue-600" />
                <CardTitle className="text-lg">Square</CardTitle>
              </div>
              {settings[0]?.square_location_id ? (
                <Badge className="bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge className="bg-stone-100 text-stone-500">
                  Not Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-stone-600">
              Enter your Square Location ID to track Square sales. Import Square CSV exports alongside your Etsy data for complete profit tracking.
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-sm text-stone-600 mb-2 block">
                  Square Location ID
                </Label>
                <Input
                  placeholder="Enter your Square Location ID"
                  value={squareLocationId}
                  onChange={(e) => setSquareLocationId(e.target.value)}
                  className="bg-stone-50"
                />
                <p className="text-xs text-stone-500 mt-2">
                  Go to Square Dashboard → Locations → copy your Location ID
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={saveSquareSettings}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Square Settings'}
            </Button>

            <div className="border-t border-stone-200 pt-4 space-y-3">
              <div className="bg-stone-50 rounded-lg p-3 space-y-2 text-sm">
                <p className="font-semibold text-stone-700">Import Square transactions:</p>
                <ol className="list-decimal list-inside space-y-1 text-stone-600 text-xs">
                  <li>In Square Dashboard → <strong>Reports → Transactions → Export</strong></li>
                  <li>Save the CSV file to your computer</li>
                  <li>Click "Import Square Transactions" below and upload the file</li>
                </ol>
                <p className="text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1 mt-2">
                  ✓ Sales already in your Etsy orders are automatically skipped
                </p>
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setImportPlatform('square')}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Square Transactions
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Shopify */}
        <Card className="border-stone-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-6 h-6 text-green-600" />
                <CardTitle className="text-lg">Shopify</CardTitle>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Available
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-stone-600">
              Import your Shopify orders via CSV export. Each order becomes a custom sale record for profit tracking.
            </p>
            <div className="bg-stone-50 rounded-lg p-3 space-y-2 text-sm">
              <p className="font-semibold text-stone-700">How to import:</p>
              <ol className="list-decimal list-inside space-y-1 text-stone-600 text-xs">
                <li>In Shopify admin → <strong>Orders → Export → Download CSV</strong></li>
                <li>Save the CSV file to your computer</li>
                <li>Click "Import Shopify Sales" below and upload the file</li>
              </ol>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setImportPlatform('shopify')}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Shopify Sales
            </Button>
          </CardContent>
        </Card>

        {/* Squarespace */}
        <Card className="border-stone-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link2 className="w-6 h-6 text-stone-600" />
                <CardTitle className="text-lg">Squarespace</CardTitle>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Available
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-stone-600">
              Import your Squarespace orders via CSV export. Each order becomes a custom sale record for profit tracking.
            </p>
            <div className="bg-stone-50 rounded-lg p-3 space-y-2 text-sm">
              <p className="font-semibold text-stone-700">How to import:</p>
              <ol className="list-decimal list-inside space-y-1 text-stone-600 text-xs">
                <li>In Squarespace → <strong>Analytics → Orders → Export CSV</strong></li>
                <li>Save the CSV file to your computer</li>
                <li>Click "Import Squarespace Sales" below and upload the file</li>
              </ol>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setImportPlatform('squarespace')}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Squarespace Sales
            </Button>
          </CardContent>
        </Card>
      </div>

      <PlatformSalesImport
        open={!!importPlatform}
        onOpenChange={(open) => { if (!open) setImportPlatform(null); }}
        platform={importPlatform}
      />
    </div>
  );
}