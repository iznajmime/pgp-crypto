import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NewTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewTradeDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewTradeDialogProps) {
  const { toast } = useToast();
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [asset, setAsset] = useState('');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset || !amount || !price) {
      toast({
        title: 'Error',
        description: 'Please fill out all fields.',
        variant: 'destructive',
      });
      return;
    }

    const amountUSD = parseFloat(amount);
    const pricePerAsset = parseFloat(price);

    if (
      isNaN(amountUSD) ||
      isNaN(pricePerAsset) ||
      amountUSD <= 0 ||
      pricePerAsset <= 0
    ) {
      toast({
        title: 'Error',
        description: 'Please enter valid numbers for amount and price.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    const assetQuantity = amountUSD / pricePerAsset;

    const { error } = await supabase.from('transactions').insert({
      transaction_type: tradeType,
      asset: asset.toUpperCase(),
      asset_quantity: assetQuantity,
      price_per_asset_usd: pricePerAsset,
      transaction_value_usd: amountUSD,
      profile_id: null,
    });

    setIsSubmitting(false);

    if (error) {
      console.error('Error saving trade:', error);
      toast({
        title: 'Error saving trade',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success!',
        description: 'Your trade has been logged successfully.',
      });
      onSuccess();
      onOpenChange(false);
      // Reset form
      setAsset('');
      setAmount('');
      setPrice('');
      setTradeType('BUY');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Trade</DialogTitle>
          <DialogDescription>
            Log a new asset trade. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="trade-type" className="text-right">
                Type
              </Label>
              <Select
                value={tradeType}
                onValueChange={(value: 'BUY' | 'SELL') => setTradeType(value)}
              >
                <SelectTrigger id="trade-type" className="col-span-3">
                  <SelectValue placeholder="Select trade type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">Long</SelectItem>
                  <SelectItem value="SELL">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="asset" className="text-right">
                Asset
              </Label>
              <Input
                id="asset"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="col-span-3"
                placeholder="e.g. BTC, ETH"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount (USD)
              </Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="col-span-3"
                placeholder="e.g. 1000.00"
                required
                step="any"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                Price per Asset
              </Label>
              <Input
                id="price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="col-span-3"
                placeholder="e.g. 65000.00"
                required
                step="any"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Trade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
