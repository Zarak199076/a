require('dotenv').config();

module.exports = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  githubToken: process.env.GITHUB_TOKEN,
  githubOwner: process.env.GITHUB_OWNER,
  githubRepo: process.env.GITHUB_REPO,
  githubBranch: process.env.GITHUB_BRANCH || 'main',
  modChannelId: process.env.MOD_CHANNEL_ID,
  badgesJsonPath: process.env.BADGES_JSON_PATH || 'badges.json',
  badgesImageDir: process.env.BADGES_IMAGE_DIR || 'badges',
  maxImageBytes: 2 * 1024 * 1024,
};
