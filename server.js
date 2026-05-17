const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors());

app.get("/", (req, res) => {
  res.send("Backend Running");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Client connected");

  const interval = setInterval(() => {
    const marketData = {
      AAPL: {
        price: (180 + Math.random() * 20).toFixed(2),
        change: (Math.random() * 4 - 2).toFixed(2),
      },

      TSLA: {
        price: (170 + Math.random() * 20).toFixed(2),
        change: (Math.random() * 4 - 2).toFixed(2),
      },

      BTC: {
        price: (80000 + Math.random() * 2000).toFixed(2),
        change: (Math.random() * 6 - 3).toFixed(2),
      },

      ETH: {
        price: (2200 + Math.random() * 200).toFixed(2),
        change: (Math.random() * 4 - 2).toFixed(2),
      },
    };

    socket.emit("marketData", marketData);

    console.log("Sent market data");
  }, 2000);

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    clearInterval(interval);
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});