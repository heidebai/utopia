// noinspection JSCheckFunctionSignatures
//v1.1.0
let mode = __dirname.includes("Work");
//@formatter:off
const fs = require("fs");
const axios = require('axios');
const https = require('https');
const {format, addDays,differenceInMinutes} = require("date-fns");
const path = require('path');
const machineId = require('node-machine-id')
const tunnel = require("tunnel");
const Redis = require("ioredis");
const util = require("util");
const CryptoJS = require("crypto-js");
const {jsToken} = require("./assets/jsToken");
const notify = require('./sendNotify');
const cheerio = require("cheerio");
const base64 = require("base-64");
// const {v} = require("./assets/v");
const jdCookieNode = require('./jdCookie.js');
let NodeRSA = require('node-rsa');
let cookiesArr = [];
Object.keys(jdCookieNode).forEach((item) => {
    cookiesArr.push(jdCookieNode[item])
});

let h5stVersions = {}

let basePath = process.env.M_CONF_BASE_PATH || `${__dirname}/../conf`;

const conf = JSON.parse(
    fs.readFileSync(basePath + `/utopia${mode ? '-work' :  basePath.includes("github")?'-win':""}.json`).toString())
function getValue(key, defaultValue = '') {
    return conf[key] || process.env[key] || defaultValue
}

const redis = new Redis(getValue("M_REDIS_URL"), {keyPrefix: 'magic:'})
let accountPath = basePath + `/account.json`

const $ = axios.create({timeout: getValue("M_TIMEOUT", 5000)})

$.defaults.headers['Accept'] = '*/*';$.defaults.headers['Connection'] = 'keep-alive';$.defaults.headers['Accept-Language'] = "zh-CN,zh-Hans;q=0.9";$.defaults.headers['Accept-Encoding'] = "gzip, deflate, br",$.defaults.headers.common['Cookie'] = machineId.machineIdSync()
const redisHotKey = `HOT_KEY:%s:%s`;

class CustomError extends Error {
    constructor(message) {
        super(message);
        this.name = "CustomError";
    }
}

const proxyUrl = new URL(getValue("M_WX_PROXY_POOL_URL"));
const proxyMode = getValue("M_WX_PROXY_POOL_MODE");
const proxyDomain = proxyUrl.hostname;
const proxyPort = proxyUrl.port;
const params = new URLSearchParams(proxyUrl.search)
const proxyAuthName = params.get('username');
const proxyAuthPwd = params.get('password');
const clientVersion = getValue("M_SIGN_CLIENT_VERSION", "12.4.4")
const users = new Map();
const cookies = [];
const taskQueue = []
let osver = ["16.1.2", "15.1.1", "14.5.1", "14.4", "14.3", "14.2", "14.1", "14.0.1", "13.2"],clients = {
    'jd': {
        'app': 'jdapp', 'appBuild': '169031', 'client': 'android', 'clientVersion': '10.4.0',
    }, 'lite': {
        'app': 'jdltapp', 'appBuild': '1247', 'client': 'ios', 'clientVersion': '12.2.2',
    },
}
let keywords = ['pps', 'utm_campaign', 'utm_term', 'utm_source', 'utm_medium', 'teamId', 'mpin', 'shareUuid', 'signUuid', 'inviterNick',
    'inviter', 'InviteUuid', 'inviterNickName', 'sharer', 'inviterImg', 'nickName', 'nick', 'friendUuid', 'helpUuid', 'shareuserid4minipg',
    'bizExtString', 'invitePin', 'pps', 'cookie', 'friendid', 'bizExtString', 'bizExtString', 'koikey', 'jd_env_info', 'inviter_id',
    'invitePin', 'portrait', 'sid', 'shareUserId', '_ts', 'tttparams', 'pps', 'pps', 'DEBUG', 'shareOpenId', 'jxsid', 'ad_od', 'un_area',
    'encryptOpenId', 'gx', 'gxd', 'accessToken']
let activityIdRegx = ["/(dz[a-zA-Z0-9]{28,32})", "pagec/(unionOpen\\w+)/index", "activityId=(\\w+)", "exchange_id=(\\w+)", "giftId=(\\w+)",
    "actId=(\\w+)", "tplId=(\\w+)", "token=(\\w+)", "active/(\\w+)/index", "code=(\\w+)", "a=(\\w+)", "id=(\\w+)"]

let urlPrefixes = {
    "/prod/cc/interactsaas": /interactsaas/,
    "/crm-proya/apps/interact": /crm-proya/,
    "/apps/interact": /lorealjdcampaign-rc.isvjcloud.com/,
    "prod/cc/cjwx": /lorealjdcampaign-rc.isvjcloud.com\/prod\/cc\/cjwx/,
    "/prod/cc/interaction/v1": /interaction\/v1/,
    "/prod/cc/interaction/v2": /interaction\/v2/,
};
let notInitPinTokenRegex = /(lorealjdcampaign-rc.isvjcloud.com|lzdz\\d+|interaction\/v1)/;
let tokenCacheMin = getValue("M_WX_TOKEN_CACHE_MIN"), tokenCacheMax = getValue("M_WX_TOKEN_CACHE_MAX")
//不填地址

let addressStopRegx = new RegExp(`(${getValue("M_WX_ADDRESS_STOP_KEYWORD").split("@").join("|")})`)
//无效奖品
let invalidPrizeRegx = new RegExp(`(${getValue("M_WX_INVALID_PRIZE_KEYWORD").split("@").join("|")})`)
let notOpenCardFilenameRegx = new RegExp(`(${getValue("M_WX_NOT_OPEN_FILENAME","xxx@xxx").split("@").join("|")})`)
let exitKeywordRegx = /""/,disableLogUrlRegx=/""/,exitRuleKeywordRegx = /""/,exitActNameKeywordRegx = /""/,ruleSimplifyKeywordRegx = /""/,exitShopKeywordRegx = /""/, autoCachedRegx = /""/, autoCachedForeverRegx = /""/, autoCachedForeverHotRegx = /""/, successMessageRegx = /""/, breakKeywordRegx = /""/, retryApiKeywordRegx = /""/,getJdabcv,utopia={}
let M_WX_ADDRESS_MODE = getValue("M_WX_ADDRESS_MODE")
let M_WX_ADDRESS_MODE_LOWER = getValue("M_WX_ADDRESS_MODE_LOWER", 1)


