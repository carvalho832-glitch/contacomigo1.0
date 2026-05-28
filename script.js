const STORAGE_KEY = "contacomigo_pwa_v1";
const CLARA_API_URL = "https://contacomigo1-0.onrender.com/api/clara";

const defaultState = {
  profile: {
    name: "",
    email: "",
    income: 0,
    payDay: ""
  },
  settings: {
    darkMode: false,
    economyMode: false
  },
  bills: [],
  expenses: [],
  debts: []
};

let state = normalizeState(loadState());

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const screenLabels = {
  "screen-home": "Início",
  "screen-setup": "Renda",
  "screen-bills": "Contas",
  "screen-expenses": "Gastos",
  "screen-buy": "Comprar",
  "screen-clara": "Clara",
  "screen-debts": "Dívidas",
  "screen-sufoco": "Sair do Sufoco",
  "screen-account": "Minha conta"
};

function normalizeState(data) {
  return {
    profile: {
      ...defaultState.profile,
      ...(data.profile || {})
    },
    settings: {
      ...defaultState.settings,
      ...(data.settings || {})
    },
    bills: Array.isArray(data.bills) ? data.bills : [],
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    debts: Array.isArray(data.debts) ? data.debts : []
  };
}

function renderIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

function createId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyTheme() {
  document.body.classList.toggle("dark", !!state.settings.darkMode);

  const toggle = $("#darkModeToggle");

  if (toggle) {
    toggle.checked = !!state.settings.darkMode;
  }

  const metaTheme = document.querySelector("#metaThemeColor");

  if (metaTheme) {
    metaTheme.setAttribute(
      "content",
      state.settings.darkMode ? "#071822" : "#ffffff"
    );
  }
}

