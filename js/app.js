// js/app.js: 应用主入口，负责初始化和事件协调

import state, { setState } from './state.js';
import * as ui from './ui.js';
import * as fs from './fileSystem.js';
import * as ai from './aiFeatures.js';
import * as tabs from './browserTabs.js';
import * as wm from './windowManager.js';
import { showToast } from './toast.js';

// --- DOM 元素 ---
const openProjectBtn = document.getElementById('openProjectBtn');
const fileTreeEl = document.getElementById('fileTree');
const saveFileBtn = document.getElementById('saveFileBtn');
const previewFileBtn = document.getElementById('previewFileBtn');
const contextMenuEl = document.getElementById('contextMenu');
const previewFrame = document.getElementById('previewFrame');
const requirementModal = document.getElementById('requirementModal');
const requirementListEl = document.getElementById('requirementList');
const addRequirementForm = document.getElementById('addRequirementForm');
const closeRequirementModalBtn = document.getElementById('closeRequirementModalBtn');
const generatePromptBtn = document.getElementById('generatePromptBtn');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const newFileBtn = document.getElementById('newFileBtn');
const newFolderBtn = document.getElementById('newFolderBtn');
const browserRefreshBtn = document.getElementById('browserRefreshBtn');
const tabsContainer = document.getElementById('tabs-container');
const aiPromptContentEl = document.getElementById('ai-prompt-content');
const modeSwitch = document.getElementById('modeSwitch');


// 提取注入的样式，以便复用
const HIGHLIGHT_STYLES = `
    .highlighted-element { outline: 2px solid orange !important; box-shadow: 0 0 8px orange !important; cursor: pointer !important; }
    .commented-element { outline: 2px solid purple !important; }
`;

// --- 初始化 ---
function init() {
    if (window.location.protocol === 'file:') {
        alert('错误：项目不能通过 file:/// 协议直接运行。\n\n请通过本地Web服务器 (如 "python server.py") 来启动本项目，然后访问 http://localhost:PORT。');
        openProjectBtn.disabled = true;
        openProjectBtn.title = '请通过本地服务器运行';
        return;
    }
    wm.init(); // 初始化窗口系统
    ui.initCodeEditor(handleCodeInputChange); // 初始化 CodeMirror 编辑器


    // --- 事件绑定 ---
    openProjectBtn.addEventListener('click', handleOpenProject);
    newFileBtn.addEventListener('click', () => handleHeaderActionClick(false));
    newFolderBtn.addEventListener('click', () => handleHeaderActionClick(true));

    fileTreeEl.addEventListener('click', handleFileTreeClick);
    fileTreeEl.addEventListener('contextmenu', handleFileTreeContextMenu);
    
    contextMenuEl.addEventListener('click', handleContextMenuAction);
    document.addEventListener('click', ui.hideContextMenu);

    // saveFileBtn 的主要触发逻辑改为自动保存
    saveFileBtn.addEventListener('click', handleSaveFile);
    saveFileBtn.addEventListener('click', handleSaveFile);

    browserRefreshBtn.addEventListener('click', tabs.refreshActiveTab);
    tabsContainer.addEventListener('click', handleTabClick);

    generatePromptBtn.addEventListener('click', ai.generateAIPrompt);
    copyPromptBtn.addEventListener('click', ai.copyAIPrompt);
    aiPromptContentEl.addEventListener('change', handlePromptConfigChange);
    modeSwitch.addEventListener('change', handleModeSwitch);

    previewFrame.addEventListener('load', () => {
        ai.setupPreviewEventListeners(); // 设置AI相关的交互（黄框、紫框、需求弹窗）
        tabs.setupNavigationListeners(); // 设置页面间的导航交互
        if (state.isRequirementMode) {
            ui.applyCommentMarkers();
        }
    });

    addRequirementForm.addEventListener('submit', handleAddRequirement);
    requirementListEl.addEventListener('click', handleRequirementListClick);
    requirementListEl.addEventListener('keydown', handleRequirementEdit);
    requirementListEl.addEventListener('blur', handleRequirementEdit, true); // 使用捕获阶段确保blur事件被触发
    closeRequirementModalBtn.addEventListener('click', ui.hideRequirementModal);
}

