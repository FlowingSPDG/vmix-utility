import { invoke } from '@tauri-apps/api/core';

/**
 * Service for diagnostic operations
 */
export const diagnosticsService = {
  /**
   * Get diagnostic information about video list windows
   */
  async getVideoListWindowsDiagnostic(): Promise<any> {
    try {
      const diagnostic = await invoke('get_video_list_windows_diagnostic');
      console.log('🔧 VideoList Windows Diagnostic:', diagnostic);
      return diagnostic;
    } catch (error) {
      console.error('❌ Failed to get diagnostic info:', error);
      throw error;
    }
  },
};