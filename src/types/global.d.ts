// Ambient types for the renderer ↔ main IPC bridge exposed by preload.js.
// Importing nothing here — these declarations apply globally so any
// `// @ts-check` renderer file gets autocompletion and error-checking on
// `window.electronAPI.*` calls (catches mistyped channels at type-check time).

export {};

/** Update metadata pushed from electron-updater (main → renderer). */
export interface UpdateInfo {
  version?: string;
  releaseName?: string | null;
  releaseNotes?: string | null;
  [key: string]: unknown;
}

/** Download progress payload from electron-updater. */
export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

/** CPU / RAM snapshot returned by the `system:stats` IPC handler. */
export interface SystemStats {
  cpu: number;
  memUsed: number;
  memTotal: number;
  [key: string]: unknown;
}

/** App paths returned by `app:get-paths`. */
export interface AppPaths {
  userData: string;
  music?: string;
  thumbnails?: string;
  bin?: string;
  [key: string]: string | undefined;
}

/** The full contextBridge surface exposed as `window.electronAPI`. */
export interface ElectronAPI {
  // Server / app info
  getServerPort(): Promise<number>;
  getVersion(): Promise<string>;
  getPaths(): Promise<AppPaths>;
  restart(): void;

  // Window controls
  minimize(): void;
  maximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;

  // Theme / notifications / external
  setTheme(theme: string): void;
  showNotification(title: string, body: string): void;
  openExternal(url: string): void;

  // System / dev
  getSystemStats(): Promise<SystemStats>;
  isDev(): Promise<boolean>;

  // Error log (dev only)
  logError(msg: string): void;
  readLog(): Promise<string>;
  clearLog(): Promise<void>;

  // Updater (main → renderer callbacks + actions)
  onCheckingForUpdate(cb: () => void): void;
  onUpdateAvailable(cb: (info: UpdateInfo) => void): void;
  onUpdateNotAvailable(cb: (info: UpdateInfo) => void): void;
  onUpdateProgress(cb: (progress: UpdateProgress) => void): void;
  onUpdateDownloaded(cb: (info: UpdateInfo) => void): void;
  onUpdaterError(cb: (msg: string) => void): void;
  installUpdate(): void;
  checkForUpdates(): void;

  // Mini player (main renderer side)
  openMiniPlayer(): void;
  closeMiniPlayer(): void;
  updateMiniPlayerState(state: unknown): void;
  onMiniPlayerControl(cb: (action: string, value: unknown) => void): void;
  onMiniPlayerClosed(cb: () => void): void;

  // Mini player window side
  miniPlayerControl(action: string, value?: unknown): void;
  onMiniPlayerState(cb: (state: unknown) => void): void;
  resizeMiniPlayer(w: number, h: number): void;
  setMiniPlayerFooter(): void;
  exitMiniPlayerFooter(): void;
  minimizeSelf(): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
