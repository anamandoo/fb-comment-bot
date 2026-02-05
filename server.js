import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "123456";

// Put ALL page tokens here as JSON: {"PAGE_ID":"PAGE_TOKEN", ...}
const PAGE_TOKENS_JSON = process.env.PAGE_TOKENS_JSON || "{}";

// Optional: human-like delay
const REPLY_DELAY_MS = Number(process.env.REPLY_DELAY_MS || "1200");

// Random replies (no keyword rules)
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
  "Stay tuned for more cuteness! ✨"
];

function pickReply() {
  return REPLIES[Math.floor(Math.random() * REPLIES.length)];
}

// Parse tokens map
let PAGE_TOKENS = {};
try {
  PAGE_TOKENS = JSON.parse(PAGE_TOKENS_JSON);
} catch {
  PAGE_TOKENS = {};
  console.error("PAGE_TOKENS_JSON is not valid JSON");
}

// De-dupe: reply ONCE per comment id (prevents Meta retries causing multiple replies)
const handledCommentIds = new Set();
const CACHE_MAX = 8000;

function lockComment(commentId) {
  handledCommentIds.add(commentId);
  if (handledCommentIds.size > CACHE_MAX) {
    const first = handledCommentIds.values().next().value;
    handledCommentIds.delete(first);
  }
}

app.get("/", (req, res) => res.status(200).send("OK"));

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

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
  return graphPost(`${commentId}/comments`, { message }, pageAccessToken);
}

async function likeComment(commentId, pageAccessToken) {
  return graphPost(`${commentId}/likes`, {}, pageAccessToken);
}

app.post("/webhook", async (req, res) => {
  // ACK fast
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body?.object !== "page") return;

    for (const entry of body.entry || []) {
      const pageId = String(entry.id);
      const pageToken = PAGE_TOKENS[pageId];

      if (!pageToken) {
        console.log("No token for pageId:", pageId);
        continue;
      }

      for (const change of entry.changes || []) {
        if (change.field !== "feed") continue;

        const v = change.value || {};
        const item = v.item;            // "comment"
        const verb = v.verb;            // "add"
        const commentId = v.comment_id;
        const fromId = v.from?.id;
        const commentText = v.message || "";

        // Only new comments
        if (item !== "comment" || verb !== "add" || !commentId) continue;

        // Avoid replying to the page itself
        if (fromId && String(fromId) === pageId) continue;

        // De-dupe lock immediately
        if (handledCommentIds.has(commentId)) continue;
        lockComment(commentId);

        console.log("New comment:", { pageId, commentId, commentText });

        setTimeout(async () => {
          try {
            // Like (best-effort)
            try {
              await likeComment(commentId, pageToken);
              console.log("Liked:", { pageId, commentId });
            } catch (e) {
              console.log("Like failed (ignored):", e?.message || e);
            }

            // Reply (random)
            const replyText = pickReply();
            const r = await replyToComment(commentId, replyText, pageToken);
            console.log("Replied:", { pageId, commentId, r });
          } catch (e) {
            console.error("Reply flow failed:", e?.message || e);
            // Optional: allow retry if failed
            // handledCommentIds.delete(commentId);
          }
        }, REPLY_DELAY_MS);
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err?.message || err);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));        // Only new comments
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
