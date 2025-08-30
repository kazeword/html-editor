// js/ui.js

// [DEBUG] ui.js module execution started.
console.log('%c[UI DEBUG] 1. Module `ui.js` is being executed.', 'color: blue; font-weight: bold;');

import state, { setState } from './state.js';

// [DEBUG] Logging dependencies.
console.log('[UI DEBUG] 1a. Dependencies (`state`, `setState`) imported.');


// --- DOM 元素获取 ---
const fileTreeEl = document.getElementById('fileTree');
const openedFileNameEl = document.getElementById('openedFileName');
const contextMenuEl = document.getElementById('contextMenu');
const previewFrame = document.getElementById('previewFrame');
const requirementModal = document.getElementById('requirementModal');
const requirementListEl = document.getElementById('requirementList');
const newRequirementTextEl = document.getElementById('newRequirementText');
const fileExplorerPanel = document.getElementById('file-explorer-pane');
const projectRootNameEl = document.getElementById('projectRootName');
const tabsContainer = document.getElementById('tabs-container');
const aiPromptContentEl = document.getElementById('ai-prompt-content');

// [DEBUG] Initial state of codeMirrorInstance at module scope.
let codeMirrorInstance = null; 
console.log(`[UI DEBUG] 1b. Global variable 'codeMirrorInstance' initialized to:`, codeMirrorInstance);


// --- CodeMirror 编辑器 ---
export function initCodeEditor(onChangeCallback) {
    console.log('%c[UI DEBUG] 2. `initCodeEditor` function CALLED.', 'color: green; font-weight: bold;');
    try {
        const editorContainer = document.getElementById('code-editor-container');
        console.log('[UI DEBUG] 2a. Attempting to find `#code-editor-container`. Found:', editorContainer);

        if (!editorContainer) {
            console.error('[UI DEBUG] FATAL: `#code-editor-container` not found in the DOM. CodeMirror cannot be initialized.');
            return;
        }

        console.log('[UI DEBUG] 2b. Initializing CodeMirror instance...');
        codeMirrorInstance = window.CodeMirror(editorContainer, {
            value: "请从左侧选择一个文件...",
            mode: "htmlmixed",
            theme: "vscode-dark",
            lineNumbers: true,
            readOnly: true,
            lineWrapping: true,
        });

        console.log('[UI DEBUG] 2c. CodeMirror instance created. The value of `codeMirrorInstance` is now:', codeMirrorInstance);
        if (codeMirrorInstance && typeof codeMirrorInstance.on === 'function') {
            codeMirrorInstance.on('change', onChangeCallback);
            console.log('[UI DEBUG] 2d. Attached `onChange` event listener to CodeMirror instance.');
        } else {
            console.error('[UI DEBUG] FATAL: CodeMirror instance is invalid or does not have an `on` method.');
        }
    } catch (error) {
        console.error('[UI DEBUG] An error occurred inside `initCodeEditor`:', error);
    }
    console.log('%c[UI DEBUG] 2e. `initCodeEditor` function FINISHED.', 'color: green; font-weight: bold;');
}

export function getEditorContent() {
    console.log(`[UI DEBUG] getEditorContent CALLED. Current codeMirrorInstance is:`, codeMirrorInstance);
    return codeMirrorInstance ? codeMirrorInstance.getValue() : '';
}

