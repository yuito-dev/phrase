# phrase 学習ノート

phraseプロジェクトを通じて学んだことを整理したメモ。
Claude Codeに書かせたコードを「自分で説明できる」レベルまで理解するための復習用。

---

## 目次

1. [プロジェクト全体の構造](#1-プロジェクト全体の構造)
2. [server.js 解説](#2-serverjs-解説)
3. [index.html JavaScript部分の解説](#3-indexhtml-javascript部分の解説)
4. [index.html HTML部分の解説](#4-indexhtml-html部分の解説)
5. [重要な概念まとめ](#5-重要な概念まとめ)
6. [理解度チェック（自分用クイズ）](#6-理解度チェック自分用クイズ)
7. [今後追加予定](#7-今後追加予定)

---

## 1. プロジェクト全体の構造

### 3つの登場人物

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  ブラウザ    │ ←───→  │  サーバー     │ ←───→  │  Anthropic  │
│ (index.html)│         │ (server.js)  │         │   Claude    │
│             │         │              │         │     API     │
└─────────────┘         └──────────────┘         └─────────────┘
   ゆいとのPC内            ゆいとのPC内              ネット上
```

### なぜブラウザから直接APIを叩かないのか

**APIキーが流出するから**。

ブラウザに直接APIキーを書くと、誰でも開発者ツールで見られる。
他人にコピーされて、自分のクレジットを使われ放題になる。

だからサーバーが「キーを持つ秘書」として間に入る。

### 英訳ボタン押した時の流れ

```
1. ゆいとが日本語を入力 → 英訳ボタン
2. ブラウザのJSが、サーバーにPOST送信（http://localhost:3000/api/translate）
3. server.jsが受け取り、APIキーを使ってAnthropic Claude APIに転送
4. ClaudeのAIが英訳して返す
5. server.jsがブラウザに結果を返す
6. ブラウザのJSが画面に表示
```

### ファイルの役割

| ファイル | 役割 | 例えるなら |
|---|---|---|
| **index.html** | お客さんが見る画面 | レストランの店頭・メニュー |
| **server.js** | 注文処理・外部発注 | レストランの厨房 |
| **.env** | APIキー保管 | 金庫の鍵 |
| **package.json** | 必要な道具一覧 | 食材リスト |
| **node_modules/** | 実際の道具一式 | 食材庫 |
| **.gitignore** | 持ち出し禁止リスト | GitHubに上げないもの |

### 言語の使い分け

index.html 1ファイルの中に3つの言語が入ってる：

| 言語 | 役割 | 例 |
|---|---|---|
| **HTML** | 画面の骨組み・構造 | 「ここに入力欄、ここにボタン」 |
| **CSS** | 画面の見た目・装飾 | 「色は金色、ボタンは丸く」 |
| **JavaScript** | 画面の動き・処理 | 「ボタン押したらAPIに送信」 |

```html
<html>
  <head>
    <style>
      ← ここがCSS（見た目）
    </style>
  </head>
  <body>
    ← ここがHTML（骨組み）
    
    <script>
      ← ここがJavaScript（動き）
    </script>
  </body>
</html>
```

---

## 2. server.js 解説

### ブロック1：道具の読み込み（1〜5行目）

```javascript
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');
const cors = require('cors');
const path = require('path');
```

#### `require('dotenv').config();`
- `.env` ファイルを読み込む
- `process.env.XXX` で値を使えるようにする
- **APIキー読み込みの準備**
- これがないとキー読めない

#### `const Anthropic = require('@anthropic-ai/sdk');`
- Anthropic公式SDKを読み込む
- `Anthropic` という名前でClaude APIを呼べるようになる

#### `const express = require('express');`
- Webサーバーを作る道具
- Node.js単体だと数十行かかるサーバー作成が、数行で済む

#### `const cors = require('cors');`
- CORS（違うアドレス間の通信を許可する）を設定する道具
- ブラウザはセキュリティのため、デフォルトで違うアドレス間通信をブロック

#### `const path = require('path');`
- ファイルパスを扱う道具（Node.js標準装備）
- `path.join()` でWindowsとLinuxの違いを吸収

#### キーワード解説

**`require()`** = 他のファイル/ライブラリを読み込んで使えるようにする命令

**`const`** = 変えられない箱（一度値を入れたら変更不可）

```javascript
const x = 10;
x = 20;  // ❌ エラー

let y = 10;
y = 20;  // ✅ OK（letは変えられる）
```

---

### ブロック2：サーバー初期設定（7〜12行目）

```javascript
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
```

#### `const app = express();`
- Expressのアプリ本体（サーバーの中身）を作る
- これから `app.use(...)` や `app.post(...)` でカスタマイズ

#### `const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });`
- Anthropic APIとの通信窓口を作る
- `.env` から読み込んだAPIキーをセット
- ⚠️ **エラー源**：`process.env.ANTHROPIC_API_KEY` が `undefined` だと認証失敗

#### `app.use(cors());`
- CORS有効化

#### `app.use(express.json());`
- JSON形式のデータを自動解析する設定
- これがないと `req.body` で中身取れない

#### `app.use(express.static(path.join(__dirname)));`
- カレントディレクトリのファイルをそのまま配信
- ブラウザで `localhost:3000` にアクセスすると `index.html` が自動表示

#### キーワード解説

**`__dirname`** = 今このファイルがあるフォルダのパス（Node.js標準の特殊変数）

**`app.use()`** = 全リクエストにこの処理を通す設定（**ミドルウェア**と呼ぶ）

```
リクエスト → cors() → express.json() → express.static() → エンドポイント
```

---

### ブロック3：翻訳エンドポイント【メイン】

```javascript
app.post('/api/translate', async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'テキストを入力してください。' });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: 'You are a Japanese-to-English translator. ...',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: text.trim(),
        },
      ],
    });

    const translation = response.content[0]?.text ?? '';
    res.json({ translation });
  } catch (error) {
    // エラーハンドリング
  }
});
```

#### `app.post('/api/translate', async (req, res) => {...})`

- **POSTメソッドのリクエストを受け取る**設定
- `req`: リクエスト（ブラウザからの注文）
- `res`: レスポンス（サーバーからの返答）
- `async`: 「この関数は時間がかかる処理が入る」と宣言

#### `const { text } = req.body;`

リクエスト本体から `text` を取り出す（**分割代入**）。

省略しない書き方:
```javascript
const text = req.body.text;
```

#### バリデーション（入力チェック）

```javascript
if (!text || typeof text !== 'string' || !text.trim()) {
  return res.status(400).json({ error: 'テキストを入力してください。' });
}
```

| 条件 | 意味 |
|---|---|
| `!text` | textが存在しない |
| `typeof text !== 'string'` | 文字列じゃない |
| `!text.trim()` | 空白だけの文字列 |

#### Claude API呼び出し

| パラメータ | 意味 |
|---|---|
| `model: 'claude-haiku-4-5-20251001'` | 使うAIモデル。Haikuは安い・速い |
| `max_tokens: 512` | 返答の最大長 |
| `system: [...]` | システムプロンプト（AIへの指示書） |
| `messages: [...]` | ユーザーの入力 |

#### システムプロンプトの中身

```
You are a Japanese-to-English translator. 
Translate the given Japanese text into natural, fluent English. 
Output only the English translation — no explanations, no quotation marks, no extra text.
```

これが**プロンプトエンジニアリング**。AIにどう動いてほしいか指示する技術。

#### 結果取り出し

```javascript
const translation = response.content[0]?.text ?? '';
res.json({ translation });
```

- **`?.`**（オプショナルチェイニング）：存在しなくてもエラーにならない
- **`?? ''`**（Null合体演算子）：左が `undefined`/`null` なら右を使う

#### catch ブロック（エラーハンドリング）

| エラー種別 | 原因 | ステータス |
|---|---|---|
| `AuthenticationError` | APIキー無効 | 500 |
| `RateLimitError` | リクエスト多すぎ | 429 |
| その他 | 通信失敗、不明エラー | 500 |

---

### ブロック4：サーバー起動

```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
```

- **`||`**：左が「なし」なら右を使う
- **`app.listen()`**：指定ポートでサーバー起動
- **テンプレートリテラル**（バッククォート）で変数を埋め込み

---

## 3. index.html JavaScript部分の解説

### 全体像

```
1. 関数 translateText() の定義
   ├─ 入力欄から日本語取得
   ├─ サーバーに送信（fetchでPOST）
   ├─ 結果を画面に表示
   └─ エラー時はエラーメッセージ表示