function parseMoney(value) {
  if (!value) return 0;

  const normalized = String(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  return Number(normalized) || 0;
}

function formatMoney(value) {
  return currency.format(value || 0);
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function getDaysLeftInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return Math.max(1, lastDay - now.getDate() + 1);
}

function isCurrentMonth(dateString) {
  const date = new Date(dateString + "T00:00:00");
  const now = new Date();

  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function getUserFirstName() {
  const name = state.profile.name.trim();

  if (!name) return "";

  return name.split(" ")[0];
}

function getBillDueInfo(day) {
  const now = new Date();
  const dueDay = Number(day);
  const today = now.getDate();

  const diff = dueDay - today;

  if (diff < 0) {
    return {
      text: `Venceu há ${Math.abs(diff)} dia(s)`,
      type: "danger",
      icon: "alert-triangle",
      order: diff
    };
  }

  if (diff === 0) {
    return {
      text: "Vence hoje",
      type: "danger",
      icon: "alert-triangle",
      order: 0
    };
  }

  if (diff <= 3) {
    return {
      text: `Vence em ${diff} dia(s)`,
      type: "warn",
      icon: "clock",
      order: diff
    };
  }

  return {
    text: `Vence em ${diff} dia(s)`,
    type: "ok",
    icon: "check-circle",
    order: diff
  };
}

function getStatusIcon(statusClass) {
  if (statusClass === "success") return "check-circle";
  if (statusClass === "warning") return "alert-triangle";
  if (statusClass === "danger") return "alert-octagon";

  return "info";
}

function getDebtMonthlyTotal() {
  return state.debts.reduce((sum, debt) => {
    return sum + Number(debt.installment || 0);
  }, 0);
}

function getDebtTotalValue() {
  return state.debts.reduce((sum, debt) => {
    return sum + Number(debt.total || 0);
  }, 0);
}

function getLateDebtsCount() {
  return state.debts.filter((debt) => debt.isLate).length;
}

function getSummary() {
  const income = Number(state.profile.income) || 0;

  const billsTotal = state.bills.reduce((sum, bill) => {
    return sum + Number(bill.value);
  }, 0);

  const debtsMonthlyTotal = getDebtMonthlyTotal();

  const currentExpenses = state.expenses.filter((expense) => {
    return isCurrentMonth(expense.date);
  });

  const expensesTotal = currentExpenses.reduce((sum, expense) => {
    return sum + Number(expense.value);
  }, 0);

  const available = income - billsTotal - debtsMonthlyTotal - expensesTotal;
  const daysLeft = getDaysLeftInMonth();
  const dailyLimit = available / daysLeft;

  const commitment = income > 0
    ? ((billsTotal + debtsMonthlyTotal + expensesTotal) / income) * 100
    : 0;

  let status = {
    label: "Configurando",
    className: "neutral",
    insight: "Cadastre sua renda, contas e gastos para a Clara te ajudar."
  };

  if (income > 0) {
    if (available < 0 || commitment >= 95) {
      status = {
        label: "Sufoco",
        className: "danger",
        insight: "Seu mês está no limite. Priorize contas essenciais, dívidas urgentes e evite compras não planejadas."
      };
    } else if (commitment >= 75 || dailyLimit < 40 || getLateDebtsCount() > 0) {
      status = {
        label: "Atenção",
        className: "warning",
        insight: "Seu mês pede cuidado. Dá para organizar, mas evite gastos por impulso e acompanhe suas dívidas."
      };
    } else {
      status = {
        label: "Tranquilo",
        className: "success",
        insight: "Seu mês está respirando melhor. Continue acompanhando seus gastos e compromissos."
      };
    }
  }

  return {
    income,
    billsTotal,
    debtsMonthlyTotal,
    expensesTotal,
    available,
    daysLeft,
    dailyLimit,
    commitment,
    status,
    currentExpenses
  };
}

function renderDashboard() {
  const summary = getSummary();
  const firstName = getUserFirstName();

  $("#welcomeText").textContent = firstName
    ? `Olá, ${firstName}, vamos cuidar do seu dinheiro?`
    : "Olá, vamos cuidar do seu dinheiro?";

  $("#incomeValue").textContent = formatMoney(summary.income);
  $("#billsValue").textContent = formatMoney(summary.billsTotal);
  $("#debtsMonthlyValue").textContent = formatMoney(summary.debtsMonthlyTotal);
  $("#expensesValue").textContent = formatMoney(summary.expensesTotal);
  $("#availableValue").textContent = formatMoney(summary.available);
  $("#dailyLimitValue").textContent = formatMoney(summary.dailyLimit);

  $("#mainInsight").textContent = state.settings.economyMode
    ? `Modo economia ativo. ${summary.status.insight}`
    : summary.status.insight;

  const statusIcon = getStatusIcon(summary.status.className);

  $("#statusPill").innerHTML = `
    <i data-lucide="${statusIcon}"></i>
    ${summary.status.label}
  `;

  const riskBadge = $("#monthRiskBadge");
  riskBadge.className = `badge ${summary.status.className}`;
  riskBadge.innerHTML = `
    <i data-lucide="${statusIcon}"></i>
    ${summary.status.label}
  `;

  const percent = Math.max(0, Math.min(100, summary.commitment));

  $("#commitmentPercent").textContent = `${Math.round(summary.commitment)}%`;
  $("#commitmentBar").style.width = `${percent}%`;

  if (summary.status.className === "success") {
    $("#commitmentBar").style.background = "var(--success)";
  } else if (summary.status.className === "warning") {
    $("#commitmentBar").style.background = "var(--warning)";
  } else if (summary.status.className === "danger") {
    $("#commitmentBar").style.background = "var(--danger)";
  } else {
    $("#commitmentBar").style.background = "var(--secondary)";
  }

  $("#claraHomeText").textContent = generateHomeClaraText(summary);

  renderNextBills();
  renderBillsList();
  renderExpensesList();
  renderCategoryBreakdown();
  renderAccount();
  renderDebts();
  renderSufoco();
  renderIcons();
}

function generateHomeClaraText(summary) {
  const firstName = getUserFirstName();
  const call = firstName ? `${firstName}, ` : "";

  if (summary.income <= 0) {
    return `${call}me diga sua renda mensal e eu começo a montar seu mapa financeiro.`;
  }

  if (summary.available < 0) {
    return `${call}seu mês passou ${formatMoney(Math.abs(summary.available))} do limite. Vamos focar em frear gastos, priorizar dívidas urgentes e proteger o essencial.`;
  }

  if (summary.status.className === "warning") {
    return `${call}você ainda tem ${formatMoney(summary.available)} livres. Isso dá cerca de ${formatMoney(summary.dailyLimit)} por dia.`;
  }

  return `${call}boa! Seu saldo previsto é ${formatMoney(summary.available)}. Seu limite diário está em ${formatMoney(summary.dailyLimit)}.`;
}

function renderNextBills() {
  const container = $("#nextBillsList");

  if (!state.bills.length) {
    container.className = "list empty-list";
    container.textContent = "Nenhuma conta cadastrada ainda.";
    return;
  }

  const bills = [...state.bills]
    .map((bill) => ({
      ...bill,
      due: getBillDueInfo(bill.day)
    }))
    .sort((a, b) => a.due.order - b.due.order)
    .slice(0, 5);

  container.className = "list";
  container.innerHTML = bills.map((bill) => `
    <div class="list-item">
      <div class="item-main">
        <div class="item-icon">
          <i data-lucide="receipt"></i>
        </div>

        <div>
          <strong>${bill.name}</strong>
          <span>${formatMoney(bill.value)} · dia ${bill.day}</span>
          <em class="due-chip ${bill.due.type}">
            <i data-lucide="${bill.due.icon}"></i>
            ${bill.due.text}
          </em>
        </div>
      </div>
    </div>
  `).join("");
}

function renderBillsList() {
  const container = $("#billsList");

  if (!state.bills.length) {
    container.className = "list empty-list";
    container.textContent = "Nenhuma conta cadastrada.";
    return;
  }

  container.className = "list";

  container.innerHTML = state.bills.map((bill) => {
    const due = getBillDueInfo(bill.day);

    return `
      <div class="list-item">
        <div class="item-main">
          <div class="item-icon">
            <i data-lucide="receipt"></i>
          </div>

          <div>
            <strong>${bill.name}</strong>
            <span>${formatMoney(bill.value)} · vence dia ${bill.day}</span>
            <em class="due-chip ${due.type}">
              <i data-lucide="${due.icon}"></i>
              ${due.text}
            </em>
          </div>
        </div>

        <button class="delete-btn" data-delete-bill="${bill.id}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;
  }).join("");

  $$("[data-delete-bill]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteBill;

      state.bills = state.bills.filter((bill) => {
        return bill.id !== id;
      });

      saveState();
      renderDashboard();
    });
  });
}

function renderExpensesList() {
  const container = $("#expensesList");

  if (!state.expenses.length) {
    container.className = "list empty-list";
    container.textContent = "Nenhum gasto cadastrado.";
    return;
  }

  const sorted = [...state.expenses].sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });

  container.className = "list";

  container.innerHTML = sorted.map((expense) => `
    <div class="list-item">
      <div class="item-main">
        <div class="item-icon">
          <i data-lucide="${getCategoryIcon(expense.category)}"></i>
        </div>

        <div>
          <strong>${expense.name}</strong>
          <span>${formatMoney(expense.value)} · ${expense.category} · ${formatDate(expense.date)}</span>
        </div>
      </div>

      <button class="delete-btn" data-delete-expense="${expense.id}">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `).join("");

  $$("[data-delete-expense]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteExpense;

      state.expenses = state.expenses.filter((expense) => {
        return expense.id !== id;
      });

      saveState();
      renderDashboard();
    });
  });
}

function getCategoryIcon(category) {
  const icons = {
    "Alimentação": "utensils",
    "Mercado": "shopping-basket",
    "Transporte": "car",
    "Saúde": "heart-pulse",
    "Casa": "home",
    "Lazer": "smile",
    "Cartão": "credit-card",
    "Outros": "circle-dollar-sign"
  };

  return icons[category] || "circle-dollar-sign";
}

function renderCategoryBreakdown() {
  const container = $("#categoryBreakdown");
  const { currentExpenses } = getSummary();

  if (!currentExpenses.length) {
    container.className = "category-list empty-list";
    container.textContent = "Nenhum gasto neste mês.";
    return;
  }

  const totals = currentExpenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + Number(expense.value);
    return acc;
  }, {});

  const maxValue = Math.max(...Object.values(totals));

  container.className = "category-list";

  container.innerHTML = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, total]) => {
      const width = maxValue > 0 ? (total / maxValue) * 100 : 0;

      return `
        <div class="category-row">
          <div class="category-top">
            <span class="category-name">
              <span class="category-dot"></span>
              ${category}
            </span>

            <span>${formatMoney(total)}</span>
          </div>

          <div class="category-bar">
            <div style="width: ${width}%"></div>
          </div>
        </div>
      `;
    }).join("");
}

function renderAccount() {
  const name = state.profile.name.trim();
  const email = state.profile.email.trim();

  $("#accountDisplayName").textContent = name || "Usuário";
  $("#accountDisplayEmail").textContent = email || "E-mail não cadastrado";

  $("#profileNameInput").value = name;
  $("#profileEmailInput").value = email;

  applyTheme();
}

function getDebtInterestLabel(value) {
  const labels = {
    "nao-sei": "Juros não informados",
    baixo: "Juros baixos",
    medio: "Juros médios",
    alto: "Juros altos"
  };

  return labels[value] || "Juros não informados";
}

function getDebtRiskScore(debt) {
  let score = 0;

  if (debt.isLate) score += 5;
  if (debt.interest === "alto") score += 4;
  if (debt.interest === "medio") score += 2;
  if (debt.priority === "alta") score += 2;

  const due = getBillDueInfo(debt.day);

  if (due.order <= 3) score += 1;

  return score;
}

function getDebtRiskInfo(debt) {
  const score = getDebtRiskScore(debt);

  if (score >= 7) {
    return {
      label: "Prioridade alta",
      className: "high",
      icon: "alert-octagon"
    };
  }

  if (score >= 3) {
    return {
      label: "Atenção",
      className: "medium",
      icon: "alert-triangle"
    };
  }

  return {
    label: "Controlada",
    className: "low",
    icon: "check-circle"
  };
}

function getSortedDebts() {
  return [...state.debts].sort((a, b) => {
    return getDebtRiskScore(b) - getDebtRiskScore(a);
  });
}

function getDebtStrategyText() {
  const totalDebt = getDebtTotalValue();
  const monthlyDebt = getDebtMonthlyTotal();
  const lateCount = getLateDebtsCount();
  const summary = getSummary();
  const sorted = getSortedDebts();

  if (!state.debts.length) {
    return "Cadastre cartão, empréstimo, parcelas ou contas atrasadas. Depois disso, eu te mostro por onde começar.";
  }

  const mainDebt = sorted[0];
  const income = Number(state.profile.income) || 0;
  const monthlyPercent = income > 0 ? (monthlyDebt / income) * 100 : 0;

  if (lateCount > 0) {
    return `Você tem ${lateCount} dívida(s) atrasada(s). Comece por "${mainDebt.name}", porque ela parece ter maior risco. Suas parcelas somam ${formatMoney(monthlyDebt)} por mês.`;
  }

  if (monthlyPercent >= 30) {
    return `Suas parcelas consomem cerca de ${Math.round(monthlyPercent)}% da renda. Antes de assumir novas compras, tente reduzir ou renegociar "${mainDebt.name}".`;
  }

  if (summary.available < 0) {
    return `Seu saldo previsto está negativo. A dívida mais sensível agora é "${mainDebt.name}". Evite novas parcelas até o mês sair do vermelho.`;
  }

  return `Você tem ${formatMoney(totalDebt)} em dívidas cadastradas. A principal atenção agora é "${mainDebt.name}". Continue pagando em dia e evite transformar sobra em nova parcela.`;
}

function renderDebts() {
  const total = getDebtTotalValue();
  const monthly = getDebtMonthlyTotal();
  const lateCount = getLateDebtsCount();

  $("#debtTotalValue").textContent = formatMoney(total);
  $("#debtInstallmentValue").textContent = formatMoney(monthly);
  $("#debtLateValue").textContent = String(lateCount);
  $("#debtStrategyText").textContent = getDebtStrategyText();

  const container = $("#debtsList");

  if (!state.debts.length) {
    container.className = "list empty-list";
    container.textContent = "Nenhuma dívida cadastrada.";
    return;
  }

  container.className = "list";

  container.innerHTML = getSortedDebts().map((debt) => {
    const due = getBillDueInfo(debt.day);
    const risk = getDebtRiskInfo(debt);

    return `
      <div class="list-item">
        <div class="item-main">
          <div class="item-icon">
            <i data-lucide="credit-card"></i>
          </div>

          <div>
            <strong>${debt.name}</strong>
            <span>
              Total ${formatMoney(debt.total)} · Parcela ${formatMoney(debt.installment)} · dia ${debt.day}
            </span>

            <em class="due-chip ${debt.isLate ? "danger" : due.type}">
              <i data-lucide="${debt.isLate ? "alert-triangle" : due.icon}"></i>
              ${debt.isLate ? "Atrasada" : due.text}
            </em>

            <em class="debt-risk-badge ${risk.className}">
              <i data-lucide="${risk.icon}"></i>
              ${risk.label} · ${getDebtInterestLabel(debt.interest)}
            </em>
          </div>
        </div>

        <button class="delete-btn" data-delete-debt="${debt.id}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;
  }).join("");

  $$("[data-delete-debt]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteDebt;

      state.debts = state.debts.filter((debt) => {
        return debt.id !== id;
      });

      saveState();
      renderDashboard();
    });
  });
}

