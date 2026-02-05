import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "123456";

// JSON: {"PAGE_ID":"PAGE_ACCESS_TOKEN", "PAGE_ID_2":"TOKEN_2", ...}
const PAGE_TOKENS_JSON = process.env.PAGE_TOKENS_JSON || "{}";

// Delay before replying (ms)
const REPLY_DELAY_MS = Number(process.env.REPLY_DELAY_MS || "1200");

// Random replies (general, no keyword rules)
const REPLIES = [
  "Thank you so much! 😊💛",
  "So happy you enjoyed it! 😄✨",
  "Thanks for the love! More cute videos coming soon 💛",
  "Glad you liked it! 🤍",
  "Appreciate your support! 💫",
  "Happy it made you smile! 😊",
  "More adorable moments on the way! 👶💛",
  "Sending you love! 💛",
  "You’re amazing! 😄",
  "Stay tuned for more cuteness! ✨",
  "Thanks a lot! 💛😊",
  "So sweet of you! 😍✨"
];

function pickReply() {
  return REPLIES[Math.floor(Math.random() * REPLIES.length)];
}

// Parse PAGE_TOKENS_JSON
let PAGE_TOKENS = {};
try {
  PAGE_TOKENS = JSON.parse(PAGE_TOKENS_JSON);
} catch (e) {
  console.error("PAGE_TOKENS_JSON is not valid JSON");
  PAGE_TOKENS = {};
}

// De-dupe cache: reply once per comment id
const handledCommentIds = new Set();
const CACHE_MAX = 12000;

function markHandled(commentId) {
  handledCommentIds.add(commentId);
  if (handledCommentIds.size > CACHE_MAX) {
    const first = handledCommentIds.values().next().value;
    handledCommentIds.delete(first);
  }
}

app.get("/", (req, res) => res.status(200).send("OK"));

// Webhook verify (Meta)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---- Graph helpers ----
async function graphPost(path, bodyObj, pageAccessToken) {
  const url = `https://graph.facebook.com/v24.0/${path}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...bodyObj, access_token: pageAccessToken })
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error("Graph POST error:", { path, data });
    throw new Error(data?.error?.message || "Graph POST failed");
  }
  return data;
}

async function replyToComment(commentId, message, pageAccessToken) {
  // reply as a comment on the comment
  return graphPost(`${commentId}/comments`, { message }, pageAccessToken);
}

async function likeComment(commentId, pageAccessToken) {
  // like the comment
  return graphPost(`${commentId}/likes`, {}, pageAccessToken);
}

// ---- Webhook receiver ----
app.post("/webhook", (req, res) => {
  // ACK fast to avoid retries
  res.sendStatus(200);

  const body = req.body;
  if (!body || body.object !== "page") return;

  for (const entry of body.entry || []) {
    const pageId = String(entry.id);
    const pageToken = PAGE_TOKENS[pageId];

    if (!pageToken) {
      console.log("No token for pageId:", pageId);
      continue; // ✅ this is inside for-loop (OK)
    }

    for (const change of entry.changes || []) {
      if (change.field !== "feed") continue;

      const v = change.value || {};
      const item = v.item;            // "comment"
      const verb = v.verb;            // "add"
      const commentId = v.comment_id;
      const fromId = v.from?.id;

      // Only new comments
      if (item !== "comment" || verb !== "add" || !commentId) continue;

      // Avoid replying to the page itself
      if (fromId && String(fromId) === pageId) continue;

      // De-dupe (Meta may retry)
      if (handledCommentIds.has(commentId)) continue;
      markHandled(commentId);

      console.log("New comment received:", {
        pageId,
        commentId,
        message: v.message || ""
      });

      // Delay reply to look human-ish
      setTimeout(async () => {
        try {
          // Like first (best-effort)
          try {
            await likeComment(commentId, pageToken);
            console.log("Liked:", { pageId, commentId });
          } catch (e) {
            console.log("Like failed (ignored):", e?.message || e);
          }

          // Reply once, random
          const replyText = pickReply();
          const r = await replyToComment(commentId, replyText, pageToken);
          console.log("Replied:", { pageId, commentId, replyText, id: r?.id });
        } catch (e) {
          console.error("Reply flow failed:", e?.message || e);

          // optional: لو عايز تسمح بمحاولة تانية لو فشل:
          // handledCommentIds.delete(commentId);
        }
      }, REPLY_DELAY_MS);
    }
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
