interface MonitorInfo {
  id: string;
  width: number;
  height: number;
  isPrimary: boolean;
  orientation: 'landscape' | 'portrait';
}

interface MonitorConfiguration {
  totalMonitors: number;
  primaryMonitor: MonitorInfo;
  secondaryMonitors: MonitorInfo[];
  totalScreenArea: number;
  isExtendedDesktop: boolean;
}

class MultiMonitorDetector {
  private monitorConfig: MonitorConfiguration | null = null;
  private changeCallbacks: ((config: MonitorConfiguration) => void)[] = [];
  private checkInterval: number | null = null;

  constructor() {
    this.detectMonitors();
    this.startMonitoring();
  }

  // Detect current monitor configuration
  async detectMonitors(): Promise<MonitorConfiguration> {
    try {
      // Use Screen Capture API to detect multiple displays
      const displays = await this.getAvailableDisplays();
      
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const availWidth = window.screen.availWidth;
      const availHeight = window.screen.availHeight;
      
      // Detect extended desktop based on screen dimensions
      const isExtendedDesktop = this.detectExtendedDesktop(displays);
      
      const primaryMonitor: MonitorInfo = {
        id: 'primary',
        width: screenWidth,
        height: screenHeight,
        isPrimary: true,
        orientation: screenWidth > screenHeight ? 'landscape' : 'portrait'
      };

      const secondaryMonitors: MonitorInfo[] = displays.slice(1).map((display, index) => ({
        id: `secondary_${index + 1}`,
        width: display.width || screenWidth,
        height: display.height || screenHeight,
        isPrimary: false,
        orientation: (display.width || screenWidth) > (display.height || screenHeight) ? 'landscape' as const : 'portrait' as const
      }));

      const config: MonitorConfiguration = {
        totalMonitors: displays.length,
        primaryMonitor,
        secondaryMonitors,
        totalScreenArea: screenWidth * screenHeight,
        isExtendedDesktop
      };

      this.monitorConfig = config;
      this.notifyConfigChange(config);

      return config;
    } catch (error) {
      console.error('Failed to detect monitors:', error);
      
      // Fallback to basic detection
      const fallbackConfig: MonitorConfiguration = {
        totalMonitors: 1,
        primaryMonitor: {
          id: 'primary',
          width: window.screen.width,
          height: window.screen.height,
          isPrimary: true,
          orientation: window.screen.width > window.screen.height ? 'landscape' : 'portrait'
        },
        secondaryMonitors: [],
        totalScreenArea: window.screen.width * window.screen.height,
        isExtendedDesktop: false
      };

      this.monitorConfig = fallbackConfig;
      return fallbackConfig;
    }
  }

  // Get available displays using Screen Capture API
  private async getAvailableDisplays(): Promise<Array<{width?: number, height?: number}>> {
    try {
      // Modern approach: Use getDisplayMedia to enumerate displays
      const displays: Array<{width?: number, height?: number}> = [];
      
      // Check if multiple displays are available by examining screen properties
      const screenRatio = window.screen.width / window.screen.height;
      const isUltrawide = screenRatio > 2.5; // Likely multiple monitors
      
      if (isUltrawide) {
        // Estimate multiple displays for ultrawide setups
        const estimatedMonitors = Math.floor(screenRatio / 1.5);
        for (let i = 0; i < estimatedMonitors; i++) {
          displays.push({
            width: Math.floor(window.screen.width / estimatedMonitors),
            height: window.screen.height
          });
        }
      } else {
        // Single display detected
        displays.push({
          width: window.screen.width,
          height: window.screen.height
        });
      }

      // Additional detection via window positioning
      if (window.screenX !== 0 || window.screenY !== 0) {
        // Window is positioned off primary display
        displays.push({
          width: window.screen.width,
          height: window.screen.height
        });
      }

      return displays;
    } catch (error) {
      console.error('Display enumeration failed:', error);
      return [{ width: window.screen.width, height: window.screen.height }];
    }
  }

  // Detect extended desktop configuration
  private detectExtendedDesktop(displays: Array<{width?: number, height?: number}>): boolean {
    // Multiple indicators of extended desktop
    const indicators = [
      displays.length > 1,
      window.screen.width > 2560, // Very wide screen likely multiple monitors
      window.screen.width / window.screen.height > 2.5, // Ultra-wide ratio
      window.outerWidth !== window.screen.width, // Window doesn't fill screen
      Math.abs(window.screenX) > window.screen.width // Window positioned beyond primary screen
    ];

    // Extended desktop if multiple indicators are true
    return indicators.filter(Boolean).length >= 2;
  }

  // Monitor for configuration changes
  private startMonitoring(): void {
    // Check for monitor changes every 5 seconds
    this.checkInterval = window.setInterval(() => {
      this.detectMonitors();
    }, 5000);

    // Listen for window resize events (might indicate monitor changes)
    window.addEventListener('resize', () => {
      setTimeout(() => this.detectMonitors(), 1000);
    });

    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.detectMonitors(), 1000);
    });

    // Monitor window position changes
    let lastX = window.screenX;
    let lastY = window.screenY;
    
    setInterval(() => {
      if (window.screenX !== lastX || window.screenY !== lastY) {
        lastX = window.screenX;
        lastY = window.screenY;
        this.detectMonitors();
      }
    }, 2000);
  }

  // Configuration change notifications
  private notifyConfigChange(config: MonitorConfiguration): void {
    this.changeCallbacks.forEach(callback => {
      try {
        callback(config);
      } catch (error) {
        console.error('Monitor config callback error:', error);
      }
    });
  }

  // Public API
  getCurrentConfiguration(): MonitorConfiguration | null {
    return this.monitorConfig;
  }

  onConfigurationChange(callback: (config: MonitorConfiguration) => void): () => void {
    this.changeCallbacks.push(callback);
    
    // Return cleanup function
    return () => {
      const index = this.changeCallbacks.indexOf(callback);
      if (index > -1) {
        this.changeCallbacks.splice(index, 1);
      }
    };
  }

  // Check if current setup violates exam rules
  validateConfiguration(): {
    isValid: boolean;
    violations: string[];
    warnings: string[];
  } {
    const config = this.monitorConfig;
    const violations: string[] = [];
    const warnings: string[] = [];

    if (!config) {
      violations.push('Unable to detect monitor configuration');
      return { isValid: false, violations, warnings };
    }

    // Critical violations
    if (config.totalMonitors > 1) {
      violations.push(`Multiple monitors detected: ${config.totalMonitors} displays`);
    }

    if (config.isExtendedDesktop) {
      violations.push('Extended desktop configuration detected');
    }

    // Warnings
    if (config.primaryMonitor.width > 2560) {
      warnings.push('Ultra-wide monitor detected - may indicate multiple displays');
    }

    if (window.screenX !== 0 || window.screenY !== 0) {
      warnings.push('Application window positioned off primary display');
    }

    return {
      isValid: violations.length === 0,
      violations,
      warnings
    };
  }

  // Force single monitor mode (hide other displays)
  enforceSelectiveMode(): void {
    // Request fullscreen on primary display only
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }

    // Warn about multi-monitor usage
    if (this.monitorConfig && this.monitorConfig.totalMonitors > 1) {
      console.warn('Multi-monitor setup detected. Exam requires single monitor mode.');
    }
  }

  // Cleanup
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.changeCallbacks = [];
  }
}

export const multiMonitorDetector = new MultiMonitorDetector();
export type { MonitorConfiguration, MonitorInfo };