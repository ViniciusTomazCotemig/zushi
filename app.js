const STORAGE = {
  cart: 'zushi_cart_v1',
  session: 'zushi_session_v1',
  theme: 'zushi_theme_v1'
};

const DATABASE = 'zushi_local_v1';
const PAYMENT_METHODS = ['cartao_credito', 'cartao_debito', 'pix', 'dinheiro'];
const products = [
  { id: 'combo-aurora', databaseId: 1, name: 'Combinado Aurora', category: 'Combinados', price: 68, description: '12 peças, salmão, atum e delicados rolls da casa.', meta: '12 peças · serve 1', tag: 'Mais pedido', image: 'assets/chef-selection.jpg' },
  { id: 'nigiri-salmao', databaseId: 2, name: 'Niguiri de salmão', category: 'Niguiris', price: 32, description: 'Salmão fresco sobre arroz temperado no ponto certo.', meta: '6 peças · clássico', tag: 'Clássico', image: 'assets/salmon-nigiri.jpg' },
  { id: 'selecionado-chef', databaseId: 3, name: 'Seleção do chef', category: 'Combinados', price: 92, description: 'Uma seleção sazonal feita para descobrir novos sabores.', meta: '16 peças · serve 1–2', tag: 'Da estação', image: 'assets/sushi-selection.jpg' },
  { id: 'sashimi-salmao', databaseId: 4, name: 'Sashimi de salmão', category: 'Sashimis', price: 46, description: 'Fatias precisas, textura delicada e frescor de origem.', meta: '8 fatias', tag: 'Fresco do dia', image: 'assets/nigiri-special.jpg' },
  { id: 'maki-salmao', databaseId: 5, name: 'Maki de salmão', category: 'Makis', price: 29, description: 'Arroz, nori e salmão: o essencial, sem excessos.', meta: '8 peças', tag: '', image: 'assets/salmon-roll.jpg' },
  { id: 'combo-zushi', databaseId: 6, name: 'Combinado Zushi', category: 'Combinados', price: 119, description: 'Uma viagem por niguiris, makis e cortes especiais.', meta: '24 peças · serve 2', tag: 'Para compartilhar', image: 'assets/sushi-platter.jpg' },
  { id: 'nigiri-misto', databaseId: 7, name: 'Dupla de niguiris', category: 'Niguiris', price: 24, description: 'Dois niguiris escolhidos conforme a pesca do dia.', meta: '4 peças', tag: '', image: 'assets/chef-selection.jpg' },
  { id: 'temaki-salmao', databaseId: 8, name: 'Temaki de salmão', category: 'Temakis', price: 38, description: 'Nori crocante, salmão e arroz preparados na hora.', meta: '1 unidade · generoso', tag: 'Feito na hora', image: 'assets/salmon-roll.jpg' }
];

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const state = {
  category: 'Todos',
  search: new URLSearchParams(window.location.search).get('q')?.slice(0, 60) || ''
};
const nav = document.getElementById('primaryNav');

function readStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
let databasePromise;
function openDatabase() {
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('users')) {
        const users = database.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        users.createIndex('email', 'email', { unique: true });
      }
      if (!database.objectStoreNames.contains('orders')) {
        const orders = database.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
        orders.createIndex('User_id', 'User_id');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Feche outras abas da Zushi para atualizar o banco local.'));
  });
  return databasePromise;
}
function databaseRequest(storeName, mode, operation) {
  return openDatabase().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    let result;
    let request;
    try { request = operation(transaction.objectStore(storeName)); }
    catch (error) { reject(error); return; }
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('A operação local foi cancelada.'));
  }));
}
function getAllFromDatabase(storeName) {
  return databaseRequest(storeName, 'readonly', store => store.getAll());
}
function getSessionId() {
  try { return sessionStorage.getItem(STORAGE.session); } catch { return null; }
}
function setSessionId(accountId) {
  try { sessionStorage.setItem(STORAGE.session, accountId); return true; } catch { return false; }
}
async function getUser() {
  const id = Number(getSessionId());
  if (!Number.isInteger(id) || id < 1) return null;
  return databaseRequest('users', 'readonly', store => store.get(id));
}
function productById(id) { return products.find(product => product.id === id); }
function getCart() {
  const cart = readStore(STORAGE.cart, []);
  if (!Array.isArray(cart)) return [];
  return cart.filter(item => item && typeof item.id === 'string' && productById(item.id) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99);
}
function getOrders(userId) {
  return databaseRequest('orders', 'readonly', store => store.index('User_id').getAll(Number(userId)));
}
function formatPrice(value) { return money.format(value); }
function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'Z';
}

