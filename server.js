const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(express.json({ limit: '4mb' }));

const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

// ─────────────────────────────────────────────
// CORE CLAUDE HELPER
// ─────────────────────────────────────────────

async function claude(system, user, maxTokens = 1200) {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }]
    })
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  return (await res.json()).content[0].text;
}

function parseJSON(raw) {
  try { return JSON.parse(raw.replace(/```(?:json)?|```/g, '').trim()); }
  catch { return null; }
}

// ─────────────────────────────────────────────
// SYSTEM PROMPTS
// ─────────────────────────────────────────────

const TIMELINE_SYSTEM = `You are a real estate transaction timeline expert. Generate a complete contract-to-close deadline timeline from the provided transaction details.

TIMELINE RULES:
• All deadlines must be specific calendar dates, calculated from the contract date
• Use standard real estate contingency periods if not specified (inspection: 10 days, appraisal: 21 days, loan: 30 days, closing: 30-45 days)
• Account for weekends and holidays when marking deadlines as "business days"
• Mark each milestone with priority level: critical (missing = deal dies), important (missing = major delay), standard (missing = minor delay)
• Include ALL parties responsible for each milestone

RESPOND ONLY WITH VALID JSON:
{
  "transactionSummary": {
    "address": "<string>",
    "contractDate": "<YYYY-MM-DD>",
    "closingDate": "<YYYY-MM-DD>",
    "purchasePrice": <number>,
    "buyerAgent": "<string>",
    "sellerAgent": "<string>"
  },
  "milestones": [
    {
      "id": "<string>",
      "title": "<string>",
      "dueDate": "<YYYY-MM-DD>",
      "daysFromContract": <number>,
      "priority": "<critical|important|standard>",
      "responsible": ["<buyer|seller|buyer_agent|seller_agent|lender|title|inspector|appraiser>"],
      "description": "<what needs to happen>",
      "status": "pending",
      "category": "<inspection|appraisal|financing|title|closing|disclosure|other>"
    }
  ],
  "criticalPathSummary": "<2-3 sentence overview of the most important milestones>",
  "risksIdentified": ["<string>"]
}`;

const COMMUNICATION_SYSTEM = `You are a professional real estate transaction coordinator drafting communications. You write clear, professional, warm emails and messages for every stage of a real estate transaction.

COMMUNICATION STANDARDS:
• Professional but human — never cold or robotic
• Include all relevant details without being overwhelming
• Clear call-to-action in every message
• Use [BRACKETS] for fields to customize
• Always include a "next steps" element so recipients know what's expected of them
• Adapt tone to recipient — more formal for lenders/title, warmer for buyers/sellers

MESSAGE TYPES AND GUIDELINES:

welcome_buyer: Warm introduction, transaction overview, what to expect, your role, key contact info
welcome_seller: Similar but seller-focused — what they need to do, timeline overview
inspection_scheduled: Details, what to expect, who attends, typical duration, post-inspection process
inspection_results: Diplomatic — acknowledge concerns, next steps, negotiation framing
appraisal_ordered: What it is, timeline, what it means for the deal
appraisal_results: Results summary, impact on transaction, next steps
loan_update: Status, remaining conditions, timeline to clear
weekly_update: Progress summary, what's done, what's pending, what's needed from them
contingency_removal: Formal notice, what it means, urgency if applicable
closing_disclosure: CD explanation, what to review, timeline to clear-to-close
closing_instructions: Final checklist — what to bring, wire instructions reminder, timeline day-of
closing_complete: Congratulations, final items (keys, utilities, records), review request

RESPOND WITH ONLY THE EMAIL CONTENT — subject line on line 1 prefixed "Subject:", blank line, then body. End with signature placeholder [YOUR NAME | YOUR TITLE | PHONE].`;

