import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const config = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    apiBase: 'https://music-api-us.gdstudio.xyz/api.php',
    timeEndpoint: 'https://www.ximalaya.com/revision/time'
};

const resolveProxyAgent = () => {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy;
    if (!proxyUrl) return null;
    return new HttpsProxyAgent(proxyUrl);
};

const agent = resolveProxyAgent();
const http = axios.create({
    headers: {
        'User-Agent': config.userAgent,
        Accept: '*/*',
        Referer: 'https://music.gdstudio.xyz/',
        'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8'
    },
    timeout: 10000, // 10s timeout as in original code
    proxy: false,
    httpsAgent: agent,
    httpAgent: agent
});

const fetchServerTime = async () => {
    console.log('Fetching server time...');
    const start = Date.now();
    try {
        const { data } = await http.get(config.timeEndpoint, { responseType: 'text' });
        console.log(`Server time fetched in ${Date.now() - start}ms: ${data}`);
        return parseInt(data, 10);
    } catch (e) {
        console.error(`Server time fetch failed in ${Date.now() - start}ms:`, e.message);
        return Date.now();
    }
};

const testApiRequest = async () => {
    const timestamp = await fetchServerTime();
    console.log('Testing API request...');
    const start = Date.now();
    try {
        // Minimal payload to trigger a response (even if error)
        const params = new URLSearchParams({
            types: 'search',
            count: '20',
            source: 'netease',
            pages: '1',
            name: 'Eminem',
            _: String(timestamp)
        });

        const { data } = await http.post(config.apiBase, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            responseType: 'text'
        });
        console.log(`API request succeeded in ${Date.now() - start}ms`);
        console.log('Response preview:', data.slice(0, 100));
    } catch (e) {
        console.error(`API request failed in ${Date.now() - start}ms:`, e.message);
        if (e.code === 'ECONNABORTED') {
            console.error('TIMEOUT CONFIRMED');
        }
    }
};

testApiRequest();
