# browser-git-sdk

Lightweight browser Git workspace SDK powered by libgit2 WebAssembly.

This package is intentionally small and internal-facing. It hides wasm-git loading, IndexedDB persistence, Git HTTP auth handling, file reads/writes, status and diff parsing behind a single `GitWorkspace` class.

## Install

For local internal usage:

```json
{
  "dependencies": {
    "browser-git-sdk": "https://github.com/PayFv/browser-git-sdk.git"
  }
}
```

The host app must serve these wasm-git runtime files:

```txt
/vendor/wasm-git/lg2_async.js
/vendor/wasm-git/lg2_async.wasm
```

In this repo they are copied into `public/vendor/wasm-git/` by:

```sh
npm install
```

## Basic usage

```ts
import { GitWorkspace } from "browser-git-sdk";

const git = new GitWorkspace({
  repoUrl: "http://192.168.167.250:3030/demo/demo-repo",
  username: "demo",
  token: "access-token",
  branch: "main"
});

await git.sync();

const files = await git.files();
const readme = await git.readText("README.md");

await git.writeText("README.md", `${readme}\nUpdated from browser\n`);

const status = await git.status();
const diff = await git.diff();

await git.stage("README.md");
await git.commit("Update README from browser");
await git.push();
```

## API

```ts
class GitWorkspace {
  init(): Promise<void>;
  sync(): Promise<SyncResult>;

  files(path?: string): Promise<string[]>;
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;

  status(): Promise<GitStatus>;
  diff(path?: string): Promise<GitDiff>;

  stage(path: string): Promise<void>;
  commit(message?: string): Promise<void>;
  push(): Promise<void>;

  raw(args: string[]): Promise<GitOutput>;
  call(request: WorkspaceRequest): Promise<WorkspaceResponse>;
}
```

`diff()` returns both raw unified diff text and parsed data suitable for a simple IDE-style diff viewer.

## Demo

Run the single-page demo:

```sh
npm install
npm run dev
```

Open the printed local URL. The demo is deliberately small and only meant to exercise the SDK directly. Full integration testing still lives in `git-ui-test`.

## Notes

- Repositories are stored in IndexedDB through Emscripten IDBFS.
- HTTP Git servers must allow browser CORS requests.
- HTTPS pages cannot fetch `http://` repositories because of browser mixed-content rules.
- Credentials are used for Git HTTP requests and then removed from the saved remote URL.
