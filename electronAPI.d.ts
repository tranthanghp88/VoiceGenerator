export {};

declare global {
  interface Window {
    electronAPI: {
      isDesktop: boolean;
      platform: string;

      selectFolder: () => Promise<{ canceled: boolean; path: string }>;
      selectAudioFile: () => Promise<{ canceled: boolean; path: string }>;
      selectAudioFiles: () => Promise<{ canceled: boolean; paths: string[] }>;
      selectImageFile: () => Promise<{ canceled: boolean; path: string }>;

      saveAudioFile: (payload: {
        folderPath: string;
        fileName: string;
        arrayBuffer: ArrayBuffer;
      }) => Promise<any>;

      listAudioFiles: (payload: any) => Promise<any>;
      readAudioFile: (payload: any) => Promise<any>;
      openFolderPath: (payload: { path: string }) => Promise<{ ok: boolean; path?: string; error?: string }>;
      convertWaveformVideo: (payload: {
        sourceFilePath: string;
        arrayBuffer?: ArrayBuffer;
      }) => Promise<{ ok: boolean; path?: string; error?: string }>;
      composeFinalMedia: (payload: {
        sourceAudioPath: string;
        backgroundImagePath?: string;
        plan: any;
      }) => Promise<{ ok: boolean; finalAudioPath?: string; finalSrtPath?: string; finalVideoPath?: string; error?: string }>;

      listBgmAssets: () => Promise<{ ok: boolean; assets?: any[]; error?: string }>;
      importBgmAssets: (payload: { files: string[] }) => Promise<{ ok: boolean; assets?: any[]; importedCount?: number; error?: string }>;
      deleteBgmAsset: (payload: { assetId: string }) => Promise<{ ok: boolean; assets?: any[]; error?: string }>;

      getVersion: () => Promise<string>;
      checkForUpdates: () => Promise<{ ok: boolean; error?: string }>;
      downloadUpdate: () => Promise<{ ok: boolean; error?: string }>;
      quitAndInstallUpdate: () => Promise<{ ok: boolean; error?: string }>;
      getUpdateStatus: () => Promise<any>;
      onUpdateStatus: (callback: (payload: any) => void) => (() => void) | void;
    };
  }
}
