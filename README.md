# AI Video Translator

一个基于AI的实时视频翻译Chrome浏览器插件，专为YouTube等在线视频平台设计。

## 功能特点

- 🤖 **AI智能翻译**: 集成DeepSeek大语言模型，提供高质量的语义翻译
- ⚡ **实时翻译**: 根据视频播放进度同步显示翻译字幕
- 🎨 **自定义样式**: 支持字幕字体、颜色、大小等个性化设置
- 🎯 **无干扰显示**: 字幕智能定位，不遮挡重要视频内容
- 🌍 **多语言支持**: 支持多种源语言和目标语言
- 💾 **智能缓存**: 翻译结果缓存，提升性能和用户体验

## 安装方法

1. 下载或克隆此项目到本地
2. 打开Chrome浏览器，进入扩展程序管理页面 (`chrome://extensions/`)
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹
6. 插件安装完成

## 使用方法

1. 在DeepSeek平台 (https://platform.deepseek.com) 获取API Key
2. 点击浏览器工具栏中的插件图标
3. 在设置中输入DeepSeek API Key
4. 选择源语言和目标语言
5. 自定义字幕样式（可选）
6. 开启翻译功能
7. 访问YouTube视频页面，享受实时翻译

## 项目结构

```
translate/
├── manifest.json          # Chrome插件配置文件
├── background.js          # 后台脚本
├── content.js            # 内容脚本
├── content.css           # 内容脚本样式
├── popup.html            # 弹出窗口HTML
├── popup.css             # 弹出窗口样式
├── popup.js              # 弹出窗口脚本
├── icons/                # 插件图标目录
├── src/                  # 源代码目录
└── styles/               # 样式文件目录
```

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **API**: DeepSeek大语言模型API
- **平台**: Chrome Extension Manifest V3
- **目标网站**: YouTube (可扩展到其他视频平台)

## 开发计划

- [x] 项目初始化和基础架构
- [ ] 视频字幕提取功能
- [ ] DeepSeek API集成
- [ ] 实时翻译引擎
- [ ] 字幕渲染系统
- [ ] 用户界面和设置
- [ ] 性能优化和缓存
- [ ] 测试和调试

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 许可证

MIT License
