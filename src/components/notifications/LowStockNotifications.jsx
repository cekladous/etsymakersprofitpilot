import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, PackageX, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

export default function LowStockNotifications() {
  const { user } = useAuth();

  const { data: materialTypes = [] } = useQuery({
    queryKey: ["materialTypes", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.MaterialType.filter({ owner_user_id: user.id }),
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-items", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.InventoryItem.filter({ owner_user_id: user.id }),
  });

  // Check for low stock and out of stock items
  const notifications = materialTypes
    .map(materialType => {
      const inventoryItem = inventoryItems.find(i => i.material_name === materialType.name);
      const quantity = inventoryItem?.quantity_on_hand || 0;
      const threshold = materialType.low_stock_threshold || 5;

      if (quantity === 0) {
        return {
          type: "out_of_stock",
          severity: "critical",
          material_name: materialType.name,
          quantity: 0,
          threshold,
        };
      } else if (quantity <= threshold) {
        return {
          type: "low_stock",
          severity: "warning",
          material_name: materialType.name,
          quantity,
          threshold,
        };
      }
      return null;
    })
    .filter(Boolean);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <Bell className="w-5 h-5" />
          Inventory Alerts ({notifications.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {notifications.slice(0, 5).map((notif, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between p-3 rounded-lg ${
              notif.severity === "critical" 
                ? "bg-rose-100 border border-rose-200" 
                : "bg-amber-100 border border-amber-200"
            }`}
          >
            <div className="flex items-center gap-3">
              {notif.severity === "critical" ? (
                <PackageX className="w-5 h-5 text-rose-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              )}
              <div>
                <p className={`font-medium text-sm ${
                  notif.severity === "critical" ? "text-rose-900" : "text-amber-900"
                }`}>
                  {notif.material_name}
                </p>
                <p className="text-xs text-stone-600">
                  {notif.type === "out_of_stock" 
                    ? "Out of stock" 
                    : `Low stock: ${notif.quantity} remaining (threshold: ${notif.threshold})`
                  }
                </p>
              </div>
            </div>
          </div>
        ))}
        {notifications.length > 5 && (
          <p className="text-xs text-stone-600 text-center pt-2">
            +{notifications.length - 5} more alerts
          </p>
        )}
        <Link to={createPageUrl("Inventory")}>
          <Button variant="outline" size="sm" className="w-full mt-2">
            View All Materials
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}