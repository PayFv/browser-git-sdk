import { parseDiffOutput, parseStatusOutput } from "./diff";
import type { GitDiff, GitOutput, GitStatus, GitWorkspaceOptions, SyncResult, WorkspaceRequest, WorkspaceResponse } from "./types";
import { normalizeGitHttpUrl, repoSlug, stripCredentials, withAccessToken } from "./url";
import { loadWasmGit, type WasmGit } from "./wasm";

const PERSIST_ROOT = "/repos";
const HOME = "/home/web_user";

export class GitWorkspace {
  private git?: WasmGit;
  private output: string[] = [];

  constructor(private options: GitWorkspaceOptions) {}

  async init() {
    if (this.git) return;

    const initGit = await loadWasmGit(
      this.options.runtime?.jsPath ?? "/vendor/wasm-git/lg2_async.js",
      this.options.runtime?.wasmPath ?? "/vendor/wasm-git/lg2_async.wasm"
    );

    this.git = await initGit({
      print: (message) => this.output.push(message),
      printErr: (message) => this.output.push(message)
    });

    this.ensureDir("/home");
    this.ensureDir(HOME);
    this.git.FS.writeFile(`${HOME}/.gitconfig`, this.gitConfig());
    this.ensureDir(PERSIST_ROOT);
    this.git.FS.mount(this.git.IDBFS, {}, PERSIST_ROOT);
    await this.syncFs(true);
  }

  async sync(): Promise<SyncResult> {
    await this.init();
    const repo = this.resolveRepo();
    this.begin(repo.exists ? "fetch/merge" : "clone");
    this.checkMixedContent(repo.safeUrl);

    if (!repo.exists) {
      await this.cloneRepo();
      await this.syncFs(false);
      return { action: "clone", output: this.outputText() };
    }

    await this.fetchAndMerge();
    await this.syncFs(false);
    return { action: "sync", output: this.outputText() };
  }

  async files(path = "") {
    await this.ensureRepo();
    return this.listFilesFromRepo(this.resolveRepo().repoDir, path);
  }

  async readText(path: string) {
    await this.ensureRepo();
    const fullPath = `${this.resolveRepo().repoDir}/${path}`;
    if (!this.pathExists(fullPath)) throw new Error(`File not found: ${path}`);

    const content = this.git!.FS.readFile(fullPath, { encoding: "utf8" });
    return typeof content === "string" ? content : new TextDecoder().decode(content);
  }

  async writeText(path: string, content: string) {
    await this.ensureRepo();
    await this.inRepo(async () => {
      this.git!.FS.writeFile(path, content);
    });
    await this.syncFs(false);
  }

  async status(): Promise<GitStatus> {
    await this.ensureRepo();
    return this.inRepo(() => this.capture(["status"]).then(parseStatusOutput));
  }

  async diff(path = ""): Promise<GitDiff> {
    await this.ensureRepo();
    return this.inRepo(() => this.capture(path ? ["diff", path] : ["diff"]).then(parseDiffOutput));
  }

  async stage(path: string) {
    await this.ensureRepo();
    await this.inRepo(() => this.run(["add", path]));
    await this.syncFs(false);
  }

  async commit(message = "Workspace commit") {
    await this.ensureRepo();
    await this.inRepo(() => this.run(["commit", "-m", message]));
    await this.syncFs(false);
  }

  async push() {
    await this.ensureRepo();
    const { authUrl, safeUrl } = this.resolveRepo();
    await this.inRepo(async () => {
      try {
        await this.run(["remote", "set-url", "origin", authUrl]);
        await this.run(["push"]);
      } finally {
        await this.tryRun(["remote", "set-url", "origin", safeUrl]);
      }
    });
    await this.syncFs(false);
  }

  async raw(args: string[]): Promise<GitOutput> {
    await this.ensureRepo();
    return this.inRepo(() => this.capture(args).then((output) => ({ output })));
  }

  async call(request: WorkspaceRequest): Promise<WorkspaceResponse> {
    await this.ensureRepo();
    this.begin(`workspace.${request.method}`);
    const startedAt = performance.now();

    const data = await this.dispatch(request);
    const { repoDir, branch } = this.resolveRepo();
    return {
      ok: true,
      method: request.method,
      request,
      data,
      meta: {
        repoDir,
        branch,
        durationMs: Math.round(performance.now() - startedAt),
        output: this.outputText()
      }
    };
  }

  private async dispatch(request: WorkspaceRequest) {
    switch (request.method) {
      case "listFiles":
        return { files: await this.files(request.path || "") };
      case "readText":
        return { path: request.path, content: await this.readText(requiredPath(request)) };
      case "writeText": {
        const content = request.content ?? "";
        await this.writeText(requiredPath(request), content);
        return { path: request.path, bytes: new TextEncoder().encode(content).byteLength };
      }
      case "status":
        return this.status();
      case "diff":
        return this.diff(request.path || "");
      case "stage":
        await this.stage(requiredPath(request));
        return { path: request.path, staged: true };
      case "commit":
        await this.commit(request.message || "Workspace commit");
        return { message: request.message || "Workspace commit", committed: true };
      case "push":
        await this.push();
        return { pushed: true };
    }
  }

