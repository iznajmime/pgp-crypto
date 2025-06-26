import { supabase } from '@/lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type TransactionType = 'DEPOSIT' | 'WITHDRAW' | 'BUY' | 'SELL';

interface TradeTransaction {
  id: string;
  created_at: string;
  transaction_type: 'BUY' | 'SELL';
  asset: string;
  transaction_value_usd: number;
  asset_quantity: number;
  price_per_asset_usd: number;
}

export default function Trades() {
  const [trades, setTrades] = useState<TradeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .in('transaction_type', ['BUY', 'SELL'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching trades:', error);
      setError('Failed to fetch trades. Please try again.');
    } else {
      setTrades(data as TradeTransaction[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const formatCurrency = (amount: number | null) => {
    if (amount === null || typeof amount === 'undefined') return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPositionBadgeVariant = (type: 'BUY' | 'SELL') => {
    switch (type) {
      case 'BUY':
        return 'default';
      case 'SELL':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Trades</h1>
        <p className="text-muted-foreground">
          A log of all buy and sell asset trades.
        </p>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Position</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Price per Asset</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  Loading trades...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center h-24 text-destructive"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : trades.length > 0 ? (
              trades.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell className="font-medium">{trade.asset}</TableCell>
                  <TableCell>
                    <Badge variant={getPositionBadgeVariant(trade.transaction_type)}>
                      {trade.transaction_type === 'BUY' ? 'LONG' : 'SHORT'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {trade.asset_quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(trade.price_per_asset_usd)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(trade.transaction_value_usd)}
                  </TableCell>
                  <TableCell>{formatDate(trade.created_at)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  No trades found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
