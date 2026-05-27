import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (!allowedOrigins.length || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origem não permitida pelo CORS."));
  }
}));

app.use(express.json({
  limit: "1mb"
}));

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  : null;

function money(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value) || 0);
}

function cleanText(value, limit = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function buildFinancialContext(payload) {
  const profile = payload.profile || {};
  const summary = payload.summary || {};
  const bills = Array.isArray(payload.bills) ? payload.bills : [];
  const expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
  const debts = Array.isArray(payload.debts) ? payload.debts : [];

  const billsText = bills.length
    ? bills.map((bill) => `- ${cleanText(bill.name, 80)}: ${money(bill.value)} vence dia ${bill.day}`).join("\n")
    : "- Nenhuma conta cadastrada.";

  const expensesText = expenses.length
    ? expenses.slice(-20).map((expense) => `- ${cleanText(expense.name, 80)}: ${money(expense.value)} em ${expense.category} no dia ${expense.date}`).join("\n")
    : "- Nenhum gasto cadastrado.";

  const debtsText = debts.length
    ? debts.map((debt) => {
        const late = debt.isLate ? "sim" : "não";
        return `- ${cleanText(debt.name, 80)}: total ${money(debt.total)}, parcela ${money(debt.installment)}, vencimento dia ${debt.day}, atrasada: ${late}, juros: ${debt.interest || "não informado"}`;
      }).join("\n")
    : "- Nenhuma dívida cadastrada.";

  return `
PERFIL:
- Nome: ${cleanText(profile.name || "Usuário", 80)}
- Renda mensal: ${money(summary.income)}
- Contas fixas: ${money(summary.billsTotal)}
- Dívidas do mês: ${money(summary.debtsMonthlyTotal)}
- Gastos do mês: ${money(summary.expensesTotal)}
- Saldo previsto: ${money(summary.available)}
- Limite diário: ${money(summary.dailyLimit)}
- Comprometimento: ${Math.round(Number(summary.commitment) || 0)}%
- Status do mês: ${cleanText(summary.status?.label || "não informado", 80)}

CONTAS:
${billsText}

GASTOS:
${expensesText}

DÍVIDAS:
${debtsText}
`.trim();
}

function buildPrompt(payload) {
  const question = cleanText(payload.question, 600);
  const context = buildFinancialContext(payload);

  return `
Você é Clara, assistente financeira do app ContaComigo.
Responda em português do Brasil, com tom simples, humano, direto e acolhedor.
Seu público pode ter dificuldade em organizar finanças, então explique sem termos difíceis.
Use os dados fornecidos. Não invente contas, valores, datas ou dívidas.
Não prometa investimento, lucro, crédito aprovado ou resultado garantido.
Não dê consultoria financeira profissional; dê orientação educativa e prática.
Quando houver risco de sufoco, priorize: alimentação, moradia, transporte, remédios, contas essenciais e dívidas com juros/atraso.
Se fizer sugestão, seja prática para os próximos 7 dias.
Resposta máxima: 1200 caracteres.

DADOS DO USUÁRIO:
${context}

PERGUNTA DO USUÁRIO:
${question}

RESPONDA COMO CLARA:
`.trim();
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    app: "ContaComigo Clara IA",
    status: "online"
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    hasGeminiKey: Boolean(GEMINI_API_KEY)
  });
});

app.post("/api/clara", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({
        ok: false,
        error: "GEMINI_API_KEY não configurada no servidor."
      });
    }

    const payload = req.body || {};
    const question = cleanText(payload.question, 600);

    if (!question) {
      return res.status(400).json({
        ok: false,
        error: "Pergunta vazia."
      });
    }

    const prompt = buildPrompt(payload);

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt
    });

    const answer = typeof result.text === "function"
      ? result.text()
      : result.text;

    res.json({
      ok: true,
      answer: answer || "Não consegui gerar uma resposta agora. Tente novamente."
    });
  } catch (error) {
    console.error("Erro na Clara IA:", error);

    res.status(500).json({
      ok: false,
      error: "Falha ao consultar a Clara IA."
    });
  }
});

app.listen(PORT, () => {
  console.log(`ContaComigo Clara IA rodando na porta ${PORT}`);
});
