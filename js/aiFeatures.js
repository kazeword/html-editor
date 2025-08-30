// js/aiFeatures.js

import state, { setState } from './state.js';
import * as ui from './ui.js';
import { showToast } from './toast.js';

// ... (generateCssSelector, getRequirementsForElement, etc. functions remain unchanged) ...
function generateCssSelector(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id) {
        const escapedId = el.id.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
        return `#${escapedId}`;
    }

    const path = [];
    let currentEl = el;
    while (currentEl && currentEl.parentElement) {
        let selectorPart = currentEl.tagName.toLowerCase();
        if (selectorPart === 'body') {
            path.unshift('body');
            break;
        }

        let nth = 1;
        let sibling = currentEl.previousElementSibling;
        while (sibling) {
            if (sibling.tagName.toLowerCase() === currentEl.tagName.toLowerCase()) nth++;
            sibling = sibling.previousElementSibling;
        }
        selectorPart += `:nth-of-type(${nth})`;
        path.unshift(selectorPart);
        currentEl = currentEl.parentElement;
    }

    return path.length > 0 && path[0] === 'body' ? path.join(' > ') : null;
}

export function getRequirementsForElement(selector) {
    const activeHtmlPath = state.browserTabs.activeTabPath;
    if (!activeHtmlPath || !state.fileComments[activeHtmlPath]) return [];
    
    const commentData = state.fileComments[activeHtmlPath].find(c => c.selector === selector);
    return commentData ? commentData.requirements : [];
}

export function setupPreviewEventListeners() {
    const doc = previewFrame.contentDocument;
    if (!doc || !doc.body) return;
    
    // [核心修复] 只有在需求模式下才绑定交互事件
    if (!state.isRequirementMode) {
        // 在浏览模式下，只做清理，不绑定任何新事件
        const cleanBody = doc.body.cloneNode(true);
        doc.body.replaceWith(cleanBody);
        return;
    }

    const newBody = doc.body.cloneNode(true);

    // [核心修复] 重写事件监听逻辑
    newBody.addEventListener('mouseover', e => {
        const target = e.target;
        // 只有当目标元素本身不是紫框，也不是body时，才显示黄框
        if (target.classList && !target.classList.contains('commented-element') && target !== newBody) {
            target.classList.add('highlighted-element');
        }
    });
    
    newBody.addEventListener('mouseout', e => {
        if (e.target.classList) {
            e.target.classList.remove('highlighted-element');
        }
    });

    newBody.addEventListener('click', e => {
        // [核心重构] 如果点击的是链接，则忽略此监听器，交由专门的导航监听器处理
        if (e.target.closest('a')) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        
        const target = e.target;
        if (target.classList) {
            target.classList.remove('highlighted-element');
        }

        let selector;
        // 优先判断：用户是否直接点击了一个已标记（紫框）的元素
        if (target.classList.contains('commented-element')) {
            // 如果是，则意图是“回访”，使用该元素已有的选择器
            selector = target.dataset.selector;
        } 
        // 否则，意图是为新元素（即使它在紫框内部）添加需求
        else if (target !== newBody) { 
            // 为当前被点击的、未标记的元素生成一个全新的选择器
            selector = generateCssSelector(target);
        }

        if (selector) {
            const requirements = getRequirementsForElement(selector);
            ui.showRequirementModal(selector, requirements);
        }
    });
    
    doc.body.replaceWith(newBody);
}

export function addRequirement(selector, text) {
    const activeHtmlPath = state.browserTabs.activeTabPath;
    if (!text || !selector || !activeHtmlPath) return;

    if (!state.fileComments[activeHtmlPath]) {
        state.fileComments[activeHtmlPath] = [];
    }
    
    let commentData = state.fileComments[activeHtmlPath].find(c => c.selector === selector);
    
    if (!commentData) {
        commentData = { selector, requirements: [] };
        state.fileComments[activeHtmlPath].push(commentData);
    }
    
    commentData.requirements.push({ text, state: 'pending' });
}

export function updateRequirementState(selector, reqIndex, newState) {
    const requirements = getRequirementsForElement(selector);
    if (requirements[reqIndex]) {
        requirements[reqIndex].state = newState;
    }
}

export function editRequirement(selector, reqIndex, newText) {
    const activeHtmlPath = state.browserTabs.activeTabPath;
    if (!newText || !selector || !activeHtmlPath) return;

    const commentData = state.fileComments[activeHtmlPath]?.find(c => c.selector === selector);
    if (commentData?.requirements[reqIndex]) {
        commentData.requirements[reqIndex].text = newText;
    }
}

