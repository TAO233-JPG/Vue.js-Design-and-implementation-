import { flushJob, jobQueue } from "./flushjob.js";

import { effect, trigger, track } from "./effect.js";

/* 存储副作用函数 */
// 使用
const data = {
  text: " hello",
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

effect(
  () => {
    {
      console.log("effect run");
      document.body.innerHTML = obj.text;
    }
  },
  {
    scheduler(effectFn) {
      jobQueue.add(effectFn);
      flushJob();
    },
  }
);

setTimeout(() => {
  obj.text = "1";
  obj.text = "2";
  obj.text = "3";
}, 1000);

console.log("结束");