2. テキスト入力欄の自動リサイズ
3. Enterキーで送信できるショートカット
```

---

### ブロック1：translateText関数の前半（入力取得 & UI準備）

```javascript
async function translateText() {
  const input = document.getElementById('jpInput').value.trim();
  if (!input) return;

  const placeholder = document.getElementById('placeholder');
  const resultEn    = document.getElementById('resultEn');

  placeholder.textContent   = '翻訳中…';
  placeholder.style.display = 'block';
  resultEn.style.display    = 'none';
```

#### `const input = document.getElementById('jpInput').value.trim();`

3つの処理が連続：

```javascript
const element = document.getElementById('jpInput');  // 1. HTML要素取得
const value = element.value;                          // 2. 入力値取得
const input = value.trim();                           // 3. 前後の空白削除
```

#### UI状態の更新

| プロパティ | 意味 |
|---|---|
| `textContent` | 要素の中のテキストを変更 |
| `style.display = 'block'` | 表示する |
| `style.display = 'none'` | 非表示にする |

---

### ブロック2：translateText関数の中盤（API通信）

```javascript
try {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: input }),
  });

  const data = await res.json();
```

#### `fetch()` の引数

| 項目 | 意味 |
|---|---|
| `'/api/translate'` | 送信先（server.jsのエンドポイントと一致） |
| `method: 'POST'` | POSTメソッドで送る |
| `headers` | 「JSON形式」と宣言 |
| `body` | 送るデータ |

#### `JSON.stringify({ text: input })`

JavaScriptオブジェクト→JSON文字列に変換：

```javascript
{ text: "今日は疲れた" }
   ↓ JSON.stringify
