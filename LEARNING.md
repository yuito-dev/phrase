# phrase 学習ノート

phraseプロジェクトを通じて学んだことを整理したメモ。
Claude Codeに書かせたコードを「自分で説明できる」レベルまで理解するための復習用。

---

## 目次

1. [プロジェクト全体の構造](#1-プロジェクト全体の構造)
2. [server.js 解説](#2-serverjs-解説)
3. [index.html JavaScript部分の解説](#3-indexhtml-javascript部分の解説)
4. [重要な概念まとめ](#4-重要な概念まとめ)
5. [理解度チェック（自分用クイズ）](#5-理解度チェック自分用クイズ)
6. [今後追加予定](#6-今後追加予定)

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
- 将来別アドレスのサーバーから叩けるよう、入れておく

#### `const path = require('path');`
- ファイルパスを扱う道具（Node.js標準装備）
- `path.join()` でWindowsとLinuxの違い（`\` と `/`）を吸収

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
- **料理を始める前の厨房**

#### `const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });`
- Anthropic APIとの通信窓口を作る
- `.env` から読み込んだAPIキーをセット
- 以降 `client.messages.create({...})` でClaude API叩ける
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

順番にフィルター通って処理される。

---

### ブロック3：翻訳エンドポイント【メイン】（14〜46行目）

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
- ブラウザが `POST http://localhost:3000/api/translate` を送ってきたら、この関数を実行
- `req`: リクエスト（ブラウザからの注文）
- `res`: レスポンス（サーバーからの返答）
- `async`: 「この関数は時間がかかる処理が入る」と宣言（`await` とセット）

#### `const { text } = req.body;`

- リクエスト本体から `text` を取り出す
- **分割代入**という書き方

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
| `!text` | textが存在しない（null, undefined, 空） |
| `typeof text !== 'string'` | 文字列じゃない（数字とか配列） |
| `!text.trim()` | 空白だけの文字列 |

いずれかに該当したら、ステータス400（Bad Request）でエラー返す。
`return` でここで関数終了、API呼び出しに進ませない。

#### try-catch（エラーハンドリング）

```javascript
try {
  // 危険な処理
} catch (error) {
  // エラー時の処理
}
```

- `try` ブロック：失敗しうる処理（API通信など）
- `catch` ブロック：失敗した時に走る

#### Claude API呼び出し

```javascript
const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 512,
  system: [...],
  messages: [{ role: 'user', content: text.trim() }],
});
```

- **`await`**：この処理が終わるまで待つ（API通信は数秒かかる）
- **`client.messages.create({...})`**：Claude APIにリクエスト

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

→「日英翻訳者として、自然な英訳だけ返せ。説明・引用符・余計な文字なし」

これが**プロンプトエンジニアリング**。AIにどう動いてほしいか指示する技術。

#### `cache_control: { type: 'ephemeral' }`

**プロンプトキャッシング**機能。
同じシステムプロンプトを何度も送る時、Anthropic側でキャッシュして料金を安くする。

#### 結果取り出し

```javascript
const translation = response.content[0]?.text ?? '';
res.json({ translation });
```

- **`?.`**（オプショナルチェイニング）：`content[0]` が存在しなくてもエラーにならない
- **`?? ''`**（Null合体演算子）：左が `undefined` か `null` なら、右の `''` を使う
- **`res.json({ translation })`**：ブラウザにJSON形式で返答

返答例:
```json
{ "translation": "I'm exhausted today." }
```

#### catch ブロック（エラーハンドリング）

```javascript
} catch (error) {
  console.error('Translation error:', error);

  if (error instanceof Anthropic.AuthenticationError) {
    return res.status(500).json({ error: 'APIキーが無効です。.envを確認してください。' });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return res.status(429).json({ error: 'リクエストが多すぎます。' });
  }

  res.status(500).json({ error: '翻訳に失敗しました。' });
}
```

| エラー種別 | 原因 | ステータス |
|---|---|---|
| `AuthenticationError` | APIキー無効 | 500 |
| `RateLimitError` | リクエスト多すぎ | 429 |
| その他 | 通信失敗、不明エラー | 500 |

- **`console.error()`**：サーバー側のターミナルにエラー出力（デバッグ用）
- **`instanceof`**：「このエラーは○○型？」チェック

---

### ブロック4：サーバー起動（48〜52行目）

```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
```

#### `const PORT = process.env.PORT || 3000;`
- `.env` に `PORT` 指定があればそれを使う、なければ3000
- `||`：左が「なし」なら右を使う

#### `app.listen(PORT, () => {...})`
- 指定ポートでサーバー起動
- 第2引数の関数は「起動完了したら実行」

#### テンプレートリテラル

```javascript
console.log(`Server running → http://localhost:${PORT}`);
```

- バッククォート `` ` `` で囲む
- 変数を `${...}` で埋め込める

---

### server.js 全体の流れまとめ

```
【準備】
1. 道具読み込み（require）
2. サーバー作成（app）
3. Anthropic通信窓口作成（client）
4. ミドルウェア設定（cors, json, static）

【メイン処理】
5. POST /api/translate を受ける関数定義
   ├─ 入力検証
   ├─ Anthropic APIに翻訳依頼（await）
   ├─ 結果をJSONで返す
   └─ エラー時は適切なメッセージ返す

【起動】
6. 指定ポートで待ち受け開始
```

---

## 3. index.html JavaScript部分の解説

### 全体像

このJSがやってること：

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

#### `async function translateText() {`

- **`async`**：「この関数の中で `await` を使うよ」宣言
- **`function translateText()`**：`translateText` という名前の関数を定義

#### `const input = document.getElementById('jpInput').value.trim();`

3つの処理が連続してる。分解すると：

```javascript
const element = document.getElementById('jpInput');  // 1. HTML要素取得
const value = element.value;                          // 2. 入力値取得
const input = value.trim();                           // 3. 前後の空白削除
```

- **`document.getElementById('jpInput')`**：HTMLの中から `id="jpInput"` の要素（入力欄）を取得
- **`.value`**：入力欄の中身を取り出す
- **`.trim()`**：文字列の前後の空白を削除

例：`"  今日は疲れた  "` → `"今日は疲れた"`

#### `if (!input) return;`

入力が空っぽなら関数終了。
server.js側でも検証してるが、**両方でチェック**するのがプロの作法（多重防御）。

#### 画面要素の取得

```javascript
const placeholder = document.getElementById('placeholder');
const resultEn    = document.getElementById('resultEn');
```

| 変数 | 役割 |
|---|---|
| `placeholder` | 翻訳中…や英訳結果のプレースホルダー |
| `resultEn` | 英訳結果を表示する要素 |

#### UI状態の更新

```javascript
placeholder.textContent   = '翻訳中…';
placeholder.style.display = 'block';
resultEn.style.display    = 'none';
```

- **`textContent`**：要素の中のテキストを変更
- **`style.display`**：表示/非表示を切り替え

| プロパティ | 意味 |
|---|---|
| `'block'` | 表示する |
| `'none'` | 非表示にする |

つまりボタン押した瞬間に画面を「ローディング状態」にする処理。

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

#### `const res = await fetch('/api/translate', { ... });`

**ブラウザからサーバーに通信する瞬間**。最重要部分。

##### `fetch()` とは
ブラウザに標準装備されてる通信機能。指定したURLにリクエストを送る。

##### 引数の意味

```javascript
fetch('/api/translate', {
  method: 'POST',                                    // ← 通信方法
  headers: { 'Content-Type': 'application/json' },   // ← データ形式
  body: JSON.stringify({ text: input }),             // ← 送るデータ
});
```

| 項目 | 意味 |
|---|---|
| `'/api/translate'` | 送信先（server.jsで定義したエンドポイントと一致！） |
| `method: 'POST'` | POSTメソッドで送る |
| `headers` | 「JSON形式でデータ送るよ」と宣言 |
| `body` | 実際に送るデータ |

##### `JSON.stringify({ text: input })`

JavaScriptオブジェクト→JSON文字列に変換：

```javascript
{ text: "今日は疲れた" }
   ↓ JSON.stringify
'{"text":"今日は疲れた"}'
```

ネット越しに送るには文字列にする必要がある。

##### `await` の役割
API通信は時間かかる（数秒）。`await` で結果が返るまで待つ。

#### `const data = await res.json();`

サーバーからの返答を解析：

- `res` はレスポンスオブジェクト（生データ）
- `res.json()` でJSONを解析してオブジェクトに変換
- `await` で解析完了を待つ

例：
```javascript
// サーバーから返ってくる文字列
'{"translation":"I'm exhausted today."}'
   ↓ res.json()
// JavaScriptオブジェクトに変換
{ translation: "I'm exhausted today." }
```

これで `data.translation` で英訳取り出せる。

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

#### `if (!res.ok) { ... }`

`res.ok`：HTTPステータスコードが200番台（成功）なら `true`、それ以外なら `false`。

| ステータス | `res.ok` |
|---|---|
| 200 OK | true |
| 400 Bad Request | false |
| 500 Internal Server Error | false |

サーバーがエラーを返した場合、サーバーが返したエラーメッセージを表示し、`return` で処理終了。

#### 結果表示の謎の処理

```javascript
placeholder.style.display = 'none';
resultEn.style.display    = 'none';
void resultEn.offsetWidth;
resultEn.textContent      = `"${data.translation}"`;
resultEn.style.display    = 'block';
```

**`void resultEn.offsetWidth;`** ← これが謎ポイント。

##### なぜこれがある？

**CSSアニメーションを再実行するためのテクニック**。

`resultEn` にはフェードインアニメーションが設定されてる（CSS側で）。
2回目以降の翻訳時、`display: none` → `block` に戻すだけだとアニメーションが再生されない。

`void resultEn.offsetWidth;` で強制的にブラウザに「要素を再計算しろ」と命令することで、アニメーションがリセットされて、再生される。

これはフロントエンド界隈の有名な小技。

##### `void` って何？
「式を実行するけど、結果を捨てる」演算子。
ここでは「`offsetWidth` を読み出す（＝ブラウザに再計算させる）だけで、値はいらない」という意味。

#### テンプレートリテラル

```javascript
resultEn.textContent = `"${data.translation}"`;
```

バッククォートで英訳をクォートで囲んで表示。

例：
```javascript
data.translation = "I'm exhausted today."
   ↓
resultEn.textContent = '"I\'m exhausted today."'
```

#### `} catch (_) { ... }`

通信自体が失敗した場合（ネットワーク切断など）。

`(_)` の意味：エラーオブジェクトを受け取るけど使わないことを示す慣習。`(error)` でもOK。

```javascript
placeholder.textContent = 'ネットワークエラーが発生しました。';
```

ユーザーに分かるエラーメッセージ表示。

---

### ブロック4：テキスト欄の自動リサイズ

```javascript
const ta = document.getElementById('jpInput');

ta.addEventListener('input', () => {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
});
```

#### イベントリスナーとは

「特定のイベントが起きた時に、関数を実行する」設定。

`'input'` イベント：ユーザーが入力欄に1文字打つたびに発生。

#### 自動リサイズの仕組み

```javascript
ta.style.height = 'auto';                              // 一旦リセット
ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';  // 内容に合わせる
```

- **`ta.scrollHeight`**：内容を全部表示するのに必要な高さ
- **`Math.min(ta.scrollHeight, 100)`**：scrollHeightと100のうち小さい方

→ 入力に合わせて高さが伸びるけど、最大100pxまで。

LINEとかDiscordの入力欄で見るやつ。改行するたびに枠が広がる動き。

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

#### `'keydown'` イベント
キーが押された瞬間に発生。
`e` はイベント情報（どのキーが押されたかなど）。

#### 条件チェック

```javascript
if (e.key === 'Enter' && !e.shiftKey) {
```

- `e.key === 'Enter'`：Enterキーが押された
- `!e.shiftKey`：Shiftキーは押されてない

| 操作 | 動作 |
|---|---|
| Enter | **送信** |
| Shift + Enter | 改行（普通の動作） |

LINE/Discord式。

#### `e.preventDefault();`
ブラウザのデフォルト動作をキャンセル。
通常Enter押すと改行が入るけど、それをキャンセルして送信処理だけ走らせる。

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

## 4. 重要な概念まとめ

### ポート番号
- PCの中の「窓口番号」
- `localhost:3000` の `3000` がこれ
- 複数のサービスを区別するために使う

### CORS（コルス）
- Cross-Origin Resource Sharing
- 違うアドレス間の通信を許可する仕組み
- デフォルトでブラウザが「違うアドレス間通信」をブロックする

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
- ないと「結果まだ来てないのに次の処理に進む」状態になる

### try-catch
- エラーが起きうる処理を `try` で囲む
- 失敗したら `catch` ブロックが走る
- これがないとサーバー全体がクラッシュすることも

### fetch
- ブラウザ標準の通信機能
- サーバーにリクエストを送る
- `await` とセットで使う

### イベントリスナー
- 「特定のイベントで関数を実行」する仕組み
- `addEventListener('イベント名', 関数)` で登録
- 例：`'click'`, `'input'`, `'keydown'`

### DOM操作
- HTMLの要素をJavaScriptで操作すること
- `document.getElementById('id名')` で取得
- `.textContent`, `.style.display`, `.value` などで操作

---

## 5. 理解度チェック（自分用クイズ）

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
`response` が `undefined` のままで、`response.content[0].text` でエラー。

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
ただしClaudeの韓国語性能や、フロント側の表示も「ENGLISH」のままだったりするので、
そこも合わせて変える必要が出てくる。

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

server.js側の `app.post('/api/translate', ...)` も同じURLに変えれば動く。

</details>

#### 質問6
`await` を消したらどうなる？

<details>
<summary>答え</summary>

`fetch()` は Promise を返す（処理がまだ終わってない状態のオブジェクト）。
`await` なしだと、`res` が Promise のまま次の `res.ok` の判定に進む。
結果として正しい判定ができず、おかしな挙動になる。

通信は時間がかかるので、結果を待たずに進むと値が空のままになる。

</details>

#### 質問7
`e.preventDefault()` がないとどうなる？

<details>
<summary>答え</summary>

Enterキーを押したときに、ブラウザのデフォルト動作（改行）も実行されてしまう。
結果として、送信は走るが入力欄にも改行が入って残ってしまう。

UIとしては気持ち悪い動きになる。

</details>

#### 質問8
`void resultEn.offsetWidth;` を消したらどうなる？

<details>
<summary>答え</summary>

CSSアニメーション（フェードイン）が2回目以降再生されなくなる。
1回目の翻訳ではアニメーション付きで表示されるが、
2回目以降は瞬時に切り替わるだけになる。

機能としては動くが、視覚的な演出がなくなる。

</details>

---

## 6. 今後追加予定

- [ ] index.html HTML部分の解説（骨組み）
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
