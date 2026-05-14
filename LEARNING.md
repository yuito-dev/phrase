# phrase 学習ノート

phraseプロジェクトを通じて学んだことを整理したメモ。
Claude Codeに書かせたコードを「自分で説明できる」レベルまで理解するための復習用。

---

## 目次

1. [プロジェクト全体の構造](#1-プロジェクト全体の構造)
2. [server.js 解説](#2-serverjs-解説)
3. [index.html JavaScript部分の解説](#3-indexhtml-javascript部分の解説)
4. [index.html HTML部分の解説](#4-indexhtml-html部分の解説)
5. [index.html CSS部分の解説](#5-indexhtml-css部分の解説)
6. [重要な概念まとめ](#6-重要な概念まとめ)
7. [理解度チェック（自分用クイズ）](#7-理解度チェック自分用クイズ)
8. [今後追加予定](#8-今後追加予定)
9. [プロジェクト履歴・引継ぎ情報](#9-プロジェクト履歴引継ぎ情報)

---

## 1. プロジェクト全体の構造

### 3つの登場人物

```
ブラウザ (index.html) ←→ サーバー (server.js) ←→ Anthropic Claude API
   PC内                       PC内                      ネット上
```

### なぜブラウザから直接APIを叩かないのか

APIキーが流出するから。
ブラウザに直接APIキーを書くと、誰でも開発者ツールで見られる。
他人にコピーされて、自分のクレジットを使われ放題になる。

だからサーバーが「キーを持つ秘書」として間に入る。

### 英訳ボタン押した時の流れ

```
1. ゆいとが日本語を入力 → 英訳ボタン
2. ブラウザのJSが、サーバーにPOST送信
3. server.jsが受け取り、Anthropic APIに転送
4. ClaudeのAIが英訳して返す
5. server.jsがブラウザに結果を返す
6. ブラウザのJSが画面に表示
```

### ファイルの役割

| ファイル | 役割 |
|---|---|
| index.html | お客さんが見る画面 |
| server.js | 注文処理・外部発注 |
| .env | APIキー保管（金庫の鍵） |
| package.json | 必要な道具一覧 |
| node_modules/ | 実際の道具一式 |
| .gitignore | GitHubに上げないもの |

### 言語の使い分け

index.html 1ファイルの中に3つの言語：

| 言語 | 役割 |
|---|---|
| HTML | 画面の骨組み・構造 |
| CSS | 画面の見た目・装飾 |
| JavaScript | 画面の動き・処理 |

---

## 2. server.js 解説

### ブロック1：道具の読み込み

```javascript
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');
const cors = require('cors');
const path = require('path');
```

- `require('dotenv').config();`：.envを読み込み、process.env.XXXで値を使えるように
- `Anthropic`：Anthropic公式SDK
- `express`：Webサーバーを作る道具
- `cors`：違うアドレス間通信を許可
- `path`：ファイルパスを扱う道具

**`require()`** = ライブラリを読み込む命令
**`const`** = 変えられない箱

### ブロック2：サーバー初期設定

```javascript
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
```

- `app`：Expressのアプリ本体
- `client`：Anthropic APIとの通信窓口
- `app.use(...)` でミドルウェアを設定

**`__dirname`** = 今このファイルがあるフォルダのパス

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
      system: [...],
      messages: [{ role: 'user', content: text.trim() }],
    });

    const translation = response.content[0]?.text ?? '';
    res.json({ translation });
  } catch (error) {
    // エラー処理
  }
});
```

#### パラメータの意味

| パラメータ | 意味 |
|---|---|
| model | 使うAIモデル（Haikuは安い・速い） |
| max_tokens | 返答の最大長 |
| system | システムプロンプト（AIへの指示書） |
| messages | ユーザーの入力 |

#### システムプロンプト

```
You are a Japanese-to-English translator. 
Translate the given Japanese text into natural, fluent English. 
Output only the English translation — no explanations, no quotation marks, no extra text.
```

これがプロンプトエンジニアリング。

#### 演算子

- **`?.`**（オプショナルチェイニング）：存在しなくてもエラーにならない
- **`?? ''`**（Null合体演算子）：左がundefined/nullなら右を使う

#### エラー種別

| エラー種別 | 原因 |
|---|---|
| AuthenticationError | APIキー無効 |
| RateLimitError | リクエスト多すぎ |
| その他 | 通信失敗等 |

### ブロック4：サーバー起動

```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
```

- `||`：左がなければ右を使う
- テンプレートリテラル（バッククォート）で変数埋め込み

---

## 3. index.html JavaScript部分の解説

### 全体像

```
1. translateText() の定義
   ├─ 入力欄から日本語取得
   ├─ サーバーに送信
   ├─ 結果を画面に表示
   └─ エラー時はエラーメッセージ

2. テキスト入力欄の自動リサイズ
3. Enterキーで送信
```

### ブロック1：入力取得 & UI準備

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

- `document.getElementById()`：HTML要素を取得
- `.value`：入力値を取得
- `.trim()`：前後の空白を削除
- `textContent`：要素のテキストを変更
- `style.display`：表示/非表示の切り替え

### ブロック2：API通信

```javascript
try {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: input }),
  });

  const data = await res.json();
```

#### fetch()の引数

| 項目 | 意味 |
|---|---|
| URL | 送信先 |
| method | 通信方法（POST） |
| headers | データ形式の宣言 |
| body | 送るデータ |

`JSON.stringify()` でJSオブジェクト→JSON文字列に変換。

### ブロック3：結果表示

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

#### `res.ok`
HTTPステータスが200番台ならtrue。

#### `void resultEn.offsetWidth;` の意味
CSSアニメーションを再実行するためのテクニック。
display: none → blockに戻すだけだとアニメーションが再生されないため、
強制的にブラウザに「要素を再計算しろ」と命令する。

### ブロック4：自動リサイズ

```javascript
const ta = document.getElementById('jpInput');

ta.addEventListener('input', () => {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
});
```

入力に合わせて高さが伸びるが、最大100pxまで。

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
| Enter | 送信 |
| Shift + Enter | 改行 |

`e.preventDefault()` でブラウザのデフォルト動作（改行）をキャンセル。

### サーバーとの連携

```
ブラウザ側                    サーバー側
fetch('/api/translate')  →   app.post('/api/translate')
body: { text: "..." }    →   req.body.text
                          ←   res.json({ translation })
data.translation         ←
```

---

## 4. index.html HTML部分の解説

### 全体構造

```
<body>
  ├─ <header>           ← 上部のロゴ＋タグ
  └─ <div class="main">
      ├─ <div class="chat-panel">    ← メッセージ表示エリア
      └─ <div class="input-panel">   ← 入力エリア
</body>
```

### ブロック1：header

```html
<header>
  <div class="logo">phr<span>a</span>se</div>
  <div class="header-tag">English Learning</div>
</header>
```

#### セマンティックタグ
`<header>` はHTML5のセマンティックタグ。
「これはヘッダー部分です」とブラウザや検索エンジンに伝える。

#### `<span>` で部分装飾
`a` だけ `<span>` で囲むことで、CSSから `.logo span { font-style: italic; }` で斜体にできる。

### ブロック2：メッセージの構造

```html
<div class="message in">
  <div class="avatar">AI</div>
  <div class="bubble-col">
    <div class="bubble">...</div>
    <div class="ts">09:12</div>
  </div>
</div>
```

#### クラス2つ持ち

`class="message in"` のように、スペース区切りで複数指定できる。
- `message` → 全メッセージ共通の見た目
- `in` または `out` → 左右の区別

CSSで `.message.in` のように組み合わせて指定可能。

### ブロック3：3つのメッセージ

サンプルメッセージ3つがハードコードされてる。

| メッセージ | 内容 | 表示位置 |
|---|---|---|
| 1 | AI挨拶 | 左寄せ |
| 2 | ユーザー入力例 | 右寄せ |
| 3 | AI翻訳結果 | 左寄せ |

実際の動作ではこの下にメッセージは追加されない。
→ 本物のメッセージ追加機能はまだ未実装。

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

#### `<textarea>` 属性

| 属性 | 意味 |
|---|---|
| id | JS用の識別子 |
| placeholder | 入力前の案内文 |
| rows | 初期表示行数 |

#### `<button>` 属性

| 属性 | 意味 |
|---|---|
| class | CSS装飾用 |
| onclick | クリック時の関数 |

### HTMLとJavaScriptの繋がり

```
HTML側                  JavaScript側
id="jpInput"     ←→   getElementById('jpInput')
id="placeholder" ←→   getElementById('placeholder')
id="resultEn"    ←→   getElementById('resultEn')
onclick="..."    ←→   function translateText()
```

---

## 5. index.html CSS部分の解説

### CSSの基本構文

```css
セレクタ {
  プロパティ: 値;
}
```

| 要素 | 意味 |
|---|---|
| セレクタ | どの要素に対して |
| プロパティ | 何を |
| 値 | どう設定するか |

### ブロック1：リセットCSS

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
```

`*` セレクタですべての要素を指定。
`box-sizing: border-box` でpadding/borderを内側に含む計算に。

### ブロック2：CSS変数

```css
:root {
  --bg:          #0C0C0C;
  --surface:     #141414;
  --surface-2:   #1C1C1C;
  --gold:        #C8A84B;
  --gold-dark:   #8A7230;
  --gold-subtle: rgba(200, 168, 75, 0.09);
  --gold-border: rgba(200, 168, 75, 0.22);
  --text:        #EDE9DF;
  --text-muted:  #6B6860;
  --border:      #222220;
  --divider:     #2C2C2A;
}
```

`var(--bg)` で呼び出し。1箇所変えれば全部反映。

### ブロック3〜12（簡略）

| ブロック | 内容 | 主なプロパティ |
|---|---|---|
| 3. レイアウト基礎 | html/body | flex, 100dvh, overflow:hidden |
| 4. ヘッダー | header | flex, align-items, justify-content |
| 5. ロゴ | .logo | font-family, letter-spacing |
| 6. チャットパネル | .chat-panel | flex:1, overflow-y, gap |
| 7. メッセージ吹き出し | .message, .bubble | row-reverse, border-radius |
| 8. 翻訳結果 | .bubble.translation | text-transform |
| 9. 入力パネル | .input-panel | box-shadow |
| 10. textarea | textarea | resize, outline, transition |
| 11. ボタン | .btn | cursor, opacity, :hover, :active |
| 12. 結果＋アニメ | .result-en, @keyframes | animation, transform |

### 重要な技術ポイント

- **Flexbox**：`display: flex` + `flex-direction` + `align-items` + `justify-content` でレイアウト
- **border-radius: 50%**：正方形を円に
- **border-radius: 4px 14px 14px 14px**：各角を個別指定（LINE風吹き出しの「しっぽ」）
- **box-shadow: 0 -14px 28px ...**：影で立体感
- **@keyframes + animation**：カスタムアニメーション
- **transform: translateY()**：パフォーマンス良い移動（GPU使用）

### 疑似クラス・疑似要素

| 種類 | 例 |
|---|---|
| 疑似クラス（:） | `:hover`, `:focus`, `:active`, `:disabled` |
| 疑似要素（::） | `::before`, `::after`, `::placeholder` |

---

## 6. 重要な概念まとめ

### サーバー・API系

- **ポート番号**：PCの中の「窓口番号」。`localhost:3000` の `3000`
- **CORS**：違うアドレス間の通信を許可する仕組み
- **JSON**：データを送り合う標準フォーマット
- **SDK**：APIを簡単に呼ぶための道具箱
- **ミドルウェア**：リクエストとエンドポイントの間に入る処理
- **async / await**：時間がかかる処理を扱う
- **try-catch**：エラーが起きうる処理を囲む

### フロント系

- **fetch**：ブラウザ標準の通信機能
- **イベントリスナー**：「特定のイベントで関数を実行」する仕組み
- **DOM操作**：HTMLの要素をJSで操作すること
- **セマンティックタグ**：意味を持つタグ（header, main, footer など）
- **クラスの複数持ち**：スペース区切りで複数指定

### id と class の違い

| | id | class |
|---|---|---|
| 用途 | 1ページに1個だけ | 複数の要素 |
| JS取得 | getElementById() | getElementsByClassName() |
| CSS指定 | #id名 | .class名 |

### CSS系

- **CSS変数**：`--変数名: 値;` で定義、`var(--変数名)` で呼び出し
- **Flexbox**：`display: flex` でレイアウト
- **ボックスモデル**：margin / border / padding / content
- **box-sizing: border-box**：直感的な幅計算
- **疑似クラス**：`:hover`, `:focus`, `:active`, `:disabled`
- **疑似要素**：`::before`, `::after`, `::placeholder`
- **transition**：プロパティの変化を滑らかに
- **@keyframes**：カスタムアニメーションの定義
- **transform**：要素を変形・移動

---

## 7. 理解度チェック（自分用クイズ）

### server.js編

#### 質問1
`require('dotenv').config();` がないとどうなる？

<details>
<summary>答え</summary>

.envファイルが読み込まれない。
process.env.ANTHROPIC_API_KEY が undefined になる。
Anthropic APIへの認証が失敗して、翻訳エラーが出る。

</details>

#### 質問2
`async` と `await` はなぜ必要？

<details>
<summary>答え</summary>

API通信は時間がかかる処理（数秒）。
await なしだと、結果が返ってくる前に次の処理に進んでしまう。

</details>

#### 質問3
エンドポイントのURLを `/api/honyaku` に変えたら、どこを変えれば動く？

<details>
<summary>答え</summary>

server.jsとindex.html両方を変える必要がある。
サーバー側とフロント側の整合性が必要。

</details>

#### 質問4
システムプロンプトを「日本語→韓国語の翻訳者」に変えたらどうなる？

<details>
<summary>答え</summary>

英訳の代わりに韓国語訳が返ってくる。
プロンプトエンジニアリングでAIの振る舞いだけ変えられる。

</details>

### index.html JavaScript編

#### 質問5
`fetch('/api/honyaku')` に変えたら？

<details>
<summary>答え</summary>

server.js側にエンドポイントがないため404エラー。
「翻訳に失敗しました」と表示される。

</details>

#### 質問6
`await` を消したら？

<details>
<summary>答え</summary>

fetch() はPromiseを返すため、resがPromiseのまま次の判定に進む。
おかしな挙動になる。

</details>

#### 質問7
`e.preventDefault()` がないと？

<details>
<summary>答え</summary>

Enterキーの改行も実行される。
送信と同時に入力欄に改行が残る。

</details>

#### 質問8
`void resultEn.offsetWidth;` を消したら？

<details>
<summary>答え</summary>

2回目以降のアニメーションが再生されない。
瞬時に切り替わるだけになる。

</details>

### index.html HTML編

#### 質問9
`<div class="message in">` の `in` を `out` に変えたら？

<details>
<summary>答え</summary>

右寄せで表示される。アバターが右側に来る。
`flex-direction: row-reverse` の効果。

</details>

#### 質問10
`onclick="translateText()"` を消したら？

<details>
<summary>答え</summary>

ボタンを押しても何も起きない。
JS関数の繋がりが切れる。

</details>

#### 質問11
`id="jpInput"` を変えたら、何を一緒に変えないと壊れる？

<details>
<summary>答え</summary>

JavaScript側の`document.getElementById('jpInput')`を全部変える必要がある。
HTMLとJSの橋渡し。

</details>

#### 質問12
`<header>` を `<div>` に変えたら見た目は変わる？

<details>
<summary>答え</summary>

CSSが`header { ... }`で指定されているため、スタイルが効かなくなる。
`.header`クラス指定に変えれば再現可能。

</details>

### index.html CSS編

#### 質問13
`box-sizing: border-box;` を消したら？

<details>
<summary>答え</summary>

width: 100px + padding: 20px の要素が140pxに広がる。
レイアウトが崩れる原因に。

</details>

#### 質問14
`--gold` の値を変えたら何箇所変わる？

<details>
<summary>答え</summary>

var(--gold)を使ってる全箇所が変わる。
ロゴ、ボタン、吹き出し、英訳結果、アバター等多数。

</details>

#### 質問15
`flex-direction: column` と `row` の違いは？

<details>
<summary>答え</summary>

column：縦並び
row：横並び（デフォルト）

</details>

#### 質問16
`:root` と `body` の違いは？

<details>
<summary>答え</summary>

:root：HTMLの最上位要素（<html>）の疑似クラス
body：<body>タグそのもの
CSS変数定義は:rootが慣習。

</details>

#### 質問17
`transition: border-color 0.2s;` の効果は？

<details>
<summary>答え</summary>

border-colorが変化する時、0.2秒かけて滑らかに変化。
:focusで色が変わる時のアニメーション。

</details>

#### 質問18
`@keyframes fadeUp` で何が起きる？

<details>
<summary>答え</summary>

「ふわっと下から浮き上がる」フェードイン効果のアニメーションを定義してる。

</details>

---

## 8. 今後追加予定

- [ ] package.json の解説（依存関係管理）
- [ ] git の基本操作まとめ
- [ ] 機能追加の記録（メッセージ履歴、単語ピックアップなど）
- [ ] エラー対応の記録（学習ログ）

---

## 9. プロジェクト履歴・引継ぎ情報

**このセクションは、新しいClaudeチャットに引き継ぐ際の情報源。**
**新チャットの最初に「このLEARNING.mdの第9章を全部読んで」と指示すれば、文脈が復元できる。**

---

### 9-1. ゆいとという人物

#### 基本情報
- 名前：ゆいと（GitHub: yuito-dev）
- 大学生（IT系志望）、ややイケメン
- WSL ユーザー名：`yuito`
- 環境：Windows + ノートPC + デスクトップ（ゲーミング）+ iPhone

#### 学習歴
- C言語とLinuxは大学の授業で履修した程度
- HTML/CSS基礎あり、Progate学習中
- JavaScript / Node.js / Express は phrase で初体験
- Git / GitHub も phrase でほぼ初体験

#### 強み（重要：飽き性って自称するけど実は粘り強い）
- ミスっても折れない
- 詰まっても聞きながら進む
- 「学習したい」「コード理解したい」と自分から言える
- 流出事故時もパニクらず冷静対応した
- 完成までやり切る性質ある

#### 飽き性自覚あり
- 退屈な作業は続かない
- だから飽きる前に区切る・成果出すのが鉄則
- ただし、燃えてる時はガンガン進む

#### つまずきパターン
新チャットの俺はこれを知らないと適切なサポートできない：

1. **概念の混同**
   - HTML / CSS / JavaScript の区別が曖昧になることがある
   - ファイル名の認識が混同しがち（LEARNING.md と CSS.css とか）
   - 選択肢の番号（C）とプログラミング言語のCを混同したことあり

2. **環境系の混乱**
   - WSL / VS Code / ターミナルの位置関係で混乱
   - 複数ターミナル開いた時に混乱
   - Ctrl+C・Ctrl+Shift+R・Ctrl+End などのショートカット案内が毎回必要
   - 「Ctrl+Fで検索」みたいな具体的操作指示が必要

3. **コピペミス**
   - 過去にindex.htmlの`<script>`タグをコピペで壊した（git checkoutで復元）
   - そのため`<!DOCTYPE html>S`という余計な「S」が冒頭に残ってる

---

### 9-2. このプロジェクトの基本ルール（厳守）

#### トーン・スタイル
- 砕けた口調、断定的、率直
- 「〜です・ます」と「〜だ・である」混在OK
- **ヨイショ禁止、忖度禁止、誘導禁止**
- ゆいとが間違ってたら「それは違う」「そこは誇張」とハッキリ言う
- 良ければ理由付きで肯定する
- 「正直に言うと」「ここは厳しい現実」など本音の前置きを使う

#### 進め方
- 1ラリー＝3手分くらいで進める
- 不要な前置き・繰り返し説明を省く
- 選択肢を出す時はマークダウン表で比較
- 重要箇所は太字で強調
- 迷ったら推奨を理由付きで明示

#### ツール使い分け
- **このチャット（俺）**：戦略・コード理解・判断相談・学習サポート
- **Claude Code（ターミナル）**：実装・ファイル編集・git操作

---

### 9-3. プロジェクトの位置づけ

#### プロジェクト：phrase
英語学習×AIのキーボード拡張系アプリ。
日本語を打つとAIが英訳を提案、夜のロック画面で復習通知が届く構想。

#### 動機
ゆいと自身が英語学習続かなかったから、日常侵食型を作りたい。

#### マインドセット
- 収益化は副産物
- 主目的：**学習＋形に残す＋少し普及＋改善経験＋就活活用**
- Web版から始める（iOSはMac必須で断念）
- Chrome拡張化も将来検討

#### ターゲット層
- 第一：英語を話せるようになりたいが続かない大学生〜若手社会人（20-30歳）
  - TOEIC勉強続かない、洋楽・海外ドラマ好き、SNS常用、英語アプリ三日坊主経験あり
- 第二：TOEICが必要な就活生・転職層

#### 競合分析
- 直接競合：日常SNS入力時に英訳提案するアプリは日本にメジャー製品なし
- 間接競合：Speak、Duolingo、ELSA、スピークバディ、スタディサプリ、DeepL、ChatGPT
- 差別化軸：「**アプリを開かなくても英語に触れる**」日常侵食型

---

### 9-4. 完了済み事項

#### 環境構築
- WSL Ubuntu / Node.js / VS Code+WSL拡張
- Git / GitHub (yuito-dev) / SSH連携
- phraseリポジトリ作成・clone・push成功
- Claude Code (v2.1.121) 起動・認証成功
- Anthropic APIキー取得（**1回流出事故あり→Revoke→新キーで復旧**）
- $20 クレジット購入済（1年有効）

#### 実装
- **index.html**：ダーク+ゴールドのLINE風UI完成
  - HTML：header / chat-panel（**サンプル3メッセージ固定**）/ input-panel
  - CSS：CSS変数、Flexbox、@keyframesアニメーション
  - JavaScript：translateText() でfetch経由API呼び出し
- **server.js**：Express + Anthropic SDK
- モデル：`claude-haiku-4-5-20251001`
- エンドポイント：`/api/translate`
- **.env / .gitignore**：APIキー安全管理
- 本物のClaude APIで日英翻訳が動作中

#### 起動方法
```bash
cd ~/projects/phrase
node server.js
# → http://localhost:3000
```

#### 学習成果
- LEARNING.md（このファイル）作成・GitHub公開
- phraseの全コード解説完了（server.js、HTML、CSS、JavaScript）
- 1472行・36.6KB

---

### 9-5. 過去の重大事件と教訓

#### 事件1：APIキー流出事故
- ターミナルで `cat .env` 実行 → スクショに含まれてチャットに送信
- 即対応：Revoke → 新キー発行 → .env書き換え → サーバー再起動 → 復旧
- 教訓：
  - `cat .env` を絶対やらない
  - 確認は `head -c 30 .env` で先頭だけ
  - 俺ももっと早く警告すべきだった（反省）

#### 事件2：index.html破損
- コピペミスで`<script>`タグが壊れた
- `git checkout HEAD -- index.html` で復元
- 教訓：git push しておけば最悪復元可能

#### 事件3：WSL接続切断
- 何度か起きた
- 対処：`wsl --shutdown` → 30秒待つ → VS Code再起動

#### 事件4：EADDRINUSE エラー
- ポート3000が複数プロセスで重複
- 対処：`pkill -f "node server.js"` で全停止

---

### 9-6. やらないことリスト（過去に検討して却下）

| 案 | 却下理由 |
|---|---|
| iOSアプリ化 | Macが必須、現環境ではビルド不可 |
| ブラウザから直接API叩く | セキュリティ（APIキー流出）でNG |
| `<script>onclick="..."`スタイル | 古い書き方、addEventListenerが主流（ただし現状の実装は古いまま、リファクタは保留） |

---

### 9-7. 今後の構想（優先度順）

#### Phase 1：Web版MVP完成（直近）
- メッセージ履歴機能（チャット風に蓄積。現在は固定3メッセージのみ）
- 3単語ピックアップ機能（AIが英訳から重要単語3つ抽出）
- 学習プラン選択（TOEIC頻出/英検頻出/大学受験頻出）
- Web Push通知（夜の復習リマインド）
- デプロイ（Vercel等で誰でもアクセス可能に）

#### Phase 2：Chrome拡張版
- 各種SNS入力欄を検知してインライン英訳サジェスト
- 復習通知をChrome通知で
- Chrome Web Store公開（$5）

#### Phase 3（夢）
- iOS/Androidネイティブ化（誰かと組めれば）

---

### 9-8. 次にやる候補（ゆいとの選択肢）

1. **メッセージ履歴機能の実装**（チャット風UI完成。ゆいとが気にしてた「メッセージみたいにならない」問題の解決）
2. **3単語ピックアップ機能の追加**
3. **デプロイ**（誰でもアクセス可能に）
4. **README.md整備**（就活素材として）
5. **録画素材作り**（顔出しなし、TikTok/Reels用）
6. **LEARNING.md追記**（package.json / git操作 など）

---

### 9-9. プロジェクトファイル構成

```
~/projects/phrase/
├── index.html        ← 冒頭に「<!DOCTYPE html>S」の余計な「S」あり
├── server.js
├── .env              ← GitHub除外（.gitignoreで）
├── .gitignore
├── package.json
├── package-lock.json
├── node_modules/
├── README.md
└── LEARNING.md       ← このファイル
```

#### よく使うパス
- WSL: `~/projects/phrase/`
- Windowsダウンロード: `/mnt/c/Users/yuito/Downloads/`
- GitHub: `https://github.com/yuito-dev/phrase`

---

### 9-10. セキュリティルール（厳守）

- **APIキーは絶対にチャット・スクショに出さない**
- `cat .env` をターミナルで実行しない
- 確認したい時は `head -c 30 ~/projects/phrase/.env` で先頭だけ
- 流出したら即Anthropic ConsoleでRevoke→新キー発行
- `.env`は`.gitignore`で必ず除外

---

### 9-11. 就活との関係

GitHubポートフォリオ・動画発信・Claude Code経験・ピボット経験・
**セキュリティ事故対応経験**を強みにする方向。

語れるストーリー例：
> 「英語学習が続かなかった経験から、AIを使った日常侵食型の英語学習サービスphraseを開発しました。Web版MVPを完成させ、Anthropic Claude APIで翻訳機能を実装。開発中にAPIキーをチャット経由で流出させる事故を起こしましたが、即座にRevokeして新キーで復旧する経験を積みました。Claude Codeに頼り切らず、生成されたコードを1行ずつ理解し、学習記録もMarkdownで公開しています。」

---

### 9-12. 引継ぎプロンプト読み込み完了の合図

新チャットのClaudeへ：

このセクション（第9章）を全部読んだら、以下のように返答してください：

```
了解、引継ぎ完了。phraseプロジェクトの全文脈把握しました。
ゆいとの個性・つまずきパターン・過去の事件・現状・構想すべて理解。

次は何やる？候補：
1. メッセージ履歴機能の実装
2. 3単語ピックアップ機能
3. デプロイ
4. README.md整備
5. 録画素材作り
6. LEARNING.md追記

それとも別のこと？
```

これで文脈は完全復元される。
あとは「【トーン・スタイル】砕けた口調、ヨイショ禁止」のルールで進めればOK。

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
