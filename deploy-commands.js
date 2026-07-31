const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config');

const commands = [
  new SlashCommandBuilder()
    .setName('submit-badge')
    .setDescription('Submit a custom badge for review')
    .addAttachmentOption((opt) =>
      opt.setName('image').setDescription('Badge image (png/webp/jpg/gif, max 2MB)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Badge name (used to generate its ID)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('description').setDescription('Badge description / tooltip text').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('link').setDescription('Optional link when the badge is clicked').setRequired(false)
    ),
].map((c) => c.toJSON());

const rest = new REST({ version: '10' }).setToken(config.discordToken);

(async () => {
  try {
    if (config.guildId) {
      await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
      console.log('Registered guild commands.');
    } else {
      await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
      console.log('Registered global commands.');
    }
  } catch (err) {
    console.error(err);
  }
})();
