import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

export default function QuickAddSaleDialog({ open, onOpenChange, products = [] }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  useEffect(() => {
    if (product) {
      const selectedProduct = products.find(p => p.id === product);
      if (selectedProduct) {
        setPrice(selectedProduct.sale_price || "");
      }
    } else {
      setPrice("");
    }
  }, [product, products]);

  const mutation = useMutation({
    mutationFn: (newSale) => base44.entities.CustomSale.create(newSale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-sales"] });
      toast({ title: "Success", description: "Custom sale added." });
      // Reset form for next entry
      setProduct(null);
      setQuantity(1);
      setPrice("");
      setDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("Cash");
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  });

  const handleSubmit = () => {
    const selectedProduct = products.find(p => p.id === product);
    const grossSale = parseFloat(price) * parseInt(quantity);

    mutation.mutate({
      owner_user_id: user.id,
      date,
      description: selectedProduct ? `${selectedProduct.name} (x${quantity})` : "Quick Add Sale",
      pre_tax_amount: grossSale,
      gross_sale: grossSale,
      payment_source: paymentMethod,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Add Custom Sale</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Product</Label>
            <Select value={product || ""} onValueChange={setProduct}>
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" />
            </div>
            <div className="space-y-2">
              <Label>Price ($)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Venmo">Venmo</SelectItem>
                <SelectItem value="PayPal">PayPal</SelectItem>
                <SelectItem value="Square">Square</SelectItem>
                <SelectItem value="Zelle">Zelle</SelectItem>
                <SelectItem value="Squarespace">Squarespace</SelectItem>
                <SelectItem value="Shopify">Shopify</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
          <Button onClick={handleSubmit} disabled={mutation.isLoading} className="bg-emerald-600 hover:bg-emerald-700">
            {mutation.isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save & Add Another
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}