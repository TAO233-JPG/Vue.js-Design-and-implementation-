import { INERATE_KEY, MAP_KEY_INERATE_KEY, shouldTrack } from "./reactive.js";

const effectStack = [];
export let aciveEffect;

export function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn);
    aciveEffect = effectFn;
    effectStack.push(effectFn);
    const res = fn();
    effectStack.pop();
    aciveEffect = effectStack[effectStack.length - 1];
    return res;
  };
  effectFn.deps = [];
  effectFn.options = options;
  if (!options.lazy) {
    effectFn();
  }

  return effectFn;
}

export const bucket = new WeakMap();

// 依赖收集
export const track = (target, key) => {
  if (!aciveEffect || !shouldTrack) return;
  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(aciveEffect);
  aciveEffect.deps.push(deps);
};

// 派发更新
export const trigger = (target, key, type, newVal) => {
  const depMap = bucket.get(target);
  if (!depMap) return;
  const deps = depMap.get(key);

  const effectToRun = new Set();

  // 只有 ADD, DELETE 才需要获取与 INERATE_KEY 相关联的副作用函数
  if (
    ["ADD", "DELETE"].includes(type) ||
    (type === "SET" &&
      Object.prototype.toString.call(target) === "[object Map]")
  ) {
    const iterateEffects = depMap.get(INERATE_KEY);
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (aciveEffect !== effectFn) {
          effectToRun.add(effectFn);
        }
      });
  }
  if (
    ["ADD", "DELETE"].includes(type) &&
    Object.prototype.toString.call(target) === "[object Map]"
  ) {
    const iterateEffects = depMap.get(MAP_KEY_INERATE_KEY);
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (aciveEffect !== effectFn) {
          effectToRun.add(effectFn);
        }
      });
  }

  // 对于数组添加数据， 需要触发 length 上的 effectFn
  if (type === "ADD" && Array.isArray(target)) {
    const lengthEffectFn = depMap.get("length");
    lengthEffectFn &&
      lengthEffectFn.forEach((effectFn) => {
        if (aciveEffect !== effectFn) {
          effectToRun.add(effectFn);
        }
      });
  }

  // 对于数组，修改了length => newLength，需要取出 index >= newLength 项的effectFn并执行
  if (Array.isArray(target) && key === "length") {
    depMap.forEach((dep, idx) => {
      if (idx >= newVal) {
        dep.forEach((effectFn) => {
          if (aciveEffect !== effectFn) {
            effectToRun.add(effectFn);
          }
        });
      }
    });
  }
  deps &&
    deps.forEach((effectFn) => {
      if (effectFn !== aciveEffect) {
        effectToRun.add(effectFn);
      }
    });

  effectToRun.forEach((effectFn) => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
};

const cleanup = (effectFn) => {
  const deps = effectFn.deps;

  deps.forEach((dep) => {
    dep.delete(effectFn);
  });
  deps.length = 0;
};
