const { Events, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const Canvas = require('canvas');
const { welcomeSettings } = require('../utils/database');

// Función para registrar fuentes (si las tuvieras en una carpeta 'fonts')
// Canvas.registerFont('./fonts/Roboto-Bold.ttf', { family: 'Roboto Bold' });
// Canvas.registerFont('./fonts/Roboto-Regular.ttf', { family: 'Roboto' });

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    // 1. Obtener configuración
    const ws = await welcomeSettings.get(member.guild.id);
    if (!ws || !ws.goodbye_enabled || !ws.goodbye_channel) return;

    // 2. Obtener canal y verificar permisos
    const channel = member.guild.channels.cache.get(ws.goodbye_channel);
    if (!channel || !channel.isTextBased()) return;

    const permissions = channel.permissionsFor(member.guild.members.me);
    if (!permissions.has(['ViewChannel', 'SendMessages', 'AttachFiles', 'EmbedLinks'])) {
      console.error(`[Goodbye Error] Faltan permisos en el canal ${channel.id} para enviar despedidas.`);
      return;
    }

    try {
      // 3. Crear el Canvas (Lienzo) - Tamaño estándar de banner
      const canvas = Canvas.createCanvas(700, 250);
      const ctx = canvas.getContext('2d');

      // --- FONDO ---
      ctx.fillStyle = '#23272A'; // Color de fondo oscuro de Discord
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Opcional: Añadir un borde sutil
      ctx.strokeStyle = ws.goodbye_color || '#ED4245'; // Color rojo o el configurado
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // --- AVATAR (Círculo) ---
      // Cargar la imagen del avatar
      const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
      const avatar = await Canvas.loadImage(avatarURL);

      // Configurar coordenadas y tamaño del avatar
      const avatarSize = 150;
      const avatarX = canvas.width / 2;
      const avatarY = canvas.height / 2 - 20; // Un poco más arriba del centro

      // Dibujar el círculo y recortar
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();

      // Dibujar la imagen del avatar dentro del círculo
      ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);

      // Restaurar el contexto para que lo siguiente no se recorte
      ctx.restore(); // ¡Importante! Canvas no tiene restore() nativo después de clip() sin save() previo.
                     // En este caso, simplemente dibujaremos encima.

      // --- TEXTOS ---
      ctx.fillStyle = '#FFFFFF'; // Color del texto (blanco)
      ctx.textAlign = 'center';  // Alinear texto al centro horizontalmente

      // Texto Principal: "¡Hasta luego!"
      ctx.font = 'bold 40px sans-serif'; // Usa una fuente estándar si no tienes personalizadas
      ctx.fillText('¡Hasta luego!', canvas.width / 2, avatarY + avatarSize / 2 + 50);

      // Nombre del Usuario
      ctx.font = '30px sans-serif';
      // Limitar el nombre si es muy largo para que no se salga
      let username = member.user.username;
      if (username.length > 20) {
        username = username.substring(0, 17) + '...';
      }
      ctx.fillText(username, canvas.width / 2, avatarY + avatarSize / 2 + 90);
      
      // Texto Secundario (Opcional)
      ctx.fillStyle = '#AAAAAA'; // Color gris más claro
      ctx.font = '20px sans-serif';
      ctx.fillText('Esperamos verte pronto.', canvas.width / 2, canvas.height - 30);


      // 4. Crear el Attachment y el Embed
      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'goodbye.png' });

      const embed = new EmbedBuilder()
        .setColor(ws.goodbye_color || '#ED4245') // Rojo por defecto para despedidas
        .setImage('attachment://goodbye.png')
        .setTimestamp()
        .setFooter({ text: `ID: ${member.id}` });
        
      // Opcional: Si quieres un título o descripción en el embed además de la imagen
      // embed.setTitle(`👋 ${member.user.tag} ha dejado el servidor.`);

      // 5. Enviar al canal
      await channel.send({ embeds: [embed], files: [attachment] });

    } catch (error) {
      console.error('[Goodbye Error] Error al generar o enviar la imagen de despedida:', error);
    }
  },
};