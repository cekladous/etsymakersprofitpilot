import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, HelpCircle, Link2, X, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { classifyEtsyLedgerEntry } from '@/components/shared/financialAggregator';

const CATEGORY_HELP = {
  sale: 'Payment for an item sold. Match to an EtsyOrder or mark as processed.',
  refund: 'Money returned to customer. Should reduce an order\'s revenue.',
  fee: 'Etsy charge (listing, transaction, etc). Should match to OrderFee.',
  deposit: 'Money deposited to bank account.',
  tax: 'Sales tax collected and held by Etsy.',
  shipping: 'Shipping label costs.',
  unmatched: 'Could not auto-classify. Needs manual review.'
};

const RESOLUTION_GUIDE = {
  sale: 'Search for the order by date/amount or manually enter order ID',
  refund: 'Link to the original order ID that was refunded',
  fee: 'Should auto-match to OrderFee; if not, check if fee already exists',
  deposit: 'Create or link to a Transfer record',
  tax: 'Link to the order that generated this tax',
  shipping: 'Link to the order this label was for',
  unmatched: 'Determine what this is (sale, fee, deposit?) then resolve'
};

// Generate auto-match suggestions based on description and amount
const generateAutoMatchSuggestion = (line) => {
  const desc = (line.description || '').toLowerCase();
  const amount = Math.abs(line.amount);
  
  if (desc.includes('refund') && desc.includes('to')) {
    const match = line.description.match(/to\s+([A-Za-z\s]+)/i);
    if (match) {
      return `Refund of $${amount.toFixed(2)} to ${match[1].trim()}`;
    }
    return `Refund of $${amount.toFixed(2)}`;
  }
  
  if (desc.includes('deposit') || desc.includes('payout')) {
    return `Deposit/Payout of $${amount.toFixed(2)}`;
  }
  
  if (desc.includes('fee') || desc.includes('charge')) {
    return `Fee of $${amount.toFixed(2)} for ${desc.substring(0, 40)}`;
  }
  
  return `Transaction of $${amount.toFixed(2)}`;
};

export default function UnmatchedLineCard({ 
  line, 
  onResolve, 
  isLoading 
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [resolutionMode, setResolutionMode] = useState(null);
  const [notes, setNotes] = useState('');

  const handleResolve = (type) => {
    onResolve({
      lineId: line.id,
      resolutionType: type,
      notes
    });
    setResolutionMode(null);
    setNotes('');
  };

  // Auto-classify using shared logic
  const autoClassification = classifyEtsyLedgerEntry({
    type: line.type,
    title: line.description || '',
    info: line.description || ''
  });
  const suggestedCategory = autoClassification.category || 'unmatched';
  
  const inferredCategory = line.category || suggestedCategory;
  const isNegative = line.amount < 0;

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header: Date, Amount, Type */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-stone-600">
                {format(new Date(line.transaction_date), 'MMM d, yyyy')}
              </p>
              <p className="font-mono text-xs text-stone-500 mt-1">
                {line.type}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${isNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
                {isNegative ? '−' : '+'}${Math.abs(line.amount).toFixed(2)}
              </p>
              <Badge variant="outline" className="text-xs mt-1">
                {inferredCategory}
              </Badge>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-sm text-stone-700 break-words">
              {line.description}
            </p>
          </div>

          {/* Why it's unmatched */}
          <div className="bg-white/50 rounded p-2 text-xs text-stone-600 flex gap-2">
            <HelpCircle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-stone-700">Why unmatched:</p>
              <p>{line.match_error || 'Could not auto-classify'}</p>
            </div>
          </div>

          {/* Auto-Match Suggestion */}
          <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
            <p className="text-xs font-semibold text-emerald-900 mb-1">
              ✨ Auto-Match Suggestion:
            </p>
            <p className="text-xs text-emerald-800">
              {generateAutoMatchSuggestion(line)}
            </p>
          </div>

          {/* What it likely is + guide */}
          <div className="bg-white rounded-lg p-3 border border-amber-100">
            <p className="text-xs font-semibold text-stone-700 mb-1">
              Likely: <span className="text-amber-700">{inferredCategory}</span>
            </p>
            <p className="text-xs text-stone-600 leading-relaxed">
              {CATEGORY_HELP[inferredCategory]}
            </p>
            <p className="text-xs text-stone-500 mt-2 italic">
              💡 {RESOLUTION_GUIDE[inferredCategory]}
            </p>
          </div>

          {/* Manual Actions */}
          <div className="space-y-2 pt-2 border-t border-amber-200">
            {!resolutionMode ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResolutionMode('manual')}
                  disabled={isLoading}
                  className="text-xs bg-emerald-50 border-emerald-300 hover:bg-emerald-100"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Match
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResolutionMode('categorize')}
                  disabled={isLoading}
                  className="text-xs"
                >
                  <Badge className="w-3 h-3 mr-1" />
                  Categorize
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResolutionMode('exclude')}
                  disabled={isLoading}
                  className="text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Ignore
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded p-3 border border-amber-300 space-y-2">
                <p className="text-xs font-semibold text-stone-700 capitalize">
                  {resolutionMode === 'exclude' ? 'Ignore this transaction' : resolutionMode === 'categorize' ? 'Categorize this line' : 'Link to matching transaction'}
                </p>

                {(resolutionMode === 'manual') && (
                  <input
                    type="text"
                    placeholder="Enter order ID, fee ID, or description..."
                    className="w-full px-2 py-1 text-xs border border-stone-300 rounded"
                    onChange={(e) => setNotes(e.target.value)}
                    value={notes}
                  />
                )}

                {(resolutionMode === 'categorize') && (
                  <select
                    className="w-full px-2 py-1 text-xs border border-stone-300 rounded"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  >
                    <option value="">Select category...</option>
                    <option value="sale">Sale</option>
                    <option value="refund">Refund</option>
                    <option value="fee">Fee</option>
                    <option value="deposit">Deposit</option>
                    <option value="tax">Tax</option>
                    <option value="shipping">Shipping</option>
                  </select>
                )}

                <textarea
                  placeholder={resolutionMode === 'exclude' ? 'Why ignore this?' : 'Notes about this resolution...'}
                  className="w-full px-2 py-1 text-xs border border-stone-300 rounded h-12"
                  value={resolutionMode === 'categorize' ? '' : notes}
                  onChange={(e) => !['categorize'].includes(resolutionMode) && setNotes(e.target.value)}
                />

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="text-xs bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleResolve(resolutionMode)}
                    disabled={isLoading || (resolutionMode === 'categorize' && !notes)}
                  >
                    {isLoading ? 'Saving...' : 'Confirm'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setResolutionMode(null);
                      setNotes('');
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}