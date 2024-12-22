// noinspection DuplicatedCode
let mode = __dirname.includes('Work')
const {Env, differenceInMinutes} = require('../utopia')
const $ = new Env('M分享有礼');
$.version = "v1.0.0"
$.activityUrl = decodeURIComponent(process.argv.splice(2)?.[0] || process.env.M_WX_SHARE_URL);
let leaders = []
//支持10068 10043
//超过这个人数的奖励不要了
let needMaxNum = $.getEnv("M_WX_SHARE_MAX_NEED_NUM", 200)
$.version = "v1.0.0"
if (mode) {
    $.activityUrl = `https://lzkj-isv.isvjcloud.com/prod/cc/interactsaas/index?activityType=10043&activityId=1810601812438388737&templateId=2023121110043fxyl01&nodeId=101001043&prd=cjwx`;
}


class Task extends Env {

    constructor() {
        super();
    }

    async getPrizeList(context) {
        if ($.isJinggengAct) {
            if ($.activityUrl.includes("loadBlindBox")) {
                $.prizeList = JSON.parse(context('#jdEquityList').attr("value"));
            } else {
                $.prizeList = JSON.parse(context('#awards', 'body').text());
            }
        } else if ($.isCommonAct) {
            $.prizeList = context.data.drawContentVOs || []
        } else if ($.isHdbAct) {
            let loadFrontAward = await this.api("/front/activity/loadFrontAward", {})
            if (loadFrontAward.succ) {
                $.prizeList = loadFrontAward.result || [];
            } else {
                this.log(loadFrontAward.message);
            }
        } else if ($.isV1Act) {
            let drawPrize = await this.api(
                ["10043"].includes($.activityType) ? '/api/prize/drawPrize' : '/api/task/inviteFollowShop/prizeList', {});
            $.prizeList = drawPrize.data.prizeInfo || []
            if (["10043"].includes($.activityType)) {
                if (!$.shareSuccessTimesList) {
                    let activityContent = await this.api('/api/task/sharePolitely/activity', {"shareUserId": ""});
                    $.shareSuccessTimesList = activityContent.data.shareSuccessTimesList
                }
                if ($.shareSuccessTimesList) {
                    for (let ele of $.prizeList) {
                        ele.shareTimes = $.shareSuccessTimesList.filter(o => o.prizeInfoId === ele.id)?.[0]?.successTimes || 0
                    }
                }
            }

        }
    }

