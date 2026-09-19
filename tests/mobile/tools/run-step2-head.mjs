import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

async function main() {
  const rootDir = process.cwd();

  console.log(`[STEP 2 HEAD] Starting preview on http://localhost:4173...`);
  const preview = spawn("npx", ["vite", "preview", "--port", "4173"], {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  await new Promise((resolve) => {
    preview.stdout.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("4173") || msg.includes("Local:")) {
        resolve();
      }
    });
    setTimeout(resolve, 3000);
  });

  console.log(`[STEP 2 HEAD] Running mobile-matrix-v2.spec.ts against HEAD on port 4173...`);
  try {
    execSync("npx playwright test tests/mobile/mobile-matrix-v2.spec.ts", {
      cwd: rootDir,
      stdio: "inherit",
      env: {
        ...process.env,
        BASE_URL: "http://localhost:4173",
        MATRIX_OUT: "after-v2.json",
      },
    });
  } catch (err) {
    console.log(`HEAD v2 run finished with code: ${err.status}`);
  } finally {
    // Kill preview
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: "ignore" });
      } else {
        preview.kill();
      }
    } catch {}
  }

  console.log(`[STEP 2 HEAD] Done. Results written to tests/mobile/results/after-v2.json`);
}

main().catch((err) => {
  console.error("Step 2 HEAD runner failed:", err);
  process.exit(1);
});
