import { flushJob, jobQueue } from "./flushjob.js";

import { effect, trigger, track } from "./effect.js";

export const INERATE_KEY = Symbol("INERATE_KEY");
export const MAP_KEY_INERATE_KEY = Symbol("MAP_KEY_INERATE_KEY");
export const RAW = Symbol("RAW");

const arrayInstrumentations = {};
// 数组查找方法重写，确保查找方法可以正确执行
// 先在代理对象查找，再在原本对象找
["includes", "indexOf", "lastIndexOf"].forEach((method) => {
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function (...args) {
    // this 是代理对象
    const res =
      originMethod.apply(this, args) || originMethod.apply(this[RAW], args);
    return res;
  };
});

export let shouldTrack = true;
// 在这些方法执行时，屏蔽掉对length跟踪，取消track
["push", "pop", "shift", "unshift", "splice"].forEach((method) => {
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function (...args) {
    shouldTrack = false;
    const res = originMethod.apply(this, args);
    shouldTrack = true;
    return res;
  };
});

const createReactive = (target, isShallow = false, isReadonly = false) => {
  return new Proxy(target, {
    get(target, key, receiver) {
      // 内部属性 RAW, 获取原本的对象
      if (key === RAW) {
        return target;
      }

      // 拦截数组方法
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      console.log("-get", key);
      const v = Reflect.get(target, key, receiver);

      // 只读数据，不需要依赖收集
      if (!isReadonly || typeof key !== "symbol") {
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
      console.log("+set", key);
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }
      const oldVal = target[key];
      const triggerType = Array.isArray
        ? Number(key) < target.length
          ? "SET"
          : "ADD"
        : Object.prototype.hasOwnProperty.call(target, key)
        ? "SET"
        : "ADD";
      const v = Reflect.set(target, key, newVal, receiver);
      // receiver 是 target 的代理对象
      if (receiver[RAW] === target) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, triggerType, newVal);
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
      track(target, Array.isArray(target) ? "length" : INERATE_KEY);
      return Reflect.ownKeys(target);
    },
  });
};

const reactiveMap = new Map();
function reactive(target) {
  if (reactiveMap.has(target)) return reactiveMap.get(target);

  const proxy = createReactive(target);
  reactiveMap.set(target, proxy);
  return proxy;
}
function shallowReactive(target) {
  return createReactive(target, true);
}
function readonly(target) {
  return createReactive(target, false, true);
}

// 扩展集合类型数据的方法
function iteratorMethod() {
  const raw = this[RAW];
  const itr = raw[Symbol.iterator]();
  const wrap = (v) => (typeof v === "object" ? reactive(v) : v);
  track(raw, INERATE_KEY);
  return {
    next() {
      const { value, done } = itr.next();
      return {
        value: value ? [wrap(value[0]), wrap(value[1])] : value,
        done,
      };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}
const mutableInstrumentations = {
  get(key) {
    const raw = this[RAW];
    const had = raw.get(key);
    track(raw, key);
    if (had) {
      const res = raw.get(key);
      return typeof res === "object" ? reactive(res) : res;
    }
  },
  set(key, value) {
    const raw = this[RAW];
    const had = raw.has(key);
    const oldValue = raw.get(key);
    raw.set(key, value[RAW] ?? value);
    if (!had) {
      trigger(target, key, "ADD");
    } else if (
      oldValue !== value &&
      (oldValue == oldValue || value === value)
    ) {
      trigger(raw, key, "SET");
    }
  },
  add(key) {
    const raw = this[RAW];
    const had = raw.has(key);
    const res = raw.add(key);
    !had && trigger(this[RAW], key, "ADD");
    return res;
  },
  delete(key) {
    const raw = this[RAW];
    const had = raw.has(key);
    const res = raw.delete(key);
    had && trigger(this[RAW], key, "DELETE");
    return res;
  },

  forEach(cb, thisArg) {
    const raw = this[RAW];
    const wrap = (v) => (typeof v === "object" ? reactive(v) : v);
    track(raw, INERATE_KEY);
    raw.forEach((v, k) => {
      cb.call(thisArg, wrap(v), wrap(k), this);
    });
  },
  [Symbol.iterator]: iteratorMethod,
  entries: iteratorMethod,
  values() {
    const raw = this[RAW];
    const itr = raw.values();
    const wrap = (v) => (typeof v === "object" ? reactive(v) : v);
    track(raw, INERATE_KEY);
    return {
      next() {
        const { value, done } = itr.next();
        return {
          value: wrap(value),
          done,
        };
      },
      [Symbol.iterator]() {
        return this;
      },
    };
  },
  keys() {
    const raw = this[RAW];
    const itr = raw.keys();
    const wrap = (v) => (typeof v === "object" ? reactive(v) : v);
    track(raw, MAP_KEY_INERATE_KEY);
    return {
      next() {
        const { value, done } = itr.next();
        return {
          value: wrap(value),
          done,
        };
      },
      [Symbol.iterator]() {
        return this;
      },
    };
  },
};
// 对集合代理 Set Map
const createReactiveCollection = (
  target,
  isShallow = false,
  isReadonly = false
) => {
  return new Proxy(target, {
    get(target, key, receiver) {
      // 内部属性 RAW, 获取原本的对象
      if (key === RAW) {
        return target;
      }

      if (key === "size") {
        track(target, INERATE_KEY);
        return Reflect.get(target, key, target);
      }

      return mutableInstrumentations[key];
    },
    set(target, key, newVal, receiver) {
      console.log("+set", key);
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }
      const oldVal = target[key];
      const triggerType = Array.isArray
        ? Number(key) < target.length
          ? "SET"
          : "ADD"
        : Object.prototype.hasOwnProperty.call(target, key)
        ? "SET"
        : "ADD";
      const v = Reflect.set(target, key, newVal, receiver);
      // receiver 是 target 的代理对象
      if (receiver[RAW] === target) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, triggerType, newVal);
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
      track(target, Array.isArray(target) ? "length" : INERATE_KEY);
      return Reflect.ownKeys(target);
    },
  });
};
const reactiveCollectionMap = new Map();

const reactiveCollection = (target) => {
  if (reactiveCollectionMap.has(target))
    return reactiveCollectionMap.get(target);

  const proxy = createReactiveCollection(target);
  reactiveCollectionMap.set(target, proxy);
  return proxy;
};

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

/* array length */

const p = reactive([0]);

effect(() => {
  for (let i of p) {
  }
  console.log("-- for of");
});
console.log("++ ===-");
p.push(12);
