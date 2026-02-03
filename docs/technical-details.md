# 技術解説: Gemini Canvas Saver の仕組み

この拡張機能で使用している2つの主要技術について解説します。

1. **iframeへのスクリプト注入** - クロスオリジンiframe内でコードを実行する方法
2. **html2canvasによるDOM描画** - ページ全体を画像に変換する仕組み

---

## 1. iframeへのスクリプト注入

### 問題: クロスオリジンの壁

Geminiの画面構造は以下のようになっています。

```
gemini.google.com (親ページ)
└── <iframe src="https://xxx.scf.usercontent.goog/...">
        └── Canvasのコンテンツ (HTML/CSS/JS)
```

通常のJavaScriptでは、親ページから**異なるドメイン**のiframe内にはアクセスできません。これは「同一オリジンポリシー」というセキュリティ制限です。

```javascript
// 親ページから実行 → エラーになる
const iframe = document.querySelector('iframe');
iframe.contentDocument;  // SecurityError: Blocked a frame with origin...
```

### 解決策: Chrome拡張機能の特権

Chrome拡張機能は `manifest.json` の `host_permissions` で許可されたドメインに対して特別な権限を持ちます。

```json
// manifest.json
{
  "host_permissions": [
    "https://gemini.google.com/*",
    "https://*.scf.usercontent.goog/*"  // iframe のドメインも許可
  ]
}
```

この設定により、両方のドメインでスクリプトを実行する権限が付与されます。

### chrome.scripting.executeScript API

この API を使うと、許可されたドメインのページやiframe内で任意のJavaScriptを実行できます。

```javascript
// popup.js から実行
await chrome.scripting.executeScript({
  target: {
    tabId: tab.id,
    allFrames: true  // 親ページだけでなく全てのiframeでも実行
  },
  func: myFunction,  // この関数がiframe内で実行される
  world: 'MAIN'      // ページのコンテキストで実行（DOMにアクセス可能）
});
```

### 実行フロー

```
┌─ popup.js ─────────────────────────────────┐
│                                            │
│  executeScript({ func: captureInIframe })  │
│         │                                  │
└─────────┼──────────────────────────────────┘
          │
          │ 関数をシリアライズして各フレームに送信
          ▼
┌─ gemini.google.com ────────────────────────┐
│  captureInIframe() 実行                    │
│  → URL確認 → "gemini.google.com" → skip    │
│                                            │
│  ┌─ iframe (scf.usercontent.goog) ───────┐ │
│  │  captureInIframe() 実行               │ │
│  │  → URL確認 → "scf.usercontent.goog"   │ │
│  │  → キャプチャ処理を実行！             │ │
│  └───────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

### 実際のコード

```javascript
// popup.js
function captureInIframe() {
  const currentUrl = window.location.href;

  // このフレームがCanvas iframeかどうかチェック
  if (!currentUrl.includes('scf.usercontent.goog')) {
    return { skip: true };  // 違うフレームはスキップ
  }

  // ここからはiframe内で実行される
  // html2canvasでキャプチャ...
}
```

`allFrames: true` を指定しているため、この関数は親ページと全てのiframeで実行されます。各フレームでURLをチェックし、目的のiframeでのみ実際の処理を行います。

---

## 2. html2canvasによるDOM描画

### html2canvas とは

html2canvas は、DOM要素を読み取って `<canvas>` に描画するJavaScriptライブラリです。

**重要な特徴**: スクリーンショットではなく、DOMを解析して再描画します。

| 方式 | 仕組み | キャプチャ範囲 |
|------|--------|----------------|
| `chrome.tabs.captureVisibleTab` | 画面のピクセルをキャプチャ | ビューポート（見えている部分）のみ |
| **html2canvas** | DOMを解析してCanvasに再描画 | スクロール領域を含む全体 |

### DOM → Canvas の変換プロセス

```
┌─ HTML文書 ─────────────────────────────┐
│  <html>                                │
│    <body>                              │
│      <div style="color: red">Hello</div>
│      <img src="...">                   │
│      ...                               │
│    </body>                             │
│  </html>                               │
│                                        │
│  scrollHeight: 3000px (実際の高さ)     │
│  clientHeight: 800px (表示領域)        │
└────────────────────────────────────────┘
          │
          │ html2canvas が解析
          ▼
┌─ 処理内容 ─────────────────────────────┐
│ 1. DOM ツリーを走査                    │
│ 2. 各要素のスタイル(CSS)を計算         │
│ 3. 位置・サイズ・色・フォントを取得    │
│ 4. Canvas API で描画                   │
│    - ctx.fillRect() で背景            │
│    - ctx.fillText() でテキスト        │
│    - ctx.drawImage() で画像           │
└────────────────────────────────────────┘
          │
          ▼
