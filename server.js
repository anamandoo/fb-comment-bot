import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = "123456";

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running");
  });

  // Verify
  app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

          if (mode && token === VERIFY_TOKEN) {
              return res.status(200).send(challenge);
                } else {
                    return res.sendStatus(403);
                      }
                      });

                      // Receive events
                      app.post("/webhook", (req, res) => {
                        console.log("EVENT RECEIVED");
                          res.sendStatus(200);
                          });

                          app.listen(PORT, () => {
                            console.log(`Server running on port ${PORT}`);
                            });
