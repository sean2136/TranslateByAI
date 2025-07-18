// Background script for AI Video Translator
console.log('AI Video Translator background script loaded');

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details);
  
  // Set default settings
  chrome.storage.sync.set({
    enabled: true,
    targetLanguage: 'zh-CN',
    sourceLanguage: 'auto',
    subtitleStyle: {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      position: 'bottom',
      bottomOffset: 60
    },
    apiProvider: 'deepseek',
    apiKey: '',
    deepseekApiKey: ''
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  switch (request.action) {
    case 'translate':
      handleTranslation(request.data, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'getSettings':
      chrome.storage.sync.get(null, (settings) => {
        sendResponse(settings);
      });
      return true;
      
    case 'saveSettings':
      chrome.storage.sync.set(request.data, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'validateApiKey':
      validateApiKey(request.data.apiKey, request.data.apiProvider, sendResponse);
      return true;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Translation handler
async function handleTranslation(data, sendResponse) {
  try {
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(['apiProvider', 'apiKey', 'deepseekApiKey', 'targetLanguage'], resolve);
    });

    const apiProvider = settings.apiProvider || 'deepseek';
    const apiKey = settings.apiKey || settings.deepseekApiKey;

    if (!apiKey) {
      sendResponse({ error: 'API key not configured' });
      return;
    }

    let translation;
    if (apiProvider === 'gemini') {
      translation = await translateWithGemini(
        data.text,
        data.sourceLanguage || 'auto',
        settings.targetLanguage,
        apiKey
      );
    } else {
      translation = await translateWithDeepSeek(
        data.text,
        data.sourceLanguage || 'auto',
        settings.targetLanguage,
        apiKey
      );
    }

    sendResponse({ translation });
  } catch (error) {
    console.error('Translation error:', error);
    sendResponse({ error: error.message });
  }
}

// DeepSeek API integration with enhanced features
async function translateWithDeepSeek(text, sourceLang, targetLang, apiKey) {
  console.log('🔄 Starting DeepSeek translation:', { text, sourceLang, targetLang });

  // Input validation
  if (!text || text.trim().length === 0) {
    throw new Error('Empty text provided for translation');
  }

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('API key is required');
  }

  // Create optimized prompt for video subtitle translation
  const systemPrompt = createTranslationPrompt(sourceLang, targetLang);

  const requestBody = {
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: text
      }
    ],
    temperature: 0.2, // Lower temperature for more consistent translations
    max_tokens: Math.min(1000, text.length * 3), // Dynamic token limit
    top_p: 0.9,
    frequency_penalty: 0.1,
    presence_penalty: 0.1
  };

  console.log('📤 Sending request to DeepSeek API');

  try {
    const response = await fetchWithRetry('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'AI-Video-Translator/1.0'
      },
      body: JSON.stringify(requestBody)
    }, 3); // 3 retry attempts

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ DeepSeek API error response:', errorText);
      throw new Error(getApiErrorMessage(response.status, errorText));
    }

    const result = await response.json();
    console.log('📥 DeepSeek API response received');

    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error('Invalid response format from DeepSeek API');
    }

    const translation = result.choices[0].message.content.trim();
    console.log('✅ Translation completed:', translation);

    return translation;

  } catch (error) {
    console.error('❌ Translation failed:', error);
    throw error;
  }
}

// Create optimized translation prompt for video subtitles
function createTranslationPrompt(sourceLang, targetLang) {
  const languageMap = {
    'auto': '自动检测',
    'en': '英语',
    'zh-CN': '简体中文',
    'zh-TW': '繁体中文',
    'ja': '日语',
    'ko': '韩语',
    'es': '西班牙语',
    'fr': '法语',
    'de': '德语'
  };

  const sourceLanguageName = languageMap[sourceLang] || sourceLang;
  const targetLanguageName = languageMap[targetLang] || targetLang;

  return `你是一个专业的视频字幕翻译专家。请将以下${sourceLanguageName}文本翻译成${targetLanguageName}。

翻译要求：
1. 保持原文的语气和情感
2. 适合视频字幕的简洁表达
3. 符合目标语言的表达习惯
4. 如果是专业术语或人名，请保持准确性
5. 只返回翻译结果，不要添加任何解释

请直接返回翻译结果：`;
}

// Fetch with retry mechanism
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 API request attempt ${attempt}/${maxRetries}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;

    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Get user-friendly error messages
