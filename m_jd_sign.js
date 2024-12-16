//30 8,12,22,23 * * *
const {Env,redis} = require('./utopia');
const $ = new Env('M京东签到')
$.version = "v1.0.0"
$.cookieTypes = $.cookieTypes || ["master", "ql", "redis", 'hot']
$.origin="https://pro.m.jd.com"
$.referer="https://pro.m.jd.com/mall/active/"
$.algoUrl="https://pro.m.jd.com/mall/active/"
$.h5stType = "test"
class Task extends Env {
    constructor() {
        super();
    }
    async exec () {
        let url = `https://api.m.jd.com/client.action`
        let {data} = await this.api(url, {
            appId: '9d49c',
            functionId: 'signBeanAct',
            appid: 'signed_wh5_ihub',
            clientVersion: '1.0.0',
            client: 'H5',
            body: {},
            version: '4.7',
            ua: this.UA,
            t: true,
        }, {h5st: true,proxy:true});
        //this.log(data)
        if (data?.status === '2' || data?.errorCode==="S100") {
            await this.runCached()
        }
        if(data?.newUserAward){
            this.log(data.newUserAward.awardList[data.newUserAward.continueDays-1].beanCount+"京豆")
            await this.runCached()
            return
        }

        let title = data?.dailyAward?.title
            || data?.continuityAward?.title;
        let bean = data?.dailyAward?.beanAward?.beanCount
            || data?.continuityAward?.beanAward?.beanCount;
        if (bean) {
            await this.runCached()
            this.putMsg(`${title || ''} 获得${bean || ''}京豆`)
        }
    }
}


$.start(Task)