import { chromium } from 'playwright';

class CloudflareCookieProvider {
  constructor(config) {
    this.enabled = config.cloudflare.enabled;
    this.portalUrl = config.cloudflare.portalUrl;
    this.cookieTtlMs = config.cloudflare.cookieTtlMs;
    this.waitAfterLoadMs = config.cloudflare.waitAfterLoadMs;
    this.timeoutMs = config.cloudflare.timeoutMs;
    this.launchArgs = config.cloudflare.launchArgs;
    this.userAgent = config.musicSource.userAgent;
    this.apiUrl = config.musicSource.apiBase;
    this.apiOrigin = (() => {
      try {
        return new URL(config.musicSource.apiBase).origin;
      } catch (error) {
        return null;
      }
    })();
    this.cached = null;
    this.refreshPromise = null;
  }

  isCacheValid() {
    if (!this.cached) return false;
    return this.cached.expiresAt > Date.now();
  }

  async getCookieHeader() {
    if (!this.enabled) {
      return '';
    }
    if (this.isCacheValid()) {
      return this.cached.header;
    }
    if (!this.refreshPromise) {
      this.refreshPromise = this.fetchCookies().finally(() => {
        this.refreshPromise = null;
      });
    }
    await this.refreshPromise;
    return this.cached?.header || '';
  }

  async fetchCookies() {
    let browser;
    let context;
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', ...this.launchArgs]
      });
      context = await browser.newContext({
        userAgent: this.userAgent
      });
      const page = await context.newPage();
      await page.goto(this.portalUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeoutMs
      });
      if (this.waitAfterLoadMs > 0) {
        await page.waitForTimeout(this.waitAfterLoadMs);
      }
      if (this.apiOrigin) {
        try {
          await page.goto(this.apiOrigin, {
            waitUntil: 'domcontentloaded',
            timeout: this.timeoutMs
          });
        } catch (error) {
          console.warn('API warmup visit failed:', error.message);
        }
      }
      const cookies = await context.cookies();
      const header = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
      if (!header) {
        throw new Error('Failed to obtain Cloudflare cookies');
      }
      console.info(
        `Cloudflare cookies refreshed (${cookies.length} entries): ${cookies
          .map((cookie) => `${cookie.name}@${cookie.domain}`)
          .join(', ')}`
      );
      this.cached = {
        header,
        expiresAt: Date.now() + this.cookieTtlMs
      };
    } catch (error) {
      console.error('Failed to refresh Cloudflare cookies:', error.message);
      this.cached = null;
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

}

export default CloudflareCookieProvider;
