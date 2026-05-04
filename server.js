require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

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
          text: 'You are a Japanese-to-English translator. Translate the given Japanese text into natural, fluent English. Output only the English translation — no explanations, no quotation marks, no extra text.',
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
    console.error('Translation error:', error);

    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: 'APIキーが無効です。.envを確認してください。' });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'リクエストが多すぎます。しばらくしてから再試行してください。' });
    }

    res.status(500).json({ error: '翻訳に失敗しました。しばらくしてから再試行してください。' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
