import { showToast } from "./nav.js";

export async function sendEmailNotification(reservation, status) {
  const isConfirmed = status === "confirmed";
  
  const TEMPLATE_CONFIRMAR = "template_zrvt914";    
  const TEMPLATE_CANCELAR = "template_6xfz84t";   
  
  const templateId = isConfirmed ? TEMPLATE_CONFIRMAR : TEMPLATE_CANCELAR;
  const statusText = isConfirmed ? "CONFIRMADA" : "CANCELADA";
  
  if (!reservation.userEmail) {
    console.error("❌ No hay correo electrónico");
    showToast("❌ No se pudo enviar correo: falta email", "error");
    return false;
  }
  
  console.log(`📧 Enviando correo de ${statusText} a ${reservation.userEmail}`);
  console.log(`📧 Usando plantilla: ${templateId}`);
  
  try {
    emailjs.init("eVeke2QQi_xaxpLHo");
    const response = await emailjs.send(
      "service_jf0mddq",      
      templateId,                
      {
        to_email: reservation.userEmail,
        to_name: reservation.userName || "Cliente",
        userName: reservation.userName || "Cliente",
        userEmail: reservation.userEmail,
        date: reservation.date,
        time: reservation.time,
        table: reservation.tableName,
        guests: reservation.guests.toString(),
        notes: reservation.notes || "Sin notas especiales"
      }
    );
    
    console.log("✅ Correo enviado:", response);
    showToast(`📧 Correo de ${statusText} enviado a ${reservation.userEmail}`, "success");
    return true;
    
  } catch (error) {
    console.error("❌ Error al enviar correo:", error);
    showToast(`❌ Error: ${error.text || error.message}`, "error");
    return false;
  }
}

export async function sendWhatsAppNotification(reservation, status) {
  if (!reservation.userPhone) {
    console.log("⚠️ No hay número de teléfono");
    return false;
  }
  
  const isConfirmed = status === "confirmed";
  const statusText = isConfirmed ? "CONFIRMADA ✅" : "CANCELADA ❌";
  
  let mensaje = "";
  if (isConfirmed) {
    mensaje = `🍜 HANSHIKDANG 🥢\n\nHola ${reservation.userName || "Cliente"},\n\n✅ Tu reservación ha sido CONFIRMADA\n\n📅 Fecha: ${reservation.date}\n⏰ Hora: ${reservation.time}\n🪑 Mesa: ${reservation.tableName}\n👥 Personas: ${reservation.guests}\n\n¡Te esperamos! 🥢`;
  } else {
    mensaje = `🍜 HANSHIKDANG 🥢\n\nHola ${reservation.userName || "Cliente"},\n\n❌ Tu reservación ha sido CANCELADA\n\n📅 Fecha: ${reservation.date}\n⏰ Hora: ${reservation.time}\n🪑 Mesa: ${reservation.tableName}\n👥 Personas: ${reservation.guests}\n\nSi fue un error, contáctanos.`;
  }
  
  const url = `https://wa.me/${reservation.userPhone.replace(/\s/g, '')}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
  showToast(`📱 WhatsApp preparado`, "success");
  return true;
}

export async function sendNotification(reservation, status) {
  console.log("========================================");
  console.log("📢 ENVIANDO NOTIFICACIÓN");
  console.log("📢 Estado:", status);
  console.log("📢 Cliente:", reservation.userName);
  console.log("📢 Email:", reservation.userEmail);
  console.log("========================================");

  await sendEmailNotification(reservation, status);
  

  if (reservation.notifVia === "whatsapp" && reservation.userPhone) {
    await sendWhatsAppNotification(reservation, status);
  }
  
  return true;
}