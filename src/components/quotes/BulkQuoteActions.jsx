import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function BulkQuoteActions({ selectedQuotes, quotes, settings }) {
  const [exporting, setExporting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertResults, setConvertResults] = useState(null);
  const queryClient = useQueryClient();

  const selectedQuoteObjects = quotes.filter(q => selectedQuotes.includes(q.id));
  const acceptedQuotes = selectedQuoteObjects.filter(q => q.status === "Accepted");
  const unconvertedAccepted = acceptedQuotes.filter(q => !q.converted_to_order_id);

  const convertMutation = useMutation({
    mutationFn: async (quotesToConvert) => {
      const results = [];
      for (const quote of quotesToConvert) {
        try {
          const { quote: updatedQuote, order } = await base44.functions.invoke('convertQuoteToOrder', {
            quoteId: quote.id
          });
          results.push({ quote, order, success: true });
        } catch (error) {
          results.push({ quote, error: error.message, success: false });
        }
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const handleBulkConvert = async () => {
    setConverting(true);
    const results = await convertMutation.mutateAsync(unconvertedAccepted);
    setConvertResults(results);
    setConverting(false);
  };

  const handleBulkExportPDF = async () => {
    setExporting(true);
    try {
      const { exportQuoteToPDF } = await import("./exportQuoteToPDF");
      
      for (const quote of selectedQuoteObjects) {
        // Small delay between exports to prevent browser overload
        await new Promise(resolve => setTimeout(resolve, 300));
        exportQuoteToPDF(quote, settings?.business_name || "Your Business");
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export PDFs');
    }
    setExporting(false);
  };

  if (selectedQuotes.length === 0) return null;

  return (
    <>
      <div className="flex gap-2 p-4 bg-stone-50 rounded-lg border border-stone-200">
        <div className="flex-1">
          <p className="font-medium text-stone-900">{selectedQuotes.length} quote(s) selected</p>
          <p className="text-xs text-stone-600">{unconvertedAccepted.length} accepted & unconverted</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkExportPDF}
            disabled={exporting || selectedQuotes.length === 0}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export PDFs ({selectedQuotes.length})
          </Button>
          {unconvertedAccepted.length > 0 && (
            <Button
              size="sm"
              onClick={handleBulkConvert}
              disabled={converting}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Convert Orders ({unconvertedAccepted.length})
            </Button>
          )}
        </div>
      </div>

      {convertResults && (
        <Dialog open={!!convertResults} onOpenChange={() => setConvertResults(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conversion Results</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {convertResults.map((result, idx) => (
                <div key={idx} className="flex gap-3 p-3 rounded border">
                  {result.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="text-sm">
                    <p className="font-medium">{result.quote.quote_number}</p>
                    <p className="text-xs text-stone-600">
                      {result.success ? `Converted to order` : result.error}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={() => setConvertResults(null)} className="w-full">
              Done
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}