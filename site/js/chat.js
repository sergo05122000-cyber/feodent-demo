(function () {
  'use strict';

  // ====== Config ======
  // Will be replaced at deploy by the Worker URL. Empty = mock mode.
  const WORKER_URL = window.FEODENT_WORKER_URL || '';
  const SESSION_KEY = 'feodent_chat_session';

  // ====== State ======
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'sid_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  const history = [];
  let isOpen = false;
  let isWaiting = false;

  // ====== DOM ======
  const bubble = document.getElementById('chatBubble');
  const wrap = document.getElementById('chatWindow');
  const close = document.getElementById('chatClose');
  const list = document.getElementById('chatMessages');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const badge = document.getElementById('chatBadge');

  // ====== Helpers ======
  function renderMessage(role, text) {
    const div = document.createElement('div');
    div.className = 'msg msg-' + role;
    div.textContent = text;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    return div;
  }

  function renderTyping() {
    const div = document.createElement('div');
    div.className = 'msg msg-bot';
    div.innerHTML = '<span class="msg-typing"><span></span><span></span><span></span></span>';
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    return div;
  }

  function showBadge() {
    if (!isOpen) {
      badge.textContent = '1';
      badge.hidden = false;
    }
  }

  function openChat() {
    wrap.hidden = false;
    isOpen = true;
    badge.hidden = true;
    setTimeout(() => input.focus(), 100);

    if (history.length === 0) {
      renderMessage('bot', 'Здравствуйте! Я ассистент клиники «Гармония». Подскажу по услугам, ценам, расписанию, помогу с записью. Чем могу помочь?');
      history.push({ role: 'assistant', content: 'Здравствуйте! Я ассистент клиники «Гармония». Подскажу по услугам, ценам, расписанию, помогу с записью. Чем могу помочь?' });
    }
  }

  function closeChat() {
    wrap.hidden = true;
    isOpen = false;
  }

  async function sendMessage(text) {
    history.push({ role: 'user', content: text });
    renderMessage('user', text);
    const typingNode = renderTyping();
    isWaiting = true;

    try {
      let reply;
      if (WORKER_URL) {
        const res = await fetch(WORKER_URL + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, history }),
        });
        if (!res.ok) throw new Error('http_' + res.status);
        const data = await res.json();
        reply = data.reply || 'Извините, не получил ответ. Попробуйте ещё раз.';
      } else {
        // Mock mode for local preview without Worker
        await new Promise(r => setTimeout(r, 800));
        reply = mockReply(text);
      }

      typingNode.remove();
      renderMessage('bot', reply);
      history.push({ role: 'assistant', content: reply });
    } catch (err) {
      typingNode.remove();
      renderMessage('bot', 'Извините, чат временно недоступен. Позвоните +7 978 127-11-07 или напишите в WhatsApp по тому же номеру.');
      console.error('Chat error:', err);
    } finally {
      isWaiting = false;
    }
  }

  function mockReply(text) {
    const t = text.toLowerCase();
    if (t.includes('боли') || t.includes('болит') || t.includes('флюс') || t.includes('опухло')) {
      return 'Это вопрос требует осмотра врача. Я передал ваше сообщение администратору, с вами свяжутся.\n\nЕсли очень больно — позвоните +7 978 127-11-07.\nНочью — скорая 103.';
    }
    if (t.includes('цена') || t.includes('сколько') || t.includes('стои')) {
      return 'Базовый диапазон по основным услугам:\n• Профгигиена — 5 500 ₽\n• Кариес — от 4 500 ₽\n• Коронка металлокерамика — 18 000 ₽\n• Имплант под ключ — от 65 000 ₽\n\nТочную цену для вашего случая определит врач на консультации (1 500 ₽ у ортопеда, у терапевта бесплатно при дальнейшем лечении). Записать вас?';
    }
    if (t.includes('запи') || t.includes('консульт')) {
      return 'Подскажите, пожалуйста: 1) ваше имя и удобный телефон, 2) на какую услугу или к какому специалисту, 3) когда удобно — день и приблизительное время. Передам администратору, перезвонит в течение часа в рабочее время.';
    }
    if (t.includes('адрес') || t.includes('где') || t.includes('как добраться')) {
      return 'Адрес: Феодосия, ул. Чехова, 4, кв. 12-А — это первый этаж жилого дома, отдельный вход с улицы. Парковка во дворе бесплатно для пациентов.';
    }
    if (t.includes('час') || t.includes('режим') || t.includes('работ')) {
      return 'Часы работы:\n• Пн–Пт: 08:00 – 19:00\n• Сб: 08:00 – 17:00\n• Вс: выходной';
    }
    if (t.includes('омс') || t.includes('бесплатн')) {
      return 'Клиника коммерческая, по полису ОМС не работаем. Для лечения от 30 000 ₽ доступна беспроцентная рассрочка до 12 месяцев через банк-партнёра.';
    }
    if (t.includes('ребен') || t.includes('ребён') || t.includes('детск')) {
      return 'В клинике «Гармония» принимаем детей с 7 лет (терапия, профгигиена). Для младших — партнёрская клиника «Радуга», специально оборудованная для детского приёма.';
    }
    return 'Это интересный вопрос. Чтобы ответить точно, я передам его администратору — он свяжется с вами лично в течение часа в рабочее время. А пока: чем ещё могу помочь по услугам, ценам или записи?';
  }

  // ====== Wire-up ======
  bubble.addEventListener('click', openChat);
  close.addEventListener('click', closeChat);

  document.querySelectorAll('[data-open-chat]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); openChat(); });
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || isWaiting) return;
    input.value = '';
    sendMessage(text);
  });

  // Show first-time hint badge after 5s for visitors
  setTimeout(showBadge, 5000);
})();