function setTheme(theme) {
  const selected = theme === 'dark' ? 'dark' : 'light';
  const isDark = selected === 'dark';
  document.documentElement.dataset.theme = selected;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#191918' : '#f8f6f0');
  try { localStorage.setItem(STORAGE.theme, selected); } catch { /* Tema segue ativo durante a sessão. */ }
  const button = document.querySelector('[data-action="toggle-theme"]');
  if (button) {
    const icon = button.querySelector('span');
    const label = isDark ? 'Ativar modo claro' : 'Ativar modo escuro';
    button.setAttribute('aria-label', label);
    button.title = label;
    if (icon) icon.textContent = isDark ? '☀' : '☾';
  }
}
function updateCartCount() {
  const count = getCart().reduce((total, item) => total + item.quantity, 0);
  const badge = document.getElementById('cartCount');
  if (badge) badge.textContent = count > 99 ? '99+' : String(count);
}
function showToast(message) {
  const region = document.getElementById('toastRegion');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => {
    toast.classList.add('out');
    window.setTimeout(() => toast.remove(), 220);
  }, 2800);
}
function closeMenu() {
  nav?.classList.remove('open');
  document.querySelector('[data-action="toggle-menu"]')?.setAttribute('aria-expanded', 'false');
}

function renderCatalogProducts() {
  const grid = document.getElementById('catalogGrid');
  const template = document.getElementById('productCardTemplate');
  if (!grid || !template) return;
  grid.replaceChildren();
  products.forEach(product => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('[data-product-card]');
    const image = fragment.querySelector('[data-product-image]');
    const tag = fragment.querySelector('[data-product-tag]');
    card.dataset.category = product.category;
    card.dataset.name = `${product.name} ${product.description}`.toLocaleLowerCase('pt-BR');
    image.src = product.image;
    image.alt = product.name;
    fragment.querySelector('[data-product-name]').textContent = product.name;
    fragment.querySelector('[data-product-price]').textContent = formatPrice(product.price);
    fragment.querySelector('[data-product-description]').textContent = product.description;
    fragment.querySelector('[data-product-meta]').textContent = product.meta;
    tag.textContent = product.tag;
    tag.hidden = !product.tag;
    const addButton = fragment.querySelector('[data-action="add"]');
    addButton.dataset.id = product.id;
    addButton.setAttribute('aria-label', `Adicionar ${product.name} à sacola`);
    grid.append(fragment);
  });
  const search = document.getElementById('productSearch');
  if (search) search.value = state.search;
  filterCatalog();
}
function filterCatalog() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;
  const term = state.search.trim().toLocaleLowerCase('pt-BR');
  let visible = 0;
  grid.querySelectorAll('[data-product-card]').forEach(card => {
    const categoryMatches = state.category === 'Todos' || card.dataset.category === state.category;
    const searchMatches = !term || card.dataset.name.includes(term);
    card.hidden = !(categoryMatches && searchMatches);
    if (!card.hidden) visible += 1;
  });
  const empty = document.getElementById('catalogNoResults');
  if (empty) empty.hidden = visible > 0;
  const count = document.getElementById('catalogCount');
  if (count) count.textContent = `${visible} ${visible === 1 ? 'item' : 'itens'} da casa`;
}

function cartTotals(cart) {
  const subtotal = cart.reduce((total, item) => total + productById(item.id).price * item.quantity, 0);
  const delivery = subtotal > 0 ? (subtotal >= 120 ? 0 : 7.9) : 0;
  return { subtotal, delivery, total: subtotal + delivery };
}
function renderCart() {
  const list = document.getElementById('cartList');
  const template = document.getElementById('cartItemTemplate');
  if (!list || !template) return;
  const cart = getCart();
  const emptyState = document.getElementById('cartEmpty');
  const content = document.getElementById('cartContent');
  emptyState.hidden = cart.length > 0;
  content.hidden = cart.length === 0;
  list.replaceChildren();
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const countLabel = document.getElementById('cartItemCount');
  if (countLabel) countLabel.textContent = `${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`;
  if (!cart.length) return;

  cart.forEach(item => {
    const product = productById(item.id);
    const fragment = template.content.cloneNode(true);
    const row = fragment.querySelector('[data-cart-item]');
    const image = fragment.querySelector('[data-cart-image]');
    image.src = product.image;
    image.alt = product.name;
    fragment.querySelector('[data-cart-name]').textContent = product.name;
    fragment.querySelector('[data-cart-meta]').textContent = product.meta;
    fragment.querySelector('[data-cart-quantity]').textContent = String(item.quantity);
    fragment.querySelector('[data-cart-price]').textContent = formatPrice(product.price * item.quantity);
    row.querySelectorAll('[data-action="quantity"], [data-action="remove"]').forEach(button => {
      button.dataset.id = product.id;
      if (button.dataset.action === 'quantity') {
        const amount = Number(button.dataset.delta);
        button.setAttribute('aria-label', `${amount > 0 ? 'Aumentar' : 'Diminuir'} quantidade de ${product.name}`);
      } else {
        button.setAttribute('aria-label', `Remover ${product.name} da sacola`);
      }
    });
    list.append(fragment);
  });
  const totals = cartTotals(cart);
  document.getElementById('cartSubtotal').textContent = formatPrice(totals.subtotal);
  document.getElementById('cartDelivery').textContent = totals.delivery ? formatPrice(totals.delivery) : 'Grátis';
  document.getElementById('cartTotal').textContent = formatPrice(totals.total);
}