┌─ Canvas (3000px の高さ) ───────────────┐
│  ┌─────────────────────┐               │
│  │ Hello (赤色)        │               │
│  │ [画像]              │               │
│  │ ...                 │               │
│  │                     │               │
│  │ (スクロール領域も   │               │
│  │  全て含まれる)      │               │
│  │                     │               │
│  └─────────────────────┘               │
└────────────────────────────────────────┘
```

### document.documentElement とは

```javascript
document.documentElement  // <html> 要素 - ページ全体
document.body             // <body> 要素 - bodyの中身のみ
```

`document.documentElement` を指定することで、ページ全体（`<html>`タグ以下すべて）をキャプチャ対象にしています。

### scrollHeight を使う理由

```
┌─ ブラウザウィンドウ ─────────┐
│  ┌─ ビューポート ─────────┐ │
│  │                        │ │ ← clientHeight (見えている部分)
│  │   表示されている       │ │    例: 800px
│  │   コンテンツ           │ │
│  │                        │ │
│  └────────────────────────┘ │
│  ┌────────────────────────┐ │
│  │                        │ │
│  │   スクロールしないと   │ │ ← この部分も含めたのが
│  │   見えない部分         │ │    scrollHeight
│  │                        │ │    例: 3000px
│  │                        │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

`scrollHeight` を使うことで、スクロールしないと見えない部分も含めた**全体**をキャプチャできます。

### 実際のコード

```javascript
// ドキュメント全体のサイズを取得
const docElement = document.documentElement;
const body = document.body;

// スクロール可能な領域を含む実際のサイズ
const fullWidth = Math.max(
  docElement.scrollWidth,   // スクロール含む幅
  docElement.offsetWidth,   // 要素の幅
  docElement.clientWidth,   // 表示領域の幅
  body.scrollWidth,
  body.offsetWidth
);

const fullHeight = Math.max(
  docElement.scrollHeight,  // スクロール含む高さ (例: 3000px)
  docElement.offsetHeight,
  docElement.clientHeight,  // 表示領域の高さ (例: 800px)
  body.scrollHeight,
  body.offsetHeight
);

// html2canvas でキャプチャ
const canvas = await html2canvas(docElement, {
  windowWidth: fullWidth,   // キャプチャする幅
  windowHeight: fullHeight, // キャプチャする高さ（全体）
  width: fullWidth,
  height: fullHeight,
  scrollX: 0,               // スクロール位置をリセット
  scrollY: 0,
});

// Canvas → PNG画像のデータURL
const dataUrl = canvas.toDataURL('image/png');
// → "data:image/png;base64,iVBORw0KGgo..."
```

### Canvas はユーザーには見えない

html2canvasの処理はバックグラウンドで行われ、ユーザーの画面には何も表示されません。

```
┌─ ユーザーに見えている画面 ──────────────┐
│                                        │
│   Gemini Canvas の内容                 │
│   (通常通り表示されている、変化なし)    │
│                                        │
└────────────────────────────────────────┘

┌─ 裏側で起きていること ─────────────────┐
│                                        │
│  1. 一時的な <canvas> 要素を作成       │
│     (DOMに追加しない = 画面に表示されない)
│                                        │
│  2. Canvas の 2D Context を取得        │
│     const ctx = canvas.getContext('2d')│
│                                        │
│  3. DOM を走査して描画命令を実行       │
│     ctx.fillRect(...)  // 背景         │
│     ctx.fillText(...)  // テキスト     │
│     ctx.drawImage(...) // 画像         │
│                                        │
│  4. データURLに変換                    │
│     canvas.toDataURL('image/png')      │
│                                        │
│  5. 一時的な要素を破棄                 │
│     (removeContainer: true)            │
│                                        │
└────────────────────────────────────────┘
```

#### コードで見る内部動作（イメージ）

```javascript
// html2canvas 内部の動作（簡略化）

// 1. 一時的なCanvasを作成（画面には表示されない）
const canvas = document.createElement('canvas');
canvas.width = fullWidth;
canvas.height = fullHeight;
// ※ document.body.appendChild() しないので見えない

// 2. 描画コンテキストを取得
const ctx = canvas.getContext('2d');

// 3. DOMを解析して描画（ユーザーには見えない）
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, width, height);  // 背景

ctx.fillStyle = 'red';
ctx.font = '16px Arial';
ctx.fillText('Hello', 10, 20);  // テキスト

// 4. メモリ上のCanvasからデータを取り出す
const dataUrl = canvas.toDataURL('image/png');
// → "data:image/png;base64,iVBORw0KGgo..."

// 5. Canvasは参照がなくなればガベージコレクションで自動破棄
```

#### 処理中の状態まとめ

| 項目 | 状態 |
|------|------|
| 元のページ | 変更なし、そのまま表示 |
| 一時Canvas | メモリ上にのみ存在、DOMに追加されない |
| 描画処理 | バックグラウンドで実行 |
| 処理後 | 一時Canvasは自動的に破棄 |

ユーザーから見ると、ボタンを押したら画像がダウンロードされるだけで、画面上では何も起きていないように見えます。

---

## 技術まとめ

| 技術 | 役割 |
|------|------|
| `chrome.scripting.executeScript` | 通常アクセスできないクロスオリジンiframe内でコードを実行 |
| `allFrames: true` | 親ページだけでなく全てのiframeでスクリプトを実行 |
| `world: 'MAIN'` | ページのコンテキストで実行し、DOMに直接アクセス |
| `html2canvas` | DOMを解析してCanvasに再描画（スクリーンショットではない） |
| `scrollWidth/scrollHeight` | 表示領域外も含めた全体のサイズを取得 |
| `canvas.toDataURL()` | Canvasの内容をBase64エンコードされた画像データに変換 |
