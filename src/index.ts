import { BinanceWebSocketService } from './services/BinanceWebSocketService';
import type { Kline } from './types/kline';

console.log('Starting the Binance WebSocket client...');

// 1. Create an instance of the WebSocket service.
// This will automatically try to connect.
const binanceService = new BinanceWebSocketService();

// 2. Subscribe to the 'kline:closed' event.
binanceService.on('kline:closed', (kline: Kline) => {
  // 3. When a kline is closed, log the received object to the console.
  console.log('Kline closed:', kline);
});

console.log('Listening for closed klines from Binance...');

// Optional: Handle graceful shutdown to close the WebSocket connection.
process.on('SIGINT', () => {
  console.log('\nGracefully shutting down...');
  binanceService.close();
  process.exit(0);
});
