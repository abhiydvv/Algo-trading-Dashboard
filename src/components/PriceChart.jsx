import { useEffect, useState } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function PriceChart({ btcPrice }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    setData((prev) => {
      const updated = [
        ...prev,
        {
          time:
            new Date().toLocaleTimeString(),
          price: btcPrice,
        },
      ];

      return updated.slice(-20);
    });
  }, [btcPrice]);

  return (
    <div className="chart-container">
      <h2>BTC Live Chart</h2>

      <ResponsiveContainer
        width="100%"
        height={450}
      >
        <LineChart data={data}>
          <XAxis dataKey="time" />

          <YAxis />

          <Tooltip />

          <Legend />

          <Line
            type="monotone"
            dataKey="price"
            stroke="#00ff99"
            strokeWidth={3}
            dot={false}
            name="BTC Price"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PriceChart;