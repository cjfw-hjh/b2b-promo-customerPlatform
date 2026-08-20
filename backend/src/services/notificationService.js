const nodemailer = require('nodemailer');

// PRD 7번 리스크: SMTP 계정이 아직 없다. SMTP_HOST가 없으면 실제 발송 대신 console.log로 대체한다.
// RULE-NOTIFICATION-001: 이메일 알림 실패가 저장을 취소시키면 안 되므로, 이 함수 내부에서
// 모든 에러를 catch해 console.error로만 남기고 절대 reject/throw하지 않는다(1차 방어선).
async function sendNotification({ to, subject, text }) {
  try {
    if (!process.env.SMTP_HOST) {
      console.log(`[notification] to=${to} subject=${subject}\n${text}`);
      return;
    }
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, text });
  } catch (err) {
    console.error('[notification] 알림 발송 실패:', err.message);
  }
}

module.exports = { sendNotification };
