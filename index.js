const { Client, GatewayIntentBits, Events, ActivityType, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, AudioPlayerStatus } = require('@discordjs/voice');
const config = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

let connection;
let player;
let isPlaying = false;
let selectedStation = 'https://Qurango.net/radio/abdulrahman_alsudaes'; // المحطة الافتراضية
let cooldown = false; // لخاصية الـ cooldown

const stations = config.stations;

client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    connectToVoiceChannel(); // الاتصال بالقناة الصوتية عند بدء التشغيل

    // تسجيل أمر /setup
    const commands = [
        new SlashCommandBuilder()
            .setName('setup')
            .setDescription('تكوين القناة الصوتية للراديو')
    ];

    const rest = require('@discordjs/rest').REST;
    const { Routes } = require('discord-api-types/v9');
    const restClient = new rest({ version: '9' }).setToken(config.token);

    await restClient.put(Routes.applicationGuildCommands(client.user.id, config.guild_id), {
        body: commands,
    });

    console.log('أمر /setup تم تسجيله بنجاح!');
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isCommand()) {
        if (interaction.commandName === 'setup') {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select-station')
                .setPlaceholder('اختر محطة الراديو')
                .addOptions(
                    Object.keys(stations).map(stationKey => ({
                        label: stationKey.replace('_', ' '), // تحويل underscore إلى مسافة
                        value: stationKey,
                    }))
                );

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('اختر محطة الراديو')
                .setDescription('يرجى اختيار المحطة التي ترغب في تشغيلها.');

            const row = new ActionRowBuilder()
                .addComponents(selectMenu);

            await interaction.reply({ embeds: [embed], components: [row] });
        }
    } else if (interaction.isSelectMenu()) {
        if (interaction.customId === 'select-station') {
            if (cooldown) {
                await interaction.reply({ content: 'يرجى الانتظار دقيقة قبل تغيير المحطة مرة أخرى.', ephemeral: true });
                return;
            }

            const selected = interaction.values[0];
            selectedStation = stations[selected]; // تحديث المحطة المختارة

            if (isPlaying) {
                playRadio(); // إعادة تشغيل الراديو بالمحطة الجديدة
            }

            // إعادة تعريف selectMenu هنا
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select-station')
                .setPlaceholder('اختر محطة الراديو')
                .addOptions(
                    Object.keys(stations).map(stationKey => ({
                        label: stationKey.replace('_', ' '),
                        value: stationKey,
                    }))
                );

            await interaction.update({ content: `تم التبديل إلى المحطة: ${selected}`, components: [new ActionRowBuilder().addComponents(selectMenu)] });

            // تفعيل خاصية الـ cooldown
            cooldown = true;
            setTimeout(() => {
                cooldown = false;
            }, 60000); // دقيقة واحدة
        }
    }
});


function connectToVoiceChannel() {
    const voiceChannel = client.guilds.cache.get(config.guild_id)?.channels.cache.get(config.channel_id);

    if (!voiceChannel) {
        console.error('Canal vocal introuvable.');
        return;
    }

    connection = joinVoiceChannel({
        channelId: config.channel_id,
        guildId: config.guild_id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
        console.log('Le bot est connecté au canal vocal!');
        startRadio();
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
        console.log('Le bot a été déconnecté du canal vocal.');
        if (isPlaying) stopRadio();
    });
}

function startRadio() {
    if (connection) {
        player = createAudioPlayer();
        playRadio();

        player.on(AudioPlayerStatus.Idle, () => {
            playRadio();
        });

        player.on('error', (error) => {
            console.error('Erreur dans le lecteur audio:', error);
            stopRadio();
        });

        client.user.setPresence({
            activities: [{ name: 'Quran Radio', type: ActivityType.Listening }],
            status: 'dnd',
        });

        console.log('Radio is now playing.');
        isPlaying = true;
    }
}

function playRadio() {
    const resource = createAudioResource(selectedStation, { inlineVolume: true });
    player.play(resource);
    connection.subscribe(player);
}

function stopRadio() {
    if (player) {
        player.stop();
        client.user.setPresence({
            activities: [],
            status: 'online',
        });

        console.log('Stopped radio.');
        isPlaying = false;
    }
}

client.login(config.token);
