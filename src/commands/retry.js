const { SlashCommandBuilder } = require("discord.js");
const { runPipeline } = require("../utils/pipeline");
const fs = require("fs");
const path = require("path");

const LAST_SESSION_PATH = path.join(__dirname, "..", "..", "last_session.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("retry")
    .setDescription("ลองใหม่อีกครั้งสำหรับเซสชันที่พังไป 🔄"),

  async execute(interaction) {
    if (!fs.existsSync(LAST_SESSION_PATH)) {
      return interaction.reply({
        content: "ไม่เจอข้อมูลการประชุมล่าสุดที่พังไปเลยน้าาาา 🥺",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      const sessionData = JSON.parse(fs.readFileSync(LAST_SESSION_PATH, "utf8"));
      
      if (sessionData.chunks.length === 0) {
        return interaction.followUp("ข้อมูลเซสชันล่าสุดไม่มีไฟล์เสียงเลย 🥺");
      }

      await interaction.editReply("🔄 **กำลังพยายามทำต่อจากเดิมให้นะจ๊ะ...**");

      // Run the pipeline (runPipeline already handles skipping existing files)
      await runPipeline(interaction, sessionData);

    } catch (error) {
      console.error("Pipeline error in retry command:", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`❌ **Retry failed:** ${error.message}`);
      } else {
        await interaction.reply(`❌ **Retry failed:** ${error.message}`);
      }
    }
  },
};
