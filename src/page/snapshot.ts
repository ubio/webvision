import { containsSelector, deepIsHidden, getVisibleText, isRecursiveInline, normalizeText } from './utils.js';

export const DEFAULT_SKIP_TAGS = ['svg', 'script', 'noscript', 'style', 'link', 'meta'];
export const DEFAULT_SEMANTIC_TAGS = [
    'a', 'button', 'label', 'section',
    'article', 'main', 'header', 'footer', 'nav', 'aside',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'p', 'pre', 'code', 'blockquote', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'form', 'input', 'textarea', 'select', 'option', 'fieldset', 'legend',
    'strong', 'em', 'sub', 'sup',
];

export type SnapshotNode = Element | Text;

export interface SnapshotOptions {
    startId: number;
    skipHidden: boolean;
    skipImages: boolean;
    skipIframes: boolean;
    skipEmptyText: boolean;
    skipTags: string[];
    tagPreference: string[];
    collapseInline: boolean;
}

export interface SnapshotItem {
    ref: number;
    nodeType: 'element' | 'text';
    leaf: boolean;
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    tagName?: string;
    classList?: string[];
    textContent?: string;
    href?: string;
    src?: string;
    children?: SnapshotItem[];
}

export function createSnapshot(root: SnapshotNode, options: Partial<SnapshotOptions> = {}) {
    const opts: SnapshotOptions = {
        startId: 0,
        skipHidden: true,
        skipEmptyText: true,
        skipImages: false,
        skipIframes: false,
        skipTags: DEFAULT_SKIP_TAGS,
        tagPreference: DEFAULT_SEMANTIC_TAGS,
        collapseInline: true,
        ...options,
    };
    const counter = new Counter(opts.startId);
    const refMap = new Map<number, SnapshotNode>();
    const tree = new SnapshotTree(root, null, counter, opts);
    tree.fillMap(refMap);
    return {
        refMap,
        snapshot: tree.toJson(),
        maxId: counter.value,
    };
}

export class SnapshotTree {

    ref: number;
    classList: string[];
    children: SnapshotTree[] = [];

    constructor(
        public node: Element | Text,
        public parent: SnapshotTree | null,
        public counter: Counter,
        public options: SnapshotOptions,
    ) {
        this.ref = this.counter.next();
        this.classList = [...(this.element?.classList ?? [])];
        if (this.element) {
            this.parseTree(this.element, this.getAcceptedChildren(this.element));
        }
    }

    get element() {
        return this.node instanceof Element ? this.node : null;
    }

    get depth(): number {
        return this.parent ? this.parent.depth + 1 : 0;
    }

    get inlineText() {
        const text = getVisibleText(this.node);
        return normalizeText(text ?? '');
    }

    get leaf() {
        return this.children.length === 0;
    }

    get tagName() {
        return this.node instanceof Element ? this.node.tagName.toLowerCase() : undefined;
    }

    get href() {
        return this.node instanceof HTMLAnchorElement ? this.node.href : undefined;
    }

    get src() {
        return (this.node as any).src ?? undefined;
    }

    get clientRect() {
        if (this.node instanceof Element) {
            return this.node.getBoundingClientRect();
        }
        const range = document.createRange();
        range.selectNodeContents(this.node);
        return range.getBoundingClientRect();
    }

    private parseTree(el: Element, childNodes: SnapshotNode[]): void {
        this.children = [];
        if (childNodes.length === 1) {
            return this.collapseWrapper(el, childNodes[0]);
        }
        if (this.options.collapseInline && isRecursiveInline(el, this.options.tagPreference)) {
            // Do not process more children
            return;
        }
        for (const childNode of childNodes) {
            const snapshot = new SnapshotTree(childNode, this, this.counter, this.options);
            this.children.push(snapshot);
        }
    }

    /**
     * Collapses an element with only one visible child into one.
     *
     * Wrapper element is preferred if it's a link or a button,
     * in other cases child element is preferred.
     */
    private collapseWrapper(el: Element, child: Element | Text) {
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
        // Continue parsing child element
        if (this.element) {
            this.parseTree(this.element, this.getAcceptedChildren(child));
        }
    }

    private getAcceptedChildren(el: Element): Array<Element | Text> {
        const childNodes = [...el.childNodes];
        return childNodes.filter((node: Node): node is Element | Text => {
            // Ignore non-text and non-HTML nodes
            if (!(node instanceof Element || node instanceof Text)) {
                return false;
            }
            if (node instanceof Element) {
                // Skip hidden elements (opacity, display, visibility, etc)
                // TODO checkOpacity breaks PDF viewer
                if (this.options.skipHidden && deepIsHidden(node)) {
                    return false;
                }
                // Always include inputs
                if (containsSelector(node, 'input')) {
                    return true;
                }
                // Always include iframes, unless explicitly skipped
                if (!this.options.skipIframes && containsSelector(node, 'iframe')) {
                    return true;
                }
                // Always include images, unless explicitly skipped
                if (!this.options.skipImages && containsSelector(node, 'img')) {
                    return true;
                }
                // Skip listed tags
                if (this.options.skipTags.includes(node.tagName.toLowerCase())) {
                    return false;
                }
            }
            // Skip nodes with empty text
            if (this.options.skipEmptyText) {
                const isEmptyText = normalizeText(node.textContent ?? '').length === 0;
                if (isEmptyText) {
                    return false;
                }
            }
            return true;
        });
    }

    fillMap(map: Map<number, SnapshotNode>) {
        map.set(this.ref, this.node);
        for (const child of this.children) {
            child.fillMap(map);
        }
    }

    toJson(): SnapshotItem {
        const { top, left, width, height } = this.clientRect;
        return {
            ref: this.ref,
            nodeType: this.node instanceof Element ? 'element' : 'text',
            leaf: this.leaf,
            tagName: this.tagName,
            rect: {
                x: left,
                y: top,
                width,
                height,
            },
            classList: this.node instanceof Element ? this.classList : undefined,
            textContent: this.leaf ? this.inlineText : undefined,
            href: this.href,
            src: this.src,
            children: this.leaf ? undefined : this.children.map(child => child.toJson()),
        };
    }

}

export class Counter {

    constructor(public value = 0) {}

    next() {
        this.value += 1;
        return this.value;
    }

}
