export interface GitWorkspaceOptions {
  repoUrl: string;
  username?: string;
  token?: string;
  branch?: string;
  storageKey?: string;
  runtime?: {
    jsPath?: string;
    wasmPath?: string;
  };
  user?: {
    name?: string;
    email?: string;
  };
}

export interface SyncResult {
  action: "clone" | "sync";
  output: string;
}

export interface WorkspaceEntry {
  path: string;
  type: "file" | "dir";
}

export interface GitStatus {
  raw: string;
  clean: boolean;
  lines: string[];
}

export interface GitDiffLine {
  type: "context" | "add" | "delete";
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface GitDiffFile {
  oldPath: string;
  newPath: string;
  hunks: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: GitDiffLine[];
  }>;
}

export interface GitDiff {
  raw: string;
  files: GitDiffFile[];
  summary: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
}

export interface GitOutput {
  output: string;
}

export type WorkspaceMethod =
  | "listFiles"
  | "readText"
  | "writeText"
  | "status"
  | "diff"
  | "stage"
  | "commit"
  | "push";

export interface WorkspaceRequest {
  method: WorkspaceMethod;
  path?: string;
  content?: string;
  message?: string;
}

export interface WorkspaceResponse {
  ok: boolean;
  method: WorkspaceMethod;
  request: WorkspaceRequest;
  data: unknown;
  meta: {
    repoDir: string;
    branch: string;
    durationMs: number;
    output: string;
  };
}