const CONTRACT_SYSTEM = `You are a real estate contract review assistant. Analyze the provided contract details and extract key information, flag potential issues, and summarize critical terms.

REVIEW CATEGORIES:
• Key dates and deadlines
• Financial terms (price, earnest money, concessions, credits)
• Contingencies and conditions
• Unusual or non-standard clauses
• Missing standard protections
• Potential negotiation points
• Compliance concerns

RESPOND ONLY WITH VALID JSON:
{
  "keyTerms": {
    "purchasePrice": <number or null>,
    "earnestMoney": <number or null>,
    "closingDate": "<string or null>",
    "possessionDate": "<string or null>",
    "inspectionPeriod": "<string or null>",
    "financingContingency": "<string or null>",
    "appraisalContingency": "<string or null>",
    "sellerConcessions": <number or null>
  },
  "contingencies": [
    { "type": "<string>", "deadline": "<string>", "terms": "<string>", "status": "<active|pending|waived>" }
  ],
  "flags": [
    { "severity": "<critical|warning|info>", "item": "<string>", "detail": "<string>", "action": "<string>" }
  ],
  "missingItems": ["<string>"],
  "unusualClauses": ["<string>"],
  "summary": "<3-4 sentence professional assessment>",
  "recommendedActions": ["<string>"]
}`;

const DEADLINE_ALERT_SYSTEM = `You are a real estate transaction deadline monitoring assistant. Analyze the upcoming deadlines and generate a prioritized alert summary with specific action items for each.

Be specific, direct, and action-oriented. Agents are busy — get to the point.
Each alert should include: what's due, when, who's responsible, and exactly what needs to happen.

RESPOND ONLY WITH VALID JSON:
{
  "alertLevel": "<red|amber|green>",
  "summary": "<1-2 sentence overview>",
  "alerts": [
    {
      "id": "<string>",
      "urgency": "<overdue|due_today|due_48hrs|due_7days>",
      "title": "<string>",
      "dueDate": "<string>",
      "responsible": "<string>",
      "action": "<specific action needed>",
      "consequence": "<what happens if missed>",
      "contactTo": "<who to contact>"
    }
  ],
  "completedItems": ["<string>"],
  "onTrackSummary": "<what's going well>"
}`;

const TC_ASSISTANT_SYSTEM = `You are CloseTrack AI, an expert real estate transaction coordinator assistant. You have deep knowledge of:

• Real estate transaction processes from contract to close
• State-specific real estate law context (general — always recommend verifying with local broker/attorney)
• Document requirements and compliance
• Negotiation strategies for contingencies
• Title and escrow processes
• Lender timelines and common delays
• Inspection negotiation tactics
• Communication best practices with all parties
• Problem-solving for common deal complications

RESPONSE STYLE:
• Direct and actionable — TCs and agents are busy
• Use bullet points for multi-step guidance
• Under 250 words unless a template is requested
• Always include a "what to do next" conclusion
• For legal questions: provide general guidance, recommend consulting broker or attorney
• For deal complications: present options with pros/cons`;

// ─────────────────────────────────────────────
// LICENSE KEY SYSTEM
// ─────────────────────────────────────────────

const KEY_DB = new Map([
  ['CT-DEMO-00000000', { tier: 'agent', name: 'Demo Agent', active: true, transactions: 5 }],
]);

function genKey(tier) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let k = '';
  for (let i = 0; i < 8; i++) k += chars[Math.floor(Math.random() * chars.length)];
  return `CT-${tier.slice(0,4).toUpperCase()}-${k}`;
}

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ ok: true, product: 'CloseTrack AI', v: '1.0.0' }));

app.post('/api/validate-key', (req, res) => {
  const key = req.body?.key?.toUpperCase().trim();
  const data = KEY_DB.get(key);
  if (!data?.active) return res.json({ valid: false });
  res.json({ valid: true, tier: data.tier, name: data.name, transactions: data.transactions });
});

