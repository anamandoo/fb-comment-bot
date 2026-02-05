import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "123456";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; // required
const PAGE_ID = process.env.PAGE_ID; // required (the page you want to auto-reply for)

// --- Random replies (no keyword rules) ---
function getReply() {
  const replies = [
    "Thank you so much! 😊💛",
    "So happy you enjoyed it! 😄✨",
    "Thanks for the love! More cute videos coming soon 💛",
    "Glad you liked it! 🤍",
    "Appreciate your support! 💫",
    "Happy it made you smile! 😊",
    "More adorable moments on the way! 👶💛",
    "Sending you love! 💛",
    "You’re amazing! 😄",
    "Stay tuned for more cuteness! ✨"
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

// Optional: small delay to look more human (in milliseconds)
const REPLY_DELAY_MS = Number(process.env.REPLY_DELAY_MS || "1500");

// Simple in-memory de-dupe (prevents replying twice if Meta retries)
const repliedCache = new Set();
const CACHE_MAX = 3000;
function cacheAdd(id) {
  repliedCache.add(id);
  if (repliedCache.size > CACHE_MAX) {
    const first = repliedCache.values().next().value;
    repliedCache.delete(first);
  }
}

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

// Webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Reply to a comment (Graph API)
async function replyToComment(commentId, message) {
  if (!PAGE_ACCESS_TOKEN) throw new Error("Missing PAGE_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/v24.0/${commentId}/comments`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      access_token: PAGE_ACCESS_TOKEN
    })
  });

  const data = await resp.json();

  if (!resp.ok) {
    console.error("Reply API error:", data);
    throw new Error(data?.error?.message || "Reply failed");
  }

  return data;
}

// Receive webhook events
app.post("/webhook", async (req, res) => {
  // Always ACK quickly
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body?.object !== "page") return;

    for (const entry of body.entry || []) {
      // Only handle the page you want (prevents cross-page noise)
      if (PAGE_ID && String(entry.id) !== String(PAGE_ID)) continue;

      for (const change of entry.changes || []) {
        if (change.field !== "feed") continue;

        const v = change.value || {};
        const item = v.item;       // "comment"
        const verb = v.verb;       // "add"
        const commentId = v.comment_id;
        const commentText = v.message || "";
        const fromId = v.from?.id;

        // Only new comments
        if (item !== "comment" || verb !== "add" || !commentId) continue;

        // Avoid replying to the page itself
        if (fromId && PAGE_ID && String(fromId) === String(PAGE_ID)) continue;

        // De-dupe
        if (repliedCache.has(commentId)) continue;

        const replyText = getReply();

        console.log("New comment:", { commentId, commentText });

        // Delay to look more natural
        setTimeout(async () => {
          try {
            const result = await replyToComment(commentId, replyText);
            cacheAdd(commentId);
            console.log("Replied:", result);
          } catch (e) {
            console.error("Reply failed:", e?.message || e);
          }
        }, REPLY_DELAY_MS);
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err?.message || err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});      timeout: 15000
    }
  );
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
