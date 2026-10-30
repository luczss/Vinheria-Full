
import "./MeasurementChart.css";

function formatValue(value, decimals = 1) {
  if (!Number.isFinite(Number(value))) return "—";

  return Number(value).toLocaleString("pt-BR", {
    maximumFractionDigits: decimals,
  });
}

function MeasurementChart({
  title,
  data = [],
  dataKey,
  unit,
  color = "#722F3F",
  decimals = 1,
}) {
  const points = data
    .filter((item) => Number.isFinite(Number(item[dataKey])))
    .slice(-24);

  const width = 600;
  const height = 220;
  const padding = { top: 20, right: 18, bottom: 32, left: 42 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = points.map((point) => Number(point[dataKey]));
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 1;
  const range = maximum - minimum || 1;

  const getX = (index) =>
    padding.left +
    (points.length <= 1
      ? plotWidth / 2
      : (index / (points.length - 1)) * plotWidth);

  const getY = (value) =>
    padding.top + ((maximum - value) / range) * plotHeight;

  const path = points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";

      return `${command} ${getX(index)} ${getY(Number(point[dataKey]))}`;
    })
    .join(" ");

  const latest = points[points.length - 1];
  const first = points[0];

  const difference =
    latest && first
      ? Number(latest[dataKey]) - Number(first[dataKey])
      : 0;

  return (
    <article className="measurement-chart">
      <div className="measurement-chart-header">
        <div>
          <span className="measurement-chart-eyebrow">
            HISTÓRICO DE MEDIÇÕES
          </span>
          <h3>{title}</h3>
        </div>

        <div className="measurement-chart-current">
          <strong>
            {latest ? formatValue(latest[dataKey], decimals) : "—"}
            <span>{unit}</span>
          </strong>
          <span className="measurement-chart-caption">
            Leitura mais recente
          </span>
        </div>
      </div>

      <div className="measurement-chart-plot">
        {points.length === 0 ? (
          <div className="measurement-chart-empty">
            Aguardando medições...
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Gráfico histórico de ${title}`}
            preserveAspectRatio="none"
          >
            {[0, 1, 2, 3].map((index) => {
              const y = padding.top + (plotHeight / 3) * index;
              const value = maximum - (range / 3) * index;

              return (
                <g key={index}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="#E8E1D8"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="#8A8179"
                    fontSize="10"
                  >
                    {formatValue(value, decimals)}
                  </text>
                </g>
              );
            })}

            {points.length > 1 && (
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {points.map((point, index) => (
              <circle
                key={`${point.timestamp}-${index}`}
                cx={getX(index)}
                cy={getY(Number(point[dataKey]))}
                r={index === points.length - 1 ? 4 : 2}
                fill={color}
              >
                <title>
                  {formatValue(point[dataKey], decimals)}
                  {unit} —{" "}
                  {new Date(point.timestamp).toLocaleTimeString("pt-BR")}
                </title>
              </circle>
            ))}

            <text
              x={padding.left}
              y={height - 8}
              fill="#8A8179"
              fontSize="10"
            >
              {first
                ? new Date(first.timestamp).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </text>

            <text
              x={width - padding.right}
              y={height - 8}
              textAnchor="end"
              fill="#8A8179"
              fontSize="10"
            >
              {latest
                ? new Date(latest.timestamp).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </text>
          </svg>
        )}
      </div>

      <footer className="measurement-chart-footer">
        <span>{points.length} amostras</span>
        <span>
          Variação: {difference > 0 ? "+" : ""}
          {formatValue(difference, decimals)}
          {unit}
        </span>
      </footer>
    </article>
  );
}

export default MeasurementChart;
