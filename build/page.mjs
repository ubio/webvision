// src/page/highlight.ts
function highlightSnapshot(snapshot, nodeMap) {
  const container = getHighlightContainer();
  container.innerHTML = "";
  highlightRecursive(snapshot, nodeMap, container);
}
function highlightRecursive(snapshot, nodeMap, container) {
  highlightEl(snapshot, nodeMap, container);
  for (const child of snapshot.children ?? []) {
    highlightRecursive(child, nodeMap, container);
  }
}
function highlightEl(snapshot, nodeMap, container) {
  const isContainerEl = !snapshot.leaf && snapshot.children?.every((child) => child.nodeType === "element");
  if (isContainerEl) {
    return;
  }
  const node = nodeMap.get(snapshot.nodeId);
  if (!(node instanceof Element)) {
    return;
  }
  const color = getColor(snapshot.nodeId);
  const rect = node.getBoundingClientRect();
  const overlay = document.createElement("div");
  container.appendChild(overlay);
  overlay.style.position = "absolute";
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.border = `2px solid ${color}`;
  const label = document.createElement("div");
  overlay.appendChild(label);
  label.style.position = "absolute";
  label.style.bottom = `100%`;
  label.style.left = `0`;
  label.style.backgroundColor = color;
  label.style.color = "white";
  label.style.fontSize = "10px";
  label.style.fontFamily = "monospace";
  label.style.fontWeight = "normal";
  label.style.fontStyle = "normal";
  label.style.opacity = "0.8";
  label.style.padding = "0 2px";
  label.style.transform = "translateY(50%)";
  label.textContent = String(snapshot.nodeId);
}
function removeHighlight() {
  const container = getHighlightContainer();
  document.documentElement.removeChild(container);
}
function getHighlightContainer() {
  let container = document.querySelector("#webvision-highlight");
  if (!container) {
    container = document.createElement("div");
    container.id = "webvision-highlight";
    container.style.position = "absolute";
    container.style.pointerEvents = "none";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.zIndex = "2147483646";
    document.documentElement.appendChild(container);
  }
  return container;
}
function getColor(index) {
  const hue = index * 120 * 0.382 % 360;
  return `hsl(${hue}, 85%, 50%)`;
}

// src/page/html.ts
function captureAncestorHtml(el) {
  const html = [];
  let current = el;
  while (current) {
    html.push(captureHtmlLine(current));
    current = current.parentElement;
  }
  return html.reverse().join("\n");
}
function captureHtmlLine(el) {
  const html = [];
  html.push(`${el.tagName.toLowerCase()}`);
  for (const attr of el.attributes) {
    html.push(`${attr.name}="${attr.value}"`);
  }
  return `<${html.join(" ")}>`;
}

// src/page/render.ts
function renderSnapshot(snapshot, options = {}) {
  const opts = {
    depth: 0,
    includeNodeId: true,
    includeClassList: false,
    ...options
  };
  if (opts.maxHeight && snapshot.rect.y > opts.maxHeight) {
    return "";
  }
  const buffer = [
    renderLine(snapshot, opts)
  ];
  for (const child of snapshot.children ?? []) {
    const childSnapshot = renderSnapshot(child, {
      ...opts,
      depth: opts.depth + 1
    });
    if (childSnapshot) {
      buffer.push(childSnapshot);
    }
  }
  return buffer.join("\n");
}
function renderLine(snapshot, options) {
  const indent = "  ".repeat(options.depth);
  const components = [indent];
  if (snapshot.nodeType === "text") {
    return [indent, snapshot.textContent].filter(Boolean).join(" ");
  }
  components.push(snapshot.tagName ?? "");
  if (options.includeNodeId) {
    components.push(`[nodeId=${snapshot.nodeId}]`);
  }
  if (options.includeClassList) {
    for (const className of snapshot.classList ?? []) {
      components.push(`.${className}`);
    }
  }
  if (snapshot.src) {
    components.push(`(${snapshot.src})`);
  }
  if (snapshot.href) {
    components.push(`(${snapshot.href})`);
  }
  if (snapshot.textContent) {
    components.push(" " + snapshot.textContent);
  }
  return components.filter(Boolean).join("");
}

