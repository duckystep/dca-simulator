"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Plus, Trash2, Save, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"

// ---- Chart Colors (distinct) ----
const COLOR_PALETTE = [
  "#1f77b4", // blue
  "#ff7f0e", // orange
  "#2ca02c", // green
  "#d62728", // red
  "#9467bd", // purple
  "#8c564b", // brown
  "#e377c2", // pink
  "#7f7f7f", // gray
  "#bcbd22", // olive
  "#17becf", // cyan
]
const colorForIndex = (i) => COLOR_PALETTE[i % COLOR_PALETTE.length]

function monthlyRate(annual) {
  return Math.pow(1 + Number(annual), 1 / 12) - 1
}

function toTHB(x) {
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function toPercent(x) {
  return `${x.toFixed(2)}%`
}

function simulateDCA({ months, monthlyBudget, assets, which }) {
  const names = assets.map((a) => a.name)
  const allocFrac = (() => {
    const sumPct = assets.reduce((s, a) => s + (Number(a.allocPct) || 0), 0) || 1
    const obj = {}
    assets.forEach((a) => (obj[a.name] = (Number(a.allocPct) || 0) / sumPct))
    return obj
  })()

  const mRates = Object.fromEntries(
    names.map((n) => {
      const a = assets.find((x) => x.name === n)
      const annual = Number(a?.[which]) / 100
      return [n, monthlyRate(annual)]
    }),
  )

  const values = Object.fromEntries(names.map((n) => [n, 0]))
  const rows = []

  for (let m = 0; m < months; m++) {
    names.forEach((n) => {
      const contrib = monthlyBudget * allocFrac[n]
      values[n] = (values[n] + contrib) * (1 + mRates[n])
    })
    const row = { month: m + 1 }
    let total = 0
    names.forEach((n) => {
      row[n] = values[n]
      total += values[n]
    })
    row.Total = total
    rows.push(row)
  }

  const investedByAsset = Object.fromEntries(names.map((n) => [n, monthlyBudget * allocFrac[n] * months]))
  const finalByAsset = Object.fromEntries(names.map((n) => [n, rows[rows.length - 1][n]]))
  const totalInvested = Object.values(investedByAsset).reduce((a, b) => a + b, 0)
  const totalFinal = rows[rows.length - 1].Total

  return { rows, investedByAsset, finalByAsset, totalInvested, totalFinal }
}

function makeCSV(rows) {
  if (!rows?.length) return ""
  const headers = Object.keys(rows[0])
  const lines = [headers.join(",")]
  for (const r of rows) lines.push(headers.map((h) => r[h]).join(","))
  return lines.join("\n")
}

export default function App() {
  const [monthlyBudget, setMonthlyBudget] = useState(10000)
  const [periodMode, setPeriodMode] = useState("years")
  const [periodInput, setPeriodInput] = useState(10)

  const [assets, setAssets] = useState([
    { id: 1, name: "S&P500", allocPct: 50, low: 10, mid: 10, high: 10 },
    { id: 2, name: "NASDAQ100", allocPct: 30, low: 10, mid: 12.5, high: 15 },
    { id: 3, name: "BOND", allocPct: 20, low: 4, mid: 4, high: 4 },
  ])

  function addAsset() {
    const nextId = (assets.at(-1)?.id || 0) + 1
    setAssets((a) => [...a, { id: nextId, name: `ASSET_${nextId}`, allocPct: 0, low: 8, mid: 10, high: 12 }])
  }
  function removeAsset(id) {
    setAssets((a) => a.filter((x) => x.id !== id))
  }

  function updateAsset(id, key, value) {
    const numValue = Number(value)
    if (key === "allocPct" && numValue < 0) return
    if ((key === "low" || key === "mid" || key === "high") && numValue < 0) return
    setAssets((a) => a.map((x) => (x.id === id ? { ...x, [key]: key === "name" ? value : numValue } : x)))
  }

  function normalizeAlloc() {
    const sum = assets.reduce((s, a) => s + (Number(a.allocPct) || 0), 0)
    if (sum === 0) return
    setAssets((a) => a.map((x) => ({ ...x, allocPct: Number((((Number(x.allocPct) || 0) / sum) * 100).toFixed(2)) })))
  }

  const effectiveMonths = useMemo(
    () => (periodMode === "years" ? periodInput * 12 : periodInput),
    [periodMode, periodInput],
  )

  const low = useMemo(
    () => simulateDCA({ months: effectiveMonths, monthlyBudget, assets, which: "low" }),
    [effectiveMonths, monthlyBudget, assets],
  )
  const mid = useMemo(
    () => simulateDCA({ months: effectiveMonths, monthlyBudget, assets, which: "mid" }),
    [effectiveMonths, monthlyBudget, assets],
  )
  const high = useMemo(
    () => simulateDCA({ months: effectiveMonths, monthlyBudget, assets, which: "high" }),
    [effectiveMonths, monthlyBudget, assets],
  )

  const scenarios = { low, mid, high }

  const totalAllocation = assets.reduce((sum, asset) => sum + (Number(asset.allocPct) || 0), 0)

  function downloadCSV(which) {
    const csv = makeCSV(scenarios[which].rows)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `dca_${which}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
             DCA Simulator – Dynamic Assets
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            จำลองการลงทุนแบบ DCA เลือกสินทรัพย์เอง เห็นกราฟและสรุปผลทันที
          </p>
          <a
            href="https://www.facebook.com/T.Jukkitz/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            แจ้ง Bug หรือขอฟีเจอร์ได้ที่นี่
          </a>
        </div>

        {/* Controls */}
        <Card className="rounded-2xl shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="font-semibold text-slate-700">งบลงทุนต่อเดือน (THB)</Label>
                  <Input
                    type="number"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(Math.max(0, Number(e.target.value || 0)))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="font-semibold text-slate-700">ระยะเวลา</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input
                      type="number"
                      value={periodInput}
                      onChange={(e) => setPeriodInput(Math.max(1, Number(e.target.value || 1)))}
                      className="flex-1"
                    />
                    <select
                      className="border rounded-lg px-3 py-2 bg-white min-w-[80px]"
                      value={periodMode}
                      onChange={(e) => setPeriodMode(e.target.value)}
                    >
                      <option value="months">เดือน</option>
                      <option value="years">ปี</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <Label className="font-semibold text-slate-700">Assets Portfolio</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      การจัดสรรรวม:{" "}
                      <span className={`font-medium ${totalAllocation === 100 ? "text-green-600" : "text-amber-600"}`}>
                        {totalAllocation.toFixed(1)}%
                      </span>
                      {totalAllocation !== 100 && <span className="text-amber-600 ml-1">(ควรเป็น 100%)</span>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={normalizeAlloc} size="sm">
                      Normalize to 100%
                    </Button>
                    <Button onClick={addAsset} size="sm">
                      <Plus className="h-4 w-4 mr-1" /> เพิ่ม
                    </Button>
                  </div>
                </div>

                <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
                  <div className="col-span-3">ชื่อสินทรัพย์</div>
                  <div className="col-span-2">จัดสรร (%)</div>
                  <div className="col-span-2">ผลตอบแทนต่ำ (%)</div>
                  <div className="col-span-2">ผลตอบแทนกลาง (%)</div>
                  <div className="col-span-2">ผลตอบแทนสูง (%)</div>
                  <div className="col-span-1">ลบ</div>
                </div>

                <div className="space-y-3">
                  {assets.map((a, idx) => (
                    <div
                      key={a.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white rounded-xl p-3 shadow-sm border border-slate-100"
                    >
                      <div className="md:col-span-3">
                        <Label className="md:hidden text-xs text-muted-foreground">ชื่อสินทรัพย์</Label>
                        <Input
                          value={a.name}
                          onChange={(e) => updateAsset(a.id, "name", e.target.value)}
                          className="mt-1 md:mt-0"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="md:hidden text-xs text-muted-foreground">จัดสรร (%)</Label>
                        <Input
                          type="number"
                          value={a.allocPct}
                          onChange={(e) => updateAsset(a.id, "allocPct", e.target.value)}
                          min="0"
                          max="100"
                          className="mt-1 md:mt-0"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="md:hidden text-xs text-muted-foreground">ผลตอบแทนต่ำ (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={a.low}
                          onChange={(e) => updateAsset(a.id, "low", e.target.value)}
                          min="0"
                          className="mt-1 md:mt-0"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="md:hidden text-xs text-muted-foreground">ผลตอบแทนกลาง (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={a.mid}
                          onChange={(e) => updateAsset(a.id, "mid", e.target.value)}
                          min="0"
                          className="mt-1 md:mt-0"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="md:hidden text-xs text-muted-foreground">ผลตอบแทนสูง (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={a.high}
                          onChange={(e) => updateAsset(a.id, "high", e.target.value)}
                          min="0"
                          className="mt-1 md:mt-0"
                        />
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAsset(a.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-800">เปรียบเทียบ Scenarios</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {["low", "mid", "high"].map((scenario) => {
                const result = scenarios[scenario]
                const profit = result.totalFinal - result.totalInvested
                const roi = ((result.totalFinal - result.totalInvested) / result.totalInvested) * 100
                const isProfit = profit > 0

                return (
                  <div
                    key={scenario}
                    className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-700 capitalize">{scenario} Scenario</h3>
                      {isProfit ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ลงทุนรวม:</span>
                        <span className="font-medium">฿{toTHB(result.totalInvested)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">มูลค่าสุดท้าย:</span>
                        <span className="font-medium">฿{toTHB(result.totalFinal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">กำไร/ขaดทุน:</span>
                        <span className={`font-medium ${isProfit ? "text-green-600" : "text-red-600"}`}>
                          {isProfit ? "+" : ""}฿{toTHB(profit)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ROI:</span>
                        <span className={`font-bold ${isProfit ? "text-green-600" : "text-red-600"}`}>
                          {isProfit ? "+" : ""}
                          {toPercent(roi)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Tabs defaultValue="mid" className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
            <TabsTrigger value="low" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
              Low
            </TabsTrigger>
            <TabsTrigger value="mid" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">
              Mid
            </TabsTrigger>
            <TabsTrigger value="high" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
              High
            </TabsTrigger>
          </TabsList>
          {["low", "mid", "high"].map((key) => {
            const result = scenarios[key]
            const profit = result.totalFinal - result.totalInvested
            const roi = ((result.totalFinal - result.totalInvested) / result.totalInvested) * 100

            return (
              <TabsContent key={key} value={key} className="mt-6">
                <Card className="rounded-2xl shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <h2 className="text-2xl font-bold text-slate-800">
                        Scenario: <span className="capitalize text-blue-600">{key}</span>
                      </h2>
                      <Button onClick={() => downloadCSV(key)} variant="outline" className="gap-2">
                        <Save className="h-4 w-4" /> ดาวน์โหลด CSV
                      </Button>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-slate-50 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">ลงทุนรวม</p>
                        <p className="text-xl font-bold text-slate-700">฿{toTHB(result.totalInvested)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">มูลค่าสุดท้าย</p>
                        <p className="text-xl font-bold text-blue-600">฿{toTHB(result.totalFinal)}</p>
                      </div>
                      <div className={`rounded-lg p-4 ${profit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                        <p className="text-sm text-muted-foreground">กำไร/ขาดทุน</p>
                        <p className={`text-xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {profit >= 0 ? "+" : ""}฿{toTHB(profit)}
                        </p>
                      </div>
                      <div className={`rounded-lg p-4 ${roi >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                        <p className="text-sm text-muted-foreground">ROI</p>
                        <p className={`text-xl font-bold ${roi >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {roi >= 0 ? "+" : ""}
                          {toPercent(roi)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-700 mb-3">รายละเอียดตามสินทรัพย์</h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {assets.map((a, idx) => {
                          const assetProfit = result.finalByAsset[a.name] - result.investedByAsset[a.name]
                          const assetRoi =
                            ((result.finalByAsset[a.name] - result.investedByAsset[a.name]) /
                              result.investedByAsset[a.name]) *
                            100

                          return (
                            <div
                              key={a.id}
                              className="flex justify-between items-center border rounded-xl p-4 bg-white shadow-sm"
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className="inline-block h-4 w-4 rounded-full"
                                  style={{ background: colorForIndex(idx) }}
                                />
                                <div>
                                  <p className="font-medium text-slate-700">{a.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    ลงทุน: ฿{toTHB(result.investedByAsset[a.name])}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-slate-700">฿{toTHB(result.finalByAsset[a.name])}</p>
                                <p
                                  className={`text-xs font-medium ${assetRoi >= 0 ? "text-green-600" : "text-red-600"}`}
                                >
                                  {assetRoi >= 0 ? "+" : ""}
                                  {toPercent(assetRoi)}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={result.rows} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={{ stroke: "#e2e8f0" }} />
                          <YAxis
                            tick={{ fontSize: 12 }}
                            tickLine={{ stroke: "#e2e8f0" }}
                            tickFormatter={(value) => `฿${(value / 1000).toFixed(0)}K`}
                          />
                          <Tooltip
                            formatter={(value, name) => [`฿${toTHB(value)}`, name]}
                            labelFormatter={(label) => `เดือนที่ ${label}`}
                            contentStyle={{
                              backgroundColor: "rgba(255, 255, 255, 0.95)",
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="Total"
                            stroke="#1e293b"
                            strokeWidth={3}
                            dot={false}
                            name="รวมทั้งหมด"
                          />
                          {assets.map((a, idx) => (
                            <Line
                              key={a.id}
                              type="monotone"
                              dataKey={a.name}
                              stroke={colorForIndex(idx)}
                              strokeWidth={2}
                              dot={false}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )
          })}
        </Tabs>

        {/* Alert Note */}
        <Alert className="rounded-2xl border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">หมายเหตุสำคัญ</AlertTitle>
          <AlertDescription className="text-amber-700">
            ผลลัพธ์นี้เป็นเพียงการจำลองด้วยอัตราผลตอบแทนเฉลี่ยคงที่ ไม่ได้สะท้อนความผันผวนจริงของตลาด ใช้เพื่อการศึกษาเท่านั้น
            ไม่ควรใช้แทนคำแนะนำด้านการลงทุนจริง
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
