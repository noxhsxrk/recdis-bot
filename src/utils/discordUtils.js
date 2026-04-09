/**
 * Utilities for interacting with Discord in a more resilient way.
 */

/**
 * Sends a reply to an interaction, but safely falls back to channel.send() 
 * if the interaction token has expired (Discord Error 50027).
 * 
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
 * @param {string|import('discord.js').InteractionReplyOptions} options 
 */
async function safeReply(interaction, options) {
  const payload = typeof options === "string" ? { content: options } : options;

  try {
    // If we haven't replied or deferred yet, try normal reply
    if (!interaction.deferred && !interaction.replied) {
      return await interaction.reply(payload);
    }
    
    // Otherwise try to edit the reply
    return await interaction.editReply(payload);

  } catch (error) {
    // Error code 50027 is "Invalid Webhook Token" (Common after 15 mins)
    // We also check for 401 status which is often the same issue
    if (error.code === 50027 || error.status === 401) {
      console.warn(`[DiscordUtils] Interaction expired (code: ${error.code}). Falling back to channel.send()`);
      
      try {
        // Send as a new message to the channel instead
        // Note: files and content keys are compatible between editReply and send
        return await interaction.channel.send(payload);
      } catch (sendError) {
        console.error("[DiscordUtils] Critical failure: Fallback channel.send also failed", sendError);
        throw sendError;
      }
    }

    // Re-throw other errors
    throw error;
  }
}

module.exports = { safeReply };