function getModeForFile(filename) {
    if (filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.html')) return 'htmlmixed';
    return 'text/plain';
}

// --- AI 提示词 UI ---
export function renderAIPrompt() {
    const { system, files, requirements } = state.generatedPromptParts;
    const { includeSystem, includeRequirements, includedFiles } = state.promptConfig;

    if (!system) {
        aiPromptContentEl.innerHTML = `<div class="welcome-prompt-view">生成提示词失败。</div>`;
        return;
    }

    let renderedHtml = '<div id="ai-prompt-output-container">';
    
    // --- 渲染系统提示词部分 ---
    renderedHtml += `
        <details class="prompt-section" open>
            <summary>
                <span>系统提示词</span>
                <label class="switch">
                    <input type="checkbox" data-config-key="includeSystem" ${includeSystem ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </summary>
            <div class="section-content">${window.marked.parse(system)}</div>
        </details>
    `;

    // --- 渲染代码文件部分 ---
    let filesHtml = '';
    files.forEach(file => {
        const isChecked = includedFiles[file.path];
        filesHtml += `
            <div class="file-header">
                <code>${file.path}</code>
                <label class="switch">
                    <input type="checkbox" data-config-key="includeFile" data-file-path="${file.path}" ${isChecked ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
        `;
    });

    renderedHtml += `
        <details class="prompt-section" open>
            <summary>
                <span>代码文件</span>
                <!-- 这里未来可以放一个“全选/全不选”的开关 -->
            </summary>
            <div class="section-content">${filesHtml}</div>
        </details>
    `;
    
    // --- 渲染用户需求部分 ---
    renderedHtml += `
        <details class="prompt-section" open>
            <summary>
                <span>用户需求</span>
                <label class="switch">
                    <input type="checkbox" data-config-key="includeRequirements" ${includeRequirements ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </summary>
            <div class="section-content">${window.marked.parse(requirements)}</div>
        </details>
    `;

    renderedHtml += '</div>';
    aiPromptContentEl.innerHTML = renderedHtml;

    aiPromptContentEl.querySelectorAll('details').forEach(d => d.open = true);}

export function updateModeLabel() {
    const labelEl = document.getElementById('modeLabel');
    if (!labelEl) return;
    labelEl.textContent = state.isRequirementMode ? '需求模式' : '浏览模式';
}

// --- 窗口渲染 ---
export function renderWindows() {
    for (const id in state.windows) {
        const windowState = state.windows[id];
        const windowEl = document.getElementById(`${id}-window`);
        if (windowEl) {
            windowEl.style.transform = `translate(${windowState.x}px, ${windowState.y}px)`;
            windowEl.style.width = `${windowState.width}px`;
            windowEl.style.height = `${windowState.height}px`;
            windowEl.style.zIndex = windowState.zIndex;
            // 将位置数据也存储在data属性中，供interact.js使用
            windowEl.setAttribute('data-x', windowState.x);
            windowEl.setAttribute('data-y', windowState.y);
        }
    }
}


// --- 文件树渲染 ---
function getFileIconClass(filename) {
    if (filename.endsWith('.html')) return 'icon-file-html';
    if (filename.endsWith('.css')) return 'icon-file-css';
    if (filename.endsWith('.js')) return 'icon-file-js';
    return 'icon-file';
}

function createTree(container, children, pathPrefix) {
    Object.keys(children).sort().forEach(name => {
        const item = children[name];
        const currentPath = `${pathPrefix}/${name}`;
        const li = document.createElement('li');
        const div = document.createElement('div');
        div.className = 'tree-item';
        div.dataset.path = currentPath;
        div.dataset.name = name;
        const icon = document.createElement('span');
        if (item.type === 'folder') {
            div.classList.add('folder');
            icon.className = 'icon-folder';
            div.appendChild(icon);
            div.innerHTML += `<span>${name}</span>`;
            li.appendChild(div);
            const subUl = document.createElement('ul');
            li.appendChild(subUl);
            if (item.children) createTree(subUl, item.children, currentPath);
        } else {
            div.classList.add('file');
            icon.className = getFileIconClass(name);
            div.appendChild(icon);
            div.innerHTML += `<span>${name}</span>`;
            li.appendChild(div);
        }
        container.appendChild(li);
    });
}

export function renderFileTree() {
    if (!state.rootHandle) {
        fileExplorerPanel.classList.remove('project-loaded');
        projectRootNameEl.textContent = '项目文件';
        fileTreeEl.innerHTML = '<div class="welcome-view">请打开一个项目文件夹...</div>';
        return;
    }
    fileExplorerPanel.classList.add('project-loaded');
    projectRootNameEl.textContent = state.rootHandle.name;
    fileTreeEl.innerHTML = '';
    const rootUl = document.createElement('ul');
    createTree(rootUl, state.fileTree.children, state.fileTree.handle.name);
    fileTreeEl.appendChild(rootUl);
    updateActiveFileUI();
}

export function updateEditor(content, isReadOnly) {
    console.log('%c[UI DEBUG] 3. `updateEditor` function CALLED.', 'color: orange; font-weight: bold;');
    console.log(`[UI DEBUG] 3a. Received content length: ${content ? content.length : '0'}, isReadOnly: ${isReadOnly}`);
    
    console.log('[UI DEBUG] 3b. Checking `codeMirrorInstance` BEFORE update. Current value:', codeMirrorInstance);

    if (!codeMirrorInstance) {
        console.error("[UI DEBUG] FATAL: `updateEditor` was called, but `codeMirrorInstance` is null or undefined. UI cannot be updated.");
        return;
    }

    try {
        console.log('[UI DEBUG] 3c. Calling `codeMirrorInstance.setValue()`...');
        codeMirrorInstance.setValue(content);
        console.log('[UI DEBUG] 3d. Calling `codeMirrorInstance.setOption("readOnly", ...)`...');
        codeMirrorInstance.setOption('readOnly', isReadOnly);
        
        if (state.activeFile.path) {
            const mode = getModeForFile(state.activeFile.path);
            console.log(`[UI DEBUG] 3e. Setting mode for "${state.activeFile.path}" to "${mode}"`);
            codeMirrorInstance.setOption('mode', mode);
        }
        // [核心修复] 强制 CodeMirror 实例在内容设置后刷新其视图
        setTimeout(() => {
            codeMirrorInstance.refresh();
            console.log('%c[UI DEBUG] 3g. `codeMirrorInstance.refresh()` CALLED.', 'color: red; font-weight: bold;');
        }, 1); // 使用微小的延迟确保DOM更新已完成

        console.log('%c[UI DEBUG] 3f. `updateEditor` function FINISHED successfully.', 'color: orange; font-weight: bold;');
    } catch (error) {
        console.error('[UI DEBUG] An error occurred inside `updateEditor`:', error);
    }
}

export function updateActiveFileUI() {
    const { path, isModified } = state.activeFile;

    // 更新保存按钮状态
    const saveBtn = document.getElementById('saveFileBtn');
    if (saveBtn) {
        saveBtn.disabled = !isModified;
    }

    const previewBtn = document.getElementById('previewFileBtn');
    if (previewBtn) {
        const isHtml = path && path.toLowerCase().endsWith('.html');
        previewBtn.disabled = !isHtml;
    }

    // 更新窗口标题中的文件名
    const fileNameEl = document.getElementById('openedFileName');
    if (fileNameEl) {
        // [核心修复] 确保在没有活动文件时，标题能正确回退
        fileNameEl.textContent = path ? path.split('/').pop() : 'Code 编辑';
    }
    
    // 更新文件树中的高亮项
    // 先移除所有旧的高亮
    const currentActive = document.querySelector('.tree-item.active');
    if (currentActive) {
        currentActive.classList.remove('active');
    }
    const currentModified = document.querySelector('.tree-item.modified');
    if (currentModified) {
        currentModified.classList.remove('modified');
    }

    // 再为新文件添加高亮
    if (path) {
        const activeEl = document.querySelector(`.tree-item[data-path="${path}"]`);
        if (activeEl) {
            activeEl.classList.add('active');
            activeEl.classList.toggle('modified', isModified);
        }
    }
}


// --- 浏览器窗口 UI ---
export function renderTabs() {
    tabsContainer.innerHTML = '';
    state.browserTabs.tabs.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = 'tab';
        tabEl.dataset.path = tab.path;
        tabEl.textContent = tab.path.split('/').pop();
        if (tab.path === state.browserTabs.activeTabPath) {
            tabEl.classList.add('active');
        }
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-tab-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = '关闭标签页';
        closeBtn.dataset.path = tab.path;
        tabEl.appendChild(closeBtn);
        tabsContainer.appendChild(tabEl);
    });
}

