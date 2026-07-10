import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Upload, Loader2, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { parse, format } from 'date-fns';
import DataTable from '../ui/DataTable';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { BUSINESS_EXPENSE_CATEGORIES, ETSY_FEE_CATEGORIES } from '../shared/expenseCategories';
import { autoCategorize } from './autoCategorize';

export default function ChasePDFImport({ open, onOpenChange }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [userRules, setUserRules] = useState([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const parseSessionRef = useRef(0);

  // Fetch user's auto-categorization rules from Settings when dialog opens
  useEffect(() => {
    if (!open || !user) return;
    const fetchRules = async () => {
      try {
        const settings = await base44.entities.Settings.filter({ owner_user_id: user.id });
        const rules = settings?.[0]?.auto_categorization_rules;
        if (Array.isArray(rules)) setUserRules(rules);
      } catch (e) {
        // Silently fall back to defaults
      }
    };
    fetchRules();
  }, [open, user]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name?.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setFile(selectedFile);
      setError(null);
      handleParse(selectedFile);
    } else {
      setError('Please select a valid PDF file.');
    }
    e.target.value = '';
  };

  const handleParse = async (pdfFile) => {
    const sessionId = ++parseSessionRef.current;
    setParsing(true);
    setError(null);
    setTransactions([]);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });

      const schema = {
        type: 'object',
        properties: {
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'Transaction date in YYYY-MM-DD format (e.g., 2025-07-15). Always include the full 4-digit year.' },
                description: { type: 'string', description: 'Transaction description or merchant name' },
                amount: { type: 'number', description: 'Transaction amount as a numeric value (positive for debits/charges, negative for credits/refunds)' },
              },
              required: ['date', 'description', 'amount'],
            },
          },
        },
      };

      const extractPromise = base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: schema
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('PDF analysis timed out after 90 seconds. The file may be too large or image-based. Try using CSV import instead.')), 90000)
      );

      const result = await Promise.race([extractPromise, timeoutPromise]);

      if (parseSessionRef.current !== sessionId) return;
      if (result.status === 'success' && result.output?.transactions) {
        // Fetch existing expenses to detect duplicates
        const existingExpenses = await base44.entities.BusinessExpense.filter({ owner_user_id: user.id });
        const existingKeys = new Set(existingExpenses.map(e => {
          const d = parseDateSafe(e.date);
          const dateStr = d ? format(d, 'yyyy-MM-dd') : e.date;
          return `${dateStr}|${Math.abs(e.amount || 0).toFixed(2)}|${(e.description || '').substring(0, 40).trim().toLowerCase()}`;
        }));

        const parsed = result.output.transactions.map(t => {
          const desc = (t.description || '').toLowerCase();
          const isCardPayment = desc.includes('payment thank you') || desc.includes('thank you-mobile') || desc.includes('thank you - mobile');
          const formattedDate = formatDateSafe(t.date);
          const dupKey = `${formattedDate}|${Math.abs(Number(t.amount) || 0).toFixed(2)}|${(t.description || '').substring(0, 40).trim().toLowerCase()}`;
          const isDuplicate = existingKeys.has(dupKey);
          return {
            ...t,
            include: !isCardPayment && !isDuplicate,
            category: autoCategorize(t.description, userRules),
            isDuplicate,
          };
        });
        const dupCount = parsed.filter(t => t.isDuplicate).length;
        setDuplicateCount(dupCount);
        setTransactions(parsed);
      } else {
        throw new Error(result.details || 'Failed to extract transactions from PDF.');
      }
    } catch (e) {
      if (parseSessionRef.current !== sessionId) return;
      setError(`Error parsing PDF: ${e.message || String(e)}`);
    } finally {
      if (parseSessionRef.current === sessionId) setParsing(false);
    }
  };

  const handleTransactionChange = (index, field, value) => {
    const newTransactions = [...transactions];
    newTransactions[index][field] = value;
    setTransactions(newTransactions);
  };

  const importMutation = useMutation({
    mutationFn: async (selectedTransactions) => {
        const currentUser = await base44.auth.me();
        const expensesToCreate = selectedTransactions.map(t => ({
            owner_user_id: currentUser.id,
            date: formatDateSafe(t.date),
            description: t.description,
            amount: Number(t.amount) || 0,
            category_name: t.category,
            vendor: 'Chase Bank',
            payment_source: 'Bank Account',
            category_group: 'business_expenses',
        })).filter(e => e.date); // Skip entries with unparseable dates
        // Deduplicate: fetch existing business expenses and skip already-imported ones
        const existing = await base44.entities.BusinessExpense.filter({ owner_user_id: currentUser.id });
        const existingKeys = new Set(existing.map(e => `${e.date}|${Math.abs(e.amount || 0).toFixed(2)}|${(e.description || '').substring(0, 40).trim().toLowerCase()}`));
        const seenInBatch = new Set();
        const expensesForImport = expensesToCreate.filter(e => {
          const key = `${e.date}|${Math.abs(e.amount || 0).toFixed(2)}|${(e.description || '').substring(0, 40).trim().toLowerCase()}`;
          if (existingKeys.has(key) || seenInBatch.has(key)) return false;
          seenInBatch.add(key);
          return true;
        });
        if (expensesForImport.length === 0) return { importedCount: 0, totalFound: transactions.length };
        // Chunked bulk create with retry for reliability
        const chunkSize = 10;
        let importedCount = 0;
        for (let i = 0; i < expensesForImport.length; i += chunkSize) {
            const chunk = expensesForImport.slice(i, i + chunkSize);
            let retries = 0;
            while (retries <= 2) {
                try {
                    await base44.entities.BusinessExpense.bulkCreate(chunk);

                    importedCount += chunk.length;
                    break;
                } catch (err) {
                    retries++;
                    if (retries > 2) throw err;
                    await new Promise(r => setTimeout(r, 500 * retries));
                }
            }
            if (i + chunkSize < expensesForImport.length) {

                await new Promise(r => setTimeout(r, 200));
            }
        }
        return { importedCount, totalFound: transactions.length };
    },
    onSuccess: ({ importedCount, totalFound }) => {
      toast({
        title: 'Import Successful',
        description: `${importedCount} of ${totalFound} transactions imported.`,
      });
      queryClient.invalidateQueries({ queryKey: ['business-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      onOpenChange(false);

      resetState();
    },
    onError: (e) => {
      setError(`Import failed: ${e.message}`);
    },
    onSettled: () => {
        setImporting(false);
    }
  });

  const parseDateSafe = (dateStr) => {
    if (!dateStr) return null;
    const str = String(dateStr).trim();
    const formats = ['MM/dd/yyyy', 'yyyy-MM-dd', 'MMM d, yyyy', 'MMM dd, yyyy', 'd-MMM-yyyy', 'MM-dd-yyyy', 'dd/MM/yyyy', 'M/d/yyyy', 'M/d/yy', 'MMMM d, yyyy', 'MMM d yyyy', 'MMM dd yyyy', 'd MMM yyyy', 'dd MMM yyyy', 'MM/dd/yy', 'yyyy/MM/dd', 'M.d.yyyy', 'MMM. d, yyyy', 'MMM. d yyyy', 'd MMM. yyyy', 'MMM d, yy', 'MMM dd, yy'];
    for (const fmt of formats) {
      try {
        const d = parse(str, fmt, new Date());
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      } catch (e) { /* try next */ }
    }
    // Regex fallback: MM/DD or MM/DD/YYYY
    const slashMatch = str.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (slashMatch) {
      let month = parseInt(slashMatch[1]);
      let day = parseInt(slashMatch[2]);
      let year = slashMatch[3] ? parseInt(slashMatch[3]) : new Date().getFullYear();
      if (year < 100) year += year >= 50 ? 1900 : 2000;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const d = new Date(year, month - 1, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
    // Regex fallback: YYYY-MM-DD
    const isoMatch = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
      if (!isNaN(d.getTime())) return d;
    }
    // Regex fallback: Month name DD, YYYY (e.g., "Jul 15, 2025" or "July 15 2025")
    const monthNameMatch = str.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{2,4})/i);
    if (monthNameMatch) {
      const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
      const monthIdx = months[monthNameMatch[1].toLowerCase().substring(0,3)];
      const day = parseInt(monthNameMatch[2]);
      let year = parseInt(monthNameMatch[3]);
      if (year < 100) year += year >= 50 ? 1900 : 2000;
      if (monthIdx !== undefined) {
        const d = new Date(year, monthIdx, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
    // Regex fallback: DD-Mon-YYYY (e.g., "15-Jul-2025")
    const dmonMatch = str.match(/(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*-?(\d{2,4})/i);
    if (dmonMatch) {
      const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
      const monthIdx = months[dmonMatch[2].toLowerCase().substring(0,3)];
      const day = parseInt(dmonMatch[1]);
      let year = parseInt(dmonMatch[3]);
      if (year < 100) year += year >= 50 ? 1900 : 2000;
      if (monthIdx !== undefined) {
        const d = new Date(year, monthIdx, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const native = new Date(str);
    return (native instanceof Date && !isNaN(native.getTime())) ? native : null;
  };

  const formatDateSafe = (dateStr) => {
    const d = parseDateSafe(dateStr);
    return d ? format(d, 'yyyy-MM-dd') : null;
  };

  const handleImport = () => {
    setImporting(true);
    const selected = transactions.filter(t => t.include);
    if (selected.length > 0) {
        importMutation.mutate(selected);
    } else {
        setError('No transactions selected to import.');
        setImporting(false);
    }
  };

  const resetState = () => {
    parseSessionRef.current++; // invalidate any in-flight parse
    setFile(null);
    setParsing(false);
    setTransactions([]);
    setError(null);
    setImporting(false);
    setDuplicateCount(0);
  }

  const columns = [
    {
        header: ()=><Checkbox 
            checked={transactions.every(t => t.include)}
            onCheckedChange={(checked) => setTransactions(transactions.map(t => ({...t, include: checked})))} 
        />,
        render: (row, index) => <Checkbox checked={row.include} onCheckedChange={(checked) => handleTransactionChange(index, 'include', checked)} />
    },
    { header: 'Date', render: (row) => {
        const d = parseDateSafe(row.date);
        return d ? format(d, 'MMM d, yyyy') : (row.date || '-');
    } },
    { 
        header: 'Description', 
        render: (row, index) => <Input value={row.description} onChange={(e) => handleTransactionChange(index, 'description', e.target.value)} className="w-full" />
    },
    { 
        header: 'Amount', 
        render: (row) => `$${Number(row.amount || 0).toFixed(2)}`
    },
    {
        header: 'Category',
        render: (row, index) => (
            <Select value={row.category} onValueChange={(value) => handleTransactionChange(index, 'category', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel className="text-stone-500 font-semibold">Business Expenses</SelectLabel>
                        {BUSINESS_EXPENSE_CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                        <SelectLabel className="text-stone-500 font-semibold">Etsy Fees</SelectLabel>
                        {ETSY_FEE_CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
        )
    },
    {
        header: '',
        render: (row) => row.isDuplicate ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-1 whitespace-nowrap">
                <Copy className="w-3 h-3" /> Duplicate
            </span>
        ) : null
    }
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if(!isOpen) resetState(); onOpenChange(isOpen); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import Expenses from PDF (Beta)</DialogTitle>
          <DialogDescription>
            Upload a Chase bank statement PDF. Review the extracted transactions before importing.
          </DialogDescription>
        </DialogHeader>
        
        {!file && (
          <label className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-stone-200 rounded-lg cursor-pointer hover:border-stone-300 hover:bg-stone-50 transition-colors">
            <input type="file" accept=".pdf" onChange={handleFileChange} className="sr-only" />
            <Upload className="w-10 h-10 text-stone-400 mb-3" />
            <span className="text-stone-600 font-medium">Click to select PDF Statement</span>
            <p className="text-xs text-stone-500 mt-2">Chase bank statements supported.</p>
          </label>
        )}

        {parsing && (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3" />
                <p>Analyzing PDF...</p>
            </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {duplicateCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">
              <span className="font-semibold">{duplicateCount}</span> {duplicateCount === 1 ? 'transaction was' : 'transactions were'} already imported from a previous upload and {duplicateCount === 1 ? 'has' : 'have'} been unselected.
            </p>
          </div>
        )}

        {transactions.length > 0 && (
            <div>
                <p className="text-sm text-stone-600 mb-2">Found {transactions.length} transactions. Please review and categorize before importing.</p>
                <DataTable columns={columns} data={transactions} />
            </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={parsing || importing || transactions.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
            {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</> : `Import ${transactions.filter(t=>t.include).length} Selected`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}