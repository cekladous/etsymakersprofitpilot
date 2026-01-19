import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2, Mail, Phone, Building2 } from "lucide-react";

export default function CustomerCard({ customer, onView, onEdit, onDelete }) {
  return (
    <Card className="hover:shadow-lg transition-all duration-200 hover:border-emerald-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-stone-900">{customer.name}</h3>
            {customer.company && (
              <div className="flex items-center gap-2 text-sm text-stone-600 mt-1">
                <Building2 className="w-4 h-4 text-stone-400" />
                {customer.company}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {customer.email && (
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Mail className="w-4 h-4 text-stone-400" />
              <a href={`mailto:${customer.email}`} className="hover:text-emerald-600 truncate">
                {customer.email}
              </a>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Phone className="w-4 h-4 text-stone-400" />
              <a href={`tel:${customer.phone}`} className="hover:text-emerald-600">
                {customer.phone}
              </a>
            </div>
          )}
        </div>

        <div className="text-xs text-stone-400 mb-4">
          Added {new Date(customer.created_date).toLocaleDateString()}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(customer)}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(customer)}
            className="flex-1"
          >
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(customer)}
            className="flex-1 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}