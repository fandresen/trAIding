export const config = {
  WEBSOCKET_URL: 'ss://ws-api.binance.com:443/ws-api/v3',
  SYMBOL: 'BTCUSDT',
  INTERVAL: '1m',
  RECONNECT_CONFIG: {
    initialDelay: 1000,
    maxDelay: 30000,
    factor: 2,
  },
};
