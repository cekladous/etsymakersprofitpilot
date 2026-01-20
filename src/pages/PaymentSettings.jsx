import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Square, ShoppingBag } from 'lucide-react';

export default function PaymentSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('etsy');
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
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Payment Settings</h1>
        <p className="text-stone-600">Choose your preferred payment methods for your customers</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Etsy Card */}
        <Card className="border-stone-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-6 h-6 text-orange-600" />
              <CardTitle className="text-lg">Etsy Integration</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Etsy Payments</Label>
              {etsy_enabled ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline">Not Connected</Badge>
              )}
            </div>
            <p className="text-sm text-stone-600">
              Connect your Etsy shop to sync orders and payments directly.
            </p>
            <Button
              variant="outline"
              className="w-full"
              disabled={etsy_enabled}
            >
              {etsy_enabled ? 'Already Connected' : 'Connect Etsy'}
            </Button>
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

      {/* Info Box */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Both Methods Available</h3>
              <p className="text-sm text-blue-800">
                Customers can choose their preferred payment method during checkout. You can accept Etsy orders and Square card payments simultaneously.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}