function getCategoryTotals() {
  const { currentExpenses } = getSummary();

  return currentExpenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + Number(expense.value);
    return acc;
  }, {});
}

function getSufocoPlan(summary) {
  if (summary.income <= 0) {
    return [
      "Cadastre sua renda mensal para a Clara entender o tamanho do seu mês.",
      "Adicione suas contas fixas, principalmente aluguel, energia, internet, cartão e parcelas.",
      "Cadastre suas dívidas para saber quais compromissos pesam no mês.",
      "Lance os gastos dos últimos dias para descobrir onde o dinheiro está escapando.",
      "Evite compras parceladas até o painel mostrar seu saldo previsto.",
      "Separe mentalmente o essencial: comida, transporte, remédios e contas básicas.",
      "Use a aba Comprar antes de qualquer gasto fora do planejado."
    ];
  }

  if (summary.available < 0) {
    const deficit = Math.abs(summary.available);
    const dailyRecovery = deficit / 7;

    return [
      "Pause compras não essenciais por 7 dias.",
      "Proteja primeiro alimentação, transporte, remédios e contas básicas.",
      "Veja se há dívidas atrasadas ou com juros altos.",
      "Evite usar cartão até o saldo previsto sair do vermelho.",
      `Tente recuperar cerca de ${formatMoney(dailyRecovery)} por dia nos próximos 7 dias.`,
      "Negocie ou reprograme a dívida que tiver maior risco de juros.",
      "Revise pequenos gastos repetidos, como lanches, delivery, aplicativos e compras por impulso."
    ];
  }

  if (summary.status.className === "warning") {
    return [
      "Defina seu limite diário como regra principal do mês.",
      "Evite compras não essenciais acima do seu limite diário.",
      "Separe as contas e dívidas que vencem nos próximos 5 dias.",
      "Reduza gastos variáveis por uma semana, principalmente lazer, lanches e delivery.",
      "Use a aba Comprar antes de parcelar qualquer coisa.",
      "Reserve uma pequena folga para imprevistos, mesmo que seja pouco.",
      "Revise seus gastos no fim da semana para ajustar a rota."
    ];
  }

  return [
    "Mantenha o acompanhamento do limite diário.",
    "Continue lançando gastos para não perder visibilidade.",
    "Separe uma pequena reserva antes de pensar em compras extras.",
    "Evite transformar sobra em parcela nova.",
    "Planeje compras maiores com antecedência.",
    "Revise as categorias que mais consomem seu dinheiro.",
    "Use este modo sempre que sentir que o mês começou a apertar."
  ];
}

