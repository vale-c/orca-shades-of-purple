// Copies the two Shades of Purple VS Code themes from upstream at the pinned commit.
// Usage: node scripts/vendor-palette.mjs
// Upstream writes its themes by hand as JSON with comments, so this only strips the comments and
// trailing commas. Writes scripts/shades-of-purple-palette.json. To move to a newer upstream
// commit, change COMMIT and run it again.
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const REPOSITORY = 'https://github.com/ahmadawais/shades-of-purple-vscode'
const COMMIT = 'e8eb49f33e5db05ceba6677367b33ddb27ad821c'
// Orca theme id: upstream theme file. The italic file only restyles fonts, so it is left out.
const STYLES = {
  'shades-of-purple': 'themes/shades-of-purple-color-theme.json',
  'shades-of-purple-super-dark': 'themes/shades-of-purple-color-theme-super-dark.json'
}

async function fetchText(file) {
  const url = `${REPOSITORY.replace('github.com', 'raw.githubusercontent.com')}/${COMMIT}/${file}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`)
  }
  return response.text()
}

/** JSON with // and block comments and trailing commas, as VS Code reads theme files. */
function parseJsonc(text) {
  // Each pass copies strings unchanged and drops what `skip` matches outside them.
  const pass = (input, skip) => {
    let out = ''
    for (let i = 0; i < input.length; i += 1) {
      if (input[i] === '"') {
        let end = i + 1
        while (input[end] !== '"') {
          end += input[end] === '\\' ? 2 : 1
        }
        out += input.slice(i, end + 1)
        i = end
        continue
      }
      skip.lastIndex = i
      const match = skip.exec(input)
      if (match) {
        i += match[0].length - 1
      } else {
        out += input[i]
      }
    }
    return out
  }
  const withoutComments = pass(text, /\/\/[^\n]*|\/\*[\s\S]*?\*\//y)
  return JSON.parse(pass(withoutComments, /,(?=\s*[}\]])/y))
}

const { version } = JSON.parse(await fetchText('package.json'))
const styles = {}
for (const [id, file] of Object.entries(STYLES)) {
  const { name, type, colors, tokenColors } = parseJsonc(await fetchText(file))
  if (type !== 'dark') {
    throw new Error(`${file} is a ${type} theme; this plugin ships every style as dark`)
  }
  // Why without each rule's name: names are comments, and some upstream names hold em dashes.
  styles[id] = { file, name, colors, tokenColors: tokenColors.map(({ scope, settings }) => ({ scope, settings })) }
}

const out = { repository: REPOSITORY, commit: COMMIT, version, styles }
writeFileSync(path.join(import.meta.dirname, 'shades-of-purple-palette.json'), `${JSON.stringify(out, null, 2)}\n`)
console.log(`Vendored ${Object.keys(styles).length} styles of Shades of Purple ${version} from ${COMMIT}.`)
