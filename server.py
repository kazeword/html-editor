import webbrowser
from threading import Timer
from flask import Flask, send_from_directory

# --- 配置 ---
# 您可以在这里修改希望使用的端口号
PORT = 8000
HOST = '127.0.0.1'

# --- Flask 应用设置 ---
# 创建一个Flask应用实例
# static_folder='.' 让Flask从项目根目录提供静态文件
# static_url_path='' 意味着URL路径直接映射到文件系统路径 (例如 /css/style.css)
app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def index():
    """
    定义根路由，用于服务主页面 index.html。
    """
    return send_from_directory('.', 'index.html')

def open_browser():
      """
      在服务器启动后，延迟1秒自动打开浏览器。
      """
      webbrowser.open_new(f'http://{HOST}:{PORT}')

if __name__ == '__main__':
    """
    程序主入口。
    """
    print(f" * AI辅助编辑器正在启动...")
    print(f" * 请在浏览器中打开: http://{HOST}:{PORT}")
    
    # 使用Timer确保在app.run()执行后（即服务器开始监听后）再打开浏览器
    Timer(1, open_browser).start()
    
    # 启动Flask服务器
    # debug=True 可以在修改代码后自动重载，但在这里我们主要用于开发
    # use_reloader=False 防止开启两个进程，确保浏览器只打开一次
    app.run(host=HOST, port=PORT, debug=True, use_reloader=False)