async function renderOrders() {
  const guest = document.getElementById('ordersGuest');
  const authenticated = document.getElementById('ordersAuthenticated');
  const list = document.getElementById('ordersList');
  const template = document.getElementById('orderCardTemplate');
  if (!guest || !authenticated || !list || !template) return;
  const user = await getUser();
  guest.hidden = true;
  authenticated.hidden = !user;
  list.replaceChildren();
  if (!user) return;
  const orders = (await getOrders(user.id)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const empty = document.getElementById('ordersEmpty');
  empty.hidden = orders.length > 0;
  list.hidden = orders.length === 0;
  const count = document.getElementById('ordersCount');
  count.textContent = `${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'}`;
  count.hidden = orders.length === 0;
  orders.forEach((order, index) => {
    const fragment = template.content.cloneNode(true);
    const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(order.created_at));
    const itemNames = order.items.map(item => `${item.qty}× ${item.product_name || products.find(product => product.databaseId === item.Product_id)?.name || 'Produto'}`).join(' · ');
    const itemCount = order.items.reduce((total, item) => total + item.qty, 0);
    fragment.querySelector('[data-order-number]').textContent = `Pedido #${String(order.id || (orders.length - index)).padStart(4, '0')}`;
    fragment.querySelector('[data-order-date]').textContent = date;
    fragment.querySelector('[data-order-status]').textContent = order.status || 'Recebido';
    fragment.querySelector('[data-order-items]').textContent = itemNames;
    fragment.querySelector('[data-order-foot]').textContent = `${itemCount} itens · entrega ${order.delivery ? formatPrice(order.delivery) : 'grátis'}`;
    fragment.querySelector('[data-order-total]').textContent = formatPrice(order.total_price);
    list.append(fragment);
  });
}

async function renderProfile() {
  const guest = document.getElementById('profileGuest');
  const account = document.getElementById('profileAccount');
  if (!guest || !account) return;
  const user = await getUser();
  guest.hidden = true;
  account.hidden = !user;
  if (!user) return;
  document.getElementById('profileAvatar').textContent = initials(user.name);
  document.getElementById('profileDisplayName').textContent = user.name;
  document.getElementById('profileDisplayEmail').textContent = user.email;
  const address = user.addresses?.[0] || {};
  const values = {
    profileName: user.name,
    profileEmail: user.email,
    profilePhone: user.phone || '',
    profileCity: address.city || '',
    profileDistrict: address.district || '',
    profileAddressNumber: address.house_number || '',
    profileStreet: address.street || ''
  };
  Object.entries(values).forEach(([id, value]) => { document.getElementById(id).value = value; });
}

