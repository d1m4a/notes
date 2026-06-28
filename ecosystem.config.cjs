const fs = require('node:fs');
const path = require('node:path');

function readEnvFile() {
  const envPath = path.join(__dirname, '.env');

  if (!fs.existsSync(envPath)) {
    return {};
  }

  return fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
        return env;
      }

      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
      env[key.trim()] = value;
      return env;
    }, {});
}

const fileEnv = readEnvFile();

module.exports = {
  apps: [
    {
      name: 'notes',
      script: 'server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: fileEnv.PORT || process.env.PORT || 3001,
        NOTES_PASSWORD: fileEnv.NOTES_PASSWORD || process.env.NOTES_PASSWORD,
        SESSION_SECRET: fileEnv.SESSION_SECRET || process.env.SESSION_SECRET,
        COOKIE_SECURE: fileEnv.COOKIE_SECURE || process.env.COOKIE_SECURE || 'false',
        NOTES_DATA_DIR: fileEnv.NOTES_DATA_DIR || process.env.NOTES_DATA_DIR || './data'
      }
    }
  ]
};
