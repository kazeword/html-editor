// js/browserTabs.js: 管理“浏览器窗口”的标签页逻辑

import state, { setState } from './state.js';
import * as ui from './ui.js';
import * as fs from './fileSystem.js';
import { showToast } from './toast.js';

export async function openTab(path, handle) {
    const { tabs } = state.browserTabs;
    const existingTab = tabs.find(tab => tab.path === path);

    if (!existingTab) {
        const newTabs = [...tabs, { path, handle }];
        setState({ browserTabs: { ...state.browserTabs, tabs: newTabs } });
    }
    
    await switchTab(path);
}

export function closeTab(path) {
    let { tabs, activeTabPath } = state.browserTabs;
    const tabIndex = tabs.findIndex(tab => tab.path === path);

    if (tabIndex === -1) return;

    const newTabs = tabs.filter(tab => tab.path !== path);

    // 如果关闭的是当前活动标签页
    if (activeTabPath === path) {
        // 自动切换到邻近的标签页
        const newActiveIndex = Math.max(0, tabIndex - 1);
        const newActivePath = newTabs.length > 0 ? newTabs[newActiveIndex].path : null;
        setState({ browserTabs: { tabs: newTabs, activeTabPath: newActivePath } });
        switchTab(newActivePath); // 切换并渲染
    } else {
        setState({ browserTabs: { ...state.browserTabs, tabs: newTabs } });
        ui.renderTabs(); // 只更新UI，不切换
    }
}

export async function switchTab(path) {
    if (!path) { // 如果没有可切换的标签 (例如全部关闭后)
        setState({ browserTabs: { ...state.browserTabs, activeTabPath: null } });
        ui.renderTabs();
    if (state.isRequirementMode) {
        ui.renderPreview(content, HIGHLIGHT_STYLES);
    } else {
        ui.renderPreview(content, ''); // 浏览模式下不注入任何样式
    }        return;
    }

    const tabData = state.browserTabs.tabs.find(tab => tab.path === path);
    if (!tabData) return;

    setState({ browserTabs: { ...state.browserTabs, activeTabPath: path } });
    
    const content = await fs.readFile(tabData.handle);
    const HIGHLIGHT_STYLES = `
        .highlighted-element { outline: 2px solid orange !important; box-shadow: 0 0 8px orange !important; cursor: pointer !important; }
        .commented-element { outline: 2px solid purple !important; }
    `;
    ui.renderTabs();
    ui.renderPreview(content, HIGHLIGHT_STYLES);
}

export async function refreshActiveTab() {
    const { activeTabPath } = state.browserTabs;
    if (activeTabPath) {
        // 重新调用 switchTab 即可实现刷新
        await switchTab(activeTabPath);
    }
}

export function setupNavigationListeners() {
    const doc = document.getElementById('previewFrame').contentDocument;
    if (!doc || !doc.body) return;

    doc.body.addEventListener('click', async (e) => {
        // 只处理对 <a> 标签的点击
        const link = e.target.closest('a');
        if (!link) return;

        // 阻止默认的链接跳转行为
        e.preventDefault();
        e.stopPropagation();

        const href = link.getAttribute('href');
        // 忽略无效或锚点链接
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
            return;
        }

        try {
            const currentPath = state.browserTabs.activeTabPath;
            if (!currentPath) return;

            // --- 路径解析 ---
            const baseUrl = `http://dummybase.com/${currentPath}`;
            const resolvedUrl = new URL(href, baseUrl);
            const newPath = resolvedUrl.pathname.substring(1);

            // --- 触发应用层导航 ---
            const { handle } = await fs.getHandleByPath(newPath);
            if (handle && handle.kind === 'file') {
                await openTab(newPath, handle);
            } else {
                throw new Error(`文件未找到或不是一个文件: ${newPath}`);
            }

        } catch (err) {
            showToast(`导航失败: ${href}`, 'error');
            console.error('Failed to navigate to link:', err);
        }
    });
}