export { GitWorkspace } from "./workspace";
export { normalizeGitHttpUrl, stripCredentials } from "./url";
export { parseDiffOutput, parseStatusOutput } from "./diff";
export type {
  GitDiff,
  GitDiffFile,
  GitDiffLine,
  GitOutput,
  GitStatus,
  GitWorkspaceOptions,
  SyncResult,
  WorkspaceMethod,
  WorkspaceRequest,
  WorkspaceResponse
} from "./types";
