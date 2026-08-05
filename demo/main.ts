import { GitWorkspace } from "../src";
import "./style.css";

const repoUrl = input("repo-url");
const branch = input("branch");
const username = input("username");
const token = input("token");
const content = document.querySelector<HTMLTextAreaElement>("#content")!;
const result = document.querySelector<HTMLPreElement>("#result")!;

let workspace: GitWorkspace | undefined;
let key = "";

button("sync").onclick = () => run("sync", async () => workspaceForForm().sync());
button("files").onclick = () => run("files", async () => workspaceForForm().files());
button("read").onclick = () => run("read README", async () => {
  content.value = await workspaceForForm().readText("README.md");
  return { path: "README.md", bytes: content.value.length };
});
button("diff").onclick = () => run("diff", async () => workspaceForForm().diff());
button("commit-push").onclick = () => run("commit & push", async () => {
  const git = workspaceForForm();
  await git.writeText("README.md", content.value);
  await git.stage("README.md");
  await git.commit("Update README from browser-git-sdk demo");
  await git.push();
  return { pushed: true };
});

function workspaceForForm() {
  const nextKey = [repoUrl.value, branch.value, username.value, token.value].join("\n");
  if (!workspace || key !== nextKey) {
    key = nextKey;
    workspace = new GitWorkspace({
      repoUrl: repoUrl.value,
      branch: branch.value,
      username: username.value,
      token: token.value,
      user: {
        name: "browser-git-sdk demo",
        email: "browser-git-sdk-demo@example.local"
      }
    });
  }
  return workspace;
}

async function run(label: string, action: () => Promise<unknown>) {
  result.textContent = `Running ${label}...`;
  try {
    result.textContent = JSON.stringify(await action(), null, 2);
  } catch (error) {
    result.textContent = error instanceof Error ? error.stack || error.message : String(error);
  }
}

function input(id: string) {
  return document.querySelector<HTMLInputElement>(`#${id}`)!;
}

function button(id: string) {
  return document.querySelector<HTMLButtonElement>(`#${id}`)!;
}
