io.on("connection", (socket) => {
    console.log("Client connected");
  
    const interval = setInterval(() => {
      socket.emit("marketData", {
        AAPL: {
          price: (180 + Math.random() * 20).toFixed(2),
          change: (Math.random() * 4 - 2).toFixed(2),
        },
  
        TSLA: {
          price: (250 + Math.random() * 30).toFixed(2),
          change: (Math.random() * 4 - 2).toFixed(2),
        },
  
        BTC: {
          price: (60000 + Math.random() * 2000).toFixed(2),
          change: (Math.random() * 4 - 2).toFixed(2),
        },
  
        ETH: {
          price: (3000 + Math.random() * 200).toFixed(2),
          change: (Math.random() * 4 - 2).toFixed(2),
        },
      });
    }, 2000);
  
    socket.on("disconnect", () => {
      clearInterval(interval);
      console.log("Client disconnected");
    });
  });