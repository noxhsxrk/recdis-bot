const { SlashCommandBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");
const { endSession, getActiveSession } = require("../audio/streamManager");
const { mixdown } = require("../audio/mixer");
const { cleanupSessionData } = require("../utils/cleanup");
const { transcribe } = require("../ai/transcriber");
const { summarize } = require("../ai/summarizer");
const fs = require("fs");

const DISCORD_MSG_LIMIT = 1900;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription(
      "หนูหยุดอัดเสียงแล้ว เริ่มสร้างไฟล์เสียง สรุป และถอดเสียง 📝",
    ),

  async execute(interaction) {
    if (!getActiveSession()) {
      return interaction.reply({
        content: "หนูไม่ได้อัดเสียงอยู่น้าาาาา",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      const sessionData = endSession();

      const connection = getVoiceConnection(interaction.guildId);
      if (connection) {
        connection.destroy();
      }

      if (sessionData.chunks.length === 0) {
        return interaction.followUp("หยุดอัดเสียงแล้ว แต่ไม่เจอเสียงพูดเลย 🥺");
      }

      await interaction.editReply(
        "⏳ **`[1/3]`** กำลังรวมไฟล์เสียง อยู่น้าทุกคน 😘",
      );

      console.log("[Pipeline] Step 1/3: Starting mixdown...");
      const outputPath = await mixdown(sessionData);

      await interaction.editReply(
        "⏳ **`[2/3]`** กำลังถอดเสียงอยู่น้าาาาา รอแป๊ปนุงง 🥹",
      );

      let members = [];
      try {
        if (process.env.MEMBERS_NAMES) {
          const safeJsonStr = process.env.MEMBERS_NAMES.replace(
            /([:]\s*)(\d{17,20})/g,
            '$1"$2"',
          );
          members = JSON.parse(safeJsonStr);
        }
      } catch (e) {
        console.warn("Failed to parse MEMBERS_NAMES from .env:", e.message);
      }

      const taskData = {
        chunks: sessionData.chunks,
        members: members,
      };

      console.log(
        `[Pipeline] Step 2/3: Starting transcription for ${sessionData.chunks.length} tracks...`,
      );
      const transcript = await transcribe(taskData);

      console.log("[Pipeline] Transcription complete.");
      console.log(
        `\n--- TRANSCRIPT RESULT ---\n${transcript}\n-------------------------\n`,
      );

      cleanupSessionData(sessionData);

      const stats = fs.statSync(outputPath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      const baseName = outputPath.substring(0, outputPath.lastIndexOf("."));

      const transcriptPath = `${baseName}_transcript.txt`;
      fs.writeFileSync(transcriptPath, transcript, "utf8");

      const intermediateAttachments = [transcriptPath];
      if (fileSizeInMB < 25) intermediateAttachments.unshift(outputPath);

      await interaction.editReply({
        content:
          "⏳ **`[3/3]`** กำลังสรุปอยู่น้าาาาา 😋\n*(แนบไฟล์เสียงและข้อความถอดเสียงให้ดูก่อนน้า)*",
        files: intermediateAttachments,
      });

      console.log("[Pipeline] Step 3/3: Starting summarization via Ollama...");
      const summary = await summarize(transcript);
      console.log("[Pipeline] Summarization complete.");

      const summaryPath = `${baseName}_summary.md`;
      fs.writeFileSync(summaryPath, summary, "utf8");

      const header = `✅ **สรุปการประชุม**\n\n`;
      const footer = `\n\n---\n*⚠️ ปล. เบิร์นไฟ อาจจะมีการถอดเสียงหรือสรุปผิดพลาดได้น้าาา เช็คความถูกต้องอีกทีด้วยจ้า*\n*Files saved locally to \`~/Downloads\`*`;

      const summaryBody =
        summary.length > DISCORD_MSG_LIMIT
          ? summary.slice(0, DISCORD_MSG_LIMIT) +
            "\n*(truncated — full notes attached in file)*"
          : summary;

      const finalAttachments = [transcriptPath, summaryPath];
      if (fileSizeInMB < 25) finalAttachments.unshift(outputPath);

      await interaction.editReply({
        content: header + summaryBody + footer,
        files: finalAttachments,
      });
    } catch (error) {
      console.error("Pipeline error:", error);
      await interaction.editReply(`❌ **Pipeline failed:** ${error.message}`);
    }
  },
};
