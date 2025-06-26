interface ApplicationInfo {
  name: string;
  type: 'browser' | 'application' | 'unknown';
  isAuthorized: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface ApplicationActivity {
  timestamp: number;
  action: 'focus' | 'blur' | 'switch' | 'minimize' | 'restore';
  application?: string;
  duration?: number;
  windowTitle?: string;
}

interface MonitoringState {
  isActive: boolean;
  currentApplication: string;
  focusTime: number;
  blurTime: number;
  switchCount: number;
  violations: ApplicationActivity[];
}

class ApplicationMonitor {
  private state: MonitoringState = {
    isActive: false,
    currentApplication: 'exam_browser',
    focusTime: 0,
    blurTime: 0,
    switchCount: 0,
    violations: []
  };

  private violationCallbacks: ((activity: ApplicationActivity) => void)[] = [];
  private focusCheckInterval: number | null = null;
  private lastFocusTime = Date.now();
  private lastBlurTime = 0;

  // Unauthorized applications that should trigger violations
  private unauthorizedApps = [
    'calculator', 'calc', 'notepad', 'textedit', 'word', 'excel', 'powerpoint',
    'chrome', 'firefox', 'safari', 'edge', 'browser', 'telegram', 'whatsapp',
    'skype', 'zoom', 'teams', 'slack', 'discord', 'messenger', 'mail',
    'finder', 'explorer', 'terminal', 'cmd', 'powershell', 'code', 'vscode',
    'sublime', 'atom', 'notepad++', 'pdf', 'acrobat', 'reader'
  ];

  constructor() {
    this.setupEventListeners();
  }

  // Start application monitoring
  startMonitoring(): void {
    this.state.isActive = true;
    this.lastFocusTime = Date.now();
    
    // Start periodic focus checking
    this.focusCheckInterval = window.setInterval(() => {
      this.checkApplicationFocus();
    }, 1000);

    console.log('Application monitoring started');
  }

  // Stop application monitoring
  stopMonitoring(): void {
    this.state.isActive = false;
    
    if (this.focusCheckInterval) {
      clearInterval(this.focusCheckInterval);
      this.focusCheckInterval = null;
    }

    console.log('Application monitoring stopped');
  }

  // Setup event listeners for application switching
  private setupEventListeners(): void {
    // Window focus/blur events
    window.addEventListener('focus', this.handleWindowFocus.bind(this));
    window.addEventListener('blur', this.handleWindowBlur.bind(this));

    // Document visibility changes (tab switching)
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Page focus/blur
    window.addEventListener('pageshow', this.handlePageShow.bind(this));
    window.addEventListener('pagehide', this.handlePageHide.bind(this));

    // Mouse and keyboard activity (indicates user is active)
    document.addEventListener('mousedown', this.handleUserActivity.bind(this));
    document.addEventListener('keydown', this.handleUserActivity.bind(this));

    // Alt+Tab detection (Windows/Linux)
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'Tab') {
        this.reportViolation({
          timestamp: Date.now(),
          action: 'switch',
          application: 'alt_tab_detected',
          windowTitle: 'Alt+Tab application switching detected'
        });
      }
    });

    // Cmd+Tab detection (macOS)
    document.addEventListener('keydown', (e) => {
      if (e.metaKey && e.key === 'Tab') {
        this.reportViolation({
          timestamp: Date.now(),
          action: 'switch',
          application: 'cmd_tab_detected',
          windowTitle: 'Cmd+Tab application switching detected'
        });
      }
    });

    // Window minimize detection
    window.addEventListener('beforeunload', () => {
      this.reportViolation({
        timestamp: Date.now(),
        action: 'minimize',
        application: 'exam_browser',
        windowTitle: 'Browser window being closed or minimized'
      });
    });
  }

  // Handle window gaining focus
  private handleWindowFocus(): void {
    if (!this.state.isActive) return;

    const now = Date.now();
    const blurDuration = this.lastBlurTime ? now - this.lastBlurTime : 0;

    this.lastFocusTime = now;
    this.state.focusTime += blurDuration;

    if (blurDuration > 2000) { // More than 2 seconds away
      this.reportViolation({
        timestamp: now,
        action: 'focus',
        application: 'exam_browser',
        duration: blurDuration,
        windowTitle: `Window regained focus after ${Math.round(blurDuration/1000)}s`
      });
    }

    console.log(`Window focused after ${blurDuration}ms away`);
  }

  // Handle window losing focus
  private handleWindowBlur(): void {
    if (!this.state.isActive) return;

    const now = Date.now();
    this.lastBlurTime = now;
    this.state.switchCount++;

    this.reportViolation({
      timestamp: now,
      action: 'blur',
      application: 'unknown_application',
      windowTitle: 'Exam window lost focus - switched to another application'
    });

    console.log('Window lost focus - application switch detected');
  }

  // Handle document visibility changes (tab switching)
  private handleVisibilityChange(): void {
    if (!this.state.isActive) return;

    const now = Date.now();

    if (document.hidden) {
      this.reportViolation({
        timestamp: now,
        action: 'switch',
        application: 'browser_tab',
        windowTitle: 'Switched to another browser tab or minimized window'
      });
    } else {
      // Tab became visible again
      console.log('Exam tab regained visibility');
    }
  }

  // Handle page show (browser tab became active)
  private handlePageShow(): void {
    if (!this.state.isActive) return;
    console.log('Exam page became active');
  }

  // Handle page hide (browser tab became inactive)
  private handlePageHide(): void {
    if (!this.state.isActive) return;

    this.reportViolation({
      timestamp: Date.now(),
      action: 'switch',
      application: 'browser_navigation',
      windowTitle: 'Navigated away from exam page'
    });
  }

  // Handle user activity (reset idle timer)
  private handleUserActivity(): void {
    // Reset idle detection if needed
    this.lastFocusTime = Date.now();
  }

  // Periodic check for application focus
  private checkApplicationFocus(): void {
    if (!this.state.isActive) return;

    const now = Date.now();
    const timeSinceLastFocus = now - this.lastFocusTime;

    // Check if window has been out of focus for too long
    if (timeSinceLastFocus > 10000 && document.hasFocus()) { // 10 seconds
      this.reportViolation({
        timestamp: now,
        action: 'focus',
        application: 'prolonged_absence',
        duration: timeSinceLastFocus,
        windowTitle: `Extended absence from exam: ${Math.round(timeSinceLastFocus/1000)}s`
      });
    }

    // Detect unauthorized applications through window title changes
    this.detectUnauthorizedApplications();
  }

  // Detect unauthorized applications (limited browser capabilities)
  private detectUnauthorizedApplications(): void {
    try {
      // Check for suspicious window titles or focus patterns
      const windowTitle = document.title.toLowerCase();
      
      // Check if current page title contains unauthorized app names
      for (const app of this.unauthorizedApps) {
        if (windowTitle.includes(app)) {
          this.reportViolation({
            timestamp: Date.now(),
            action: 'switch',
            application: app,
            windowTitle: `Unauthorized application detected: ${app}`
          });
        }
      }

      // Check for suspicious browser behavior
      if (window.outerHeight - window.innerHeight > 150) {
        // Large browser chrome suggests development tools are open
        this.reportViolation({
          timestamp: Date.now(),
          action: 'switch',
          application: 'developer_tools',
          windowTitle: 'Developer tools or browser extensions detected'
        });
      }

    } catch (error) {
      console.error('Application detection error:', error);
    }
  }

  // Report application violation
  private reportViolation(activity: ApplicationActivity): void {
    this.state.violations.push(activity);

    // Notify listeners
    this.violationCallbacks.forEach(callback => {
      try {
        callback(activity);
      } catch (error) {
        console.error('Application violation callback error:', error);
      }
    });

    console.warn('Application violation detected:', activity);
  }

  // Get application risk assessment
  getApplicationRisk(appName: string): ApplicationInfo {
    const lowerAppName = appName.toLowerCase();
    
    // Critical risk applications
    const criticalApps = ['calculator', 'notepad', 'textedit', 'word', 'excel'];
    if (criticalApps.some(app => lowerAppName.includes(app))) {
      return {
        name: appName,
        type: 'application',
        isAuthorized: false,
        riskLevel: 'critical'
      };
    }

    // High risk applications
    const highRiskApps = ['chrome', 'firefox', 'safari', 'telegram', 'whatsapp'];
    if (highRiskApps.some(app => lowerAppName.includes(app))) {
      return {
        name: appName,
        type: 'application',
        isAuthorized: false,
        riskLevel: 'high'
      };
    }

    // Medium risk applications
    const mediumRiskApps = ['finder', 'explorer', 'terminal'];
    if (mediumRiskApps.some(app => lowerAppName.includes(app))) {
      return {
        name: appName,
        type: 'application',
        isAuthorized: false,
        riskLevel: 'medium'
      };
    }

    // Low risk (potentially authorized)
    return {
      name: appName,
      type: 'unknown',
      isAuthorized: true,
      riskLevel: 'low'
    };
  }

  // Public API
  onViolation(callback: (activity: ApplicationActivity) => void): () => void {
    this.violationCallbacks.push(callback);
    
    return () => {
      const index = this.violationCallbacks.indexOf(callback);
      if (index > -1) {
        this.violationCallbacks.splice(index, 1);
      }
    };
  }

  getMonitoringState(): MonitoringState {
    return { ...this.state };
  }

  getViolationSummary(): {
    totalViolations: number;
    switchCount: number;
    totalBlurTime: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  } {
    const criticalViolations = this.state.violations.filter(v => 
      v.application?.includes('calculator') || 
      v.application?.includes('notepad') ||
      v.duration && v.duration > 30000
    ).length;

    const highViolations = this.state.violations.filter(v => 
      v.action === 'switch' || v.application?.includes('browser')
    ).length;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (criticalViolations > 0) riskLevel = 'critical';
    else if (highViolations > 5) riskLevel = 'high';
    else if (this.state.switchCount > 10) riskLevel = 'medium';

    return {
      totalViolations: this.state.violations.length,
      switchCount: this.state.switchCount,
      totalBlurTime: this.state.blurTime,
      riskLevel
    };
  }

  clearViolations(): void {
    this.state.violations = [];
    this.state.switchCount = 0;
    this.state.blurTime = 0;
  }
}

export const applicationMonitor = new ApplicationMonitor();
export type { ApplicationInfo, ApplicationActivity, MonitoringState };