// src/page/utils.ts
function isHidden(element, options = {}) {
  const {
    checkOpacity = true,
    checkVisibility = true,
    checkTransform = true
  } = options;
  const style = getComputedStyle(element);
  const opacity = Number(style.opacity);
  const display = style.display;
  const visibility = style.visibility;
  const transform = style.transform;
  if (display === "none" || checkOpacity && opacity === 0 || checkVisibility && visibility === "hidden" || checkTransform && transform.includes("scale(0)")) {
    return true;
  }
  if (!element.checkVisibility()) {
    return true;
  }
  return false;
}
function hasVisibleArea(element) {
  const rect = element.getBoundingClientRect();
  const area = rect.width * rect.height;
  return area > 100;
}
function deepIsHidden(element, options = {}) {
  if (isHidden(element, options)) {
    return true;
  }
  if (!hasVisibleArea(element)) {
    return [...element.children].every((el) => deepIsHidden(el, options));
  }
  return false;
}
function normalizeText(str) {
  return str.replace(/\p{Cf}/gu, " ").replace(/\s+/g, " ").trim();
}
function containsSelector(el, selector) {
  return el.matches(selector) || !!el.querySelector(selector);
}
function isRecursiveInline(el, ignoreTags = []) {
  for (const child of el.childNodes) {
    if (child instanceof Element) {
      if (ignoreTags.includes(child.tagName.toLowerCase())) {
        return false;
      }
      const display = getComputedStyle(child).display;
      const inline = display === "inline" || display === "inline-block";
      if (!inline) {
        return false;
      }
      if (!isRecursiveInline(child, ignoreTags)) {
        return false;
      }
    }
  }
  return true;
}
function getVisibleText(node) {
  getSelection()?.removeAllRanges();
  const range = document.createRange();
  range.selectNode(node);
  getSelection()?.addRange(range);
  const visibleText = getSelection()?.toString().trim();
  getSelection()?.removeAllRanges();
  return visibleText ?? "";
}

