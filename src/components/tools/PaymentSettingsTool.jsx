import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Square, ShoppingBag, Upload, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PaymentSettingsTool() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [etsy_enabled, setEtsyEnabled] = useState(false);
  const [square_enabled, setSquareEnabled] = useState(false);
  const [squareLocationId, setSquareLocationId] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: settings = [] } = useQuery({
    queryKey: ['settings', user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Settings.filter({ owner_user_id: user.id })
  });

  useEffect(() => {
    if (settings.length > 0) {
      setEtsyEnabled(!!settings[0]?.etsy_oauth_token);
      setSquareEnabled(!!settings[0]?.square_location_id);
      setSquareLocationId(settings[0]?.square_location_id || '');
    }
  }, [settings]);

  const updateSettings = async () => {
    if (!settings[0]) return;

    setSaving(true);
    try {
      await base44.entities.Settings.update(settings[0].id, {
        square_location_id: square_enabled ? squareLocationId : null
      });
      queryClient.invalidateQueries({ queryKey: ['settings', user?.id] });
      alert('Payment settings saved successfully!');
    } catch (error) {
      alert('Error saving settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Etsy Card */}
        <Card className="border-stone-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-6 h-6 text-orange-600" />
              <CardTitle className="text-lg">Etsy Data Import</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800">
                <FileText className="w-3 h-3 mr-1" />
                CSV Import
              </Badge>
            </div>
            <p className="text-sm text-stone-600">
              Import your Etsy data by downloading CSV files from Etsy and uploading them here. No API connection needed.
            </p>
            <div className="bg-stone-50 rounded-lg p-3 space-y-2 text-sm">
              <p className="font-semibold text-stone-700">How to import:</p>
              <ol className="list-decimal list-inside space-y-1 text-stone-600 text-xs">
                <li>Go to Etsy → <strong>Finances → Payment Account → Download CSV</strong></li>
                <li>Save the Monthly Statement CSV file</li>
                <li>Click "Import Etsy Data" below and upload the file</li>
              </ol>
            </div>
            <Link to="/Orders">
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Etsy Data
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Square Card */}
        <Card className="border-stone-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Square className="w-6 h-6 text-blue-600" />
              <CardTitle className="text-lg">Square Payments</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Square Checkout</Label>
              <Switch
                checked={square_enabled}
                onCheckedChange={setSquareEnabled}
              />
            </div>

            {square_enabled && (
              <div className="space-y-3 pt-3 border-t border-stone-200">
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
                    Find this in your Square Dashboard
                  </p>
                </div>
              </div>
            )}

            <p className="text-sm text-stone-600">
              Accept card payments directly from your customers with Square.
            </p>

            <Button
              variant="outline"
              className="w-full"
              onClick={updateSettings}
              disabled={saving || !square_enabled || !squareLocationId}
            >
              {saving ? 'Saving...' : 'Save Square Settings'}
            </Button>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}