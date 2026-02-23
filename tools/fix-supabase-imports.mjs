import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");

const exts = new Set([".ts", ".tsx", ".js", ".jsx"]);

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && exts.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

function replaceAll(content) {
  let changed = false;
  let c = content;

  const before = c;

  // 1) Όπου γίνεται import από supabase-browser -> supabase
  c = c.replace(
    /import\s+\{\s*([^\}]+)\s*\}\s+from\s+['"]@\/lib\/supabase-browser['"]\s*;?/g,
    (m, imports) => {
      changed = true;
      // Ό,τι κι αν ζητάει από supabase-browser, το κάνουμε supabase
      // (θα διορθώσουμε πιο κάτω τις χρήσεις)
      return `import { supabase } from '@/lib/supabase'`;
    }
  );

  // 2) Αν έχει import supabase-js createClient στο login κλπ και ΚΑΝΕΙ local supabase const,
  //    δεν το πειράζουμε. Μόνο τα patterns που έβαλε το supabase-browser.
  // 3) Αφαιρούμε "const supabase = getSupabaseBrowser()" ή "createSupabaseBrowserClient()"
  c = c.replace(
    /^\s*const\s+supabase\s*=\s*(getSupabaseBrowser|getSupabaseBrowserClient|createSupabaseBrowserClient)\s*\(\s*\)\s*;?\s*$/gm,
    () => {
      changed = true;
      return "";
    }
  );

  // 4) Αν κάπου κάνει call inline, π.χ. getSupabaseBrowser().from(...)
  c = c.replace(/\b(getSupabaseBrowser|getSupabaseBrowserClient|createSupabaseBrowserClient)\s*\(\s*\)\s*\./g, () => {
    changed = true;
    return "supabase.";
  });

  // 5) Αν κάπου είχε import { createSupabaseBrowserClient } από '@/lib/supabase-browser'
  //    και μετά το χρησιμοποιεί, το κάνουμε supabase (βήμα 1+3+4 καλύπτει το 95%)
  // 6) Καθαρίζουμε διπλά κενά γραμμών που έμειναν
  c = c.replace(/\n{3,}/g, "\n\n");

  if (c !== before) changed = true;

  return { content: c, changed };
}

const files = walk(SRC_DIR);
let changedCount = 0;

for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  const { content, changed } = replaceAll(raw);
  if (changed) {
    fs.writeFileSync(file, content, "utf8");
    changedCount++;
    console.log("UPDATED:", path.relative(ROOT, file));
  }
}

console.log(`\nDone. Updated ${changedCount} files.`);