function addToCart(id) {
  const product = productById(id);
  if (!product) return;
  const cart = getCart();
  const item = cart.find(entry => entry.id === id);
  if (item) item.quantity = Math.min(item.quantity + 1, 99);
  else cart.push({ id, quantity: 1 });
  if (!writeStore(STORAGE.cart, cart)) { showToast('Não foi possível salvar a sacola neste navegador.'); return; }
  updateCartCount();
  showToast(`${product.name} adicionado à sacola.`);
}
function changeQuantity(id, delta) {
  const cart = getCart();
  const item = cart.find(entry => entry.id === id);
  if (!item) return;
  item.quantity = Math.min(99, item.quantity + delta);
  if (!writeStore(STORAGE.cart, cart.filter(entry => entry.quantity > 0))) { showToast('Não foi possível atualizar a sacola.'); return; }
  updateCartCount();
  renderCart();
}
function removeFromCart(id) {
  if (!writeStore(STORAGE.cart, getCart().filter(item => item.id !== id))) { showToast('Não foi possível atualizar a sacola.'); return; }
  updateCartCount();
  renderCart();
  showToast('Item removido da sacola.');
}
async function saveOrder(user, cart, paymentMethod, totals) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('orders', 'readwrite');
    const store = transaction.objectStore('orders');
    const allOrders = store.getAll();
    let order;
    allOrders.onsuccess = () => {
      const nextItemId = allOrders.result.reduce((maximum, existing) =>
        existing.items.reduce((itemMaximum, item) => Math.max(itemMaximum, item.id || 0), maximum), 0) + 1;
      order = {
        total_price: totals.total,
        User_id: user.id,
        created_at: new Date().toISOString(),
        status: 'Recebido',
        subtotal: totals.subtotal,
        delivery: totals.delivery,
        items: cart.map((item, index) => {
          const product = productById(item.id);
          return {
            id: nextItemId + index,
            Product_id: product.databaseId,
            Orders_id: null,
            qty: item.quantity,
            price: product.price,
            product_name: product.name
          };
        }),
        payment: { id: null, Orders_id: null, method: paymentMethod }
      };
      const addRequest = store.add(order);
      addRequest.onsuccess = () => {
        order.id = addRequest.result;
        order.items.forEach(item => { item.Orders_id = order.id; });
        order.payment.id = order.id;
        order.payment.Orders_id = order.id;
        store.put(order);
      };
      addRequest.onerror = () => reject(addRequest.error);
    };
    allOrders.onerror = () => reject(allOrders.error);
    transaction.oncomplete = () => resolve(order);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('O pedido não foi salvo.'));
  });
}
async function completeCheckout() {
  const cart = getCart();
  if (!cart.length) return;
  const user = await getUser();
  if (!user) {
    window.location.href = 'login.html?next=carrinho.html';
    return;
  }
  const paymentMethod = document.getElementById('paymentMethod')?.value || '';
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    showToast('Selecione uma forma de pagamento válida.');
    return;
  }
  const totals = cartTotals(cart);
  if (totals.total > 999.99) {
    showToast('O total excede o limite de R$ 999,99 por pedido.');
    return;
  }
  try { await saveOrder(user, cart, paymentMethod, totals); }
  catch (error) {
    console.error(error);
    showToast('Não foi possível registrar o pedido. Sua sacola continua salva.');
    return;
  }
  if (!writeStore(STORAGE.cart, [])) { showToast('Pedido registrado, mas a sacola não foi limpa. Revise-a antes de finalizar novamente.'); }
  window.location.href = 'pedidos.html';
}