'{"text":"今日は疲れた"}'
```

#### `const data = await res.json();`

サーバーからの返答を解析。`res.json()` でJSONをオブジェクトに変換。

---

### ブロック3：translateText関数の後半（結果表示）

```javascript
  if (!res.ok) {
    placeholder.textContent = data.error || '翻訳に失敗しました。';
    return;
  }

  placeholder.style.display = 'none';
  resultEn.style.display    = 'none';
  void resultEn.offsetWidth;
  resultEn.textContent      = `"${data.translation}"`;
  resultEn.style.display    = 'block';
} catch (_) {
  placeholder.textContent = 'ネットワークエラーが発生しました。';
}
```

#### `if (!res.ok)`

`res.ok`：HTTPステータスコードが200番台なら `true`、それ以外なら `false`。

| ステータス | `res.ok` |
|---|---|
| 200 OK | true |
| 400 Bad Request | false |
| 500 Internal Server Error | false |

#### `void resultEn.offsetWidth;` の謎

**CSSアニメーションを再実行するためのテクニック**。

`display: none` → `block` に戻すだけだとアニメーションが再生されない。
`void resultEn.offsetWidth;` で強制的にブラウザに「要素を再計算しろ」と命令することで、アニメーションがリセットされる。

#### `} catch (_) { ... }`

通信自体が失敗した場合（ネットワーク切断など）。
`(_)` の意味：エラーオブジェクトを受け取るけど使わないことを示す慣習。

---

### ブロック4：テキスト欄の自動リサイズ

```javascript
const ta = document.getElementById('jpInput');

ta.addEventListener('input', () => {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
});
```

#### 自動リサイズの仕組み

- **`ta.scrollHeight`**：内容を全部表示するのに必要な高さ
- **`Math.min(ta.scrollHeight, 100)`**：内容に合わせて伸びるけど最大100pxまで

LINE/Discordの入力欄式。

---

### ブロック5：Enterキーで送信

```javascript
ta.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    translateText();
  }
});
```

| 操作 | 動作 |
|---|---|
| Enter | **送信** |
| Shift + Enter | 改行 |

`e.preventDefault()`：ブラウザのデフォルト動作（改行）をキャンセル。

---

### サーバーとの連携整理

```
ブラウザ側（このJS）              サーバー側（server.js）
─────────────────              ─────────────────
fetch('/api/translate', ...)  →  app.post('/api/translate', ...)
body: { text: "今日は疲れた" }  →  req.body.text
                              ←  res.json({ translation: "..." })
