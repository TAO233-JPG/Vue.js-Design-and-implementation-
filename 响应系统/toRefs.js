function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key];
    },
    set value(v) {
      return (obj[key] = v);
    },
  };

  Object.defineProperty(wrapper, "__v_isRef", {
    value: true,
  });

  return wrapper;
}

function toRefs(obj) {
  const res = {};

  for (let k in obj) {
    res[k] = toRef(obj, k);
  }

  return res;
}

// 自动脱 ref
// 在vue组件中setup函数返回的数据，都会传递给proxyRefs处理，所以我们不用使用.value
function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const v = Reflect.get(target, key, receiver);
      return v.__v_isRef ? v.value : v;
    },
    set(target, key, newValue, receiver) {
      const value = target[key];
      if (value.__v_isRef) {
        value.value = newValue;
        return true;
      }
      return Reflect.set(target, key, newValue, receiver);
    },
  });
}
