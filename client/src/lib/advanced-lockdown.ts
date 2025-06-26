interface LockdownConfiguration {
  forceFullscreen: boolean;
  preventPrintScreen: boolean;
  blockNavigation: boolean;
  kioskMode: boolean;
  enhancedBlocking: boolean;
  autoReentry: boolean;
}

interface SecurityViolation {
  type: 'escape_attempt' | 'print_screen' | 'navigation' | 'dev_tools' | 'unauthorized_key';
  timestamp: number;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class AdvancedLockdownManager {
  private config: LockdownConfiguration = {
    forceFullscreen: true,
    preventPrintScreen: true,
    blockNavigation: true,
    kioskMode: true,
    enhancedBlocking: true,
    autoReentry: true
  };

  private isActive = false;
  private fullscreenCheckInterval: number | null = null;
  private violationCallbacks: ((violation: SecurityViolation) => void)[] = [];
  private originalTitle = document.title;
  private escapeAttempts = 0;
  private lastFullscreenExit = 0;

  // Blocked key combinations
  private blockedKeys = [
    // Function keys
    { key: 'F1' }, { key: 'F2' }, { key: 'F3' }, { key: 'F4' },
    { key: 'F5' }, { key: 'F6' }, { key: 'F7' }, { key: 'F8' },
    { key: 'F9' }, { key: 'F10' }, { key: 'F11' }, { key: 'F12' },
    
    // Print Screen variations
    { key: 'PrintScreen' },
    { key: 'Print' },
    { ctrlKey: true, key: 'p' },
    { ctrlKey: true, shiftKey: true, key: 'I' }, // Dev tools
    { ctrlKey: true, shiftKey: true, key: 'J' }, // Console
    { ctrlKey: true, shiftKey: true, key: 'C' }, // Inspect
    { key: 'F12' }, // Dev tools
    
    // Navigation
    { altKey: true, key: 'ArrowLeft' }, // Back
    { altKey: true, key: 'ArrowRight' }, // Forward
    { ctrlKey: true, key: 'r' }, // Refresh
    { ctrlKey: true, shiftKey: true, key: 'R' }, // Hard refresh
    { key: 'F5' }, // Refresh
    { ctrlKey: true, key: 'F5' }, // Hard refresh
    
    // System shortcuts
    { altKey: true, key: 'Tab' }, // Alt+Tab
    { ctrlKey: true, altKey: true, key: 'Delete' }, // Task manager
    { ctrlKey: true, shiftKey: true, key: 'Escape' }, // Task manager
    { metaKey: true, key: 'Tab' }, // Cmd+Tab (macOS)
    { metaKey: true, key: ' ' }, // Spotlight (macOS)
    
    // Browser shortcuts
    { ctrlKey: true, key: 't' }, // New tab
    { ctrlKey: true, key: 'n' }, // New window
    { ctrlKey: true, shiftKey: true, key: 'N' }, // New incognito
    { ctrlKey: true, key: 'w' }, // Close tab
    { ctrlKey: true, shiftKey: true, key: 'Delete' }, // Clear data
    
    // Copy/Paste (already handled elsewhere but reinforced)
    { ctrlKey: true, key: 'c' },
    { ctrlKey: true, key: 'v' },
    { ctrlKey: true, key: 'x' },
    { ctrlKey: true, key: 'a' }, // Select all
    { ctrlKey: true, key: 's' }, // Save
  ];

  constructor() {
    this.setupEventListeners();
  }

  // Activate complete lockdown
  activateLockdown(config?: Partial<LockdownConfiguration>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.isActive = true;
    
    if (this.config.forceFullscreen) {
      this.enterFullscreen();
    }

    if (this.config.kioskMode) {
      this.enableKioskMode();
    }

    if (this.config.enhancedBlocking) {
      this.enableEnhancedBlocking();
    }

    if (this.config.autoReentry) {
      this.startAutoReentryMonitoring();
    }

    console.log('Advanced lockdown activated with config:', this.config);
  }

  // Deactivate lockdown
  deactivateLockdown(): void {
    this.isActive = false;

    if (this.fullscreenCheckInterval) {
      clearInterval(this.fullscreenCheckInterval);
      this.fullscreenCheckInterval = null;
    }

    this.exitFullscreen();
    this.disableKioskMode();
    document.title = this.originalTitle;

    console.log('Advanced lockdown deactivated');
  }

  // Force fullscreen mode with better permission handling
  private async enterFullscreen(): Promise<void> {
    try {
      if (!document.fullscreenElement) {
        const element = document.documentElement;
        
        // Try modern fullscreen API first
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if ((element as any).webkitRequestFullscreen) {
          await (element as any).webkitRequestFullscreen();
        } else if ((element as any).msRequestFullscreen) {
          await (element as any).msRequestFullscreen();
        } else if ((element as any).mozRequestFullScreen) {
          await (element as any).mozRequestFullScreen();
        } else {
          throw new Error('Fullscreen API not supported');
        }
        
        console.log('Fullscreen mode activated');
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      
      // Report fullscreen permission issue
      this.reportViolation({
        type: 'escape_attempt',
        timestamp: Date.now(),
        details: `Fullscreen permission denied: ${error}`,
        severity: 'critical'
      });
      
      // Show user guidance for fullscreen permission
      this.showFullscreenGuidance();
    }
  }

  // Show guidance for fullscreen permission
  private showFullscreenGuidance(): void {
    const guidance = document.createElement('div');
    guidance.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #dc2626;
      color: white;
      padding: 12px;
      text-align: center;
      z-index: 999999;
      font-family: system-ui, sans-serif;
      font-size: 14px;
    `;
    guidance.innerHTML = `
      🚨 FULLSCREEN REQUIRED: Press F11 or allow fullscreen permission to continue the exam
      <button onclick="this.parentElement.remove()" style="margin-left: 20px; background: white; color: #dc2626; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">×</button>
    `;
    
    document.body.appendChild(guidance);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (guidance.parentElement) {
        guidance.remove();
      }
    }, 10000);
  }

  // Exit fullscreen
  private exitFullscreen(): void {
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        }
      }
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
    }
  }

  // Auto-reentry monitoring
  private startAutoReentryMonitoring(): void {
    this.fullscreenCheckInterval = window.setInterval(() => {
      if (this.isActive && this.config.forceFullscreen && !document.fullscreenElement) {
        this.escapeAttempts++;
        this.lastFullscreenExit = Date.now();

        this.reportViolation({
          type: 'escape_attempt',
          timestamp: Date.now(),
          details: `Fullscreen exit attempt #${this.escapeAttempts}`,
          severity: this.escapeAttempts > 3 ? 'critical' : 'high'
        });

        // Auto re-enter fullscreen after 2 seconds
        setTimeout(() => {
          if (this.isActive && !document.fullscreenElement) {
            this.enterFullscreen();
          }
        }, 2000);
      }
    }, 1000);
  }

  // Enable kiosk mode restrictions
  private enableKioskMode(): void {
    // Hide scroll bars
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    // Disable text selection
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    (document.body.style as any).msUserSelect = 'none';
    (document.body.style as any).mozUserSelect = 'none';

    // Disable drag and drop
    document.addEventListener('dragstart', this.preventEvent);
    document.addEventListener('drop', this.preventEvent);
    document.addEventListener('dragover', this.preventEvent);

    // Change page title to indicate lockdown
    document.title = '🔒 SECURE EXAM IN PROGRESS - DO NOT EXIT FULLSCREEN';

    // Disable browser zoom
    document.addEventListener('wheel', this.preventZoom);
    document.addEventListener('keydown', this.preventZoomKeys);
  }

  // Disable kiosk mode
  private disableKioskMode(): void {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    (document.body.style as any).msUserSelect = '';
    (document.body.style as any).mozUserSelect = '';

    document.removeEventListener('dragstart', this.preventEvent);
    document.removeEventListener('drop', this.preventEvent);
    document.removeEventListener('dragover', this.preventEvent);
    document.removeEventListener('wheel', this.preventZoom);
    document.removeEventListener('keydown', this.preventZoomKeys);
  }

  // Enhanced blocking for advanced security
  private enableEnhancedBlocking(): void {
    // Block image saving
    document.addEventListener('contextmenu', this.preventEvent);

    // Block all print screen attempts
    document.addEventListener('keyup', this.handlePrintScreen);
    document.addEventListener('keydown', this.handlePrintScreen);

    // Monitor for developer tools
    setInterval(() => {
      this.detectDeveloperTools();
    }, 500);

    // Block window manipulation
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    window.addEventListener('unload', this.handleUnload);

    // Prevent iframe escape attempts
    if (window !== window.top) {
      this.reportViolation({
        type: 'navigation',
        timestamp: Date.now(),
        details: 'Application running in iframe - potential escape attempt',
        severity: 'high'
      });
    }
  }

  // Setup comprehensive event listeners
  private setupEventListeners(): void {
    // Enhanced keyboard blocking
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));

    // Fullscreen change detection
    document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('mozfullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('MSFullscreenChange', this.handleFullscreenChange.bind(this));

    // Window focus monitoring
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
    window.addEventListener('focus', this.handleWindowFocus.bind(this));

    // Mouse event monitoring
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
  }

  // Handle all keydown events
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isActive) return;

    // Check against blocked key combinations
    for (const blockedKey of this.blockedKeys) {
      if (this.isKeyMatch(event, blockedKey)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        this.reportViolation({
          type: 'unauthorized_key',
          timestamp: Date.now(),
          details: `Blocked key combination: ${this.getKeyDescription(event)}`,
          severity: 'medium'
        });
        return;
      }
    }

    // Special handling for Escape key
    if (event.key === 'Escape') {
      event.preventDefault();
      this.reportViolation({
        type: 'escape_attempt',
        timestamp: Date.now(),
        details: 'Escape key pressed - potential exit attempt',
        severity: 'high'
      });
    }
  }

  // Handle keyup events (for print screen detection)
  private handleKeyUp(event: KeyboardEvent): void {
    if (!this.isActive) return;
    this.handlePrintScreen(event);
  }

  // Detect print screen attempts
  private handlePrintScreen(event: KeyboardEvent): void {
    if (event.key === 'PrintScreen' || event.key === 'Print') {
      this.reportViolation({
        type: 'print_screen',
        timestamp: Date.now(),
        details: 'Print screen key detected',
        severity: 'critical'
      });
    }
  }

  // Handle fullscreen changes
  private handleFullscreenChange(): void {
    if (!this.isActive) return;

    if (!document.fullscreenElement && this.config.forceFullscreen) {
      this.reportViolation({
        type: 'escape_attempt',
        timestamp: Date.now(),
        details: 'Exited fullscreen mode',
        severity: 'critical'
      });
    }
  }

  // Handle window blur (focus loss)
  private handleWindowBlur(): void {
    if (!this.isActive) return;

    this.reportViolation({
      type: 'escape_attempt',
      timestamp: Date.now(),
      details: 'Window lost focus',
      severity: 'high'
    });
  }

  // Handle window focus
  private handleWindowFocus(): void {
    if (!this.isActive) return;

    // Re-enter fullscreen if needed
    if (this.config.forceFullscreen && !document.fullscreenElement) {
      setTimeout(() => this.enterFullscreen(), 100);
    }
  }

  // Handle mouse events
  private handleMouseDown(event: MouseEvent): void {
    if (!this.isActive) return;

    // Block right-click
    if (event.button === 2) {
      event.preventDefault();
      this.reportViolation({
        type: 'unauthorized_key',
        timestamp: Date.now(),
        details: 'Right-click attempted',
        severity: 'low'
      });
    }
  }

  // Utility methods
  private isKeyMatch(event: KeyboardEvent, blockedKey: any): boolean {
    return (!blockedKey.key || event.key === blockedKey.key) &&
           (!blockedKey.ctrlKey || event.ctrlKey === blockedKey.ctrlKey) &&
           (!blockedKey.altKey || event.altKey === blockedKey.altKey) &&
           (!blockedKey.shiftKey || event.shiftKey === blockedKey.shiftKey) &&
           (!blockedKey.metaKey || event.metaKey === blockedKey.metaKey);
  }

  private getKeyDescription(event: KeyboardEvent): string {
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.metaKey) modifiers.push('Cmd');
    
    return [...modifiers, event.key].join('+');
  }

  private preventEvent = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  private preventZoom = (event: WheelEvent): void => {
    if (event.ctrlKey) {
      event.preventDefault();
    }
  };

  private preventZoomKeys = (event: KeyboardEvent): void => {
    if ((event.ctrlKey && (event.key === '+' || event.key === '-' || event.key === '0')) ||
        event.key === 'F11') {
      event.preventDefault();
    }
  };

  private handleBeforeUnload = (event: BeforeUnloadEvent): string => {
    const message = 'Exam is in progress. Are you sure you want to leave?';
    event.returnValue = message;
    return message;
  };

  private handleUnload = (): void => {
    this.reportViolation({
      type: 'navigation',
      timestamp: Date.now(),
      details: 'Page unload detected',
      severity: 'critical'
    });
  };

  // Detect developer tools
  private detectDeveloperTools(): void {
    const threshold = 160;
    
    if (window.outerHeight - window.innerHeight > threshold ||
        window.outerWidth - window.innerWidth > threshold) {
      this.reportViolation({
        type: 'dev_tools',
        timestamp: Date.now(),
        details: 'Developer tools may be open',
        severity: 'critical'
      });
    }
  }

  // Report security violation
  private reportViolation(violation: SecurityViolation): void {
    this.violationCallbacks.forEach(callback => {
      try {
        callback(violation);
      } catch (error) {
        console.error('Security violation callback error:', error);
      }
    });

    console.warn('Security violation:', violation);
  }

  // Public API
  onViolation(callback: (violation: SecurityViolation) => void): () => void {
    this.violationCallbacks.push(callback);
    
    return () => {
      const index = this.violationCallbacks.indexOf(callback);
      if (index > -1) {
        this.violationCallbacks.splice(index, 1);
      }
    };
  }

  isLockdownActive(): boolean {
    return this.isActive;
  }

  getConfiguration(): LockdownConfiguration {
    return { ...this.config };
  }

  getSecurityStatus(): {
    isFullscreen: boolean;
    escapeAttempts: number;
    lastEscapeTime: number;
    lockdownActive: boolean;
  } {
    return {
      isFullscreen: !!document.fullscreenElement,
      escapeAttempts: this.escapeAttempts,
      lastEscapeTime: this.lastFullscreenExit,
      lockdownActive: this.isActive
    };
  }
}

export const advancedLockdownManager = new AdvancedLockdownManager();
export type { LockdownConfiguration, SecurityViolation };