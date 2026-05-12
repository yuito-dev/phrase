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

---

### ブロック1：リセットCSS

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
```

#### `*` セレクタ
すべての要素を指す（ワイルドカード）。

#### `*::before, *::after`
疑似要素（::で始まる）。要素の前後に擬似的な要素を作る機能。

#### なぜリセットが必要？
ブラウザごとにデフォルトスタイルが違うため。
最初に全部リセットして、ゼロから組み立てる。

#### `box-sizing: border-box;`

ボックスモデルの計算方法を変える重要プロパティ。

**通常（content-box）**：
- width: 100pxの場合、padding/borderが外側に追加されて広がる

**border-box**：
- width: 100pxの場合、padding/borderは内側に含まれ、合計100pxのまま

直感的に幅を指定できるため、現代CSSではほぼ必須。

#### マージンとパディング

```
┌─ margin（外側） ─────────────┐
│  ┌─ border ────────────────┐ │
│  │  ┌─ padding（内側） ──┐ │ │
│  │  │      内容          │ │ │
│  │  └────────────────────┘ │ │
│  └────────────────────────┘ │
└────────────────────────────┘
```

| 用語 | 場所 |
|---|---|
| margin | 要素の外側の余白 |
| border | 枠線 |
| padding | 要素の内側の余白 |

---

### ブロック2：CSS変数（カスタムプロパティ）

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

#### `:root` とは
HTMLの最上位要素（`<html>`）を指す疑似クラス。
ここで定義した変数はページ全体で使える。

#### CSS変数の書き方

```css
--変数名: 値;
```

使い方：
```css
body {
  background: var(--bg);
  color: var(--text);
}
```

#### なぜ変数を使うか

修正が圧倒的に楽。
変数なしだと色を変えたい時に100箇所書き換える必要があるが、
変数ありなら `:root` の1箇所変えれば全部反映される。

#### phraseの色設計

| 変数 | 値 | 用途 |
|---|---|---|
| --bg | #0C0C0C | 背景（ほぼ黒） |
| --surface | #141414 | 一段明るい黒（入力欄など） |
| --surface-2 | #1C1C1C | さらに明るい黒（吹き出し） |
| --gold | #C8A84B | メインの金色 |
| --gold-dark | #8A7230 | 暗めの金色 |
| --gold-subtle | rgba(200,168,75,0.09) | 透明な金色 |
| --gold-border | rgba(200,168,75,0.22) | 半透明の金色 |
| --text | #EDE9DF | 文字色（オフホワイト） |
| --text-muted | #6B6860 | 薄い文字 |
| --border | #222220 | 枠線色 |
| --divider | #2C2C2A | 区切り線 |

#### 色の指定方法

**16進数表記** `#C8A84B`
- # + 6桁の英数字
- 2桁ずつR/G/Bの値（00〜FF）

**rgba()** `rgba(200, 168, 75, 0.09)`
- R, G, B, A（透明度 0〜1）
- 透明度を付けたい時に使う

#### 黒の濃淡で奥行きを出すテクニック

```
--bg:        #0C0C0C  ← 一番暗い
--surface:   #141414  ← 少し明るい
--surface-2: #1C1C1C  ← さらに明るい
```

完全な黒じゃなく、わずかな明度差を使うことで：
- 奥行きが出る
- 目が疲れない
- 高級感が出る

Discord等で多用されるダークモードのプロのテクニック。

---

### ブロック3：レイアウト基礎（html, body）

```css
html, body {
  height: 100%;
}

body {
  font-family: 'Inter Tight', sans-serif;
  background: var(--bg);
  color: var(--text);
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}
```

#### `font-family: 'Inter Tight', sans-serif;`

カンマ区切りでフォールバック指定。
1. まず Inter Tight を試す
2. なければ sans-serif

#### Flexbox入門

```css
display: flex;
flex-direction: column;
```

| プロパティ | 意味 |
|---|---|
| display: flex | この要素の中身をflexレイアウトで配置 |
| flex-direction: column | 縦方向に並べる |
| flex-direction: row | 横方向に並べる（デフォルト） |

#### `height: 100dvh;`