data.translation              ←
```

両方が同じURL（`/api/translate`）で繋がってる。

---

## 4. index.html HTML部分の解説

### 全体構造（鳥の目）

```
<body>
  ├─ <header>           ← 上部のロゴ＋タグ
  │   ├─ ロゴ「phrase」
  │   └─ タグ「English Learning」
  │
  └─ <div class="main">
      ├─ <div class="chat-panel">    ← メッセージ表示エリア
      │   ├─ 日付表示「Today」
      │   ├─ メッセージ1（AI）
      │   ├─ メッセージ2（ユーザー）
      │   └─ メッセージ3（AI＋英訳）
      │
      └─ <div class="input-panel">   ← 入力エリア
          ├─ ラベル「今日の一言」
          ├─ 入力欄＋ボタン
          └─ 英訳結果表示
</body>
```

---

### ブロック1：header（上部のヘッダー）

```html
<header>
  <div class="logo">phr<span>a</span>se</div>
  <div class="header-tag">English Learning</div>
</header>
```

#### `<header>` タグ
- HTML5の**意味のあるタグ**（セマンティックタグ）
- 「これはヘッダー部分です」とブラウザや検索エンジンに伝える
- `<div>` でも見た目は同じだが、**意味が伝わらない**

#### `<div class="logo">phr<span>a</span>se</div>`

**`<div>`** = 汎用ブロック（特に意味はない、グループ化する箱）
**`class="logo"`** = CSSから「.logo」で指定するための名札

中身：
| 部分 | 意味 |
|---|---|
| `phr` | 普通の文字 |
| `<span>a</span>` | "a" だけ別タグで囲む |
| `se` | 普通の文字 |

**なぜ `a` だけ `<span>` で囲む？**

CSS で：
```css
.logo span { font-style: italic; }
```

→「ロゴの中の `<span>` だけ斜体にする」設定。
**`a` だけイタリック体**にしてオシャレ感を出すための仕掛け。

---

### ブロック2：チャットパネル（メッセージ表示エリア）

```html
<div class="chat-panel">
  <div class="chat-date">Today</div>

  <div class="message in">
    <div class="avatar">AI</div>
    <div class="bubble-col">
      <div class="bubble">今日の気持ちを、英語で伝えてみましょう。<br>どんな一日でしたか？</div>
      <div class="ts">09:12</div>
    </div>
  </div>

  <!-- 続く -->
</div>
```

#### メッセージ1個の構造

```html
<div class="message in">       ← クラス2つ：「message」と「in」
  <div class="avatar">AI</div>  ← アイコン
  <div class="bubble-col">      ← 吹き出しと時刻のグループ
    <div class="bubble">...</div>  ← 吹き出し本体
    <div class="ts">09:12</div>    ← タイムスタンプ
  </div>
</div>
```

#### `class="message in"` のクラス2つ持ち

**重要なテクニック**：1つの要素に**複数のクラス**を付けられる。

- `message` → 全メッセージ共通の見た目（吹き出しの基本構造）
- `in` または `out` → AI（受信）かユーザー（送信）かの区別

CSSで使い分け：
```css
.message      { display: flex; align-items: flex-end; }      /* 共通 */
.message.out  { flex-direction: row-reverse; }               /* outだけ反転 */
```

これが**LINEで自分のメッセージは右、相手は左**になる仕組み。

#### `<br>` タグ

```html
今日の気持ちを、英語で伝えてみましょう。<br>どんな一日でしたか？
```

**`<br>`** = 強制改行。閉じタグ不要。
HTMLは普通に改行しても無視されるから、`<br>` で明示的に改行する。

---

### ブロック3：3つのメッセージ

このパネルには**サンプルメッセージが3つ**ハードコードされてる：

#### メッセージ1：AI（in）
```html
<div class="message in">
  <div class="avatar">AI</div>
  <div class="bubble-col">
    <div class="bubble">今日の気持ちを、英語で伝えてみましょう。<br>どんな一日でしたか？</div>
    <div class="ts">09:12</div>
  </div>