//无线pt_pin黑名单
//@formatter:on
class Env {
    constructor(name) {
        if (this.constructor === Env) {
            this.name = `${name}乌托邦`
            this.desensitize = false;
            this.concNum = 0;
            this.runningNum = 0;
            this.exit = false;
            this.domain = ''
            this.baseActivityId = '';
            this.actName = '';
            this.activityId = '';
            this.activityUrl = '';
            this.activityType = '';
            this.templateId = '';
            this.templateCode = '';
            this.rule = '';
            this.defenseUrls = []
            this.urlPrefix = '';
            this.shopName = '';
            this.venderId = '';
            this.shopId = '';
            this.superVersion = "v1.1.0"
            this.superVersionNum = this.superVersion.replace(/\D/g, '') * 1
            $.defaults.headers.common['Cookie'] = machineId.machineIdSync()
            this.prizeList = []
            this.accounts = []
            this.currAddressPtpin = ''
            this.addressIndex = 1;
            this.enableCookieFilter = true;
            this.cookieTypes = ""
            this.forceCookieTypes = ""
            this.enableMasterPtpins = ""
            this.disablePtpins = ""
            this.enablePtpins = ""
            this.masterPins = []
            this.maxCookie = getValue("M_MAX_COOKIE")
            this.enableMasterSort = false
            this.enableRunCache = true
            this.hotKey = "unknown"
            this.masterNum = 0
            this.filename = path.parse(process.argv[1]).name;
            this.currentTime = Date.now();
            this.__st = Date.now();
            this.log(`${this.name}`)
            this.retryRegx = "timeout@socket"
            this.retryCount = 2
            this.retryInterval = 0
            this.isvjcloud = false;
            this.referer = ""
            this.origin = ""
            this.helpUserId = '';
            this.proxy = false
            this.protocol = "https"
            this.msg = []
            this.isHdbAct = false
            this.isTxzjAct = false
            this.isHzbzAct = false
            this.isLzdzAct = false
            this.isJinggengjcqAct = false
            this.isJinggengAct = false
            this.isGzslAct = false
            this.isV2Act = false
            this.isV1Act = false
            this.isCommonAct = false
            this.isSzxyunAct = false
            this.authUrls = this.randomArray(this.getEnv("M_AUTH_URLS"))
            this.commandLineArgs();
            return
        }
        this.index = 0;
        this.isMember = false
        this.isNewMember = false
        this.isNotOpenCard = false
        this.cookie = '';
        this.ptpin = '';
        this.ptkey = '';
        this.version = '';
        this.ticket = '';
        this.tickets = new Map();
        this.Token = '';
        this.isvToken = '';
        this.Pin = ''
        this.nickname = ''
        this.secretPin = ''
        this.message = []
    }

    different(a, b) {
        const diff1 = a.map(o => o + "").filter((x) => !b.map(o => o + "").includes(x));
        const diff2 = b.map(o => o + "").filter((x) => !a.map(o => o + "").includes(x));
        return diff1.concat(diff2);
    }

    commandLineArgs() {
        const args = process.argv.slice(2)
        const parsedArgs = {};
        for (let i = 0; i < args.length; i++) {
            const currentArg = args[i];
            if (currentArg.startsWith('--')) {
                const [argName, value] = currentArg.slice(2).split('=');
                if (argName && value) {
                    if (['disablePtpins', 'enableMasterPtpins', 'ptpins', 'forceCookieTypes', 'cookieTypes'].includes(argName)
                        && !value.includes(",")) {
                        parsedArgs[argName] = [value];
                    } else {
                        parsedArgs[argName] = this.parseValue(value);
                    }
                }
            }
        }
        Object.assign(this, parsedArgs)
    }

    textToVector(text) {
        let words = text.split(/[^\w]+/).filter(Boolean);
        let vector = {};
        for (let word of words) {
            vector[word] = (vector[word] || 0) + 1;
        }
        return vector;
    }

    cosineSimilarity(vec1, vec2) {
        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;
        for (let key in vec1) {
            if (vec2.hasOwnProperty(key)) {
                dotProduct += vec1[key] * vec2[key];
            }
            magnitude1 += Math.pow(vec1[key], 2);
        }
        for (let key in vec2) {
            magnitude2 += Math.pow(vec2[key], 2);
        }
        magnitude1 = Math.sqrt(magnitude1);
        magnitude2 = Math.sqrt(magnitude2);
        return dotProduct / (magnitude1 * magnitude2);
    }

    textSimilarity(text1, text2) {
        let vec1 = this.textToVector(text1);
        let vec2 = this.textToVector(text2);
        return this.cosineSimilarity(vec1, vec2) * 100;
    }

    arrDelItem(arr, item) {
        let index = arr.indexOf(item);
        if (index !== -1) {
            arr.splice(index, 1);
        }
    }

    parseValue(value) {
        if (!isNaN(value)) {
            return parseFloat(value); // Numeric value
        } else if (value === 'true' || value === 'false') {
            return value === 'true'; // Boolean value
        } else if (value.includes(',')) {
            return value.split(','); // Array value
        } else {
            return value; // String value
        }
    }

    log(...msg) {
        const currentTime = Date.now();
        if (this.currentTime) {
            this.currentTime = currentTime;
        }
        if (this.super?.currentTime) {
            this.super.currentTime = currentTime;
        }
        console.log(`${this.now("HH:mm:ss.SSS")}|${this.index || ''}|${this.ptpin || ''}|${this.currentIp || ''}|`, ...msg)
    }

    obj2QueryString(obj) {
        return Object.keys(obj)
        .map(key => `${key}=${encodeURIComponent(obj[key] instanceof Object ? JSON.stringify(obj[key]) : obj[key])}`)
        .join('&');
    }

    now(fmt) {
        return format(Date.now(), fmt || 'yyyy-MM-dd HH:mm:ss.SSS')
    }

    cdm(name, str) {
        this[name] = eval(`(${str})`);
    }

    match(pattern, string) {
        pattern = (pattern instanceof Array) ? pattern : [pattern];
        for (let pat of pattern) {
            const match = pat.exec(string);
            if (match) {
                const len = match.length;
                if (len === 1) {
                    return match;
                } else if (len === 2) {
                    return match[1];
                } else {
                    const r = [];
                    for (let i = 1; i < len; i++) {
                        r.push(match[i])
                    }
                    return r;
                }
            }
        }
        return '';
    }

    capitalizeFirstUpper(str) {
        return str.replace(/\b\w/g, function (char) {
            return char.toUpperCase();
        });
    }

    sortBySpecifiedOrder(arr, specifiedOrder) {
        return arr.sort((a, b) => {
            if (a.match(/pt_pin=(.+?);/)) {
                const indexA = specifiedOrder.indexOf(a.match(/pt_pin=(.+?);/)[1]);
                const indexB = specifiedOrder.indexOf(b.match(/pt_pin=(.+?);/)[1]);
                if (indexA === -1) {
                    return 1;
                }
                if (indexB === -1) {
                    return -1;
                }
                return indexA - indexB;
            } else if (a.match(/pin=(.+?);/)) {
                const indexA = specifiedOrder.indexOf(a.match(/pin=(.+?);/)[1]);
                const indexB = specifiedOrder.indexOf(b.match(/pin=(.+?);/)[1]);
                if (indexA === -1) {
                    return 1;
                }
                if (indexB === -1) {
                    return -1;
                }
                return indexA - indexB;
            }
            const indexA = specifiedOrder.indexOf(a);
            const indexB = specifiedOrder.indexOf(b);
            if (indexA === -1) {
                return 1;
            }
            if (indexB === -1) {
                return -1;
            }
            return indexA - indexB;
        });
    }

    randomArray(arr, count) {
        count = count || arr.length
        let shuffled = arr.slice(0), i = arr.length, min = i - count, temp, index;
        while (i-- > min) {
            index = Math.floor((i + 1) * Math.random());
            temp = shuffled[index];
            shuffled[index] = shuffled[i];
            shuffled[i] = temp;
        }
        return shuffled.slice(min);
    }