function onlyDigits(value) { return value.replace(/\D/g, ''); }
function maskValue(type, raw) {
  const digits = onlyDigits(raw);
  if (type === 'phone') {
    const limited = digits.slice(0, 11);
    if (limited.length <= 2) return limited ? `(${limited}` : '';
    if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
    const split = limited.length > 10 ? 7 : 6;
    return `(${limited.slice(0, 2)}) ${limited.slice(2, split)}-${limited.slice(split)}`;
  }
  return raw;
}
function formatFormInput(input) {
  if (input.dataset.mask) input.value = maskValue(input.dataset.mask, input.value);
  else if (input.hasAttribute('data-numeric')) input.value = onlyDigits(input.value).slice(0, Number(input.maxLength) || 99);
}
function serializeUser(form) {
  const data = new FormData(form);
  return {
    name: String(data.get('name') || '').trim(),
    email: String(data.get('email') || '').trim().toLocaleLowerCase('pt-BR'),
    phone: String(data.get('phone') || ''),
    city: String(data.get('city') || '').trim(),
    district: String(data.get('district') || '').trim(),
    addressNumber: String(data.get('addressNumber') || '').trim(),
    street: String(data.get('street') || '').trim()
  };
}
async function verifyLegacyPassword(password, record) {
  if (!crypto?.subtle || typeof record !== 'string') return false;
  const [saltHex, verifierHex] = record.split(':');
  if (!/^[a-f0-9]{32}$/.test(saltHex) || !/^[a-f0-9]{64}$/.test(verifierHex)) return false;
  const salt = Uint8Array.from(saltHex.match(/.{2}/g), byte => parseInt(byte, 16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256));
  const verifier = Uint8Array.from(verifierHex.match(/.{2}/g), byte => parseInt(byte, 16));
  return bits.every((value, index) => value === verifier[index]);
}
function setFormError(form, message) {
  const error = form?.querySelector('.form-error');
  if (error) error.textContent = message;
}
async function handleRegister(form) {
  const data = serializeUser(form);
  const password = String(new FormData(form).get('password') || '');
  if (data.name.length < 2 || data.name.length > 45) return setFormError(form, 'O nome deve ter entre 2 e 45 caracteres.');
  if (data.email.length > 45 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return setFormError(form, 'Confira o formato do e-mail (até 45 caracteres).');
  if (onlyDigits(data.phone).length < 10) return setFormError(form, 'Informe um telefone com DDD.');
  if (!data.city || data.city.length > 45) return setFormError(form, 'Informe uma cidade com até 45 caracteres.');
  if (data.district.length > 45) return setFormError(form, 'O bairro pode ter até 45 caracteres.');
  if (!data.addressNumber || data.addressNumber.length > 10) return setFormError(form, 'Informe o número do endereço (até 10 caracteres).');
  if (!data.street || data.street.length > 60) return setFormError(form, 'Informe uma rua com até 60 caracteres.');
  if (password.length < 8) return setFormError(form, 'A senha precisa ter pelo menos 8 caracteres.');
  try {
    const account = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      password,
      addresses: [{
        id: null,
        User_id: null,
        city: data.city,
        district: data.district || null,
        street: data.street,
        house_number: data.addressNumber
      }]
    };
    const database = await openDatabase();
    const transaction = database.transaction('users', 'readwrite');
    const request = transaction.objectStore('users').add(account);
    request.onsuccess = () => {
      account.id = request.result;
      account.addresses[0].id = account.id;
      account.addresses[0].User_id = account.id;
      transaction.objectStore('users').put(account);
    };
    await new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Cadastro não salvo.'));
    });
    if (!setSessionId(account.id)) return setFormError(form, 'Cadastro salvo, mas não foi possível iniciar a sessão. Tente entrar.');
    window.location.href = 'perfil.html';
  } catch (error) {
    console.error(error);
    setFormError(form, error.name === 'ConstraintError'
      ? 'Essa conta já existe neste navegador. Entre na sua conta.'
      : 'Não foi possível salvar o cadastro no banco deste navegador. Confira o suporte a IndexedDB.');
  }
}
async function handleLogin(form) {
  const data = new FormData(form);
  const email = String(data.get('email') || '').trim().toLocaleLowerCase('pt-BR');
  const password = String(data.get('password') || '');
  try {
    const user = await databaseRequest('users', 'readonly', store => store.index('email').get(email));
    if (!user) return setFormError(form, 'E-mail ou senha incorretos.');
    const validPassword = typeof user.password === 'string'
      ? user.password === password
      : await verifyLegacyPassword(password, user.password_hash);
    if (!validPassword) return setFormError(form, 'E-mail ou senha incorretos.');
    if (typeof user.password !== 'string') {
      user.password = password;
      delete user.password_hash;
      await databaseRequest('users', 'readwrite', store => store.put(user));
    }
    if (!setSessionId(user.id)) return setFormError(form, 'Não foi possível iniciar a sessão neste navegador.');
    const requested = new URLSearchParams(window.location.search).get('next');
    const next = ['carrinho.html', 'pedidos.html', 'perfil.html'].includes(requested) ? requested : 'perfil.html';
    window.location.href = next;
  } catch (error) {
    console.error(error);
    setFormError(form, 'Não foi possível consultar o banco local deste navegador.');
  }
}
async function handleProfileSave(form) {
  let existing;
  try { existing = await getUser(); }
  catch (error) {
    console.error(error);
    setFormError(form, 'Não foi possível consultar os dados locais da conta.');
    return;
  }
  if (!existing) return;
  const data = serializeUser(form);
  if (data.name.length < 2 || data.name.length > 45) return setFormError(form, 'O nome deve ter entre 2 e 45 caracteres.');
  if (data.email.length > 45 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return setFormError(form, 'Confira o formato do e-mail (até 45 caracteres).');
  if (data.phone && onlyDigits(data.phone).length < 10) return setFormError(form, 'Confira o telefone com DDD.');
  if (!data.city || data.city.length > 45) return setFormError(form, 'Informe uma cidade com até 45 caracteres.');
  if (data.district.length > 45) return setFormError(form, 'O bairro pode ter até 45 caracteres.');
  if (!data.addressNumber || data.addressNumber.length > 10 || !data.street || data.street.length > 60) return setFormError(form, 'Confira rua e número do endereço.');
  const address = existing.addresses?.[0] || { id: existing.id, User_id: existing.id };
  Object.assign(address, {
    city: data.city,
    district: data.district || null,
    street: data.street,
    house_number: data.addressNumber
  });
  delete address.cep;
  delete address.complement;
  const updated = {
    id: existing.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    addresses: [address]
  };
  if (typeof existing.password === 'string') updated.password = existing.password;
  else if (typeof existing.password_hash === 'string') updated.password_hash = existing.password_hash;
  try {
    await databaseRequest('users', 'readwrite', store => store.put(updated));
    await renderProfile();
    showToast('Dados atualizados.');
  } catch (error) {
    console.error(error);
    setFormError(form, error.name === 'ConstraintError' ? 'Esse e-mail já está sendo usado.' : 'Não foi possível salvar as alterações neste navegador.');
  }
}

async function exportJson(storeName, filename) {
  try {
    const records = await getAllFromDatabase(storeName);
    const blob = new Blob([`${JSON.stringify(records, null, 2)}\n`], { type: 'application/json' });
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error(error);
    showToast(`Não foi possível exportar ${filename}.`);
  }
}

function handleClick(event) {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const { action, id } = control.dataset;
  if (action === 'toggle-theme') {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  } else if (action === 'toggle-menu') {
    const open = nav?.classList.toggle('open') || false;
    control.setAttribute('aria-expanded', String(open));
  } else if (action === 'add') {
    addToCart(id);
  } else if (action === 'category') {
    state.category = control.dataset.category || 'Todos';
    document.querySelectorAll('[data-action="category"]').forEach(button => {
      const active = button.dataset.category === state.category;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    filterCatalog();
  } else if (action === 'quantity') {
    changeQuantity(id, Number(control.dataset.delta) || 0);
  } else if (action === 'remove') {
    removeFromCart(id);
  } else if (action === 'checkout') {
    void completeCheckout().catch(error => {
      console.error(error);
      showToast('Não foi possível consultar os dados locais para finalizar o pedido.');
    });
  } else if (action === 'logout') {
    try { sessionStorage.removeItem(STORAGE.session); } catch { /* A sessão local deixa de valer nesta aba. */ }
    void renderProfile();
    void renderOrders();
    showToast('Você saiu da conta. Seu cadastro local foi preservado.');
  } else if (action === 'export-users') {
    void exportJson('users', 'users.json');
  } else if (action === 'export-orders') {
    void exportJson('orders', 'orders.json');
  }
}
function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === 'heroSearchForm') {
    event.preventDefault();
    const query = String(new FormData(form).get('search') || document.getElementById('heroSearch')?.value || '').trim().slice(0, 60);
    window.location.href = query ? `cardapio.html?q=${encodeURIComponent(query)}` : 'cardapio.html';
  } else if (form.id === 'registerForm') {
    event.preventDefault();
    void handleRegister(form);
  } else if (form.id === 'loginForm') {
    event.preventDefault();
    void handleLogin(form);
  } else if (form.id === 'profileForm') {
    event.preventDefault();
    void handleProfileSave(form);
  }
}
function handleInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.dataset.mask || input.hasAttribute('data-numeric')) formatFormInput(input);
  if (input.id === 'productSearch') {
    state.search = input.value.slice(0, 60);
    filterCatalog();
  }
  if (input.closest('form')?.querySelector('.form-error')?.textContent) setFormError(input.closest('form'), '');
}
async function initializePage() {
  const page = document.body.dataset.page;
  closeMenu();
  document.querySelectorAll('[data-route]').forEach(link => {
    const active = link.dataset.route === page;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  try { setTheme(localStorage.getItem(STORAGE.theme) || 'dark'); }
  catch { setTheme('dark'); }
  const currentYear = document.getElementById('currentYear');
  if (currentYear) currentYear.textContent = String(new Date().getFullYear());
  if (page === 'cardapio') renderCatalogProducts();
  if (page === 'carrinho') renderCart();
  if (page === 'pedidos') await renderOrders();
  if (page === 'perfil') await renderProfile();
  updateCartCount();
}

document.addEventListener('click', handleClick);
document.addEventListener('submit', handleSubmit);
document.addEventListener('input', handleInput);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
initializePage().catch(error => {
  console.error(error);
  showToast('Não foi possível abrir o banco de dados deste navegador.');
});
