let mode = __dirname.includes('Work')
const {Env} = require('./utopia')
const $ = new Env('M双旦活动');
if (mode) {
    $.concNum = 1
    $.cookieTypes = ['master']
    $.ptpins = ['f121511']

}
$.activityUrl = 'https://mpdz-act-dz.isvjcloud.com/jdbeverage/pages/JDShuangdan/JDShuangdan?_ts=1734588791928&utm_user=plusmember&gx=RnAowm9RbjPcyZgXrIQYHUfB-tE&gxd=RnAolTRePTXdypAXr4B3VLiViYKngSs&ad_od=share&utm_source=androidapp&utm_medium=appshare&utm_campaign=t_335139774&utm_term=Wxfriends_shareidfc7e141820409d65173458879580325361_none_none'
$.version = "v1.0.0"
let url_path = "JdNewYear1216"
$.shopId = 1000000157
$.activityId = 'jd_new_year_1216'
//$.enableMasterPtpins = ['jd_GqmOpcxSSmVF']
let codes = []

class Task extends Env {
    constructor() {

        super();

    }

    async completeMission(missionType, params) {
        let body = {
            "method": `/${url_path}/mission/completeMission`,
            "missionType": missionType,
            'shopId': $.userId,
            "inviteNick": (this.shareUuid || "")
        };
        Object.assign(body, params);
        let {data} = await this.api(`/dm/front/${url_path}/mission/completeMission?open_id=&mix_nick=${this.buyerNick
            || ""}&user_id=10299171`,
            body);
        data?.data?.remark && this.log(missionType, data?.data?.remark)
        if(/(活动太火爆，还是去买买买吧)/.test(data?.data?.remark)){
            await this.runCachedForever()
        }
    }

    async exec() {
        await this.isvObfuscator();
        $.userId = 10299171
        let {data: load} = await this.api(`dm/front/${url_path}/activity/load?open_id=&mix_nick=${this.isvToken}&user_id=10299171`,
            {"jdToken": this.isvToken, "method": `/${url_path}/activity/load`, "source": "01", "inviteNick": (this.shareUuid || "")});
        this.buyerNick = load.data.missionCustomer.buyerNick || '';
        if (this.isMaster()) {
            codes.push(this.buyerNick)
        }else {
            $.concNum = 50
        }
        this.shareUuid = this.randomArray(codes, 1)[0]
        let result = await this.api(
            `dm/front/${url_path}/mission/completeState?open_id=&mix_nick=${this.buyerNick || ""}&user_id=10299171`,
            {"missionType": "shareAct", "inviterNick": (this.shareUuid || "")});
        let data = result?.data?.data || {};

        for (let task of data.filter(o => !o.isComplete)) {
            if (['exclusiveAddCart', 'orderdisposable', 'fullAmount', 'evaluate',
                'payAnyBox', 'payAnyNew', 'payTrade', 'firstBuy', 'shareAct',
                'shareOrder', 'openCard', 'exclusivePlaceAnOrder', 'exclusiveCombinationOrder'].includes(task?.type)) {
                continue
            }
            this.log(task?.type, task.missionName)
            if (['collectShop'].includes(task?.type)) {
                let shopList = await this.api(
                    `dm/front/${url_path}/shop/shopList?open_id=&mix_nick=${this.buyerNick || ""}&user_id=10299171`,
                    {"method": `/${url_path}/shop/shopList`});
                for (let shop of shopList.data.data.filter(o => !o.hasCollect)) {
                    await this.completeMission(task?.type, {shopId: shop.shopId});
                    await this.wait(1000, 2000)

                }
                continue
            }
            if (['addCart'].includes(task?.type)) {
                let shopProductLoadList = await this.api(
                    `dm/front/${url_path}/shop/shopProductLoad?open_id=&mix_nick=${this.buyerNick || ""}&user_id=10299171`,
                    {"method": `/${url_path}/shop/shopProductLoad`});
                for (let shop of shopProductLoadList.data.data) {
                    for (let ele of shop.productList) {
                        await this.completeMission(task?.type, {goodsNumId: ele.numId});
                        await this.wait(1000, 2000)

                    }
                }
                continue
            }
            if (['viewTimes'].includes(task?.type)) {
                let viewShopList = await this.api(
                    `dm/front/${url_path}/shop/viewShopList?open_id=&mix_nick=${this.buyerNick || ""}&user_id=10299171`,
                    {"method": `/${url_path}/shop/viewShopList`});
                for (let shop of viewShopList.data.data.filter(o => !o.hasView)) {
                    await this.completeMission(task?.type, {shopId: shop.shopId});
                    await this.wait(1000, 2000)

                }
                continue
            }
            if (['openCard'].includes(task?.type)) {
                let shopList = await this.api(
                    `dm/front/${url_path}/shop/shopList?open_id=&mix_nick=${this.buyerNick || ""}&user_id=10299171`,
                    {"method": `/${url_path}/shop/shopList`});
                let shops = shopList.data.data.filter(o => !o.open);
                for (let i = 0; i < shops.length; i++) {
                    this.isMember = false;
                    let shop = shops[i];
                    let venderId = shop.userId
                    await this.api(
                        `/dm/front/${url_path}/mission/completeMission?open_id=&mix_nick=${this.buyerNick || ""}&user_id=10299171`,
                        {"method": `/${url_path}/mission/completeMission`, "missionType": "openCard", "shopId": venderId});
                    await this.openCard(venderId);
                    if (!this.isMember) {
                        continue
                    }
                    let {data: opendata} = await this.api(
                        `dm/front/${url_path}/activity/load?open_id=&mix_nick=${this.isvToken}&user_id=10299171`,
                        {"jdToken": this.isvToken, "source": "01", "inviteNick": (this.shareUuid || ""), "shopId": venderId});
                    const {openCardMsg, openCardStatus} = opendata.data
                    this.log(openCardMsg)
                }
            } else {
                await this.completeMission(task?.type);
            }
        }

        let {data: load2} = await this.api(`dm/front/${url_path}/activity/load?open_id=&mix_nick=${this.isvToken}&user_id=10299171`,
            {"jdToken": this.isvToken, "source": "01", "inviteNick": (this.shareUuid || "")});
        let {totalChance, usedChance, remainChance,totalPoint, remainPoint} = load2.data.missionCustomer;
        if (totalPoint > 20) {
            await this.runCached()
        }
        for (let i = 0; i < remainPoint; i++) {
            let {data} = await this.api(
                `dm/front/${url_path}/interactive/drawPost?open_id=&mix_nick=${this.buyerNick || ""}&user_id=10299171`,
                {
                    "method": `/${url_path}/interactive/drawPost`,
                    'shopId': $.userId
                });
            if (data.data.sendResult) {
                this.log(data.data.awardSetting)
            }
            await this.wait(5000, 6000)
        }
    }
}

$.start(Task)