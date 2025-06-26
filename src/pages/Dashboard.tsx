import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchCryptoPrices } from "@/lib/cryptoApi";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { PieChart } from "@mui/x-charts/PieChart";
import { cn } from "@/lib/utils";

interface PortfolioMetrics {
  totalValue: number;
  pnlUsd: number;
  pnlPercent: number;
}

interface OpenPosition {
  asset: string;
  quantityHeld: number;
  pnl: number;
  marketValue: number;
  pnlPercent: number;
  sevenDayChange: number;
}

interface ClientOwnership {
  name: string;
  ownershipPercentage: number;
  equityValue: number;
  pnl: number;
}

// A simplified transaction type for our logic
type Transaction = {
  transaction_type: "DEPOSIT" | "WITHDRAWAL" | "BUY" | "SELL";
  transaction_value_usd: number;
  asset?: string | null;
  asset_quantity?: number | null;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatQuantity = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
};

const SkeletonCard = ({ title, lines = 2 }: { title: string, lines?: number }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="mb-3">
          <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse dark:bg-gray-700 mb-2"></div>
          <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse dark:bg-gray-700"></div>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default function Dashboard() {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [clientOwnership, setClientOwnership] = useState<ClientOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calculateMetrics = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: transactions, error: txError } = await supabase
          .from("transactions")
          .select("transaction_type, transaction_value_usd, asset, asset_quantity");

        if (txError) throw txError;
        if (!transactions) throw new Error("No transactions found.");

        // --- Aggregation for Calculations ---
        const assetAggregates: Record<string, {
          totalBuyQuantity: number;
          totalSellQuantity: number;
          totalBuyValue: number;
        }> = {};
        const assetPortfolios: Record<string, { quantity: number; totalCost: number }> = {};
        let cashBalance = 0;
        const uniqueAssetIds = new Set<string>();

        for (const tx of transactions as Transaction[]) {
          const { transaction_type, asset, asset_quantity, transaction_value_usd } = tx;

          switch (transaction_type) {
            case "DEPOSIT": cashBalance += transaction_value_usd; break;
            case "WITHDRAWAL": cashBalance -= transaction_value_usd; break;
            case "BUY": cashBalance -= transaction_value_usd; break;
            case "SELL": cashBalance += transaction_value_usd; break;
          }

          if (asset && asset_quantity && asset_quantity > 0) {
            uniqueAssetIds.add(asset);
            if (!assetPortfolios[asset]) assetPortfolios[asset] = { quantity: 0, totalCost: 0 };
            if (transaction_type === "BUY") {
              assetPortfolios[asset].quantity += asset_quantity;
              assetPortfolios[asset].totalCost += transaction_value_usd;
            } else if (transaction_type === "SELL") {
              const portfolio = assetPortfolios[asset];
              if (portfolio && portfolio.quantity > 0) {
                const avgCost = portfolio.totalCost / portfolio.quantity;
                portfolio.totalCost -= asset_quantity * avgCost;
                portfolio.quantity -= asset_quantity;
              }
            }

            if (!assetAggregates[asset]) assetAggregates[asset] = { totalBuyQuantity: 0, totalSellQuantity: 0, totalBuyValue: 0 };
            if (transaction_type === "BUY") {
              assetAggregates[asset].totalBuyQuantity += asset_quantity;
              assetAggregates[asset].totalBuyValue += transaction_value_usd;
            } else if (transaction_type === "SELL") {
              assetAggregates[asset].totalSellQuantity += asset_quantity;
            }
          }
        }

        const assetIdsToFetch = Array.from(uniqueAssetIds);
        const prices = await fetchCryptoPrices(assetIdsToFetch);

        let currentMarketValue = 0;
        for (const assetId of assetIdsToFetch) {
          const quantity = assetPortfolios[assetId]?.quantity || 0;
          const price = prices[assetId]?.usd || 0;
          currentMarketValue += quantity * price;
        }
        const totalPortfolioValue = currentMarketValue + cashBalance;
        const totalCostBasis = Object.values(assetPortfolios).reduce((acc, p) => acc + p.totalCost, 0);
        const pnlUsd = currentMarketValue - totalCostBasis;
        const pnlPercent = totalCostBasis > 0 ? (pnlUsd / totalCostBasis) * 100 : 0;
        setMetrics({ totalValue: totalPortfolioValue, pnlUsd, pnlPercent });

        const positions: OpenPosition[] = [];
        for (const asset in assetAggregates) {
          const data = assetAggregates[asset];
          const quantityHeld = data.totalBuyQuantity - data.totalSellQuantity;

          if (quantityHeld > 1e-9) {
            const avgBuyPrice = data.totalBuyQuantity > 0 ? data.totalBuyValue / data.totalBuyQuantity : 0;
            const costBasis = quantityHeld * avgBuyPrice;
            const livePrice = prices[asset]?.usd || 0;
            const sevenDayChange = prices[asset]?.usd_7d_change || 0;
            const marketValue = quantityHeld * livePrice;
            const pnl = marketValue - costBasis;
            const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
            
            positions.push({ asset, quantityHeld, pnl, marketValue, pnlPercent, sevenDayChange });
          }
        }
        setOpenPositions(positions.sort((a, b) => b.marketValue - a.marketValue));

        // --- Client Ownership Calculation ---
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("name, total_deposited_usd");

        if (profilesError) throw profilesError;
        if (!profiles) throw new Error("No client profiles found.");

        const totalCapitalInvested = profiles.reduce(
          (acc, p) => acc + (p.total_deposited_usd || 0),
          0
        );

        if (totalCapitalInvested > 0) {
          const ownershipData = profiles
            .map((profile) => {
              const name = profile.name || "Unnamed Client";
              const deposited = profile.total_deposited_usd || 0;

              const ownershipPercentage = (deposited / totalCapitalInvested) * 100;
              const equityValue = totalPortfolioValue * (ownershipPercentage / 100);
              const pnl = equityValue - deposited;

              return { name, ownershipPercentage, equityValue, pnl };
            })
            .sort((a, b) => b.equityValue - a.equityValue);

          setClientOwnership(ownershipData);
        }

      } catch (err) {
        console.error("Error calculating dashboard metrics:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
      } finally {
        setLoading(false);
      }
    };

    calculateMetrics();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-6">Dashboard</h1>
        <div className="grid gap-6 md:grid-cols-2">
          <SkeletonCard title="Total Portfolio Value" lines={1} />
          <SkeletonCard title="Unrealized P&L (Overall)" lines={2} />
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <SkeletonCard title="Current Holdings" lines={3} />
          <SkeletonCard title="Asset Performance" lines={3} />
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <SkeletonCard title="Client Ownership" lines={4} />
          <SkeletonCard title="Asset Allocation" lines={4} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-6">Dashboard</h1>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to Load Dashboard</AlertTitle>
          <AlertDescription>
            Could not calculate portfolio metrics. Please ensure the database is reachable and transactions are correctly formatted.
            <br />
            <code className="text-xs mt-2 block bg-red-900/20 p-2 rounded">{error}</code>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!metrics) return null;

  const isPnlPositive = metrics.pnlUsd >= 0;

  const pieChartData = openPositions.map((pos) => ({
    id: pos.asset,
    value: pos.marketValue,
    label: pos.asset,
  }));

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-6">Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Portfolio Value</CardTitle>
            <CardDescription>
              Current value of all crypto and cash holdings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold tracking-tighter">
              {formatCurrency(metrics.totalValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Unrealized P&L (Overall)</CardTitle>
            <CardDescription>
              Total profit or loss on open crypto positions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold tracking-tighter">
              {formatCurrency(metrics.pnlUsd)}
            </p>
            <div
              className={cn(
                "flex items-center text-sm font-medium mt-1",
                isPnlPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {isPnlPositive ? (
                <ArrowUpRight className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 mr-1" />
              )}
              {metrics.pnlPercent.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Holdings</CardTitle>
            <CardDescription>
              Summary of all crypto assets currently held.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Market Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openPositions.length > 0 ? (
                  openPositions.map((pos) => (
                    <TableRow key={pos.asset}>
                      <TableCell className="font-medium">{pos.asset}</TableCell>
                      <TableCell className="text-right">{formatQuantity(pos.quantityHeld)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(pos.marketValue)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No open positions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Asset Performance</CardTitle>
            <CardDescription>
              Unrealized P&L and 7-day performance for each holding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                  <TableHead className="text-right">P&L %</TableHead>
                  <TableHead className="text-right">7d Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openPositions.length > 0 ? (
                  openPositions.map((pos) => (
                    <TableRow key={pos.asset}>
                      <TableCell className="font-medium">{pos.asset}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold",
                          pos.pnl >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold",
                          pos.pnl >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {typeof pos.pnlPercent === 'number'
                          ? `${pos.pnl >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%`
                          : 'N/A'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold",
                          pos.sevenDayChange >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {pos.sevenDayChange >= 0 ? '+' : ''}{pos.sevenDayChange.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No open positions to analyze.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client Ownership</CardTitle>
            <CardDescription>
              Breakdown of each client's equity and performance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead className="text-right">Ownership</TableHead>
                  <TableHead className="text-right">Equity Value</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientOwnership.length > 0 ? (
                  clientOwnership.map((client) => (
                    <TableRow key={client.name}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="text-right">{client.ownershipPercentage.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{formatCurrency(client.equityValue)}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold",
                          client.pnl >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {client.pnl >= 0 ? '+' : ''}{formatCurrency(client.pnl)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No client data available to calculate ownership.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
            <CardDescription>
              Distribution of crypto assets by market value.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <PieChart
                colors={['#03045E', '#023E8A', '#0077B6', '#0096C7', '#00B4D8', '#48CAE4', '#90E0EF', '#ADE8F4']}
                series={[
                  {
                    data: pieChartData,
                    highlightScope: { faded: 'global', highlighted: 'item' },
                    faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
                    innerRadius: 40,
                    outerRadius: 96,
                    paddingAngle: 5,
                    cornerRadius: 5,
                    startAngle: -90,
                    endAngle: 270,
                  },
                ]}
                slotProps={{
                  legend: {
                    direction: 'row',
                    position: { vertical: 'bottom', horizontal: 'middle' },
                    padding: 0,
                  },
                }}
                height={300}
              />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No assets to display in chart.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
