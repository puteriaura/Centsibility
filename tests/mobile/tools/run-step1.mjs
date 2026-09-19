import { execSync, spawn } from "child_process";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { webkit } from "@playwright/test";

async function main() {
  // 1. Git rev-parse HEAD
  const commit = execSync("git rev-parse HEAD").toString().trim();
  console.log(`[STEP 1] Git HEAD: ${commit}`);

  // 2. npm run build
  console.log(`[STEP 1] Rebuilding production from HEAD...`);
  const buildOutput = execSync("npm run build", { encoding: "utf8" });
  console.log(buildOutput);

  // 3. Hash dist/assets/*
  const distDir = path.resolve("dist/assets");
  const files = fs.readdirSync(distDir);
  const distHashes = {};
  console.log(`[STEP 1] Asset Hashes (SHA-256):`);
  for (const file of files) {
    const filePath = path.join(distDir, file);
    const data = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    distHashes[file] = hash;
    console.log(`  ${file}: ${hash}`);
  }

  // 4. Playwright and WebKit versions
  const pwVersion = execSync("npx playwright --version", { encoding: "utf8" }).toString().trim();
  let webkitVersion = "unknown";
  try {
    const browser = await webkit.launch();
    webkitVersion = browser.version();
    await browser.close();
  } catch (e) {
    console.error("Failed to get WebKit browser version:", e.message);
  }
  console.log(`[STEP 1] Playwright Version: ${pwVersion}`);
  console.log(`[STEP 1] WebKit Browser Version: ${webkitVersion}`);

  // 5. Start preview server on 4173
  console.log(`[STEP 1] Starting preview server on http://localhost:4173...`);
  const preview = spawn("npx", ["vite", "preview", "--port", "4173"], {
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

  // 6. Run mobile-matrix.spec.ts
  console.log(`[STEP 1] Running mobile-matrix.spec.ts against http://localhost:4173...`);
  const isoTimestamp = new Date().toISOString();
  try {
    execSync("npx playwright test tests/mobile/mobile-matrix.spec.ts", {
      stdio: "inherit",
      env: {
        ...process.env,
        BASE_URL: "http://localhost:4173",
        MATRIX_OUT: "after-final.json",
      },
    });
  } catch (err) {
    console.log(`Playwright test execution finished with status: ${err.status}`);
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

  // 7. Write after-final.meta.json
  const meta = {
    commit,
    timestamp: isoTimestamp,
    baseUrl: "http://localhost:4173",
    distHashes,
    playwrightVersion: pwVersion,
    webkitVersion,
    viewports: [
      "320x568",
      "360x800",
      "390x844",
      "430x932",
      "768x1024",
      "844x390",
    ],
    engines: ["chromium", "webkit"],
    totalTests: 240,
  };
  fs.writeFileSync(
    "tests/mobile/results/after-final.meta.json",
    JSON.stringify(meta, null, 2)
  );
  console.log(`[STEP 1] Written tests/mobile/results/after-final.meta.json`);
}

main().catch((err) => {
  console.error("Step 1 failed:", err);
  process.exit(1);
});