`dvh` = Dynamic Viewport Height。
`vh` との違い：スマホでアドレスバーが現れたり消えたりする時に動的に追従する。

#### `overflow: hidden;`

はみ出した部分を非表示にする。
ここでは「ページ全体がスクロールしないように」する設定。

---

### ブロック4：ヘッダー部分

```css
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
  height: 50px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
```

#### Flexboxの配置プロパティ

| プロパティ | 意味 |
|---|---|
| align-items: center | 縦方向に中央揃え |
| justify-content: space-between | 左右両端に配置 |

#### `padding: 0 22px;`

ショートハンド記法：
```css
padding: 上 右 下 左;    /* 4つ */
padding: 上下 左右;     /* 2つ */
padding: すべて;        /* 1つ */
```

`padding: 0 22px;` = 上下0、左右22px

#### `border-bottom: 1px solid var(--border);`

境界線のショートハンド：
```css
border-bottom: 太さ スタイル 色;
```

#### `flex-shrink: 0;`

Flexboxアイテムの縮小を防ぐ。
ヘッダーは常に50pxの高さで固定したいから0に。

---

### ブロック5：ロゴのスタイル

```css
.logo {
  font-family: 'Cormorant Garamond', serif;
  font-size: 24px;
  font-weight: 300;
  letter-spacing: 0.18em;
  color: var(--gold);
}

.logo span { font-style: italic; }
```

#### フォント関連プロパティ

| プロパティ | 意味 |
|---|---|
| font-family | フォントの種類 |
| font-size | 文字サイズ |
| font-weight | 文字の太さ（100〜900、400が普通、700が太字） |
| letter-spacing | 文字間隔 |
| font-style: italic | 斜体 |

#### `em` という単位

`0.18em` = 現在のフォントサイズの18%

| 単位 | 意味 |
|---|---|
| px | ピクセル（絶対値） |
| em | 親要素のフォントサイズ基準 |
| rem | rootのフォントサイズ基準 |
| % | 親要素のサイズ基準 |

#### `.logo span` 子孫セレクタ

「`.logo` の中の `span` 要素」を指定。
HTML側で `<div class="logo">phr<span>a</span>se</div>` の `a` だけ斜体になる。

---

### ブロック6：チャットパネル

```css
.chat-panel {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scrollbar-width: none;
}

.chat-panel::-webkit-scrollbar { display: none; }
```

#### `flex: 1;`

Flexbox内で「残りスペースを全部もらう」設定。
ヘッダーと入力パネル以外の残り全部をチャットパネルが占める。

#### `overflow-y: auto;`

縦方向のスクロール：
- auto：必要な時だけスクロールバー表示
- scroll：常に表示
- hidden：スクロール不可

#### `gap: 12px;`

Flexboxアイテム間の隙間。
margin で個別指定するよりシンプル。

#### スクロールバーを隠す技

```css
scrollbar-width: none;                              /* Firefox用 */
.chat-panel::-webkit-scrollbar { display: none; }   /* Chrome系用 */
```

ブラウザごとに別の指定が必要。

#### `-webkit-` プレフィックス

Chrome系ブラウザ専用の接頭辞（ベンダープレフィックス）。

---

### ブロック7：メッセージの吹き出し

```css
.message {
  display: flex;
  align-items: flex-end;
  gap: 9px;
}

.message.out { flex-direction: row-reverse; }

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: 'Cormorant Garamond', serif;
  font-size: 10px;
  color: var(--gold);
}

.bubble-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 72%;
}

.message.out .bubble-col { align-items: flex-end; }

.bubble {
  padding: 9px 13px;
  font-size: 14px;
  line-height: 1.6;
}

.message.in .bubble {
  background: var(--surface-2);
  border-radius: 4px 14px 14px 14px;
  color: var(--text);
}

.message.out .bubble {
  background: var(--gold);
  color: #0C0C0C;
  border-radius: 14px 4px 14px 14px;
  font-weight: 500;
}
```

#### `.message.out` 組み合わせセレクタ

「`message` クラスかつ `out` クラスを持つ要素」。
`row-reverse` で横方向の並びを反転。

