# Gemini Canvas Saver

Gemini Workspace の Canvas コンテンツをPNG画像として保存するChrome拡張機能です。

## 特徴

- **全コンテンツキャプチャ**: ビューポート外のスクロール領域も含めて全体をキャプチャ
- **自動保存**: ダイアログなしで自動的にダウンロードフォルダに保存
- **ファイル名**: `gemini_canvas_YYYY-MM-DD_HH-MM-SS.png` 形式で自動命名

## インストール方法

1. このリポジトリをダウンロードまたはクローン
2. Chromeで `chrome://extensions` を開く
3. 右上の「デベロッパーモード」を有効化
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. `canvas_save` フォルダを選択

## 使い方

1. [Gemini](https://gemini.google.com) を開く
2. Canvasでコンテンツを生成（コード、図、ドキュメントなど）
3. 拡張機能アイコンをクリック
4. 「Canvas を保存」ボタンをクリック
5. PNG画像が自動的にダウンロードされる

## 技術的な仕組み

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│  Gemini Page (gemini.google.com)                            │
│                                                             │
│  ┌─────────────┐    ┌─────────────────────────────────┐    │
│  │ content.js  │    │  Canvas iframe                   │    │
│  │             │    │  (scf.usercontent.goog)          │    │
│  │ iframe検出  │    │                                  │    │
│  └─────────────┘    │  ┌─────────────────────────┐    │    │
│                      │  │ 注入されたスクリプト     │    │    │
│                      │  │ - html2canvas実行       │    │    │
│                      │  │ - DOM全体をキャプチャ   │    │    │
│                      │  └─────────────────────────┘    │    │
│                      └─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         ▲                           │
         │                           │ dataURL
         │                           ▼
┌────────┴────────┐         ┌─────────────────┐
│    popup.js     │────────▶│ service-worker  │
│  ユーザーUI     │         │  ダウンロード    │
└─────────────────┘         └─────────────────┘
```

### 処理フロー

1. **ユーザーがボタンをクリック** (`popup.js`)
2. **スクリプト注入** (`chrome.scripting.executeScript`)
   - `allFrames: true` で全フレームにスクリプトを注入
   - 各フレームでURLをチェックし、Canvas iframe のみで処理を実行
3. **html2canvas によるキャプチャ** (iframe内)
   - CDNから html2canvas ライブラリを動的ロード
   - `document.documentElement` 全体をキャンバスに描画
   - スクロール領域を含む全コンテンツをキャプチャ
4. **データURL生成**
   - Canvas を PNG形式の dataURL に変換
5. **ダウンロード** (`service-worker.js`)
   - `chrome.downloads.download` API で自動保存

### なぜこの方式か

Gemini の Canvas は `scf.usercontent.goog` ドメインの iframe 内にレンダリングされます。このクロスオリジン iframe にアクセスするため、以下の技術を組み合わせています：

- **Manifest V3 の `scripting` API**: iframe内に動的にスクリプトを注入
- **html2canvas**: DOM要素を Canvas に描画するライブラリ。スクロール領域外も含めて全体をレンダリング可能
- **host_permissions**: `*.scf.usercontent.goog` への権限を付与し、iframe内でのスクリプト実行を許可

### ファイル構成

```
canvas_save/
├── manifest.json          # 拡張機能設定 (Manifest V3)
├── icons/                 # アイコン画像
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── popup/                 # ポップアップUI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js          # メイン処理（スクリプト注入・結果処理）
├── content/
│   └── content.js        # 親ページ用コンテンツスクリプト
├── background/
│   └── service-worker.js # ダウンロード処理
└── lib/
    └── html2canvas.min.js # DOM→Canvas変換ライブラリ
```

## 必要な権限

| 権限 | 用途 |
|------|------|
| `activeTab` | 現在のタブでスクリプト実行 |
| `scripting` | iframe内へのスクリプト注入 |
| `downloads` | 画像ファイルの自動保存 |
| `webNavigation` | フレーム情報の取得 |
| `host_permissions` | gemini.google.com および scf.usercontent.goog へのアクセス |

## 制限事項

- Gemini (gemini.google.com) でのみ動作
- Canvas が表示されている状態でのみキャプチャ可能
- 外部画像（CORSで制限されているもの）は正しくキャプチャできない場合がある

## ライセンス

MIT License
