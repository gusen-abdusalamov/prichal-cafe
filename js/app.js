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
    saveCart(); renderCart(); syncCards(); pulseCartBtn();
  }
  function changeQty(key, delta) {
    if (!cart[key]) return;
    cart[key].qty += delta;
    if (cart[key].qty <= 0) delete cart[key];
    saveCart(); renderCart(); syncCards();
  }

  // карточки меню, умеющие отрисовать «+»/степпер по состоянию корзины
  let cardSyncers = [];
  function syncCards() { cardSyncers.forEach((fn) => fn()); }

  /* ---------- Рендер меню ---------- */
  function renderMenu() {
    const chips = el('#menu-chips');
    const wrap = el('#menu-sections');
    chips.innerHTML = '';
    wrap.innerHTML = '';
    cardSyncers = [];

    ['food', 'drinks'].forEach((group) => {
      MENU[group].forEach((cat) => {
        // кухня: пока показываем только позиции с фото (вернутся, как только добавить img)
        const isHidden = (item) => group === 'food' && !item.img;
        if (cat.items.every(isHidden)) return;  // категория без видимых позиций — пропускаем

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
          if (isHidden(item)) return;  // пропускаем кухню без фото (idx сохраняем для ключей)
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
      ph.className = 'dish__img' + (item.square ? ' dish__img--square' : '');
      const pos = item.pos ? ' style="object-position:' + item.pos + '"' : '';
      ph.innerHTML = '<img loading="lazy" decoding="async" width="563" height="1000"' + pos + ' src="' + IMG + item.img + '?v=' + (item.v || '6') + '" alt="' + item.name + '">';
      const pic = ph.querySelector('img');
      const reveal = () => ph.classList.add('is-loaded');
      if (pic.complete) reveal();
      else { pic.addEventListener('load', reveal); pic.addEventListener('error', reveal); }
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

    // мета текущего выбранного варианта (или базовой позиции)
    function currentMeta() {
      if (item.variants) {
        const v = item.variants[select ? select.value : 0];
        return { key: baseId + '|' + v.label, price: v.price, variant: v.label };
      }
      return { key: baseId, price: item.price, variant: '' };
    }

    // контрол покупки: «+» когда в корзине пусто, иначе степпер «− N +»
    const ctrl = document.createElement('div');
    ctrl.className = 'dish__ctrl';
    let lastKey = null, lastQty = -1;
    function syncBuy() {
      const m = currentMeta();
      const qty = cart[m.key] ? cart[m.key].qty : 0;
      if (m.key === lastKey && qty === lastQty) return;  // без лишней перерисовки
      lastKey = m.key; lastQty = qty;
      ctrl.innerHTML = '';
      if (qty > 0) {
        ctrl.classList.add('dish__ctrl--stepper');
        const dec = document.createElement('button');
        dec.className = 'dish__step';
        dec.setAttribute('aria-label', 'Убрать одну порцию');
        dec.textContent = '−';
        dec.addEventListener('click', () => changeQty(m.key, -1));
        const val = document.createElement('span');
        val.className = 'dish__qty';
        val.textContent = qty;
        const inc = document.createElement('button');
        inc.className = 'dish__step';
        inc.setAttribute('aria-label', 'Добавить ещё порцию');
        inc.textContent = '+';
        inc.addEventListener('click', () => addToCart(m.key, item.name, m.price, m.variant));
        ctrl.appendChild(dec); ctrl.appendChild(val); ctrl.appendChild(inc);
      } else {
        ctrl.classList.remove('dish__ctrl--stepper');
        const add = document.createElement('button');
        add.className = 'dish__add';
        add.setAttribute('aria-label', 'Добавить в корзину');
        add.innerHTML = '<span>+</span>';
        add.addEventListener('click', () => addToCart(m.key, item.name, m.price, m.variant));
        ctrl.appendChild(add);
      }
    }
    // при смене варианта пересчитать количество для нового ключа
    if (select) select.addEventListener('change', syncBuy);

    const priceWrap = document.createElement('div');
    priceWrap.className = 'dish__buy';
    priceWrap.appendChild(priceEl);
    priceWrap.appendChild(ctrl);
    foot.appendChild(priceWrap);

    body.appendChild(foot);
    card.appendChild(body);

    syncBuy();
    cardSyncers.push(syncBuy);
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

  /* ---------- Прогресс «до бесплатной доставки» ---------- */
  function renderShipBar(total) {
    const box = el('#cart-ship');
    if (!box) return;
    const free = (CONFIG.delivery && CONFIG.delivery.freeFrom) || 0;
    if (!free || total <= 0) { box.classList.add('is-hidden'); return; }
    box.classList.remove('is-hidden');
    const fill = el('#cart-ship-fill');
    const txt = el('#cart-ship-text');
    txt.textContent = '';
    if (total >= free) {
      box.classList.add('cart__ship--done');
      fill.style.width = '100%';
      // премиальный success: галочка-бейдж + лаконичный текст (статичная разметка)
      txt.innerHTML = '<svg class="cart__ship-ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="10" fill="currentColor" opacity=".16"/>' +
        '<path d="M16.5 8.8 10.6 14.7 7.5 11.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<span>Бесплатная доставка включена</span>';
    } else {
      box.classList.remove('cart__ship--done');
      fill.style.width = Math.min(100, Math.round((total / free) * 100)) + '%';
      txt.append('До бесплатной доставки ещё ');
      const b = document.createElement('b');
      b.textContent = money(free - total);
      txt.append(b);
    }
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
    renderShipBar(total);

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
          '<span class="cart-row__name"></span>' +
          '<span class="cart-row__price">' + money(it.price) + '</span>' +
        '</div>' +
        '<div class="qty">' +
          '<button class="qty__btn" data-dec aria-label="Меньше">−</button>' +
          '<span class="qty__val">' + it.qty + '</span>' +
          '<button class="qty__btn" data-inc aria-label="Больше">+</button>' +
        '</div>';
      const nameEl = row.querySelector('.cart-row__name');
      nameEl.textContent = it.name;
      if (it.variant) {
        const sm = document.createElement('small');
        sm.textContent = ' ' + it.variant;
        nameEl.appendChild(sm);
      }
      row.querySelector('[data-dec]').addEventListener('click', () => changeQty(key, -1));
      row.querySelector('[data-inc]').addEventListener('click', () => changeQty(key, +1));
      list.appendChild(row);
    });
  }

  /* ---------- Оформление заказа ---------- */
  function checkoutFields() {
    const typeEl = document.querySelector('input[name="co-type"]:checked');
    return {
      name: el('#co-name').value.trim(),
      phone: el('#co-phone').value.trim(),
      type: typeEl ? typeEl.value : 'Доставка',
      address: el('#co-address').value.trim(),
      comment: el('#co-comment').value.trim(),
    };
  }

  function buildOrderText() {
    const f = checkoutFields();
    const lines = ['Здравствуйте! Хочу сделать заказ в «Причал» 🛥', ''];
    Object.values(cart).forEach((it) => {
      lines.push('• ' + it.name + (it.variant ? ' (' + it.variant + ')' : '') +
        ' × ' + it.qty + ' — ' + money(it.price * it.qty));
    });
    lines.push('', 'Итого: ' + money(cartTotal()), '');
    lines.push('Имя: ' + f.name);
    lines.push('Телефон: ' + f.phone);
    if (f.type === 'Самовывоз') {
      lines.push('Самовывоз');
    } else {
      lines.push('Доставка по адресу: ' + f.address);
      const free = (CONFIG.delivery && CONFIG.delivery.freeFrom) || 0;
      if (free && cartTotal() >= free) lines.push('Доставка: бесплатно (заказ от ' + money(free) + ')');
    }
    if (f.comment) lines.push('Комментарий: ' + f.comment);
    return lines.join('\n');
  }

  function validateOrder() {
    const f = checkoutFields();
    if (!f.name) { toast('Укажите имя'); el('#co-name').focus(); return false; }
    if (!f.phone) { toast('Укажите телефон'); el('#co-phone').focus(); return false; }
    if (f.type === 'Доставка' && !f.address) { toast('Укажите адрес доставки'); el('#co-address').focus(); return false; }
    return true;
  }

  function renderCheckoutSummary() {
    const rows = Object.values(cart).map((it) =>
      '<div class="co-sum__row"><span>' + it.name + (it.variant ? ' <small>' + it.variant + '</small>' : '') +
      ' × ' + it.qty + '</span><span>' + money(it.price * it.qty) + '</span></div>').join('');
    el('#checkout-summary').innerHTML = rows +
      '<div class="co-sum__total"><span>Итого</span><span>' + money(cartTotal()) + '</span></div>';
  }

  function openCheckout() {
    if (!cartCount()) return;
    renderCheckoutSummary();

    const actions = el('#checkout-actions');
    actions.innerHTML = '';

    if (CONFIG.whatsapp) {
      addAction(actions, 'Отправить в WhatsApp', 'btn btn--wa', () => {
        if (!validateOrder()) return;
        window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(buildOrderText()), '_blank');
      });
    }
    if (CONFIG.telegram) {
      addAction(actions, 'Отправить в Telegram', 'btn btn--tg', () => {
        if (!validateOrder()) return;
        copyText(buildOrderText());
        window.open('https://t.me/' + CONFIG.telegram, '_blank');
        toast('Текст заказа скопирован — вставьте его в чат Telegram');
      });
    }
    addAction(actions, 'Скопировать текст заказа', 'btn btn--ghost', () => {
      copyText(buildOrderText()); toast('Текст заказа скопирован');
    });

    if (!CONFIG.whatsapp && !CONFIG.telegram) {
      const note = document.createElement('p');
      note.className = 'checkout__note';
      note.innerHTML = 'Кнопки отправки появятся после того, как в файле <code>config.js</code> ' +
        'укажут WhatsApp или Telegram.' + (CONFIG.phone ? ' А пока можно позвонить: <b>' + CONFIG.phone + '</b>' : '');
      actions.appendChild(note);
    }

    el('#checkout-modal').classList.add('is-open');
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).catch(legacyCopy);
    } else legacyCopy();
    function legacyCopy() {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
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

    // ник в кнопке Instagram + скрыть карточку соцсетей, если их нет
    var igHandle = el('[data-ig-handle]');
    if (igHandle) igHandle.textContent = CONFIG.instagram
      ? '@' + CONFIG.instagram.replace(/\/+$/, '').split('/').pop()
      : 'Instagram';
    var socialCard = el('[data-social-card]');
    if (socialCard && !CONFIG.instagram && !CONFIG.vk) socialCard.style.display = 'none';

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

  /* ---------- Акции (из CONFIG.promos) ---------- */
  function renderPromos() {
    const grid = el('#promo-grid');
    if (!grid) return;
    const list = Array.isArray(CONFIG.promos) ? CONFIG.promos : [];
    if (!list.length) {
      const sec = el('#promos');
      if (sec) sec.style.display = 'none';
      return;
    }
    grid.innerHTML = '';
    list.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'promo promo--' + ((i % 3) + 1);
      if (p.tag) {
        const tag = document.createElement('span');
        tag.className = 'promo__tag';
        tag.textContent = p.tag;
        card.appendChild(tag);
      }
      const h = document.createElement('h3');
      h.textContent = p.title || '';
      card.appendChild(h);
      if (p.text) {
        const para = document.createElement('p');
        para.textContent = p.text;
        card.appendChild(para);
      }
      grid.appendChild(card);
    });
  }

  /* ---------- Инициализация ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('year').textContent = new Date().getFullYear();
    applyConfig();
    renderPromos();
    renderMenu();
    renderCart();

    els('.group-tab').forEach((t) => t.addEventListener('click', () => setGroup(t.dataset.group)));

    // переключатель темы (начальная тема уже выставлена inline-скриптом в <head>)
    const metaTheme = el('#meta-theme-color');
    const themeColors = { light: '#faf9f7', dark: '#13151b' };
    function setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      if (metaTheme) metaTheme.setAttribute('content', themeColors[theme] || themeColors.light);
      try { localStorage.setItem('prichal_theme', theme); } catch (e) {}
    }
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    const themeBtn = el('#theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    el('#cart-fab').addEventListener('click', openCart);
    els('[data-open-cart]').forEach((b) => b.addEventListener('click', openCart));
    el('#cart-close').addEventListener('click', closeCart);
    el('#overlay').addEventListener('click', closeCart);
    el('#cart-checkout').addEventListener('click', () => { closeCart(); openCheckout(); });
    el('#checkout-close').addEventListener('click', closeModal);
    el('#checkout-modal').addEventListener('click', (e) => { if (e.target.id === 'checkout-modal') closeModal(); });

    // показывать поле «Адрес» только для доставки
    els('input[name="co-type"]').forEach((r) => r.addEventListener('change', () => {
      const pickup = document.querySelector('input[name="co-type"]:checked').value === 'Самовывоз';
      el('#co-address-wrap').style.display = pickup ? 'none' : '';
    }));

    // мобильное меню-бургер
    const navToggle = el('#nav-toggle');
    navToggle.addEventListener('click', () => {
      const open = el('#nav').classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    els('#nav a').forEach((a) => a.addEventListener('click', () => {
      el('#nav').classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }));

    // закрытие модалок/корзины по Esc
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (el('#checkout-modal').classList.contains('is-open')) closeModal();
      else if (el('#cart').classList.contains('is-open')) closeCart();
      else if (el('#nav').classList.contains('is-open')) {
        el('#nav').classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });

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