function getApiErrorMessage(status, errorText) {
  // First check for specific error messages in the response text
  if (errorText) {
    if (errorText.includes('Insufficient Balance') || errorText.includes('insufficient_balance')) {
      return '💰 DeepSeek账户余额不足，请前往 https://platform.deepseek.com 充值';
    }
    if (errorText.includes('quota exceeded') || errorText.includes('rate limit')) {
      return '⏱️ API调用配额已用完，请稍后再试或升级账户';
    }
    if (errorText.includes('invalid api key') || errorText.includes('unauthorized')) {
      return '🔑 API密钥无效，请检查您的DeepSeek API Key';
    }
  }

  switch (status) {
    case 401:
      return '🔑 API密钥无效或已过期，请检查您的DeepSeek API Key';
    case 403:
      return '🚫 API访问被拒绝，请检查您的账户权限';
    case 429:
      return '⏱️ API请求频率过高，请稍后再试';
    case 500:
    case 502:
    case 503:
    case 504:
      return '🔧 DeepSeek服务暂时不可用，请稍后再试';
    default:
      try {
        const errorData = JSON.parse(errorText);
        const message = errorData.error?.message || errorData.message;
        if (message) {
          // Check for balance issues in the parsed message
          if (message.includes('Insufficient Balance') || message.includes('insufficient_balance')) {
            return '💰 DeepSeek账户余额不足，请前往 https://platform.deepseek.com 充值';
          }
          return `❌ ${message}`;
        }
        return `❌ API错误 (${status})`;
      } catch {
        return `❌ API请求失败 (${status})`;
      }
  }
}

// Validate API Key
async function validateApiKey(apiKey, apiProvider, sendResponse) {
  console.log('🔑 Validating API Key for provider:', apiProvider);

  if (!apiKey || apiKey.trim().length === 0) {
    sendResponse({ valid: false, error: 'API Key不能为空' });
    return;
  }

  // Use provided apiProvider or default to deepseek
  const provider = apiProvider || 'deepseek';

  try {
    let testResponse;

    if (provider === 'gemini') {
      // Test Gemini API key with the latest stable model
      testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Hi'
            }]
          }],
          generationConfig: {
            maxOutputTokens: 5,
            temperature: 0.1
          }
        })
      });
    } else {
      // Test DeepSeek API key with a minimal request
      testResponse = await fetch('https://api.deepseek.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`
        }
      });
    }

    console.log('📡 API response status:', testResponse.status);

    if (testResponse.ok) {
      console.log('✅ API Key validation successful');
      sendResponse({ valid: true, message: `${provider === 'gemini' ? 'Gemini' : 'DeepSeek'} API Key验证成功` });
    } else {
      const errorText = await testResponse.text();
      console.error('❌ API Key validation failed:', testResponse.status, errorText);

      // Provide more detailed error information
      let errorMessage;
      if (provider === 'gemini') {
        errorMessage = getGeminiApiErrorMessage(testResponse.status, errorText);
      } else {
        errorMessage = getApiErrorMessage(testResponse.status, errorText);
      }

      console.error('❌ Detailed error:', errorMessage);
      sendResponse({
        valid: false,
        error: `${errorMessage} (状态码: ${testResponse.status})`
      });
    }
  } catch (error) {
    console.error('❌ API Key validation network error:', error);
    sendResponse({
      valid: false,
      error: `网络错误: ${error.message}`
    });
  }
}

// Get available Gemini models dynamically
async function getAvailableGeminiModels(apiKey) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const data = await response.json();

      // 安全检查：确保data和data.models存在
      if (!data || !data.models || !Array.isArray(data.models)) {
        console.log('⚠️ Invalid models response format:', data);
        return null;
      }

      const availableModels = data.models
        .filter(model => {
          // 安全检查每个model对象
          if (!model || typeof model.name !== 'string') {
            return false;
          }
          return model.name.includes('gemini') &&
                 model.supportedGenerationMethods?.includes('generateContent');
        })
        .map(model => model.name.replace('models/', ''))
        .sort((a, b) => {
          // 优先级排序：2.5 > 2.0 > 1.5，pro > flash
          const getScore = (name) => {
            if (!name || typeof name !== 'string') return 0;
            let score = 0;
            if (name.includes('2.5')) score += 1000;
            else if (name.includes('2.0')) score += 500;
            else if (name.includes('1.5')) score += 100;
            if (name.includes('pro')) score += 50;
            if (name.includes('latest') || name.includes('002')) score += 10;
            return score;
          };
          return getScore(b) - getScore(a);
        });

      console.log('🔍 Available Gemini models:', availableModels);
      return availableModels.length > 0 ? availableModels : null;
    }
  } catch (error) {
    console.log('⚠️ Could not fetch available models, using fallback list');
  }

  return null;
}

