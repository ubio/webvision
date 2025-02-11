export interface VisibilityOptions {
    checkOpacity: boolean;
    checkVisibility: boolean;
    checkTransform: boolean;
}

/**
 * Element not visible with descendants if:
 *
 *   - opacity < 0.1
 *   - display: none
 *   - visibility: hidden
 *   - transform: scale(0)
 */
export function isHidden(element: Element, options: Partial<VisibilityOptions> = {}) {
    const {
        checkOpacity = true,
        checkVisibility = true,
        checkTransform = true,
    } = options;
    const style = getComputedStyle(element);
    const opacity = Number(style.opacity);
    const display = style.display;
    const visibility = style.visibility;
    const transform = style.transform;
    if (
        display === 'none' ||
        (checkOpacity && opacity < 0.1) ||
        (checkVisibility && (visibility === 'hidden')) ||
        (checkTransform && transform.includes('scale(0)'))
    ) {
        return true;
    }
    if (!element.checkVisibility()) {
        return true;
    }
    return false;
}

export function hasVisibleArea(element: Element) {
    const rect = element.getBoundingClientRect();
    const area = rect.width * rect.height;
    return area > 100;
}

export function deepIsHidden(element: Element, options: Partial<VisibilityOptions> = {}): boolean {
    if (isHidden(element, options)) {
        return true;
    }
    if (!hasVisibleArea(element)) {
        return [...element.children].every(el => deepIsHidden(el, options));
    }
    return false;
}

export function normalizeText(str: string) {
    return str
        .replace(/\p{Cf}/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function containsImage(el: Element): boolean {
    return el.matches('img') || !!el.querySelector('img');
}

export function isRecursiveInline(el: Element, ignoreTags: string[] = []): boolean {
    for (const child of el.childNodes) {
        if (child instanceof Element) {
            if (ignoreTags.includes(child.tagName.toLowerCase())) {
                return false;
            }
            const display = getComputedStyle(child).display;
            const inline = display === 'inline' || display === 'inline-block';
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
