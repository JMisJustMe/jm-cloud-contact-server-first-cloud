import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

export async function ensureDir(directory) {
  await mkdir(directory, { recursive: true });
  return directory;
}

export async function writeText(filename, value) {
  await ensureDir(path.dirname(filename));
  await writeFile(filename, value, "utf8");
  return filename;
}

export async function writeJson(filename, value) {
  return writeText(filename, `${JSON.stringify(value, null, 2)}\n`);
}

export async function sha256File(filename) {
  const bytes = await readFile(filename);
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
    maxBuffer: 32 * 1024 * 1024
  });

  if (result.error) {
    throw new Error(`${command} could not start: ${result.error.message}`);
  }
  if (result.status !== 0 && !options.allowFailure) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} exited ${result.status}${detail ? `\n${detail}` : ""}`);
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

export function safeName(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function javaPackagePath(packageName) {
  return packageName.split(".").join("/");
}

export function utcStamp() {
  return new Date().toISOString();
}