// ── TIMELINE GENERATOR ──
app.post('/api/timeline', async (req, res) => {
  const { key, transaction } = req.body;
  if (!KEY_DB.get(key?.toUpperCase())?.active) return res.status(401).json({ error: 'Invalid key' });

  const prompt = `Generate a complete transaction timeline for:

Property address: ${transaction.address}
Contract date: ${transaction.contractDate}
Requested closing date: ${transaction.closingDate}
Purchase price: $${transaction.purchasePrice}
Transaction type: ${transaction.type || 'Residential purchase'}
Buyer's agent: ${transaction.buyerAgent || 'Not provided'}
Seller's agent: ${transaction.sellerAgent || 'Not provided'}
Financing type: ${transaction.financing || 'Conventional loan'}
Inspection period: ${transaction.inspectionDays || '10'} days
Any custom deadlines or notes: ${transaction.notes || 'None'}

Generate ALL milestones from contract execution through closing and post-closing items.`;

  try {
    const raw = await claude(TIMELINE_SYSTEM, prompt, 2000);
    const result = parseJSON(raw);
    if (!result) throw new Error('Timeline parse error');
    res.json({ result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── COMMUNICATION GENERATOR ──
app.post('/api/communication', async (req, res) => {
  const { key, type, transaction, recipient, details } = req.body;
  if (!KEY_DB.get(key?.toUpperCase())?.active) return res.status(401).json({ error: 'Invalid key' });

  const prompt = `Generate a ${type.replace(/_/g, ' ')} communication.

Transaction: ${transaction.address || 'Property not specified'}
Recipient: ${recipient || 'Not specified'}
Current stage: ${transaction.stage || 'Under contract'}
Closing date: ${transaction.closingDate || 'Not specified'}
Additional context: ${details || 'None'}
Agent/TC name: ${transaction.agentName || '[Your Name]'}`;

  try {
    const content = await claude(COMMUNICATION_SYSTEM, prompt, 1200);
    res.json({ content, type, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CONTRACT REVIEW ──
app.post('/api/contract-review', async (req, res) => {
  const { key, contractText, transactionType } = req.body;
  if (!KEY_DB.get(key?.toUpperCase())?.active) return res.status(401).json({ error: 'Invalid key' });

  const prompt = `Review this ${transactionType || 'residential purchase'} contract and extract key terms, flag issues, and provide recommendations:\n\n${contractText}`;

  try {
    const raw = await claude(CONTRACT_SYSTEM, prompt, 1500);
    const result = parseJSON(raw);
    if (!result) throw new Error('Contract review parse error');
    res.json({ result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DEADLINE ALERT ENGINE ──
app.post('/api/deadline-alerts', async (req, res) => {
  const { key, milestones, transactionAddress } = req.body;
  if (!KEY_DB.get(key?.toUpperCase())?.active) return res.status(401).json({ error: 'Invalid key' });

  const today = new Date().toISOString().split('T')[0];
  const prompt = `Today is ${today}. Analyze these transaction milestones for ${transactionAddress} and generate a deadline alert report:\n\n${JSON.stringify(milestones, null, 2)}`;

  try {
    const raw = await claude(DEADLINE_ALERT_SYSTEM, prompt, 1000);
    const result = parseJSON(raw);
    if (!result) throw new Error('Alert parse error');
    res.json({ result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TC ASSISTANT ──
app.post('/api/assistant', async (req, res) => {
  const { key, question, context } = req.body;
  if (!KEY_DB.get(key?.toUpperCase())?.active) return res.status(401).json({ error: 'Invalid key' });
  if (!question?.trim()) return res.status(400).json({ error: 'Question required' });

  const ctx = context ? `\nTransaction context: ${JSON.stringify(context)}` : '';
  try {
    const answer = await claude(TC_ASSISTANT_SYSTEM, question.trim() + ctx, 1000);
    res.json({ answer, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN ──
app.post('/api/admin/generate-key', (req, res) => {
  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  const { tier = 'agent', name = 'New User', transactions = 10 } = req.body;
  const key = genKey(tier);
  KEY_DB.set(key, { tier, name, active: true, transactions, createdAt: new Date().toISOString() });
  res.json({ key, tier, name });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`CloseTrack AI API v1.0.0 — port ${PORT}`));
