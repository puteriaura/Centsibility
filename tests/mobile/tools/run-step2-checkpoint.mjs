import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

async function main() {
  const rootDir = process.cwd();
  const worktreeDir = path.resolve(rootDir, "../centsibility-checkpoint");

  console.log(`[STEP 2 CHECKPOINT] Cleaning any previous worktree at ${worktreeDir}...`);
  try {
    execSync(`git worktree remove "${worktreeDir}" --force`, { stdio: "ignore" });
  } catch {}
  if (fs.existsSync(worktreeDir)) {
    try {
      fs.rmSync(worktreeDir, { recursive: true, force: true });
    } catch {}
  }

  console.log(`[STEP 2 CHECKPOINT] Creating git worktree at commit 370f5bc...`);
  execSync(`git worktree add "${worktreeDir}" 370f5bc`, { stdio: "inherit" });

  console.log(`[STEP 2 CHECKPOINT] Linking node_modules...`);
  const nmTarget = path.join(worktreeDir, "node_modules");
  const nmSource = path.join(rootDir, "node_modules");
  if (process.platform === "win32") {
    execSync(`cmd /c mklink /J "${nmTarget}" "${nmSource}"`, { stdio: "inherit" });
  } else {
    fs.symlinkSync(nmSource, nmTarget, "junction");
  }

  console.log(`[STEP 2 CHECKPOINT] Building checkpoint production bundle...`);
  execSync("npm run build", { cwd: worktreeDir, stdio: "inherit" });

  console.log(`[STEP 2 CHECKPOINT] Starting preview on http://localhost:4174...`);
  const preview = spawn("npx", ["vite", "preview", "--port", "4174"], {
    cwd: worktreeDir,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  await new Promise((resolve) => {
    preview.stdout.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("4174") || msg.includes("Local:")) {
        resolve();
      }
    });
    setTimeout(resolve, 3000);
  });

  console.log(`[STEP 2 CHECKPOINT] Running mobile-matrix-v2.spec.ts against checkpoint on port 4174...`);
  try {
    execSync("npx playwright test tests/mobile/mobile-matrix-v2.spec.ts", {
      cwd: rootDir,
      stdio: "inherit",
      env: {
        ...process.env,
        BASE_URL: "http://localhost:4174",
        MATRIX_OUT: "before-v2.json",
      },
    });
  } catch (err) {
    console.log(`Checkpoint v2 run finished with code: ${err.status}`);
  } finally {
    // Kill preview
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: "ignore" });
      } else {
        preview.kill();
      }
    } catch {}

    // Remove worktree
    console.log(`[STEP 2 CHECKPOINT] Removing worktree...`);
    try {
      // Remove junction first
      if (process.platform === "win32" && fs.existsSync(nmTarget)) {
        execSync(`cmd /c rmdir "${nmTarget}"`, { stdio: "ignore" });
      }
      execSync(`git worktree remove "${worktreeDir}" --force`, { stdio: "inherit" });
    } catch (e) {
      console.error("Worktree cleanup notice:", e.message);
    }
  }

  console.log(`[STEP 2 CHECKPOINT] Done. Results written to tests/mobile/results/before-v2.json`);
}

main().catch((err) => {
  console.error("Step 2 Checkpoint runner failed:", err);
  process.exit(1);
});
