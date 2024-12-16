let mode = __dirname.includes('Work')
const {Env, differenceInMinutes} = require('../utopia')
const $ = new Env('M邀请有礼INTERACT');
$.activityUrl = decodeURIComponent(process.argv.splice(2)?.[0] || process.env.M_INTERACT_INVITE_URL);
//这些关键词奖励不要
$.version = "v1.0.0"
// 超过这个人数就不要了
let needMaxNum = $.getEnv("M_INTERACT_INVITE_MAX_NEED_NUM", 200)
$.cookieTypes = $.cookieTypes || ['master', 'ql', 'redis', "liang", 'merge', 'tck']
$.maxCookie = 3000
if (mode) {
    $.activityUrl = 'https://lzkj-isv.isvjcloud.com/prod/cc/interactsaas/index?activityType=10070&activityId=1806524398561849346&templateId=7fab7995-298c-44a1-af5a-f79c520fa8a888&nodeId=101001&prd=cjwx'
    $.masterNum =2
    $.cookieTypes = ['ql','tck']
}


class Task extends Env {
    constructor() {
        super();
    }

    async getPrizeList() {

        let drawPrize = await this.api('/api/task/member/prizeList', {})
        if (drawPrize.resp_code !== 0) {
            this.putMsg(`获取活动信息失败`);
            return
        }
        $.prizeList = drawPrize.data.prizeInfo
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
        if (this.currentHelpUser) {
            $.shareCodes.filter(o => this.currentHelpUser?.inviterCode === o.inviterCode).forEach(o => o.threadNum++)
        }
        if (!this.isMember) {
            await this.openCard();
        }
        if (!this.isMaster() && !this.isNewMember) {
            return
        }
        if (this.isMaster() && this.isNewMember) {
            await this.login()
        }
        let getMember = await this.api('/api/task/member/getMember', {"shareUserId": this.currentHelpUser?.inviterCode || ''})
        if (this.currentHelpUser && this.isNewMember) {
            let myself = await this.api('/api/task/bargain/guest/myself', {"shareUserId": this.currentHelpUser?.inviterCode || ''});
            if (getMember.data && getMember?.data?.isSuccess === 1) {
                $.shareCodes.filter(o => this.currentHelpUser?.inviterCode === o.inviterCode).forEach(o => o.currentNum++)
                this.log(`助力[${this.currentHelpUser.ptpin}]成功，已邀请${this.currentHelpUser.currentNum}人`)
            }
            if (!this.isMaster()) {
                await this.runCachedForever()
            }
        }
        if (this.isMaster()) {
            let getUserId = await this.api('/api/task/share/getUserId', {"shareUserId": this.currentHelpUser?.inviterCode || ''})
            let receivePrizeRep = await this.api('/api/prize/receive/list', {"shareUserId": this.currentHelpUser?.inviterCode || ''})
            let receivePrizes = receivePrizeRep.data.receivePrizes
            let once = false
            if (/(活动期间只可领取一次获奖门槛对应的奖励)/.test($.rule) || /(戴森)/.test(this.super.shopName)) {
                once = true
            }
            this.putMsg(`已邀请${getMember.data.shareUser}人`);
            for (let ele of $.prizeList.reverse() || []) {
                if (ele.days > needMaxNum) {
                    this.log(`${ele.prizeName} ${ele.days}>${needMaxNum} 排除`)
                    continue;
                }
                if (once) {
                    if (/(积分)/.test(ele.prizeName)) {
                        continue
                    }
                }
                $.shareCodes.push({
                    ptpin: this.ptpin,
                    prizeName: ele.prizeName,
                    prizeInfoId: ele.id,
                    inviterCode: getUserId.data.shareUserId,
                    needNum: ele.days,
                    threadNum: 0,
                    drawCount: 0,
                    currentNum: getMember.data.shareUser,
                    draw: false,
                    loginTime: new Date(),
                    task: this
                })
                if (once) {
                    break
                }
            }
            if ($.shareCodes.length === 0) {
                this.putMsg("没有符合的奖励")
                this.exit = true
                return
            }
        }

        let reward = $.randomArray($.shareCodes.filter(o => o.currentNum >= o.needNum && !o.draw && o.drawCount < 3))?.[0] || ""
        if (reward) {
            this.log(`✅${reward.ptpin} 去领奖`)
            if (Math.abs(differenceInMinutes(reward.loginTime, new Date())) > 1) {
                await reward.task.login()
                //刷新时间
                $.shareCodes.filter(o => reward.ptpin === o.ptpin).forEach(o => o.loginTime = new Date());
            }
            await reward.task.rewardHandler(2)
        }

    }

    async rewardHandler(type = 0) {
        if (["10070", "10068"].includes($.activityType)) {
            do {
                if (type === 1) {
                    await this.wait(5000, 15000)
                }
                let {data} = await this.api('/api/task/member/getMember', {"shareUserId": ''})
                let currentNum = data.shareUser || 0;
                for (let ele of $.shareCodes.filter(o => o.ptpin === this.ptpin)) {
                    ele.currentNum = currentNum;
                    this.log(`[${type}] 矫正数量 ${ele.currentNum}`)
                }

                let rewardInfoList = $.shareCodes.filter(
                    o => o.ptpin === this.ptpin && o.currentNum >= o.needNum && !o.draw && o.drawCount < 3);
                for (let t of rewardInfoList) {
                    let acquire = await this.api('/api/prize/receive/acquire', {"prizeInfoId": t.prizeInfoId})
                    if (acquire.resp_code === 0) {
                        if (!acquire.data.result) {
                            this.putMsg("#不给奖励,大概黑了")
                            $.shareCodes.filter(o => o.ptpin === this.ptpin).forEach(o => o.draw = true);
                            break
                        }
                        this.putMsg(`${t.prizeName},领取成功`)
                        if (acquire.data.prizeType == 3) {
                            this.addressId = acquire.data.addressId;
                            this.prizeName = acquire.data.prizeName;
                            await this.saveAddress()
                        }
                        if (acquire.data.prizeType == 7) {
                            this.putMsg(JSON.parse(acquire.data?.prizeJson || {})?.cardNumber || "")
                        }
                        t.draw = true
                    } else {
                        if (/(权限不足|已领取)/.test(acquire.resp_msg)) {
                            this.putMsg(`${t.prizeName},${acquire.resp_msg}`);
                            t.draw = true
                        } else {
                            this.putMsg(acquire.resp_msg);
                            ++t.drawCount;
                            t.draw = t.drawCount === 3
                        }
                    }
                }
                if (!type) {
                    return {currentNum};
                }
                if ($.shareCodes.filter(
                    o => o.ptpin === this.ptpin && o.currentNum >= currentNum).length === $.shareCodes.filter(
                    o => o.ptpin === this.ptpin && o.draw).length) {
                    break
                }
            } while (type === 1)
        }
    }
}

$.after = async function () {
    for (let ele of $.prizeList?.reverse() || []) {
        $.msg.push(`  邀请${ele.days}人 ${ele.prizeName} 共${ele.leftNum}/${ele.allNum}份`)
    }
    $.msg.push("#M_INTERACT_INVITE_URL")
    $.msg.push(`export M_INTERACT_INVITE_URL="${$.activityUrl}"`);
}

$.start(Task)