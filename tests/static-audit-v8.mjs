import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0, checks = 0;
const ok = (name, condition, detail = "") => { checks++; if (condition) console.log(`  ✓ ${name}`); else { failures++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); } };
function walk(dir, filter, out = []) { for (const e of fs.readdirSync(path.join(REPO, dir), { withFileTypes:true })) { const rel=path.join(dir,e.name); if(e.isDirectory()){ if(["node_modules",".git"].includes(e.name)) continue; walk(rel,filter,out); } else if(filter(rel)) out.push(rel); } return out; }
const htmlFiles=walk(".",f=>f.endsWith(".html")&&!f.includes("templates/"));
const jsFiles=walk("assets/js",f=>f.endsWith(".js"));
const cssFiles=walk("assets/css",f=>f.endsWith(".css"));

console.log("\n[links]");
const broken=[];
for(const file of htmlFiles){const html=fs.readFileSync(path.join(REPO,file),"utf8");for(const m of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)){const target=m[1].split("?")[0].split("#")[0];if(/^(https?:|mailto:|data:)/.test(target)||!target)continue;const resolved=path.resolve(path.dirname(path.join(REPO,file)),target);if(!fs.existsSync(resolved))broken.push(`${file} → ${target}`);}}
ok(`${htmlFiles.length} HTML files, no broken relative links`,broken.length===0,broken.join("; "));

console.log("\n[shell]");
const app=fs.readFileSync(path.join(REPO,"assets/js/app.js"),"utf8");
ok("one canonical navigation renderer is defined",app.includes("function ensureCanonicalRail()")&&app.includes("ensureCanonicalRail();"));
const missingRail=htmlFiles.filter(f=>!fs.readFileSync(path.join(REPO,f),"utf8").includes('class="app-rail"'));
ok("every page provides the rail mount point",missingRail.length===0,missingRail.join(", "));
const missingApp=htmlFiles.filter(f=>!fs.readFileSync(path.join(REPO,f),"utf8").includes("assets/js/app.js"));
ok("every page uses the canonical app entry point",missingApp.length===0,missingApp.join(", "));

console.log("\n[modules]");
const missing=[];
for(const file of jsFiles){const src=fs.readFileSync(path.join(REPO,file),"utf8");for(const m of src.matchAll(/from\s+"(\.[^"]+)"|import\("(\.[^"]+)"\)/g)){const spec=m[1]||m[2],resolved=path.resolve(path.dirname(path.join(REPO,file)),spec);if(!fs.existsSync(resolved))missing.push(`${file} → ${spec}`);}}
ok(`${jsFiles.length} JS files, all imports resolve`,missing.length===0,missing.join("; "));

console.log("\n[contracts]");
const offenders=[];
for(const file of [...htmlFiles,...jsFiles]){const src=fs.readFileSync(path.join(REPO,file),"utf8");if(/\bwindow\.(LBI|LBIData|LBISignals)\b|\bLBI\.t\(/.test(src))offenders.push(`${file}: legacy global`);if(/data-i18n|lang-switch|data-translate/.test(src))offenders.push(`${file}: translation markup`);if(/MutationObserver|setInterval\(/.test(src))offenders.push(`${file}: recurring render patch`);}
ok("no legacy globals, translation markup or recurring render patching",offenders.length===0,offenders.join("; "));
ok("deprecated economy render patches are removed",!fs.existsSync(path.join(REPO,"assets/js/render/economy-display-ja.js"))&&!fs.existsSync(path.join(REPO,"assets/js/render/cost-trend-panel.js")));

console.log("\n[a11y / console]");
ok("skip link present on every page",htmlFiles.every(f=>fs.readFileSync(path.join(REPO,f),"utf8").includes('class="skip-link"')));
ok("status ribbon present on every page",htmlFiles.every(f=>fs.readFileSync(path.join(REPO,f),"utf8").includes('id="app-ribbon"')));
ok("theme/density boot exists on every page",htmlFiles.every(f=>fs.readFileSync(path.join(REPO,f),"utf8").includes('localStorage.getItem("lbi:theme")')));
ok(":focus-visible styling exists",cssFiles.some(f=>/:focus-visible/.test(fs.readFileSync(path.join(REPO,f),"utf8"))));
const hard=[];for(const file of cssFiles.filter(f=>!f.endsWith("tokens.css"))){const css=fs.readFileSync(path.join(REPO,file),"utf8"),printStart=css.indexOf("@media print"),body=printStart===-1?css:css.slice(0,printStart);for(const m of body.matchAll(/#[0-9a-fA-F]{3,8}\b/g))hard.push(`${file}:${m[0]}`);}
ok("no hard-coded colours outside tokens.css",hard.length===0,hard.slice(0,6).join(", "));

console.log(`\n${checks} checks, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
