import { invoke } from '@tauri-apps/api/core';

export interface NetworkInterface {
  name: string;
  ip_address: string;
  subnet: string;
  is_up: boolean;
}

export interface VmixScanResult {
  ip_address: string;
  port: number;
  is_vmix: boolean;
  response_time: number;
  error_message?: string;
}

export class NetworkScannerService {
  /**
   * 利用可能なネットワークインターフェースを取得
   */
  static async getNetworkInterfaces(): Promise<NetworkInterface[]> {
    try {
      return await invoke<NetworkInterface[]>('get_network_interfaces_command');
    } catch (error) {
      console.error('Failed to get network interfaces:', error);
      throw new Error(`Failed to get network interfaces: ${error}`);
    }
  }

  /**
   * 指定されたネットワークインターフェースでvMixをスキャン
   */
  static async scanNetworkForVmix(interfaceName: string): Promise<VmixScanResult[]> {
    try {
      return await invoke<VmixScanResult[]>('scan_network_for_vmix_command', {
        interfaceName
      });
    } catch (error) {
      console.error('Failed to scan network for vMix:', error);
      throw new Error(`Failed to scan network for vMix: ${error}`);
    }
  }

  /**
   * vMixインスタンスのみをフィルタリング
   */
  static filterVmixInstances(results: VmixScanResult[]): VmixScanResult[] {
    return results.filter(result => result.is_vmix);
  }

  /**
   * スキャン結果をユーザーフレンドリーな形式に変換
   */
  static formatScanResults(results: VmixScanResult[]): Array<{
    ip: string;
    port: number;
    responseTime: number;
    status: 'vmix' | 'http' | 'error';
    errorMessage?: string;
  }> {
    return results.map(result => ({
      ip: result.ip_address,
      port: result.port,
      responseTime: result.response_time,
      status: result.is_vmix ? 'vmix' : (result.error_message ? 'error' : 'http'),
      errorMessage: result.error_message
    }));
  }
}