export function renderPreview(htmlContent, stylesToInject = '') {
    const content = `
        <!DOCTYPE html><html><head><style>${stylesToInject}</style></head>
        <body>${htmlContent}</body></html>`;
    previewFrame.srcdoc = content;
}

export function applyCommentMarkers() {
    const doc = previewFrame.contentDocument;
    if (!doc || !state.browserTabs.activeTabPath) return;

    const comments = state.fileComments[state.browserTabs.activeTabPath] || [];
    doc.querySelectorAll('.commented-element').forEach(el => {
        el.classList.remove('commented-element');
        delete el.dataset.selector;
    });
    
    comments.forEach(comment => {
        const el = doc.querySelector(comment.selector);
        if (el) {
            el.classList.add('commented-element');
            el.dataset.selector = comment.selector;
        }
    });
}


// --- 需求清单弹窗 UI ---
function createRequirementListItem(req, index) {
    const li = document.createElement('li');
    li.className = 'requirement-item';
    li.innerHTML = `
        <p data-index="${index}" data-action="edit" title="点击编辑">${req.text}</p>
        <div class="state-buttons" data-index="${index}">
            <button class="state-btn ${req.state === 'pending' ? 'active' : ''}" data-state="pending">待解决</button>
            <button class="state-btn ${req.state === 'resolved' ? 'active' : ''}" data-state="resolved">已解决</button>
            <button class="state-btn ${req.state === 'low_priority' ? 'active' : ''}" data-state="low_priority">低优先</button>
        </div>
        <button class="delete-btn" data-index="${index}" title="删除此需求">×</button>`;
    return li;
}

export function showRequirementModal(selector, requirements) {
    // [核心修复] UI 函数现在直接接收数据，而不是自己去获取
    setState({ activeRequirementTarget: { selector } });
    requirementListEl.innerHTML = '';
    
    if (requirements.length > 0) {
        requirements.forEach((req, index) => {
            requirementListEl.appendChild(createRequirementListItem(req, index));
        });
    } else {
        requirementListEl.innerHTML = `<li><p style="color: #888; text-align: center; padding: 20px 0;">暂无需求，请在下方添加。</p></li>`;
    }

    newRequirementTextEl.value = '';
    requirementModal.style.display = 'flex';
    newRequirementTextEl.focus();
}

export function hideRequirementModal() {
    requirementModal.style.display = 'none';
    setState({ activeRequirementTarget: { selector: null } });
}


// --- 其他 UI ---
export function showContextMenu(x, y) {
    contextMenuEl.style.display = 'block';
    contextMenuEl.style.left = `${x}px`;
    contextMenuEl.style.top = `${y}px`;
}

export function hideContextMenu() {
    contextMenuEl.style.display = 'none';
}