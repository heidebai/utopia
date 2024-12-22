const {Env, redis} = require("./utopia");
const $ = new Env('M缓存清理')
$.concNum = 1
$.maxCookie = 1

class Task extends Env {
    constructor() {
        super();
    }

    async exec() {
        for (let x of ["magic:m_jd_*","magic:HOT_KEY*"]) {
            let keys = await redis.keys(x);
            if (!keys.length) {
                continue
            }
            const newKeys= keys.map((str) => {
                const prefix = "magic:";
                if (str.startsWith(prefix)) {
                    return str.slice(prefix.length);
                }
                return str;
            });
            await redis.del(newKeys)
        }

    }
}

$.start(Task)