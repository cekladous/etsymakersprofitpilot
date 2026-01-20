import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Copy, Trash2, Check } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

export default function PromoCodeManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    plan_id: 'maker_pro',
    discount_type: 'free',
    discount_value: 0,
    duration_months: 1,
    max_uses: -1,
    expires_at: '',
    description: ''
  });
  const [copied, setCopied] = useState(null);

  const { data: promoCodes } = useQuery({
    queryKey: ['promoCodes'],
    queryFn: () => base44.asServiceRole.entities.PromoCode.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.asServiceRole.entities.PromoCode.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promoCodes'] });
      setOpen(false);
      setFormData({
        code: '',
        plan_id: 'maker_pro',
        discount_type: 'free',
        discount_value: 0,
        duration_months: 1,
        max_uses: -1,
        expires_at: '',
        description: ''
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.asServiceRole.entities.PromoCode.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promoCodes'] })
  });

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="p-8">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <p className="text-amber-800">Only admins can manage promo codes.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreate = () => {
    createMutation.mutate({
      ...formData,
      code: formData.code.toUpperCase(),
      current_uses: 0
    });
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Promo Codes</h1>
          <p className="text-stone-600 mt-1">Manage discount codes for users</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Plus className="w-4 h-4" />
              New Code
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Promo Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-stone-700">Code</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="EARLYMAKER2025"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700">Plan</label>
                <Select value={formData.plan_id} onValueChange={(v) => setFormData({ ...formData, plan_id: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maker_pro">Maker Pro</SelectItem>
                    <SelectItem value="maker_plus">Maker Plus</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700">Discount Type</label>
                <Select value={formData.discount_type} onValueChange={(v) => setFormData({ ...formData, discount_type: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.discount_type !== 'free' && (
                <div>
                  <label className="text-sm font-medium text-stone-700">Discount Value</label>
                  <Input
                    type="number"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                    placeholder={formData.discount_type === 'percentage' ? '20' : '5'}
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-stone-700">Duration (months)</label>
                <Input
                  type="number"
                  value={formData.duration_months}
                  onChange={(e) => setFormData({ ...formData, duration_months: parseInt(e.target.value) })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700">Max Uses (-1 = unlimited)</label>
                <Input
                  type="number"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: parseInt(e.target.value) })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700">Expires At</label>
                <Input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Internal notes..."
                  className="mt-1"
                />
              </div>

              <Button onClick={handleCreate} className="w-full bg-emerald-600 hover:bg-emerald-700">
                Create Code
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {promoCodes?.map((promo) => (
          <Card key={promo.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <code className="bg-stone-100 px-3 py-1 rounded font-mono font-bold text-stone-900">
                      {promo.code}
                    </code>
                    <Badge variant={promo.is_active ? 'default' : 'secondary'}>
                      {promo.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">{promo.plan_id.replace('_', ' ')}</Badge>
                  </div>
                  {promo.description && (
                    <p className="text-sm text-stone-600 mt-1">{promo.description}</p>
                  )}
                </div>
                <button
                  onClick={() => copyCode(promo.code)}
                  className="p-2 hover:bg-stone-100 rounded transition-colors"
                  title="Copy code"
                >
                  {copied === promo.code ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-stone-400" />
                  )}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-stone-600">Discount:</span>
                  <p className="font-semibold text-stone-900">
                    {promo.discount_type === 'free' ? 'Free' : 
                     promo.discount_type === 'percentage' ? `${promo.discount_value}%` : 
                     `$${promo.discount_value}`}
                  </p>
                </div>
                <div>
                  <span className="text-stone-600">Duration:</span>
                  <p className="font-semibold text-stone-900">{promo.duration_months} month{promo.duration_months !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <span className="text-stone-600">Uses:</span>
                  <p className="font-semibold text-stone-900">
                    {promo.current_uses} / {promo.max_uses === -1 ? '∞' : promo.max_uses}
                  </p>
                </div>
                <div>
                  <span className="text-stone-600">Expires:</span>
                  <p className="font-semibold text-stone-900">
                    {promo.expires_at ? new Date(promo.expires_at).toLocaleDateString() : 'Never'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate(promo.id)}
                className="mt-4 text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}