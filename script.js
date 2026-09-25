(() => {
  'use strict';

  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzEHvRXKX_MSrotdrHXk4Z4tG0BVgwd0wmMjSiCQWZREmEg4ftOaFY3xkQZuzcIo40/exec';
  const form = document.querySelector('#order-form');
  const submitButton = document.querySelector('#submit-button');
  const errorBox = document.querySelector('#form-error');
  const successScreen = document.querySelector('#success-screen');
  const startedAt = document.querySelector('#formStartedAt');
  let submitting = false;
  let timeoutId;

  startedAt.value = String(Date.now());
  form.action = APPS_SCRIPT_URL;

  const selectedValue = (name) => form.querySelector(`[name="${name}"]:checked`)?.value || '';

  function toggleGroup(element, show) {
    element.hidden = !show;
    element.querySelectorAll('input, select, textarea').forEach((field) => {
      field.disabled = !show;
    });
  }

  function updateConditionalFields() {
    const standFlower = selectedValue('product') === 'お祝いスタンド花';
    const receiveOptions = document.querySelector('#receive-method-options');
    const standDateFields = document.querySelector('#stand-date-fields');
    document.querySelector('#receive-heading-text').textContent = standFlower ? 'お届け希望日' : 'お受け取り方法・日時';

    if (standFlower) {
      form.querySelectorAll('[name="receiveMethod"]').forEach((field) => { field.checked = false; });
    }
    toggleGroup(receiveOptions, !standFlower);
    toggleGroup(standDateFields, standFlower);

    document.querySelectorAll('[data-show-when]').forEach((element) => {
      const [name, expected] = element.dataset.showWhen.split(':');
      toggleGroup(element, selectedValue(name) === expected);
    });

    document.querySelectorAll('[data-show-values]').forEach((element) => {
      const [name, rawValues] = element.dataset.showValues.split(':');
      toggleGroup(element, rawValues.split(',').includes(selectedValue(name)));
    });

    document.querySelectorAll('[data-hide-when]').forEach((element) => {
      const [name, expected] = element.dataset.hideWhen.split(':');
      toggleGroup(element, selectedValue(name) !== expected);
    });

    setRequired('productOther', selectedValue('product') === 'その他');
    setRequired('purposeOther', false);
    setRequired('standDate', standFlower);
    const pickup = !standFlower && selectedValue('receiveMethod') === '店頭受け取り';
    const delivery = !standFlower && selectedValue('receiveMethod') === '配送';
    const needsDeliveryInfo = delivery || standFlower;
    const deliveryInfoSection = document.querySelector('#delivery-info-section');
    if (deliveryInfoSection) toggleGroup(deliveryInfoSection, needsDeliveryInfo);
    if (standFlower) {
      const same = document.querySelector('#sameAsCustomer');
      if (same) { same.checked = false; setSameAsCustomer(false); same.closest('.copy-check').hidden = true; }
    } else {
      const same = document.querySelector('#sameAsCustomer');
      if (same) same.closest('.copy-check').hidden = false;
    }
    ['pickupDate', 'pickupTime'].forEach((id) => setRequired(id, pickup));
    ['deliveryDate', 'deliveryTime', 'customerPostal', 'customerAddress'].forEach((id) => setRequired(id, delivery));
    ['recipientName', 'recipientPostal', 'recipientAddress', 'recipientPhone'].forEach((id) => setRequired(id, needsDeliveryInfo));
    form.querySelectorAll('[name="shipping"]').forEach((field) => { field.required = delivery; });
    setRequired('messageContent', ['メッセージカード', '立札'].includes(selectedValue('messageType')) && selectedValue('purpose') !== 'ご自宅用');
    updateMessageContent();
    updateBudgetMinimum();
  }

  function budgetMinimum() {
    const product = selectedValue('product');
    const taxIncluded = selectedValue('tax') === '予算に含む';
    if (product === 'アレンジメント') return 5500;
    if (product === 'お祝いスタンド花') return 33000;
    return 1;
  }

  function budgetErrorMessage(minimum) {
    const product = selectedValue('product');
    if (product === 'アレンジメント') return `アレンジメントのご予算は${minimum.toLocaleString('ja-JP')}円以上で入力してください。`;
    if (product === 'お祝いスタンド花') return `お祝いスタンド花のご予算は${minimum.toLocaleString('ja-JP')}円以上で入力してください。`;
    return 'ご予算は1円以上で入力してください。';
  }

  function updateBudgetMinimum() {
    const field = document.getElementById('budget');
    field.min = String(budgetMinimum());
    field.setCustomValidity('');
  }

  function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function dateAfter(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return formatLocalDate(date);
  }

  function updateDateFieldState(field) {
    field.closest('.date-field-wrap')?.classList.toggle('has-value', Boolean(field.value));
  }

  function setDateMinimums() {
    document.querySelector('#pickupDate').min = dateAfter(1);
    document.querySelector('#deliveryDate').min = dateAfter(2);
    form.querySelectorAll('input[type="date"]').forEach(updateDateFieldState);
  }

  function updateMessageContent() {
    const type = selectedValue('messageType');
    const label = document.querySelector('#message-content-label');
    const field = document.querySelector('#messageContent');
    if (type === 'メッセージカード') {
      label.textContent = 'メッセージカードの記載内容';
      field.placeholder = '例：\nお誕生日おめでとう！\n素敵な一年になりますように。';
    } else if (type === '立札') {
      label.textContent = '立札の記載内容';
      field.placeholder = '例：\n祝 御開店\n〇〇様\n株式会社〇〇　〇〇';
    } else {
      label.textContent = '記載内容';
      field.placeholder = '';
    }
  }

  function setRequired(id, required) {
    const field = document.getElementById(id);
    if (field) field.required = required;
  }

  function normalize(value) {
    return value.replace(/[ー−‐－]/g, '-').replace(/\s/g, '');
  }

  function validateCustomFields() {
    const phoneFields = ['phone', 'recipientPhone'];
    for (const id of phoneFields) {
      const field = document.getElementById(id);
      if (!field || field.disabled || !field.value) continue;
      if (!/^\d{10,11}$/.test(field.value)) {
        field.setCustomValidity('電話番号をハイフンなし10〜11桁の数字で入力してください');
        return field;
      }
      field.setCustomValidity('');
    }
    const budgetField = document.getElementById('budget');
    if (budgetField.value) {
      const minimum = budgetMinimum();
      if (!Number.isFinite(budgetField.valueAsNumber) || budgetField.valueAsNumber < minimum) {
        budgetField.setCustomValidity(budgetErrorMessage(minimum));
        return budgetField;
      }
      budgetField.setCustomValidity('');
    }
    for (const id of ['customerPostal', 'recipientPostal']) {
      const field = document.getElementById(id);
      if (!field || field.disabled || !field.value) continue;
      if (!/^\d{3}-?\d{4}$/.test(normalize(field.value))) {
        field.setCustomValidity('郵便番号を7桁で入力してください。');
        return field;
      }
      field.setCustomValidity('');
    }
    return null;
  }

  const customerToRecipient = {
    customerName: 'recipientName',
    customerPostal: 'recipientPostal',
    customerAddress: 'recipientAddress',
    phone: 'recipientPhone'
  };

  function syncDeliveryFromCustomer() {
    Object.entries(customerToRecipient).forEach(([sourceId, targetId]) => {
      document.getElementById(targetId).value = document.getElementById(sourceId).value;
    });
  }

  function setSameAsCustomer(active) {
    if (active) syncDeliveryFromCustomer();
    Object.values(customerToRecipient).forEach((targetId) => {
      document.getElementById(targetId).readOnly = active;
    });
  }

  function setSubmitting(active) {
    submitting = active;
    submitButton.disabled = active;
    submitButton.querySelector('.button-label').hidden = active;
    submitButton.querySelector('.button-loading').hidden = !active;
  }

  function showError(message) {
    clearTimeout(timeoutId);
    setSubmitting(false);
    errorBox.textContent = message;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('change', updateConditionalFields);
  form.addEventListener('input', (event) => {
    event.target.setCustomValidity?.('');
    if (event.target.matches?.('input[type="date"]')) updateDateFieldState(event.target);
    if (document.querySelector('#sameAsCustomer')?.checked && customerToRecipient[event.target.id]) syncDeliveryFromCustomer();
  });
  form.addEventListener('change', (event) => {
    if (event.target.matches?.('input[type="date"]')) updateDateFieldState(event.target);
    if (event.target.id === 'sameAsCustomer') setSameAsCustomer(event.target.checked);
    if (document.querySelector('#sameAsCustomer')?.checked && customerToRecipient[event.target.id]) syncDeliveryFromCustomer();
  });

  form.addEventListener('submit', (event) => {
    errorBox.hidden = true;
    updateConditionalFields();
    const invalidCustomField = validateCustomFields();

    if (APPS_SCRIPT_URL.includes('YOUR_GOOGLE')) {
      event.preventDefault();
      showError('送信先が未設定です。script.jsのAPPS_SCRIPT_URLを設定してください。');
      return;
    }
    if (invalidCustomField || !form.checkValidity()) {
      event.preventDefault();
      const firstInvalid = invalidCustomField || form.querySelector(':invalid');
      firstInvalid?.reportValidity();
      firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (submitting) {
      event.preventDefault();
      return;
    }
    setSubmitting(true);
    timeoutId = setTimeout(() => showError('送信結果を確認できませんでした。通信環境をご確認のうえ、もう一度お試しください。'), 30000);
  });

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.source !== 'sastr-order-form') return;
    clearTimeout(timeoutId);
    if (data.ok) {
      form.hidden = true;
      successScreen.hidden = false;
      successScreen.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showError(data.message || '送信できませんでした。時間をおいて再度お試しください。');
    }
  });

  setDateMinimums();
  updateConditionalFields();
})();
