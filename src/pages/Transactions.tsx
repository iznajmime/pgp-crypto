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

interface Transaction {
  id: string;
  created_at: string;
  transaction_type: TransactionType;
  asset: string | null;
  transaction_value_usd: number;
  asset_quantity: number | null;
  price_per_asset_usd: number | null;
  profiles: { name: string } | null;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('transactions')
      .select('*, profiles(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to fetch transactions. Please try again.');
    } else {
      setTransactions(data as Transaction[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

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

  const getBadgeVariant = (type: TransactionType) => {
    switch (type) {
      case 'DEPOSIT':
        return 'default';
      case 'WITHDRAW':
        return 'secondary';
      case 'BUY':
        return 'outline';
      case 'SELL':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">
          A log of all capital movements and asset trades.
        </p>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Price per Asset</TableHead>
              <TableHead className="text-right">Total Value (USD)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  Loading transactions...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center h-24 text-destructive"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : transactions.length > 0 ? (
              transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-medium">
                    {tx.profiles?.name ?? 'N/A'}
                  </TableCell>
                  <TableCell>{formatDate(tx.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(tx.transaction_type)}>
                      {tx.transaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{tx.asset ?? 'USD'}</TableCell>
                  <TableCell className="text-right">
                    {tx.asset_quantity?.toLocaleString() ?? 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(tx.price_per_asset_usd)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(tx.transaction_value_usd)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
