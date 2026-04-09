const { Ollama } = require("ollama");

const ollama = new Ollama({ host: "http://127.0.0.1:11434" });

const PROMPT_TEMPLATE = (transcript) =>
  `
คุณคือผู้ช่วยสรุปการพูดคุย โปรดสรุปเนื้อหาต่อไปนี้จาก transcript การพูดคุย และตอบเป็นภาษาไทย

โปรดจัดรูปแบบผลลัพธ์ดังนี้:

**หัวข้อหลัก**
- (รายการหัวข้อที่พูดคุยกัน)

**การตัดสินใจสำคัญ**
- (รายการมติหรือการตัดสินใจ)

**Action Items**
- (รายการงานที่ต้องทำและผู้รับผิดชอบ ถ้ามี)

---
Transcript:
${transcript}
`.trim();

/**
 * Summarizes a meeting transcript using a local Ollama model.
 * @param {string} transcript - The full meeting transcript text.
 * @returns {Promise<string>} Structured meeting notes.
 */
async function summarize(transcript) {
  const model = process.env.OLLAMA_MODEL || "llama3.2";

  const response = await ollama.chat({
    model,
    messages: [{ role: "user", content: PROMPT_TEMPLATE(transcript) }],
    stream: true,
  });

  let fullContent = "";
  for await (const part of response) {
    fullContent += part.message.content;
  }

  return fullContent;
}

module.exports = { summarize };