#### `border-radius: 50%;`

正方形を完全な円にする。
アバターアイコンが丸くなる仕組み。

#### `border-radius: 4px 14px 14px 14px;`

4つの値で各角を個別指定：
```
border-radius: 左上 右上 右下 左下;
```

- in：左上だけ4px、他14px → 左上が尖った吹き出し
- out：右上だけ4px、他14px → 右上が尖った吹き出し

LINEの吹き出しの「しっぽ風デザイン」を再現。

#### `max-width: 72%;`

吹き出しの最大幅。画面の72%まで広がる。

#### `line-height: 1.6;`

行の高さ。文字サイズの1.6倍。

---

### ブロック8：翻訳結果の特別な吹き出し

```css
.bubble.translation {
  background: var(--gold-subtle);
  border: 1px solid var(--gold-border);
  border-radius: 4px 14px 14px 14px;
  padding: 10px 14px;
}

.bubble .en-label {
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.bubble .en-result {
  font-family: 'Inter Tight', sans-serif;
  font-size: 19px;
  color: var(--gold);
  line-height: 1.4;
}

.ts {
  font-size: 10px;
  color: var(--text-muted);
  padding: 0 2px;
}
```

#### `.bubble.translation`

「`bubble` かつ `translation` クラスを持つ要素」。
半透明の金色背景＋金色の枠線で特別感。

#### `text-transform: uppercase;`

文字を強制的に大文字にする。
HTMLを変えずに見た目だけ変えられる。

---

### ブロック9：入力パネル

```css
.input-panel {
  flex-shrink: 0;
  border-top: 1px solid var(--divider);
  box-shadow: 0 -14px 28px rgba(0, 0, 0, 0.55);
  padding: 14px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg);
}

.panel-label {
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.input-row {
  display: flex;
  gap: 9px;
  align-items: flex-end;
}
```

#### `box-shadow: 0 -14px 28px rgba(0, 0, 0, 0.55);`

影を付ける：
```css
box-shadow: 横ずれ 縦ずれ ぼかし 色;
```

- 0：横ずれなし
- -14px：上に14pxずれる（マイナスで上方向）
- 28px：ぼかしの強さ
- rgba(0,0,0,0.55)：55%の不透明度の黒

「入力パネルがチャットの上に浮いてる」立体感を演出。

#### `padding: 14px 20px 20px;`

3つの値の場合：上 左右 下

---

### ブロック10：textarea（入力欄）

```css
textarea {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 11px;
  color: var(--text);
  font-family: 'Inter Tight', sans-serif;
  font-size: 15px;
  line-height: 1.6;
  padding: 10px 14px;
  resize: none;
  height: 46px;
  max-height: 100px;
  outline: none;
  transition: border-color 0.2s;
}

textarea::placeholder { color: var(--text-muted); }
textarea:focus { border-color: var(--gold-dark); }
```

#### `resize: none;`

textareaのユーザーリサイズを禁止。
JavaScript側で自動調整するため。

#### `outline: none;`

フォーカス時のブラウザデフォルトの青枠を消す。

#### `transition: border-color 0.2s;`

アニメーション設定：
```css
transition: プロパティ 時間 動きの種類;
```

border-colorが変化する時、0.2秒かけて滑らかに変化。

#### 疑似要素・疑似クラス

| | 種類 | 例 |
|---|---|---|
| `::placeholder` | 疑似要素 | プレースホルダーのスタイル |
| `:focus` | 疑似クラス | フォーカス中の状態 |

疑似クラス一覧：
| 疑似クラス | タイミング |
|---|---|
| :hover | マウスが乗ってる |
| :focus | フォーカス中 |
| :active | クリック中 |
| :disabled | 無効化されてる |

---

### ブロック11：ボタンのスタイル

```css
.btn {
  flex-shrink: 0;
  height: 46px;
  padding: 0 20px;
  background: var(--gold);
  color: #0C0C0C;
  border: none;
  border-radius: 11px;
  font-family: 'Inter Tight', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.btn:hover  { opacity: 0.82; }
.btn:active { opacity: 0.65; }
```

#### `cursor: pointer;`

