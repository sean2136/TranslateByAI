// Popup script for AI Video Translator
console.log('🎛️ Popup script loading...');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('📋 Popup DOM loaded, initializing...');
  const elements = {
    enableToggle: document.getElementById('enableToggle'),
    sourceLanguage: document.getElementById('sourceLanguage'),
    targetLanguage: document.getElementById('targetLanguage'),
    fontSize: document.getElementById('fontSize'),
    fontColor: document.getElementById('fontColor'),
    backgroundColor: document.getElementById('backgroundColor'),
    backgroundOpacity: document.getElementById('backgroundOpacity'),
    opacityValue: document.getElementById('opacityValue'),
    subtitlePosition: document.getElementById('subtitlePosition'),
    bottomOffset: document.getElementById('bottomOffset'),
    bottomOffsetValue: document.getElementById('bottomOffsetValue'),
    apiProvider: document.getElementById('apiProvider'),
    apiKey: document.getElementById('apiKey'),
    apiKeyHelp: document.getElementById('apiKeyHelp'),
    testTranslationButton: document.getElementById('testTranslationButton'),
    saveButton: document.getElementById('saveButton'),
    status: document.getElementById('status')
  };

  // Load current settings
  await loadSettings();

  // Event listeners
  elements.enableToggle.addEventListener('change', handleToggleChange);
  elements.backgroundOpacity.addEventListener('input', updateOpacityDisplay);
  elements.bottomOffset.addEventListener('input', updateBottomOffsetDisplay);
  elements.apiProvider.addEventListener('change', updateApiProviderHelp);
  elements.apiKey.addEventListener('blur', validateApiKeyOnBlur);
  elements.testTranslationButton.addEventListener('click', testTranslation);
  elements.saveButton.addEventListener('click', saveSettings);
  elements.apiKey.addEventListener('blur', validateApiKeyOnBlur);

  // Load settings from storage
  async function loadSettings() {
    console.log('📖 Loading settings from storage...');
    try {
      const settings = await getStorageData();
      console.log('⚙️ Settings retrieved:', settings);

      elements.enableToggle.checked = settings.enabled || false;
      elements.sourceLanguage.value = settings.sourceLanguage || 'auto';
      elements.targetLanguage.value = settings.targetLanguage || 'zh-CN';
      elements.fontSize.value = settings.subtitleStyle?.fontSize || '16px';
      elements.fontColor.value = settings.subtitleStyle?.color || '#ffffff';

      // Handle background color and opacity
      const bgColor = settings.subtitleStyle?.backgroundColor || 'rgba(0, 0, 0, 0.8)';
      const { color, opacity } = parseRgbaColor(bgColor);
      elements.backgroundColor.value = color;
      elements.backgroundOpacity.value = Math.round(opacity * 100);
      updateOpacityDisplay();

      // Handle position settings
      elements.subtitlePosition.value = settings.subtitleStyle?.position || 'bottom';
      elements.bottomOffset.value = settings.subtitleStyle?.bottomOffset || 150;
      updateBottomOffsetDisplay();

      // Handle API settings
      elements.apiProvider.value = settings.apiProvider || 'deepseek';
      elements.apiKey.value = settings.apiKey || settings.deepseekApiKey || '';
      updateApiProviderHelp();

      console.log('✅ Settings loaded successfully');
      showStatus('设置已加载', 'success');
    } catch (error) {
      console.error('❌ Failed to load settings:', error);
      showStatus('加载设置失败', 'error');
    }
  }

  // Handle toggle change
  async function handleToggleChange() {
    const enabled = elements.enableToggle.checked;
    
    try {
      // Send message to content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.url && (tab.url.includes('youtube.com'))) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggle',
          enabled: enabled
        });
      }
      
      // Save to storage
      await setStorageData({ enabled });
      
      showStatus(enabled ? '翻译已启用' : '翻译已禁用', 'success');
    } catch (error) {
      console.error('Failed to toggle:', error);
      showStatus('切换失败', 'error');
      elements.enableToggle.checked = !enabled; // Revert
    }
  }

  // Update opacity display
  function updateOpacityDisplay() {
    const value = elements.backgroundOpacity.value;
    elements.opacityValue.textContent = `${value}%`;
  }

  // Update bottom offset display
  function updateBottomOffsetDisplay() {
    const value = elements.bottomOffset.value;
    elements.bottomOffsetValue.textContent = `${value}px`;
  }

  // Update API provider help text
  function updateApiProviderHelp() {
    const provider = elements.apiProvider.value;
    if (provider === 'deepseek') {
      elements.apiKeyHelp.innerHTML = '获取API Key: <a href="https://platform.deepseek.com" target="_blank">DeepSeek Platform</a>';
      elements.apiKey.placeholder = '输入您的 DeepSeek API Key';
    } else if (provider === 'gemini') {
      elements.apiKeyHelp.innerHTML = '获取API Key: <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a> (支持Gemini 2.5 Flash Lite)';
      elements.apiKey.placeholder = '输入您的 Gemini API Key';
    }
  }

  // Save all settings
  async function saveSettings() {
    try {
      const settings = {
        enabled: elements.enableToggle.checked,
        sourceLanguage: elements.sourceLanguage.value,
        targetLanguage: elements.targetLanguage.value,
        subtitleStyle: {
          fontSize: elements.fontSize.value,
          fontFamily: 'Arial, sans-serif',
          color: elements.fontColor.value,
          backgroundColor: createRgbaColor(
            elements.backgroundColor.value,
            elements.backgroundOpacity.value / 100
          ),
          position: elements.subtitlePosition.value,
          bottomOffset: parseInt(elements.bottomOffset.value)
        },
        apiProvider: elements.apiProvider.value,
        apiKey: elements.apiKey.value.trim(),
        // Keep backward compatibility
        deepseekApiKey: elements.apiProvider.value === 'deepseek' ? elements.apiKey.value.trim() : ''
      };

      await setStorageData(settings);
      
      // Send updated settings to content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.url && (tab.url.includes('youtube.com'))) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateSettings',
          settings: settings
        });
      }
      
      showStatus('设置已保存', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showStatus('保存设置失败', 'error');
    }
  }

  // Utility functions
  function getStorageData() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, resolve);
    });
  }

  function setStorageData(data) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(data, resolve);
    });
  }

  function showStatus(message, type) {
    elements.status.textContent = message;
    elements.status.className = `status ${type}`;
    
    setTimeout(() => {
      elements.status.textContent = '';
      elements.status.className = 'status';
    }, 3000);
  }

  function parseRgbaColor(rgba) {
    // Parse rgba(r, g, b, a) or rgb(r, g, b) to hex color and opacity
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const a = match[4] ? parseFloat(match[4]) : 1;
      
      const hex = '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
      
      return { color: hex, opacity: a };
    }
    
    return { color: '#000000', opacity: 0.8 };
  }

  function createRgbaColor(hex, opacity) {
    // Convert hex color to rgba with opacity
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // Validate API Key when user finishes editing
  async function validateApiKeyOnBlur() {
    const apiKey = elements.apiKey.value.trim();
    const apiProvider = elements.apiProvider.value;

    if (!apiKey) {
      elements.apiKey.style.borderColor = '';
      return; // Don't validate empty key
    }

    // Basic format validation
    if (!isValidApiKeyFormat(apiKey, apiProvider)) {
      showStatus('API Key格式不正确', 'error');
      elements.apiKey.style.borderColor = '#dc3545';
      return;
    }

    console.log('🔑 Validating API Key for', apiProvider);
    showStatus('验证API Key中...', 'info');

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'validateApiKey',
          data: {
            apiKey: apiKey,
            apiProvider: elements.apiProvider.value
          }
        }, resolve);
      });

      if (response.valid) {
        console.log('✅ API Key validation successful');
        showStatus('API Key验证成功', 'success');
        elements.apiKey.style.borderColor = '#28a745';
      } else {
        console.error('❌ API Key validation failed:', response.error);
        showStatus(`API Key验证失败: ${response.error}`, 'error');
        elements.apiKey.style.borderColor = '#dc3545';
      }
    } catch (error) {
      console.error('❌ API Key validation error:', error);
      showStatus('API Key验证出错', 'error');
      elements.apiKey.style.borderColor = '#dc3545';
    }
  }

  // Test translation functionality
  async function testTranslation() {
    const apiKey = elements.apiKey.value.trim();
    const apiProvider = elements.apiProvider.value;

    if (!apiKey) {
      showStatus('请先输入API Key', 'error');
      return;
    }

    console.log(`🧪 Testing ${apiProvider} translation...`);
    showStatus(`测试${apiProvider === 'gemini' ? 'Gemini' : 'DeepSeek'}翻译中...`, 'info');
    elements.testTranslationButton.disabled = true;
    elements.testTranslationButton.textContent = '测试中...';

    try {
      // 先保存当前设置，确保测试使用正确的API提供商
      await saveCurrentSettings();

      const testText = apiProvider === 'gemini' ?
        'Hello, this is a test message for Gemini.' :
        'Hello, this is a test message for DeepSeek.';

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'translate',
          data: {
            text: testText,
            sourceLanguage: 'en'
          }
        }, resolve);
      });

      if (response.error) {
        console.error('❌ Translation test failed:', response.error);
        showStatus(`${apiProvider === 'gemini' ? 'Gemini' : 'DeepSeek'}翻译测试失败: ${response.error}`, 'error');
      } else {
        console.log('✅ Translation test successful:', response.translation);
        showStatus(`${apiProvider === 'gemini' ? 'Gemini' : 'DeepSeek'}翻译测试成功: "${response.translation}"`, 'success');
      }
    } catch (error) {
      console.error('❌ Translation test error:', error);
      showStatus('翻译测试出错', 'error');
    } finally {
      elements.testTranslationButton.disabled = false;
      elements.testTranslationButton.textContent = '测试翻译';
    }
  }

  // Save current settings helper function
  async function saveCurrentSettings() {
    const settings = {
      apiProvider: elements.apiProvider.value,
      apiKey: elements.apiKey.value.trim(),
      // Keep backward compatibility
      deepseekApiKey: elements.apiProvider.value === 'deepseek' ? elements.apiKey.value.trim() : ''
    };

    return new Promise((resolve) => {
      chrome.storage.sync.set(settings, resolve);
    });
  }

  // Validate API Key format
  function isValidApiKeyFormat(apiKey, apiProvider) {
    if (apiProvider === 'gemini') {
      // Gemini API keys typically start with "AIza" and are about 39 characters
      return apiKey.startsWith('AIza') && apiKey.length >= 35;
    } else {
      // DeepSeek API keys are typically longer and start with "sk-"
      return apiKey.startsWith('sk-') && apiKey.length >= 40;
    }
  }
});
