const {
  ActionRowBuilder,
  Client,
  Collection,
  ChannelType,
  GatewayIntentBits,
  InteractionType,
  ModalBuilder,
  Routes,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  ButtonBuilder,
  ButtonStyle,
  Embed,
  ActivityType,
  Integration,
  Message,
  AttachmentBuilder,
  time,
  ChannelSelectMenuBuilder,
  StringSelectMenuInteraction,
} = require("discord.js");
const fs = require("fs");
const { REST } = require("@discordjs/rest");
const { config } = require("dotenv");
config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.GuildPresences,
  ],
});
const cooldowns = new Map();
const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

const rolesData = require(`../config.json`);

const rolesAdmins = rolesData.adminsIDs;
const roleTxtmute = rolesData.txtmute;
const roleVoicemute = rolesData.voicemute;
const channelForMod = rolesData.channelForMod;
const roleBan = rolesData.banRoleId;
const adminsKH = rolesData.adminsKH;
const roleComment = rolesData.commentRoleId;
const roleCloseban = rolesData.closeRoleId;
const roleEventsban = rolesData.eventsRoleId;

const { actionCommand } = require("./commands.js");

const addRoleAndRemoveAfterDelay = async (guild, userId, roleId, durationInMillis) => {
  try {
    const member = await guild.members.fetch(userId);

    if (member) {
      const role = await guild.roles.fetch(roleId);
      if (role) {
        await member.roles.add(role);
        //console.log(`Роль добавлена пользователю ${userId}.\n время: ${durationInMillis}`);
        
        setTimeout(async () => {
          // Снимаем роль
          await member.roles.remove(role);
          //console.log(`Роль снята у пользователя ${userId} после ${durationInMillis} мс.`);
        }, durationInMillis);
      } else {
       // console.log(`Роль с ID ${roleId} не найдена.`);
      }
    } else {
      //console.log(`Пользователь с ID ${userId} не найден на сервере.`);
    }
  } catch (error) {
    console.error(`Ошибка при получении пользователя: ${error.message}`);
  }
};



