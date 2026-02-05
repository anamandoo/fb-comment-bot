import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// لازم يكونوا متحطوطين في Render → Environment
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "123456";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || ""; // Page Access Token

app.get("/", (req, res) => {
  res.send("Server is running");
});

// 1) Webhook Verify (Meta)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2) Receive events + reply to comments
app.post("/webhook", async (req, res) => {
  try {
    // اطبع الحدث عشان نعرف بييجي إزاي
    console.log("EVENT RECEIVED:", JSON.stringify(req.body, null, 2));

    // لازم نرد 200 بسرعة
    res.sendStatus(200);

    // لو مفيش توكن، مش هنعرف نرد
    if (!PAGE_ACCESS_TOKEN) {
      console.log("Missing PAGE_ACCESS_TOKEN in environment variables");
      return;
    }

    const body = req.body;
    if (body.object !== "page") return;

    // Meta بيبعت entries
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        // أحداث التعليقات غالبًا بتوصل عبر feed
        if (change.field === "feed") {
          const v = change.value || {};

          // تعليق جديد
          if (v.item === "comment" && v.verb === "add") {
            const commentId = v.comment_id;
            const msg = (v.message || "").toLowerCase();

            // تجاهل لو مفيش comment id
            if (!commentId) continue;

            // رد جاهز (تقدر تغيّره)
            const reply = pickReply(msg);

            // رد على نفس التعليق
            await replyToComment(commentId, reply);
            console.log("Replied to comment:", commentId);
          }
        }
      }
    }
  } catch (err) {
    console.log("ERROR:", err?.response?.data || err?.message || err);
    // مفيش مشكلة لو حصل error هنا—إحنا أصلاً رجعنا 200
  }
});

function pickReply(message) {
  // ردود بسيطة لمحتوى أطفال بتضحك
  const replies = [
    "Thank you so much! 😊💛",
    "So happy you enjoyed it! 😄✨",
    "Thanks for the love! More cute videos coming soon 💛"
  ];

  if (message.includes("cute") || message.includes("adorable") || message.includes("sweet")) {
    return "Aww thank you! 😊💛";
  }

  return replies[Math.floor(Math.random() * replies.length)];
}

async function replyToComment(commentId, text) {
  // Graph API: POST /{comment-id}/comments
  const url = `https://graph.facebook.com/v19.0/${commentId}/comments`;

  await axios.post(
    url,
    null,
    {
      params: {
        message: text,
        access_token: PAGE_ACCESS_TOKEN
      },
      timeout: 15000
    }
  );
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
