export function normalizeGitHttpUrl(input: string) {
  const url = new URL(input);
  if ((url.protocol === "http:" || url.protocol === "https:") && !url.pathname.endsWith(".git")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}.git`;
  }
  return url.toString();
}

export function stripCredentials(input: string) {
  try {
    const url = new URL(input);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return input;
  }
}

export function withAccessToken(repoUrl: string, username = "", token = "") {
  if (!token.trim()) return repoUrl;

  const url = new URL(repoUrl);
  url.username = username || "oauth2";
  url.password = token;
  return url.toString();
}

export function repoSlug(repoUrl: string) {
  try {
    const url = new URL(repoUrl);
    return `${url.hostname}${url.pathname}`.replace(/\.git$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
  } catch {
    return repoUrl.replace(/\.git$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
  }
}
