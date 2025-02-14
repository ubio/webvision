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
  if (display === "none" || checkOpacity && opacity < 0.1 || checkVisibility && visibility === "hidden" || checkTransform && transform.includes("scale(0)")) {
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
function containsImage(el) {
  return el.matches("img") || !!el.querySelector("img");
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
var DomSnapshot = class _DomSnapshot {
  constructor(node, parent, options) {
    this.node = node;
    this.parent = parent;
    this.children = [];
    this.options = {
      skipHidden: true,
      skipEmptyText: true,
      skipImages: false,
      skipTags: DEFAULT_SKIP_TAGS,
      tagPreference: DEFAULT_SEMANTIC_TAGS,
      collapseInline: true,
      ...options
    };
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
    const text = this.node instanceof HTMLElement ? this.node.innerText : this.node.textContent;
    return normalizeText(text ?? "");
  }
  get indent() {
    return "  ".repeat(this.depth);
  }
  get isLeaf() {
    return this.children.length === 0;
  }
  get tagName() {
    return this.node instanceof Element ? this.node.tagName.toLowerCase() : "";
  }
  get href() {
    return this.node instanceof HTMLAnchorElement ? this.node.href : "";
  }
  get src() {
    return this.node instanceof HTMLImageElement ? this.node.src : "";
  }
  getFontSize() {
    if (this.node instanceof Text) {
      return this.parent?.getFontSize() ?? 0;
    }
    return Number(getComputedStyle(this.node).fontSize?.replace("px", ""));
  }
  getTextSize(rootFontSize) {
    const ownFontSize = this.getFontSize();
    if (ownFontSize > 1.2 * rootFontSize) {
      return "large";
    }
    if (ownFontSize < 0.85 * rootFontSize) {
      return "small";
    }
    return "normal";
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
      const snapshot = new _DomSnapshot(childNode, this, this.options);
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
        if (this.options.skipHidden && deepIsHidden(node, { checkOpacity: false })) {
          return false;
        }
        if (!this.options.skipImages && containsImage(node)) {
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
  toIndentedText() {
    const buffer = [
      this.renderLine()
    ];
    for (const child of this.children) {
      buffer.push(child.toIndentedText());
    }
    return buffer.join("\n");
  }
  renderLine() {
    const indent = "  ".repeat(this.depth);
    const components = [indent];
    if (this.node instanceof Text) {
      return [indent, this.inlineText].filter(Boolean).join(" ");
    }
    const { tagName, src, href } = this;
    components.push(tagName);
    if (src) {
      components.push(`(${src})`);
    }
    if (href) {
      components.push(`(${href})`);
    }
    if (this.isLeaf) {
      components.push(" " + this.inlineText);
    }
    return components.filter(Boolean).join("");
  }
};
export {
  DEFAULT_SEMANTIC_TAGS,
  DEFAULT_SKIP_TAGS,
  DomSnapshot,
  containsImage,
  deepIsHidden,
  hasVisibleArea,
  isHidden,
  isRecursiveInline,
  normalizeText
};
