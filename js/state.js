// js/state.js

// js/state.js: 管理应用的所有共享状态 (已修复深层合并问题)

const state = {
    // 文件系统状态
    rootHandle: null,
    fileTree: {},
    activeFile: {
        handle: null,
        path: null,
        isModified: false,
    },
    contextMenuTarget: {
        handle: null,
        parentHandle: null,
        path: null,
        element: null,
    },
    
    // 需求清单状态
    fileComments: {}, // { 'path/to/file.html': [{ selector, requirements: [{text, state}] }] }
    activeRequirementTarget: {
        selector: null, 
    },

    // 窗口化UI状态
    windows: {
        'code-editor': { x: 20, y: 20, width: 650, height: 500, zIndex: 10, maximized: false },
        'browser': { x: 690, y: 20, width: 750, height: 800, zIndex: 10, maximized: false },
        'ai-prompt': { x: 20, y: 540, width: 650, height: 280, zIndex: 10, maximized: false }
    },
    highestZIndex: 10,

    // 浏览器窗口标签页状态
    browserTabs: {
        tabs: [],
        activeTabPath: null
    },

    // [核心新增] 全局模式状态
    isRequirementMode: true,

    // AI提示词生成器状态
    generatedPromptParts: {
        system: null,
        files: [], // Array of objects: { path, content }
        requirements: null
    },
    promptConfig: {
        includeSystem: true,
        includeRequirements: true,
        includedFiles: {} // e.g., { 'path/to/file.html': true }
    }
};

/**
 * 检查一个项目是否是可合并的普通对象
 * @param {*} item 
 * @returns {boolean}
 */
function isMergeableObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * 深度合并一个或多个源对象的属性到目标对象
 * @param {object} target - 目标对象
 * @param  {...object} sources - 一个或多个源对象
 */
function deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isMergeableObject(target) && isMergeableObject(source)) {
        for (const key in source) {
            const sourceValue = source[key];
            
            // [核心修复] 检查值是否为 FileSystemHandle。如果是，则直接赋值，不进行深层合并。
            // 这是特殊浏览器对象，必须保持其完整性。
            const isFileSystemHandle = window.FileSystemHandle && sourceValue instanceof window.FileSystemHandle;

            if (isMergeableObject(sourceValue) && !isFileSystemHandle) {
                if (!target[key] || !isMergeableObject(target[key])) {
                    target[key] = {};
                }
                deepMerge(target[key], sourceValue);
            } else {
                target[key] = sourceValue;
            }
        }
    }

    return deepMerge(target, ...sources);
}

export function setState(newState) {
    deepMerge(state, newState);
}

export default state;