</div>
```

→ 左寄せで表示される（`in`クラスのCSS設定）

#### メッセージ2：ユーザー（out）
```html
<div class="message out">
  <div class="bubble-col">
    <div class="bubble">今日は本当に疲れた…</div>
    <div class="ts">09:14</div>
  </div>
</div>
```

→ 右寄せで表示される（`out`クラスで反転）
→ アバターなし（自分のメッセージだから）

#### メッセージ3：AI（翻訳結果）
```html
<div class="message in">
  <div class="avatar">AI</div>
  <div class="bubble-col">
    <div class="bubble translation">
      <div class="en-label">English</div>
      <div class="en-result">"I'm exhausted today."</div>
    </div>
    <div class="ts">09:14</div>
  </div>
</div>
```

→ `bubble translation` ← **クラス2つ持ち**
→ `bubble` の見た目に加えて `translation` 用の追加スタイル（金色枠）

#### 重要な気づき

**この3つは固定（ハードコード）された見本**。実際の動作ではこの下にメッセージは追加されない。

「メッセージみたいにならない」と感じてた違和感の原因はここ。
**本物のメッセージ追加機能はまだ実装されてない**。

→ 今後の機能追加対象。

---

### ブロック4：入力パネル

```html
<div class="input-panel">
  <div class="panel-label">今日の一言</div>
  <div class="input-row">
    <textarea id="jpInput" placeholder="日本語で入力…" rows="1"></textarea>
    <button class="btn" onclick="translateText()">英訳する</button>
  </div>
  <div class="result-area">
    <div class="result-placeholder" id="placeholder">英訳結果がここに表示されます</div>
    <div class="result-en" id="resultEn"></div>
  </div>
</div>
```

#### `<textarea>` タグ
- **複数行入力できる入力欄**
- `<input>` は1行のみ、`<textarea>` は複数行
- LINEの入力欄みたいに改行できる

属性：
| 属性 | 意味 |
|---|---|
| `id="jpInput"` | JavaScriptから `getElementById('jpInput')` で取得 |
| `placeholder="日本語で入力…"` | 入力前の薄い灰色の案内文 |
| `rows="1"` | 初期表示行数 |

#### `<button>` タグ
```html
<button class="btn" onclick="translateText()">英訳する</button>
```

| 属性 | 意味 |
|---|---|
| `class="btn"` | CSSで装飾するため |
| `onclick="translateText()"` | クリック時にJSの`translateText()`関数を実行 |

`onclick="..."` は**古いスタイル**。最近はJS側で `addEventListener('click', ...)` を使う方が主流。動作は同じ。

#### result-area（結果表示エリア）

2つの要素が入ってる：
- **`placeholder`** ：初期表示「英訳結果がここに表示されます」、または「翻訳中…」
- **`resultEn`** ：実際の英訳結果

JavaScriptで**表示/非表示を切り替え**：
- 待機中 → placeholder 表示
- 翻訳中 → placeholder に「翻訳中…」
- 完了 → placeholder 非表示、resultEn 表示

---

### HTMLとJavaScriptの繋がり整理

```
HTML側のid              JavaScript側
─────────────         ─────────────
id="jpInput"     ←→   document.getElementById('jpInput')
id="placeholder" ←→   document.getElementById('placeholder')
id="resultEn"    ←→   document.getElementById('resultEn')

