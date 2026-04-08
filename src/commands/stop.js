const { SlashCommandBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");
const { endSession, getActiveSession } = require("../audio/streamManager");
const { mixdown } = require("../audio/mixer");
const { cleanupSessionData } = require("../utils/cleanup");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop recording and generate the final mixdown"),

  async execute(interaction) {
    if (!getActiveSession()) {
      return interaction.reply({
        content: "I am not currently recording!",
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
        return interaction.followUp(
          "Recording stopped, but no audio was detected.",
        );
      }

      await interaction.followUp(
        "Processing audio tracks... This may take a moment.",
      );

      const outputPath = await mixdown(sessionData);

      cleanupSessionData(sessionData);

      const stats = fs.statSync(outputPath);
      const fileSizeInMB = stats.size / (1024 * 1024);

      if (fileSizeInMB < 25) {
        await interaction.editReply({
          content: "✅ Complete! Here is your meeting recording.",
          files: [outputPath],
        });
      } else {
        await interaction.editReply({
          content: `✅ Complete! The file is too large to send over Discord (${fileSizeInMB.toFixed(2)} MB), but it has been saved to local`,
        });
      }
    } catch (error) {
      console.error("Failure during stop or mixdown:", error);
      await interaction.editReply(
        "❌ Failed to process the recording Mixdown.",
      );
    }
  },
};
