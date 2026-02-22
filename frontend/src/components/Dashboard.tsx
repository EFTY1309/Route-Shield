import { useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { dummyCrimes } from "../data/dummyCrimes";
import type { CrimeData } from "../data/dummyCrimes";
import { useTheme } from "../context/ThemeContext";
import { fetchCrimeData } from "../services/routeService";

function Dashboard() {
  const { theme } = useTheme();
  const [crimes, setCrimes] = useState<CrimeData[]>(dummyCrimes);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<string>("Loading...");

  // Fetch real crime data from API
  useEffect(() => {
    const loadCrimeData = async () => {
      try {
        setLoading(true);
        const data = await fetchCrimeData();
        if (data && data.length > 0) {
          setCrimes(data);
          setDataSource(
            "Real crime data from Dhaka Metropolitan Police & News Sources (2024-2025)",
          );
        } else {
          setDataSource("Dummy data (API returned empty)");
        }
      } catch (error) {
        console.error("Failed to load crime data:", error);
        setDataSource("Dummy data (API unavailable)");
      } finally {
        setLoading(false);
      }
    };

    loadCrimeData();
  }, []);

  // Calculate crime statistics
  const crimeStats = useMemo(() => {
    const dayCrimes = crimes.filter(
      (crime: CrimeData) => crime.time_of_day === "Day",
    );
    const nightCrimes = crimes.filter(
      (crime: CrimeData) => crime.time_of_day === "Night",
    );

    // Crime type breakdown
    const crimeTypeMap = new Map<string, number>();
    crimes.forEach((crime: CrimeData) => {
      crimeTypeMap.set(
        crime.crime_type,
        (crimeTypeMap.get(crime.crime_type) || 0) + 1,
      );
    });

    const crimeTypeData = Array.from(crimeTypeMap.entries()).map(
      ([name, value]) => ({
        name,
        value,
      }),
    );

    // Time of day data for bar chart
    const timeData = [
      { name: "Day", crimes: dayCrimes.length },
      { name: "Night", crimes: nightCrimes.length },
    ];

    // Average severity
    const avgSeverity = (
      crimes.reduce(
        (sum: number, crime: CrimeData) => sum + crime.severity_score,
        0,
      ) / crimes.length
    ).toFixed(1);

    // Weekly trend data — group crimes by week start date
    const weekMap = new Map<string, number>();
    crimes.forEach((crime: CrimeData) => {
      const date = new Date(crime.date);
      // Round down to Monday of that week
      const day = date.getDay(); // 0=Sun
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diff));
      const key = monday.toISOString().slice(0, 10);
      weekMap.set(key, (weekMap.get(key) || 0) + 1);
    });
    const trendData = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => {
        const [year, month, day] = date.split("-");
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        const label = `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
        return {
          week: `${monthNames[parseInt(month) - 1]} ${parseInt(day)}`,
          fullDate: label,
          crimes: count,
        };
      });

    const weeklyAvg = trendData.length
      ? Math.round(
          trendData.reduce((s, d) => s + d.crimes, 0) / trendData.length,
        )
      : 0;

    // Trend direction: compare last 4 weeks vs previous 4 weeks
    const recent = trendData.slice(-4).reduce((s, d) => s + d.crimes, 0);
    const previous = trendData.slice(-8, -4).reduce((s, d) => s + d.crimes, 0);
    const trendDirection: "rising" | "falling" | "stable" =
      recent > previous + 2
        ? "rising"
        : recent < previous - 2
          ? "falling"
          : "stable";

    return {
      total: crimes.length,
      dayCrimes: dayCrimes.length,
      nightCrimes: nightCrimes.length,
      crimeTypeData,
      timeData,
      avgSeverity,
      trendData,
      weeklyAvg,
      trendDirection,
    };
  }, [crimes]);

  const COLORS = [
    "#ef4444",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
  ];

  const isDark = theme === "dark";
  const textColor = isDark ? "#e5e7eb" : "#374151";
  const gridColor = isDark ? "#374151" : "#e5e7eb";

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Crime Analytics Dashboard
        </h2>
        <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
          {loading ? "Loading..." : dataSource}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white shadow-md">
              <div className="text-sm opacity-90">Total Crimes</div>
              <div className="text-3xl font-bold">{crimeStats.total}</div>
              <div className="text-xs opacity-75 mt-1">Last 7 days</div>
            </div>

            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-4 text-white shadow-md">
              <div className="text-sm opacity-90">Avg Severity</div>
              <div className="text-3xl font-bold">
                {crimeStats.avgSeverity}/10
              </div>
              <div className="text-xs opacity-75 mt-1">Severity index</div>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 text-white shadow-md">
              <div className="text-sm opacity-90">Day Crimes</div>
              <div className="text-3xl font-bold">{crimeStats.dayCrimes}</div>
              <div className="text-xs opacity-75 mt-1">6 AM - 6 PM</div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white shadow-md">
              <div className="text-sm opacity-90">Night Crimes</div>
              <div className="text-3xl font-bold">{crimeStats.nightCrimes}</div>
              <div className="text-xs opacity-75 mt-1">6 PM - 6 AM</div>
            </div>
          </div>

          {/* Safety Trend Over Time */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Weekly Crime Trend
              </h3>
              <span
                className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                  crimeStats.trendDirection === "rising"
                    ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                    : crimeStats.trendDirection === "falling"
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                {crimeStats.trendDirection === "rising"
                  ? "▲ Crime Rising"
                  : crimeStats.trendDirection === "falling"
                    ? "▼ Getting Safer"
                    : "→ Stable"}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Number of crimes reported each week. The{" "}
              <span className="font-medium text-orange-500">dashed line</span>{" "}
              shows the weekly average ({crimeStats.weeklyAvg} crimes). Weeks
              above it were more dangerous than usual.
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={crimeStats.trendData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="crimeGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="week"
                  stroke={textColor}
                  tick={{ fontSize: 11 }}
                  interval={Math.floor(crimeStats.trendData.length / 8)}
                />
                <YAxis
                  stroke={textColor}
                  allowDecimals={false}
                  label={{
                    value: "Crimes",
                    angle: -90,
                    position: "insideLeft",
                    fill: textColor,
                    fontSize: 11,
                    dx: 10,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1f2937" : "#ffffff",
                    border: "1px solid " + gridColor,
                    borderRadius: "8px",
                    color: textColor,
                  }}
                  formatter={(value: number) => [
                    `${value} crime${value !== 1 ? "s" : ""} reported`,
                    "This week",
                  ]}
                  labelFormatter={(_label, payload) =>
                    payload && payload[0]
                      ? `Week of ${(payload[0].payload as { fullDate: string }).fullDate}`
                      : `Week of ${_label}`
                  }
                />
                <ReferenceLine
                  y={crimeStats.weeklyAvg}
                  stroke="#f97316"
                  strokeDasharray="5 3"
                  label={{
                    value: `Avg: ${crimeStats.weeklyAvg}`,
                    fill: "#f97316",
                    fontSize: 11,
                    position: "right",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="crimes"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  fill="url(#crimeGradient)"
                  dot={{ fill: "#ef4444", r: 3, strokeWidth: 0 }}
                  activeDot={{
                    r: 6,
                    stroke: "#ef4444",
                    strokeWidth: 2,
                    fill: "#fff",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-red-400"></span>{" "}
                Weekly crimes
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 border-t-2 border-dashed border-orange-400"></span>{" "}
                Weekly average
              </span>
            </div>
          </div>

          {/* Crime by Time Chart */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Crimes by Time of Day
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={crimeStats.timeData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={textColor} />
                <YAxis stroke={textColor} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1f2937" : "#ffffff",
                    border: "1px solid " + gridColor,
                    borderRadius: "8px",
                    color: textColor,
                  }}
                />
                <Legend wrapperStyle={{ color: textColor }} />
                <Bar dataKey="crimes" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Crime Type Distribution */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Crime Type Distribution
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={crimeStats.crimeTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {crimeStats.crimeTypeData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1f2937" : "#ffffff",
                    border: "1px solid " + gridColor,
                    borderRadius: "8px",
                    color: textColor,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Hotspots */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Recent Crime Hotspots
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Sorted by most recent · top 8
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              The latest reported incidents in Dhaka. Severity shows how serious
              the crime was —{" "}
              <span className="text-red-600 font-medium">Critical</span> means
              immediate danger,{" "}
              <span className="text-orange-500 font-medium">High</span> is
              serious,{" "}
              <span className="text-yellow-500 font-medium">Medium</span> is
              moderate risk.
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {[...crimes]
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime(),
                )
                .slice(0, 8)
                .map((crime, idx) => {
                  const severityLabel =
                    crime.severity_score >= 8
                      ? "Critical"
                      : crime.severity_score >= 6
                        ? "High"
                        : crime.severity_score >= 4
                          ? "Medium"
                          : "Low";
                  const severityColor =
                    crime.severity_score >= 8
                      ? "text-red-600 dark:text-red-400"
                      : crime.severity_score >= 6
                        ? "text-orange-500 dark:text-orange-400"
                        : crime.severity_score >= 4
                          ? "text-yellow-500 dark:text-yellow-400"
                          : "text-green-500 dark:text-green-400";
                  const barColor =
                    crime.severity_score >= 8
                      ? "bg-red-500"
                      : crime.severity_score >= 6
                        ? "bg-orange-400"
                        : crime.severity_score >= 4
                          ? "bg-yellow-400"
                          : "bg-green-400";
                  const timeIcon = crime.time_of_day === "Night" ? "🌙" : "☀️";
                  const formattedDate = new Date(crime.date).toLocaleDateString(
                    "en-GB",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    },
                  );

                  return (
                    <div
                      key={crime.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      {/* Rank */}
                      <div className="text-xs font-bold text-gray-400 dark:text-gray-500 w-5 text-center">
                        #{idx + 1}
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {crime.location_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {crime.crime_type} · {timeIcon} {crime.time_of_day} ·{" "}
                          {formattedDate}
                        </div>
                        {/* Severity bar */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${barColor} transition-all`}
                              style={{ width: `${crime.severity_score * 10}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs font-semibold ${severityColor} w-14 text-right`}
                          >
                            {severityLabel} {crime.severity_score}/10
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
