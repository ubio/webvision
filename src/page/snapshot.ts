import { containsImage, deepIsHidden, isRecursiveInline, normalizeText } from './utils.js';

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

export interface DomSnapshotOptions {
    skipHidden: boolean;
    skipImages: boolean;
    skipEmptyText: boolean;
    skipTags: string[];
    tagPreference: string[];
    collapseInline: boolean;
}

export class DomSnapshot {

    options: DomSnapshotOptions;
    classList: string[];
    children: DomSnapshot[] = [];

    constructor(
        public node: Element | Text,
        public parent: DomSnapshot | null,
        options: Partial<DomSnapshotOptions>,
    ) {
        this.options = {
            skipHidden: true,
            skipEmptyText: true,
            skipImages: false,
            skipTags: DEFAULT_SKIP_TAGS,
            tagPreference: DEFAULT_SEMANTIC_TAGS,
            collapseInline: true,
            ...options,
        };
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
        const text = this.node instanceof HTMLElement ?
            this.node.innerText :
            this.node.textContent;
        return normalizeText(text ?? '');
    }

    get indent() {
        return '  '.repeat(this.depth);
    }

    get isLeaf() {
        return this.children.length === 0;
    }

    get tagName() {
        return this.node instanceof Element ? this.node.tagName.toLowerCase() : '';
    }

    get href() {
        return this.node instanceof HTMLAnchorElement ? this.node.href : '';
    }

    get src() {
        return this.node instanceof HTMLImageElement ? this.node.src : '';
    }

    getFontSize(): number {
        if (this.node instanceof Text) {
            return this.parent?.getFontSize() ?? 0;
        }
        return Number(getComputedStyle(this.node).fontSize?.replace('px', ''));
    }

    getTextSize(rootFontSize: number) {
        const ownFontSize = this.getFontSize();
        if (ownFontSize > 1.2 * rootFontSize) {
            return 'large';
        }
        if (ownFontSize < 0.85 * rootFontSize) {
            return 'small';
        }
        return 'normal';
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
            const snapshot = new DomSnapshot(childNode, this, this.options);
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
                if (this.options.skipHidden && deepIsHidden(node, { checkOpacity: false })) {
                    return false;
                }
                // Do not skip images even if other criteria are met
                if (!this.options.skipImages && containsImage(node)) {
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

    toIndentedText() {
        const buffer = [
            this.renderLine(),
        ];
        for (const child of this.children) {
            buffer.push(child.toIndentedText());
        }
        return buffer.join('\n');
    }

    renderLine(): string {
        const indent = '  '.repeat(this.depth);
        const components: Array<string | null> = [indent];
        if (this.node instanceof Text) {
            return [indent, this.inlineText].filter(Boolean).join(' ');
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
            components.push(' ' + this.inlineText);
        }
        return components.filter(Boolean).join('');
    }

}
