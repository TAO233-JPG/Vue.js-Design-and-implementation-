import { track, trigger, effect } from "./effect.js";

export function computed(getter) {
  let dirty = true;
  let value;
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      if (!dirty) {
        dirty = true;
        trigger(obj, "value");
      }
    },
  });
  const obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      track(obj, "value");
      return value;
    },
  };

  return obj;
}

const data = {
  bar: "hello",
  foo: " ＋3",
};
const obj = new Proxy(data, {
  get(target, key) {
    track(target, key);
    return target[key];
  },

  set(target, key, newVal) {
    target[key] = newVal;
    trigger(target, key);
    return true;
  },
});

const computedA = computed(() => {
  console.log("computed called");
  return obj.bar + obj.foo;
});
console.log(computedA.value, "value");

effect(() => {
  console.log(computedA.value, "effrtc");
});
obj.bar = "jy";
// console.log(computedA.value);
