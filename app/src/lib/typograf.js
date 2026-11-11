// Типографика интерфейса: короткие слова (до трёх букв) не остаются висеть в конце строки,
// тире не уезжает в начало следующей. Работает по всему окну, поля ввода и код не трогает.
const NBSP = ' ';
const SKIP = 'textarea, input, code, pre, kbd, script, style, [contenteditable="true"], [data-no-typograf]';
const SHORT = new RegExp(`(?<=^|[\\s${NBSP}(«„"'])([A-Za-zА-Яа-яЁё]{1,3})[ ]+(?=\\S)`, 'g');
const DASH = / +(?=[—–](?:\s|$))/g;
const ABBR = /(?<=(?:^|[\s(])(?:с|стр|гл|рис|табл|т|п|№)\.?) +(?=\d)/g; // «с. 12», «гл. 3», «№ 5»

export function typograf(text) {
  if (!text || text.length < 3 || !/[ ]/.test(text)) return text;
  return text.replace(SHORT, `$1${NBSP}`).replace(DASH, NBSP).replace(ABBR, NBSP);
}

function fix(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) return;
  const next = typograf(node.data);
  if (next !== node.data) node.data = next;
}

function walk(root) {
  if (root.nodeType === Node.TEXT_NODE) return fix(root);
  if (root.nodeType !== Node.ELEMENT_NODE || root.matches?.(SKIP)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) fix(n);
}

export function startTypograf(root = document.body) {
  walk(root);
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') fix(m.target);
      else m.addedNodes.forEach(walk);
    }
  });
  mo.observe(root, { childList: true, subtree: true, characterData: true });
  return () => mo.disconnect();
}
