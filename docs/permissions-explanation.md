# 権限とホストパーミッション

本拡張機能（Gemini Canvas Saver）がリクエストする権限およびホストパーミッションの理由をまとめています。

---

## 1. 権限（permissions）の理由

### activeTab

**用途：** ユーザーが拡張機能のボタン（アクション）をクリックした時点で、その時アクティブなタブへの一時的なアクセスを取得するため。

**使用箇所：** ポップアップから「Canvas を保存」を押した際、現在表示中のタブが Gemini のページかどうかを判定し、そのタブ内の iframe（Canvas 表示領域）に対してキャプチャ用スクリプトを実行するために必要です。ユーザーが明示的にボタンを押したときのみ有効になります。

---

### scripting

**用途：** 指定したタブ（およびそのタブ内の iframe）に、キャプチャ用の JavaScript をプログラムから注入・実行するため。

**使用箇所：** Gemini の Canvas コンテンツは `https://*.scf.usercontent.goog/*` の iframe 内に表示されます。この iframe は拡張の content_scripts の `matches` に含められないため、`chrome.scripting.executeScript` を用いて、ユーザーが保存ボタンを押したタイミングでのみ、iframe 内で html2canvas による画面キャプチャ処理を実行しています。スクリプトの注入・実行はユーザー操作に紐づいており、自動実行は行いません。

---

### downloads

**用途：** キャプチャ結果（PNG 画像の Data URL）を、ユーザーのダウンロードフォルダなどにファイルとして保存するため。

**使用箇所：** サービスワーカー内で `chrome.downloads.download()` を呼び出し、生成した PNG を `gemini_canvas_YYYY-MM-DD_HH-MM-SS.png` のようなファイル名で保存しています。画像データは外部サーバーへ送信せず、ローカル保存のみに使用しています。

---

### webNavigation

**用途：** 現在のタブの URL やナビゲーション状態を参照し、「Gemini のページかどうか」を判定するため（必要に応じて）。

**使用箇所：** ポップアップ表示時に `chrome.tabs.query({ active: true, currentWindow: true })` で取得したタブの `url` を用いて、`gemini.google.com` かどうかをチェックし、保存ボタンの有効/無効を切り替えています。`webNavigation` はタブの URL を確実に取得するための補助として宣言しています（ブラウザやバージョンによっては `activeTab` のみでも URL が得られる場合がありますが、審査用に明示的に記載しています）。

---

## 2. ホストパーミッション（host_permissions）の理由

本拡張は **Gemini の Canvas 機能で表示されるコンテンツを PNG 画像として保存する** ことに特化しています。そのため、アクセス先を次の 2 種類に限定しています。

### https://gemini.google.com/*

**理由：** Gemini の Web アプリ本体が提供されるドメインです。

**使用箇所：**

- コンテンツスクリプトの注入先として指定しています。Gemini のページ上で、Canvas を表示している iframe を検出し、拡張とのメッセージのやり取りを行うために必要です。
- ポップアップから「現在のタブが Gemini かどうか」を判定する際の URL チェック対象です。

Canvas の保存機能は Gemini 利用時のみ意味があるため、このドメインに限定しています。

---

### https://*.scf.usercontent.goog/*

**理由：** Gemini の Canvas でレンダリングされるコンテンツが表示される iframe のドメインです（Google が提供するユーザーコンテンツ用のホスティング）。

**使用箇所：**

- Canvas の実体はこの iframe 内に表示されるため、ここに対して `chrome.scripting.executeScript` でキャプチャ用スクリプトを実行するために、このホストへのアクセス権限が必要です。
- `web_accessible_resources` で公開している `lib/html2canvas.min.js` を、この iframe 内のページから読み込めるようにするための `matches` も、このホストに合わせています。

`<all_urls>` や `*://*/*` のような広いパーミッションは使用しておらず、Gemini Canvas のキャプチャに必要な範囲に絞っています。

---

## 3. まとめ

| 権限 / ホスト | 役割 |
|---------------|------|
| **activeTab** | ユーザーがボタンを押したとき、そのタブに一時アクセスするため |
| **scripting** | Canvas が表示される iframe 内でキャプチャ用スクリプトを実行するため |
| **downloads** | キャプチャした PNG をローカルに保存するため |
| **webNavigation** | 現在のタブが Gemini かどうかを判定するため |
| **gemini.google.com** | Gemini 本体のページで iframe 検出・連携を行うため |
| **scf.usercontent.goog** | Canvas が表示される iframe に対してキャプチャを実行するため |

いずれも「Gemini Canvas を PNG として保存する」という単一の目的に必要な最小限の範囲でリクエストしています。
