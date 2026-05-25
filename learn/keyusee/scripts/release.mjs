import { spawnSync } from 'node:child_process'

const validReleaseTypes = new Set(['patch', 'minor', 'major', 'prerelease'])
const releaseType = process.argv[2] ?? 'patch'

if (!validReleaseTypes.has(releaseType)) {
  console.error(`Unsupported release type: ${releaseType}`)
  console.error('Usage: npm run release -- [patch|minor|major|prerelease]')
  process.exit(1)
}

const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('npm', ['version', releaseType, '--no-git-tag-version'])
run('npm', ['run', 'dist'])
