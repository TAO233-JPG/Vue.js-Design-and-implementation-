import { flushJob, jobQueue } from "./flushjob.js";

import { effect, trigger, track } from "./effect.js";

export const INERATE_KEY = Symbol("INERATE_KEY");
export const RAW = Symbol("RAW");

const createReactive = (target, isShallow = false, isReadonly = false) => {
  return new Proxy(target, {
    get(target, key, receiver) {
      // 内部属性 RAW, 获取原本的对象
      if (key === RAW) {
        return target;
      }

      const v = Reflect.get(target, key, receiver);

      // 只读数据，不需要依赖收集
      if (!isReadonly) {
        track(target, key);
      }

      // 浅层响应
      if (isShallow) {
        return v;
      }

      if (typeof v === "object" && v !== null) {
        // 深层只读 和 深层响应
        return isReadonly ? readonly(v) : reactive(v);
      }

      return v;
    },
    set(target, key, newVal, receiver) {
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }
      const oldVal = target[key];
      const triggerType = Object.prototype.hasOwnProperty.call(target, key)
        ? "SET"
        : "ADD";
      const v = Reflect.set(target, key, newVal, receiver);
      // receiver 是 target 的代理对象
      if (receiver[RAW] === target) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, triggerType);
        }
      }
      return v;
    },
    // 拦截 delete
    deleteProperty(target, key) {
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }
      const had = Object.prototype.hasOwnProperty.call(target, key);
      const v = Reflect.deleteProperty(target, key);
      if (had && v) {
        trigger(target, key, "DELETE");
      }
      return v;
    },

    // 拦截 in 操作符
    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },

    // 拦截 for...in
    // 在 trigger 中会取与 INERATE_KEY 相关连的 effectfn 执行
    ownKeys(target) {
      track(target, INERATE_KEY);
      return Reflect.ownKeys(target);
    },
  });
};

function reactive(target) {
  return createReactive(target);
}
function shallowReactive(target) {
  return createReactive(target, true);
}
function readonly(target) {
  return createReactive(target, false, true);
}

const obj = {
  foo: 1,
  box: {
    name: "box-1",
    total: 3,
  },
};
const proxyObj = reactive(obj);
const shallowObj = shallowReactive(obj);
const readonlyObj = readonly(obj);

// effect(() => {
//   for (let k in proxyObj) {
//   }
//   console.log("for in");
// });

// proxyObj.foo += 2;

// proxyObj.newk = 1;

/* proxyObj */
// effect(() => {
//   console.log(proxyObj.box.total);
// });
// proxyObj.box.total += 2;

/* shallowObj */
// effect(() => {
//   console.log(shallowObj.box.total);
// });
// shallowObj.box.total += 2;

/* readonlyObj */
// effect(() => {
//   console.log(readonlyObj.box.total);
// });

// readonlyObj.box.total += 2;
