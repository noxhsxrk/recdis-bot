const fs = require("fs");
const path = require("path");
const { mixdown } = require("../audio/mixer");
const { transcribe } = require("../ai/transcriber");
const { summarize } = require("../ai/summarizer");
const { cleanupSessionData } = require("../utils/cleanup");

const DISCORD_MSG_LIMIT = 1900;
const DOWNLOADS_DIR = path.join(require("os").homedir(), "Downloads");
const LAST_SESSION_PATH = path.join(__dirname, "..", "..", "last_session.json");

async function runPipeline(interaction, sessionData) {
  const timestamp = sessionData.globalStartTime || Date.now();
  const baseName = `meeting_${timestamp}`;
  const outputPath = path.join(DOWNLOADS_DIR, `${baseName}.mp3`);
  const transcriptPath = path.join(DOWNLOADS_DIR, `${baseName}_transcript.txt`);
  const summaryPath = path.join(DOWNLOADS_DIR, `${baseName}_summary.md`);

  try {
    // Stage 1: Mixdown
    if (!fs.existsSync(outputPath)) {
      await interaction.editReply("⏳ **`[1/3]`** กำลังรวมไฟล์เสียง อยู่น้าทุกคน 😘");
      console.log("[Pipeline] Step 1/3: Starting mixdown...");
      await mixdown(sessionData);
    } else {
      console.log("[Pipeline] Step 1/3: MP3 already exists, skipping mixdown.");
    }

    // Stage 2: Transcription
    let transcript;
    if (!fs.existsSync(transcriptPath)) {
      await interaction.editReply("⏳ **`[2/3]`** กำลังถอดเสียงอยู่น้าาาาา รอแป๊ปนุงง 🥹");
      
      let members = [];
      try {
        if (process.env.MEMBERS_NAMES) {
          const safeJsonStr = process.env.MEMBERS_NAMES.replace(/([:]\s*)(\d{17,20})/g, '$1"$2"');
          members = JSON.parse(safeJsonStr);
        }
      } catch (e) {
        console.warn("Failed to parse MEMBERS_NAMES:", e.message);
      }

      const taskData = {
        chunks: sessionData.chunks,
        members: members,
      };

      console.log(`[Pipeline] Step 2/3: Starting transcription for ${sessionData.chunks.length} tracks...`);
      transcript = await transcribe(taskData);
      fs.writeFileSync(transcriptPath, transcript, "utf8");
      console.log("[Pipeline] Transcription complete.");
    } else {
      console.log("[Pipeline] Step 2/3: Transcript already exists, skipping transcription.");
      transcript = fs.readFileSync(transcriptPath, "utf8");
    }

    // Intermediate Feedback
    const stats = fs.statSync(outputPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    const intermediateAttachments = [transcriptPath];
    if (fileSizeInMB < 25) intermediateAttachments.unshift(outputPath);

    await interaction.editReply({
      content: "⏳ **`[3/3]`** กำลังสรุปอยู่น้าาาาา 😋\n*(แนบไฟล์เสียงและข้อความถอดเสียงให้ดูก่อนน้า)*",
      files: intermediateAttachments,
    });

    // Stage 3: Summarization
    let summary;
    if (!fs.existsSync(summaryPath)) {
      console.log("[Pipeline] Step 3/3: Starting summarization via Ollama...");
      summary = await summarize(transcript);
      fs.writeFileSync(summaryPath, summary, "utf8");
      console.log("[Pipeline] Summarization complete.");
    } else {
      console.log("[Pipeline] Step 3/3: Summary already exists, skipping summarization.");
      summary = fs.readFileSync(summaryPath, "utf8");
    }

    // Final Post
    const header = `✅ **สรุปการประชุม**\n\n`;
    const footer = `\n\n---\n*⚠️ ปล. เบิร์นไฟ อาจจะมีการถอดเสียงหรือสรุปผิดพลาดได้น้าาา เช็คความถูกต้องอีกทีด้วยจ้า*\n*Files saved locally to \`~/Downloads\`*`;
    const summaryBody = summary.length > DISCORD_MSG_LIMIT
      ? summary.slice(0, DISCORD_MSG_LIMIT) + "\n*(truncated — full notes attached in file)*"
      : summary;

    const finalAttachments = [transcriptPath, summaryPath];
    if (fileSizeInMB < 25) finalAttachments.unshift(outputPath);

    await interaction.editReply({
      content: header + summaryBody + footer,
      files: finalAttachments,
    });

    // Success Cleanups
    cleanupSessionData(sessionData);
    if (fs.existsSync(LAST_SESSION_PATH)) fs.unlinkSync(LAST_SESSION_PATH);

  } catch (error) {
    console.error("Pipeline utility error:", error);
    throw error;
  }
}

module.exports = { runPipeline };
