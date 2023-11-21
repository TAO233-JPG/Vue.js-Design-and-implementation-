import { INERATE_KEY } from "./reactive.js";

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
  if (!aciveEffect) return;
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
export const trigger = (target, key, type) => {
  const depMap = bucket.get(target);
  if (!depMap) return;
  const deps = depMap.get(key);

  const effectToRun = new Set();

  // 只有 ADD, DELETE 才需要获取与 INERATE_KEY 相关联的副作用函数
  if (["ADD", "DELETE"].includes(type)) {
    const iterateEffects = depMap.get(INERATE_KEY);
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (aciveEffect !== effectFn) {
          effectToRun.add(effectFn);
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
