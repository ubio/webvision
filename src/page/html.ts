export function captureAncestorHtml(el: HTMLElement) {
    const html = [];
    let current: HTMLElement | null = el;
    while (current) {
        html.push(captureHtmlLine(current));
        current = current.parentElement;
    }
    return html.reverse().join('\n');
}

export function captureHtmlLine(el: HTMLElement) {
    const html = [];
    html.push(`${el.tagName.toLowerCase()}`);
    for (const attr of el.attributes) {
        html.push(`${attr.name}="${attr.value}"`);
    }
    return `<${html.join(' ')}>`;
}
