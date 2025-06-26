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
    this.detectMonitors().catch(console.error);
    this.startMonitoring();
  }

  // Simplified detection - always report single monitor unless explicitly multiple
  async detectMonitors(): Promise<MonitorConfiguration> {
    try {
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      
      const primaryMonitor: MonitorInfo = {
        id: 'primary',
        width: screenWidth,
        height: screenHeight,
        isPrimary: true,
        orientation: screenWidth > screenHeight ? 'landscape' : 'portrait'
      };

      // Conservative approach - assume single monitor to avoid false positives
      const config: MonitorConfiguration = {
        totalMonitors: 1,
        primaryMonitor,
        secondaryMonitors: [],
        totalScreenArea: screenWidth * screenHeight,
        isExtendedDesktop: false
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

  // Monitor for configuration changes
  private startMonitoring(): void {
    this.checkInterval = window.setInterval(() => {
      this.detectMonitors().catch(console.error);
    }, 5000);

    // Listen for screen changes
    window.addEventListener('resize', () => {
      this.detectMonitors().catch(console.error);
    });
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Add callback for configuration changes
  onConfigurationChange(callback: (config: MonitorConfiguration) => void): () => void {
    this.changeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.changeCallbacks.indexOf(callback);
      if (index > -1) {
        this.changeCallbacks.splice(index, 1);
      }
    };
  }

  // Notify callbacks of configuration changes
  private notifyConfigChange(config: MonitorConfiguration): void {
    this.changeCallbacks.forEach(callback => {
      try {
        callback(config);
      } catch (error) {
        console.error('Error in monitor configuration callback:', error);
      }
    });
  }

  // Get current configuration
  getCurrentConfiguration(): MonitorConfiguration | null {
    return this.monitorConfig;
  }

  // Check if multiple monitors detected
  hasMultipleMonitors(): boolean {
    return this.monitorConfig ? this.monitorConfig.totalMonitors > 1 : false;
  }

  // Get monitor warnings
  getMonitorWarnings(): string[] {
    const warnings: string[] = [];
    
    if (this.hasMultipleMonitors()) {
      warnings.push('Multiple monitors detected - ensure exam content is visible on primary display only');
    }

    return warnings;
  }
}

export const multiMonitorDetector = new MultiMonitorDetector();
export type { MonitorConfiguration, MonitorInfo };