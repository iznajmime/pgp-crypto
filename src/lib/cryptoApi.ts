// src/lib/cryptoApi.ts

/**
 * This module implements a fault-tolerant protocol for fetching cryptocurrency price data.
 * It queries a chain of APIs in a specific order, falling back to the next provider
 * only if the previous one fails or returns invalid data (a price of 0 or null).
 *
 * The fallback chain is:
 * 1. CoinGecko (Primary)
 * 2. CoinMarketCap (First Backup)
 * 3. CryptoCompare (Second Backup)
 * 4. Kaiko (Final Backup)
 *
 * If all providers fail for a given asset, its price is set to 0.
 */

// --- TYPE DEFINITIONS ---

type PriceData = {
  usd: number;
  usd_7d_change: number;
};

type PriceResult = Record<string, PriceData>;

// --- API KEYS & CONFIG ---

const COINMARKETCAP_API_KEY = import.meta.env.VITE_COINMARKETCAP_API_KEY;
const KAIKO_API_KEY = import.meta.env.VITE_KAIKO_API_KEY;

// --- PROVIDER 1: COINGECKO ---

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
}
let coinGeckoListCache: CoinGeckoCoin[] | null = null;

const getCoinGeckoList = async (): Promise<CoinGeckoCoin[]> => {
  if (coinGeckoListCache) return coinGeckoListCache;
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/coins/list');
    if (!response.ok) throw new Error(`CoinGecko list fetch failed: ${response.status}`);
    const data: CoinGeckoCoin[] = await response.json();
    coinGeckoListCache = data;
    return data;
  } catch (error) {
    console.error("Failed to fetch CoinGecko coin list:", error);
    return [];
  }
};

const tryCoinGecko = async (symbols: string[]): Promise<PriceResult> => {
  console.log("Attempting to fetch prices from CoinGecko for:", symbols);
  const prices: PriceResult = {};
  if (symbols.length === 0) return prices;

  try {
    const coinList = await getCoinGeckoList();
    const idToSymbolMap: Record<string, string> = {};
    const coingeckoIds = symbols.map(symbol => {
      const coin = coinList.find(c => c.symbol === symbol.toLowerCase());
      if (coin) {
        idToSymbolMap[coin.id] = symbol;
        return coin.id;
      }
      return null;
    }).filter((id): id is string => id !== null);

    if (coingeckoIds.length === 0) return prices;

    const idsParam = coingeckoIds.join(',');
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsParam}&price_change_percentage=7d`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`CoinGecko markets fetch failed: ${response.status}`);
    
    const marketData: {
      id: string;
      current_price: number;
      price_change_percentage_7d_in_currency?: number;
    }[] = await response.json();

    for (const coin of marketData) {
      const symbol = idToSymbolMap[coin.id];
      if (symbol && coin.current_price > 0) {
        prices[symbol] = {
          usd: coin.current_price,
          usd_7d_change: coin.price_change_percentage_7d_in_currency || 0,
        };
      }
    }
  } catch (error) {
    console.error("CoinGecko Error:", error);
  }
  console.log("CoinGecko found prices for:", Object.keys(prices));
  return prices;
};

// --- PROVIDER 2: COINMARKETCAP ---

const tryCoinMarketCap = async (symbols: string[]): Promise<PriceResult> => {
  console.log("Attempting to fetch prices from CoinMarketCap for:", symbols);
  const prices: PriceResult = {};
  if (symbols.length === 0) return prices;
  if (!COINMARKETCAP_API_KEY) {
    console.warn("CoinMarketCap API key is missing. Skipping this provider.");
    return prices;
  }

  try {
    const symbolsParam = symbols.join(',').toUpperCase();
    const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${symbolsParam}&convert=USD`;
    const response = await fetch(url, {
      headers: { 'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY },
    });

    if (!response.ok) throw new Error(`CoinMarketCap fetch failed: ${response.status}`);
    const data = await response.json();

    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      const coinData = data.data?.[upperSymbol]?.[0];
      const price = coinData?.quote?.USD?.price;
      if (price > 0) {
        prices[symbol] = {
          usd: price,
          usd_7d_change: coinData?.quote?.USD?.percent_change_7d || 0,
        };
      }
    }
  } catch (error) {
    console.error("CoinMarketCap Error:", error);
  }
  console.log("CoinMarketCap found prices for:", Object.keys(prices));
  return prices;
};

