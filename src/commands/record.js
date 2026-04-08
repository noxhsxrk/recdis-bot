const { SlashCommandBuilder } = require("discord.js");
const { joinVoiceChannel } = require("@discordjs/voice");
const { initSession, getActiveSession } = require("../audio/streamManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("record")
    .setDescription("เบิร์นไฟ กำลังอัดเสียงอยู่น้าาาาา"),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content: "You need to be in a voice channel to use this command!",
        ephemeral: true,
      });
    }

    if (getActiveSession()) {
      return interaction.reply({
        content: "I am already recording a session!",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      initSession(connection);

      return interaction.followUp(
        `เบิร์นไฟกำลังอัดเสียงอยู่น้าาาาา ที่ **${voiceChannel.name}**! ใช้ \`/stop\` เพื่อหยุดอัดเสียงและสร้างไฟล์เสียง`,
      );
    } catch (error) {
      console.error("Failed to start recording:", error);
      return interaction.followUp({
        content: "Failed to join the voice channel and start recording.",
        ephemeral: true,
      });
    }
  },
};
