const { SlashCommandBuilder } = require("discord.js");
const { joinVoiceChannel } = require("@discordjs/voice");
const { initSession, getActiveSession } = require("../audio/streamManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("record")
    .setDescription("Starts recording the current voice channel"),

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
        `Started recording in **${voiceChannel.name}**! Use \`/stop\` to end recording and generate the mixdown.`,
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
