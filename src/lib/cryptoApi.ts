// This map is crucial for translating database symbols to API IDs.
const symbolToIdMap: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'USDT': 'tether',
  'XRP': 'ripple',
  'DOGE': 'dogecoin',
  'ADA': 'cardano',
  // This can be expanded as more assets are supported.
};

/**
 * Fetches cryptocurrency market data from the CoinGecko API.
 * It accepts database asset symbols (e.g., 'BTC') and maps them to CoinGecko IDs.
 * @param assetSymbols - An array of asset symbols from the database (e.g., ['BTC', 'ETH']).
 * @returns A promise that resolves to an object mapping the original asset symbols to their market data.
 */
export const fetchCryptoPrices = async (assetSymbols: string[]): Promise<Record<string, { usd: number; usd_7d_change: number }>> => {
  if (!assetSymbols || assetSymbols.length === 0) {
    return {};
  }

  // Create a reverse map to convert API response keys (IDs) back to symbols.
  const idToSymbolMap: Record<string, string> = {};
  const coingeckoIds = assetSymbols
    .map(symbol => {
      // Use uppercase for robust matching against our map
      const id = symbolToIdMap[symbol.toUpperCase()];
      if (id) {
        idToSymbolMap[id] = symbol; // Map the ID back to the original symbol
        return id;
      } else {
        console.warn(`Could not find CoinGecko ID for symbol: ${symbol}. This asset will be skipped.`);
        return null;
      }
    })
    .filter((id): id is string => id !== null);

  if (coingeckoIds.length === 0) {
    return {};
  }

  const idsParam = coingeckoIds.join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd&include_7day_change=true`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`CoinGecko API request failed with status ${response.status}`);
    }
    const data: Record<string, { usd: number; usd_7d_change: number }> = await response.json();

    // Map the results back from CoinGecko IDs to the original asset symbols.
    const result: Record<string, { usd: number; usd_7d_change: number }> = {};
    for (const id in data) {
      const symbol = idToSymbolMap[id];
      if (symbol) {
        result[symbol] = data[id];
      }
    }

    // Log if any requested and mapped assets were not returned by the API
    coingeckoIds.forEach(id => {
      if (!data[id]) {
        console.log(`CoinGecko API did not return a price for ${idToSymbolMap[id]} (ID: ${id}).`);
      }
    });

    return result;
  } catch (error) {
    console.error("Error fetching crypto prices:", error);
    throw error;
  }
};
