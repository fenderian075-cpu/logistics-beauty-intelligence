import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks=0,failures=0;
const ok=(name,condition,detail="")=>{checks++;if(condition)console.log(`  ✓ ${name}`);else{failures++;console.log(`  ✗ ${name}${detail?` — ${detail}`:""}`);}};
const readJSON=rel=>JSON.parse(fs.readFileSync(path.join(REPO,rel),"utf8"));
const reports=readJSON("data/reports.json").reports||[];
const latest=type=>reports.filter(r=>r.type===type&&r.path&&fs.existsSync(path.join(REPO,r.path))).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]||null;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function render(html,{url=`https://example.test/${html}`,readySelector}={}){
  const dom=new JSDOM(fs.readFileSync(path.join(REPO,html),"utf8"),{url,pretendToBeVisual:true});
  const {window}=dom;const errors=[],warnings=[];
  window.fetch=target=>{const rel=String(target).replace(/^.*?(data\/)/,"$1").split("?")[0];const p=path.join(REPO,rel);return fs.existsSync(p)?Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(readJSON(rel))}):Promise.resolve({ok:false,status:404,json:()=>Promise.reject(new Error(`404 ${rel}`))});};
  const g=globalThis,saved={};const names=["window","document","location","history","fetch","Option","URLSearchParams","Node","NodeFilter","HTMLElement","Element","CustomEvent","Event","getComputedStyle","localStorage","KeyboardEvent"];
  names.forEach(n=>{saved[n]=g[n];g[n]=window[n];});
  const realError=console.error,realWarn=console.warn;console.error=(...a)=>errors.push(a.join(" "));console.warn=(...a)=>warnings.push(a.join(" "));
  try{
    const store=await import(pathToFileURL(path.join(REPO,"assets/js/data/store.js")).href);store.resetCache();
    await import(`${pathToFileURL(path.join(REPO,"assets/js/app.js")).href}?case=${Date.now()}-${Math.random()}`);
    window.document.dispatchEvent(new window.Event("DOMContentLoaded",{bubbles:true}));
    // Dynamic imports in app.js deliberately do not block boot(). Poll for the
    // page-specific render contract rather than relying on a machine-dependent delay.
    for(let i=0;i<50;i++){
      if(!readySelector||window.document.querySelector(readySelector))break;
      await sleep(20);
    }
    await sleep(20);
  }finally{console.error=realError;console.warn=realWarn;}
  const release=()=>names.forEach(n=>{g[n]=saved[n];});
  return{window,document:window.document,errors,warnings,release};
}

async function dashboard(){console.log("\n[v8 dashboard]");const r=await render("index.html",{readySelector:"#economic-flow-home"}),d=r.document;
  ok("renders without console errors",r.errors.length===0,r.errors[0]);
  ok("canonical rail includes Economic Flow",!!d.querySelector('.rail-link[data-nav="economy"][href$="economic-flow.html"]'));
  ok("canonical rail uses バズ",d.querySelector('.rail-link[data-nav="buzz"]')?.textContent.trim()==="バズ");
  ok("rail count mounts exist",!!d.getElementById("rail-count-radar")&&!!d.getElementById("rail-count-topic"));
  ok("Market Pulse is mounted",!!d.getElementById("economic-flow-home"));
  ok("Market Pulse has KPI cards",d.querySelectorAll("#economic-flow-home .kpi-card").length>=6,String(d.querySelectorAll("#economic-flow-home .kpi-card").length));
  ok("operational flow is mounted",d.querySelectorAll("#economic-flow-home .op-flow__step").length>=5);
  ["daily","weekly","monthly"].forEach(type=>{const a=d.getElementById(`nav-latest-${type}`),target=latest(type);ok(`${type} navigation resolves to an existing report`,!!a&&!!target&&a.getAttribute("href").endsWith(target.path),`${a?.getAttribute("href")} / ${target?.path}`);});
  r.release();}

