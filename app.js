const codeInput = document.querySelector('#codeInput');
const previewFrame = document.querySelector('#previewFrame');
const resetBtn = document.querySelector('#resetBtn');

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
        max-width: 720px;
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
      <span class="tag">试试直接点右边文字修改</span>
      <h1>双向同步的 HTML 编辑器</h1>
      <p>左侧修改源码，右侧会实时刷新。</p>
      <p>右侧直接编辑文本、粘贴内容或删除元素后，左侧源码也会自动同步。</p>
    </section>
  </body>
</html>`;

function createBridgeScript(mode) {
  return `
<script>
(() => {
  const BRIDGE_FLAG = 'data-live-editor-bridge';
  const mode = ${JSON.stringify(mode)};
  const serialize = () => {
    const doc = document.cloneNode(true);
    const injected = doc.querySelector('script[' + BRIDGE_FLAG + ']');
    if (injected) {
      injected.remove();
    }
    if (doc.body) {
      doc.body.removeAttribute('contenteditable');
      doc.body.removeAttribute('spellcheck');
    }
    if (mode === 'fragment') {
      return doc.body ? doc.body.innerHTML.trim() : '';
    }

    const doctype = document.doctype
      ? '<!DOCTYPE ' + document.doctype.name + '>'
      : '';
    return doctype + '\\n' + doc.documentElement.outerHTML;
  };

  const postUpdate = () => {
    parent.postMessage({ type: 'preview:update', source: serialize() }, '*');
  };

  const ensureEditable = () => {
    if (!document.body) {
      return;
    }
    document.body.setAttribute('contenteditable', 'true');
    document.body.setAttribute('spellcheck', 'false');
  };

  let timer = 0;
  const queueUpdate = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(postUpdate, 80);
  };

  window.addEventListener('DOMContentLoaded', () => {
    ensureEditable();

    document.addEventListener('input', queueUpdate);
    document.addEventListener('paste', queueUpdate);
    document.addEventListener('cut', queueUpdate);
    document.addEventListener('drop', queueUpdate);
    document.addEventListener('blur', queueUpdate, true);
    document.addEventListener('keyup', (event) => {
      if (event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Enter') {
        queueUpdate();
      }
    });
  });
})();
</script>`;
}

let syncTimer = 0;

function normalizeSource(source) {
  return source.replace(/\r\n/g, '\n').trim();
}

function hasHtmlShell(source) {
  return /<html[\s>]/i.test(source) || /<!doctype/i.test(source);
}

function buildPreviewDocument(source) {
  const trimmed = source.trim();
  const mode = hasHtmlShell(trimmed) ? 'document' : 'fragment';
  const bridgeScript = createBridgeScript(mode);

  if (!trimmed) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>空白预览</title>
  </head>
  <body>
    ${bridgeScript}
  </body>
</html>`;
  }

  if (mode === 'document') {
    if (/<\/body>/i.test(trimmed)) {
      return trimmed.replace(/<\/body>/i, `${bridgeScript}\n</body>`);
    }
    if (/<\/html>/i.test(trimmed)) {
      return trimmed.replace(/<\/html>/i, `<body>${bridgeScript}</body>\n</html>`);
    }
    return `${trimmed}\n${bridgeScript}`;
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>HTML Fragment Preview</title>
  </head>
  <body>
${trimmed}
${bridgeScript}
  </body>
</html>`;
}

function renderPreview(source) {
  previewFrame.srcdoc = buildPreviewDocument(source);
}

function schedulePreviewRefresh() {
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    renderPreview(codeInput.value);
  }, 120);
}

codeInput.addEventListener('input', () => {
  schedulePreviewRefresh();
});

window.addEventListener('message', (event) => {
  if (event.source !== previewFrame.contentWindow) {
    return;
  }

  if (event.data?.type !== 'preview:update') {
    return;
  }

  const next = normalizeSource(event.data.source || '');
  const current = normalizeSource(codeInput.value);

  if (next === current) {
    return;
  }

  codeInput.value = event.data.source;
});

resetBtn.addEventListener('click', () => {
  codeInput.value = defaultSource;
  renderPreview(defaultSource);
});

codeInput.value = defaultSource;
renderPreview(defaultSource);
