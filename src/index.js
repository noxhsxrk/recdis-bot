#!/usr/bin/env node
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Events,
} = require("discord.js");
const fs = require("node:fs");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Map();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  }
}
client.once(Events.ClientReady, async () => {
  console.log(`Ready! Logged in as ${client.user.tag}`);

  const commandsArray = Array.from(client.commands.values()).map((c) =>
    c.data.toJSON(),
  );
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    const guildId = process.env.GUILD_ID;
    if (guildId) {
      console.log(`Started refreshing ${commandsArray.length} application (/) commands for Guild: ${guildId}.`);
      await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
        body: commandsArray,
      });
      console.log(`Successfully reloaded ${commandsArray.length} Guild application (/) commands.`);
    } else {
      console.log(`Started refreshing ${commandsArray.length} global application (/) commands.`);
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commandsArray,
      });
      console.log(`Successfully reloaded ${commandsArray.length} global application (/) commands.`);
    }
  } catch (error) {
    console.error("Error refreshing commands:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
