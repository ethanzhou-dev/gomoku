# Gomoku Online (五子棋在线对战)

一个基于 Node.js 和 Socket.io 实现的实时在线五子棋游戏。支持在线房间对战、AI 模式、禁手规则及断线重连。

## 核心功能

- **实时对战**：基于 Socket.io 的低延迟在线房间对战系统。
- **AI 模式**：集成 Web Worker 运行的 AI 算法，支持单机练习。
- **专业规则**：支持 15x15 棋盘及黑棋禁手规则（三三、四四、长连）。
- **对局功能**：支持悔棋申请、求和、续局（交换先后手）等完整对弈流程。
- **弹性连接**：内置 Session 机制，支持 60 秒内断线重连，不丢失对局状态。
- **响应式设计**：简洁的 UI 界面，适配不同尺寸的屏幕。

##  技术栈

- **后端**: Node.js, Express
- **实时通信**: Socket.io
- **前端**: 原生 JavaScript (ES6+), CSS3, HTML5
- **性能优化**: 开启 Gzip 压缩 (`compression`)，AI 计算运行在 Web Worker。

##  快速开始

### 1. 克隆项目
```bash
git clone https://github.com/Ethan-iae/Gomoku.git
cd Gomoku
```

### 2. 安装依赖
```bash
npm install
```

### 3. 启动服务
```bash
npm start
```
默认运行在 `http://localhost:3000`。

##  项目结构

```text
├── package-lock.json   # 依赖锁定文件
├── package.json        # 项目配置与依赖
├── README.md           # 项目说明文档
├── server.js           # Express/Socket.io 服务端逻辑
└── public/
    ├── ai-worker.js    # AI 算法逻辑 (Web Worker)
    ├── favicon.png     # 网站图标
    ├── index.html      # 主入口
    ├── rules.js        # 公用游戏规则逻辑 (胜负判定、禁手)
    ├── simkai-lite.ttf # 字体文件
    ├── style.css       # 游戏样式
    └── js/             # 客户端模块化逻辑
        ├── game.js     # 游戏核心逻辑
        ├── gameState.js# 状态管理
        ├── main.js     # 前端入口
        ├── network.js  # 网络通信
        ├── renderer.js # 棋盘渲染
        └── ui.js       # UI 交互控制
```

##  许可

MIT License