function getCutSuggestions(summary) {
  const totals = getCategoryTotals();
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    return [
      {
        title: "Cadastre seus gastos",
        text: "Sem gastos lançados, a Clara ainda não consegue apontar os vazamentos do mês.",
        icon: "clipboard-pen"
      },
      {
        title: "Segure compras por impulso",
        text: "Até o painel ficar completo, evite gastos fora das contas essenciais.",
        icon: "hand"
      },
      {
        title: "Use o limite diário",
        text: "Depois de cadastrar renda, contas e dívidas, ele vira seu guia para não entrar no sufoco.",
        icon: "calendar-check"
      }
    ];
  }

  const suggestions = entries.slice(0, 3).map(([category, total]) => {
    let text = `Você gastou ${formatMoney(total)} em ${category}. Revise essa categoria por 7 dias.`;

    if (category === "Alimentação" || category === "Mercado") {
      text = `Você gastou ${formatMoney(total)} em ${category}. Faça lista antes de comprar e evite compras pequenas repetidas.`;
    }

    if (category === "Lazer") {
      text = `Você gastou ${formatMoney(total)} em lazer. Reduza temporariamente até o mês respirar.`;
    }

    if (category === "Cartão") {
      text = `Você gastou ${formatMoney(total)} no cartão. Evite novas parcelas enquanto estiver em atenção.`;
    }

    if (category === "Transporte") {
      text = `Você gastou ${formatMoney(total)} com transporte. Veja se dá para agrupar trajetos ou evitar deslocamentos extras.`;
    }

    return {
      title: category,
      text,
      icon: getCategoryIcon(category)
    };
  });

  if (summary.available < 0) {
    suggestions.unshift({
      title: "Corte de emergência",
      text: `Você precisa aliviar ${formatMoney(Math.abs(summary.available))} para sair do vermelho previsto.`,
      icon: "scissors"
    });
  }

  if (getLateDebtsCount() > 0) {
    suggestions.unshift({
      title: "Dívidas atrasadas",
      text: "Priorize as dívidas atrasadas antes de assumir novos gastos ou parcelas.",
      icon: "credit-card"
    });
  }

  return suggestions.slice(0, 4);
}