    async exec() {
        if (!$.superVersion) {
            throw new Error('请更新脚本')
        }
        if (!$.activityId || !$.activityUrl) {
            this.log(`活动id不存在`);
            $.exit = true;
            return
        }

        await this.login()
        if (["10043"].includes($.activityType)) {
            if (this.currentHelpUser) {
                $.shareCodes.filter(o => this.currentHelpUser?.myUuid === o.myUuid).forEach(o => o.threadNum++)
                await this.api('/api/task/sharePolitely/activity', {"shareUserId": this.currentHelpUser?.myUuid || ""});
                let myself = await this.api('/api/task/bargain/guest/myself', {"shareUserId": this.currentHelpUser?.myUuid || ""})
                if (!myself.data) {
                    $.shareCodes.filter(o => this.currentHelpUser?.myUuid === o.myUuid).forEach(o => o.currentNum++)
                    this.log(`助力[${this.currentHelpUser.ptpin}]成功，已邀请${this.currentHelpUser.currentNum}人`)
                }
                if (!this.isMaster()) {
                    await this.runCachedForever()
                }
            }
            //处理组队信息
            if (this.isMaster()) {
                const {currentNum} = await this.rewardHandler(0)
                this.putMsg(`已邀请${currentNum}人`);
                let getUserId = await this.api('/api/task/share/getUserId', {})
                //分享参数
                let activityContent = await this.api('/api/task/sharePolitely/activity',
                    {"shareUserId": this.currentHelpUser?.myUuid || ""});
                //status：3=已领奖 2=领奖失败 //TODO 0=奖品已被领完
                for (let ele of this.filterPrizes()) {
                    let info = activityContent.data.shareSuccessTimesList.filter(o => o.prizeInfoId === ele.id)[0];
                    if (info.successTimes > needMaxNum) {
                        this.log(`${ele.prizeName} ${info.successTimes}>${needMaxNum} 排除`)
                        continue;
                    }
                    $.shareCodes.push({
                        ptpin: this.ptpin,
                        myUuid: getUserId.data.shareUserId,
                        needNum: info.successTimes,
                        threadNum: 0,
                        currentNum: currentNum,
                        drawInfoId: info.prizeInfoId,
                        drawCount: 0,
                        draw: info.status === 3,
                        loginTime: new Date(),
                        prizeName: ele.prizeName,
                        task: this
                    });
                    if (info.status === 3) {
                        this.putMsg(`${ele.prizeName},已领取`)
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
            return
        }
        if (["10068"].includes($.activityType)) {
            if (this.currentHelpUser) {
                $.shareCodes.filter(o => this.currentHelpUser?.myUuid === o.myUuid).forEach(o => o.threadNum++)
                let inviteFollow = await this.api('/api/task/inviteFollowShop/follow', {"shareUserId": this.currentHelpUser?.myUuid})
                if (inviteFollow.resp_code === 0 && inviteFollow.data?.flag) {
                    $.shareCodes.filter(o => this.currentHelpUser?.myUuid === o.myUuid).forEach(o => o.currentNum++)
                    this.log(
                        `👉 助力[${this.currentHelpUser.ptpin}]|已邀请${this.currentHelpUser.currentNum}人|共有${$.shareCodes.length}车头👈`)
                }
                if (!this.isMaster()) {
                    await this.runCached()
                }
            }

            //处理组队信息
            if (this.isMaster()) {
                const {currentNum} = await this.rewardHandler(0)
                let getUserId = await this.api('/api/task/share/getUserId', {})
                this.log(`已邀请${currentNum}人`)
                for (let ele of this.filterPrizes()) {
                    if (ele.days > needMaxNum) {
                        this.log(`${ele.prizeName} ${ele.days}>${needMaxNum} 排除`)
                        continue
                    }
                    $.shareCodes.push({
                        ptpin: this.ptpin,
                        myUuid: getUserId.data.shareUserId,
                        needNum: ele.days,
                        threadNum: 0,
                        currentNum: currentNum,
                        prizeName: ele.prizeName,
                        drawInfoId: ele.id,
                        drawCount: 0,
                        draw: false,
                        loginTime: new Date(),
                        task: this
                    });
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
            return
        }

        if ($.isHdbAct) {
            // 获取邀请记录
            const loadMyInviteLogs = await this.api("/front/activity/loadMyInviteLogs", {});
            if (!loadMyInviteLogs.succ) {
                this.putMsg(loadMyInviteLogs.message)
                return;
            }

            const loadMyInviteLogsResult = loadMyInviteLogs.result;
            const globalHelpNum = loadMyInviteLogsResult.total;
            this.putMsg(`已成功邀请 ${globalHelpNum} 人`);

            // 车头获取需要分享的人数
            if (this.isMaster()) {
                const loadShareSetting = await this.api("/front/activity/loadShareSetting", {});
                if (!loadShareSetting.succ) {
                    this.putMsg(loadShareSetting.message)
                    return;
                }

                const result = loadShareSetting.result?.fissionCouponSetting;
                const inviteConfigs = result.inviteConfigs;

                for (const element of inviteConfigs) {
                    await this.wait(1000, 1000);
                    // 所需人数
                    const helpNum = element.helpNum;
                    // 奖励明细
                    const award = element.award;

                    // 奖励名称
                    const awardName = award.awardName;

                    if (globalHelpNum >= helpNum) {
                        const postShareAward = await this.api("/front/activity/postShareAward", {"awardId": award.id});

                        if (!postShareAward.succ) {
                            this.putMsg(`${awardName} ${postShareAward.message}`);
                            continue;
                        }

                        const postShareAwardResult = postShareAward.result;
                        if (!postShareAwardResult.succ) {
                            const errorMsg = postShareAwardResult.errorMsg;
                            this.putMsg(`${awardName} ${errorMsg}`);
                        } else {
                            this.putMsg(`获得奖励：${postShareAwardResult.dmActivityLog.awardName}`);
                        }
                        continue;
                    }

                    const option = {
                        index: this.index, username: this.ptpin, token: this.isvToken, pin: this.Pin, friendUuid: $.aesBuyerNick, // 助力成功的次数
                        count: globalHelpNum || 0, // 需要助力的次数
                        needShareTimes: helpNum, draw: false, drawInfoId: award.id, drawName: award.awardName
                    };

                    // 需要，构建leader数据
                    leaders.push(option)
                }
                await this.reportActionLog({"actionType": "shareAct"});
            }

            // 筛选队长，需要助力次数 - 已经助力次数 大于 0 的
            let leader = leaders.filter(k => k.needShareTimes - k.count > 0)?.[0] || "";
            // if (this.index > leaderNum && !leader) {
            //     this.putMsg("全部完成")
            //     $.exit = true;
            //     return;
            // }

            // 此次需要助力的数量 > 剩余ck数 停车
            // 如果此次需要助力的数量 大于 允许的最大助力数量 停车
            if (leader.needShareTimes > $.cookies.length - this.index || leader.needShareTimes - leader.count > needMaxNum) {
                this.putMsg("ck不够了，停车")
                $.exit = true;
                return;
            }
            // ======================== 处理助力别人 ======================

            // 第一个ck不助力他人
            if (this.index === 1) {
                this.putMsg("ck1 不助力任何人")
                return;
            }

            if (leader.index === this.index) {
                this.putMsg("不能助力自己");
                return;
            }

            if (!leader) {
                return;
            }

            this.log(`本次助力对象：${leader.username} ${leader.drawInfoId}`);

            // 执行助力
            const postShareAward = await this.api("/front/activity/postShareAward", {"inviterNick": leader.friendUuid});
            if (postShareAward.succ) {
                const result = postShareAward.result;
                if (result?.succ) {
                    this.putMsg(`${result.errorMsg} 助力对象：${leader.username}`);
                    this.updateLeaders(leader.friendUuid, "incrementCount");
                }
            } else {
                this.putMsg(postShareAward.message)
            }

            let ts = leaders.filter(k => k.count >= k.needShareTimes && k.draw === false) || [];
            if (ts.length > 0) {
                let draw = ts?.[0];
                try {
                    $.cookie = $.cookies[draw.index - 1]
                    this.ptpin = decodeURIComponent($.cookie.match(/pt_pin=([^; ]+)(?=;?)/)[1]);
                    let token2 = await $.isvObfuscator();
                    if (token2.code !== '0') {
                        this.putMsg(`获取Token失败`);
                        return
                    }
                    this.isvToken = token2?.token
                    // 登录
                    await this.login();
                    const postShareAward = await this.api("/front/activity/postShareAward", {"awardId": draw.drawInfoId});
                    if (!postShareAward.succ) {
                        this.putMsg(postShareAward.message);
                        return;
                    }
                    const postShareAwardResult = postShareAward.result;
                    if (!postShareAwardResult.succ) {
                        const errorMsg = postShareAwardResult.errorMsg;
                        this.putMsg(`${draw.drawName} ${errorMsg}`);

                        if (errorMsg.match(/奖品已发完/)) {
                            return;
                        }
                    } else {
                        this.putMsg(postShareAwardResult.dmActivityLog.awardName);
                        this.updateLeaders(leader.friendUuid, "draw", leader.drawInfoId);
                    }
                } catch (e) {
                    this.log(e)
                }
            }

            return;
        }

        if (leaders.length > 0 && leaders.filter((obj, index, self) => index === self.findIndex((t) => (t.index === obj.index))).length
            === $.masterNum && leaders.filter(o => !(k.count < k.needShareTimes)).length === 0) {
            this.putMsg("全部完成");
            $.exit = true;
            return
        }

        //筛选队长
        this.helpShareUserId = this.randomArray(leaders.filter(k => k.count < k.needShareTimes).slice(0, $.maxHelpNum || 1))?.[0]?.myUuid
            || ""

        //分享参数
        let activityContent = await this.api('wxShareActivity/activityContent',
            `activityId=${$.activityId}&pin=${this.Pin}&friendUuid=${this.helpShareUserId}`);
        if (!activityContent.result || !activityContent.data) {
            this.putMsg(activityContent.errorMessage)
            return
        }
        if (this.helpShareUserId) {
            leaders.filter(k => k.myUuid === this.helpShareUserId).forEach(o => o.count++)
        }
        $.rule = activityContent.data.rule;
        await this.checkActivity(activityContent)

        let filter = $.prizeList.filter(
            o => [6, 7, 9, 13, 14, 15, 16].includes(o.type) && [0, 1, 2, 4].includes(o.linkStatus) && o.shareTimes <= needMaxNum);

        if ($.prizeList.filter(o => o.linkStatus === 3).length === $.prizeList.length || filter.length) {
            $.exit = true;
            this.putMsg("奖品已领完");
            return;
        }
        //处理组队信息
        if (this.isMaster()) {
            this.putMsg("队长");
            // linkStatus 0 可以分享
            // linkStatus 1 可以领取
            // linkStatus 2 已经领取
            // linkStatus 3 已经被领光
            // linkStatus 4 未中奖

            for (let ele of filter || []) {
                if (ele.linkStatus === 2) {
                    this.putMsg("已领过" + ele.name)
                    continue
                }
                leaders.push({
                    index: this.index,
                    token: this.isvToken,
                    username: this.ptpin,
                    pin: this.Pin,
                    myUuid: activityContent.data.myUuid,
                    needShareTimes: ele.shareTimes,
                    count: ele.linkStatus === 1 ? ele.shareTimes  : 0,
                    draw: false,
                    drawCount: 0,
                    drawInfoId: ele.drawInfoId
                })
            }
        }
        let ts = leaders.filter(k => k.needShareTimes <= k.count && k.draw === false);
        if (ts.length > 0) {
            for (let t of ts) {
                await this.drawPrize(t)
            }
        }
    }

    async rewardHandler(type = 0) {
        if (["10043", "10068"].includes($.activityType)) {
            do {
                if (type === 1) {
                    await this.wait(5000, 15000)
                }
                let {data} = await this.api(
                    ["10043"].includes($.activityType) ? '/api/task/share/friends' : '/api/task/inviteFollowShop/getInviteInfo', {})
                let currentNum = data?.num || data?.shareNum || 0;
                for (let ele of $.shareCodes.filter(o => o.ptpin === this.ptpin)) {
                    ele.currentNum = currentNum;
                    this.log(`[${type}] 矫正数量 ${ele.currentNum}`)
                }
                let rewardInfoList = $.shareCodes.filter(
                    o => o.ptpin === this.ptpin && o.currentNum >= o.needNum && !o.draw && o.drawCount < 3);

                for (let t of rewardInfoList) {
                    if(["10043"].includes($.activityType)){
                        await this.api('/api/task/sharePolitely/activity', {"shareUserId": t?.myUuid || ""});
                    }
                    let acquire = await this.api('/api/prize/receive/acquire', {"prizeInfoId": t.drawInfoId, "status": 1})
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

    /**
     * 更新leader数组
     * friendUuid
     * operation 类型
     * incrementCount 助力数量++
     * draw 是否抽奖
     */
    updateLeaders(friendUuid, operation, drawInfoId = 0) {
        for (let i = 0; i < leaders.length; i++) {
            const element = leaders[i];
            if (element.friendUuid === friendUuid) {
                if (operation === "draw" && leaders[i].drawInfoId == drawInfoId) {
                    leaders[i].draw = true;
                } else if (operation === "incrementCount") {
                    leaders[i].count++;
                }
            }
        }
    }

    async drawPrize(t, count = 0) {
        let drawInfoId = t.drawInfoId

        this.cookie = t.cookie;
        this.ptpin = t.username;
        this.index = t.index;
        let key = `${this.activityId}:${this.helpShareUserId}:${drawInfoId}`;
        let exits = await this.rget(key)
        if (exits) {
            this.log("已经领过了")
        }
        let prize = await this.api('wxShareActivity/getPrize', `activityId=${$.activityId}&pin=${this.Pin}&drawInfoId=${drawInfoId}`);
        console.log(prize)
        if (prize.result && prize.data && prize.data.drawOk) {
            this.putMsg(prize.data.name)
            await this.rset(key, drawInfoId)

            if (prize.data.needWriteAddress === 'y' && prize.data.drawInfoType === 7) {
                //自动填地址
                this.addressId = prize.data.addressId;
                this.prizeName = prize.data.name
                await this.saveAddress();
            }
            leaders.filter(k => k.needShareTimes === k.count && k.draw === false)[0].draw = true
        } else {
            if (prize.errorMessage.includes("您已领取") && count === 0) {
                await this.rset(key, drawInfoId)
                //递归
                leaders.filter(k => k.needShareTimes === k.count && k.draw === false)[0].draw = true
            } else if (prize.errorMessage.includes("奖品已发完") && count === 0) {
                //发完了
                leaders.filter(k => k.drawInfoId === drawInfoId).forEach(o => o.draw = true)
                leaders.filter(k => k.drawInfoId === drawInfoId).forEach(o => o.count = 999)
                this.putMsg(prize.errorMessage);
                await this.wxStop(prize.errorMessage)
            }

        }
    }
}

let typeObj = {
    '20': '优惠券',
    '2': '流量包',
    '4': '再来一次',
    '6': '京豆',
    '7': '实物',
    '8': '专享价',
    '9': '积分',
    '13': '京东E卡',
    '14': '爱奇艺会员',
    '15': 'PLUS会员'
}

$.after = async function () {
    try {
        if ($.isHdbAct) {
            const loadShareSetting = await this.api("/front/activity/loadShareSetting", {});
            if (!loadShareSetting.succ) {
                this.putMsg(loadShareSetting.message)
            } else {
                const result = loadShareSetting.result?.fissionCouponSetting;
                for (let ele of result.inviteConfigs) {
                    $.msg.push(`${ele?.helpNum || 0}人，${ele?.award.awardName}`);
                }
            }
        } else {
            for (let ele of $.prizeList) {
                if (["10043", "10068"].includes($.activityType)) {
                    $.msg.push(`    ${ele?.shareTimes || ele?.days || 0}人, ${ele?.prizeName}，剩${ele?.leftNum}份`);
                } else {
                    $.msg.push(`    ${ele?.shareTimes || 0}人，${ele?.name}，共${ele?.prizeNum}份`);
                }
            }
        }
    } catch (e) {
        console.log(e)
    }
    $.msg.push(`#M_WX_SHARE_URL`);
    $.msg.push(`export M_WX_SHARE_URL="${$.activityUrl}"`);
}

$.start(Task)