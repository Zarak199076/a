const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require('discord.js');
const crypto = require('crypto');
const config = require('./config');
const github = require('./github');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// In-memory only. Pending submissions are lost if the bot restarts before review.
const pendingBadges = new Map();

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);
}

function extFromContentType(contentType) {
  if (!contentType) return 'png';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  return 'png';
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'submit-badge') {
    return handleSubmit(interaction);
  }
  if (interaction.isButton() && interaction.customId.startsWith('badge_')) {
    return handleButton(interaction);
  }
});

async function handleSubmit(interaction) {
  const attachment = interaction.options.getAttachment('image', true);
  const name = interaction.options.getString('name', true);
  const description = interaction.options.getString('description', true);
  const link = interaction.options.getString('link') || undefined;

  if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
    return interaction.reply({ content: 'That attachment is not an image.', ephemeral: true });
  }
  if (attachment.size > config.maxImageBytes) {
    return interaction.reply({ content: 'Image must be under 2MB.', ephemeral: true });
  }

  const modChannel = await client.channels.fetch(config.modChannelId).catch(() => null);
  if (!modChannel) {
    return interaction.reply({ content: 'Mod channel is not configured correctly. Contact an admin.', ephemeral: true });
  }

  const submissionId = crypto.randomBytes(6).toString('hex');
  const badgeId = `${slugify(name)}-${submissionId.slice(0, 4)}`;

  pendingBadges.set(submissionId, {
    userId: interaction.user.id,
    badgeId,
    description,
    link,
    attachmentUrl: attachment.url,
    contentType: attachment.contentType,
  });

  const embed = new EmbedBuilder()
    .setTitle('New Badge Submission')
    .setThumbnail(attachment.url)
    .addFields(
      { name: 'Submitter', value: `<@${interaction.user.id}> (${interaction.user.id})` },
      { name: 'Badge ID', value: badgeId },
      { name: 'Description', value: description },
      { name: 'Link', value: link || 'None' }
    )
    .setColor(0x5865f2);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`badge_approve_${submissionId}`).setLabel('Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`badge_deny_${submissionId}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
  );

  await modChannel.send({ embeds: [embed], components: [row] });
  return interaction.reply({ content: 'Your badge was submitted for review.', ephemeral: true });
}

async function handleButton(interaction) {
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: 'You need Administrator permission to review badges.', ephemeral: true });
  }

  const [, action, submissionId] = interaction.customId.split('_');
  const submission = pendingBadges.get(submissionId);

  if (!submission) {
    return interaction.reply({
      content: 'This submission is no longer pending (bot restarted or already handled).',
      ephemeral: true,
    });
  }

  await interaction.deferUpdate();

  const disabledRow = new ActionRowBuilder().addComponents(
    ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
    ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true)
  );

  if (action === 'deny') {
    pendingBadges.delete(submissionId);
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0xed4245)
      .addFields({ name: 'Status', value: `Denied by <@${interaction.user.id}>` });
    await interaction.editReply({ embeds: [embed], components: [disabledRow] });
    return;
  }

  try {
    const res = await fetch(submission.attachmentUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = extFromContentType(submission.contentType);

    const iconUrl = await github.uploadBadgeImage(submission.badgeId, ext, buffer);
    await github.addBadgeToUser(submission.userId, {
      id: submission.badgeId,
      description: submission.description,
      icon: iconUrl,
      link: submission.link || '#',
    });

    pendingBadges.delete(submissionId);
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x57f287)
      .addFields({ name: 'Status', value: `Approved by <@${interaction.user.id}>` });
    await interaction.editReply({ embeds: [embed], components: [disabledRow] });
  } catch (err) {
    console.error('Badge approval failed:', err);
    await interaction.followUp({ content: 'Failed to publish badge to GitHub. Check bot logs.', ephemeral: true });
  }
}

client.login(config.discordToken);