function renderSufoco() {
  const screen = $("#screen-sufoco");

  if (!screen) return;

  const summary = getSummary();

  $("#sufocoAvailableValue").textContent = formatMoney(summary.available);
  $("#sufocoDailyValue").textContent = formatMoney(summary.dailyLimit);
  $("#sufocoCommitmentValue").textContent = `${Math.round(summary.commitment)}%`;

  const modeBadge = $("#sufocoModeBadge");
  const economyButton = $("#btnActivateEconomy");

  if (state.settings.economyMode) {
    modeBadge.className = "badge danger";
    modeBadge.innerHTML = `
      <i data-lucide="zap"></i>
      Modo economia ativo
    `;

    economyButton.innerHTML = `
      <i data-lucide="pause-circle"></i>
      Desativar modo economia
    `;
  } else {
    modeBadge.className = `badge ${summary.status.className}`;
    modeBadge.innerHTML = `
      <i data-lucide="${getStatusIcon(summary.status.className)}"></i>
      ${summary.status.label}
    `;

    economyButton.innerHTML = `
      <i data-lucide="zap"></i>
      Ativar modo economia
    `;
  }

  if (summary.income <= 0) {
    $("#sufocoMainTitle").textContent = "Primeiro vamos montar seu mapa";
    $("#sufocoMainText").textContent = "Cadastre renda, contas, dívidas e gastos. Aí eu consigo montar um plano de emergência mais certeiro.";
  } else if (summary.available < 0) {
    $("#sufocoMainTitle").textContent = "Sufoco detectado";
    $("#sufocoMainText").textContent = `Seu mês está negativo em ${formatMoney(Math.abs(summary.available))}. Vamos priorizar o essencial, dívidas urgentes e cortar o que está vazando.`;
  } else if (summary.status.className === "warning") {
    $("#sufocoMainTitle").textContent = "Seu mês pede atenção";
    $("#sufocoMainText").textContent = `Você ainda tem ${formatMoney(summary.available)}, mas precisa proteger seu limite diário de ${formatMoney(summary.dailyLimit)}.`;
  } else {
    $("#sufocoMainTitle").textContent = "Seu mês está respirando";
    $("#sufocoMainText").textContent = "Mesmo assim, manter um plano de emergência ajuda a evitar que o sufoco volte pela janela.";
  }

  renderUrgentBillsAndDebts();
  renderSufocoPlan(summary);
  renderCutSuggestions(summary);
}

