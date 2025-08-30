// js/fileSystem.js

// [验证日志] 如果您在控制台看到此消息，说明新脚本已成功加载。
console.log('%c[AI Assistant] fileSystem.js version 2.0 loaded successfully.', 'color: green; font-weight: bold;');

import state, { setState } from './state.js';
import { showToast } from './toast.js';

export async function openDirectoryPicker() {
    if (!window.showDirectoryPicker) {
        showToast('您的浏览器不支持文件系统访问API', 'error');
        return null;
    }
    try {
        const handle = await window.showDirectoryPicker();
        setState({ rootHandle: handle });
        return handle;
    } catch (err) {
        console.log('打开文件夹操作被取消或失败:', err.name);
        return null;
    }
}

export async function processDirectory(dirHandle) {
    const tree = { handle: dirHandle, type: 'folder', children: {} };
    // 使用 .call() 确保上下文正确
    const entriesIterator = dirHandle.values();
    for await (const entry of entriesIterator) {
        if (entry.kind === 'file') {
            tree.children[entry.name] = { handle: entry, type: 'file' };
        } else if (entry.kind === 'directory') {
            tree.children[entry.name] = await processDirectory(entry);
        }
    }
    return tree;
}

export async function getHandleByPath(path) {
    const parts = path.split('/').slice(1);

    if (!state.rootHandle) {
        throw new Error("Root directory handle is not available.");
    }
    
    let currentHandle = state.rootHandle;
    let parentHandle = state.rootHandle;
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!currentHandle || typeof currentHandle.getDirectoryHandle !== 'function') {
             throw new Error(`Invalid handle at part '${part}' of path '${path}'`);
        }

        if (i < parts.length - 1) { // 如果是路径中间的目录部分
            parentHandle = currentHandle;
            currentHandle = await currentHandle.getDirectoryHandle.call(currentHandle, part);
        } else { // 如果是路径的最后一部分 (文件或文件夹)
            parentHandle = currentHandle;
            try {
                // 先尝试作为目录获取
                currentHandle = await currentHandle.getDirectoryHandle.call(currentHandle, part);
            } catch {
                // 如果失败，再尝试作为文件获取
                currentHandle = await currentHandle.getFileHandle.call(currentHandle, part);
            }
        }
    }
    
    return { handle: currentHandle, parentHandle: parentHandle };
}


export async function readFile(fileHandle) {
    const file = await fileHandle.getFile.call(fileHandle);
    return await file.text();
}

export async function saveFile(fileHandle, content) {
    const writable = await fileHandle.createWritable.call(fileHandle);
    await writable.write.call(writable, content);
    await writable.close.call(writable);
}

export async function createEntry(parentHandle, name, isFolder) {
    if (isFolder) {
        await parentHandle.getDirectoryHandle.call(parentHandle, name, { create: true });
    } else {
        await parentHandle.getFileHandle.call(parentHandle, name, { create: true });
    }
}

export async function deleteEntry(parentHandle, name, isFolder) {
    await parentHandle.removeEntry.call(parentHandle, name, { recursive: isFolder });
}

async function copyDirectory(sourceDirHandle, targetDirHandle) {
    const entries = sourceDirHandle.values();
    for await (const entry of entries) {
        if (entry.kind === 'file') {
            const sourceFile = await entry.getFile.call(entry);
            const newFileHandle = await targetDirHandle.getFileHandle.call(targetDirHandle, entry.name, { create: true });
            const writable = await newFileHandle.createWritable.call(newFileHandle);
            await writable.write.call(writable, sourceFile);
            await writable.close.call(writable);
        } else if (entry.kind === 'directory') {
            const newDirHandle = await targetDirHandle.getDirectoryHandle.call(targetDirHandle, entry.name, { create: true });
            await copyDirectory(entry, newDirHandle);
        }
    }
}

export async function renameEntry(parentHandle, oldName, newName) {
    let handle;
    try {
        handle = await parentHandle.getDirectoryHandle.call(parentHandle, oldName);
    } catch {
        handle = await parentHandle.getFileHandle.call(parentHandle, oldName);
    }

    if (handle.kind === 'file') {
        const file = await handle.getFile.call(handle);
        const newFileHandle = await parentHandle.getFileHandle.call(parentHandle, newName, { create: true });
        const writable = await newFileHandle.createWritable.call(newFileHandle);
        await writable.write.call(writable, file);
        await writable.close.call(writable);
    } else if (handle.kind === 'directory') {
        const newDirHandle = await parentHandle.getDirectoryHandle.call(parentHandle, newName, { create: true });
        await copyDirectory(handle, newDirHandle);
    }

    await parentHandle.removeEntry.call(parentHandle, oldName, { recursive: handle.kind === 'directory' });
}