async function economy(){console.log("\n[v8 economic flow]");const r=await render("economic-flow.html",{readySelector:"#history-analysis"}),d=r.document;
  ok("renders without console errors",r.errors.length===0,r.errors[0]);
  ok("KPI strip rendered",d.querySelectorAll("#flow-kpi .kpi-card").length>=6,String(d.querySelectorAll("#flow-kpi .kpi-card").length));
  ["demand","trade","volume","cost","macro"].forEach(id=>ok(`${id} analytical block exists`,!!d.getElementById(id)));
  const costText=d.getElementById("cost")?.textContent||"";
  ok("fuel and ocean data are visible in cost block",/軽油/.test(costText)&&/WCI|世界コンテナ/.test(costText),costText.slice(0,300));
  ok("ocean freight stays USD-based",/ドル\/40ft|ドル建て/.test(costText),costText.slice(0,300));
  ok("charts carry accessible SVG roles",Array.from(d.querySelectorAll(".chart__svg")).every(svg=>svg.getAttribute("role")==="img"));
  ok("chart numeric tables are retained as drill-downs",d.querySelectorAll("details.chart-data").length>=1);
  ok("raw dataset tables are drill-downs",d.querySelectorAll("details.flow-table").length>=1);
  ok("no single-observation fake line is advertised",!Array.from(d.querySelectorAll(".chart-absent")).some(n=>!n.textContent.includes("1時点")&&!n.textContent.includes("系列")));
  ok("history drilldowns are exposed on KPI and dataset rows",d.querySelectorAll("[data-history-metric].history-trigger").length>=6,String(d.querySelectorAll("[data-history-metric].history-trigger").length));
  const road=d.querySelector('[data-history-metric="road_freight"]');
  ok("long-run road freight series is clickable",!!road);
  if(road){road.dispatchEvent(new r.window.MouseEvent("click",{bubbles:true,cancelable:true}));await sleep(10);}
  const panel=d.getElementById("history-analysis");
  ok("history panel opens for a selected metric",!!panel&&!panel.hidden);
  ok("history panel renders summary statistics",d.querySelectorAll("#history-analysis .history-stat").length===6,String(d.querySelectorAll("#history-analysis .history-stat").length));
  ok("history panel renders long-run chart",!!d.querySelector("#history-analysis .history-chart .chart__svg"));
  ok("history panel exposes period windows",d.querySelectorAll("#history-analysis [data-history-window]").length===5);
  ok("history panel exposes observation table",!!d.querySelector("#history-analysis .history-table"));
  ok("selected metric is reflected in URL",r.window.location.search.includes("metric=road_freight"),r.window.location.search);
  const ten=d.querySelector('#history-analysis [data-history-window="10y"]');if(ten){ten.dispatchEvent(new r.window.MouseEvent("click",{bubbles:true,cancelable:true}));await sleep(5);}
  ok("history window can be changed",d.querySelector('#history-analysis [data-history-window="10y"]')?.getAttribute("aria-pressed")==="true");
  r.release();}

async function archive(){console.log("\n[v8 archive]");const r=await render("archive.html",{readySelector:"#archive-list .archive-item"}),d=r.document;
  ok("renders without console errors",r.errors.length===0,r.errors[0]);
  ok("structured signal filters exist",["filter-lens","filter-change","filter-conf"].every(id=>d.getElementById(id)));
  r.release();}

async function buzz(){console.log("\n[v8 buzz]");const r=await render("buzz.html",{readySelector:".buzz-source-state"}),d=r.document;
  ok("renders without console errors",r.errors.length===0,r.errors[0]);
  ok("collector health is visible",!!d.querySelector(".buzz-source-state"));
  ok("relative-index base is visible",Array.from(d.querySelectorAll(".buzz-item__base")).every(n=>n.textContent.includes("相対値")));
  r.release();}

await dashboard();await economy();await archive();await buzz();
console.log(`\n${checks} checks, ${failures} failure(s)`);process.exit(failures?1:0);
