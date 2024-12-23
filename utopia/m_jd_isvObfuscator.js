const {Env, redis,fs} = require('./utopia');
const $ = new Env('M无线isvToken获取')
$.version = "v1.0.0"
$.maxCookie = 99999
$.concNum = 1
$.cookieTypes=['ql']
let tokenCacheMin = $.getEnv("M_WX_TOKEN_CACHE_MIN"), tokenCacheMax = $.getEnv("M_WX_TOKEN_CACHE_MAX")
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const proxyUrl = new URL($.getEnv("M_WX_PROXY_POOL_URL"));
$.log(proxyUrl)

// 创建自定义 HTTPS 代理代理实例
const httpsAgent = new HttpsProxyAgent({
    host: proxyUrl.hostname,
    port: proxyUrl.port,
    protocol: proxyUrl.protocol,
});

// 发起请求
const axiosInstance = axios.create({
    httpsAgent,
    proxy: false, // 禁用默认代理配置
});

class Task extends Env {
    constructor() {
        super();
    }

    async getIsvToken(cookie = this.cookie, ptpin = this.ptpin, retries = 2) {
        const key = `isvObfuscator:${ptpin}`;
        let value = await this.rget(key);
        if (value) {
            this.log("redis缓存有isvToken")
            this.isvToken = value;
            return value
        }
        if (fs.existsSync("tokens") && fs.existsSync(`tokens/${decodeURIComponent(ptpin)}.json`)) {
            this.log("本地缓存有isvToken")
            let tk = JSON.parse(fs.readFileSync(`tokens/${decodeURIComponent(ptpin)}.json`));
            if (tk && tk.token && tk?.expireTime > this.timestamp()) {
                this.isvToken = tk.token
                return tk.token;
            }
        }
        this.log("实时获取isvToken")
        const {sign: body} = await this.sign('isvObfuscator', {'id': '', 'url': `https://cjhy-isv.isvjcloud.com`});

        let {data} = await axiosInstance.post(`https://api.m.jd.com/client.action?functionId=isvObfuscator`, body, {
            headers: {
                "Host": "api.m.jd.com", "Cookie": cookie, "User-Agent": "JD4iPhone/168069 (iPhone; iOS 13.7; Scale/3.00)",
            }
        })

        this.log(JSON.stringify(data))
        const {token, message, code, errcode} = data
        if (/(参数异常)/.test(message)) {
            this.log("CK已失效")
            return
        }
        if (token) {
            await this.rcache(key, token, this.random(tokenCacheMin, tokenCacheMax) * 60 * 1000)
            this.log("存redis一份isvToken")
            if (fs.existsSync("tokens")) {
                const tk = {
                    expireTime: this.timestamp() + this.random(tokenCacheMin, tokenCacheMax) * 60 * 1000, token: token
                }
                fs.writeFileSync(`tokens/${decodeURIComponent(ptpin)}.json`, JSON.stringify(tk))
                this.log("存本地一份isvToken")
            }
        }
        return token;
    }

    async exec() {
       let token =  await this.getIsvToken()
    }
}

$.start(Task)