// Content script for AI Video Translator
console.log('AI Video Translator content script loaded');

class VideoTranslator {
  constructor() {
    this.isEnabled = false;
    this.settings = {};
    this.subtitleContainer = null;
    this.currentSubtitles = [];
    this.translationCache = new Map();
    this.videoElement = null;
    this.lastUpdateTime = 0;
    this.lastCaptionText = '';
    this.subtitleObservers = [];
    this.translationQueue = [];
    this.isTranslating = false;
    this.translationDebounceTimer = null;
    this.currentVideoTime = 0;
    this.subtitleHistory = [];
    this.maxHistorySize = 50;
    this.translationStartTime = 0;
    
    this.init();
  }
  
  async init() {
    console.log('🚀 VideoTranslator initializing...');

    // Get settings from background
    this.settings = await this.getSettings();
    this.isEnabled = this.settings.enabled;
    console.log('⚙️ Settings loaded:', this.settings);

    // Wait for video element to load
    this.waitForVideo();

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
    });

    console.log('✅ VideoTranslator initialized successfully');
  }
  
  waitForVideo() {
    console.log('🔍 Waiting for video element...');
    let attempts = 0;
    const checkVideo = () => {
      attempts++;
      this.videoElement = document.querySelector('video');
      if (this.videoElement) {
        console.log('🎥 Video element found after', attempts, 'attempts');
        console.log('📹 Video details:', {
          src: this.videoElement.src,
          duration: this.videoElement.duration,
          currentTime: this.videoElement.currentTime
        });
        this.setupVideoListeners();
        this.createSubtitleContainer();
        if (this.isEnabled) {
          this.startTranslation();
        }
      } else {
        console.log('⏳ Video not found, attempt', attempts, '- retrying in 1s...');
        setTimeout(checkVideo, 1000);
      }
    };
    checkVideo();
  }
  
  setupVideoListeners() {
    if (!this.videoElement) return;

    // Listen for time updates with enhanced tracking
    this.videoElement.addEventListener('timeupdate', () => {
      this.currentVideoTime = this.videoElement.currentTime;
      if (this.isEnabled) {
        this.updateSubtitles();
        this.syncSubtitleTiming();
      }
    });

    // Listen for play/pause events
    this.videoElement.addEventListener('play', () => {
      console.log('▶️ Video started playing');
      if (this.isEnabled) {
        this.resumeTranslation();
      }
    });

    this.videoElement.addEventListener('pause', () => {
      console.log('⏸️ Video paused');
      this.pauseTranslation();
    });

    // Listen for seeking
    this.videoElement.addEventListener('seeked', () => {
      console.log('⏭️ Video seeked to:', this.videoElement.currentTime);
      this.clearSubtitles();
      this.lastCaptionText = '';
    });

    // Listen for video source changes
    this.videoElement.addEventListener('loadstart', () => {
      console.log('🔄 Video loading started - clearing subtitles');
      this.clearSubtitles();
      this.lastCaptionText = '';
    });

    this.videoElement.addEventListener('loadeddata', () => {
      console.log('📹 Video data loaded - reinitializing subtitle extraction');
      if (this.isEnabled) {
        setTimeout(() => {
          this.extractYouTubeSubtitles();
        }, 1000);
      }
    });

    // Listen for video changes (YouTube navigation)
    const observer = new MutationObserver(() => {
      const newVideo = document.querySelector('video');
      if (newVideo && newVideo !== this.videoElement) {
        console.log('🔄 Video element changed - switching to new video');
        this.videoElement = newVideo;
        this.clearSubtitles();
        this.lastCaptionText = '';
        this.setupVideoListeners();
        if (this.isEnabled) {
          setTimeout(() => {
            this.extractYouTubeSubtitles();
          }, 1000);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also listen for URL changes (YouTube navigation)
    this.setupNavigationListener();
  }

  setupNavigationListener() {
    let currentUrl = window.location.href;

    // Monitor URL changes
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        console.log('🌐 URL changed - clearing subtitles');
        currentUrl = window.location.href;
        this.clearSubtitles();
        this.lastCaptionText = '';

        // Wait for new video to load
        setTimeout(() => {
          if (this.isEnabled) {
            this.waitForVideo();
          }
        }, 1500);
      }
    });

    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also listen for popstate events
    window.addEventListener('popstate', () => {
      console.log('⬅️ Browser navigation - clearing subtitles');
      this.clearSubtitles();
      this.lastCaptionText = '';
    });
  }
  
  createSubtitleContainer() {
    console.log('📝 Creating subtitle container...');

    if (this.subtitleContainer) {
      console.log('🗑️ Removing existing subtitle container');
      this.subtitleContainer.remove();
    }

    this.subtitleContainer = document.createElement('div');
    this.subtitleContainer.id = 'ai-translator-subtitles';
    // Apply position-based styling
    this.applySubtitlePositioning();

    // Find video container
    const videoContainer = this.videoElement?.closest('.html5-video-player') ||
                          this.videoElement?.parentElement;

    if (videoContainer) {
      console.log('📦 Video container found, adding subtitle container');
      videoContainer.style.position = 'relative';
      videoContainer.appendChild(this.subtitleContainer);

      // Add a test message to verify the container is working
      this.subtitleContainer.innerHTML = `
        <div style="
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.9) 0%, rgba(40, 40, 40, 0.9) 100%) !important;
          color: #ffffff !important;
          padding: 6px 12px !important;
          border-radius: 4px !important;
          display: inline-block !important;
          margin: 2px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
          backdrop-filter: blur(4px) !important;
        ">
          🤖 AI翻译已准备就绪
        </div>
      `;

      console.log('🎨 Test message added to subtitle container');

      // Remove test message after 5 seconds (longer for debugging)
      setTimeout(() => {
        if (this.subtitleContainer) {
          console.log('🧹 Removing test message');
          this.subtitleContainer.innerHTML = '';
        }
      }, 5000);

    } else {
      console.error('❌ Video container not found!');
    }
  }

  applySubtitlePositioning() {
    if (!this.subtitleContainer) return;

    // 安全获取设置值
    const subtitleStyle = this.settings?.subtitleStyle || {};
    const position = subtitleStyle.position || 'bottom';
    const bottomOffset = subtitleStyle.bottomOffset || 150;

    console.log(`🎯 Applying subtitle position: ${position}, offset: ${bottomOffset}px`);

    let positionStyles = '';

    switch (position) {
      case 'top':
        positionStyles = `
          top: 20px !important;
          bottom: auto !important;
        `;
        break;
      case 'center':
        positionStyles = `
          top: 50% !important;
          bottom: auto !important;
          transform: translateX(-50%) translateY(-50%) !important;
        `;
        break;
      case 'bottom':
      default:
        positionStyles = `
          bottom: ${bottomOffset}px !important;
          top: auto !important;
          transform: translateX(-50%) !important;
        `;
        break;
    }

    this.subtitleContainer.style.cssText = `
      position: absolute !important;
      left: 50% !important;
      ${positionStyles}
      z-index: 99999 !important;
      pointer-events: none !important;
      text-align: center !important;
      max-width: 95% !important;
      width: auto !important;
      height: auto !important;
      visibility: visible !important;
      opacity: 1 !important;
      display: block !important;
      box-sizing: border-box !important;
    `;
  }
  
  async startTranslation() {
    console.log('Starting translation...');
    
    // Extract subtitles from YouTube
    this.extractYouTubeSubtitles();
  }
  
  extractYouTubeSubtitles() {
    console.log('🔍 Starting YouTube subtitle extraction...');

    // Multiple strategies for subtitle extraction
    this.setupSubtitleObservers();

    // Try to enable captions if not already enabled
    this.enableYouTubeCaptions();

    // Also try to extract from video track data
    this.extractFromVideoTrack();
  }

  setupSubtitleObservers() {
    console.log('👀 Setting up subtitle observers...');

    // Strategy 1: Monitor caption window (current method)
    this.observeCaptionWindow();

    // Strategy 2: Monitor subtitle track elements
    this.observeSubtitleTracks();

    // Strategy 3: Monitor video player for subtitle changes
    this.observePlayerSubtitles();
  }

  observeCaptionWindow() {
    const captionSelectors = [
      '.caption-window',
      '.ytp-caption-window-container',
      '.html5-captions-display',
      '.captions-text'
    ];

    captionSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        console.log(`📺 Found caption element with selector: ${selector}`);
        const observer = new MutationObserver(() => {
          this.processYouTubeCaptions();
        });
        observer.observe(element, {
          childList: true,
          subtree: true,
          characterData: true
        });
      });
    });
  }

  observeSubtitleTracks() {
    // Monitor for subtitle track elements
    const trackObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if new subtitle elements were added
              const subtitleElements = node.querySelectorAll('[class*="caption"], [class*="subtitle"]');
              if (subtitleElements.length > 0) {
                console.log('🆕 New subtitle elements detected');
                this.processYouTubeCaptions();
              }
            }
          });
        }
      });
    });

    // Observe the entire video player for subtitle changes
    const videoPlayer = document.querySelector('.html5-video-player') || document.body;
    trackObserver.observe(videoPlayer, {
      childList: true,
      subtree: true
    });
  }

  observePlayerSubtitles() {
    // Monitor video element for track changes
    if (this.videoElement) {
      const textTracks = this.videoElement.textTracks;
      if (textTracks) {
        for (let i = 0; i < textTracks.length; i++) {
          const track = textTracks[i];
          track.addEventListener('cuechange', () => {
            console.log('📝 Text track cue changed');
            this.processTextTrackCues(track);
          });
        }
      }
    }
  }
  
  enableYouTubeCaptions() {
    console.log('🔘 Attempting to enable YouTube captions...');

    // Multiple selectors for caption buttons (YouTube updates these frequently)
    const captionButtonSelectors = [
      '.ytp-subtitles-button',
      '.ytp-caption-button',
      '[aria-label*="字幕"]',
      '[aria-label*="Subtitles"]',
      '[aria-label*="Captions"]'
    ];

    let captionEnabled = false;

    for (const selector of captionButtonSelectors) {
      const captionButton = document.querySelector(selector);
      if (captionButton) {
        console.log(`🎯 Found caption button with selector: ${selector}`);

        // Check if captions are already enabled
        const isActive = captionButton.classList.contains('ytp-button-active') ||
                        captionButton.getAttribute('aria-pressed') === 'true';

        if (!isActive) {
          console.log('🖱️ Clicking caption button to enable subtitles');
          captionButton.click();
          captionEnabled = true;
          break;
        } else {
          console.log('✅ Captions already enabled');
          captionEnabled = true;
          break;
        }
      }
    }

    if (!captionEnabled) {
      console.log('⚠️ No caption button found, trying alternative methods');
      this.tryAlternativeCaptionMethods();
    }

    // Wait a bit for captions to load, then retry extraction
    setTimeout(() => {
      this.setupSubtitleObservers();
    }, 1500);
  }

  tryAlternativeCaptionMethods() {
    // Try to find and click settings menu to enable captions
    const settingsButton = document.querySelector('.ytp-settings-button');
    if (settingsButton) {
      console.log('⚙️ Trying to enable captions through settings menu');
      // This would require more complex interaction, for now just log
    }

    // Try keyboard shortcut (C key for captions)
    console.log('⌨️ Trying keyboard shortcut for captions');
    const event = new KeyboardEvent('keydown', {
      key: 'c',
      code: 'KeyC',
      keyCode: 67
    });
    document.dispatchEvent(event);
  }
  
  async processYouTubeCaptions() {
    console.log('🔍 Processing YouTube captions...');

    // Try multiple selectors for different YouTube caption formats
    // Prioritize more specific selectors to avoid UI elements
    const captionSelectors = [
      '.caption-window .ytp-caption-segment',
      '.ytp-caption-window-container .ytp-caption-segment',
      '.html5-captions-display .captions-text',
      '.ytp-caption-window-container span:not([class*="button"]):not([class*="menu"]):not([class*="control"])',
      '.captions-text:not([class*="button"]):not([class*="menu"])'
    ];

    let foundCaptions = false;
    let currentText = '';

    for (const selector of captionSelectors) {
      const captionElements = document.querySelectorAll(selector);

      if (captionElements.length > 0) {
        console.log(`📝 Found ${captionElements.length} caption elements with selector: ${selector}`);
        foundCaptions = true;

        // Combine all caption text from current display
        const textParts = [];
        captionElements.forEach((element) => {
          // Skip elements that are likely UI controls (but be more specific)
          if (element.closest('.ytp-chrome-controls') ||
              element.closest('.ytp-progress-bar') ||
              element.closest('.ytp-settings-menu') ||
              element.closest('.ytp-menuitem') ||
              element.closest('.ytp-button') ||
              element.closest('.ytp-panel-menu')) {
            console.log('🚫 Skipped element due to UI control filter');
            return;
          }

          const text = element.textContent.trim();
          console.log(`📝 Found caption text:`, text);
          if (text && !textParts.includes(text)) {
            textParts.push(text);
          }
        });

        currentText = textParts.join(' ').trim();
        break; // Use the first successful selector
      }
    }

    if (!foundCaptions) {
      console.log('⚠️ No caption elements found with any selector');
      return;
    }

    if (!currentText) {
      console.log('📭 No caption text content found');
      return;
    }

    console.log('📄 Current caption text:', currentText);

    // Check if this is new content
    if (currentText === this.lastCaptionText) {
      return; // Same content, no need to process again
    }

    this.lastCaptionText = currentText;

    // Process the caption text with debouncing
    this.debouncedTranslate(currentText);
  }

  async processCaptionText(text) {
    if (!text || text.length < 2) {
      return; // Skip very short text
    }

    // Clean up the text
    const cleanText = this.cleanCaptionText(text);

    if (!cleanText) {
      return;
    }

    console.log('🧹 Cleaned caption text:', cleanText);

    // Check cache first
    if (this.translationCache.has(cleanText)) {
      console.log('💾 Using cached translation');
      const cachedTranslation = this.translationCache.get(cleanText);
      this.displayTranslation(cachedTranslation);
      return;
    }

    // Translate new text
    console.log('🔄 Attempting to translate:', cleanText);
    this.isTranslating = true;
    this.translationStartTime = this.currentVideoTime;

    try {
      const translation = await this.translateText(cleanText);
      this.translationCache.set(cleanText, translation);

      // Add to subtitle history
      this.addToSubtitleHistory(cleanText, translation, this.currentVideoTime);

      this.displayTranslation(translation);
      console.log('✅ Translation successful:', translation);
    } catch (error) {
      console.error('❌ Translation failed:', error);

      // Show user-friendly error message based on error type
      let errorMessage = '';
      if (error.message.includes('API Key')) {
        errorMessage = '⚠️ 请配置API Key';
      } else if (error.message.includes('网络')) {
        errorMessage = '🌐 网络连接错误';
      } else if (error.message.includes('频率')) {
        errorMessage = '⏱️ 请求过于频繁';
      } else {
        errorMessage = `❌ ${error.message}`;
      }

      this.displayTranslation(errorMessage);

      // Auto-hide error message after 2 seconds, but only if no new translation is in progress
      setTimeout(() => {
        if (this.subtitleContainer &&
            this.subtitleContainer.innerHTML.includes(errorMessage) &&
            !this.isTranslating) {
          this.clearSubtitles();
        }
      }, 2000);
    } finally {
      this.isTranslating = false;
    }
  }

  cleanCaptionText(text) {
    if (!text) return '';

    // First check if this looks like YouTube UI text (not actual captions)
    const uiPatterns = [
      /信息.*购物.*向上拉.*播放进度/,  // YouTube UI text pattern
      /\d+:\d+.*\d+:\d+.*观看完整视频/,  // Time stamps with "watch full video"
      /向上拉以精确调整播放进度/,  // Specific UI text
      /观看完整视频/,  // "Watch full video" text
      /^\d+:\d+\s*[•·]\s*\d+:\d+/,  // Time format like "1:47 • 1:58"
      /^\d+:\d+\s*\/\s*\d+:\d+/,  // Time format like "1:58 / 3:33"
      /^(信息|购物|设置|分享|下载)(\s|$)/,  // Common UI button text
    ];

    // Check if text matches any UI pattern
    for (const pattern of uiPatterns) {
      if (pattern.test(text)) {
        console.log('🚫 Filtered out UI text:', text);
        return '';
      }
    }

    // Clean the text
    const cleaned = text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^\[.*?\]\s*/, '') // Remove [Music], [Applause] etc.
      .replace(/\(.*?\)/g, '') // Remove parenthetical content
      .replace(/[♪♫♬♩]/g, '') // Remove music notes
      .trim();

    // Additional checks for cleaned text
    if (cleaned.length < 3) return '';
    if (/^\d+:\d+/.test(cleaned)) return '';
    if (/^[0-9\s:•·\/]+$/.test(cleaned)) return '';

    console.log('✅ Cleaned caption text:', cleaned);
    return cleaned;
  }

  // Debounced translation to avoid too frequent API calls
  debouncedTranslate(text) {
    // Clear existing timer
    if (this.translationDebounceTimer) {
      clearTimeout(this.translationDebounceTimer);
    }

    // Set new timer
    this.translationDebounceTimer = setTimeout(() => {
      this.processCaptionText(text);
    }, 500); // 500ms debounce delay
  }

  // Sync subtitle timing with video playback
  syncSubtitleTiming() {
    // Remove old subtitles that are no longer relevant
    const currentTime = this.currentVideoTime;

    // If subtitle has been showing for more than 8 seconds, consider clearing it
    if (this.translationStartTime && (currentTime - this.translationStartTime) > 8) {
      // Only clear if no new captions are detected
      const captionElements = document.querySelectorAll('.caption-window .ytp-caption-segment, .ytp-caption-window-container .ytp-caption-segment, .html5-captions-display .captions-text');
      if (captionElements.length === 0) {
        console.log('⏰ Clearing old subtitle due to timing');
        this.clearSubtitles();
        this.translationStartTime = 0;
      }
    }
  }

  // Pause translation processing
  pauseTranslation() {
    if (this.translationDebounceTimer) {
      clearTimeout(this.translationDebounceTimer);
      this.translationDebounceTimer = null;
    }
    this.isTranslating = false;
  }

  // Resume translation processing
  resumeTranslation() {
    if (this.isEnabled && this.lastCaptionText) {
      // Re-process the last caption when resuming
      setTimeout(() => {
        this.debouncedTranslate(this.lastCaptionText);
      }, 100);
    }
  }

  // Add subtitle to history for tracking
  addToSubtitleHistory(originalText, translation, timestamp) {
    const historyItem = {
      original: originalText,
      translation: translation,
      timestamp: timestamp,
      videoTime: this.currentVideoTime
    };

    this.subtitleHistory.push(historyItem);

    // Keep history size manageable
    if (this.subtitleHistory.length > this.maxHistorySize) {
      this.subtitleHistory.shift();
    }

    console.log('📚 Added to subtitle history:', historyItem);
  }

  // Get recent subtitle history (useful for context)
  getRecentSubtitleHistory(seconds = 10) {
    const currentTime = this.currentVideoTime;
    return this.subtitleHistory.filter(item =>
      (currentTime - item.videoTime) <= seconds
    );
  }

  extractFromVideoTrack() {
    console.log('🎬 Attempting to extract from video track...');

    if (!this.videoElement) {
      console.log('⚠️ No video element available for track extraction');
      return;
    }

    const textTracks = this.videoElement.textTracks;
    console.log(`📊 Found ${textTracks.length} text tracks`);

    for (let i = 0; i < textTracks.length; i++) {
      const track = textTracks[i];
      console.log(`🎯 Track ${i}:`, {
        kind: track.kind,
        language: track.language,
        label: track.label,
        mode: track.mode
      });

      if (track.kind === 'subtitles' || track.kind === 'captions') {
        // Enable the track
        track.mode = 'showing';

        // Listen for cue changes
        track.addEventListener('cuechange', () => {
          this.processTextTrackCues(track);
        });
      }
    }
  }

  processTextTrackCues(track) {
    console.log('📝 Processing text track cues...');

    if (!track.activeCues || track.activeCues.length === 0) {
      return;
    }

    const cueTexts = [];
    for (let i = 0; i < track.activeCues.length; i++) {
      const cue = track.activeCues[i];
      if (cue.text) {
        cueTexts.push(cue.text);
      }
    }

    if (cueTexts.length > 0) {
      const combinedText = cueTexts.join(' ').trim();
      console.log('🎬 Text track cue text:', combinedText);
      this.processCaptionText(combinedText);
    }
  }
  
  async translateText(text) {
    console.log('🔄 Translating text:', text);

    // Refresh settings to get latest API key
    this.settings = await this.getSettings();

    // Check if API key is configured
    const apiKey = this.settings.apiKey || this.settings.deepseekApiKey;
    if (!apiKey || apiKey.trim() === '') {
      console.log('⚠️ No API key configured');
      throw new Error('请在插件设置中配置API Key');
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'translate',
        data: {
          text: text,
          sourceLanguage: this.settings.sourceLanguage || 'auto'
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
          reject(new Error('插件通信错误'));
          return;
        }

        if (response.error) {
          console.error('❌ Translation API error:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Translation received:', response.translation);
          resolve(response.translation);
        }
      });
    });
  }
  
  displayTranslation(translation) {
    console.log('🎬 Displaying translation:', translation);

    if (!this.subtitleContainer) {
      console.error('❌ Subtitle container not found!');
      return;
    }

    // 安全获取样式设置
    const subtitleStyle = this.settings?.subtitleStyle || {};

    this.subtitleContainer.innerHTML = `
      <div style="
        background: ${this.createSubtitleBackground()} !important;
        color: ${subtitleStyle.color || '#ffffff'} !important;
        padding: 1px 4px !important;
        border-radius: 4px !important;
        display: inline-block !important;
        margin: 1px auto !important;
        font-size: ${subtitleStyle.fontSize || '14px'} !important;
        font-family: ${subtitleStyle.fontFamily || 'Arial, sans-serif'} !important;
        font-weight: 500 !important;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8) !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4) !important;
        max-width: 90% !important;
        min-width: auto !important;
        width: auto !important;
        word-break: keep-all !important;
        overflow-wrap: break-word !important;
        line-height: 1.2 !important;
        backdrop-filter: blur(2px) !important;
        transition: all 0.2s ease !important;
        text-align: center !important;
        white-space: normal !important;
        overflow: visible !important;
        box-sizing: border-box !important;
        hyphens: none !important;
      ">
        ${translation}
      </div>
    `;

    console.log('✅ Translation displayed in container');
  }

  createSubtitleBackground() {
    // 安全获取设置值
    const subtitleStyle = this.settings?.subtitleStyle || {};
    const bgColor = subtitleStyle.backgroundColor || 'rgba(0, 0, 0, 0.9)';

    // If user has set a custom background color, use it
    if (subtitleStyle.backgroundColor &&
        subtitleStyle.backgroundColor !== 'rgba(0, 0, 0, 0.8)') {
      return bgColor;
    }

    // Otherwise, use our elegant gradient
    return 'linear-gradient(135deg, rgba(0, 0, 0, 0.9) 0%, rgba(30, 30, 30, 0.9) 100%)';
  }
  
  clearSubtitles() {
    console.log('🧹 Clearing subtitles...');
    if (this.subtitleContainer) {
      this.subtitleContainer.innerHTML = '';
      console.log('✅ Subtitle container cleared');
    }

    // Also clear any stray subtitle elements that might exist
    const straySubtitles = document.querySelectorAll('#ai-translator-subtitles');
    straySubtitles.forEach((element, index) => {
      if (element !== this.subtitleContainer) {
        console.log(`🗑️ Removing stray subtitle element ${index}`);
        element.remove();
      }
    });
  }
  
  updateSubtitles() {
    // This will be called on video timeupdate
    // For now, we rely on caption changes
  }
  
  async getSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        // 安全检查chrome.runtime.lastError
        if (chrome.runtime.lastError) {
          console.error('❌ Error getting settings:', chrome.runtime.lastError);
          resolve({});
          return;
        }

        // 确保返回有效的设置对象
        const settings = response || {};
        console.log('⚙️ Settings loaded:', settings);
        resolve(settings);
      });
    });
  }
  
  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'toggle':
        this.isEnabled = request.enabled;
        if (this.isEnabled) {
          this.startTranslation();
        } else {
          this.clearSubtitles();
        }
        sendResponse({ success: true });
        break;
        
      case 'updateSettings':
        console.log('⚙️ Updating settings:', request.settings);
        if (request.settings && typeof request.settings === 'object') {
          this.settings = { ...this.settings, ...request.settings };
          if (this.subtitleContainer) {
            this.applySubtitlePositioning(); // Apply new positioning
          }
          sendResponse({ success: true });
        } else {
          console.error('❌ Invalid settings object:', request.settings);
          sendResponse({ success: false, error: 'Invalid settings' });
        }
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new VideoTranslator();
  });
} else {
  new VideoTranslator();
}
