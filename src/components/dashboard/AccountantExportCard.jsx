import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useFeatureAccess } from "@/components/shared/useFeatureAccess";
import { EXPORT_PRESETS, resolveRange, downloadAccountantReport } from "./accountantExport";

const today = new Date();
const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

export default function AccountantExportCard() {
  const { toast } = useToast();
  const { reportCsvExport } = useFeatureAccess();
  const [preset, setPreset] = useState("this_month");
  const [customStart, setCustomStart] = useState(firstOfMonth);
  const [customEnd, setCustomEnd] = useState(todayValue);
  const [fileFormat, setFileFormat] = useState("xlsx");
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    const range = resolveRange(preset, customStart, customEnd);
    if (range.error) {
      toast({ title: "Check the dates", description: range.error, variant: "destructive" });
      return;
    }
    setDownloading(true);
    try {
      await downloadAccountantReport({ ...range, fileFormat });
      toast({ title: "Report downloaded", description: `${range.label} is ready to send.` });
    } catch (error) {
      toast({
        title: "Download failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Accountant Export</CardTitle>
        <p className="text-sm text-stone-500">
          Download your revenue, fee and expense totals for any period as a file you can send to your accountant.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${preset === "custom" ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          <div className="space-y-1.5">
            <Label htmlFor="export-period" className="text-xs text-stone-600">Period</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger id="export-period" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_PRESETS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {preset === "custom" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="export-start" className="text-xs text-stone-600">From</Label>
                <Input
                  id="export-start"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="export-end" className="text-xs text-stone-600">To</Label>
                <Input
                  id="export-end"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-10"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="export-format" className="text-xs text-stone-600">File type</Label>
            <Select value={fileFormat} onValueChange={setFileFormat}>
              <SelectTrigger id="export-format" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx" disabled={!reportCsvExport}>
                  Excel spreadsheet{reportCsvExport ? "" : " (Pro)"}
                </SelectItem>
                <SelectItem value="pdf">PDF summary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-stone-500">
            Excel includes summary, revenue and expense breakdowns. PDF is a one-page summary.
          </p>
          <Button onClick={handleDownload} disabled={downloading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {downloading ? "Preparing file" : "Download report"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}