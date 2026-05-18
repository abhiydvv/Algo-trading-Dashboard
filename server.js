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

let currentMarketData = {
  AAPL: { price: 0, change: 0 },
  TSLA: { price: 0, change: 0 },
  BTC: { price: 0, change: 0 },
  ETH: { price: 0, change: 0 },
};

async function fetchMarketData() {
  try {
    const API_KEY = "90ff14df06ec4e0ab4f861ff008b41c1";

    // STOCK DATA
    try {
      const stockResponse = await fetch(
        `https://api.twelvedata.com/quote?symbol=AAPL,TSLA&apikey=${API_KEY}`
      );
      const stockData = await stockResponse.json();

      if (stockData.AAPL && stockData.AAPL.close) {
        currentMarketData.AAPL = {
          price: parseFloat(stockData.AAPL.close),
          change: parseFloat(stockData.AAPL.percent_change),
          high: parseFloat(stockData.AAPL.high) || 0,
          low: parseFloat(stockData.AAPL.low) || 0,
          open: parseFloat(stockData.AAPL.open) || 0,
          volume: parseInt(stockData.AAPL.volume) || 0,
        };
      }
      if (stockData.TSLA && stockData.TSLA.close) {
        currentMarketData.TSLA = {
          price: parseFloat(stockData.TSLA.close),
          change: parseFloat(stockData.TSLA.percent_change),
          high: parseFloat(stockData.TSLA.high) || 0,
          low: parseFloat(stockData.TSLA.low) || 0,
          open: parseFloat(stockData.TSLA.open) || 0,
          volume: parseInt(stockData.TSLA.volume) || 0,
        };
      } else if (stockData.code === 429) {
        console.log("TwelveData Rate Limit Exceeded");
      }
    } catch (e) {
      console.log("Stock API Error:", e.message);
    }

    // CRYPTO DATA
    try {
      const cryptoResponse = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true"
      );
      const crypto = await cryptoResponse.json();

      if (crypto.bitcoin) {
        currentMarketData.BTC = {
          price: crypto.bitcoin.usd || currentMarketData.BTC.price,
          change: parseFloat((crypto.bitcoin.usd_24h_change ?? 0).toFixed(2)),
        };
      }
      if (crypto.ethereum) {
        currentMarketData.ETH = {
          price: crypto.ethereum.usd || currentMarketData.ETH.price,
          change: parseFloat((crypto.ethereum.usd_24h_change ?? 0).toFixed(2)),
        };
      }
    } catch (e) {
      console.log("Crypto API Error:", e.message);
    }

    io.emit("marketData", currentMarketData);

  } catch (err) {
    console.log("ERROR:", err.message);
  }
}

io.on("connection", (socket) => {
  console.log("Client connected");

  fetchMarketData();

  const interval = setInterval(fetchMarketData, 10000);

  socket.on("disconnect", () => {
    clearInterval(interval);
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});