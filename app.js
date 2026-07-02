const codeInput = document.querySelector('#codeInput');
const resetBtn = document.querySelector('#resetBtn');
const openPreviewBtn = document.querySelector('#openPreviewBtn');
const refreshPreviewBtn = document.querySelector('#refreshPreviewBtn');
const previewStatus = document.querySelector('#previewStatus');
const lineNumbers = document.querySelector('#lineNumbers');
const currentLineHighlight = document.querySelector('#currentLineHighlight');

const INDENT = '  ';
const PREVIEW_WINDOW_NAME = 'html-live-preview-window';

const defaultSource = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>欢迎体验</title>
    <style>
      body {
        margin: 0;
        font-family: Georgia, serif;
        color: #1f2933;
        background: linear-gradient(135deg, #fff8ee, #f4e1c1);
      }

      .hero {
        max-width: 780px;
        margin: 48px auto;
        padding: 32px;
        background: rgba(255, 255, 255, 0.88);
        border-radius: 24px;
        box-shadow: 0 20px 40px rgba(31, 41, 51, 0.12);
      }

      h1 {
        margin-top: 0;
        font-size: 3rem;
      }

      p {
        line-height: 1.7;
      }

      .tag {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 999px;
        background: #0d5c63;
        color: white;
        font-size: 0.9rem;
      }
    </style>
  </head>
  <body>
    <section class="hero">
      <span class="tag">点击“打开预览窗口”查看大画布效果</span>
      <h1>全宽编辑区 + 独立预览窗口</h1>
      <p>现在你可以只在一个大编辑区里写完整 HTML。</p>
      <p>预览会在新窗口打开，窗口保持打开时，左侧输入会持续同步过去。</p>
    </section>
  </body>
</html>`;

let syncTimer = 0;
let previewWindow = null;

function setStatus(message) {
  previewStatus.textContent = message;
}

function updateLineNumbers() {
  const lineCount = codeInput.value.split('\n').length;
  lineNumbers.textContent = Array.from({ length: lineCount }, (_, index) => String(index + 1)).join('\n');
}

function syncLineNumberScroll() {
  lineNumbers.scrollTop = codeInput.scrollTop;
}

function updateCurrentLineHighlight() {
  const valueBeforeCursor = codeInput.value.slice(0, codeInput.selectionStart);
  const currentLineIndex = valueBeforeCursor.split('\n').length - 1;
  const styles = window.getComputedStyle(codeInput);
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const lineHeight = Number.parseFloat(styles.lineHeight) || 25.8;
  const offsetTop = paddingTop + currentLineIndex * lineHeight - codeInput.scrollTop;

  currentLineHighlight.style.height = `${lineHeight}px`;
  currentLineHighlight.style.transform = `translateY(${offsetTop}px)`;
}

function hasHtmlShell(source) {
  return /<html[\s>]/i.test(source) || /<!doctype/i.test(source);
}

function buildPreviewDocument(source) {
  const trimmed = source.trim();

  if (!trimmed) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>空白预览</title>
  </head>
  <body></body>
</html>`;
  }

  if (hasHtmlShell(trimmed)) {
    return trimmed;
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>HTML Fragment Preview</title>
  </head>
  <body>
${trimmed}
  </body>
</html>`;
}

function syncPreviewWindow() {
  if (!previewWindow || previewWindow.closed) {
    setStatus('预览未打开');
    return;
  }

  const nextDocument = buildPreviewDocument(codeInput.value);
  previewWindow.document.open();
  previewWindow.document.write(nextDocument);
  previewWindow.document.close();
  setStatus('预览同步中');
}

function schedulePreviewRefresh() {
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncPreviewWindow();
  }, 120);
}

function refreshPreview() {
  syncPreviewWindow();
}

function setSelection(start, end = start) {
  codeInput.focus();
  codeInput.setSelectionRange(start, end);
  updateCurrentLineHighlight();
}

function indentSelectedLines() {
  const value = codeInput.value;
  const start = codeInput.selectionStart;
  const end = codeInput.selectionEnd;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const selection = value.slice(lineStart, end);
  const lines = selection.split('\n');
  const indented = lines.map((line) => `${INDENT}${line}`).join('\n');

  codeInput.value = value.slice(0, lineStart) + indented + value.slice(end);
  setSelection(lineStart + INDENT.length, lineStart + indented.length);
  updateLineNumbers();
  schedulePreviewRefresh();
}

function unindentSelectedLines() {
  const value = codeInput.value;
  const start = codeInput.selectionStart;
  const end = codeInput.selectionEnd;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const selection = value.slice(lineStart, end);
  const lines = selection.split('\n');

  let removedBeforeStart = 0;
  let removedTotal = 0;

  const unindented = lines
    .map((line, index) => {
      if (line.startsWith(INDENT)) {
        removedTotal += INDENT.length;
        if (index === 0 && start > lineStart) {
          removedBeforeStart = Math.min(INDENT.length, start - lineStart);
        }
        return line.slice(INDENT.length);
      }

      if (line.startsWith('\t')) {
        removedTotal += 1;
        if (index === 0 && start > lineStart) {
          removedBeforeStart = Math.min(1, start - lineStart);
        }
        return line.slice(1);
      }

      return line;
    })
    .join('\n');

  codeInput.value = value.slice(0, lineStart) + unindented + value.slice(end);
  setSelection(start - removedBeforeStart, end - removedTotal);
  updateLineNumbers();
  schedulePreviewRefresh();
}

function insertIndent() {
  const start = codeInput.selectionStart;
  const end = codeInput.selectionEnd;
  const value = codeInput.value;

  codeInput.value = value.slice(0, start) + INDENT + value.slice(end);
  setSelection(start + INDENT.length);
  updateLineNumbers();
  schedulePreviewRefresh();
}

function preserveCurrentIndent() {
  const value = codeInput.value;
  const start = codeInput.selectionStart;
  const end = codeInput.selectionEnd;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const currentLine = value.slice(lineStart, start);
  const indentMatch = currentLine.match(/^[\t ]*/);
  const currentIndent = indentMatch ? indentMatch[0] : '';
  const insertion = `\n${currentIndent}`;

  codeInput.value = value.slice(0, start) + insertion + value.slice(end);
  setSelection(start + insertion.length);
  updateLineNumbers();
  schedulePreviewRefresh();
}

function handleEditorShortcuts(event) {
  if (event.key === 'Tab') {
    event.preventDefault();

    if (
      codeInput.selectionStart !== codeInput.selectionEnd ||
      codeInput.value.slice(codeInput.selectionStart - 1, codeInput.selectionStart) === '\n'
    ) {
      if (event.shiftKey) {
        unindentSelectedLines();
      } else {
        indentSelectedLines();
      }
      return;
    }

    if (event.shiftKey) {
      unindentSelectedLines();
      return;
    }

    insertIndent();
    return;
  }

  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey
  ) {
    event.preventDefault();
    preserveCurrentIndent();
  }
}

function openPreviewWindow() {
  previewWindow = window.open('', PREVIEW_WINDOW_NAME);

  if (!previewWindow) {
    setStatus('浏览器拦截了预览窗口');
    return;
  }

  syncPreviewWindow();
  previewWindow.focus();
}

codeInput.addEventListener('input', schedulePreviewRefresh);
codeInput.addEventListener('input', updateLineNumbers);
codeInput.addEventListener('input', updateCurrentLineHighlight);
codeInput.addEventListener('keydown', handleEditorShortcuts);
codeInput.addEventListener('click', updateCurrentLineHighlight);
codeInput.addEventListener('focus', updateCurrentLineHighlight);
codeInput.addEventListener('keyup', updateCurrentLineHighlight);
codeInput.addEventListener('scroll', () => {
  syncLineNumberScroll();
  updateCurrentLineHighlight();
});
openPreviewBtn.addEventListener('click', openPreviewWindow);
refreshPreviewBtn.addEventListener('click', refreshPreview);

resetBtn.addEventListener('click', () => {
  codeInput.value = defaultSource;
  updateLineNumbers();
  syncLineNumberScroll();
  updateCurrentLineHighlight();
  schedulePreviewRefresh();
});

window.addEventListener('beforeunload', () => {
  if (previewWindow && !previewWindow.closed) {
    previewWindow.close();
  }
});

window.addEventListener('focus', () => {
  if (previewWindow && previewWindow.closed) {
    previewWindow = null;
    setStatus('预览未打开');
  }
});

codeInput.value = defaultSource;
updateLineNumbers();
updateCurrentLineHighlight();
setStatus('预览未打开');