// src/page/snapshot.ts
var DEFAULT_SKIP_TAGS = ["svg", "script", "noscript", "style", "link", "meta"];
var DEFAULT_SEMANTIC_TAGS = [
  "a",
  "button",
  "label",
  "section",
  "article",
  "main",
  "header",
  "footer",
  "nav",
  "aside",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "p",
  "pre",
  "code",
  "blockquote",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "form",
  "input",
  "textarea",
  "select",
  "option",
  "fieldset",
  "legend",
  "strong",
  "em",
  "sub",
  "sup"
];
function createSnapshot(root, options = {}) {
  const opts = {
    startId: 0,
    skipHidden: true,
    skipEmptyText: true,
    skipImages: false,
    skipIframes: false,
    skipTags: DEFAULT_SKIP_TAGS,
    tagPreference: DEFAULT_SEMANTIC_TAGS,
    collapseInline: true,
    ...options
  };
  const counter = new Counter(opts.startId);
  const nodeMap = /* @__PURE__ */ new Map();
  const tree = new SnapshotTree(root, null, counter, opts);
  tree.fillMap(nodeMap);
  return {
    nodeMap,
    snapshot: tree.toJson(),
    maxId: counter.value
  };
}
var SnapshotTree = class _SnapshotTree {
  constructor(node, parent, counter, options) {
    this.node = node;
    this.parent = parent;
    this.counter = counter;
    this.options = options;
    this.children = [];
    this.nodeId = this.counter.next();
    this.classList = [...this.element?.classList ?? []];
    if (this.element) {
      this.parseTree(this.element, this.getAcceptedChildren(this.element));
    }
  }
  get element() {
    return this.node instanceof Element ? this.node : null;
  }
  get depth() {
    return this.parent ? this.parent.depth + 1 : 0;
  }
  get inlineText() {
    const text = getVisibleText(this.node);
    return normalizeText(text ?? "");
  }
  get leaf() {
    return this.children.length === 0;
  }
  get tagName() {
    return this.node instanceof Element ? this.node.tagName.toLowerCase() : void 0;
  }
  get href() {
    return this.node instanceof HTMLAnchorElement ? this.node.href : void 0;
  }
  get src() {
    return this.node.src ?? void 0;
  }
  get clientRect() {
    if (this.node instanceof Element) {
      return this.node.getBoundingClientRect();
    }
    const range = document.createRange();
    range.selectNodeContents(this.node);
    return range.getBoundingClientRect();
  }
  parseTree(el, childNodes) {
    this.children = [];
    if (childNodes.length === 1) {
      return this.collapseWrapper(el, childNodes[0]);
    }
    if (this.options.collapseInline && isRecursiveInline(el, this.options.tagPreference)) {
      return;
    }
    for (const childNode of childNodes) {
      const snapshot = new _SnapshotTree(childNode, this, this.counter, this.options);
      this.children.push(snapshot);
    }
  }
  /**
   * Collapses an element with only one visible child into one.
   *
   * Wrapper element is preferred if it's a link or a button,
   * in other cases child element is preferred.
   */
  collapseWrapper(el, child) {
    if (child instanceof Text) {
      return;
    }
    this.classList.push(...child.classList);
    const parentRank = this.options.tagPreference.indexOf(el.tagName.toLowerCase());
    const childRank = this.options.tagPreference.indexOf(child.tagName.toLowerCase());
    const preferParent = parentRank !== -1 && (parentRank < childRank || childRank === -1);
    if (!preferParent) {
      this.node = child;
    }
    if (this.element) {
      this.parseTree(this.element, this.getAcceptedChildren(child));
    }
  }
  getAcceptedChildren(el) {
    const childNodes = [...el.childNodes];
    return childNodes.filter((node) => {
      if (!(node instanceof Element || node instanceof Text)) {
        return false;
      }
      if (node instanceof Element) {
        if (this.options.skipHidden && deepIsHidden(node)) {
          return false;
        }
        if (containsSelector(node, "input")) {
          return true;
        }
        if (!this.options.skipIframes && containsSelector(node, "iframe")) {
          return true;
        }
        if (!this.options.skipImages && containsSelector(node, "img")) {
          return true;
        }
        if (this.options.skipTags.includes(node.tagName.toLowerCase())) {
          return false;
        }
      }
      if (this.options.skipEmptyText) {
        const isEmptyText = normalizeText(node.textContent ?? "").length === 0;
        if (isEmptyText) {
          return false;
        }
      }
      return true;
    });
  }
  fillMap(map) {
    map.set(this.nodeId, this.node);
    for (const child of this.children) {
      child.fillMap(map);
    }
  }
  toJson() {
    const { top, left, width, height } = this.clientRect;
    return {
      nodeId: this.nodeId,
      nodeType: this.node instanceof Element ? "element" : "text",
      leaf: this.leaf,
      tagName: this.tagName,
      rect: {
        x: left,
        y: top,
        width,
        height
      },
      classList: this.node instanceof Element ? this.classList : void 0,
      textContent: this.leaf ? this.inlineText : void 0,
      href: this.href,
      src: this.src,
      children: this.leaf ? void 0 : this.children.map((child) => child.toJson())
    };
  }
};
var Counter = class {
  constructor(value = 0) {
    this.value = value;
  }
  next() {
    this.value += 1;
    return this.value;
  }
};
export {
  Counter,
  DEFAULT_SEMANTIC_TAGS,
  DEFAULT_SKIP_TAGS,
  SnapshotTree,
  captureAncestorHtml,
  captureHtmlLine,
  containsSelector,
  createSnapshot,
  deepIsHidden,
  getHighlightContainer,
  getVisibleText,
  hasVisibleArea,
  highlightEl,
  highlightSnapshot,
  isHidden,
  isRecursiveInline,
  normalizeText,
  removeHighlight,
  renderLine,
  renderSnapshot
};