// --- 事件处理器 ---
function isValidFilename(name) {
    if (!name || name.trim().length === 0) return false;
    const invalidChars = /[\\/:*?"<>|]/;
    return !invalidChars.test(name);
}

async function handleOpenProject() {
    // 自动保存当前打开的任何未保存文件
    await handleSaveFile();
    const handle = await fs.openDirectoryPicker();
    if (handle) {
        const fileTree = await fs.processDirectory(handle);
        setState({ fileTree });
        ui.renderFileTree();
    }
}

async function handleHeaderActionClick(isFolder) {
    if (!state.rootHandle) {
        showToast('请先打开一个项目文件夹。', 'info');
        return;
    }
    const newName = prompt(`在项目根目录输入新的${isFolder ? '文件夹' : '文件'}名:`);
    if (!newName) return;
    if (!isValidFilename(newName)) {
        showToast('名称无效！不能包含 \\ / : * ? " < > |', 'error');
        return;
    }
    try {
        await fs.createEntry(state.rootHandle, newName, isFolder);
        const newTree = await fs.processDirectory(state.rootHandle);
        setState({ fileTree: newTree });
        ui.renderFileTree();
    } catch (err) {
        showToast('创建失败，可能名称已存在', 'error');
        console.error(`在根目录创建失败:`, err);
    }
}

async function handleFileTreeClick(e) {
    const target = e.target.closest('.tree-item');
    if (!target) return;

    if (target.classList.contains('folder')) {
        target.classList.toggle('collapsed');
        const subUl = target.nextElementSibling;
        if (subUl) subUl.style.display = target.classList.contains('collapsed') ? 'none' : 'block';
        return;
    }

    const path = target.dataset.path;
    // [核心BUG修复] 将预览逻辑提前，并使其无条件执行
    try {
        const { handle } = await fs.getHandleByPath(path);
        if (handle?.kind === 'file' && path.toLowerCase().endsWith('.html')) {
            // 只要是HTML文件被点击，就尝试在浏览器中打开或切换标签页
            await tabs.openTab(path, handle);
        }
    } catch (err) {
        // 即便预览失败，也要继续尝试在编辑器中打开
        console.error(`Preview failed for "${path}", but continuing to open in editor.`, err);
    }
    
    // 如果点击的已经是活动文件，则仅执行上面的预览逻辑，不再重新加载编辑器
    if (state.activeFile.path === path) return;
    
    await handleSaveFile();

    try {
        const { handle } = await fs.getHandleByPath(path);
        if (handle?.kind === 'file') {
            const content = await fs.readFile(handle);
            
            setState({ activeFile: { handle, path, isModified: false } });
            
            ui.updateEditor(content, false);
            ui.updateActiveFileUI();
            
            // 此处的 openTab 调用现在是多余的，但保留也无害，因为 openTab 内部有防重逻辑
            // if (path.toLowerCase().endsWith('.html')) {
            //     await tabs.openTab(path, handle);
            // }
        }
    } catch (err) {
        showToast('打开文件失败', 'error');
        console.error(`Failed to open file "${path}". See detailed error below:`, err);
    }
}

async function handleFileTreeContextMenu(e) {
    e.preventDefault();
    const target = e.target.closest('.tree-item');
    if (!target) return;
    const path = target.dataset.path;
    const { handle, parentHandle } = await fs.getHandleByPath(path);
    setState({ contextMenuTarget: { handle, parentHandle, path, element: target } });
    ui.showContextMenu(e.clientX, e.clientY);
}

async function handlePreviewFile() {
    const { handle, path } = state.activeFile;
    if (handle && path && path.toLowerCase().endsWith('.html')) {
        try {
            await tabs.openTab(path, handle);
        } catch (err) {
            showToast('预览失败', 'error');
            console.error(`Preview from button failed for "${path}".`, err);
        }
    }
}

async function handleContextMenuAction(e) {
    const action = e.target.dataset.action;
    if (!action) return;

    const { handle, parentHandle, path, element } = state.contextMenuTarget;
    const name = element.dataset.name;

    try {
        switch (action) {
            case 'newFile':
            case 'newFolder': {
                const isFolder = action === 'newFolder';
                const newName = prompt(`输入新的${isFolder ? '文件夹' : '文件'}名:`);
                if (!newName) return;
                if (!isValidFilename(newName)) {
                    showToast('名称无效！不能包含 \\ / : * ? " < > |', 'error');
                    return;
                }
                const targetDir = handle.kind === 'directory' ? handle : parentHandle;
                await fs.createEntry(targetDir, newName, isFolder);
                break;
            }
            case 'delete': {
                if (!confirm(`确定要删除 "${name}" 吗？此操作不可恢复！`)) return;
                await fs.deleteEntry(parentHandle, name, handle.kind === 'directory');
                if (state.activeFile.path?.startsWith(path)) {
                    setState({ activeFile: { handle: null, path: null, isModified: false } });
                    ui.updateEditor('', true);
                }
                showToast(`"${name}" 已删除`);
                break;
            }
            case 'rename': {
                const newName = prompt(`重命名 "${name}":`, name);
                if (!newName || newName === name) return;
                if (!isValidFilename(newName)) {
                    showToast('新名称无效！', 'error');
                    return;
                }
                
                await fs.renameEntry(parentHandle, name, newName);

                if (state.activeFile.path) {
                    const oldPathPrefix = path;
                    const newPathPrefix = path.substring(0, path.lastIndexOf('/') + 1) + newName;
                    if (state.activeFile.path.startsWith(oldPathPrefix)) {
                        const newActivePath = state.activeFile.path.replace(oldPathPrefix, newPathPrefix);
                        const { handle: newActiveFileHandle } = await fs.getHandleByPath(newActivePath);
                        setState({ 
                            activeFile: { 
                                ...state.activeFile, 
                                path: newActivePath, 
                                handle: newActiveFileHandle 
                            } 
                        });
                    }
                }
                showToast(`已重命名为 "${newName}"`);
                break;
            }
        }
        const newTree = await fs.processDirectory(state.rootHandle);
        setState({ fileTree: newTree });
        ui.renderFileTree();
    } catch (err) {
        showToast(`${action} 操作失败`, 'error');
        console.error(`${action} 操作失败:`, err);
    }
}

async function handleCodeInputChange() {
    if (state.activeFile.handle && !state.activeFile.isModified) {
        setState({ activeFile: { ...state.activeFile, isModified: true } });
        ui.updateActiveFileUI();
    }
}

async function handleSaveFile() {
    const { handle, path, isModified } = state.activeFile;
    if (!handle || !isModified) return;

    try {
        await fs.saveFile(handle, ui.getEditorContent());
        setState({ activeFile: { ...state.activeFile, isModified: false } });
        ui.updateActiveFileUI();
        showToast(`"${path.split('/').pop()}" 已保存`);
    } catch (err) {
        showToast('保存失败', 'error');
        console.error('Save file failed:', err);
    }
}

function handleTabClick(e) {
    // [核心修复] 使用事件委托来处理标签页的点击和关闭
    const target = e.target;
    
    // 如果点击的是关闭按钮
    if (target.matches('.close-tab-btn')) {
        e.stopPropagation();
        const path = target.dataset.path;
        if (path) {
            tabs.closeTab(path);
        }
        return;
    }
    
    // 如果点击的是标签页本身
    const tabEl = target.closest('.tab');
    if (tabEl) {
        tabs.switchTab(tabEl.dataset.path);
    }
}

function handleAddRequirement(e) {
    e.preventDefault();
    const textInput = document.getElementById('newRequirementText');
    const newText = textInput.value.trim();
    
    if (newText && state.activeRequirementTarget.selector) {
        ai.addRequirement(state.activeRequirementTarget.selector, newText);
        const updatedRequirements = ai.getRequirementsForElement(state.activeRequirementTarget.selector);
        // [核心修复] 将选择器和最新的需求列表一并传递给UI函数进行渲染
        ui.showRequirementModal(state.activeRequirementTarget.selector, updatedRequirements);
        ui.applyCommentMarkers();
    }
    textInput.value = '';
    textInput.focus();
}

function handleRequirementListClick(e) {
    const target = e.target;
    const { selector } = state.activeRequirementTarget;
    if (!selector) return;

    if (target.matches('.state-btn')) {
        const reqIndex = parseInt(target.parentElement.dataset.index, 10);
        const newState = target.dataset.state;
        ai.updateRequirementState(selector, reqIndex, newState);
        const requirements = ai.getRequirementsForElement(selector);
        ui.showRequirementModal(selector, requirements);
    }

    if (target.matches('.delete-btn')) {
        const reqIndex = parseInt(target.dataset.index, 10);
        if (confirm('确定要删除这条需求吗？')) {
            ai.deleteRequirement(selector, reqIndex);
            // [核心修复] 在删除后，也重新获取完整的需求列表来刷新UI
            const requirements = ai.getRequirementsForElement(selector);
            ui.showRequirementModal(selector, requirements);
            ui.applyCommentMarkers();
        }
    }

    // [核心新增] 处理点击需求文本，进入编辑模式
    if (target.matches('p[data-action="edit"]')) {
        const p = target;
        const currentText = p.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'edit-input'; // 添加一个类以便识别
        input.dataset.index = p.dataset.index; // 继承索引
        
        p.replaceWith(input);
        input.focus();
        input.select();
    }
}

// [核心新增] 新的事件处理器，用于保存编辑
function handleRequirementEdit(e) {
    if (!e.target.matches('.edit-input')) return;

    // 当按下Enter键或输入框失去焦点时保存
    if (e.type === 'keydown' && e.key !== 'Enter') return;
    if (e.type === 'blur' && !e.target.value.trim()) return; // 如果是空的，blur时不保存

    const input = e.target;
    const newText = input.value.trim();
    const reqIndex = parseInt(input.dataset.index, 10);
    const { selector } = state.activeRequirementTarget;

    if (newText) {
        ai.editRequirement(selector, reqIndex, newText);
    }
    
    // 重新渲染整个模态框以恢复显示状态
    const requirements = ai.getRequirementsForElement(selector);
    ui.showRequirementModal(selector, requirements);
}

// [核心新增] 新的事件处理器，用于响应开关状态变化
function handlePromptConfigChange(e) {
    const input = e.target;
    if (input.type !== 'checkbox') return;

    const key = input.dataset.configKey;
    if (!key) return;

    if (key === 'includeFile') {
        const path = input.dataset.filePath;
        setState({
            promptConfig: {
                ...state.promptConfig,
                includedFiles: {
                    ...state.promptConfig.includedFiles,
                    [path]: input.checked
                }
            }
        });
    } else {
        setState({
            promptConfig: {
                ...state.promptConfig,
                [key]: input.checked
            }
        });
    }
}

function handleModeSwitch(e) {
    const isRequirementMode = e.target.checked;
    setState({ isRequirementMode });
    ui.updateModeLabel(); // [核心新增] 切换模式后立即更新标签

    
    // 模式切换后，立即刷新预览以应用或移除监听器和标记
    tabs.refreshActiveTab();
}

// 启动应用
init();