マウスホバー時のカーソルを指マークに。
「クリックできるよ」と視覚的に伝える。

#### `white-space: nowrap;`

テキストを折り返さない設定。

#### `opacity: 0.82;`

透明度。0.82 = 82%の不透明度。
ホバー時にちょっと透明にして「反応した」感を出す。

---

### ブロック12：結果表示エリアとアニメーション

```css
.result-area {
  background: var(--gold-subtle);
  border: 1px solid var(--gold-border);
  border-radius: 11px;
  padding: 10px 16px;
  min-height: 44px;
  display: flex;
  align-items: center;
}

.result-placeholder {
  font-size: 13px;
  color: var(--text-muted);
}

.result-en {
  font-family: 'Inter Tight', sans-serif;
  font-size: 22px;
  color: var(--gold);
  line-height: 1.35;
  display: none;
  animation: fadeUp 0.3s ease both;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

#### `min-height: 44px;`

最小の高さを44pxに固定。
中身が空でも高さが潰れない。

#### `display: none;`

最初は非表示。
英訳結果が来たらJavaScriptで `display: block` に変更。

#### CSS アニメーション

```css
animation: fadeUp 0.3s ease both;
```

ショートハンド：
```css
animation: 名前 時間 動きの種類 適用方法;
```

- fadeUp：下で定義したアニメーション名
- 0.3s：0.3秒
- ease：ゆっくり始まってゆっくり終わる
- both：開始前と終了後の状態を維持

#### `@keyframes` でアニメーション定義

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

| 部分 | 意味 |
|---|---|
| from | アニメーション開始時の状態 |
| to | アニメーション終了時の状態 |
| opacity: 0 → 1 | 透明から不透明へ |
| translateY(6px) → translateY(0) | 下から上にスライド |

「ふわっと下から浮き上がる」フェードイン効果。

#### `transform: translateY(6px);`

変形プロパティで位置を変える。
translateY = Y軸（縦方向）に移動。

margin や top よりパフォーマンスが良い（GPU使用）。

---

### CSS全体のまとめ

```
【リセット】
1. *セレクタで全要素の余白をゼロに

【デザインシステム】
2. :rootでCSS変数を定義（色のパレット）

【レイアウト】
3. body / .main / .chat-panel / .input-panel をFlexboxで縦並び
4. .chat-panel に flex:1 で残り全部を占めさせる

【コンポーネント】
5. .header：横並び、両端配置
6. .message：左右で配置を反転（in/out）
7. .bubble：吹き出しの形（角の丸み差で「しっぽ」表現）
8. textarea / .btn：ダーク背景に金色アクセント
9. .result-area：フェードインアニメーション付き

