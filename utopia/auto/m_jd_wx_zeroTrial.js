let mode = __dirname.includes('magic')
const {Env} = require('../utopia')
const $ = new Env('M试用有礼');
$.activityUrl = decodeURIComponent(process.argv.splice(2)?.[0] || process.env.M_WX_ZEROTRIAL_URL);
$.concNum = 1
if (mode) {
    $.activityUrl = 'https://cjhy-isv.isvjcloud.com/mc/zeroTrialView/wx/activity/forC/indexPage?venderId=1000007543&activityId=0c3c077c5c3d417fa803776b8cdb8174'
    $.cookieTypes = ['ql']
    $.concNum = 1
}
$.version = "v1.0.0"

class Task extends Env {

    constructor(data) {
        super();
    }

    async getPrizeList(context) {
        if (this.isCommonAct) {
            let content = await this.api(`mc/zeroTrial/wx/getActivityContent?activityId=${$.activityId}&pin=${this.Pin}`);
            $.prizeList = content.data.zeroTrialGoodsOutVOList || [];
            $.actStartTime = content.data.startTime;
            $.actEndTime = content.data.endTime;
            return
        }
        if (this.isV1Act) {

        }
    }

    async exec() {
        if (!$.superVersion) {
            throw new Error('请更新脚本')
        }
        if (!$.activityId || !$.activityUrl) {
            $.log(`活动id不存在`);
            $.exit = true;
            return
        }
        await this.login()
            if ($.prizeList.length !== 0) {
            $.concNum = this.getEnv('M_CONC_LIMIT')
        }

        if ($.prizeList.length > 0) {
            let prize = $.prizeList[$.random(0, $.prizeList.length - 1)];
            let applyTrial = await this.api(`mc/zeroTrial/wx/applyTrial`,
                `activityId=${$.activityId}&pin=${this.Pin}&goodsId=${prize.goodsId}&venderId=${$.venderId}&nickName=${encodeURIComponent(
                    this.nickname)}`);
            if (applyTrial.result) {
                this.putMsg(prize.name);
                this.addressId = applyTrial.data;
                this.prizeName = prize.name;
                await this.saveAddress();
            }
        } else {
            $.putMsg(`未获取到试用品`);
            $.exit = true;
        }
    }

}

$.after = async () => {
    for (let prize of $.prizeList) {
        $.msg.push(`${prize.name}，${prize.price}元，共${prize.sendNum}份`);
    }
    $.msg.push(`export M_WX_ZEROTRIAL_URL="${$.activityUrl}"`);
}
$.start(Task)