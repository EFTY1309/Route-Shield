import { useMemo } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { dummyCrimes } from "../data/dummyCrimes";
import type { CrimeData } from "../data/dummyCrimes";
import { useTheme } from "../context/ThemeContext";

function Dashboard() {
  const { theme } = useTheme();

  // Calculate crime statistics
  const crimeStats = useMemo(() => {
    const dayCrimes = dummyCrimes.filter(
      (crime: CrimeData) => crime.time_of_day === "Day"
    );
    const nightCrimes = dummyCrimes.filter(
      (crime: CrimeData) => crime.time_of_day === "Night"
    );

    // Crime type breakdown
    const crimeTypeMap = new Map<string, number>();
    dummyCrimes.forEach((crime: CrimeData) => {
      crimeTypeMap.set(
        crime.crime_type,
        (crimeTypeMap.get(crime.crime_type) || 0) + 1
      );
    });

    const crimeTypeData = Array.from(crimeTypeMap.entries()).map(
      ([name, value]) => ({
        name,
        value,
      })
    );

    // Time of day data for bar chart
    const timeData = [
      { name: "Day", crimes: dayCrimes.length },
      { name: "Night", crimes: nightCrimes.length },
    ];

    // Average severity
    const avgSeverity = (
      dummyCrimes.reduce(
        (sum: number, crime: CrimeData) => sum + crime.severity_score,
        0
      ) / dummyCrimes.length
    ).toFixed(1);

    return {
      total: dummyCrimes.length,
      dayCrimes: dayCrimes.length,
      nightCrimes: nightCrimes.length,
      crimeTypeData,
      timeData,
      avgSeverity,
    };
  }, []);

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
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Crime Analytics Dashboard
      </h2>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white shadow-md">
          <div className="text-sm opacity-90">Total Crimes</div>
          <div className="text-3xl font-bold">{crimeStats.total}</div>
          <div className="text-xs opacity-75 mt-1">Last 7 days</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-4 text-white shadow-md">
          <div className="text-sm opacity-90">Avg Severity</div>
          <div className="text-3xl font-bold">{crimeStats.avgSeverity}/10</div>
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
        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
          Recent Crime Hotspots
        </h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {dummyCrimes
            .sort((a, b) => b.severity_score - a.severity_score)
            .slice(0, 8)
            .map((crime) => (
              <div
                key={crime.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {crime.location_name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {crime.crime_type} • {crime.time_of_day}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      crime.severity_score >= 8
                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                        : crime.severity_score >= 6
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200"
                    }`}
                  >
                    {crime.severity_score}/10
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
