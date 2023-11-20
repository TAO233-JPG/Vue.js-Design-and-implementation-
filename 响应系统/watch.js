import { effect, track, trigger } from "./effect.js";

function watch(sourse, cb, options = {}) {
  let getter;

  if (typeof sourse === "function") {
    getter = sourse;
  } else {
    getter = () => traverse(sourse);
  }

  let oldValue, newValue;
  let cleanup;
  // onInvalidDate 会注册一个过期回调函数cleanup
  // 这个回调函数会在当前回调函数过期执行
  const onInvalidDate = (fn) => {
    cleanup = fn;
  };

  const job = () => {
    cleanup && cleanup();
    newValue = effectFn();
    cb(newValue, oldValue, onInvalidDate);
    oldValue = newValue;
  };
  const effectFn = effect(
    () => {
      return getter();
    },
    {
      lazy: true,
      scheduler() {
        if (options.flush === "post") {
          const p = Promise.resolve();
          p.then(job);
        } else {
          job();
        }
      },
    }
  );

  if (options.immediate) {
    job();
  } else {
    oldValue = effectFn();
  }
}
function traverse(value, visited = new Set()) {
  if (typeof value !== "object" || value == null || visited.has(value)) return;

  visited.add(value);
  for (let key in value) {
    traverse(value[key], visited);
  }

  return value;
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

watch(
  () => obj.bar,
  (newValue, oldValue) => {
    console.log(newValue, oldValue, "--watch");
  },
  {
    immediate: true,
  }
);

// obj.bar += "new";
