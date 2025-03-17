import { SnapshotItem, SnapshotNode } from './snapshot.js';

export function highlightSnapshot(
    snapshot: SnapshotItem,
    nodeMap: Map<number, SnapshotNode>,
) {
    const container = getHighlightContainer();
    container.innerHTML = '';
    highlightRecursive(snapshot, nodeMap, container);
}

function highlightRecursive(
    snapshot: SnapshotItem,
    nodeMap: Map<number, SnapshotNode>,
    container: HTMLElement,
) {
    highlightEl(snapshot, nodeMap, container);
    for (const child of snapshot.children ?? []) {
        highlightRecursive(child, nodeMap, container);
    }
}

export function highlightEl(
    snapshot: SnapshotItem,
    nodeMap: Map<number, SnapshotNode>,
    container: HTMLElement,
) {
    const isContainerEl = !snapshot.leaf && snapshot.children?.every(child => child.nodeType === 'element');
    if (isContainerEl) {
        return;
    }
    const node = nodeMap.get(snapshot.nodeId);
    if (!(node instanceof Element)) {
        return;
    }
    const color = getColor(snapshot.nodeId);
    const rect = node.getBoundingClientRect();
    const overlay = document.createElement('div');
    container.appendChild(overlay);
    overlay.style.position = 'absolute';
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.border = `2px solid ${color}`;
    const label = document.createElement('div');
    overlay.appendChild(label);
    label.style.position = 'absolute';
    label.style.bottom = `100%`;
    label.style.left = `0`;
    label.style.backgroundColor = color;
    label.style.color = 'white';
    label.style.fontSize = '10px';
    label.style.fontFamily = 'monospace';
    label.style.fontWeight = 'normal';
    label.style.fontStyle = 'normal';
    label.style.opacity = '0.8';
    label.style.padding = '0 2px';
    label.style.transform = 'translateY(50%)';
    label.textContent = String(snapshot.nodeId);
}

export function removeHighlight() {
    const container = getHighlightContainer();
    document.documentElement.removeChild(container);
}

export function getHighlightContainer() {
    let container = document.querySelector('#webvision-highlight') as HTMLElement;
    if (!container) {
        container = document.createElement('div');
        container.id = 'webvision-highlight';
        container.style.position = 'absolute';
        container.style.pointerEvents = 'none';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.zIndex = '2147483646'; // Maximum z-index value
        document.documentElement.appendChild(container);
    }
    return container;
}

function getColor(index: number) {
    const hue = (index * 120 * .382) % 360;
    return `hsl(${hue}, 85%, 50%)`;
}
