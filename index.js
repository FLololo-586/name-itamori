const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

// ---- Stockage en mémoire des rôles et préfixes ----
// Format : { roleId: prefix }
const rolePrefixes = {};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// --- Déclare les commandes ---
const commands = [
    new SlashCommandBuilder()
        .setName('name')
        .setDescription('Ajoute un préfixe pour tous les membres ayant un rôle')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Le rôle à modifier')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('prefix')
                .setDescription('Le texte à mettre avant le pseudo')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
        .toJSON(),

    new SlashCommandBuilder()
        .setName('refresh')
        .setDescription('Met à jour les pseudos pour tous les rôles configurés')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
        .toJSON()
];

// --- Enregistre les commandes globales ---
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('📦 Enregistrement des commandes...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('✅ Commandes enregistrées !');
    } catch (error) {
        console.error(error);
    }
})();

// --- Fonction pour mettre à jour un membre ---
async function updateMemberNickname(member, prefix) {
    const baseName = member.displayName; // Pseudo affiché
    if (!baseName.startsWith(prefix + " |")) {
        try {
            await member.setNickname(`${prefix} | ${baseName}`);
            console.log(`✅ Modifié : ${member.user.tag}`);
        } catch (err) {
            console.error(`❌ Impossible de modifier ${member.user.tag}:`, err);
        }
    }
}

// --- Commandes ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'name') {
        const role = interaction.options.getRole('role');
        const prefix = interaction.options.getString('prefix');

        rolePrefixes[role.id] = prefix; // Sauvegarde en mémoire

        await interaction.deferReply({ ephemeral: true });

        const members = role.members;
        let success = 0;
        for (const member of members.values()) {
            await updateMemberNickname(member, prefix);
            success++;
        }

        await interaction.editReply(`✅ Préfixe "**${prefix}**" appliqué à ${success} membres avec le rôle **${role.name}**`);
    }

    if (interaction.commandName === 'refresh') {
        await interaction.deferReply({ ephemeral: true });
        let total = 0;

        for (const [roleId, prefix] of Object.entries(rolePrefixes)) {
            const role = interaction.guild.roles.cache.get(roleId);
            if (!role) continue;
            for (const member of role.members.values()) {
                await updateMemberNickname(member, prefix);
                total++;
            }
        }

        await interaction.editReply(`🔄 Mise à jour terminée. ${total} pseudos vérifiés.`);
    }
});

// --- Événement : quand un membre reçoit un rôle ---
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    for (const [roleId, prefix] of Object.entries(rolePrefixes)) {
        if (!oldMember.roles.cache.has(roleId) && newMember.roles.cache.has(roleId)) {
            await updateMemberNickname(newMember, prefix);
        }
    }
});

client.once('ready', () => {
    console.log(`🤖 Connecté en tant que ${client.user.tag}`);
});

client.login(process.env.TOKEN);