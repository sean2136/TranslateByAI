# AI Video Translator

一个基于AI的实时视频翻译浏览器插件，专为YouTube等在线视频平台设计。支持Chrome和Microsoft Edge浏览器。

## 功能特点

- 🤖 **AI智能翻译**: 集成Google Gemini和DeepSeek大语言模型，提供高质量的语义翻译
- ⚡ **实时翻译**: 根据视频播放进度同步显示翻译字幕
- 🎨 **自定义样式**: 支持字幕字体、颜色、大小、位置等个性化设置
- 🎯 **智能过滤**: 自动过滤YouTube UI文字，只翻译真正的视频字幕
- 🌍 **多语言支持**: 支持多种源语言和目标语言
- 💾 **性能优化**: 防抖翻译、智能缓存，减少API调用
- 🔧 **跨浏览器兼容**: 支持Chrome和Microsoft Edge浏览器

## 安装方法

### Chrome浏览器
1. 下载或克隆此项目到本地
2. 打开Chrome浏览器，进入扩展程序管理页面 (`chrome://extensions/`)
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹
6. 插件安装完成

### Microsoft Edge浏览器
1. 下载或克隆此项目到本地
2. 打开Edge浏览器，进入扩展管理页面 (`edge://extensions/`)
3. 开启"开发人员模式"
4. 点击"加载解压缩的扩展"
5. 选择项目文件夹
6. 插件安装完成

## 使用方法

1. **获取API Key**:
   - Google Gemini: 访问 [Google AI Studio](https://aistudio.google.com/) 获取API Key
   - DeepSeek: 访问 [DeepSeek平台](https://platform.deepseek.com) 获取API Key

2. **配置插件**:
   - 点击浏览器工具栏中的插件图标
   - 选择AI服务提供商（Google Gemini 或 DeepSeek）
   - 输入对应的API Key
   - 选择目标翻译语言
   - 自定义字幕样式和位置（可选）

3. **开始使用**:
   - 开启翻译功能
   - 访问YouTube视频页面
   - 确保视频有字幕（自动生成或手动添加）
   - 享受实时AI翻译

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
- **AI服务**: Google Gemini API, DeepSeek API
- **平台**: Chrome Extension Manifest V3
- **兼容性**: Chrome, Microsoft Edge
- **目标网站**: YouTube (可扩展到其他视频平台)

## 主要特性

- ✅ **实时字幕提取**: 自动检测和提取YouTube视频字幕
- ✅ **AI翻译集成**: 支持Google Gemini和DeepSeek两种AI服务
- ✅ **智能文本过滤**: 过滤YouTube UI文字，只翻译视频内容
- ✅ **自定义样式**: 字幕颜色、大小、位置完全可定制
- ✅ **性能优化**: 防抖处理、智能缓存减少API调用
- ✅ **跨浏览器支持**: Chrome和Edge完全兼容
- ✅ **用户友好界面**: 直观的设置面板和状态提示

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 许可证

MIT License