function renderUrgentBillsAndDebts() {
  const container = $("#sufocoUrgentBills");

  const urgentBills = state.bills
    .map((bill) => ({
      id: bill.id,
      name: bill.name,
      value: bill.value,
      day: bill.day,
      typeLabel: "Conta",
      icon: "receipt",
      due: getBillDueInfo(bill.day)
    }))
    .filter((item) => item.due.order <= 5);

  const urgentDebts = state.debts
    .map((debt) => ({
      id: debt.id,
      name: debt.name,
      value: debt.installment,
      day: debt.day,
      typeLabel: debt.isLate ? "Dívida atrasada" : "Dívida",
      icon: "credit-card",
      due: debt.isLate
        ? {
            text: "Atrasada",
            type: "danger",
            icon: "alert-triangle",
            order: -99
          }
        : getBillDueInfo(debt.day)
    }))
    .filter((item) => item.due.order <= 5);

  const urgentItems = [...urgentDebts, ...urgentBills]
    .sort((a, b) => a.due.order - b.due.order)
    .slice(0, 6);

  if (!urgentItems.length) {
    container.className = "list empty-list";
    container.textContent = "Nenhuma conta ou dívida vencendo nos próximos 5 dias.";
    return;
  }

  container.className = "list";
  container.innerHTML = urgentItems.map((item) => `
    <div class="list-item">
      <div class="item-main">
        <div class="item-icon">
          <i data-lucide="${item.icon}"></i>
        </div>

        <div>
          <strong>${item.name}</strong>
          <span>${item.typeLabel} · ${formatMoney(item.value)} · dia ${item.day}</span>
          <em class="due-chip ${item.due.type}">
            <i data-lucide="${item.due.icon}"></i>
            ${item.due.text}
          </em>
        </div>
      </div>
    </div>
  `).join("");
}

function renderSufocoPlan(summary) {
  const plan = getSufocoPlan(summary);
  const container = $("#sufocoPlanList");

  container.innerHTML = plan.map((item, index) => `
    <li>
      <span>${index + 1}</span>
      <div>${item}</div>
    </li>
  `).join("");
}

function renderCutSuggestions(summary) {
  const suggestions = getCutSuggestions(summary);
  const container = $("#sufocoCutsList");

  container.innerHTML = suggestions.map((item) => `
    <div class="cut-item">
      <div class="cut-icon">
        <i data-lucide="${item.icon}"></i>
      </div>

      <div>
        <strong>${item.title}</strong>
        <p>${item.text}</p>
      </div>
    </div>
  `).join("");
}

function formatDate(dateString) {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("pt-BR");
}

function updateDockCurrentLabel(screenId) {
  const label = $("#currentScreenLabel");

  if (!label) return;

  label.textContent = screenLabels[screenId] || "ContaComigo";
}

function closeSmartDock() {
  const dock = $("#smartDock");
  const toggle = $("#dockToggle");

  if (!dock || !toggle) return;

  dock.classList.remove("open");
  toggle.setAttribute("aria-expanded", "false");
}

function showScreen(screenId) {
  $$(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });

  $$(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.target === screenId);
  });

  updateDockCurrentLabel(screenId);
  closeSmartDock();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  renderIcons();
}

function setupNavigation() {
  const dock = $("#smartDock");
  const dockToggle = $("#dockToggle");

  if (dock && dockToggle) {
    dockToggle.addEventListener("click", () => {
      const isOpen = dock.classList.toggle("open");

      dockToggle.setAttribute("aria-expanded", String(isOpen));
      renderIcons();
    });
  }

  $$(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => {
      showScreen(button.dataset.target);
    });
  });

  $("#btnOpenAccount").addEventListener("click", () => {
    showScreen("screen-account");
  });

  $("#btnOpenSufoco").addEventListener("click", () => {
    showScreen("screen-sufoco");
  });

  $("#btnBackHomeFromSufoco").addEventListener("click", () => {
    showScreen("screen-home");
  });

  $("#btnOpenDebts").addEventListener("click", () => {
    showScreen("screen-debts");
  });

  $("#btnBackHomeFromDebts").addEventListener("click", () => {
    showScreen("screen-home");
  });
}