【動きの仕掛け】
10. :hover / :focus でインタラクション表現
11. @keyframes でカスタムアニメーション
12. transition で滑らかな変化
```

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
`async` と `await` はなぜ必要？なくしたらどうなる？

<details>
<summary>答え</summary>

API通信は時間がかかる処理（数秒）。
await なしだと、結果が返ってくる前に次の処理に進んでしまう。

async は「この関数の中で await を使うよ」という宣言。

</details>

#### 質問3
エンドポイントのURLを `/api/translate` から `/api/honyaku` に変えたら、どこを変えれば動く？

<details>
<summary>答え</summary>

server.js の `app.post('/api/translate', ...)` を `app.post('/api/honyaku', ...)` に変える。

加えて、index.html の `fetch('/api/translate', ...)` も同じURLに変える。

サーバーとフロントの両方を変える必要がある。

</details>

#### 質問4
システムプロンプトを「日本語→韓国語の翻訳者」に変えたらどうなる？

<details>
<summary>答え</summary>

英訳の代わりに韓国語訳が返ってくるようになる。

これがプロンプトエンジニアリングの威力：
コードをほとんど変えずに、AIの振る舞いだけ変えられる。

</details>

### index.html JavaScript編

#### 質問5
`fetch('/api/translate')` の URL を `/api/honyaku` に変えたら何が起きる？

<details>
<summary>答え</summary>

ブラウザは /api/honyaku にリクエストを送るが、
server.js側にそのエンドポイントが定義されていないため404エラー。
画面に「翻訳に失敗しました」と表示される。

</details>

#### 質問6
`await` を消したらどうなる？

<details>
<summary>答え</summary>

fetch() は Promise を返す。
await なしだと、res が Promise のまま次の res.ok の判定に進む。
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

そのメッセージが右寄せで表示される（ユーザーのメッセージ扱いになる）。
また、アバターが右側に来る（`flex-direction: row-reverse` の効果）。

</details>

#### 質問10
`<button class="btn" onclick="translateText()">` から `onclick` を消したらどうなる？

<details>
<summary>答え</summary>

ボタンを押しても何も起きなくなる。
ボタンとJavaScript関数の繋がりが切れるため。

</details>

#### 質問11
`id="jpInput"` を `id="japaneseInput"` に変えたら、何を一緒に変えないと壊れる？

<details>
<summary>答え</summary>

JavaScript側の以下を全部変える必要がある：
- `document.getElementById('jpInput')`（複数箇所）
- `const ta = document.getElementById('jpInput')`

`id` はHTMLとJavaScriptの橋渡し。
片方だけ変えると JavaScript が要素を見つけられず、エラーになる。

</details>

#### 質問12
`<header>` を `<div>` に変えたら、見た目は変わる？

<details>
<summary>答え</summary>

CSS が `header { ... }` で指定されているため、そのスタイルが効かなくなる。
見た目は崩れる：レイアウト・色・サイズが初期状態になる。

ただし `<div class="header">` のようにクラスで指定し、CSS も `.header { ... }` に変えれば、同じ見た目を再現できる。

</details>

### index.html CSS編

#### 質問13
`box-sizing: border-box;` を消したらどうなる？

<details>
<summary>答え</summary>

要素の幅計算が変わる。
width: 100px の要素に padding: 20px を付けると、実際の幅は 140px（100 + 20×2）になる。

border-box の場合は100pxのまま（paddingが内側に含まれる）。

レイアウトが崩れる原因になる。

</details>

#### 質問14
`--gold: #C8A84B;` を `--gold: #FF0000;` に変えたら、何箇所が変わる？

<details>
<summary>答え</summary>

`var(--gold)` を使っている全箇所が変わる。

phraseでは：
- .logo（ロゴの色）
- .btn（ボタンの背景）
- .message.out .bubble（自分の吹き出し）
- .bubble .en-result（英訳結果の文字色）
- .avatar（アバターの文字色）
など多数。

これがCSS変数の威力：1箇所変えれば全部反映される。

</details>

#### 質問15
`flex-direction: column` と `flex-direction: row` の違いは？

<details>
<summary>答え</summary>

- column：縦方向に並べる（上から下へ）
- row：横方向に並べる（左から右へ、デフォルト）

phraseのbody要素は column で、header → main → footer の順に縦に並ぶ。
header の中は row（デフォルト）で、ロゴとタグが横並び。

</details>

#### 質問16
`:root` と `body` の違いは？

<details>
<summary>答え</summary>

- :root：HTMLの最上位要素（`<html>`）を指す疑似クラス
- body：`<body>` タグそのもの

CSS変数を :root で定義するのが慣習。
理由：ページ全体の最上位だから、どこからでも継承できる。

</details>

#### 質問17
`transition: border-color 0.2s;` の効果は？

<details>
<summary>答え</summary>

border-color（枠線の色）が変化する時、0.2秒かけて滑らかに変化する。

phraseでは、textareaの枠線が :focus で --gold-dark に変わる時、ふわっと色が変わるアニメーションが付く。

これがないと、瞬時にカクッと色が変わる。

</details>

#### 質問18
`@keyframes fadeUp { from {...} to {...} }` で何が起きる？

<details>
<summary>答え</summary>

fadeUp という名前のアニメーションを定義してる。

phrase では：
- from：透明＋6px下に位置
- to：不透明＋元の位置

これを .result-en の animation プロパティで呼び出すと、
英訳結果が「ふわっと下から浮き上がる」フェードイン効果になる。

</details>

---

## 8. 今後追加予定

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