// --- PROVIDER 3: CRYPTOCOMPARE ---

const tryCryptoCompare = async (symbols: string[]): Promise<PriceResult> => {
  console.log("Attempting to fetch prices from CryptoCompare for:", symbols);
  const prices: PriceResult = {};
  if (symbols.length === 0) return prices;

  try {
    const symbolsParam = symbols.join(',').toUpperCase();
    const url = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${symbolsParam}&tsyms=USD`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`CryptoCompare fetch failed: ${response.status}`);
    const data = await response.json();

    if (data.RAW) {
      for (const symbol of symbols) {
        const upperSymbol = symbol.toUpperCase();
        const coinData = data.RAW[upperSymbol]?.USD;
        const price = coinData?.PRICE;
        if (price > 0) {
          prices[symbol] = {
            usd: price,
            // CryptoCompare's pricemultifull does not provide a direct 7d change.
            usd_7d_change: 0,
          };
        }
      }
    }
  } catch (error) {
    console.error("CryptoCompare Error:", error);
  }
  console.log("CryptoCompare found prices for:", Object.keys(prices));
  return prices;
};

// --- PROVIDER 4: KAIKO ---

const tryKaiko = async (symbols: string[]): Promise<PriceResult> => {
  console.log("Attempting to fetch prices from Kaiko for:", symbols);
  const prices: PriceResult = {};
  if (symbols.length === 0) return prices;
  if (!KAIKO_API_KEY) {
    console.warn("Kaiko API key is missing. Skipping this provider.");
    return prices;
  }

  try {
    // Kaiko's direct exchange rate API is one asset at a time.
    for (const symbol of symbols) {
      const url = `https://us.market-api.kaiko.io/v2/data/trades.v1/spot_direct_exchange_rate/${symbol.toLowerCase()}/usd`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${KAIKO_API_KEY}` },
      });

      if (response.ok) {
        const data = await response.json();
        const price = parseFloat(data?.data?.[0]?.price);
        if (price > 0) {
          prices[symbol] = {
            usd: price,
            // Kaiko's spot rate endpoint does not provide 7d change.
            usd_7d_change: 0,
          };
        }
      }
    }
  } catch (error) {
    console.error("Kaiko Error:", error);
  }
  console.log("Kaiko found prices for:", Object.keys(prices));
  return prices;
};

// --- MAIN ORCHESTRATOR FUNCTION ---

/**
 * Fetches cryptocurrency prices using a fault-tolerant fallback chain.
 * @param assetSymbols An array of asset symbols (e.g., ['BTC', 'ETH', 'SUI']).
 * @returns A promise that resolves to a record mapping symbols to their price data.
 */
export const fetchCryptoPrices = async (assetSymbols: string[]): Promise<PriceResult> => {
  const finalPrices: PriceResult = {};
  let remainingSymbols = [...new Set(assetSymbols)]; // Ensure unique symbols

  // Provider 1: CoinGecko
  const geckoPrices = await tryCoinGecko(remainingSymbols);
  Object.assign(finalPrices, geckoPrices);
  remainingSymbols = remainingSymbols.filter(s => !finalPrices[s]);

  // Provider 2: CoinMarketCap
  if (remainingSymbols.length > 0) {
    const cmcPrices = await tryCoinMarketCap(remainingSymbols);
    Object.assign(finalPrices, cmcPrices);
    remainingSymbols = remainingSymbols.filter(s => !finalPrices[s]);
  }

  // Provider 3: CryptoCompare
  if (remainingSymbols.length > 0) {
    const ccPrices = await tryCryptoCompare(remainingSymbols);
    Object.assign(finalPrices, ccPrices);
    remainingSymbols = remainingSymbols.filter(s => !finalPrices[s]);
  }

  // Provider 4: Kaiko
  if (remainingSymbols.length > 0) {
    const kaikoPrices = await tryKaiko(remainingSymbols);
    Object.assign(finalPrices, kaikoPrices);
    remainingSymbols = remainingSymbols.filter(s => !finalPrices[s]);
  }

  // Handle any symbols for which all providers failed
  if (remainingSymbols.length > 0) {
    console.error("Total System Failure: Could not fetch price for the following symbols from any provider:", remainingSymbols);
    for (const symbol of remainingSymbols) {
      finalPrices[symbol] = { usd: 0, usd_7d_change: 0 };
    }
  }

  console.log("Final prices fetched:", finalPrices);
  return finalPrices;
};
