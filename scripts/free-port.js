const { execSync } = require('child_process');

const port = process.env.PORT || 3001;

function freePort() {
  if (process.platform === 'win32') {
    try {
      const output = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      const lines = output.trim().split('\n');
      const pids = new Set();

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        // Protocol, Local Address, Foreign Address, State, PID
        if (parts.length >= 5 && parts[1].endsWith(`:${port}`) && parts[3] === 'LISTENING') {
          pids.add(parts[4]);
        }
      }

      for (const pid of pids) {
        if (pid && pid !== '0' && pid !== String(process.pid)) {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            console.log(`🧹 Port ${port} was busy. Automatically freed process (PID: ${pid}).`);
          } catch {
            // Process may have already exited
          }
        }
      }
    } catch {
      // Port is completely free, nothing to kill
    }
  }
}

freePort();
