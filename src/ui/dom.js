/**
 * dom.js
 * ------
 * Minimal hyperscript-style DOM helper so screens can be written declaratively
 * without a framework or build step. `h('div.card', {...}, [children])`.
 */

/**
 * Create an element.
 * @param {string} tag  e.g. 'button.btn.primary' or 'div#id.class'
 * @param {object} [attrs]  properties/attributes. `on*` become listeners; `style`
 *                          accepts an object; `text`/`html` set content.
 * @param {Array|Node|string} [children]
 */
export function h(tag, attrs = {}, children = []) {
  const parts = tag.split(/(?=[.#])/);
  const el = document.createElement(parts[0] || 'div');
  for (const p of parts.slice(1)) {
    if (p[0] === '.') el.classList.add(p.slice(1));
    else if (p[0] === '#') el.id = p.slice(1);
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

/** Remove all children of a node. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
