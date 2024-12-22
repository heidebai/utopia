let mode = __dirname.includes('Work')
const {Env, cheerio} = require('../utopia')
const $ = new Env('M每日领奖');
$.activityUrl = decodeURIComponent(process.argv.splice(2)?.[0] || process.env.M_WX_DAILY_GIFT_URL)

if (mode) {
    $.activityUrl = 'https://jingyun-rc.isvjcloud.com/h5/pages/dailyLimitedTimeGrab/default?id=9d2e56ec7cef213a10b699c5bdbe8c19&userId=803140'
    $.activityUrl = 'https://lzkj-isv.isvjcloud.com/prod/cc/interaction/v1/index?activityType=10022&activityId=1750414298828566529&templateId=20210518190900mrqhl01&nodeId=101001&prd=crm'
    $.activityUrl = 'https://lzkj-isv.isvjcloud.com/prod/cc/interactsaas/index?activityType=10022&templateId=20210518190900mrqhl011&activityId=1830125193311625217&nodeId=101001&prd=cjwx&shopid=1000092208'
    $.activityUrl = 'https://lzkj-isv.isvjcloud.com/prod/cc/interaction/v2/10022/1001/?activityId=1829043936135667713&shopId=1000002836'
    $.cookieTypes=['ql']
    $.concNum=1
}
$.version = "v1.0.0"
let reqData = ""

class Task extends Env {
    constructor() {
        super();
    }

    async getPrizeList(){
        $.prizeList = []
    }

    async exec() {

        if (!$.superVersion) {
            throw new Error('请更新脚本')
        }
        if (!$.activityId || !$.activityUrl) {
            $.exit = true;
            this.putMsg(`activityId|activityUrl不存在`);
            return
        }
        await this.login()
        if (!reqData) {
            try {
                let page = "indexPage"
                if ($.activityUrl.includes("indexPage1")) {
                    page = "indexPage1"
                }
                let doc = await this.api(`activity/daily/wx/${page}`, `activityId=${$.activityId}`);
                const $2 = cheerio.load(cheerio.load(doc).html())
                $.actTimeStr = $2('#actTimeStr', 'body').attr("value")
                $.rule = $2('#rule', 'body').attr("value")
                $.gift = JSON.parse($2('#giftJson', 'body').attr("value"))
                $.prizeName = $.gift?.gift?.giftName
                $.prizeType = $.gift?.gift?.giftType
                $.totalQuantity = $.gift.total
                $.winNumber = $2('#winNumber', 'body').attr("value")
                $.shopId = $2('#userId', 'body').attr("value")
                $.venderId = $2('#venderId', 'body').attr("value")
                await this.actTimeParser()
                let time = $.match(/(\d+点\d+分)/, $.rule)
                $.dailyTime = time.replace("点", ":").replace("分", "")
                if ($.shopId === '1000001195') {
                    $.dailyTime = '10:00'
                }
                if (![6, 7, 9, 13, 14, 15, 16].includes($.gift.gift.giftType * 1)) {
                    this.putMsg("垃圾或领完");
                    $.exit = true;
                    return;
                }
            } catch (e) {
                this.log(e)
                $.exit = true;
                return
            }
        }

        if (Date.now() < $.actStartTime) {
            this.putMsg("活动未开始");
            $.exit = true;
            return
        }
        if (Date.now() > $.actEndTime + 2000) {
            this.putMsg("活动已结束");
            $.exit = true;
            return
        }

        let prize = await this.api('activity/daily/wx/grabGift', `actId=${$.activityId}&pin=${this.Pin}`);
        if (prize.isOk && prize.gift != null) {
            this.putMsg(prize.gift.gift.giftName);
            if (prize.gift.gift.giftType === 7) {
                this.addressId = prize.addressId;
                this.prizeName = prize.gift.gift.giftName;
                await this.saveAddress()
            }
        } else {
            if (/(未开始|有效期|抢光|结束|非法操作)/.test(prize.msg)) {
                this.super.exit = true;
            }
            if (/(会员参与|只能参加一次|不符合活动要求)/.test(prize.msg)) {
                await this.runCached();
            }
            if (/(成功参与一次|领取过)/.test(prize.msg)) {
                await this.runCachedForever();
            }
        }
    }

}

$.after = async function () {
    try {
        $.msg.push(`    每日开抢:${$.dailyTime||''}`);
        $.msg.push(`    奖品:${$.prizeName||''} 每日${$.dayQuantity || 0}份 共${$.totalQuantity || 0}份 ${$.prizeType || ""}`);
    } catch (e) {
        console.log(e)
    }
    $.msg.push(`export M_WX_DAILY_GIFT_URL="${$.activityUrl}"`);
}

$.start(Task)