export function deleteRequirement(selector, reqIndex) {
    const activeHtmlPath = state.browserTabs.activeTabPath;
    const commentData = state.fileComments[activeHtmlPath]?.find(c => c.selector === selector);
    if (commentData?.requirements[reqIndex]) {
        commentData.requirements.splice(reqIndex, 1);
        if (commentData.requirements.length === 0) {
            const indexToRemove = state.fileComments[activeHtmlPath].indexOf(commentData);
            if (indexToRemove > -1) state.fileComments[activeHtmlPath].splice(indexToRemove, 1);
        }
    }
}

export function generateAIPrompt() {
    const activeHtmlPath = state.browserTabs.activeTabPath;
    if (!activeHtmlPath) {
        showToast("请在浏览器窗口中打开一个HTML文件", "info");
        return;
    }

    const allPendingRequirements = [];
    const comments = state.fileComments[activeHtmlPath] || [];

    comments.forEach(comment => {
        const pendingReqs = comment.requirements
            .filter(req => req.state === 'pending')
            .map(req => ({ selector: comment.selector, text: req.text }));
        allPendingRequirements.push(...pendingReqs);
    });

    if (allPendingRequirements.length === 0) {
        showToast("当前HTML文件没有“待解决”的修改需求。", "info");
        return;
    }

    // --- [核心重构] 生成支持多文件的新版提示词对象 ---
    
    // 1. 新的、更强大的系统提示词
    const systemPrompt = `你是一个专业的网页设计师和前端开发者AI。你的核心能力是理解并执行可能涉及**创建新文件**或**修改多个现有文件**的复杂任务。

当你返回代码时，你**必须**为每一个你创建或修改的文件，严格遵循以下格式：

\`\`\`
--- START OF FILE path/to/your/file.html ---
[此处是 file.html 的完整代码]
--- END OF FILE path/to/your/file.html ---

--- START OF FILE path/to/another/new-style.css ---
[此处是 new-style.css 的完整代码]
--- END OF FILE path/to/another/new-style.css ---
\`\`\`

请确保只返回这种结构化的代码块，不要包含任何在此格式之外的解释性文字。`;

    // 2. 代码文件
    const fileContent = ui.getEditorContent();
    const fileParts = [{
        path: activeHtmlPath,
        content: fileContent,
    }];
    
    // 3. 用户需求
    let requirementsPrompt = `### 用户修改需求 (请逐一解决):\n`;
    allPendingRequirements.forEach((item, index) => {
        requirementsPrompt += `${index + 1}. **针对元素**: \`${item.selector}\`\n`;
        requirementsPrompt += `   **具体需求**: ${item.text}\n\n`;
    });
    
    // --- 更新 state ---
    const newPromptParts = {
        system: systemPrompt,
        files: fileParts,
        requirements: requirementsPrompt
    };
    
    const newPromptConfig = {
        includeSystem: true,
        includeRequirements: true,
        includedFiles: { [activeHtmlPath]: true }
    };

    setState({ 
        generatedPromptParts: newPromptParts,
        promptConfig: newPromptConfig
    });

    // --- 触发UI渲染 ---
    ui.renderAIPrompt();
}


export function copyAIPrompt() {
    const { system, files, requirements } = state.generatedPromptParts;
    const { includeSystem, includeRequirements, includedFiles } = state.promptConfig;
    
    if (!system && !files.length && !requirements) {
        showToast("没有可复制的提示词内容", "info");
        return;
    }

    let finalPrompt = '';

    if (includeSystem && system) {
        finalPrompt += `${system}\n\n`;
    }

    if (files.length > 0) {
        finalPrompt += "### 当前项目文件代码:\n"
        files.forEach(file => {
            if (includedFiles[file.path]) {
                // [核心重构] 为每个文件添加开始标记
                finalPrompt += `--- START OF FILE ${file.path} ---\n`;
                finalPrompt += `\`\`\`html\n${file.content}\n\`\`\`\n`;
                // [核心重构] 为每个文件添加结束标记
                finalPrompt += `--- END OF FILE ${file.path} ---\n\n`;
            }
        });
    }

    if (includeRequirements && requirements) {
        finalPrompt += `${requirements}`;
    }

    // [核心重构] 更新最终指令，要求AI遵循我们的新格式
    finalPrompt += `请根据以上信息，生成包含所有必要文件修改和新增内容的完整代码，并严格遵循文件标记格式。`;
    
    navigator.clipboard.writeText(finalPrompt).then(() => {
        showToast('提示词已复制!');
    }).catch(err => {
        showToast('复制失败，请检查浏览器权限', 'error');
        console.error('Copy failed:', err);
    });
}