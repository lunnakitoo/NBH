const {
  Client, GatewayIntentBits, Collection, ActivityType,
  ChannelType, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  REST, Routes, SlashCommandBuilder,
} = require('discord.js');
require('dotenv').config();

// ══════════════════════════════════════════════════════════
//  CONFIG — modifie ici si besoin
// ══════════════════════════════════════════════════════════
const COLOR = parseInt(process.env.EMBED_COLOR || '5865F2', 16);

// ══════════════════════════════════════════════════════════
//  TEXTES BILINGUES
// ══════════════════════════════════════════════════════════
const LANG = {
  en: {
    flag: '🇬🇧',
    welcomeTitle: '🎫 Support Ticket',
    welcomeDesc: 'Welcome! Please select the reason below.\nA staff member will assist you shortly.',
    reasonPlaceholder: 'Choose a reason…',
    reasons: [
      { label: '🐛 Bug Report',       value: 'bug',        description: 'Report a bug or technical issue' },
      { label: '💡 Suggestion',        value: 'suggestion', description: 'Submit a suggestion or idea' },
      { label: '🛒 Purchase Issue',    value: 'purchase',   description: 'Problem with a purchase' },
      { label: '🚨 Report a User',     value: 'report',     description: 'Report a problematic user' },
      { label: '❓ Other',             value: 'other',      description: 'Any other request' },
    ],
    reasonConfirm: (r) => `✅ Reason: **${r}** — our team will be with you shortly.`,
    closeBtn: '🔒 Close Ticket',
    closeTitle: '⚠️ Close this ticket?',
    closeDesc: 'Are you sure? This cannot be undone.',
    confirmBtn: '✅ Confirm', cancelBtn: '❌ Cancel',
    closedDesc: (u) => `Ticket closed by ${u}.`,
    alreadyOpen: (ch) => `❌ You already have an open ticket: ${ch}`,
    noPerms: '❌ Missing permissions to create a ticket channel.',
  },
  fr: {
    flag: '🇫🇷',
    welcomeTitle: '🎫 Ticket Support',
    welcomeDesc: 'Bienvenue ! Sélectionne la raison ci-dessous.\nUn membre du staff arrive très vite.',
    reasonPlaceholder: 'Choisis une raison…',
    reasons: [
      { label: '🐛 Signaler un bug',          value: 'bug',        description: 'Bug ou problème technique' },
      { label: '💡 Suggestion',                value: 'suggestion', description: 'Idée ou suggestion' },
      { label: '🛒 Problème d\'achat',         value: 'purchase',   description: 'Problème lié à un achat' },
      { label: '🚨 Signaler un utilisateur',   value: 'report',     description: 'Utilisateur problématique' },
      { label: '❓ Autre',                     value: 'other',      description: 'Toute autre demande' },
    ],
    reasonConfirm: (r) => `✅ Raison : **${r}** — notre équipe arrive !`,
    closeBtn: '🔒 Fermer le ticket',
    closeTitle: '⚠️ Fermer ce ticket ?',
    closeDesc: 'Es-tu sûr(e) ? Cette action est irréversible.',
    confirmBtn: '✅ Confirmer', cancelBtn: '❌ Annuler',
    closedDesc: (u) => `Ticket fermé par ${u}.`,
    alreadyOpen: (ch) => `❌ Tu as déjà un ticket ouvert : ${ch}`,
    noPerms: '❌ Permissions insuffisantes pour créer le salon.',
  },
};

// ══════════════════════════════════════════════════════════
//  ÉTAT (tickets ouverts)
// ══════════════════════════════════════════════════════════
const openTickets = new Map(); // userId → channelId

