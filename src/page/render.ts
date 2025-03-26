import { SnapshotItem } from './snapshot.js';

export interface SnapshotRenderOptions {
    depth: number;
    includeRef: boolean;
    includeClassList: boolean;
    maxHeight?: number;
}

export function renderSnapshot(snapshot: SnapshotItem, options: Partial<SnapshotRenderOptions> = {}) {
    const opts: SnapshotRenderOptions = {
        depth: 0,
        includeRef: true,
        includeClassList: false,
        ...options,
    };
    if (opts.maxHeight && snapshot.rect.y > opts.maxHeight) {
        return '';
    }
    const buffer = [
        renderLine(snapshot, opts),
    ];
    for (const child of snapshot.children ?? []) {
        const childSnapshot = renderSnapshot(child, {
            ...opts,
            depth: opts.depth + 1,
        });
        if (childSnapshot) {
            buffer.push(childSnapshot);
        }
    }
    return buffer.join('\n');
}

export function renderLine(snapshot: SnapshotItem, options: SnapshotRenderOptions) {
    const indent = '  '.repeat(options.depth);
    const components: Array<string | null> = [indent];
    if (snapshot.nodeType === 'text') {
        return [indent, snapshot.textContent].filter(Boolean).join(' ');
    }
    components.push(snapshot.tagName ?? '');
    if (options.includeRef) {
        components.push(`[ref=${snapshot.ref}]`);
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
        components.push(' ' + snapshot.textContent);
    }
    return components.filter(Boolean).join('');
}