onclick="translateText()" ←→ async function translateText() {...}
```

**id** は「JavaScriptから操作する目印」。

---

### HTML全体の役割まとめ

| パート | 役割 |
|---|---|
| `<header>` | 見た目のロゴ表示 |
| `.chat-panel` | **見本のメッセージ3つ表示**（実装は未完成） |
| `.input-panel` | 入力欄＋ボタン＋結果表示エリア |

#### コンセプト

**「LINE風の見た目」を作るために**、メッセージ吹き出しの構造を真似てる：

- 左右で配置を変える（`in` / `out`）
- アバター＋吹き出し＋タイムスタンプ
- 吹き出しの形（角の丸み）も左右で違う

---

## 5. 重要な概念まとめ

### ポート番号
- PCの中の「窓口番号」
- `localhost:3000` の `3000` がこれ
- 複数のサービスを区別するために使う

### CORS（コルス）
- Cross-Origin Resource Sharing
- 違うアドレス間の通信を許可する仕組み

### JSON
- データを送り合うときの標準フォーマット
- `{ "text": "今日は疲れた" }` みたいな形
- ネット越しに送るには `JSON.stringify()` で文字列化が必要

### SDK
- Software Development Kit
- 開発者キット
- APIを簡単に呼ぶための道具箱

### ミドルウェア
- リクエストとエンドポイントの間に入る処理
- `app.use(...)` で設定
- フィルターのように順番に通る

### async / await
- 時間がかかる処理（API通信など）を扱う
- `async` 関数の中で `await` を使うと、その処理が終わるまで待つ

### try-catch
- エラーが起きうる処理を `try` で囲む
- 失敗したら `catch` ブロックが走る

### fetch
- ブラウザ標準の通信機能
- サーバーにリクエストを送る
- `await` とセットで使う

### イベントリスナー
- 「特定のイベントで関数を実行」する仕組み
- `addEventListener('イベント名', 関数)` で登録

### DOM操作
- HTMLの要素をJavaScriptで操作すること
- `document.getElementById('id名')` で取得
- `.textContent`, `.style.display`, `.value` などで操作

### セマンティックタグ
- `<header>`, `<main>`, `<footer>`, `<section>`, `<article>` など
- 「意味」を持つタグ
- `<div>` でも見た目は同じだが、SEO・アクセシビリティ・可読性で有利

### クラスの複数持ち
```html
<div class="message in">
<div class="bubble translation">
```
- スペース区切りで複数指定
- CSS側で `.message.in` のように**組み合わせ**でスタイル指定可能

### id と class の違い

| | id | class |
|---|---|---|
| 用途 | **1ページに1個だけ**の識別 | **複数の要素**に同じスタイル |
| JS取得 | `getElementById()` | `getElementsByClassName()` |
| CSS指定 | `#id名` | `.class名` |

---

## 6. 理解度チェック（自分用クイズ）

### server.js編

#### 質問1（基礎）
`require('dotenv').config();` がないとどうなる？

<details>
<summary>答え</summary>

`.env` ファイルが読み込まれない。
`process.env.ANTHROPIC_API_KEY` が `undefined` になる。
Anthropic APIへの認証が失敗して、翻訳エラーが出る。

</details>

#### 質問2（重要）
`async` と `await` はなぜ必要？なくしたらどうなる？

<details>
<summary>答え</summary>

API通信は時間がかかる処理（数秒）。
`await` なしだと、結果が返ってくる前に次の処理に進んでしまう。

`async` は「この関数の中で `await` を使うよ」という宣言。
`await` を使うには、その関数が `async` である必要がある。

</details>

#### 質問3（応用）
エンドポイントのURLを `/api/translate` から `/api/honyaku` に変えたら、どこを変えれば動く？

<details>
<summary>答え</summary>

server.js の `app.post('/api/translate', ...)` を `app.post('/api/honyaku', ...)` に変える。

それだけだとブラウザ側からのアクセス先が古いままなので、
index.html の `fetch('/api/translate', ...)` も `fetch('/api/honyaku', ...)` に変える必要がある。

サーバーとフロントの両方を変える必要がある。

</details>

#### 質問4（深掘り）
システムプロンプトを「日本語→韓国語の翻訳者」に変えたらどうなる？

<details>
<summary>答え</summary>

英訳の代わりに韓国語訳が返ってくるようになる。

これがプロンプトエンジニアリングの威力：
**コードをほとんど変えずに、AIの振る舞いだけ変えられる**。

</details>

### index.html JavaScript編

