const DISPLAY_REPLACEMENTS = new Map([
  ["MONTHLY+QUARTERLY+ANNUAL", "月次・四半期・年次"],
  ["MONTHLY", "月次"],
  ["QUARTERLY", "四半期"],
  ["ANNUAL", "年次"],
  ["WEEKLY", "週次"],
  ["DAILY", "日次"],
  ["JPY_trillion", "兆円"],
  ["pct", "%"],
  ["JPY/EUR", "円/ユーロ"],
  ["JPY/USD", "円/ドル"],
  ["JPY", "円"],
  ["index", "指数"],
  ["Drugstore", "ドラッグストア"],
  ["YoY", "前年比"],
  ["MoM", "前月比"],
  ["QoQ", "前期比"]
]);

function localizeTextNode(node) {
  let text = node.nodeValue;
  for (const [from, to] of DISPLAY_REPLACEMENTS) {
    text = text.replaceAll(from, to);
  }
  if (text !== node.nodeValue) node.nodeValue = text;
}

export function localizeEconomyDisplay() {
  const host = document.getElementById("flow-datasets") || document.getElementById("main");
  if (!host) return;
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(localizeTextNode);
}
