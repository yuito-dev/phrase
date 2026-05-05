# phrase 学習ノート

phraseプロジェクトを通じて学んだことを整理したメモ。
Claude Codeに書かせたコードを「自分で説明できる」レベルまで理解するための復習用。

---

## 目次

1. [プロジェクト全体の構造](#1-プロジェクト全体の構造)
2. [server.js 解説](#2-serverjs-解説)
3. [重要な概念まとめ](#3-重要な概念まとめ)
4. [理解度チェック（自分用クイズ）](#4-理解度チェック自分用クイズ)
5. [今後追加予定](#5-今後追加予定)

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

## 3. 重要な概念まとめ

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

---

## 4. 理解度チェック（自分用クイズ）

### 質問1（基礎）
`require('dotenv').config();` がないとどうなる？

<details>
<summary>答え</summary>

`.env` ファイルが読み込まれない。
`process.env.ANTHROPIC_API_KEY` が `undefined` になる。
Anthropic APIへの認証が失敗して、翻訳エラーが出る。

</details>

### 質問2（重要）
`async` と `await` はなぜ必要？なくしたらどうなる？

<details>
<summary>答え</summary>

API通信は時間がかかる処理（数秒）。
`await` なしだと、結果が返ってくる前に次の処理に進んでしまう。
`response` が `undefined` のままで、`response.content[0].text` でエラー。

`async` は「この関数の中で `await` を使うよ」という宣言。
`await` を使うには、その関数が `async` である必要がある。

</details>

### 質問3（応用）
エンドポイントの URL を `/api/translate` から `/api/honyaku` に変えたら、どこを変えれば動く？

<details>
<summary>答え</summary>

server.js の `app.post('/api/translate', ...)` を `app.post('/api/honyaku', ...)` に変える。

それだけだとブラウザ側からのアクセス先が古いままなので、
index.html の `fetch('/api/translate', ...)` も `fetch('/api/honyaku', ...)` に変える必要がある。

サーバーとフロントの**両方**を変える必要がある。

</details>

### 質問4（深掘り）
システムプロンプトを「日本語→韓国語の翻訳者」に変えたらどうなる？

<details>
<summary>答え</summary>

英訳の代わりに韓国語訳が返ってくるようになる。
ただしClaudeの韓国語性能や、フロント側の表示も「ENGLISH」のままだったりするので、
そこも合わせて変える必要が出てくる。

これがプロンプトエンジニアリングの威力：
**コードをほとんど変えずに、AIの振る舞いだけ変えられる**。

</details>

---

## 5. 今後追加予定

- [ ] index.html の解説（HTML / CSS / JavaScript）
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