function setupForms() {
  $("#profileForm").addEventListener("submit", (event) => {
    event.preventDefault();

    state.profile.name = $("#profileNameInput").value.trim();
    state.profile.email = $("#profileEmailInput").value.trim();

    saveState();
    renderDashboard();

    alert("Perfil salvo com sucesso.");
  });

  $("#darkModeToggle").addEventListener("change", (event) => {
    state.settings.darkMode = event.target.checked;

    saveState();
    applyTheme();
    renderIcons();
  });

  $("#btnActivateEconomy").addEventListener("click", () => {
    state.settings.economyMode = !state.settings.economyMode;

    saveState();
    renderDashboard();
  });

  $("#incomeForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const income = parseMoney($("#incomeInput").value);
    const payDay = Number($("#payDayInput").value);

    if (income <= 0) {
      alert("Informe uma renda válida.");
      return;
    }

    state.profile.income = income;
    state.profile.payDay = payDay || "";

    saveState();
    renderDashboard();

    $("#incomeInput").value = "";
    $("#payDayInput").value = "";

    showScreen("screen-home");
  });

  $("#billForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("#billNameInput").value.trim();
    const value = parseMoney($("#billValueInput").value);
    const day = Number($("#billDayInput").value);

    if (!name || value <= 0 || day < 1 || day > 31) {
      alert("Preencha nome, valor e dia de vencimento corretamente.");
      return;
    }

    state.bills.push({
      id: createId(),
      name,
      value,
      day
    });

    saveState();
    renderDashboard();

    $("#billForm").reset();
  });

  $("#expenseDateInput").value = todayISO();

  $("#expenseForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("#expenseNameInput").value.trim();
    const value = parseMoney($("#expenseValueInput").value);
    const category = $("#expenseCategoryInput").value;
    const date = $("#expenseDateInput").value || todayISO();

    if (!name || value <= 0) {
      alert("Preencha descrição e valor do gasto.");
      return;
    }

    state.expenses.push({
      id: createId(),
      name,
      value,
      category,
      date
    });

    saveState();
    renderDashboard();

    $("#expenseNameInput").value = "";
    $("#expenseValueInput").value = "";
    $("#expenseCategoryInput").value = "Alimentação";
    $("#expenseDateInput").value = todayISO();
  });

  $("#debtForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("#debtNameInput").value.trim();
    const total = parseMoney($("#debtTotalInput").value);
    const installment = parseMoney($("#debtInstallmentInput").value);
    const day = Number($("#debtDayInput").value);
    const isLate = $("#debtLateInput").value === "sim";
    const interest = $("#debtInterestInput").value;
    const priority = $("#debtPriorityInput").value;

    if (!name || total <= 0 || installment <= 0 || day < 1 || day > 31) {
      alert("Preencha nome, valor total, parcela e vencimento corretamente.");
      return;
    }

    state.debts.push({
      id: createId(),
      name,
      total,
      installment,
      day,
      isLate,
      interest,
      priority
    });

    saveState();
    renderDashboard();

    $("#debtForm").reset();
  });

  $("#buyForm").addEventListener("submit", (event) => {
    event.preventDefault();
    analyzePurchase();
  });

  $("#chatForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = $("#chatInput");
    const question = input.value.trim();

    if (!question) return;

    input.value = "";
    await handleClaraQuestion(question);
  });

  $$(".quick-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const question = button.dataset.question;

      await handleClaraQuestion(question);
    });
  });

  $("#btnClearData").addEventListener("click", () => {
    const confirmClear = confirm("Deseja apagar todos os dados do ContaComigo?");

    if (!confirmClear) return;

    state = structuredClone(defaultState);

    saveState();
    applyTheme();
    renderDashboard();
    showScreen("screen-home");
  });
}

function analyzePurchase() {
  const name = $("#buyNameInput").value.trim() || "essa compra";
  const value = parseMoney($("#buyValueInput").value);
  const installments = Math.max(1, Number($("#buyInstallmentsInput").value) || 1);
  const type = $("#buyTypeInput").value;

  const result = $("#buyResult");

  if (value <= 0) {
    result.className = "result-card danger";
    result.innerHTML = `
      <div class="result-icon">
        <i data-lucide="alert-triangle"></i>
      </div>

      <h3>Valor inválido</h3>
      <p>Informe o valor da compra para eu conseguir analisar.</p>
    `;

    renderIcons();
    return;
  }

  const summary = getSummary();

  if (summary.income <= 0) {
    result.className = "result-card warning";
    result.innerHTML = `
      <div class="result-icon">
        <i data-lucide="info"></i>
      </div>

      <h3>Cadastre sua renda primeiro</h3>
      <p>Sem a renda mensal, eu não consigo saber se ${name} cabe no seu mês.</p>
    `;

    renderIcons();
    return;
  }

  const monthlyImpact = value / installments;
  const futureAvailable = summary.available - monthlyImpact;
  const futureDaily = futureAvailable / summary.daysLeft;

  let className = "success";
  let icon = "check-circle";
  let title = "Pode comprar com consciência";
  let text = `${name} vai comprometer ${formatMoney(monthlyImpact)} neste mês. Depois disso, seu limite diário ficará em ${formatMoney(futureDaily)}.`;

  if (futureAvailable < 0) {
    className = "danger";
    icon = "alert-octagon";
    title = "Melhor não comprar agora";
    text = `${name} deixaria seu mês negativo em ${formatMoney(Math.abs(futureAvailable))}. Primeiro proteja as contas essenciais e dívidas urgentes.`;
  } else if (futureDaily < 30 && type === "nao-essencial") {
    className = "danger";
    icon = "alert-triangle";
    title = "Compra arriscada";
    text = `${name} não parece uma boa agora. Seu limite diário cairia para ${formatMoney(futureDaily)}, e isso pode te colocar no sufoco.`;
  } else if (futureDaily < 50 || summary.status.className === "warning") {
    className = "warning";
    icon = "alert-triangle";
    title = "Pode, mas com atenção";
    text = `${name} cabe no mês, mas vai apertar. Seu limite diário ficará em ${formatMoney(futureDaily)}. Recomendo compensar cortando outro gasto.`;
  }

  if (installments > 1) {
    text += ` A compra foi considerada em ${installments}x de ${formatMoney(monthlyImpact)}.`;
  }

  result.className = `result-card ${className}`;
  result.innerHTML = `
    <div class="result-icon">
      <i data-lucide="${icon}"></i>
    </div>

    <h3>${title}</h3>
    <p>${text}</p>
  `;

  renderIcons();
}

