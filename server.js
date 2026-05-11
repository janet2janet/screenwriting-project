require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { Document, Paragraph, TextRun, AlignmentType, Packer, convertInchesToTwip } = require('docx');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
  console.warn('\n⚠️  WARNING: No ANTHROPIC_API_KEY set in .env — proofreader will not work.\n');
}

const client = new Anthropic();

// ── Proofread (streaming) ──────────────────────────────────────────────────

app.post('/api/proofread', async (req, res) => {
  const { screenplay } = req.body;
  if (!screenplay) return res.status(400).json({ error: 'No screenplay provided' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are a professional screenplay editor reviewing a writer's first feature film. Proofread the following screenplay and provide specific, actionable, encouraging feedback.

Focus on:
1. **Formatting** — incorrect caps, missing INT./EXT., wrong element usage
2. **Dialogue** — naturalness, character voice, clarity
3. **Action lines** — are they visual, present tense, and concise?
4. **Structure & Pacing** — scene length, story momentum
5. **What's working** — always end with genuine strengths

Use clear sections, bullet points, and be encouraging. This is their first film.

---
${screenplay}
---`
      }]
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    stream.on('finalMessage', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    stream.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── DOCX export ───────────────────────────────────────────────────────────

app.post('/api/export-docx', async (req, res) => {
  const { elements, title } = req.body;
  if (!elements || !elements.length) return res.status(400).json({ error: 'No elements provided' });

  const paragraphs = [];

  // Title paragraph
  paragraphs.push(new Paragraph({
    children: [new TextRun({
      text: (title || 'UNTITLED SCREENPLAY').toUpperCase(),
      font: 'Courier New',
      size: 36,
      bold: true,
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  elements.forEach(el => {
    if (!el.text && !el.text === '') return;

    let alignment = AlignmentType.LEFT;
    let indent = { left: 0, right: 0 };
    let bold = false;
    let allCaps = false;
    let spacingBefore = 0;
    let spacingAfter = 120;

    switch (el.type) {
      case 'scene-heading':
        bold = true;
        allCaps = true;
        spacingBefore = 240;
        spacingAfter = 120;
        break;
      case 'action':
        spacingAfter = 120;
        break;
      case 'character':
        allCaps = true;
        indent = { left: convertInchesToTwip(2.2), right: 0 };
        spacingBefore = 120;
        spacingAfter = 0;
        break;
      case 'dialogue':
        indent = { left: convertInchesToTwip(1.5), right: convertInchesToTwip(1.5) };
        spacingAfter = 120;
        break;
      case 'parenthetical':
        indent = { left: convertInchesToTwip(1.9), right: convertInchesToTwip(1.5) };
        spacingAfter = 0;
        break;
      case 'transition':
        alignment = AlignmentType.RIGHT;
        allCaps = true;
        spacingBefore = 120;
        spacingAfter = 120;
        break;
    }

    paragraphs.push(new Paragraph({
      children: [new TextRun({
        text: el.text || '',
        font: 'Courier New',
        size: 24,
        bold,
        allCaps,
      })],
      alignment,
      indent,
      spacing: { before: spacingBefore, after: spacingAfter },
    }));
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: convertInchesToTwip(8.5),
            height: convertInchesToTwip(11),
          },
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.5),
            right: convertInchesToTwip(1),
          },
        },
      },
      children: paragraphs,
    }],
  });

  try {
    const buffer = await Packer.toBuffer(doc);
    const filename = (title || 'screenplay').toLowerCase().replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.docx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎬 SCREENWRITER is live → http://localhost:${PORT}\n`);
});