  private async ensureRepo() {
    await this.init();
    if (!this.resolveRepo().exists) await this.cloneRepo();
  }

  private resolveRepo() {
    const repoUrl = normalizeGitHttpUrl(this.options.repoUrl.trim());
    const branch = this.options.branch?.trim() || "main";
    const safeUrl = stripCredentials(repoUrl);
    const authUrl = withAccessToken(safeUrl, this.options.username?.trim(), this.options.token);
    const repoDir = `${PERSIST_ROOT}/${this.options.storageKey || repoSlug(safeUrl)}`;
    const exists = this.pathExists(`${repoDir}/.git`);
    return { repoUrl, branch, safeUrl, authUrl, repoDir, exists };
  }

  private begin(mode: string) {
    const { safeUrl, authUrl, repoDir } = this.resolveRepo();
    this.output = [
      `normalized repo url: ${safeUrl}`,
      `auth repo url: ${authUrl}`,
      `local repo dir: ${repoDir}`,
      `mode: ${mode}`
    ];
  }

  private async cloneRepo() {
    const { authUrl, safeUrl, repoDir, branch } = this.resolveRepo();
    this.begin("clone");
    await this.run(["clone", authUrl, repoDir]);
    await this.inRepo(async () => {
      await this.run(["remote", "set-url", "origin", safeUrl]);
      await this.tryRun(["checkout", branch]);
    });
  }

  private async fetchAndMerge() {
    const { authUrl, safeUrl, branch } = this.resolveRepo();
    await this.inRepo(async () => {
      try {
        await this.run(["remote", "set-url", "origin", authUrl]);
        await this.run(["fetch", "origin", branch]);
        await this.tryRun(["merge", `refs/remotes/origin/${branch}`]);
      } finally {
        await this.tryRun(["remote", "set-url", "origin", safeUrl]);
      }
    });
  }

  private listFilesFromRepo(repoDir: string, basePath = "") {
    const files: string[] = [];
    const root = basePath ? `${repoDir}/${basePath}` : repoDir;
    if (!this.pathExists(root)) return files;

    const walk = (dir: string, prefix = "") => {
      for (const name of this.git!.FS.readdir(dir)) {
        if (name === "." || name === ".." || name === ".git") continue;
        const fullPath = `${dir}/${name}`;
        const relativePath = prefix ? `${prefix}/${name}` : name;
        try {
          this.git!.FS.readdir(fullPath);
          walk(fullPath, relativePath);
        } catch {
          files.push(relativePath);
        }
      }
    };

    walk(root, basePath);
    return files.slice(0, 80);
  }

  private async capture(args: string[]) {
    const start = this.output.length;
    await this.run(args);
    return this.output.slice(start).join("\n");
  }

  private async inRepo<T>(action: () => Promise<T>) {
    const { repoDir } = this.resolveRepo();
    this.git!.FS.chdir(repoDir);
    try {
      return await action();
    } finally {
      this.git!.FS.chdir("/");
    }
  }

  private async run(args: string[]) {
    const start = this.output.length;
    this.output.push(`$ git ${args.join(" ")}`);
    const code = await this.git!.callMain(args);
    const commandOutput = this.output.slice(start).join("\n");
    const failed =
      (typeof code === "number" && code !== 0) ||
      (typeof code === "undefined" && /\b(Bad news:|ERROR \d+:)/.test(commandOutput));
    this.output.push(`[exit ${typeof code === "number" ? code : failed ? "unknown" : 0}] git ${args.join(" ")}`);
    if (failed) throw new Error(`git ${args.join(" ")} failed with exit code ${code}\n${this.outputText()}`);
  }

  private async tryRun(args: string[]) {
    try {
      await this.run(args);
    } catch (error) {
      this.output.push(error instanceof Error ? error.message : String(error));
    }
  }

  private syncFs(populate: boolean) {
    return new Promise<void>((resolve, reject) => {
      this.git!.FS.syncfs(populate, (error?: Error) => error ? reject(error) : resolve());
    });
  }

  private ensureDir(path: string) {
    if (!this.pathExists(path)) this.git!.FS.mkdir(path);
  }

  private pathExists(path: string) {
    return Boolean(this.git?.FS.analyzePath(path).exists);
  }

  private checkMixedContent(repoUrl: string) {
    if (globalThis.location?.protocol === "https:" && new URL(repoUrl).protocol === "http:") {
      throw new Error("当前页面是 HTTPS，浏览器会拦截 http:// 仓库请求。请使用 HTTPS 仓库地址。");
    }
  }

  private gitConfig() {
    const name = this.options.user?.name || "Browser Git SDK";
    const email = this.options.user?.email || "browser-git-sdk@example.local";
    return `[user]\nname = ${name}\nemail = ${email}\n`;
  }

  private outputText() {
    return this.output.join("\n").trim();
  }
}

function requiredPath(request: WorkspaceRequest) {
  if (!request.path) throw new Error("path is required");
  return request.path;
}