function buildClaraPayload(question) {
  const summary = getSummary();

  return {
    question,
    profile: {
      name: state.profile.name,
      email: state.profile.email,
      income: state.profile.income,
      payDay: state.profile.payDay
    },
    summary: {
      income: summary.income,
      billsTotal: summary.billsTotal,
      debtsMonthlyTotal: summary.debtsMonthlyTotal,
      expensesTotal: summary.expensesTotal,
      available: summary.available,
      dailyLimit: summary.dailyLimit,
      commitment: summary.commitment,
      status: summary.status
    },
    bills: state.bills,
    expenses: state.expenses,
    debts: state.debts
  };
}

async function askClaraAI(question) {
  try {
    const response = await fetch(CLARA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildClaraPayload(question))
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Falha ao consultar a Clara IA.");
    }

    return data.answer || "Não consegui gerar uma resposta agora. Tente novamente.";
  } catch (error) {
    console.warn("Clara IA indisponível, usando modo local:", error);

    return `${claraLocalAnswer(question)}\n\nObs.: não consegui conectar com a Clara IA agora, então respondi em modo local.`;
  }
}

async function handleClaraQuestion(question) {
  addMessage("user", "Você", question);

  const loadingMessage = addMessage(
    "clara",
    "Clara",
    "Estou analisando seu mês com a IA... só um instantinho."
  );

  renderIcons();

  const answer = await askClaraAI(question);

  loadingMessage.querySelector("p").textContent = answer;

  const container = $("#chatMessages");
  container.scrollTop = container.scrollHeight;

  renderIcons();
}

function addMessage(type, author, text) {
  const container = $("#chatMessages");
  const message = document.createElement("div");

  message.className = `message ${type}`;
  message.innerHTML = `
    <strong>${author}</strong>
    <p>${text}</p>
  `;

  container.appendChild(message);
  container.scrollTop = container.scrollHeight;

  return message;
}

function claraLocalAnswer(question) {
  const summary = getSummary();
  const normalized = question.toLowerCase();
  const firstName = getUserFirstName();
  const call = firstName ? `${firstName}, ` : "";

  if (summary.income <= 0) {
    return `${call}antes de qualquer análise, cadastre sua renda mensal. É como acender a luz antes de procurar a chave: sem isso, a gente anda no escuro.`;
  }

  if (
    normalized.includes("como está") ||
    normalized.includes("meu mês") ||
    normalized.includes("situacao") ||
    normalized.includes("situação")
  ) {
    return `${call}seu mês está em modo ${summary.status.label}. Você tem ${formatMoney(summary.available)} de saldo previsto e pode gastar cerca de ${formatMoney(summary.dailyLimit)} por dia até o fim do mês.`;
  }

  if (
    normalized.includes("economizar") ||
    normalized.includes("guardar") ||
    normalized.includes("sobrar")
  ) {
    if (summary.available <= 0) {
      return `${call}para economizar agora, foque em três travas: pausar compras não essenciais, evitar cartão e reduzir pequenos gastos repetidos por 7 dias.`;
    }

    return `${call}uma meta possível é guardar 10% do saldo previsto, cerca de ${formatMoney(summary.available * 0.1)}. Comece pequeno para não abandonar no terceiro dia.`;
  }

  if (
    normalized.includes("sufoco") ||
    normalized.includes("apertado") ||
    normalized.includes("vermelho")
  ) {
    return `${call}modo sair do sufoco: pague primeiro contas essenciais, veja dívidas atrasadas, evite parcelar novas compras, corte gastos pequenos por 7 dias e acompanhe seu limite diário.`;
  }

  if (
    normalized.includes("dívida") ||
    normalized.includes("divida") ||
    normalized.includes("cartão") ||
    normalized.includes("cartao") ||
    normalized.includes("juros")
  ) {
    return `${call}vá em Minhas dívidas e cadastre tudo que tiver parcela, atraso ou juros. A prioridade costuma ser: dívida atrasada, juros altos, conta essencial e depois parcelas menores.`;
  }

  if (
    normalized.includes("comprar") ||
    normalized.includes("compra") ||
    normalized.includes("posso")
  ) {
    return `${call}use a aba Comprar. Lá eu comparo o valor da compra com seu saldo previsto, suas contas, dívidas e limite diário. É o nosso freio de mão contra impulso.`;
  }

  return `${call}pelo seu cenário atual, seu saldo previsto é ${formatMoney(summary.available)} e seu limite diário é ${formatMoney(summary.dailyLimit)}. Me pergunte sobre economia, dívida, compra ou sufoco que eu te ajudo melhor.`;
}

function hydrateInputs() {
  if (state.profile.income) {
    $("#incomeInput").value = String(state.profile.income).replace(".", ",");
  }

  if (state.profile.payDay) {
    $("#payDayInput").value = state.profile.payDay;
  }

  $("#profileNameInput").value = state.profile.name || "";
  $("#profileEmailInput").value = state.profile.email || "";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
      console.log("Service Worker registrado com sucesso.");
    } catch (error) {
      console.warn("Falha ao registrar Service Worker:", error);
    }
  });
}

function init() {
  applyTheme();
  setupNavigation();
  setupForms();
  hydrateInputs();
  updateDockCurrentLabel("screen-home");
  renderDashboard();
  renderIcons();
  registerServiceWorker();
}

init();