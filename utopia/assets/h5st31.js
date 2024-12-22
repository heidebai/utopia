const CryptoJS =require( 'crypto-js')
const got = require( 'got')

Date.prototype.Format = function(fmt) {
    let e,
        n = this,
        d = fmt,
        l = {
            "M+": n.getMonth() + 1,
            "d+": n.getDate(),
            "D+": n.getDate(),
            "h+": n.getHours(),
            "H+": n.getHours(),
            "m+": n.getMinutes(),
            "s+": n.getSeconds(),
            "w+": n.getDay(),
            "q+": Math.floor((n.getMonth() + 3) / 3),
            "S+": n.getMilliseconds()
        };
    /(y+)/i.test(d) && (d = d.replace(RegExp.$1, "".concat(n.getFullYear()).substr(4 - RegExp.$1.length)));
    for (let k in l) {
        if (new RegExp("(".concat(k, ")")).test(d)) {
            var t, a = "S+" === k ? "000" : "00";
            d = d.replace(RegExp.$1, 1 == RegExp.$1.length ? l[k] : ("".concat(a) + l[k]).substr("".concat(l[k]).length))
        }
    }
    return d;
}

class H5st31 {
    static #VERSION = '3.1'
    constructor(UA, appId, pin) {
        this.UA = UA
        this.sua = UA.match(/Mozilla\/5.0 \(([^\)]+)\)/)[1]
        this.fp = getfp()
        this.appId = appId
        this.pin = pin
        this.aes = H5st31.#h5st_encrypt({
            "sua": this.sua,
            "pp": {
                "p1": this.pin
            },
            "fp": this.fp
        })
    }
    static #h5st_encrypt(data, is_algo = false) {
        data = JSON.stringify(data, null, 2)
        const p = CryptoJS.AES.encrypt(data, CryptoJS.enc.Utf8.parse(is_algo ? "wm0!@w-s#ll1flo(" : "wm0!@w_s#ll1flo("), {
            iv: CryptoJS.enc.Utf8.parse("0102030405060708"),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
        })
        return p.ciphertext.toString()
    }
    async requestAlgo(url='') {
        const options = {
            "url": `https://cactus.jd.com/request_algo?g_ty=ajax`,
            "headers": {
                "Host": "cactus.jd.com",
                "accept": "application/json",
                "user-agent": this.UA,
                "content-type": "application/json",
                // "origin": og,
                // "x-requested-with": "com.jd.pingou",
                "sec-fetch-site": "cross-site",
                "sec-fetch-mode": "cors",
                "sec-fetch-dest": "empty",
                // "referer": og,
                "accept-encoding": "gzip, deflate, br",
                "accept-language": "en-US,en;q\u003d0.9,zh-CN;q\u003d0.8,zh;q\u003d0.7"
            },
            'body': JSON.stringify({
                "version": H5st31.#VERSION,
                "fp": this.fp,
                "appId": this.appId,
                "timestamp": Date.now(),
                "platform": "web",
                "expandParams": H5st31.#h5st_encrypt({
                    "wc": 1,
                    "wd": 0,
                    "l": "en-US",
                    "ls": "en-US,zh-CN",
                    "ml": 0,
                    "pl": 0,
                    "av": this.UA.split('appBuild/')[1],
                    "ua": this.UA,
                    "sua": this.sua,
                    "pp": {
                        "p1": this.pin
                    },
                    "pp1": "",
                    "w": 1080,
                    "h": 2400,
                    "ow": 1080,
                    "oh": 2400,
                    "url": url,
                    "og": '',//og,
                    "pr": 2,
                    "re": "",
                    "ai": this.appId,
                    "fp": this.fp
                }, true)
            }),
        }
        const response = await got.post(options)
        let data = response.body
        if (data) {
            data = JSON.parse(data);
            if (data['status'] === 200) {
                this.token = data.data.result.tk;
                const enCryptMethodJDString = data.data.result.algo;
                this.enCryptMethodJD = new Function(`return ${enCryptMethodJDString}`)()
            } else {
                console.error('requestAlgo:', JSON.stringify(data))
                throw 'request_algo 签名参数API请求失败'
            }
        } else {
            throw 'request_algo 京东服务器返回空数据'
        }
    }

    decrypt(searchParams,stk) {
        const time = new Date()
        const timestamp = time.Format("yyyyMMddhhmmssSSS");
        if (!(this.fp && this.token && this.enCryptMethodJD)) {
            throw "decrypt error 1"
        }
        const hash1 = this.enCryptMethodJD(this.token, this.fp.toString(), timestamp.toString(), this.appId.toString(), CryptoJS).toString(CryptoJS.enc.Hex)
        const st = stk.map((item, index) => {
            return `${item}:${item != 'body' ? searchParams[item] : CryptoJS.SHA256(searchParams[item])}`
        }).join('&')
        const hash2 = CryptoJS.HmacSHA256(st, hash1).toString(CryptoJS.enc.Hex)
        return [timestamp.toString(), this.fp, this.appId, this.token, hash2, H5st31.#VERSION, time.getTime(), this.aes].join(";")
    }
}
const base = '0123456789'

function p(base,num){
    const o = []
    let b_len = base.length
    for (const c of base){
        if (Math["random"]()*b_len < num){
            o.push(c)
            if (--num == 0) {
                break
            }
        }
        b_len--
    }
    // console.log('te c:',c)
    let C = ""
    for (let L = 0; L< o.length; L++){
        const I = (Math.random() * (o.length - L)) | 0;
        C += o[I]
        o[I] = o[(o.length - L) - 1]
    }
    return C
}

function d(){
    return Math["random"]() * 10 | 0
}

function v(t,e){
    for (let s = 0; s < e["length"]; s++) {
        t = t["replace"](e[s], "")
    }
    return t
}

function m(size,num){
    let l = ""
    while(size--){
        l += num[(Math["random"]() * num["length"])|0]
    }
    return l
}

function getfp(){
    const h = p(base,3)
    // console.log('h:',h)
    const l = d()
    const w = v(base,h)
    // console.log('w:',w)
    const c = m(l,w) + h + m((14 - (l + 3)) + 1, w) + l
    const _ = c["split"]("")
    const S = []
    for (; _["length"] > 0; )
        S["push"](9 - parseInt(_.pop()));
    const y = S.join("");
    return y
}
module.exports = {H5st31,getfp};