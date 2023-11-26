import { Fragment } from "../renderer.js";

export function createElement(tag) {
  return document.createElement(tag);
}

export function setElementText(el, text) {
  el.textContent = text;
}

export function insert(el, parent, anchor = null) {
  parent.insertBefore(el, anchor);
}
//
export function patchProps(el, key, preValue, nextValue) {
  // 处理事件
  if (/^on/.test(key)) {
    // 获取事件处理函数对象
    const invokers = el._vei || (el._vei = {});
    let invoker = invokers[key];
    const name = key.slice(2).tolowerCase();
    if (nextValue) {
      if (!invoker) {
        invoker = invokers[key] = (e) => {
          if (e.timeStamp < invoker.attached) return;
          if (Array.isArray(invoker.value)) {
            invoker.value.forEach((fn) => fn(e));
          } else {
            invoker.value(e);
          }
        };
        invoker.attached = performance.now();
        invoker.value = nextValue;
        el.addEventListener(el, invoker);
      } else {
        invoker.value = nextValue;
      }
    } else if (invoker) {
      // 如果没有
      el.reomveEventListener(el, invoker);
    }
    preValue && el.reomveEventListener(name, preValue);
    el.addEventListener(name, nextValue);
  } else if (key === "class") {
    el.className = nextValue;
  } else if (shouldSetAsProps(el, key, nextValue)) {
    // Dom 属性
    const type = typeof el[key];
    if (type === "boolean" && nextValue === "") {
      el[key] = true;
    } else {
      el[key] = nextValue;
    }
  } else {
    // html 属性
    el.setAttribute(key, nextValue);
  }
}

export function unmount(vnode) {
  if (vnode.type === Fragment) {
    vnode.children.forEach((v) => unmount(v));
    return;
  }
  const el = vnode.el;
  const pEl = el.parentNode;
  if (pEl) pEl.removeChild(el);
}

export function createText(text) {
  return document.createTextNode(text);
}

export function setText(el, text) {
  el.nodeValue = text;
}
