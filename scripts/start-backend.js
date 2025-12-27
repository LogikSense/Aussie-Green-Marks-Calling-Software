const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const backendDir = path.join(__dirname, '..', 'backend');
const venvPath = path.join(backendDir, process.platform === 'win32' ? 'venv\\Scripts\\python.exe' : 'venv/bin/python');
const mainPy = path.join(backendDir, 'main.py');

console.log('Starting Backend Server...\n');

// Check if venv exists, if not create it
const venvDir = path.join(backendDir, 'venv');
if (!fs.existsSync(venvDir)) {
  console.log('Creating virtual environment...');
  const venvProcess = spawn('python', ['-m', 'venv', 'venv'], { 
    cwd: backendDir,
    stdio: 'inherit',
    shell: true 
  });
  
  venvProcess.on('close', (code) => {
    if (code === 0) {
      installAndStart();
    } else {
      console.error('Failed to create virtual environment');
      process.exit(1);
    }
  });
} else {
  installAndStart();
}

function installAndStart() {
  // Install dependencies
  console.log('Installing/updating dependencies...');
  const pipPath = process.platform === 'win32' 
    ? path.join(backendDir, 'venv', 'Scripts', 'pip.exe')
    : path.join(backendDir, 'venv', 'bin', 'pip');
  
  const installProcess = spawn(pipPath, ['install', '-q', '-r', 'requirements.txt'], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: true
  });

  installProcess.on('close', (code) => {
    if (code === 0) {
      // Start the server
      console.log('Starting FastAPI server on http://localhost:8000\n');
      const pythonPath = process.platform === 'win32'
        ? path.join(backendDir, 'venv', 'Scripts', 'python.exe')
        : path.join(backendDir, 'venv', 'bin', 'python');
      
      const serverProcess = spawn(pythonPath, [mainPy], {
        cwd: backendDir,
        stdio: 'inherit',
        shell: true
      });

      serverProcess.on('close', (code) => {
        console.log(`\nBackend server exited with code ${code}`);
        process.exit(code);
      });

      process.on('SIGINT', () => {
        console.log('\nShutting down backend server...');
        serverProcess.kill();
        process.exit(0);
      });
    } else {
      console.error('Failed to install dependencies');
      process.exit(1);
    }
  });
}

