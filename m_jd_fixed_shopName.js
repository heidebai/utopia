const {Env, redis} = require("./utopia");
const $ = new Env('M修复店铺名称')
$.concNum = 1
$.maxCookie = 1
$.fixedShopName = 1

class Task extends Env {
    constructor() {
        super();
    }

    async exec() {
        var shopList = await redis.hvals('VENDER_ID');
        for (const ele of shopList) {
            var e = JSON.parse(ele);
            if (!e.shopName) {
                this.log(e)
                await this.getShopInfo(e.venderId);
                await this.wait(1000, 3000)
            }
        }
        debugger
    }
}

$.start(Task)