// ══════════════════════════════════════════════════════════
//  CLIENT
// ══════════════════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// ══════════════════════════════════════════════════════════
//  READY
// ══════════════════════════════════════════════════════════
client.once('clientReady', async (readyClient) => {
  console.log(`✅ Connecté en tant que ${readyClient.user.tag}`);

  // ── Avatar GIF ──────────────────────────────────────────
  // Place ton fichier dans assets/avatar.gif puis décommente :
  // await client.user.setAvatar('./assets/avatar.gif');

  // ── Bannière GIF (bot vérifié requis) ───────────────────
  // Place ton fichier dans assets/banner.gif puis décommente :
  // await client.user.setBanner('./assets/banner.gif'); // Décommente si bot vérifié + fichier présent

  // ── Statuts rotatifs ────────────────────────────────────
  const statuses = [
    { name: '🎫 Ticket Support', type: ActivityType.Watching },
    { name: '🇫🇷 FR | 🇬🇧 EN', type: ActivityType.Playing },
    { name: '/setup-tickets', type: ActivityType.Listening },
  ];
  let i = 0;
  const next = () => {
    const s = statuses[i++ % statuses.length];
    readyClient.user.setPresence({ activities: [s], status: 'online' });
  };
  next();
  setInterval(next, 10_000);

  // ── Deploy slash commands au démarrage ──────────────────
  const commands = [
    new SlashCommandBuilder()
      .setName('setup-tickets')
      .setDescription('Envoie le panel de tickets dans ce salon.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
  ];
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  if (!process.env.CLIENT_ID) throw new Error('CLIENT_ID manquant dans .env !');
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log('✅ Slash commands déployées');
});

// ══════════════════════════════════════════════════════════
//  INTERACTIONS
// ══════════════════════════════════════════════════════════
client.on('interactionCreate', async (interaction) => {

  // /setup-tickets
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup-tickets') {
    const embed = new EmbedBuilder()
      .setTitle('🎫 Support — Tickets')
      .setDescription(
        '**🇬🇧 English Support**\nClick the button below to open an English support ticket.\n\n' +
        '**🇫🇷 Support Français**\nClique sur le bouton ci-dessous pour ouvrir un ticket en français.'
      )
      .addFields({ name: '📋 Info', value: '• Un ticket à la fois / One ticket at a time\n• Sois respectueux / Be respectful' })
      .setColor(COLOR)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_open_en').setLabel('🇬🇧 Open a Ticket').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_open_fr').setLabel('🇫🇷 Ouvrir un Ticket').setStyle(ButtonStyle.Success),
    );
    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Panel envoyé !', ephemeral: true });
    return;
  }

  // Boutons ouvrir ticket
  if (interaction.isButton() && (interaction.customId === 'ticket_open_en' || interaction.customId === 'ticket_open_fr')) {
    const lang = interaction.customId === 'ticket_open_en' ? 'en' : 'fr';
    const t = LANG[lang];
    const { guild, member } = interaction;
    await interaction.deferReply({ ephemeral: true });

    // Déjà un ticket ?
    if (openTickets.has(member.id)) {
      const existing = guild.channels.cache.get(openTickets.get(member.id));
      if (existing) return interaction.editReply({ content: t.alreadyOpen(existing) });
      openTickets.delete(member.id);
    }

    // Permissions salon
    const perms = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
    ];
    if (process.env.SUPPORT_ROLE_ID) {
      perms.push({ id: process.env.SUPPORT_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] });
    }

    let ch;
    try {
      ch = await guild.channels.create({
        name: `ticket-${lang}-${member.user.username}`,
        type: ChannelType.GuildText,
        parent: process.env.TICKET_CATEGORY_ID || null,
        permissionOverwrites: perms,
        topic: `${lang.toUpperCase()} | ${member.user.tag}`,
      });
    } catch { return interaction.editReply({ content: t.noPerms }); }

    openTickets.set(member.id, ch.id);

    const embed = new EmbedBuilder()
      .setTitle(t.welcomeTitle)
      .setDescription(t.welcomeDesc)
      .setColor(COLOR)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 User', value: `${member}`, inline: true },
        { name: t.flag + ' Langue', value: lang === 'en' ? 'English' : 'Français', inline: true },
        { name: '📅 Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      )
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`reason_${lang}_${member.id}`)
      .setPlaceholder(t.reasonPlaceholder)
      .addOptions(t.reasons.map(r => new StringSelectMenuOptionBuilder().setLabel(r.label).setValue(r.value).setDescription(r.description)));

    const closeBtn = new ButtonBuilder().setCustomId('ticket_close').setLabel(t.closeBtn).setStyle(ButtonStyle.Danger);

    await ch.send({
      content: process.env.SUPPORT_ROLE_ID ? `<@&${process.env.SUPPORT_ROLE_ID}> ${member}` : `${member}`,
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(closeBtn)],
    });

    await interaction.editReply({ content: `✅ Ticket créé : ${ch}` });
    return;
  }

  // Select menu raison
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('reason_')) {
    const lang = interaction.customId.split('_')[1];
    const t = LANG[lang] || LANG.fr;
    const reason = t.reasons.find(r => r.value === interaction.values[0]);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(t.reasonConfirm(reason?.label ?? interaction.values[0])).setColor(0x57f287)] });
    try { await interaction.channel.setName(`ticket-${lang}-${interaction.values[0]}-${interaction.user.username}`); } catch {}
    return;
  }

  // Bouton fermer ticket
  if (interaction.isButton() && interaction.customId === 'ticket_close') {
    const lang = (interaction.channel.topic || '').startsWith('EN') ? 'en' : 'fr';
    const t = LANG[lang];
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel(t.confirmBtn).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel(t.cancelBtn).setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle(t.closeTitle).setDescription(t.closeDesc).setColor(0xed4245)], components: [row], ephemeral: true });
    return;
  }

  // Annuler fermeture
  if (interaction.isButton() && interaction.customId === 'ticket_close_cancel') {
    await interaction.reply({ content: '❌ Fermeture annulée.', ephemeral: true });
    return;
  }

  // Confirmer fermeture
  if (interaction.isButton() && interaction.customId === 'ticket_close_confirm') {
    const lang = (interaction.channel.topic || '').startsWith('EN') ? 'en' : 'fr';
    const t = LANG[lang];
    for (const [uid, cid] of openTickets) { if (cid === interaction.channel.id) { openTickets.delete(uid); break; } }
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`🔒 ${t.closedDesc(interaction.user)}`).setColor(0xed4245).setTimestamp()] });
    // Log
    if (process.env.LOG_CHANNEL_ID) {
      const logCh = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
      logCh?.send({ embeds: [new EmbedBuilder().setDescription(`🔒 Ticket fermé par ${interaction.user} — <#${interaction.channel.id}>`).setColor(0x5865f2).setTimestamp()] });
    }
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }
});

// ══════════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════════
client.login(process.env.TOKEN);
