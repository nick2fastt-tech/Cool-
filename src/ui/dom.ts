/** Tiny DOM helpers - enough to build the UI without a framework. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(label: string, sub?: string): HTMLButtonElement {
  const b = el('button', 'btn');
  b.appendChild(el('span', undefined, label));
  if (sub) b.appendChild(el('small', undefined, sub));
  return b;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function show(node: HTMLElement, visible: boolean): void {
  node.classList.toggle('hidden', !visible);
}
