/* Логика сайта «Причал»: меню, корзина, оформление заказа. */
(function () {
  'use strict';

  const IMG = 'assets/img/';
  const money = (n) => n.toLocaleString('ru-RU') + ' ₽';
  const el = (sel, root = document) => root.querySelector(sel);
  const els = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Корзина ---------- */
  const STORE_KEY = 'prichal_cart';
  let cart = loadCart();

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveCart() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch (e) {}
  }
  function cartCount() {
    return Object.values(cart).reduce((s, i) => s + i.qty, 0);
  }
  function cartTotal() {
    return Object.values(cart).reduce((s, i) => s + i.qty * i.price, 0);
  }
  function addToCart(key, name, price, variant) {
    if (cart[key]) cart[key].qty += 1;
    else cart[key] = { name, price, variant: variant || '', qty: 1 };
    saveCart(); renderCart(); pulseCartBtn();
  }
  function changeQty(key, delta) {
    if (!cart[key]) return;
    cart[key].qty += delta;
    if (cart[key].qty <= 0) delete cart[key];
    saveCart(); renderCart();
  }

  /* ---------- Рендер меню ---------- */
  function renderMenu() {
    const chips = el('#menu-chips');
    const wrap = el('#menu-sections');
    chips.innerHTML = '';
    wrap.innerHTML = '';

    ['food', 'drinks'].forEach((group) => {
      MENU[group].forEach((cat) => {
        // чип категории
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.dataset.group = group;
        chip.dataset.target = 'cat-' + group + '-' + cat.id;
        chip.textContent = cat.title;
        chip.addEventListener('click', () => {
          const target = el('#' + chip.dataset.target);
          const y = target.getBoundingClientRect().top + window.scrollY - 130;
          window.scrollTo({ top: y, behavior: 'smooth' });
        });
        chips.appendChild(chip);

        // секция категории
        const section = document.createElement('section');
        section.className = 'menu-cat';
        section.id = 'cat-' + group + '-' + cat.id;
        section.dataset.group = group;

        const head = document.createElement('div');
        head.className = 'menu-cat__head';
        head.innerHTML = '<h3>' + cat.title + '</h3>' +
          (cat.note ? '<p class="menu-cat__note">' + cat.note + '</p>' : '');
        section.appendChild(head);

        const grid = document.createElement('div');
        grid.className = 'dishes';
        cat.items.forEach((item, idx) => {
          grid.appendChild(dishCard(group, cat.id, idx, item));
        });
        section.appendChild(grid);
        wrap.appendChild(section);
      });
    });

    setGroup('food');
  }

  function dishCard(group, catId, idx, item) {
    const baseId = group + ':' + catId + ':' + idx;
    const card = document.createElement('article');
    card.className = 'dish' + (item.img ? ' dish--photo' : '');

    if (item.img) {
      const ph = document.createElement('div');
      ph.className = 'dish__img';
      ph.innerHTML = '<img loading="lazy" src="' + IMG + item.img + '?v=4" alt="' + item.name + '">';
      card.appendChild(ph);
    }

    const body = document.createElement('div');
    body.className = 'dish__body';

    let html = '<h4 class="dish__name">' + item.name + '</h4>';
    if (item.desc) html += '<p class="dish__desc">' + item.desc + '</p>';
    body.innerHTML = html;

    const foot = document.createElement('div');
    foot.className = 'dish__foot';

    const priceEl = document.createElement('span');
    priceEl.className = 'dish__price';

    let select = null;
    if (item.variants) {
      select = document.createElement('select');
      select.className = 'dish__variant';
      item.variants.forEach((v, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = v.label + ' · ' + money(v.price);
        select.appendChild(o);
      });
      priceEl.textContent = money(item.variants[0].price);
      select.addEventListener('change', () => {
        priceEl.textContent = money(item.variants[select.value].price);
      });
      foot.appendChild(select);
    } else {
      priceEl.textContent = money(item.price);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'dish__add';
    addBtn.setAttribute('aria-label', 'Добавить в корзину');
    addBtn.innerHTML = '<span>+</span>';
    addBtn.addEventListener('click', () => {
      if (item.variants) {
        const v = item.variants[select ? select.value : 0];
        addToCart(baseId + '|' + v.label, item.name, v.price, v.label);
      } else {
        addToCart(baseId, item.name, item.price);
      }
    });

    const priceWrap = document.createElement('div');
    priceWrap.className = 'dish__buy';
    priceWrap.appendChild(priceEl);
    priceWrap.appendChild(addBtn);
    foot.appendChild(priceWrap);

    body.appendChild(foot);
    card.appendChild(body);
    return card;
  }

  function setGroup(group) {
    els('.menu-cat').forEach((s) => {
      s.style.display = s.dataset.group === group ? '' : 'none';
    });
    els('#menu-chips .chip').forEach((c) => {
      c.style.display = c.dataset.group === group ? '' : 'none';
      c.classList.remove('chip--active');
    });
    els('.group-tab').forEach((t) => {
      t.classList.toggle('group-tab--active', t.dataset.group === group);
    });
  }

  /* ---------- Рендер корзины ---------- */
  function renderCart() {
    const count = cartCount();
    const total = cartTotal();

    els('[data-cart-count]').forEach((n) => {
      n.textContent = count;
      n.classList.toggle('is-hidden', count === 0);
    });
    el('#cart-total').textContent = money(total);
    el('#fab-total').textContent = count ? money(total) : '';

    const list = el('#cart-items');
    list.innerHTML = '';
    const keys = Object.keys(cart);

    if (!keys.length) {
      list.innerHTML = '<p class="cart__empty">Корзина пуста.<br>Добавьте что-нибудь вкусное из меню 🍣</p>';
      el('#cart-checkout').disabled = true;
      return;
    }
    el('#cart-checkout').disabled = false;

    keys.forEach((key) => {
      const it = cart[key];
      const row = document.createElement('div');
      row.className = 'cart-row';
      row.innerHTML =
        '<div class="cart-row__info">' +
          '<span class="cart-row__name">' + it.name + (it.variant ? ' <small>' + it.variant + '</small>' : '') + '</span>' +
          '<span class="cart-row__price">' + money(it.price) + '</span>' +
        '</div>' +
        '<div class="qty">' +
          '<button class="qty__btn" data-dec aria-label="Меньше">−</button>' +
          '<span class="qty__val">' + it.qty + '</span>' +
          '<button class="qty__btn" data-inc aria-label="Больше">+</button>' +
        '</div>';
      row.querySelector('[data-dec]').addEventListener('click', () => changeQty(key, -1));
      row.querySelector('[data-inc]').addEventListener('click', () => changeQty(key, +1));
      list.appendChild(row);
    });
  }

  /* ---------- Оформление заказа ---------- */
  function buildOrderText() {
    const lines = ['Здравствуйте! Хочу сделать заказ в «Причал» 🛥', ''];
    Object.values(cart).forEach((it) => {
      lines.push('• ' + it.name + (it.variant ? ' (' + it.variant + ')' : '') +
        ' × ' + it.qty + ' — ' + money(it.price * it.qty));
    });
    lines.push('', 'Итого: ' + money(cartTotal()), '');
    lines.push('Имя: ', 'Телефон: ', 'Доставка или самовывоз: ', 'Адрес: ', 'Комментарий: ');
    return lines.join('\n');
  }

  function openCheckout() {
    if (!cartCount()) return;
    const text = buildOrderText();
    const modal = el('#checkout-modal');
    el('#checkout-text').value = text;

    const actions = el('#checkout-actions');
    actions.innerHTML = '';
    const enc = encodeURIComponent(text);

    if (CONFIG.whatsapp) {
      addAction(actions, 'Отправить в WhatsApp', 'btn btn--wa', () => {
        window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + enc, '_blank');
      });
    }
    if (CONFIG.telegram) {
      addAction(actions, 'Отправить в Telegram', 'btn btn--tg', () => {
        copyText(text);
        window.open('https://t.me/' + CONFIG.telegram, '_blank');
        toast('Текст заказа скопирован — вставьте его в чат Telegram');
      });
    }
    addAction(actions, 'Скопировать текст', 'btn btn--ghost', () => {
      copyText(text); toast('Текст заказа скопирован');
    });

    if (!CONFIG.whatsapp && !CONFIG.telegram) {
      const note = document.createElement('p');
      note.className = 'checkout__note';
      note.innerHTML = 'Кнопки отправки появятся после того, как в файле <code>config.js</code> ' +
        'укажут WhatsApp или Telegram.' + (CONFIG.phone ? ' А пока можно позвонить: <b>' + CONFIG.phone + '</b>' : '');
      actions.appendChild(note);
    }

    modal.classList.add('is-open');
    document.body.classList.add('no-scroll');
  }

  function addAction(parent, label, cls, fn) {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', fn);
    parent.appendChild(b);
  }

  function copyText(t) {
    if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
    else {
      const ta = el('#checkout-text'); ta.select(); document.execCommand('copy');
    }
  }

  /* ---------- UI: drawer, modal, toast ---------- */
  function openCart() { el('#cart').classList.add('is-open'); el('#overlay').classList.add('is-open'); document.body.classList.add('no-scroll'); }
  function closeCart() { el('#cart').classList.remove('is-open'); el('#overlay').classList.remove('is-open'); document.body.classList.remove('no-scroll'); }
  function closeModal() { el('#checkout-modal').classList.remove('is-open'); document.body.classList.remove('no-scroll'); }

  let toastTimer;
  function toast(msg) {
    let t = el('#toast');
    t.textContent = msg;
    t.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-show'), 2600);
  }

  function pulseCartBtn() {
    const fab = el('#cart-fab');
    fab.classList.remove('pulse'); void fab.offsetWidth; fab.classList.add('pulse');
  }

  /* ---------- Подстановка контактов из CONFIG ---------- */
  function applyConfig() {
    els('[data-cafe-name]').forEach((n) => n.textContent = CONFIG.cafeName);
    setText('[data-tagline]', CONFIG.tagline);
    setText('[data-city]', CONFIG.city);
    setText('[data-address]', CONFIG.address);
    setText('[data-hours]', CONFIG.hours);
    setText('[data-phone-text]', CONFIG.phone);

    els('[data-phone-link]').forEach((a) => {
      if (CONFIG.phone) { a.href = 'tel:' + CONFIG.phone.replace(/[^\d+]/g, ''); a.classList.remove('is-disabled'); }
      else a.classList.add('is-disabled');
    });

    linkOrHide('[data-instagram]', CONFIG.instagram);
    linkOrHide('[data-vk]', CONFIG.vk);
    linkOrHide('[data-map]', CONFIG.yandexMap);

    // блок доставки
    const d = CONFIG.delivery || {};
    const dParts = [];
    if (d.zones) dParts.push(d.zones);
    if (d.cost) dParts.push('Стоимость: ' + d.cost);
    if (d.time) dParts.push('Время: ' + d.time);
    if (d.minSum) dParts.push('Минимальный заказ: ' + money(d.minSum));
    const dEl = el('[data-delivery]');
    if (dEl) {
      if (dParts.length) dEl.innerHTML = dParts.map((p) => '<li>' + p + '</li>').join('');
      else dEl.closest('.info-card').style.display = 'none';
    }

    // подсветить незаполненные контакты в консоли для владельца
    const missing = ['city', 'address', 'hours', 'phone'].filter((k) => !CONFIG[k]);
    if (missing.length || (!CONFIG.whatsapp && !CONFIG.telegram)) {
      console.info('[Причал] Заполните в site/js/config.js:',
        missing.concat(!CONFIG.whatsapp && !CONFIG.telegram ? ['whatsapp или telegram'] : []).join(', '));
    }
  }

  function setText(sel, val) {
    els(sel).forEach((n) => {
      if (val) { n.textContent = val; }
      else { n.textContent = n.dataset.fallback || '—'; n.classList.add('is-empty'); }
    });
  }
  function linkOrHide(sel, url) {
    els(sel).forEach((a) => {
      if (url) a.href = url;
      else a.style.display = 'none';
    });
  }

  /* ---------- Инициализация ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('year').textContent = new Date().getFullYear();
    applyConfig();
    renderMenu();
    renderCart();

    els('.group-tab').forEach((t) => t.addEventListener('click', () => setGroup(t.dataset.group)));

    el('#cart-fab').addEventListener('click', openCart);
    els('[data-open-cart]').forEach((b) => b.addEventListener('click', openCart));
    el('#cart-close').addEventListener('click', closeCart);
    el('#overlay').addEventListener('click', closeCart);
    el('#cart-checkout').addEventListener('click', () => { closeCart(); openCheckout(); });
    el('#checkout-close').addEventListener('click', closeModal);
    el('#checkout-modal').addEventListener('click', (e) => { if (e.target.id === 'checkout-modal') closeModal(); });

    // мобильное меню-бургер
    el('#nav-toggle').addEventListener('click', () => el('#nav').classList.toggle('is-open'));
    els('#nav a').forEach((a) => a.addEventListener('click', () => el('#nav').classList.remove('is-open')));

    // подсветка активного чипа категории при скролле
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          els('#menu-chips .chip').forEach((c) =>
            c.classList.toggle('chip--active', c.dataset.target === id));
        }
      });
    }, { rootMargin: '-130px 0px -65% 0px' });
    setTimeout(() => els('.menu-cat').forEach((s) => observer.observe(s)), 300);
  });
})();
