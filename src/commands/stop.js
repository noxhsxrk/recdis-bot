const { SlashCommandBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");
const { endSession, getActiveSession } = require("../audio/streamManager");
const { runPipeline } = require("../utils/pipeline");
const fs = require("fs");
const path = require("path");
const { safeReply } = require("../utils/discordUtils");

const LAST_SESSION_PATH = path.join(__dirname, "..", "..", "last_session.json");

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

    let sessionData;
    try {
      sessionData = endSession();

      const connection = getVoiceConnection(interaction.guildId);
      if (connection) {
        connection.destroy();
      }

      if (sessionData.chunks.length === 0) {
        return interaction.followUp("หยุดอัดเสียงแล้ว แต่ไม่เจอเสียงพูดเลย 🥺");
      }

      // Persist session for retry support
      fs.writeFileSync(LAST_SESSION_PATH, JSON.stringify(sessionData, null, 2));

      // Run the pipeline
      await runPipeline(interaction, sessionData);

    } catch (error) {
      console.error("Pipeline error in stop command:", error);
      if (interaction.deferred || interaction.replied) {
        await safeReply(interaction, `❌ **Pipeline failed:** ${error.message}\n*(คุณสามารถแก้ปัญหาแล้วใช้คำสั่ง \`/retry\` เพื่อลองใหม่ได้นะ)*`);
      } else {
        await interaction.reply(`❌ **Pipeline failed:** ${error.message}`);
      }
    }
  },
};