function firstButtons(slctdUser, admin, isDisabled) {
  const buttonsAction1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`applyMute_${slctdUser}_${admin}`)
      .setLabel(`Выдать мут`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`removeMute_${slctdUser}_${admin}`)
      .setLabel(`Снять мут`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`applyBan_${slctdUser}_${admin}`)
      .setLabel(`Выдать бан`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isDisabled),
    new ButtonBuilder()
      .setCustomId(`removeBan_${slctdUser}_${admin}`)
      .setLabel(`Снять бан`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isDisabled),
  );
  const buttonsAction2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`comment_${slctdUser}_${admin}`)
      .setLabel(`Замечание`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(), //isDisabled
    new ButtonBuilder()
      .setCustomId(`giveTimeout_${slctdUser}_${admin}`)
      .setLabel(`Выдать отстранение`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(), //isDisabled
    new ButtonBuilder()
      .setCustomId(`removeTimeout_${slctdUser}_${admin}`)
      .setLabel(`Снять отстранение`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(), //isDisabled
    // new ButtonBuilder()
    //   .setCustomId(`giveWarn_${slctdUser}_${admin}`)
    //   .setLabel(`Выдать варн`)
    //   .setStyle(ButtonStyle.Secondary),
    // new ButtonBuilder()
    //   .setCustomId(`removeWarn_${slctdUser}_${admin}`)
    //   .setLabel(`Снять варн`)
    //   .setStyle(ButtonStyle.Secondary),
  );
  const buttonCancel = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cancel_${slctdUser}_${admin}`)
      .setLabel(`Отмена`)
      .setStyle(ButtonStyle.Danger)
  );
  return [buttonsAction1, buttonsAction2, buttonCancel];
}

// ЛОГИКА КОМАНДЫ /ACTION

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand() && !interaction.isButton() && !interaction.isModalSubmit()) return;
  if (!rolesAdmins.some((roleIdsAdm) => interaction.member.roles.cache.has(roleIdsAdm))) {
    if (!adminsKH.includes(interaction.user.id)){
      return await interaction
        .reply({
          content: "У вас нет прав для выполнения этой команды.",
          ephemeral: true,
        })
        .then((replyMessage) => setTimeout(() => replyMessage.delete(), 2_000));
    };
  };

  let isDisabledButtons = false;
  if (interaction.member.roles.cache.has(`1089523604565274746`)) { //вставь id роли модера (только мут, варн, кик)
    isDisabledButtons = true; //true
  };

  if (interaction.channel.id !== channelForMod) {
    if (!adminsKH.includes(interaction.user.id)){
      const embedWrongChannel = new EmbedBuilder()
      .setTitle('Ошибка')
      .setDescription(`Эту команду можно использовать только в этом канале  <#${channelForMod}>`)
      .setColor(`DarkRed`)

      return await interaction.reply({ embeds: [embedWrongChannel],  ephemeral: true});
    }
  };

  
  if (interaction.commandName === `action`) {
    const selectedUser = interaction.options.getUser("user").id;
    const msgTimeoutEmbed = new EmbedBuilder()
      .setTitle(`**${interaction.user.username} | Взаимодействие с участником**`)
      .setColor(`2B2D31`)
      .setThumbnail(`${interaction.user.avatarURL()}`)
      .setDescription(`**Время истекло**`);
    const msgAftrInteract = new EmbedBuilder()
      .setTitle(
        `**${interaction.user.username} | Взаимодействие с участником**`
      )
      .setColor(`2B2D31`)
      .setThumbnail(`${interaction.user.avatarURL()}`)
      .setFields(
        {
          name: `Модератор:`,
          value: `<@${interaction.user.id}>`,
          inline: true,
        },
        {
          name: `Пользователь:`,
          value: `<@${selectedUser}>`,
          inline: true,
        });
    await interaction.reply({
      embeds: [msgAftrInteract],
      components: firstButtons(selectedUser,interaction.user.id, isDisabledButtons),
    }).then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));
  };

  

  if (interaction.customId) {
    const cstmIdBtn = interaction.customId.split("_");
    //console.log(cstmIdBtn);
    const msgTimeoutEmbed = new EmbedBuilder()
      .setTitle(`**${interaction.user.username} | Взаимодействие с участником**`)
      .setColor(`2B2D31`)
      .setThumbnail(`${interaction.user.avatarURL()}`)
      .setDescription(`**Время истекло**`);

    if (interaction.user.id !== cstmIdBtn[2]){
      await interaction.reply({content: `**Вы не можете взаимодействовать с данными кнопками**`, ephemeral:true})
    }
    if (cstmIdBtn[0] === `back`) {
      await interaction.update({
        components: firstButtons(cstmIdBtn[1],cstmIdBtn[2], isDisabledButtons),
      }).then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));
    }
    if (cstmIdBtn[0] === `cancel`){
      const cancelEmbed = new EmbedBuilder()
      .setTitle(
        `**${interaction.user.username} | Взаимодействие с участником отменено**`
      )
      .setColor(`2B2D31`);
      await interaction.update({embeds: [cancelEmbed], components:[]});
    }

    // КНОПКА МУТ

    if (cstmIdBtn[0] === `applyMute`) {
      const aplyMuteButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`txtmute_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Текстовый мут`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`voicemute_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Голосовой мут`)
          .setStyle(ButtonStyle.Secondary),
      );
      const backButthon = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`back_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Назад`)
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.update({ components: [aplyMuteButton,backButthon] })
      .then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));
    }
    
    if (cstmIdBtn[0] === `txtmute`){
      const timeMute = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`txtmutetime_${cstmIdBtn[1]}_${cstmIdBtn[2]}_30`)
          .setLabel(`30 мин`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`txtmutetime_${cstmIdBtn[1]}_${cstmIdBtn[2]}_60`)
          .setLabel(`1 час`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`txtmutetime_${cstmIdBtn[1]}_${cstmIdBtn[2]}_120`)
          .setLabel(`2 часа`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`txtmutetime_${cstmIdBtn[1]}_${cstmIdBtn[2]}_180`)
          .setLabel(`3 часа`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`slctdTimetxtmute_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Указать своё`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(),
      );
      const backButthon = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`back_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Назад`)
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.update({ components: [timeMute,backButthon] })
      .then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));
    }

    // модальное окно причины выдачи тхт. мута
    if (cstmIdBtn[0] === `txtmutetime`) {
      const remtxtmodal = new ModalBuilder()
        .setCustomId(`mutetxtmodal_${cstmIdBtn[1]}_${cstmIdBtn[2]}_${cstmIdBtn[3]}`)
        .setTitle(`Причина выдачи текстового мута`);
      
      const reasontxtmute = new TextInputBuilder()
        .setCustomId(`reasonmutetxt`)
        .setLabel(`Введите причину выдачи текстового мута`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Причина`);

      const firstActionRow = new ActionRowBuilder().addComponents(reasontxtmute);

      remtxtmodal.addComponents(firstActionRow);
      
      await interaction.showModal(remtxtmodal);      
    };
    if (interaction.isModalSubmit() && interaction.customId.startsWith(`mutetxtmodal`)) {
      const guild = client.guilds.cache.get(GUILD_ID);
      await addRoleAndRemoveAfterDelay(guild, cstmIdBtn[1], roleTxtmute, +cstmIdBtn[3]*60000); //

      const reason = interaction.fields.getTextInputValue('reasonmutetxt');
      
      const mssgAftermute = new EmbedBuilder()
      .setTitle(`**${interaction.user.username} | Выдал текстовый мут**`)
      .setColor(`DarkRed`)
      .setThumbnail(`${interaction.user.avatarURL()}`)
      .setFields(
        {
          name: `Модератор:`,
          value: `<@${cstmIdBtn[2]}>`,
          inline: true,
        },
        {
          name: `Пользователь:`,
          value: `<@${cstmIdBtn[1]}>`,
          inline: true,
        },
        {
          name: `Длительность:`,
          value: "```" + cstmIdBtn[3] + "ㅤминут ```",
          inline: true,
        },
        {
        name: `Причина выдачи текстового мута:`,
        value: "```" + reason +"```"
      });
      
      await interaction.update({components: [], embeds: [mssgAftermute]});

      const mutedUser = await client.users.fetch(cstmIdBtn[1]);
      const mutedEmbed = new EmbedBuilder()
        .setTitle(`**Вам выдали текстовый мут на сервере: ${interaction.guild.name}**`)
        .setColor("DarkRed")
        .setThumbnail(`${interaction.user.avatarURL()}`)
        .setFields(
          {
            name: `Модератор:`,
            value: `<@${cstmIdBtn[2]}>`,
            inline: true,
          },
          {
            name: `Длительность:`,
            value: "```" + cstmIdBtn[3] + "ㅤминут ```",
            inline: true,
          },
          {
          name: `Причина мута:`,
          value: "```" + reason +"```"
        });
        
      await mutedUser.send({ embeds: [mutedEmbed]});
    }
    
    // голосовой мут кнопки
    if (cstmIdBtn[0] === `voicemute`){
      const timeMute = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`voicemutetime_${cstmIdBtn[1]}_${cstmIdBtn[2]}_30`)
          .setLabel(`30 мин`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`voicemutetime_${cstmIdBtn[1]}_${cstmIdBtn[2]}_60`)
          .setLabel(`1 час`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`voicemutetime_${cstmIdBtn[1]}_${cstmIdBtn[2]}_120`)
          .setLabel(`2 часа`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`voicemutetime_${cstmIdBtn[1]}_${cstmIdBtn[2]}_180`)
          .setLabel(`3 часа`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`slctdTimevoicemute_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Указать своё`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(),
      );
      const backButthon = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`back_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Назад`)
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.update({ components: [timeMute,backButthon] })
      .then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));
    }

    // модальное окно причины выдачи гол. мута
    if (cstmIdBtn[0] === `voicemutetime`) {
      const remvoicemodal = new ModalBuilder()
        .setCustomId(`voicemutemodal_${cstmIdBtn[1]}_${cstmIdBtn[2]}_${cstmIdBtn[3]}`)
        .setTitle(`Причина выдачи голосового мута`);
      
      const reasonvoicemute = new TextInputBuilder()
        .setCustomId(`reasonmutevoice`)
        .setLabel(`Введите причину выдачи голосового мута`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Причина`);

      const firstActionRow = new ActionRowBuilder().addComponents(reasonvoicemute);

      remvoicemodal.addComponents(firstActionRow);
      
      await interaction.showModal(remvoicemodal);      
    };
    if (interaction.isModalSubmit() && interaction.customId.startsWith(`voicemutemodal`)) {
      const guild = client.guilds.cache.get(GUILD_ID);
      await addRoleAndRemoveAfterDelay(guild, cstmIdBtn[1], roleVoicemute, +cstmIdBtn[3]*60000); //

      const reason = interaction.fields.getTextInputValue('reasonmutevoice');
      
      const mssgAftermute = new EmbedBuilder()
      .setTitle(`**${interaction.user.username} | Выдал голосовой мут**`)
      .setColor(`DarkRed`)
      .setThumbnail(`${interaction.user.avatarURL()}`)
      .setFields(
        {
          name: `Модератор:`,
          value: `<@${cstmIdBtn[2]}>`,
          inline: true,
        },
        {
          name: `Пользователь:`,
          value: `<@${cstmIdBtn[1]}>`,
          inline: true,
        },
        {
          name: `Длительность:`,
          value: "```" + cstmIdBtn[3] + "ㅤминут ```",
          inline: true,
        },
        {
        name: `Причина выдачи голосового мута:`,
        value: "```" + reason +"```"
      });
      
      await interaction.update({components: [], embeds: [mssgAftermute]});

      const mutedUser = await client.users.fetch(cstmIdBtn[1]);
      const mutedEmbed = new EmbedBuilder()
        .setTitle(`**Вам выдали голосовой мут на сервере: ${interaction.guild.name}**`)
        .setColor("DarkRed")
        .setThumbnail(`${interaction.user.avatarURL()}`)
        .setFields(
          {
            name: `Модератор:`,
            value: `<@${cstmIdBtn[2]}>`,
            inline: true,
          },
          {
            name: `Длительность:`,
            value: "```" + cstmIdBtn[3] + "ㅤминут ```",
            inline: true,
          },
          {
          name: `Причина мута`,
          value: "```" + reason +"```"
        });
      await mutedUser.send({ embeds: [mutedEmbed]});
    }

    if (cstmIdBtn[0] === `removeMute`) {
      const removeMuteButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`removeTxtmute_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Снять текстовый мут`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`removeVoicemute_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Снять голосовой мут`)
          .setStyle(ButtonStyle.Secondary),
      );
      
      const backButthon = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`back_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Назад`)
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.update({ components: [removeMuteButton,backButthon] })
      .then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));
    }

    // модальное окно причины снятия тхт. мута
    if (cstmIdBtn[0] === `removeTxtmute`) {
      
      const remtxtmodal = new ModalBuilder()
        .setCustomId(`unmutetxtmodal_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
        .setTitle(`Причина снятия мута`);
      
      const reasontxtunmute = new TextInputBuilder()
      .setCustomId(`reasonunmutetxt`)
      .setLabel(`Введите причину снятия текстового мута`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`Причина`);

      const firstActionRow = new ActionRowBuilder().addComponents(reasontxtunmute);

      remtxtmodal.addComponents(firstActionRow);
      
      await interaction.showModal(remtxtmodal);
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith(`unmutetxtmodal`)) { // 
      const reason = interaction.fields.getTextInputValue('reasonunmutetxt');
      
      const embedunmute = new EmbedBuilder()
        .setTitle(`**${interaction.user.username} | Снял текстовый мут**`)
        .setColor(`Green`)
        .setThumbnail(`${interaction.user.avatarURL()}`)
        .setFields(
          {
            name: `Модератор:`,
            value: `<@${cstmIdBtn[2]}>`,
            inline: true,
          },
          {
            name: `Пользователь:`,
            value: `<@${cstmIdBtn[1]}>`,
            inline: true,
          },
          {
          name: `Причина снятия текстового мута:`,
          value: "```" + reason +"```"
        });
      const guild = client.guilds.cache.get(GUILD_ID);
      const member = await guild.members.fetch(cstmIdBtn[1]);
      const role = await guild.roles.fetch(roleTxtmute);
      await member.roles.remove(role);
      await interaction.update({
        embeds: [embedunmute],
        components: [],})
      .then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));

      const mutedUser = await client.users.fetch(cstmIdBtn[1]);
      const mutedEmbed = new EmbedBuilder()
        .setTitle(`**Вам сняли текстовый мут на сервере: ${interaction.guild.name}**`)
        .setColor("Green")
        .setThumbnail(`${interaction.user.avatarURL()}`)
        .setFields(
          {
            name: `Модератор:`,
            value: `<@${cstmIdBtn[2]}>`,
            inline: true,
          },
          {
          name: `Причина снятия мута`,
          value: "```" + reason +"```"
        });
      await mutedUser.send({ embeds: [mutedEmbed]});
    }
    
    // модальное окно причины снятия гол. мута
    if (cstmIdBtn[0] === `removeVoicemute`) {
      const remvoicemodal = new ModalBuilder()
      .setCustomId(`unmutevoicemodal_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
      .setTitle(`Причина снятия мута`);
      
      const reasonvoiceunmute = new TextInputBuilder()
      .setCustomId(`reasonunmutevoice`)
      .setLabel(`Введите причину снятия голосового мута`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`Причина`);

      const firstActionRow = new ActionRowBuilder().addComponents(reasonvoiceunmute);

      remvoicemodal.addComponents(firstActionRow);

      await interaction.showModal(remvoicemodal);

    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith(`unmutevoicemodal`)) { // 
      const reason = interaction.fields.getTextInputValue('reasonunmutevoice');
      
      const embedunmute = new EmbedBuilder()
        .setTitle(`**${interaction.user.username} | Снял голосовой мут**`)
        .setColor(`Green`)
        .setThumbnail(`${interaction.user.avatarURL()}`)
        .setFields(
          {
            name: `Модератор:`,
            value: `<@${cstmIdBtn[2]}>`,
            inline: true,
          },
          {
            name: `Пользователь:`,
            value: `<@${cstmIdBtn[1]}>`,
            inline: true,
          },
          {
            name: `Причина снятия голосового мута`,
            value: "```"+reason+"```"
          });
      const guild = client.guilds.cache.get(GUILD_ID);
      const member = await guild.members.fetch(cstmIdBtn[1]);
      const role = await guild.roles.fetch(roleVoicemute);
      await member.roles.remove(role);
      await interaction.update({
        embeds: [embedunmute],
        components: [],
      });

      const mutedUser = await client.users.fetch(cstmIdBtn[1]);
      const mutedEmbed = new EmbedBuilder()
        .setTitle(`**Вам сняли голосовой мут на сервере: ${interaction.guild.name}**`)
        .setColor("Green")
        .setThumbnail(`${interaction.user.avatarURL()}`)
        .setFields(
          {
            name: `Модератор:`,
            value: `<@${cstmIdBtn[2]}>`,
            inline: true,
          },
          {
          name: `Причина снятия мута`,
          value: "```" + reason + "```"
        });
      await mutedUser.send({ embeds: [mutedEmbed]});

    }


    // Кнопка бана
    if (cstmIdBtn[0] === `applyBan`){
      const timeBan = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`bantime_${cstmIdBtn[1]}_${cstmIdBtn[2]}_10080`)
          .setLabel(`7 дней`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`bantime_${cstmIdBtn[1]}_${cstmIdBtn[2]}_20160`)
          .setLabel(`14 дней`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`bantime_${cstmIdBtn[1]}_${cstmIdBtn[2]}_34560`)
          .setLabel(`24 дня`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`foreverbanmute_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Навсегда`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(),
        new ButtonBuilder()
          .setCustomId(`slctdTimebanmute_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Указать своё`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(),
      );
      const backButthon = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`back_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Назад`)
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.update({ components: [timeBan,backButthon] })
      .then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));
    }


    // модальное окно причины выдачи бана
    if (cstmIdBtn[0] === `bantime`) {
      const rembanmodal = new ModalBuilder()
        .setCustomId(`bantimemodal_${cstmIdBtn[1]}_${cstmIdBtn[2]}_${cstmIdBtn[3]}`)
        .setTitle(`Причина выдачи бана`);
      
      const reasonban = new TextInputBuilder()
        .setCustomId(`reasonban`)
        .setLabel(`Введите причину выдачи бана`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Причина`);

      const firstActionRow = new ActionRowBuilder().addComponents(reasonban);

      rembanmodal.addComponents(firstActionRow);
      
      await interaction.showModal(rembanmodal);
    };
    if (interaction.isModalSubmit() && interaction.customId.startsWith(`bantimemodal`)) {
      const guild = client.guilds.cache.get(GUILD_ID);
      const member = await guild.members.fetch(cstmIdBtn[1]);
      await member.roles.set([]);
      await addRoleAndRemoveAfterDelay(guild, cstmIdBtn[1], roleBan, +cstmIdBtn[3]*60000); //изменить roleTxtmute на роль для бана

      const reason = interaction.fields.getTextInputValue('reasonban');
      
      const mssgAftermute = new EmbedBuilder()
      .setTitle(`**${interaction.user.username} | Выдал бан**`)
      .setColor(`DarkRed`)
      .setThumbnail(`${interaction.user.avatarURL()}`)
      .setFields(
        {
          name: `Модератор:`,
          value: `<@${cstmIdBtn[2]}>`,
          inline: true,
        },
        {
          name: `Пользователь:`,
          value: `<@${cstmIdBtn[1]}>`,
          inline: true,
        },
        {
          name: `Длительность:`,
          value: "```" + cstmIdBtn[3]/1440 + "ㅤдней```",
          inline: true,
        },
        {
        name: `Причина выдачи бана:`,
        value: "```" + reason +"```"
      });
      
      await interaction.update({components: [], embeds: [mssgAftermute]});

      const bannedUser = await client.users.fetch(cstmIdBtn[1]);
      const bannedEmbed = new EmbedBuilder()
        .setTitle(`**Вам выдали бан на сервере: ${interaction.guild.name}**`)
        .setColor("DarkRed")
        .setThumbnail(`${interaction.user.avatarURL()}`)
        .setFields(
          {
            name: `Модератор:`,
            value: `<@${cstmIdBtn[2]}>`,
            inline: true,
          },
          {
            name: `Длительность:`,
            value: "```" + cstmIdBtn[3]/1440 + "ㅤдней```",
            inline: true,
          },
          {
          name: `Причина бана`,
          value: "```" + reason +"```"
        });
      await bannedUser.send({ embeds: [bannedEmbed]});
    }

    // модальное окно причины снятия бана
    if (cstmIdBtn[0] === `removeBan`) {

      const unbanmodal = new ModalBuilder()
      .setCustomId(`unbanmodal_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
      .setTitle(`Причина снятия бана`);
      
      const reasonunban = new TextInputBuilder()
      .setCustomId(`reasonunban`)
      .setLabel(`Введите причину снятия бана`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`Причина`);

      const firstActionRow = new ActionRowBuilder().addComponents(reasonunban);

      unbanmodal.addComponents(firstActionRow);

      await interaction.showModal(unbanmodal);

    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith(`unbanmodal`)) { // 
      const reason = interaction.fields.getTextInputValue('reasonunban');
      
      const embedunban = new EmbedBuilder()
        .setTitle(`**${interaction.user.username} | Снял бан**`)
        .setColor(`Green`)
        .setThumbnail(`${interaction.user.avatarURL()}`)
        .setFields(
          {
            name: `Модератор:`,
            value: `<@${cstmIdBtn[2]}>`,
            inline: true,
          },
          {
            name: `Пользователь:`,
            value: `<@${cstmIdBtn[1]}>`,
            inline: true,
          },
          {
          name: `Причина снятия бана:`,
          value: "```"+reason+"```"
          });
      const guild = client.guilds.cache.get(GUILD_ID);
      const member = await guild.members.fetch(cstmIdBtn[1]);
      const role = await guild.roles.fetch(roleBan);
      await member.roles.remove(role);
      await interaction.update({
        embeds: [embedunban],
        components: [],
      });

      
      const unbannedUser = await client.users.fetch(cstmIdBtn[1]);
      const unbannedEmbed = new EmbedBuilder()
        .setTitle(`**Вам сняли бан на сервере: ${interaction.guild.name}**`)
        .setColor("Green")
        .setThumbnail(`${interaction.user.avatarURL()}`)
        .setFields(
          {
            name: `Модератор:`,
            value: `<@${cstmIdBtn[2]}>`,
            inline: true,
          },
          {
          name: `Причина снятия бана`,
          value: "```" + reason +"```"
        });
      await unbannedUser.send({ embeds: [unbannedEmbed]});
    }
      

    // Кнопка замечание
    if (cstmIdBtn[0] === `comment`){
      const reasonRemoveComment = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`SendReasonComment_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Причина предупреждения`)
          .setStyle(ButtonStyle.Secondary),
      );
      const backButthon = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`back_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Назад`)
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.update({ components: [reasonRemoveComment,backButthon] })
      .then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));
    }

    // Выдать отстранение
    if (cstmIdBtn[0] === `giveTimeout`) {
      const TimeoutsButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`timeoutCloses_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Отстранение от клозов`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`timeoutEvents_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Отстранение от ивентов`)
          .setStyle(ButtonStyle.Secondary),
      );
      const backButthon = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`back_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Назад`)
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.update({ components: [TimeoutsButton,backButthon] })
      .then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));
    }
    if (cstmIdBtn[0] === `timeoutCloses`){
      const timeCloses = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`2hTimeoutCloses_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`2 часа`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`4hTimeoutCloses_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`4 часа`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`1dTimeoutCloses_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`1 день`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`foreverTimeoutCloses${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Навсегда`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`slctdTimeoutCloses_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Указать своё`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(),
      );
      const backButthon = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`back_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Назад`)
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.update({ components: [timeCloses,backButthon] })
      .then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));
    }
    if (cstmIdBtn[0] === `removeTimeout`) {
      const TimeoutsButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`removetimeoutCloses_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Отстранение от клозов`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`removetimeoutEvents_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Отстранение от ивентов`)
          .setStyle(ButtonStyle.Secondary),
      );
      const backButthon = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`back_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Назад`)
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.update({ components: [TimeoutsButton,backButthon] })
      .then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));
    }
    if (cstmIdBtn[0] === `removetimeoutCloses`){
      const reasonWarn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`reasonRemoveTimeoutCloses_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Причина снятия`)
          .setStyle(ButtonStyle.Secondary)
      );
      const backButthon = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`back_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Назад`)
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.update({ components: [reasonWarn,backButthon] })
      .then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));
    }
    if (cstmIdBtn[0] === `removetimeoutEvents`){
      const reasonWarn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`reasonRemoveTimeoutEvents_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Причина снятия`)
          .setStyle(ButtonStyle.Secondary)
      );
      const backButthon = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`back_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
          .setLabel(`Назад`)
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.update({ components: [reasonWarn,backButthon] })
      .then((replyMessage) => setTimeout(() => replyMessage.edit({embeds: [msgTimeoutEmbed], components:[]}), 120_000));
    }

    // // Кнопка варн
    // if (cstmIdBtn[0] === `giveWarn`){
    //   const reasonWarn = new ActionRowBuilder().addComponents(
    //     new ButtonBuilder()
    //       .setCustomId(`reasonWarn_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
    //       .setLabel(`Причина выдачи варна`)
    //       .setStyle(ButtonStyle.Secondary)
    //   );
    //   const backButthon = new ActionRowBuilder().addComponents(
    //     new ButtonBuilder()
    //       .setCustomId(`back_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
    //       .setLabel(`Назад`)
    //       .setStyle(ButtonStyle.Danger)
    //   );
    //   await interaction.update({ components: [reasonWarn,backButthon] })
    //  .then((replyMessage) => setTimeout(() => replyMessage.edit({components:[]}), 120_000));
    // }
    // if (cstmIdBtn[0] === `removeWarn`){
    //   const reasonWarn = new ActionRowBuilder().addComponents(
    //     new ButtonBuilder()
    //       .setCustomId(`reasonRemoveWarn_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
    //       .setLabel(`Причина снятия варна`)
    //       .setStyle(ButtonStyle.Secondary)
    //   );
    //   const backButthon = new ActionRowBuilder().addComponents(
    //     new ButtonBuilder()
    //       .setCustomId(`back_${cstmIdBtn[1]}_${cstmIdBtn[2]}`)
    //       .setLabel(`Назад`)
    //       .setStyle(ButtonStyle.Danger)
    //   );
    //   await interaction.update({ components: [reasonWarn,backButthon] })
    //  .then((replyMessage) => setTimeout(() => replyMessage.edit({components:[]}), 120_000));
    // }

  }
  
});



client.on("error", console.error);
client.on("ready", () =>
  console.log("\x1b[31m%s\x1b[0m", `Bot -> [${client.user.tag}] ready!`)
);

async function main() {
  const Commands = [actionCommand];
  try {
    console.log("Bot is starting");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: Commands,
    });
    client.login(BOT_TOKEN);
  } catch (err) {
    console.log(err);
  }
};

main();
