export function captureAncestorsHtml(el: HTMLElement, includeText = true): string[] {
    const path = [];
    let current: HTMLElement | null = el;
    while (current) {
        path.push(captureHtmlLine(current));
        current = current.parentElement;
    }
    if (includeText) {
        path.unshift(el.innerText);
    }
    return path.reverse().filter(Boolean);
}

export function captureHtmlLine(el: HTMLElement) {
    const html = [];
    html.push(`${el.tagName.toLowerCase()}`);
    for (const attr of el.attributes) {
        html.push(`${attr.name}="${attr.value}"`);
    }
    return `<${html.join(' ')}>`;
}
