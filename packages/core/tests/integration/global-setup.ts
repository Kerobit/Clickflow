import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CLICKFLOW_TEST_URL,
  getClickFlowTestUrl,
  waitForClickhouseReady,
} from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo root (contains compose.test.yaml): ClickFlow/ */
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const COMPOSE_FILE = path.join(REPO_ROOT, "compose.test.yaml");

function shouldManageDocker(): boolean {
  if (process.env.CI === "true") return false;
  if (process.env.CLICKFLOW_TEST_SKIP_DOCKER === "1") return false;
  return true;
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  if (shouldManageDocker()) {
    execFileSync("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d"], {
      stdio: "inherit",
      cwd: REPO_ROOT,
    });
    if (!process.env.CLICKFLOW_TEST_URL) {
      process.env.CLICKFLOW_TEST_URL = DEFAULT_CLICKFLOW_TEST_URL;
    }
  }

  await waitForClickhouseReady(getClickFlowTestUrl());

  return async () => {
    if (!shouldManageDocker()) return;
    try {
      execFileSync(
        "docker",
        ["compose", "-f", COMPOSE_FILE, "down", "--remove-orphans"],
        { stdio: "inherit", cwd: REPO_ROOT }
      );
    } catch {
      /* best-effort teardown */
    }
  };
}
