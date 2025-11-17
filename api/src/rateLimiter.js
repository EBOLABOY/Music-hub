const WINDOW_MS = 5 * 60 * 1000; // 5分钟
const MAX_REQUESTS = 60; // 窗口内最大请求数
const MIN_SLEEP_MS = 50;

class SlidingWindowLimiter {
  constructor(windowMs = WINDOW_MS, limit = MAX_REQUESTS) {
    this.windowMs = windowMs;
    this.limit = limit;
    this.timestamps = [];
  }

  _prune(now) {
    const cutoff = now - this.windowMs;
    while (this.timestamps.length && this.timestamps[0] < cutoff) {
      this.timestamps.shift();
    }
  }

  async consume() {
    while (true) {
      const now = Date.now();
      this._prune(now);
      if (this.timestamps.length < this.limit) {
        this.timestamps.push(now);
        return;
      }
      const waitMs = Math.max(this.windowMs - (now - this.timestamps[0]), MIN_SLEEP_MS);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

const rateLimiter = new SlidingWindowLimiter();

export default rateLimiter;
