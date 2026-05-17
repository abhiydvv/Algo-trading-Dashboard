const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

app.get("/", (req, res) => {
  res.send("Backend Running");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  console.log("Client connected");

  const interval = setInterval(() => {
    socket.emit("marketData", {
      AAPL: {
        price: (180 + Math.random() * 20).toFixed(2),
        change: (Math.random() * 4 - 2).toFixed(2),
      },
      TSLA: {
        price: (170 + Math.random() * 20).toFixed(2),
        change: (Math.random() * 4 - 2).toFixed(2),
      },
      BTC: {
        price: (100000 + Math.random() * 5000).toFixed(2),
        change: (Math.random() * 4 - 2).toFixed(2),
      },
      ETH: {
        price: (3000 + Math.random() * 300).toFixed(2),
        change: (Math.random() * 4 - 2).toFixed(2),
      },
    });
  }, 2000);

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    clearInterval(interval);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});