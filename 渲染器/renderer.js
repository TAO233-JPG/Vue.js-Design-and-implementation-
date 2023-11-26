/* 渲染器会把虚拟dom渲染为真实Dom */
/* 为了保证渲染器的通用性，需要把浏览器特点的 API 抽离，使得渲染器的核心不依赖于浏览器，
   所以需要为抽离API提供配置接口，即可实现渲染器的跨平台功能 
*/
const Text = Symbol("Text"); // 文本节点的类型
export const Fragment = Symbol("Fragment"); // fragment节点的类型

/**
 *
 * @param {object} config
 * @param {(tag:string)=>{}} config.createElement 创建元素
 * @param {(el, text:string)=>{}} config.setElementText 为元素设置文本
 * @param {(el, parent, anchor:any=null)=>{}} config.insert 指定parent下添加元素
 * @param {(el, key, preValue, nextValue)=>{}} config.patchProps 更新props
 * @param {(vnode)=>{}} config.unmount 卸载节点
 * @param {(text)=>Text} config.createText 创建文本节点
 * @param {(el,text)=>{}} config.setText 设置文本节点的文本
 * @returns
 */

export function createRenderer(config) {
  const {
    createElement,
    setElementText,
    insert,
    patchProps,
    unmount,
    createText,
    setText,
  } = config;

  /* 挂载元素 */
  function mountElement(vnode, container) {
    const el = (vnode.el = createElement(vnode.type));
    // 1. 处理子节点
    if (typeof vnode.children === "string") {
      setElementText(el, vnode.children);
    } else if (Array.isArray(vnode.children)) {
      vnode.children.forEach((v) => {
        patch(null, v, el);
      });
    }

    // 2. 处理属性
    if (vnode.props) {
      for (let key in vnode.props) {
        const value = vnode.props[key];
        patchProps(el, key, null, value);
      }
    }
    insert(el, container);
  }

  function patch(n1, n2, container) {
    // 新旧节点类型不同，直接卸载旧节点
    if (n1 && n1.type !== n2.type) {
      unmount(n1);
      n1 = null;
    }
    const { type } = n2;

    // 表明为不同标签元素
    if (typeof type === "string") {
      // 没有旧节点， 直接挂载
      if (!n1) {
        mountElement(n2, container);
      } else {
        // 更新
        patchElement(n1, n2);
      }
    } else if (type === Text) {
      // vnode 为文本节点
      if (!n1) {
        const el = (n2.el = createText(n2.children));
        insert(el, container);
      } else {
        const el = (n2.el = n1.el);
        if (n1.children !== n2.children) {
          setText(el, n2.children);
        }
      }
    } else if (type === Fragment) {
      // vnode 为fragment
      if (!n1) {
        n2.children.forEach((v) => patch(null, v, container));
      } else {
        patchChildren(n1, n2, container);
      }
    } else if (typeof type === "object") {
      // 表明为组件
    } else {
    }
  }

  // 更新标签节点
  function patchElement(n1, n2) {
    const el = (n2.el = n1.el);
    const oldProps = n1.props;
    const newProps = n2.props;
    // 1. 更新props
    for (let key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key]);
      }
    }
    for (let key in oldProps) {
      if (!(key in newProps)) {
        patchProps(el, key, oldProps[key], null);
      }
    }

    // 2. 更新children
    patchChildren(n1, n2, el);
  }
  function patchChildren(n1, n2, el) {
    // 为文本
    if (typeof n2.children === "string") {
      if (Array.isArray(n1.children)) {
        n1.children.forEach((v) => unmount(v));
      }
      setElementText(el, n2.children);
    } else if (Array.isArray(n2.children)) {
      // diff 比对
      if (Array.isArray(n1.children)) {
        n1.children.forEach((v) => {
          unmount(v);
        });
        n2.children.forEach((v) => patch(null, v, el));
      } else {
        setElementText(el, "");
        n2.children.forEach((v) => patch(null, v, el));
      }
    } else {
      // 为空
      if (Array.isArray(n1.children)) {
        n1.forEach((v) => unmount(v));
      } else if (typeof n1 === "string") {
        setElementText(el, "");
      }
    }
  }

  function render(vnode, container) {
    if (vnode) {
      patch(container._vnode, vnode, container);
    } else {
      unmount(container._vnode);
    }

    container._vnode = vnode;
  }

  return render;
}

// const render = createRenderer();
