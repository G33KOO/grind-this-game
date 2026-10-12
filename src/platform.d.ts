interface Window {
  gamePlatform?: {
    loadSave(): Promise<{ primary: string | null; backup: string | null }>;
    writeSave(raw: string): Promise<boolean>;
    isDesktop: boolean;
  };
}
