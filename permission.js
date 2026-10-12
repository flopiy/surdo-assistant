/**
 * permission.js — запитуємо дозвіл на мікрофон один раз.
 * Цього файлу не вистачало — саме через це SpeechRecognition падав
 * з "not-allowed".
 */
const askBtn = document.getElementById("ask");
const closeBtn = document.getElementById("close");
const statusEl = document.getElementById("status");

askBtn.addEventListener("click", async () => {
  statusEl.className = "";
  statusEl.textContent = "Запитую доступ…";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Стрім більше не потрібен — важливий сам факт наданого дозволу
    stream.getTracks().forEach((t) => t.stop());
    statusEl.className = "ok";
    statusEl.textContent = "✅ Дозвіл надано. Можеш закривати цю вкладку.";
    closeBtn.disabled = false;
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent =
      "❌ Доступ відхилено: " + (e && (e.name || e.message) || e) +
      ". Дозволь мікрофон у налаштуваннях сайту (значок замка в адресному рядку).";
  }
});

closeBtn.addEventListener("click", () => window.close());