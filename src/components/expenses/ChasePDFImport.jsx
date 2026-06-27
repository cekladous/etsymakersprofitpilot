import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
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
  const fileInputRef = useRef(null);

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
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      handleParse(selectedFile);
    } else {
      setError('Please select a valid PDF file.');
    }
  };

  const handleParse = async (pdfFile) => {
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
                date: { type: 'string' },
                description: { type: 'string' },
                amount: { type: 'number' },
              },
              required: ['date', 'description', 'amount'],
            },
          },
        },
      };

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({ 
        file_url, 
        json_schema: schema 
      });

      if (result.status === 'success' && result.output?.transactions) {
        setTransactions(result.output.transactions.map(t => ({
          ...t,
          include: true,
          category: autoCategorize(t.description, userRules),
        })));
      } else {
        throw new Error(result.details || 'Failed to extract transactions from PDF.');
      }
    } catch (e) {
      setError(`Error parsing PDF: ${e.message}`);
    } finally {
      setParsing(false);
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
            date: new Date(t.date).toISOString().split('T')[0],
            description: t.description,
            amount: t.amount,
            category_name: t.category,
            vendor: 'Chase Bank',
            payment_source: 'Bank Account',
            category_group: 'business_expenses',
        }));
        await base44.entities.BusinessExpense.bulkCreate(expensesToCreate);
        return { importedCount: selectedTransactions.length, totalFound: transactions.length };
    },
    onSuccess: ({ importedCount, totalFound }) => {
      toast({
        title: 'Import Successful',
        description: `${importedCount} of ${totalFound} transactions imported.`,
      });
      queryClient.invalidateQueries({ queryKey: ['business-expenses'] });
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
    setFile(null);
    setParsing(false);
    setTransactions([]);
    setError(null);
    setImporting(false);
  }

  const columns = [
    {
        header: ()=><Checkbox 
            checked={transactions.every(t => t.include)}
            onCheckedChange={(checked) => setTransactions(transactions.map(t => ({...t, include: checked})))} 
        />,
        render: (row, index) => <Checkbox checked={row.include} onCheckedChange={(checked) => handleTransactionChange(index, 'include', checked)} />
    },
    { header: 'Date', render: (row) => new Date(row.date).toLocaleDateString() },
    { 
        header: 'Description', 
        render: (row, index) => <Input value={row.description} onChange={(e) => handleTransactionChange(index, 'description', e.target.value)} className="w-full" />
    },
    { 
        header: 'Amount', 
        render: (row) => `$${row.amount.toFixed(2)}` 
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
          <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-stone-200 rounded-lg">
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
            <Button onClick={() => fileInputRef.current.click()} variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Select PDF Statement
            </Button>
            <p className="text-xs text-stone-500 mt-2">Chase bank statements supported.</p>
          </div>
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