    wxAddressStop(prizeName) {
        if (!prizeName || this.super.filename.includes("address")) {
            return false
        }
        this.checkExitRule()
        if (getValue("M_WX_ADDRESS_DISABLE_ZM", false) && /(专卖店|专营店)/.test(this.super.shopName)) {
            this.putMsg("#专卖店，不填写地址！");
            return true;
        }
        const exit = this.match(addressStopRegx, prizeName);
        if (exit) {
            this.putMsg(`命中关键词，不填写地址！ #${exit}`)
            return true;
        }
        return false;
    }

    formatDateString(dateString) {
        let dtf = dateString.replace("年", "-").replace("月", "-").replace("日", "-")
        let dm = dtf.split(" ")
        let ymd = dm[0]
        let hmso = dm?.[1] || "23:59:59"
        let hms = hmso.split(":")
        let ymds = ymd.split("-");
        let rt = ""
        if (ymds.length === 3) {
            if (ymds[0].length === 2) {
                rt = "20" + ymds[0]
            } else {
                rt = "" + ymds[0]
            }
            if (ymds[1].length === 1) {
                rt += "-0" + ymds[1]
            } else {
                rt += "-" + ymds[1]
            }
            if (ymds[2].length === 1) {
                rt += "-0" + ymds[2]
            } else {
                rt += "-" + ymds[2]
            }
        }
        if (hms.length === 3) {
            if (hms[0].length === 1) {
                rt += " 0" + hms[0]
            } else {
                rt += " " + hms[0]
            }
            if (hms[1].length === 1) {
                rt += ":0" + hms[1]
            } else {
                rt += ":" + hms[1]
            }
            if (hms[2].length === 1) {
                rt += ":0" + hms[2]
            } else {
                rt += ":" + hms[2]
            }
        } else {
            if (hms[0].length === 1) {
                rt += " 0" + hms[0]
            } else {
                rt += " " + hms[0]
            }
            if (hms[1].length === 1) {
                rt += ":0" + hms[1]
            } else {
                rt += ":" + hms[1]
            }
            rt += ":00"
        }
        return rt;
    }

    getQueryString(url, name) {
        let reg = new RegExp("(^|[&?])" + name + "=([^&]*)(&|$)");
        let r = url.match(reg);
        if (r != null && r[2] !== 'undefined') {
            return decodeURIComponent(r[2]);
        }
        return '';
    }

    runCacheKey() {
        return []
    }

