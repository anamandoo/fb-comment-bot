import express from "express";

const app = express();
app.use(express.json());

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send("Server is running");
});

// webhook verify
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "12345";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// استقبال التعليقات
app.post("/webhook", (req, res) => {
  console.log("Event received");
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
