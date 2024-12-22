let mode = __dirname.includes('Work')
const {Env} = require('../utopia')
const $ = new Env('M关注有礼');
$.followShopArgv = decodeURIComponent(process.argv.splice(2)?.[0] || process.env.M_FOLLOW_SHOP_ARGV);
$.concNum = 1
if (mode) {
    $.followShopArgv = 'https://shop.m.jd.com/?shopId=1000463788&venderId=1000463788'
    $.cookieTypes = ['ql']
    $.ptpins = ['jd_dVNKncDFcmxr']
}
$.version = "v1.0.0"

let limit = 0
$.enableRunCache = false
$.maxCookie = 1000
$.checkHotKey = 0

class Task extends Env {

    constructor() {
        super();
    }

    async exec() {
        if (!$.superVersion) {
            throw new Error('请更新脚本')
        }
        if (!$.shopId && /\d+_\d+_\d+/.test($.followShopArgv)) {
            let argv = $.followShopArgv.split('_');
            $.shopId = argv?.[0];
            $.venderId = argv?.[1];
            $.activityId = argv?.[2];
        }

        if (!$.shopId || !$.venderId) {
            if ($.followShopArgv.startsWith("http")) {
                $.shopId = this.getQueryString($.followShopArgv, 'shopId') || ""
                $.venderId = this.getQueryString($.followShopArgv, 'venderId') || "";
            } else {
                let argv = $.followShopArgv.split('_');
                $.shopId = argv?.[0];
                $.venderId = argv?.[1];
            }
            await this.getShopInfo();
            $.activityUrl = `https://shop.m.jd.com/?shopId=${$.shopId}&venderId=${$.venderId}`
            this.log($.activityUrl)
        }
        if (!$.activityId) {
            let actInfo = await this.getShopHomeActivityInfo();
            this.log(JSON.stringify(actInfo));
            if (actInfo.code !== '0') {
                limit++ > 50 ? $.exit = true : ""
                this.putMsg('exit');
                return
            }
            let actInfoData = actInfo?.result.giftBagDataResult || actInfo?.result;
            $.prizeList = actInfoData?.shopGifts || []
            if (actInfoData?.shopGifts?.filter(o => /(京豆|红包)/.test(o.rearWord)).length > 0) {
                $.activityId = actInfoData?.activityId?.toString();
            }
        }
        if (!$.activityId) {
            this.putMsg('垃圾奖励');
            limit++ > 50 ? $.exit = true : ""
            return
        }
        $.concNum = 10
        let gift = await this.drawShopGift();
        if (gift?.code !== '0') {
            this.log(JSON.stringify(gift))
            return
        }
        this.log(gift?.result?.giftDesc)
        let giftData = gift?.result;
        for (let ele of giftData?.alreadyReceivedGifts || []) {
            this.putMsg(`${ele.redWord}${ele.rearWord}`);
        }
        if (!/(京豆|红包)/.test(JSON.stringify(giftData?.alreadyReceivedGifts))) {
            this.putMsg(`垃圾奖励不跑了`);
            limit++ > 50 ? $.exit = true : ""
        } else {
            limit = 0
        }
    }
}

$.after = async function () {
    for (let ele of $.prizeList || []) {
        $.msg.push(`    ${ele?.redWord}${ele?.rearWord} ${ele?.prizeType} `);
    }
    $.msg.push(`export M_FOLLOW_SHOP_ARGV="${$.activityUrl}"`);
}
$.start(Task)