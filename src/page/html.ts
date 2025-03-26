import { SnapshotNode } from './snapshot.js';

export function captureAncestorsHtml(el: SnapshotNode, includeText = true): string[] {
    const path = [];
    let current: SnapshotNode | null = el;
    while (current) {
        path.push(captureHtmlLine(current));
        current = current.parentElement;
    }
    if (includeText) {
        const anyEl = el as any;
        path.unshift(anyEl.value ?? anyEl.innerText ?? anyEl.textContent ?? '');
    }
    return path.reverse().filter(Boolean);
}

export function captureHtmlLine(el: SnapshotNode) {
    const html = [];
    if (el instanceof HTMLElement) {
        html.push(`${el.tagName.toLowerCase()}`);
        for (const attr of el.attributes) {
            html.push(`${attr.name}="${attr.value}"`);
        }
        return `<${html.join(' ')}>`;
    }
    if (el instanceof Text) {
        return el.textContent;
    }
    return '';
}

export function captureHtml(el: SnapshotNode) {
    if (el instanceof HTMLElement) {
        const anyEl = el as any;
        return [
            captureHtmlLine(el),
            anyEl.value ?? anyEl.innerText ?? anyEl.textContent ?? '',
            `</${el.tagName.toLowerCase()}>`,
        ].filter(Boolean).join('');
    }
    if (el instanceof Text) {
        return el.textContent;
    }
    return '';
}
