export interface WasmGitFileSystem {
  analyzePath(path: string): { exists: boolean };
  chdir(path: string): void;
  mkdir(path: string): void;
  readFile(path: string, opts?: { encoding?: "utf8" }): string | Uint8Array;
  mount(type: unknown, opts: Record<string, unknown>, mountpoint: string): void;
  readdir(path: string): string[];
  syncfs(populate: boolean, callback: (error?: Error) => void): void;
  writeFile(path: string, data: string | Uint8Array): void;
}

export interface WasmGit {
  FS: WasmGitFileSystem;
  IDBFS: unknown;
  callMain(args: string[]): number | Promise<number>;
}

type InitGit = (options?: {
  print?: (message: string) => void;
  printErr?: (message: string) => void;
  locateFile?: (path: string) => string;
}) => Promise<WasmGit>;

let loaderUrl: string | undefined;

export async function loadWasmGit(jsPath: string, wasmPath: string): Promise<InitGit> {
  if (!loaderUrl) {
    const response = await fetch(jsPath);
    if (!response.ok) throw new Error(`Unable to load wasm-git runtime: HTTP ${response.status}`);

    const source = patchWasmGitHttpAuth(await response.text());
    loaderUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  }

  const { default: initGit } = (await import(/* @vite-ignore */ loaderUrl)) as { default: InitGit };
  return (options) => initGit({
    ...options,
    locateFile: (path) => path.endsWith(".wasm") ? wasmPath : options?.locateFile?.(path) ?? path
  });
}

function patchWasmGitHttpAuth(source: string) {
  const needle =
    'const xhr=new XMLHttpRequest;xhr.open(method,url,true);xhr.responseType="arraybuffer";if(headers){Object.keys(headers).forEach(header=>xhr.setRequestHeader(header,headers[header]))}';
  const replacement =
    'const xhr=new XMLHttpRequest;try{const authUrl=new URL(url,globalThis.location&&globalThis.location.href);if(authUrl.username||authUrl.password){const user=decodeURIComponent(authUrl.username);const pass=decodeURIComponent(authUrl.password);headers=Object.assign({},headers,{"Authorization":"Basic "+btoa(unescape(encodeURIComponent(user+":"+pass)))});authUrl.username="";authUrl.password="";url=authUrl.href}}catch(e){}xhr.open(method,url,true);xhr.responseType="arraybuffer";if(headers){Object.keys(headers).forEach(header=>xhr.setRequestHeader(header,headers[header]))}';

  if (!source.includes(needle)) {
    throw new Error("wasm-git HTTP transport patch failed: target code was not found");
  }

  return source.replace(needle, replacement);
}
