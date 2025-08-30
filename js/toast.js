// js/toast.js: 一个轻量级的、非阻塞的通知模块

// 在body中创建一个用于容纳所有toast通知的容器
const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
document.body.appendChild(toastContainer);

/**
 * 显示一个Toast通知
 * @param {string} message - 要显示的消息文本
 * @param {'success' | 'error' | 'info'} type - 通知的类型 (success, error, info)
 * @param {number} duration - 通知显示的毫秒数
 */
export function showToast(message, type = 'success', duration = 3000) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // 添加到容器中，触发入场动画
    toastContainer.appendChild(toast);
    
    // 设置定时器，在指定时间后移除toast
    setTimeout(() => {
        // 添加退场动画类
        toast.classList.add('toast-fade-out');
        
        // 在动画结束后从DOM中彻底移除元素
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, duration);
}