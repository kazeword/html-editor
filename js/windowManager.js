// js/windowManager.js: 封装所有与窗口拖动、缩放、层级相关的逻辑

import state, { setState } from './state.js';
import * as ui from './ui.js';

// 将 interact.js 的引用赋值给一个常量，如果它存在的话
const interact = window.interact;

function bringToFront(windowId) {
    const newHighestZIndex = state.highestZIndex + 1;
    const newWindowState = { ...state.windows[windowId], zIndex: newHighestZIndex };
    
    setState({
        windows: { ...state.windows, [windowId]: newWindowState },
        highestZIndex: newHighestZIndex
    });
    ui.renderWindows();
}

function initWindow(windowElement) {
    const windowId = windowElement.dataset.id;
    const headerElement = windowElement.querySelector('.window-header');

    // --- 拖动配置 ---
    interact(windowElement)
        .draggable({
            allowFrom: headerElement,
            inertia: true,
            modifiers: [
                interact.modifiers.restrictRect({
                    restriction: 'parent',
                    endOnly: true
                })
            ],
            autoScroll: true,
            listeners: {
                move(event) {
                    const target = event.target;
                    const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                    const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                    target.style.transform = `translate(${x}px, ${y}px)`;
                    target.setAttribute('data-x', x);
                    target.setAttribute('data-y', y);
                },
                end(event) {
                    const x = parseFloat(event.target.getAttribute('data-x')) || 0;
                    const y = parseFloat(event.target.getAttribute('data-y')) || 0;
                    setState({ windows: { ...state.windows, [windowId]: { ...state.windows[windowId], x, y } } });
                }
            }
        })
        .resizable({
            edges: { left: true, right: true, bottom: true, top: true },
            listeners: {
                move(event) {
                    let { x, y } = event.target.dataset;
                    x = parseFloat(x) || 0;
                    y = parseFloat(y) || 0;

                    Object.assign(event.target.style, {
                        width: `${event.rect.width}px`,
                        height: `${event.rect.height}px`,
                    });
                    
                    // 当从左边或顶部缩放时，需要同时调整位置
                    x += event.deltaRect.left;
                    y += event.deltaRect.top;
                    event.target.style.transform = `translate(${x}px, ${y}px)`;
                    event.target.setAttribute('data-x', x);
                    event.target.setAttribute('data-y', y);
                },
                end(event) {
                    const width = event.rect.width;
                    const height = event.rect.height;
                    const x = parseFloat(event.target.getAttribute('data-x')) || 0;
                    const y = parseFloat(event.target.getAttribute('data-y')) || 0;
                    setState({ windows: { ...state.windows, [windowId]: { ...state.windows[windowId], width, height, x, y } } });
                }
            },
            inertia: true
        });

    // --- 点击置顶 ---
    windowElement.addEventListener('mousedown', () => {
        if (state.windows[windowId].zIndex <= state.highestZIndex) {
            bringToFront(windowId);
        }
    });

    // --- 双击最大化/恢复 ---
    headerElement.addEventListener('dblclick', () => {
        const isMaximized = windowElement.classList.toggle('maximized');
        setState({ windows: { ...state.windows, [windowId]: { ...state.windows[windowId], maximized: isMaximized } } });
    });
}

function initSplitView(splitViewElement) {
    const leftPane = splitViewElement.querySelector('#file-explorer-pane');
    const rightPane = splitViewElement.querySelector('#code-editor-pane');
    const gutter = splitViewElement.querySelector('.gutter');

    interact(gutter)
        .draggable({
            orientation: 'horizontal',
            listeners: {
                move(event) {
                    const totalWidth = splitViewElement.offsetWidth;
                    let leftWidth = leftPane.offsetWidth + event.dx;

                    // 限制最小/最大宽度
                    if (leftWidth < 150) leftWidth = 150;
                    if (leftWidth > totalWidth - 150) leftWidth = totalWidth - 150;

                    leftPane.style.width = `${leftWidth}px`;
                    rightPane.style.flexGrow = '1';
                }
            }
        });
}

export function init() {
    if (!interact) {
        console.error('interact.js 未加载，窗口功能将不可用。');
        return;
    }
    
    document.querySelectorAll('.window').forEach(initWindow);
    initSplitView(document.querySelector('.resizable-split-view'));

    // 初始渲染所有窗口
    ui.renderWindows();
}