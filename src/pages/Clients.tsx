import { supabase } from '@/lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Profile {
  id: string;
  name: string;
  total_deposited_usd: number;
}

const addClientSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  phoneNumber: z.string().optional(),
  initial_deposit: z.coerce
    .number()
    .positive({ message: 'Initial deposit must be a positive number.' }),
});

const manageFundsSchema = z.object({
  type: z.enum(['DEPOSIT', 'WITHDRAW']),
  amount: z.coerce
    .number()
    .positive({ message: 'Amount must be a positive number.' }),
});

export default function Clients() {
  const [clients, setClients] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddClientOpen, setAddClientOpen] = useState(false);
  const [isManageFundsOpen, setManageFundsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Profile | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, total_deposited_usd')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching clients:', error);
      setError('Failed to fetch clients. Please try again.');
    } else {
      setClients(data as Profile[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const addClientForm = useForm<z.infer<typeof addClientSchema>>({
    resolver: zodResolver(addClientSchema),
    defaultValues: {
      name: '',
      email: '',
      phoneNumber: '',
      initial_deposit: undefined,
    },
  });

  async function onAddClientSubmit(values: z.infer<typeof addClientSchema>) {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          name: values.name,
          email: values.email,
          phoneNumber: values.phoneNumber,
          total_deposited_usd: values.initial_deposit,
        })
        .select('id')
        .single();

      if (profileError) throw profileError;
      if (!profileData) throw new Error('Failed to create profile.');

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          profile_id: profileData.id,
          transaction_type: 'DEPOSIT',
          transaction_value_usd: values.initial_deposit,
          asset: 'USD',
        });

      if (transactionError) throw transactionError;

      addClientForm.reset();
      setAddClientOpen(false);
      await fetchClients();
    } catch (error) {
      console.error('Error adding new client:', error);
      addClientForm.setError('root', {
        message: 'Failed to add client. Please try again.',
      });
    }
  }

  const manageFundsForm = useForm<z.infer<typeof manageFundsSchema>>({
    resolver: zodResolver(manageFundsSchema),
    defaultValues: {
      type: 'DEPOSIT',
      amount: undefined,
    },
  });

  async function onManageFundsSubmit(
    values: z.infer<typeof manageFundsSchema>
  ) {
    if (!selectedClient) return;

    try {
      const currentDeposit = selectedClient.total_deposited_usd;
      const amount = values.amount;
      const newTotal =
        values.type === 'DEPOSIT'
          ? currentDeposit + amount
          : currentDeposit - amount;

      if (newTotal < 0) {
        manageFundsForm.setError('amount', {
          message: 'Withdrawal cannot exceed total deposited capital.',
        });
        return;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ total_deposited_usd: newTotal })
        .eq('id', selectedClient.id);

      if (profileError) throw profileError;

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          profile_id: selectedClient.id,
          transaction_type: values.type,
          transaction_value_usd: amount,
          asset: 'USD',
        });

      if (transactionError) throw transactionError;

      manageFundsForm.reset();
      setManageFundsOpen(false);
      setSelectedClient(null);
      await fetchClients();
    } catch (error) {
      console.error('Error managing funds:', error);
      manageFundsForm.setError('root', {
        message: 'Transaction failed. Please try again.',
      });
    }
  }

  const handleManageFundsClick = (client: Profile) => {
    setSelectedClient(client);
    manageFundsForm.reset();
    setManageFundsOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage client profiles and their capital.
          </p>
        </div>
        <Dialog open={isAddClientOpen} onOpenChange={setAddClientOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>
                Enter the client's details and their initial deposit.
              </DialogDescription>
            </DialogHeader>
            <Form {...addClientForm}>
              <form
                onSubmit={addClientForm.handleSubmit(onAddClientSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={addClientForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addClientForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="john.doe@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addClientForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 (555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addClientForm.control}
                  name="initial_deposit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Deposit (USD)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="50000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {addClientForm.formState.errors.root && (
                  <p className="text-sm font-medium text-destructive">
                    {addClientForm.formState.errors.root.message}
                  </p>
                )}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    disabled={addClientForm.formState.isSubmitting}
                  >
                    {addClientForm.formState.isSubmitting
                      ? 'Adding...'
                      : 'Add Client'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>Total Capital Deposited</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24">
                  Loading clients...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center h-24 text-destructive"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : clients.length > 0 ? (
              clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(client.total_deposited_usd)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManageFundsClick(client)}
                    >
                      Deposit / Withdraw
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24">
                  No clients found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={isManageFundsOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedClient(null);
          }
          setManageFundsOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manage Funds for {selectedClient?.name}</DialogTitle>
            <DialogDescription>
              Make a new deposit or withdraw capital.
            </DialogDescription>
          </DialogHeader>
          <Form {...manageFundsForm}>
            <form
              onSubmit={manageFundsForm.handleSubmit(onManageFundsSubmit)}
              className="space-y-4"
            >
              <FormField
                control={manageFundsForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a transaction type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DEPOSIT">Deposit</SelectItem>
                        <SelectItem value="WITHDRAW">Withdraw</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={manageFundsForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="10000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {manageFundsForm.formState.errors.root && (
                <p className="text-sm font-medium text-destructive">
                  {manageFundsForm.formState.errors.root.message}
                </p>
              )}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  disabled={manageFundsForm.formState.isSubmitting}
                >
                  {manageFundsForm.formState.isSubmitting
                    ? 'Processing...'
                    : 'Submit Transaction'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
