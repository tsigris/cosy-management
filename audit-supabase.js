const fs = require('fs')
const path = require('path')

const root = './src'

const exts = ['.ts', '.tsx', '.js', '.jsx']

const violations = []
const legacyImports = []
const createClientInClient = []

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      walk(fullPath)
      continue
    }

    const ext = path.extname(entry.name)
    if (!exts.includes(ext)) continue

    const content = fs.readFileSync(fullPath, 'utf8')

    const usesSupabaseDot = /\bsupabase\s*\./.test(content)

    if (usesSupabaseDot) {
      const hasImport =
        /import\s*\{\s*getSupabase\s*\}\s*from\s*['"]@\/lib\/supabase['"]/.test(
          content
        )

      const hasConst =
        /const\s+supabase\s*=\s*getSupabase\s*\(\s*\)/.test(content)

      if (!hasImport || !hasConst) {
        violations.push(fullPath)
      }
    }

    if (
      /import\s*\{\s*supabase\s*\}\s*from\s*['"]@\/lib\/supabase['"]/.test(
        content
      )
    ) {
      legacyImports.push(fullPath)
    }

    if (
      /['"]use client['"]/.test(content) &&
      /createClient\s*\(/.test(content)
    ) {
      createClientInClient.push(fullPath)
    }
  }
}

walk(root)

console.log('\n=== MISSING getSupabase import/const ===\n')
console.log(violations.length ? violations.join('\n') : 'NONE')

console.log('\n=== LEGACY import { supabase } ===\n')
console.log(legacyImports.length ? legacyImports.join('\n') : 'NONE')

console.log('\n=== createClient inside client files ===\n')
console.log(createClientInClient.length ? createClientInClient.join('\n') : 'NONE')