import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.get("/", (req, res) => {
  res.send("Backend Running");
});

async function fetchMarketData() {
  try {
    const API_KEY = "90ff14df06ec4e0ab4f861ff008b41c1";

    // STOCK DATA
    const stockResponse = await fetch(
      `https://api.twelvedata.com/quote?symbol=AAPL,TSLA&apikey=${API_KEY}`
    );

    const stockData = await stockResponse.json();

    // CRYPTO DATA
    const cryptoResponse = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true"
    );

    const crypto = await cryptoResponse.json();

    const data = {
      AAPL: {
        price: parseFloat(stockData.AAPL.close),
        change: parseFloat(stockData.AAPL.percent_change),
      },

      TSLA: {
        price: parseFloat(stockData.TSLA.close),
        change: parseFloat(stockData.TSLA.percent_change),
      },

      BTC: {
        price: crypto.bitcoin.usd,
        change: parseFloat(
          crypto.bitcoin.usd_24h_change.toFixed(2)
        ),
      },

      ETH: {
        price: crypto.ethereum.usd,
        change: parseFloat(
          crypto.ethereum.usd_24h_change.toFixed(2)
        ),
      },
    };

    io.emit("marketData", data);

  } catch (err) {
    console.log("ERROR:", err.message);
  }
}

io.on("connection", (socket) => {
  console.log("Client connected");

  fetchMarketData();

  const interval = setInterval(fetchMarketData, 5000);

  socket.on("disconnect", () => {
    clearInterval(interval);
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});