// Gemini API integration
async function translateWithGemini(text, sourceLang, targetLang, apiKey) {
  console.log('🔄 Starting Gemini translation:', { text, sourceLang, targetLang });

  // Input validation
  if (!text || text.trim().length === 0) {
    throw new Error('Empty text provided for translation');
  }

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('API key is required');
  }

  // Create optimized prompt for video subtitle translation
  const prompt = createGeminiTranslationPrompt(sourceLang, targetLang, text);

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.9,
      maxOutputTokens: 300,
      candidateCount: 1
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_ONLY_HIGH"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_ONLY_HIGH"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_ONLY_HIGH"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_ONLY_HIGH"
      }
    ]
  };

  console.log('📤 Sending request to Gemini API');

  // 使用最新的稳定模型列表，基于Google AI API文档
  console.log('📋 Using latest stable Gemini models');
  const models = [
    'gemini-2.5-flash-lite-preview-06-17',  // 您指定的模型
    'gemini-2.0-flash',                     // 最新稳定版本
    'gemini-1.5-pro-002',                   // 稳定Pro版本
    'gemini-1.5-flash-002',                 // 稳定Flash版本
    'gemini-1.5-pro',                       // 标准Pro版本
    'gemini-1.5-flash',                     // 标准Flash版本
    'gemini-pro'                            // 传统版本备用
  ];

  let response;
  let lastError;

  for (const model of models) {
    try {
      console.log(`🔄 Trying Gemini model: ${model}`);
      response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }, 2);

      if (response.ok) {
        console.log(`✅ Successfully using model: ${model}`);
        break;
      } else {
        const errorText = await response.text();
        console.log(`❌ Model ${model} failed:`, response.status, errorText);
        lastError = new Error(`Model ${model} failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Model ${model} error:`, error.message);
      lastError = error;
    }
  }

  if (!response || !response.ok) {
    throw lastError || new Error('All Gemini models failed');
  }

  try {

    const result = await response.json();
    console.log('📥 Gemini API response received:', result);

    // 详细的安全检查
    if (!result) {
      throw new Error('Empty response from Gemini API');
    }

    if (!result.candidates || !Array.isArray(result.candidates) || result.candidates.length === 0) {
      console.error('❌ No candidates in response:', result);
      throw new Error('No translation candidates returned from Gemini API');
    }

    const candidate = result.candidates[0];
    if (!candidate || !candidate.content) {
      console.error('❌ Invalid candidate structure:', candidate);
      throw new Error('Invalid candidate structure in Gemini API response');
    }

    if (!candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
      console.error('❌ No content parts:', candidate.content);
      throw new Error('No content parts in Gemini API response');
    }

    const part = candidate.content.parts[0];
    if (!part || typeof part.text !== 'string') {
      console.error('❌ Invalid text part:', part);
      throw new Error('Invalid text part in Gemini API response');
    }

    const translation = part.text.trim();
    if (!translation) {
      throw new Error('Empty translation text from Gemini API');
    }

    console.log('✅ Translation completed:', translation);
    return translation;

  } catch (error) {
    console.error('❌ Translation failed:', error);
    throw error;
  }
}

// Create Gemini translation prompt
function createGeminiTranslationPrompt(sourceLang, targetLang, text) {
  const languageMap = {
    'auto': '自动检测',
    'en': '英语',
    'zh-CN': '简体中文',
    'zh-TW': '繁体中文',
    'ja': '日语',
    'ko': '韩语',
    'es': '西班牙语',
    'fr': '法语',
    'de': '德语'
  };

  const sourceLanguageName = languageMap[sourceLang] || sourceLang;
  const targetLanguageName = languageMap[targetLang] || targetLang;

  return `请将以下${sourceLanguageName}文本翻译成${targetLanguageName}。要求：保持原文语气，适合视频字幕的简洁表达，只返回翻译结果。

${text}`;
}

// Get Gemini API error messages
function getGeminiApiErrorMessage(status, errorText) {
  switch (status) {
    case 400:
      return 'Gemini API请求格式错误';
    case 401:
      return 'Gemini API密钥无效或已过期';
    case 403:
      return 'Gemini API访问被拒绝，请检查权限';
    case 429:
      return 'Gemini API请求频率过高，请稍后再试';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Gemini服务暂时不可用，请稍后再试';
    default:
      try {
        const errorData = JSON.parse(errorText);
        return errorData.error?.message || `Gemini API错误 (${status})`;
      } catch {
        return `Gemini API请求失败 (${status})`;
      }
  }
}