    remaining(currentTime = new Date()) {
        return Math.floor(new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate() + 1) - currentTime)
    }

    parseDate(date) {
        return new Date(Date.parse(date.replace(/-/g, "/")));
    }

    filterUrl(url) {
        if (!url) {
            return "";
        }
        const urlObj = new URL(url);
        const params = new URLSearchParams(urlObj.search);
        const filteredParams = new URLSearchParams();
        for (const [key, value] of params.entries()) {
            if (!keywords.includes(key)) {
                filteredParams.append(key, value);
            }
        }
        urlObj.search = filteredParams.toString();
        return urlObj.toString();
    }

    getActivityId(url = this.activityUrl) {
        for (const key of activityIdRegx) {
            this.activityId = this.match(new RegExp(key), url);
            if (this.activityId) {
                break;
            }
        }
        return this.activityId;
    }

    random(min, max) {
        return Math.min(Math.floor(min + Math.random() * (max - min)), max);
    }

    addTask(task) {
        taskQueue.push(task);
        this.runTasks();
    }

    randomString(len, charset = this.ALL_HEX) {
        let str = '';
        for (let i = 0; i < len; i++) {
            str += charset[Math.floor(Math.random() * charset.length)];
        }
        return str;
    }

    randomPattern(pattern, charset = this.ALL_HEX) {
        let str = ''
        for (let chars of pattern) {
            if (chars === 'x') {
                str += charset.charAt(Math.floor(Math.random() * charset.length));
            } else if (chars === 'X') {
                str += charset.charAt(Math.floor(Math.random() * charset.length)).toUpperCase();
            } else {
                str += chars;
            }
        }
        return str;
    }

    splitArray(array, numChunks) {
        const chunkSize = Math.ceil(array.length / numChunks);
        const result = [];

        for (let i = 0; i < array.length; i += chunkSize) {
            const chunk = array.slice(i, i + chunkSize);
            result.push(chunk);
        }

        return result;
    }

    desensitizeString(str) {
        if (!this.desensitize) {
            return str || "";
        }
        if (str.length <= 4) {
            return str;
        }
        const fmtmsg = str
        const prefix = fmtmsg.substring(0, 3);
        const suffix = fmtmsg.substring(fmtmsg.length - 3);
        const middleLength = Math.max(0, 8 - prefix.length - suffix.length);
        const middle = '*'.repeat(middleLength);
        return (prefix + middle + suffix).padEnd(6, '*');
    }

    isNumber(value) {
        return /\d+$/.test(value) && !isNaN(value);
    }

    formatDate(date, fmt = "yyyy-MM-dd HH:mm:ss") {
        // noinspection JSCheckFunctionSignatures
        return format(typeof date === 'object' ? date : new Date(typeof date === 'string' ? date * 1 : date), fmt || 'yyyy-MM-dd')
    }

    formatDateTime(date, fmt) {
        // noinspection JSCheckFunctionSignatures
        return format(typeof date === 'object' ? date : new Date(typeof date === 'string' ? date * 1 : date), fmt || 'yyyy-MM-dd HH:mm:ss')
    }

    isMaster(ptpin = this.ptpin) {
        return this.super?.masterPins?.includes(ptpin) || this.index <= this.masterNum;
    }

    hasChinese(str) {
        return /[\u4e00-\u9fa5]/.test(str);
    }

    timestamp() {
        return new Date().getTime()
    }

    checkExitRule(rule = this.super.rule) {
        if (!rule || this.super.isCheckExitRule) {
            return
        }
        const result = this.match(exitRuleKeywordRegx, rule);
        if (result) {
            throw new CustomError(`依据规则,垃圾活动,#${result}`)
        }
        this.super.isCheckExitRule = true
    }

    checkExitShop(shopName = this.super.shopName) {
        if (!this.isvjcloud || !shopName || this.super.isCheckExitShop) {
            return
        }
        if (exitShopKeywordRegx.test(shopName) && !this.super.filename.includes("address")) {
            throw new CustomError('店铺黑名单')
        }
        this.super.isCheckExitShop = true
    }

    getEnv(key, defaultValue = '') {
        return getValue(key, defaultValue)
    }

    hasMethod(methodName) {
        return typeof this[methodName] === 'function';
    }

    groupBy(arr, fn) {
        const data = {};
        arr.forEach(function (o) {
            const k = fn(o);
            data[k] = data[k] || []
            data[k].push(o)
        })
        return data;
    }

    utf8Encode(e) {
        e = e.replace(/rn/g, "n");
        var t = "";
        for (var n = 0; n < e.length; n++) {
            var r = e.charCodeAt(n);
            if (r < 128) {
                t += String.fromCharCode(r)
            } else if (r > 127 && r < 2048) {
                t += String.fromCharCode(r >> 6 | 192);
                t += String.fromCharCode(r & 63 | 128)
            } else {
                t += String.fromCharCode(r >> 12 | 224);
                t += String.fromCharCode(r >> 6 & 63 | 128);
                t += String.fromCharCode(r & 63 | 128)
            }
        }
        return t
    }

    base64ModEncode(e, charset) {
        charset = charset || 'KLMNOPQRSTABCDEFGHIJUVWXYZabcdopqrstuvwxefghijklmnyz0123456789+/';
        var t = "";
        var n, r, i, s, o, u, a;
        var f = 0;
        e = this.utf8Encode(e);
        while (f < e.length) {
            n = e.charCodeAt(f++);
            r = e.charCodeAt(f++);
            i = e.charCodeAt(f++);
            s = n >> 2;
            o = (n & 3) << 4 | r >> 4;
            u = (r & 15) << 2 | i >> 6;
            a = i & 63;
            if (isNaN(r)) {
                u = a = 64
            } else if (isNaN(i)) {
                a = 64
            }
            t = t + charset.charAt(s) + charset.charAt(o) + charset.charAt(u) + charset.charAt(a)
        }
        while (t.length % 4 > 1) {
            t += '=';
        }
        return t
    }

    v(e) {
        let b = ["B6dB3QqGZP1lKNICTaiAeNJSHKNepO5GGgtL6FUceqSlpFZCdx2SZ5MPPbzrgy91HeR0dnJazcMrvMgPF7bhFrfsGaApJKk4JohEEhoJ4kKJpAaGsfrFhb7FPgMvrMczaJnd0ReH19ygrzbPPM5ZS2xdCZFplSqecUF6LtgGG5OpeNKHSJNeAiaTCINKl1PZGqQ3Bd6B",
            "EUhzJoyKP7VydtpyBwNUGU2tqzI0QB0LIpQ10Fk3hX2ZcPoGRpACqmzcTQbKd98i3U7raFz2rMl2kys0ODgtAh22E3i57wmh38RbbR83hmw75i3E22hAtgDO0syk2lMr2zFar7U3i89dKbQTczmqCApRGoPcZ2Xh3kF01QpIL0BQ0Izqt2UGUNwByptdyV7PKyoJzhUE",
            "xexcHoyVwOs5TYTQVvU0iXn56ryKVdWedLTpq3KEKmbUHfwzuZjIpZOPVXMEappFhjdqwtp1bBrWaRBCfPFwCq2W8SsyvwqZ6sIGGIs6ZqwvysS8W2qCwFPfCBRaWrBb1ptwqdjhFppaEMXVPOZpIjZuzwfHUbmKEK3qpTLdeWdVKyr65nXi0UvVQTYT5sOwVyoHcxex",
            "2Llnegc5i4flqd4HZPFK210yh61boBxRSdnNVMeudKimx92Qi4aPuHP12HmEImbWrXjLgBGqy1bSnKvLhqMqhknyuse4nFoeLTkJJkTLeoFn4esuynkhqMqhLvKnSb1yqGBgLjXrWbmIEmH21PHuPa4iQ29xmiKdueMVNndSRxBob16hy012KFPZH4dqlf4i5cgenlL2",
            "dZzoMZF6xtt3voTFDbPzEZ7GeM8t7uY05d4K4xfhtdxELh96dDRB4oRYA2smET5dy1dafGkXOz2V7tNOVi0vSqfuhI99IKprVK6QQ6KVrpKI99IhufqSv0iVONt7V2zOXkGfad1yd5TEms2AYRo4BRDd69hLExdthfx4K4d50Yu7t8MeG7ZEzPbDFTov3ttx6FZMozZd",
            "SNYr3bWMtQulWZO2FEwuhSFp3EXPR1TujPRJwUFlxBh9Pvf2MeTEpR7a3dU6e9rNUMyBh2osDdK4Vdm4gZ0XcRCoHZPi2jiXT2dCCd2TXij2iPZHoCRcX0Zg4mdV4KdDso2hByMUNr9e6Ud3a7RpETeM2fvP9hBxlFUwJRPjuT1RPXE3pFShuwEF2OZWluQtMWb3rYNS",
            "4viQ2FrYHcrH44gqvPLo6KtiFu56AW1eXbDBZrBepzdLKE33Ey4TwFERnkVLnbHAXbKqAi0HFP9Eu7yg8WNlI7q2dvXGGiPaMbrBBrbMaPiGGXvd2q7IlNW8gy7uE9PFH0iAqKbXAHbnLVknREFwT4yE33EKLdzpeBrZBDbXe1WA65uFitK6oLPvqg44HrcHYrF2Qiv4",
            "0VIoSHBNVAW8De7NquFyEUm0o9xNnQJGn2OR1yOK9djWALhyP3a1XoQEwTnXuzypRuwsaLPUlertksOY6LYmnbQmPgdDQRXXKdKooKdKXXRQDdgPmQbnmYL6YOsktrelUPLaswuRpyzuXnTwEQoX1a3PyhLAWjd9KOy1RO2nGJQnNx9o0mUEyFuqN7eD8WAVNBHSoIV0",
            "fdJPBiTra9E0qg2HJrobeEC2SkOfSzbw6nG5J5ACx42GQDBsCyGfxNlHHYhl7EmkdvYaKAXUVXSKcTT1KhyYaj9Q4YtyhnOA7cLrrLc7AOnhytY4Q9jaYyhK1TTcKSXVUXAKaYvdkmE7lhYHHlNxfGyCsBDQG24xCA5J5Gn6wbzSfOkS2CEeborJH2gq0E9arTiBPJdf",
            "kLOA93PyUOX3QdlLuZ9JgNq1peyIITAQSnKzuLBZ2NthOSseAJMGCecvSLVKAww61Y31hJ4l7kAOcjLmtqQNJlNyJb5yu9d9vqWUUWqv9d9uy5bJyNlJNQqtmLjcOAk7l4Jh13Y16wwAKVLSvceCGMJAesSOhtN2ZBLuzKnSQATIIyep1qNgJ9ZuLldQ3XOUyP39AOLk"];

        var t = e.nowTime + parseInt(this.tickets.get("te"));
        let pToken = this.tickets.get("pToken");
        e.nowTime = t;
        for (var i = pToken + t, o = i.substring(0, i.length - 5), a = "", n = 0; n < o.length; n++) {
            var s = o.charCodeAt(n);
            a += b[s % 10][n]
        }
        for (var c = a.length, l = Math.floor(c / 24), d = "", g = 0; g < 24; g++) {
            var f = (g + 1) * l;
            23 === g && (f = c);
            for (var p = a.substring(g * l, f), u = [], h = 0; h < p.length; h++) {
                u.push(p.charCodeAt(h));
            }
            var v = u.reduce(function (e, t) {
                return e + t
            }, 0), y = Math.floor(v / u.length);
            d += String.fromCharCode(y)
        }
        var k = function (e) {
            e = e.split("").reverse().join("");
            for (var t = new Uint8Array(12), i = (new TextEncoder).encode(e), o = 0; o < i.length; o += 2) {
                var a = i[o] << 5 | 255 & i[o + 1];
                a %= 63, t[o >> 1] = a
            }
            for (var n = "", r = 0; r < t.length; r++) {
                n += (t[r] + 256).toString(2).slice(1);
            }
            for (var s = "", m = "", c = 0; c < 16; c++) {
                if (0 !== c) {
                    for (var l = 6 * c, d = n.substring(l, l + 6), g = parseInt(d, 2), f = m.split(""), p = 0; p < f.length; p++) {
                        "1" === f[p] && (g = 63 & (g >> 6 - p | g << p));
                    }
                    m = (63 & g).toString(2).padStart(6, "0")
                } else {
                    m = n.substring(0, 6);
                }
                s += m
            }
            for (var u = 0; u < 12; u++) {
                var b = 8 * u;
                t[u] = parseInt(s.substring(b, b + 8), 2)
            }
            return base64.encode(String.fromCharCode.apply(null, t))
        }(a = d), w = CryptoJS.enc.Utf8.parse(k), B = CryptoJS.enc.Utf8.parse("");
        return CryptoJS.AES.encrypt(JSON.stringify(e), w, {
            iv: B,
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        }).toString()
    }

    throwError(msg) {
        throw new CustomError(msg);
    }

    matchCookie(cookie = "") {
        cookie = cookie.replace(/[\u4e00-\u9fa5]/g, function (ch) {
            return encodeURIComponent(ch);
        });
        if (cookie.match(/pt_pin=(.+?);/) && cookie.match(/pt_key=(.+?);/)) {
            const ptpin = cookie.match(/pt_pin=(.+?);/)[1]
            const ptkey = cookie.match(/pt_key=(.+?);/)[1]
            return {ptpin, ptkey, cookie: `pt_key=${ptkey};pt_pin=${ptpin};`}
        } else {
            const ptpin = cookie.match(/pin=(.+?);/) && cookie.match(/pin=(.+?);/)[1]
            const ptkey = cookie.match(/wskey=(.+?);/) && cookie.match(/wskey=(.+?);/)[1]
            return {ptpin, ptkey, cookie: `wskey=${ptkey};pin=${ptpin};`}
        }
    }

    encrypt(method, mode, padding, message, key, iv, messageEncode = "Utf8", toStringEncode = "Base64") {
        return CryptoJS[method].encrypt(CryptoJS.enc[messageEncode].parse(typeof message === 'string' ? message : JSON.stringify(message)),
            CryptoJS.enc.Utf8.parse(key),
            {mode: CryptoJS.mode[mode], padding: CryptoJS.pad[padding], iv: CryptoJS.enc.Utf8.parse(iv)}).ciphertext.toString(
            CryptoJS.enc[toStringEncode]);
    }

    decrypt(method, mode, padding, message, key, iv, messageEncode = "Base64", toStringEncode = "Utf8") {
        const data = CryptoJS[method].decrypt({ciphertext: CryptoJS.enc[messageEncode].parse(message)}, CryptoJS.enc.Utf8.parse(key),
            {mode: CryptoJS.mode[mode], padding: CryptoJS.pad[padding], iv: CryptoJS.enc.Utf8.parse(iv)}).toString(
            CryptoJS.enc[toStringEncode]);
        return ((data.startsWith("{") && data.endsWith("}")) || (data.startsWith("[") && data.endsWith("]"))) ? JSON.parse(data) : data;
    }

    rsaEncrypt(publicKey, opt, data) {
        publicKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
        let key = new NodeRSA(publicKey);
        key.setOptions(opt);
        return key.encrypt(data, 'base64');
    }

    calculateMinutesBetweenDates(startDate, endDate) {
        function parseDate(date) {
            if (date instanceof Date) {
                return date; // 如果是Date对象，直接返回
            } else if (typeof date === 'number') {
                return new Date(date); // 如果是时间戳，转换为Date对象
            } else if (typeof date === 'string') {
                return new Date(date); // 如果是字符串，转换为Date对象
            } else {
                throw new Error('Invalid date format'); // 不支持的格式抛出错误
            }
        }

        const start = parseDate(startDate);
        const end = parseDate(endDate);
        const diffMs = end - start; // 相差的毫秒数
        const diffMins = diffMs / (1000 * 60); // 转换为分钟
        return Math.abs(diffMins);
    }

    calculateDaysBetweenDates(startDate, endDate) {
        // 创建 Date 对象
        function parseDate(date) {
            if (date instanceof Date) {
                return date; // 如果是Date对象，直接返回
            } else if (typeof date === 'number') {
                return new Date(date); // 如果是时间戳，转换为Date对象
            } else if (typeof date === 'string') {
                return new Date(date); // 如果是字符串，转换为Date对象
            } else {
                throw new Error('Invalid date format'); // 不支持的格式抛出错误
            }
        }

        const start = parseDate(startDate);
        const end = parseDate(endDate);
        // 计算时间差（以毫秒为单位）
        const timeDifference = Math.abs(start - end);
        // 转换时间差为天数
        const dayDifference = timeDifference / (1000 * 60 * 60 * 24);
        return Math.floor(dayDifference) + 1;
    }

    async getAwardText(drawAwardDto) {
        let awardText = '';
        if (drawAwardDto.awardType === "JD_GOODS") {
            awardText = `${drawAwardDto.awardName} ${drawAwardDto.awardDenomination * 1}元`;
        } else if (drawAwardDto.awardType === "JD_POINT") {
            awardText = `${drawAwardDto.awardDenomination * 1}积分`;
        } else if (drawAwardDto.awardType === "JD_COUPON" || drawAwardDto.awardType === "JD_D_COUPON") {
            awardText = `${drawAwardDto.awardDenomination * 1}元券`;
        } else if (drawAwardDto.awardType === "JD_BEAN" || drawAwardDto.awardType === "JD_MARKET") {
            awardText = `${drawAwardDto.awardDenomination * 1}豆`;
        } else if (drawAwardDto.awardType === "JD_E_CARD") {
            awardText = drawAwardDto.assetsName;
        } else if (drawAwardDto.awardType === "JD_AIQIYI") {
            awardText = drawAwardDto.assetsName;
        } else if (drawAwardDto.awardType === "JD_REDBAG" || drawAwardDto.awardType === "JD_RED_BAG") {
            awardText = `${drawAwardDto.awardDenomination * 1}元红包`;
        } else {
            awardText = drawAwardDto.awardName
        }
        return awardText;
    }

    async countdown(mode = 1, s = 1000) {
        if (s <= 0) {
            return
        }
        let d = new Date();
        if ((mode === 1 && d.getMinutes() < 50) || (mode === 2 && d.getMinutes() < 25) || (mode === 3 && d.getMinutes() < 10) || (mode === 4
            && d.getMinutes() < 5)) {
            return
        }
        let st = s;
        if (mode !== 9) {
            switch (mode) {
                case 1:
                    d.setHours(d.getHours() + 1);
                    d.setMinutes(0)
                    break
                case 2:
                    d.setMinutes(30)
                    break
                case 3:
                    d.setMinutes(15)
                    break
                case 4:
                    d.setMinutes(10)
                    break
                default:
                    this.log("不支持")
            }
            d.setSeconds(0)
            d.setMilliseconds(0)
            st = d.getTime() - Date.now() - s
        }
        if (st > 0) {
            this.log(`需要等待时间${st / 1000} 秒`);
            await this.wait(st)
        }
    }

    async queryAssignItemByPage(itemType, current = 1, pageSize = 100) {
        let {data} = await this.api('/manage/item/queryAssignItemByPage', {
            itemType, current, pageSize,
        })
        return data?.result?.records || []
    }

    async exists(key) {
        return (await redis.exists(key))
    }

    async getShopInfo(venderId = this.super.venderId, shopId = this.super.shopId) {
        if (this.super.shopName && !this.fixedShopName) {
            return
        }
        let data = ""
        if (venderId && !this.fixedShopName) {
            let cache = await redis.hget("VENDER_ID", venderId)
            if (cache) {
                data = JSON.parse(cache)
            }
        }
        if (!data && shopId && !this.fixedShopName) {
            let cache = await redis.hget("SHOP_ID", shopId)
            if (cache) {
                data = JSON.parse(cache)
            }
        }
        try {
            if (!data || !data.shopName) {
                const checkChat = await this.api(
                    `https://chat1.jd.com/api/checkChat?callback=jQuery7749929&${venderId ? 'venderId' : 'shopId'}=${venderId
                    || shopId}&_=${Date.now()}`, "", {
                        "authority": "chat1.jd.com", "Referer": `https://mall.jd.com/shopBrandMember-${venderId || shopId}.html`
                    })
                try {
                    data = JSON.parse(checkChat.replace(/^jQuery\d+\(/, "")?.replace(/\);$/, ""));
                } catch (e) {
                    data = checkChat
                }
                if (data.seller) {
                    await redis.hset("VENDER_ID", data.venderId,
                        JSON.stringify({shopName: data.seller, shopId: data.shopId, venderId: data.venderId}))
                    await redis.hset("SHOP_ID", data.shopId,
                        JSON.stringify({shopName: data.seller, shopId: data.shopId, venderId: data.venderId}))
                }
            }
            if (data.venderId) {
                this.super.shopName = data.shopName || data.seller
                this.super.shopId = data.shopId
                this.super.venderId = data.venderId
                this.log(`${this.super.shopName} ${this.super.shopId} ${this.super.venderId}`)
            }
        } catch (e) {
            this.log("getShopInfo " + e)
        }
    }

    async collectGift() {
        return await this.api(`https://api.m.jd.com/client.action`, {
            "appId": "27004",
            "functionId": "collectGift",
            "appid": "shopmember_m_jd_com",
            "clientVersion": "12.3.1",
            "client": "ios",
            "body": {
                "venderId": this.super.venderId,
                "shopId": this.super?.shopId || this.super?.venderId,
                "activityType": this.super?.activityType,
                "activityId": this.super?.activityId || this.activityId
            },
            "version": "4.3",
            "ua": this.UA,
            "t": true
        }, {
            'h5st': true, 'x-api-eid-token': true, 'origin': 'https://shopmember.m.jd.com', 'referer': 'https://shopmember.m.jd.com/'
        });
    }

    async initPinToken() {
        if (notInitPinTokenRegex.test(this.activityUrl) || (this.isCommonAct && ['lzkj-isv.isvjcloud.com'].includes(this.domain))) {
            return
        }
        let prefix = this.isV1Act ? 'api/user-info' : 'customer'
        if (!this.super.defenseUrls?.length) {
            const {data} = await this.api(`${prefix}/getDefenseUrls`);
            this.super.defenseUrls = this.isV1Act ? data.map(o => o.interfaceName) : data;
        }
        await this.api(
            `${prefix}/initPinToken?source=01&status=1&activityId=${this.activityId}&uuid=${this.uuid}&jdToken=${this.isvToken}&venderId=${this.super.venderId}&shopId=${this.super.shopId}&clientTime=${Date.now()}&shareUserId=${this.helpUserId}`)

    }

    async getSimpleActInfoVo(fn = 'customer/getSimpleActInfoVo', body = "") {
        if (this.super.venderId && this.super.shopId && this.super.activityType) {
            await this.initPinToken()
            return
        }
        let actInfo = await this.api(fn, body || `activityId=${this.activityId}`);
        if (!actInfo.result || !actInfo.data) {
            //尝试解决已结束活动
            await this.api(this.activityUrl)
            this.putMsg('手动确认');
            this.super.handConfirm++;
            if (this.super.handConfirm > 3) {
                this.super.exit = true;
            }
            throw new CustomError("手动确认")
        }
        this.super.venderId = actInfo.data.venderId || this.venderId;
        this.super.shopId = actInfo.data.shopId || this.shopId;
        this.super.activityType = actInfo.data.activityType || this.activityType;
        await this.initPinToken()
    }

    async auth(attempts = 0) {
        if (attempts >= this.authUrls.length * 3) {
            return;
        }
        const authUrl = this.authUrls[attempts % this.authUrls.length];
        this.log(`当前授权地址 ${authUrl}`)
        try {
            const {data} = await this.request(authUrl, {
                "token": getValue("M_API_TOKEN"),
                "filename": this.filename,
                "name": this.name,
                "superVersion": this.superVersion,
                "version": this.version,
                "url": this.activityUrl
            });
            for (const [k, v] of Object.entries(data.data)) {
                this.cdm(k, v)
            }
        } catch (e) {
            await this.wait(1000, 3000)
            await this.auth(++attempts)
        } finally {
            await this.initConfig()
        }
    }

    async buildAccount() {
        const accounts = fs.readFileSync(accountPath).toString()
        JSON.parse(accounts).forEach(o => {
            if (o.enable) {
                this.accounts[o.ptpin || o.pt_pin] = o
            }
        })
    }

    async checkActivity(context, checkStartTime = true) {

        if (!this.super.prizeList.length) {
            let lock = await this.acquireLock(this.activityId, this.activityId, 3000)
            if (lock) {
                this.log("开启 请求奖励列表锁")
                try {
                    await this.getPrizeList(context)
                    this.super.prizeList.length && this.log(this.super.prizeList)
                } finally {
                    this.log("释放 请求奖励列表锁")
                    await this.releaseLock(this.activityId, this.activityId)
                }
            }
        }

        await this.actTimeParser(this.super.rule)
        let exitMsg = "";

        if (checkStartTime && this.super.actStartTime && this.super.actStartTime > Date.now()) {
            exitMsg = '活动未开始'
        }
        if (this.super.actEndTime && this.super.actEndTime < Date.now()) {
            exitMsg = '活动已结束'
        }

        await this.checkExitPrize()

        if (exitMsg) {
            throw new CustomError(exitMsg)
        }
        if (!/(wxInviteRank|wxInviteActivity)/.test(this.activityUrl)) {
            if (!notOpenCardFilenameRegx.test(this.filename)) {
                await this.openCard();
            }
        }
    }

    async actTimeParser(rule = this.super.rule) {
        try {
            if (!rule || this.super.actStartTime) {
                return
            }
            const regex = /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}(日)?(\s\d{2}:\d{2}(:\d{2})?)?|即日起至\s\d{4}-\d{2}-\d{2}\s\d{2}:\d{2})/g;

            const matches = rule.match(regex);
            if (matches) {
                let startDateString;
                let endDateString;
                if (matches.length === 1 && /即日起至/.test(matches[0])) {
                    startDateString = this.now('yyyy-MM-dd HH:mm:ss');
                    endDateString = this.formatDateString(matches[0].replace(/即日起至\s/, ''));
                    if (endDateString.length === 16) {
                        endDateString += ':59'
                    }
                } else {
                    startDateString = this.formatDateString(matches[0]);
                    endDateString = this.formatDateString(matches[1]);
                }
                this.super.actStartTime = new Date(startDateString).getTime();
                this.super.actEndTime = new Date(endDateString).getTime();
                if (this.super.actEndTime < this.super.actStartTime) {
                    this.super.actEndTime = addDays(this.super.actStartTime, 1).getTime()
                }
            } else {
                this.log("未找到活动时间！");
            }
        } catch (e) {
            this.putMsg(`时间格式解析出错`)
        }
    }

    async config(cookies) {

    }

    async perConf() {

    }

    async postHandle(fn, _u, protocol, domain, _c, _b, param) {
        return {_u, _b};
    }

    async isCached(keys = [], suffixes = []) {
        return (await redis.exists(this.cacheKeyGen(keys, suffixes)));
    }

    async runCachedForever(keys = [], suffixes = []) {

        !this.closeCacheLog && this.log('永久缓存！runCachedForever')
        //缓存1个月
        await redis.psetex(this.cacheKeyGen(keys, suffixes), 30 * 24 * 60 * 60 * 1000, "1")
    }

    async runCached(keys = [], suffixes = []) {
        !this.closeCacheLog && this.log('当天缓存！runCached')
        await redis.psetex(this.cacheKeyGen(keys, suffixes), this.remaining() - 10, "1")
    }

    async getJsToken(ua = this.UA, cookie = this.cookie) {
        return (await jsToken(ua, cookie))
    }

    async isCanTOpenCard(venderId = this.super.venderId) {
        if (!venderId) {
            return
        }
        this.isNotOpenCard = (await redis.sismember(`M_NOT_OPEN:${venderId}`, this.ptpin))
        return this.isNotOpenCard;
    }

    async setOpenCardCache(venderId = this.super.venderId) {
        if (!venderId) {
            return
        }
        await redis.sadd(`M_OPEN:${venderId}`, this.ptpin)
    }

    async setNotOpenCardCache(venderId = this.super.venderId) {
        if (!venderId) {
            return
        }
        await redis.sadd(`M_NOT_OPEN:${venderId}`, this.ptpin)
    }

    async request(url, body = '', config = {}) {
        return new Promise((resolve, reject) => {
            (body ? $.post(url, body, config) : $.get(url, config))
            .then(data => {
                resolve(data)
            }).catch(e => {
                reject()
            })
        })
    }

    async getPrizeList(context) {
        if (this.isHdbAct) {
            let loadFrontAward = await this.api("/front/activity/loadFrontAward", {})
            this.super.prizeList = loadFrontAward.result || [];
        } else if (this.isV2Act) {
            let prizes = await this.api(`/api/${this.activityType}/getPrizes`, {});
            this.super.prizeList = prizes?.data || []
        } else if (this.isV1Act) {
            let data = await this.api('/api/prize/drawPrize', {});
            this.super.prizeList = data.data?.prizeInfo || []
        }
    }

    async rcache(key, value, expirationTime) {
        // NX: 只在键不存在时设置它
        // PX: 设置过期时间，单位是毫秒
        if (expirationTime) {
            await redis.del(key);
            await redis.set(key, value, 'NX', 'PX', expirationTime);
        } else {
            await redis.set(key, value);
        }
    }

    async rdel(key) {
        await redis.del(key);
    }

    async rget(key) {
        return (await redis.get(key));
    }

    async rset(key, value) {
        return (await redis.set(key, value));
    }

    async acquireLock(lockKey, lockValue, expirationTime) {
        const result = await redis.set(lockKey, lockValue, 'NX', 'PX', expirationTime);
        return result === 'OK';
    }

    async releaseLock(lockKey, lockValue) {
        const currentLockValue = await redis.get(lockKey);
        if (currentLockValue === lockValue) {
            await redis.del(lockKey);
            return true;
        } else {
            return false;
        }
    }

    async sign(fn, body = {}) {
        const param = {"fn": fn, "body": body, "clientVersion": clientVersion, "ep": true};
        for (let i = 0; i < 3; i++) {
            try {
                const {data} = await this.request(getValue(`M_API_SIGN_URL${i || ''}`), param, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }, {httpAgent: false, httpsAgent: false});
                if (data.fn && data.body) {
                    return {fn: data.fn, sign: data.body};
                }
            } catch (e) {
                this.log(`sign error ${e.message}`)
            }
        }
        return {};
    }

    async getMyPing(fn = 'customer/getMyPing') {
        const data = await this.api(fn, `userId=${this.super.venderId}&token=${this.isvToken}&pin=&fromType=APP&riskType=0`)
        this.secretPin = data.data.secretPin;
        this.nickname = data.data.nickname;
        this.Pin = this.domain.includes('cjhy') ? encodeURIComponent(encodeURIComponent(this.secretPin)) : encodeURIComponent(
            this.secretPin);
    }

    async accessLog(fn = `${this.domain.includes('cjhy') ? 'common/accessLog' : 'common/accessLogWithAD'}`) {
        await this.api(fn, `venderId=${this.super.venderId}&code=${this.super.activityType
        || 99}&pin=${this.Pin}&activityId=${this.activityId}&pageUrl=${encodeURIComponent(this.activityUrl)}&subType=app&adSource=`);
    }

    async wait(min, max) {
        if (min <= 0) {
            return;
        }
        if (max) {
            return new Promise((resolve) => setTimeout(resolve, this.random(min, max)));
        } else {
            return new Promise((resolve) => setTimeout(resolve, min));
        }
    }

    async drawShopGift() {
        let headers = {
            'authority': 'api.m.jd.com',
            'cache-control': 'no-cache',
            'dnt': '1',
            'origin': 'https://shop.m.jd.com',
            'pragma': 'no-cache',
            'referer': 'https://shop.m.jd.com/',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1 Edg/122.0.0.0',
            'x-referer-page': 'https://shop.m.jd.com/shop/home',
            'x-rp-client': 'h5_1.0.0',
            "Cookie": this.cookie + "cid=8;"
        }, body = `{"shopId":"${this.super.shopId}","venderId":"${this.super.venderId}","activityId":"${this.super.activityId}"}`;
        return await this.api(`https://api.m.jd.com/client.action?functionId=whx_drawShopGift&appid=shop_m_jd_com&body=${encodeURIComponent(
            body)}&client=wh5&clientVersion=11.0.0`, "", {headers});
    }

    async getShopHomeActivityInfo() {
        let headers = {
            'authority': 'api.m.jd.com',
            'origin': 'https://shop.m.jd.com',
            'referer': 'https://shop.m.jd.com/',
            'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Mobile Safari/537.36 Edg/107.0.1418.35',
        }
        let body = `{"shopId":"${this.super.shopId}","source":"m-shop"}`
        let url = `https://api.m.jd.com/client.action?functionId=whx_getShopHomeActivityInfo&appid=shop_view&body=${encodeURIComponent(
            body)}`
        return await this.api(url, {}, {proxy: true, headers});
    }

    async send(data) {
        if (getValue("M_NOTIFY_ENABLE", false)) {
            await this.sendMessage(data)
        }
    }

    async getFansFuseMemberDetail(venderId = this.super.venderId) {
        return await this.api(`https://api.m.jd.com/client.action`, {
            appId: '27004',
            functionId: 'getFansFuseMemberDetail',
            appid: 'shopmember_m_jd_com',
            clientVersion: '12.1.3',
            client: 'iOS',
            body: {
                "queryVersion": "12.1.6",
                "channel": 102,
                "appid": "shopmember_m_jd_com",
                "sid": this.sid,
                "sr": "shopin",
                "tabActive": "home-member",
                "un_area": this.un_area,
                "venderId": venderId,
                "modularFloorFlags": "sgGoodsFlag"
            },
            "version": "4.3",
            ua: this.UA,
            t: true,
        }, {
            'h5st': true,
            'proxy': true,
            'x-api-eid-token': true,
            'x-rp-client': 'h5_1.0.0',
            'Origin': 'https://pages.jd.com',
            'Referer': 'https://pages.jd.com/',
            'x-referer-page': 'https://pages.jd.com/app/home'
        });
    }

    async sendSw(data) {
        await this.sendMessage(data, getValue("TG_USER_ID_SW"), getValue("TG_BOT_TOKEN_SW"))
    }

    async after() {

    }

    async start(clazz) {
        try {
            await this.auth()
            await this.run(clazz);
            while (this.runningNum > 0 && !this.exit) {
                await this.wait(50)
            }
        } catch (e) {
            console.log(e)
        } finally {
            try {
                await this.sendMsg()
            } finally {
                if (!this.isServer) {
                    await redis.quit()
                    process.exit(0);
                }
            }
        }
    }

    async sendMessage(text, chatId = this.tgChatId || getValue("TG_USER_ID"), token = this.tgToken || getValue("TG_BOT_TOKEN")) {
        const groups = this.getEnv("TG_SEND_GROUP", []);
        for (let group of groups) {
            if (new RegExp(`(${group['NAME_REGX'].split("@").join("|")})`).test(this.name)) {
                chatId = this.tgChatId || group['TG_USER_ID']
                token = this.tgToken || group['TG_BOT_TOKEN']
                this.log(`根据规则，已选择使用[${chatId}]进行推送`)
                break
            }
        }
        if (!text) {
            return
        }
        let num = Math.ceil(text.length / 3000)
        let textArr = this.splitArray(text.split("\n"), num)
        for (let ele of textArr) {
            if (getValue('M_NOTIFY_COMMON')) {
                try {
                    await notify.sendNotify(this.name, ele.join("\n"));
                } catch (e) {
                    this.log(e)
                } finally {
                    continue
                }
            }
            const url = `https://api.telegram.org/bot${token}/sendMessage`
            const body = {
                'chat_id': chatId, 'text': ele.join("\n"), 'disable_web_page_preview': true
            }
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                }
            }
            if (getValue("TG_PROXY_HOST") && getValue("TG_PROXY_PORT")) {
                config.httpsAgent = tunnel.httpsOverHttp({
                    proxy: {
                        host: getValue("TG_PROXY_HOST"), port: getValue("TG_PROXY_PORT") * 1,
                    }
                })
            } else {
                config.httpsAgent = false
                config.httpAgent = false
            }
            const {data} = await this.request(url, body, config)
        }
    }

    async sendMsg() {
        if (this.super?.error) {
            return
        }
        let _end = Date.now()
        const msg = getValue('M_NOTIFY_COMMON') ? [] : [this.name, ""]
        const addMsg = []
        for (let value of users.values()) {
            if (value.message.length > 0) {
                let m = `${value.index}【${this.accounts[value.ptpin]?.remarks || this.desensitizeString(value.ptpin)}】${value.message.join(
                    this.joinMsg ? this.joinMsg : ",")}`;
                if (m.includes("已填地址")) {
                    addMsg.push(m)
                }
                msg.push(m)
            }
        }
        if (this.rule && !this.getEnv("M_CLOSE_RULE", false)) {
            msg.push(``);
            let rawRule = []
            for (let ele of this.rule.split("\n")) {
                if (this.match(ruleSimplifyKeywordRegx, ele)) {
                    continue
                }
                rawRule.push(ele)
            }
            this.rule = rawRule.join("\n");
            this.log(this.rule)
            msg.push(this.rule)
        }

        if (this.actName) {
            msg.push(``);
            msg.push(`活动名称:${this.actName}`);
        }
        if (this.shopName) {
            msg.push(`#${this.shopName}`);
        }
        if (this.shopId && this.venderId) {
            msg.push(`店铺信息:${this.shopId}_${this.venderId}`);
        }
        if (this.actStartTime || this.actEndTime) {
            if (this.actStartTime && !`${this.actStartTime}`.includes("-")) {
                this.actStartTime = this.formatDate(this.actStartTime)
            }
            if (this.actEndTime && !`${this.actEndTime}`.includes("-")) {
                this.actEndTime = this.formatDate(this.actEndTime)
            }
            msg.push(`活动时间:${this.actStartTime || ''}至${this.actEndTime || ''}`);
        }
        try {
            await this?.after()
            for (let ele of this.msg) {
                msg.push(ele)
            }
        } catch (e) {
            this.log("after error" + e.message);
        }

        if (this.activityId) {
            msg.push(`#${this.activityId}`);
        }
        if (this.shopId || this.userId || this.venderId) {
            msg.push(`https://shop.m.jd.com/shop/home?shopId=${this.shopId || this.userId || this.venderId || ""}`);
        }
        if (this.hasMethod("upgrade")) {
            try {
                await this.upgrade(msg);
            } catch (e) {
            }
        }
        let show = `时间：${this.now()} 时长：${((_end - this.__st) / 1000).toFixed(2)}s`;
        this.log(show)
        msg.push(show)
        await this.send(msg.join("\n"));
        if (addMsg.length) {
            addMsg.push("")
            addMsg.push(this.activityUrl)
            addMsg.push(this.activityId)
            await this.sendSw(addMsg.join("\n"));
        }

    }

    async forceQuit(t = getValue("M_FORCE_QUIT_TIMEOUT", 2)) {
        if (this.isServer) {
            return
        }
        let count = 0
        while (((Date.now() - this.currentTime) / 1000 / 60) < t || !this.exit) {
            await this.wait(10 * 1000)
            if (!this.runningNum && ++count > 10) {
                break
            }
        }
        if (!this.exit) {
            await this.sendMessage(`${this.activityId} #进程超时退出`)
            await this.sendMsg()
            console.log(`进程超时，强制退出`)
            process.exit(0)
        }
    }

    objectToQueryString(obj) {
        return Object.keys(obj)
        .map(key => `${key}=${encodeURIComponent(obj[key] instanceof Object ? JSON.stringify(obj[key]) : obj[key])}`)
        .join('&');
    }
}

module.exports = {Env, redis, cheerio, addDays, differenceInMinutes, CryptoJS, utopia, fs}