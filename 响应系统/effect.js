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
export const trigger = (target, key) => {
  const depMap = bucket.get(target);
  if (!depMap) return;
  const deps = depMap.get(key);
  const newDeps = new Set(deps);
  newDeps.forEach((effectFn) => {
    if (effectFn !== aciveEffect) {
      // 只有当前执行的effect与全局活跃的effect不同才会执行
      if (effectFn.options.scheduler) {
        effectFn.options.scheduler(effectFn);
      } else {
        effectFn();
      }
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