#### 質問5
`fetch('/api/translate')` の URL を `/api/honyaku` に変えたら何が起きる？

<details>
<summary>答え</summary>

ブラウザは `/api/honyaku` にリクエストを送るが、
server.js側にそのエンドポイントが定義されていないため404エラー。
画面に「翻訳に失敗しました」と表示される。

</details>

#### 質問6
`await` を消したらどうなる？

<details>
<summary>答え</summary>

`fetch()` は Promise を返す（処理がまだ終わってない状態のオブジェクト）。
`await` なしだと、`res` が Promise のまま次の `res.ok` の判定に進む。
結果として正しい判定ができず、おかしな挙動になる。

</details>

#### 質問7
`e.preventDefault()` がないとどうなる？

<details>
<summary>答え</summary>

Enterキーを押したときに、ブラウザのデフォルト動作（改行）も実行されてしまう。
結果として、送信は走るが入力欄にも改行が入って残ってしまう。

</details>

#### 質問8
`void resultEn.offsetWidth;` を消したらどうなる？

<details>
<summary>答え</summary>

CSSアニメーション（フェードイン）が2回目以降再生されなくなる。
1回目の翻訳ではアニメーション付きで表示されるが、
2回目以降は瞬時に切り替わるだけになる。

</details>

### index.html HTML編

#### 質問9
`<div class="message in">` の `in` を `out` に変えたら何が起きる？

<details>
<summary>答え</summary>

そのメッセージが**右寄せ**で表示される（ユーザーのメッセージ扱いになる）。
また、アバターが右側に来る（`flex-direction: row-reverse` の効果）。

CSSは `class="message"` で共通スタイル、`.message.in` と `.message.out` で個別調整してるため。

</details>

#### 質問10
`<button class="btn" onclick="translateText()">` から `onclick` を消したらどうなる？

<details>
<summary>答え</summary>

ボタンを押しても何も起きなくなる。

ボタンとJavaScript関数の繋がりが切れるため、`translateText()` 関数が呼び出されない。
代替手段としてJS側で `addEventListener('click', translateText)` を設定すれば動作する。

</details>

#### 質問11
`id="jpInput"` を `id="japaneseInput"` に変えたら、何を一緒に変えないと壊れる？

<details>
<summary>答え</summary>

JavaScript側の以下を全部変える必要がある：
- `document.getElementById('jpInput')`（2箇所）
- `const ta = document.getElementById('jpInput')`

`id` はHTMLとJavaScriptの**橋渡し**。
片方だけ変えると JavaScript が要素を見つけられず、エラーになる。

</details>

#### 質問12
`<header>` を `<div>` に変えたら、見た目は変わる？

<details>
<summary>答え</summary>

CSS が `header { ... }` で指定されているため、**そのスタイルが効かなくなる**。

見た目は崩れる：レイアウト・色・サイズが初期状態になる。

ただし `<div class="header">` のようにクラスで指定し、CSS も `.header { ... }` に変えれば、同じ見た目を再現できる。

セマンティックタグを使うのは**意味の伝達**のためで、見た目は CSS 次第。

</details>

---

## 7. 今後追加予定

- [ ] index.html CSS部分の解説（見た目）
- [ ] package.json の解説（依存関係管理）
- [ ] git の基本操作まとめ
- [ ] 機能追加の記録（メッセージ履歴、単語ピックアップなど）
- [ ] エラー対応の記録（学習ログ）

---

## おまけ：今日学んだセキュリティ事故対応

### 起きたこと
ターミナルで `cat .env` を実行 → スクショに APIキー が含まれてチャットに送信。

### 対応
1. すぐにAnthropic Console で古いキーを **Revoke**（無効化）
2. 新しいキーを発行
3. `.env` を新キーに書き換え
4. サーバー再起動

### 学び
- APIキーは絶対にチャット・スクショ・GitHub に出さない
- 流出しても**即対応すれば被害ゼロ**にできる
- `.gitignore` で `.env` を必ず除外する
- 確認したい時は `head -c 30 .env` で**先頭だけ**見る

これは実務でも頻発する事故。
冷静な対応経験は就活でも語れる。
