import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();

app.use(cors());

app.get("/", (req, res) => {
  res.send("Backend running");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  console.log("Client connected");

  const interval = setInterval(() => {
    const marketData = {
      AAPL: {
        price: (180 + Math.random() * 10).toFixed(2),
        change: (Math.random() * 4 - 2).toFixed(2),
        signal: Math.random() > 0.5 ? "BUY" : "SELL",
      },

      TSLA: {
        price: (250 + Math.random() * 20).toFixed(2),
        change: (Math.random() * 4 - 2).toFixed(2),
        signal: Math.random() > 0.5 ? "BUY" : "SELL",
      },

      BTC: {
        price: (104000 + Math.random() * 1000).toFixed(2),
        change: (Math.random() * 4 - 2).toFixed(2),
        signal: Math.random() > 0.5 ? "BUY" : "SELL",
      },

      ETH: {
        price: (2400 + Math.random() * 100).toFixed(2),
        change: (Math.random() * 4 - 2).toFixed(2),
        signal: Math.random() > 0.5 ? "BUY" : "SELL",
      },
    };

    socket.emit("marketData", marketData);
  }, 2000);

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    clearInterval(interval);
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});