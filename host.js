/**
 * Meowvie Local Host Script
 * Fast, one-command local hosting for Meowvie.
 * 
 * Usage:
 *   node host.js           (hosts production build fast & opens browser)
 *   node host.js --build   (rebuilds client before hosting)
 *   node host.js --no-open (do not auto-open browser)
 *   node host.js --port=4000 (run on custom port)
 */

const { spawn, execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const ROOT_DIR = __dirname;
const DIST_INDEX = path.join(ROOT_DIR, 'dist', 'index.html');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
const SERVER_DIR = path.join(ROOT_DIR, 'server');

// Parse CLI args
const args = process.argv.slice(2);
const forceBuild = args.includes('--build') || args.includes('-b');
const noOpen = args.includes('--no-open');
const isDev = args.includes('--dev');
const portArg = args.find(a => a.startsWith('--port='));
const PORT = portArg ? parseInt(portArg.split('=')[1], 10) : (process.env.PORT || 3001);

// Helper to get local LAN IP addresses
function getNetworkIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// Open URL in default browser
function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === 'win32') {
    cmd = `cmd.exe /c start "" "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, () => {});
}

// Verify node_modules exist
function checkDependencies() {
  const rootNM = fs.existsSync(path.join(ROOT_DIR, 'node_modules'));
  const clientNM = fs.existsSync(path.join(CLIENT_DIR, 'node_modules'));
  const serverNM = fs.existsSync(path.join(SERVER_DIR, 'node_modules'));

  if (!rootNM || !clientNM || !serverNM) {
    console.log('📦 Installing required dependencies (first-time setup)...');
    execSync('npm run install:all', { stdio: 'inherit', cwd: ROOT_DIR });
  }
}

// Build client if needed
function checkBuild() {
  const distExists = fs.existsSync(DIST_INDEX);
  if (!distExists || forceBuild) {
    console.log('⚡ Building client assets for fast local hosting...');
    execSync('npm --prefix client run build', { stdio: 'inherit', cwd: ROOT_DIR });
    console.log('✅ Build complete!\n');
  }
}

// Check when server is ready
function waitForServer(port, timeoutMs = 15000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.end();
    };

    const retry = () => {
      if (Date.now() - startTime > timeoutMs) {
        // Resolve anyway so process doesn't hang if endpoint differs
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };

    check();
  });
}

function printBanner(port) {
  const networkIps = getNetworkIps();
  const localUrl = `http://localhost:${port}`;

  console.log('\n=============================================================');
  console.log('   🐝  Meowvie Local Host is LIVE');
  console.log('=============================================================');
  console.log(`   ➜ Local:    \x1b[36m${localUrl}\x1b[0m`);
  if (networkIps.length > 0) {
    networkIps.forEach(ip => {
      console.log(`   ➜ Network:  \x1b[36mhttp://${ip}:${port}\x1b[0m`);
    });
  }
  console.log('-------------------------------------------------------------');
  console.log('   💡 Share the Network URL with devices on the same Wi-Fi!');
  console.log('   🛑 Press Ctrl + C at any time to stop.');
  console.log('=============================================================\n');
}

async function main() {
  try {
    checkDependencies();

    if (isDev) {
      console.log('🚀 Launching in development mode...');
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const devProcess = spawn(npmCmd, ['run', 'dev'], {
        stdio: 'inherit',
        cwd: ROOT_DIR,
      });
      return;
    }

    checkBuild();

    console.log(`🚀 Starting Meowvie server on port ${PORT}...`);

    const serverEnv = { ...process.env, PORT: String(PORT) };
    const serverProcess = spawn('node', ['server/index.js'], {
      env: serverEnv,
      stdio: 'inherit',
      cwd: ROOT_DIR,
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server process:', err);
      process.exit(1);
    });

    // Wait for server to respond
    await waitForServer(PORT);

    printBanner(PORT);

    if (!noOpen) {
      console.log('🌐 Opening Meowvie in your default browser...');
      openBrowser(`http://localhost:${PORT}`);
    }

    // Handle shutdown
    const cleanup = () => {
      console.log('\n🛑 Shutting down Meowvie server...');
      if (serverProcess.pid) {
        if (process.platform === 'win32') {
          try {
            execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: 'ignore' });
          } catch (e) {
            // Process might have already terminated
          }
        } else {
          serverProcess.kill('SIGTERM');
        }
      }
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    serverProcess.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.log(`Server exited with code ${code}`);
      }
      process.exit(code || 0);
    });

  } catch (err) {
    console.error('Error starting Meowvie:', err);
    process.exit(1);
  }
}

main();
