export interface Asset {
  id: string;
  name: string;
  path: string;
  type: "image" | "video";
  url: string;
  size: number;
  shortcut: string;
  loop: boolean;
  missing: boolean;
}

export interface ImportResult {
  items: Asset[];
  added: number;
  duplicates: number;
  rejected: string[];
}

export interface TerraceAPI {
  list(): Promise<Asset[]>;
  choose(): Promise<ImportResult | null>;
  importFiles(paths: string[]): Promise<ImportResult>;
  update(
    id: string,
    patch: Partial<Pick<Asset, "shortcut" | "loop">>,
  ): Promise<Asset[]>;
  remove(id: string): Promise<Asset[]>;
  pathForFile(file: File): string;
  setFullscreen(enabled: boolean): Promise<boolean>;
  getFullscreen(): Promise<boolean>;
  onFullscreen(callback: (enabled: boolean) => void): () => void;
}

declare global {
  interface Window {
    terrace?: TerraceAPI;
  }
}
