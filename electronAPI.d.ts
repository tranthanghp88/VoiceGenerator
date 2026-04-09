export {};

declare global {
  interface Window {
    electronAPI: {
      isDesktop: boolean;
      platform: string;

      selectFolder: () => Promise<{ canceled: boolean; path: string }>;

      saveAudioFile: (payload: {
        folderPath: string;
        fileName: string;
        arrayBuffer: ArrayBuffer;
      }) => Promise<any>;

      listAudioFiles: (payload: any) => Promise<any>;
      readAudioFile: (payload: any) => Promise<any>;

      getVersion: () => Promise<string>;
      checkForUpdates: () => Promise<{ ok: boolean; error?: string }>;
      downloadUpdate: () => Promise<{ ok: boolean; error?: string }>;
      quitAndInstallUpdate: () => Promise<{ ok: boolean; error?: string }>;
      getUpdateStatus: () => Promise<any>;
      onUpdateStatus: (callback: (payload: any) => void) => (() => void) | void;
    };
  }
}
