/**
 * Binance Trading Skill
 * 
 * Provides cryptocurrency trading capabilities through Binance API.
 * Supports both testnet (paper trading) and live trading.
 */

const axios = require('axios');
const crypto = require('crypto');

class BinanceSkill {
  constructor() {
    this.name = 'binance';
    this.config = null;
  }

  /**
   * Initialize the skill with configuration
   * Called automatically after onboarding completes
   * 
   * @param {Object} config - Environment variables from skill.yaml
   * @returns {Object} { success: boolean, error?: string }
   */
  async init(config) {
    this.config = {
      apiKey: config.BINANCE_API_KEY,
      apiSecret: config.BINANCE_API_SECRET,
      testnet: config.BINANCE_TESTNET === 'true',
      baseUrl: config.BINANCE_TESTNET === 'true' 
        ? 'https://testnet.binance.vision' 
        : (config.BINANCE_BASE_URL || 'https://api.binance.com')
    };

    // Validate credentials work
    try {
      await this.getBalance('USDT');
      console.log(`[Binance] Connected successfully (${this.config.testnet ? 'testnet' : 'LIVE'})`);
      return { success: true };
    } catch (error) {
      console.error('[Binance] Connection failed:', error.message);
      return { 
        success: false, 
        error: 'Invalid API credentials. Please check your keys at https://www.binance.com/en/my/settings/api-management'
      };
    }
  }

  /**
   * Generate signature for authenticated requests
   * @private
   */
  _generateSignature(queryString) {
    return crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Get account balance
   * @param {string} asset - Asset symbol (e.g., 'BTC', 'USDT')
   * @returns {Object} Balance info
   */
  async getBalance(asset) {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = this._generateSignature(queryString);

    const response = await axios.get(
      `${this.config.baseUrl}/api/v3/account`,
      {
        headers: { 'X-MBX-APIKEY': this.config.apiKey },
        params: { timestamp, signature }
      }
    );

    if (asset) {
      const balance = response.data.balances.find(b => b.asset === asset);
      return balance || { asset, free: '0', locked: '0' };
    }

    return response.data.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
  }

  /**
   * Get current price ticker
   * @param {string} symbol - Trading pair (e.g., 'BTCUSDT')
   * @returns {Object} Price data
   */
  async getTicker(symbol) {
    const response = await axios.get(
      `${this.config.baseUrl}/api/v3/ticker/price`,
      { params: { symbol } }
    );
    return response.data;
  }

  /**
   * Health check - called periodically
   * @returns {Object} Health status
   */
  async health() {
    try {
      const start = Date.now();
      await this.getTicker('BTCUSDT');
      const latency = Date.now() - start;
      
      return { 
        status: 'healthy',
        latency,
        testnet: this.config.testnet
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message,
        testnet: this.config.testnet
      };
    }
  }
}

module.exports = BinanceSkill;
