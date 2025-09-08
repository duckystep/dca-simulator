"use client"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Plus, Trash2, AlertTriangle, Moon, Sun, Share2, Check, Download } from "lucide-react"
import { Switch } from "@/components/ui/switch"

function Navbar({ darkMode, setDarkMode }) {
  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              DCA Simulator
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <>
                  <Moon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Light</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

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
  if (x === undefined || x === null || isNaN(x)) {
    return "0"
  }
  return Number(x).toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function toPercent(x) {
  return `${x.toFixed(2)}%`
}

const simulateDCA = (
  monthlyBudget: number,
  periodMode: "months" | "years",
  periodInput: number,
  assets: Asset[],
  enableFees: boolean,
  tradeFeePct: number,
  enableDividends: boolean,
  dividendYieldPct: number,
  withholdTaxPct: number,
  drip: boolean,
  enableRebalancing: boolean,
  rebalanceFrequency: number,
  scenario: "low" | "mid" | "high" = "mid", // Added scenario parameter
) => {
  const totalMonths = periodMode === "years" ? periodInput * 12 : periodInput

  const assetAllocations: { [key: string]: number } = {}
  let totalAllocation = 0

  assets.forEach((asset) => {
    assetAllocations[asset.name] = asset.allocPct / 100
    totalAllocation += asset.allocPct
  })

  if (totalAllocation !== 100) {
    console.warn("Total asset allocation is not 100%.")
  }

  const monthlyAssetReturns: { [key: string]: number } = {}

  assets.forEach((asset) => {
    const returnRate = scenario === "low" ? asset.low : scenario === "high" ? asset.high : asset.mid
    monthlyAssetReturns[asset.name] = Math.pow(1 + returnRate / 100, 1 / 12) - 1
  })

  const assetValues: { [key: string]: number } = {}
  assets.forEach((asset) => {
    assetValues[asset.name] = 0
  })

  let totalCashDividends = 0

  const rows = []
  for (let month = 1; month <= totalMonths; month++) {
    const year = Math.ceil(month / 12)
    const isYearEnd = month % 12 === 0 || month === totalMonths

    let monthlyDividends = 0
    if (enableDividends) {
      assets.forEach((asset) => {
        monthlyDividends += assetValues[asset.name] * (dividendYieldPct / 100 / 12)
      })
    }

    const netDividends = enableDividends ? monthlyDividends * (1 - withholdTaxPct / 100) : 0

    let isRebalanceMonth = false
    if (enableRebalancing && month > 1 && month % rebalanceFrequency === 0) {
      isRebalanceMonth = true
      let totalValue = 0
      assets.forEach((asset) => {
        totalValue += assetValues[asset.name]
      })

      assets.forEach((asset) => {
        assetValues[asset.name] = totalValue * assetAllocations[asset.name]
      })
    }

    assets.forEach((asset) => {
      let assetInvestment = monthlyBudget * assetAllocations[asset.name]

      if (enableFees) {
        assetInvestment *= 1 - tradeFeePct / 100
      }

      if (enableDividends && drip) {
        assetInvestment += netDividends * assetAllocations[asset.name]
      }

      assetValues[asset.name] += assetInvestment
      assetValues[asset.name] *= 1 + monthlyAssetReturns[asset.name]
    })

    if (enableDividends && !drip) {
      totalCashDividends += netDividends
    }

    if (isYearEnd) {
      let totalValue = 0
      assets.forEach((asset) => {
        totalValue += assetValues[asset.name]
      })
      const row: any = {
        month,
        year: `ปีที่ ${year}`,
        Total: totalValue,
        CashDividends: totalCashDividends,
        MonthlyDividends: monthlyDividends,
        IsRebalanceMonth: isRebalanceMonth,
      }

      assets.forEach((asset) => {
        row[asset.name] = assetValues[asset.name] || 0
      })

      rows.push(row)
    }
  }

  let totalInvested = totalMonths * monthlyBudget

  if (enableFees) {
    totalInvested *= 1 - tradeFeePct / 100
  }

  let finalValue = 0
  assets.forEach((asset) => {
    finalValue += assetValues[asset.name]
  })

  return {
    rows,
    totalInvested,
    finalValue,
    totalCashDividends,
  }
}

function makeCSV(rows) {
  if (!rows?.length) return ""
  const headers = Object.keys(rows[0])
  const lines = [headers.join(",")]
  for (const r of rows) lines.push(headers.map((h) => r[h]).join(","))
  return lines.join("\n")
}

interface Asset {
  id: number
  name: string
  allocPct: number
  low: number
  mid: number
  high: number
}

export default function DCASimulator() {
  const [darkMode, setDarkMode] = useState(false)

  const [viewMode, setViewMode] = useState("single") // "single" or "compare"
  const [portfolios, setPortfolios] = useState([
    {
      id: 1,
      name: "พอร์ตหลัก",
      monthlyBudget: 10000,
      periodMode: "years",
      periodInput: 10,
      enableFees: false,
      enableDividends: false,
      enableRebalancing: false,
      rebalanceFrequency: 12,
      tradeFeePct: 0.5,
      dividendYieldPct: 2.0,
      withholdTaxPct: 10,
      drip: true,
      assets: [
        { id: 1, name: "S&P500", allocPct: 50, low: 10, mid: 10, high: 10 },
        { id: 2, name: "NASDAQ100", allocPct: 30, low: 10, mid: 12.5, high: 15 },
        { id: 3, name: "BOND", allocPct: 20, low: 4, mid: 4, high: 4 },
      ],
    },
  ])
  const [activePortfolioId, setActivePortfolioId] = useState(1)

  // Legacy single portfolio state (for backward compatibility)
  const [monthlyBudget, setMonthlyBudget] = useState(10000)
  const [periodMode, setPeriodMode] = useState("years")
  const [periodInput, setPeriodInput] = useState(10)

  const [enableFees, setEnableFees] = useState(false)
  const [enableDividends, setEnableDividends] = useState(false)
  const [enableRebalancing, setEnableRebalancing] = useState(false)
  const [rebalanceFrequency, setRebalanceFrequency] = useState(12)

  const [tradeFeePct, setTradeFeePct] = useState(0.5)
  const [dividendYieldPct, setDividendYieldPct] = useState(2.0)
  const [withholdTaxPct, setWithholdTaxPct] = useState(10)
  const [drip, setDrip] = useState(true)

  const [assets, setAssets] = useState([
    { id: 1, name: "S&P500", allocPct: 50, low: 10, mid: 10, high: 10 },
    { id: 2, name: "NASDAQ100", allocPct: 30, low: 10, mid: 12.5, high: 15 },
    { id: 3, name: "BOND", allocPct: 20, low: 4, mid: 4, high: 4 },
  ])

  const [shareUrl, setShareUrl] = useState("")
  const [copied, setCopied] = useState(false)

  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false)

  const addPortfolio = () => {
    const newId = Math.max(...portfolios.map((p) => p.id)) + 1
    const newPortfolio = {
      id: newId,
      name: `พอร์ต ${newId}`,
      monthlyBudget: 10000,
      periodMode: "years",
      periodInput: 10,
      enableFees: false,
      enableDividends: false,
      enableRebalancing: false,
      rebalanceFrequency: 12,
      tradeFeePct: 0.5,
      dividendYieldPct: 2.0,
      withholdTaxPct: 10,
      drip: true,
      assets: [
        { id: 1, name: "S&P500", allocPct: 50, low: 10, mid: 10, high: 10 },
        { id: 2, name: "NASDAQ100", allocPct: 30, low: 10, mid: 12.5, high: 15 },
        { id: 3, name: "BOND", allocPct: 20, low: 4, mid: 4, high: 4 },
      ],
    }
    setPortfolios([...portfolios, newPortfolio])
    setActivePortfolioId(newId)
  }

  const removePortfolio = (id) => {
    if (portfolios.length <= 1) return
    const newPortfolios = portfolios.filter((p) => p.id !== id)
    setPortfolios(newPortfolios)
    if (activePortfolioId === id) {
      setActivePortfolioId(newPortfolios[0].id)
    }
  }

  const updatePortfolioField = (id, field, value) => {
    setPortfolios(portfolios.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const updatePortfolioAsset = (portfolioId, assetId, field, value) => {
    setPortfolios(
      portfolios.map((p) =>
        p.id === portfolioId
          ? {
              ...p,
              assets: p.assets.map((a) => (a.id === assetId ? { ...a, [field]: value } : a)),
            }
          : p,
      ),
    )
  }

  const addAssetToPortfolio = (portfolioId) => {
    const portfolio = portfolios.find((p) => p.id === portfolioId)
    const newId = Math.max(...portfolio.assets.map((a) => a.id)) + 1
    const newAsset = { id: newId, name: `Asset ${newId}`, allocPct: 0, low: 8, mid: 10, high: 12 }

    setPortfolios(portfolios.map((p) => (p.id === portfolioId ? { ...p, assets: [...p.assets, newAsset] } : p)))
  }

  const removeAssetFromPortfolio = (portfolioId, assetId) => {
    setPortfolios(
      portfolios.map((p) => (p.id === portfolioId ? { ...p, assets: p.assets.filter((a) => a.id !== assetId) } : p)),
    )
  }

  useEffect(() => {
    if (viewMode === "single" && !isLoadingPortfolio) {
      updatePortfolioField(activePortfolioId, "monthlyBudget", monthlyBudget)
      updatePortfolioField(activePortfolioId, "periodMode", periodMode)
      updatePortfolioField(activePortfolioId, "periodInput", periodInput)
      updatePortfolioField(activePortfolioId, "enableFees", enableFees)
      updatePortfolioField(activePortfolioId, "enableDividends", enableDividends)
      updatePortfolioField(activePortfolioId, "enableRebalancing", enableRebalancing)
      updatePortfolioField(activePortfolioId, "rebalanceFrequency", rebalanceFrequency)
      updatePortfolioField(activePortfolioId, "tradeFeePct", tradeFeePct)
      updatePortfolioField(activePortfolioId, "dividendYieldPct", dividendYieldPct)
      updatePortfolioField(activePortfolioId, "withholdTaxPct", withholdTaxPct)
      updatePortfolioField(activePortfolioId, "drip", drip)
      updatePortfolioField(activePortfolioId, "assets", assets)
    }
  }, [
    viewMode,
    isLoadingPortfolio,
    activePortfolioId,
    monthlyBudget,
    periodMode,
    periodInput,
    enableFees,
    enableDividends,
    enableRebalancing,
    rebalanceFrequency,
    tradeFeePct,
    dividendYieldPct,
    withholdTaxPct,
    drip,
    assets,
  ])

  useEffect(() => {
    if (viewMode === "compare" && !isLoadingPortfolio) {
      updatePortfolioField(activePortfolioId, "monthlyBudget", monthlyBudget)
      updatePortfolioField(activePortfolioId, "periodMode", periodMode)
      updatePortfolioField(activePortfolioId, "periodInput", periodInput)
      updatePortfolioField(activePortfolioId, "enableFees", enableFees)
      updatePortfolioField(activePortfolioId, "enableDividends", enableDividends)
      updatePortfolioField(activePortfolioId, "enableRebalancing", enableRebalancing)
      updatePortfolioField(activePortfolioId, "rebalanceFrequency", rebalanceFrequency)
      updatePortfolioField(activePortfolioId, "tradeFeePct", tradeFeePct)
      updatePortfolioField(activePortfolioId, "dividendYieldPct", dividendYieldPct)
      updatePortfolioField(activePortfolioId, "withholdTaxPct", withholdTaxPct)
      updatePortfolioField(activePortfolioId, "drip", drip)
      updatePortfolioField(activePortfolioId, "assets", assets)
    }
  }, [
    viewMode,
    isLoadingPortfolio,
    activePortfolioId,
    monthlyBudget,
    periodMode,
    periodInput,
    enableFees,
    enableDividends,
    enableRebalancing,
    rebalanceFrequency,
    tradeFeePct,
    dividendYieldPct,
    withholdTaxPct,
    drip,
    assets,
  ])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)

    if (urlParams.has("data")) {
      try {
        const data = JSON.parse(decodeURIComponent(urlParams.get("data")))

        setMonthlyBudget(data.monthlyBudget || 10000)
        setPeriodMode(data.periodMode || "years")
        setPeriodInput(data.periodInput || 10)
        setEnableFees(data.enableFees || false)
        setEnableDividends(data.enableDividends || false)
        setEnableRebalancing(data.enableRebalancing || false)
        setRebalanceFrequency(data.rebalanceFrequency || 12)
        setTradeFeePct(data.tradeFeePct || 0.5)
        setDividendYieldPct(data.dividendYieldPct || 2.0)
        setWithholdTaxPct(data.withholdTaxPct || 10)
        setDrip(data.drip !== undefined ? data.drip : true)

        if (data.assets && Array.isArray(data.assets)) {
          setAssets(data.assets)
        }
      } catch (error) {
        console.error("Error parsing shared URL parameters:", error)
      }
    }
  }, [])

  function generateShareUrl() {
    const data = {
      monthlyBudget,
      periodMode,
      periodInput,
      enableFees,
      enableDividends,
      enableRebalancing,
      rebalanceFrequency,
      tradeFeePct,
      dividendYieldPct,
      withholdTaxPct,
      drip,
      assets,
    }

    const encodedData = encodeURIComponent(JSON.stringify(data))
    const baseUrl = window.location.origin + window.location.pathname
    const url = `${baseUrl}?data=${encodedData}`

    setShareUrl(url)
    return url
  }

  async function copyToClipboard() {
    const url = generateShareUrl()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy to clipboard:", error)
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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

  const runSimulation = () => {
    const low = simulateDCA(
      monthlyBudget,
      periodMode,
      periodInput,
      assets,
      enableFees,
      tradeFeePct,
      enableDividends,
      dividendYieldPct,
      withholdTaxPct,
      drip,
      enableRebalancing,
      rebalanceFrequency,
      "low",
    )
    const mid = simulateDCA(
      monthlyBudget,
      periodMode,
      periodInput,
      assets,
      enableFees,
      tradeFeePct,
      enableDividends,
      dividendYieldPct,
      withholdTaxPct,
      drip,
      enableRebalancing,
      rebalanceFrequency,
      "mid",
    )
    const high = simulateDCA(
      monthlyBudget,
      periodMode,
      periodInput,
      assets,
      enableFees,
      tradeFeePct,
      enableDividends,
      dividendYieldPct,
      withholdTaxPct,
      drip,
      enableRebalancing,
      rebalanceFrequency,
      "high",
    )

    return {
      low,
      mid,
      high,
    }
  }

  const { low, mid, high } = useMemo(runSimulation, [
    monthlyBudget,
    periodMode,
    periodInput,
    assets,
    tradeFeePct,
    dividendYieldPct,
    withholdTaxPct,
    drip,
    enableFees,
    enableDividends,
    enableRebalancing,
    rebalanceFrequency,
  ])

  const scenarios = {
    low: { ...low, totalFinal: low.finalValue },
    mid: { ...mid, totalFinal: mid.finalValue },
    high: { ...high, totalFinal: high.finalValue },
  }

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

  const [selectedScenario, setSelectedScenario] = useState<"low" | "mid" | "high">("mid")

  const results = scenarios

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 transition-colors duration-300">
        <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />

        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              DCA Simulator – Dynamic Assets + Fees & DRIP
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              จำลองการลงทุนแบบ DCA พร้อมค่าธรรมเนียม ปันผล และการทบต้น เห็นกราฟและสรุปผลทันที
            </p>
            <a
              href="https://www.facebook.com/T.Jukkitz/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              แจ้ง Bug หรือขอฟีเจอร์ได้ที่นี่
            </a>
          </div>

          <div className="flex justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-1 shadow-sm border dark:border-slate-700">
              <div className="flex">
                <button
                  onClick={() => setViewMode("single")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === "single"
                      ? "bg-blue-500 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  พอร์ตเดียว
                </button>
                <button
                  onClick={() => setViewMode("compare")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === "compare"
                      ? "bg-blue-500 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  เปรียบเทียบพอร์ต
                </button>
              </div>
            </div>
          </div>

          <Alert className="rounded-2xl border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">หมายเหตุสำคัญ</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              ผลลัพธ์นี้เป็นเพียงการจำลองด้วยอัตราผลตอบแทนเฉลี่ยคงที่ ไม่ได้สะท้อนความผันผวนจริงของตลาด ใช้เพื่อการศึกษาเท่านั้น
              ไม่ควรใช้แทนคำแนะนำด้านการลงทุนจริง
            </AlertDescription>
          </Alert>

          {viewMode === "single" ? (
            <>
              {/* Portfolio Selector */}
              <Card className="rounded-2xl shadow-lg border-0 bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Label className="font-semibold text-slate-700 dark:text-slate-300">เลือกพอร์ต:</Label>
                      <select
                        className="border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600 min-w-[150px]"
                        value={activePortfolioId}
                        onChange={(e) => setActivePortfolioId(Number(e.target.value))}
                      >
                        {portfolios.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        value={portfolios.find((p) => p.id === activePortfolioId)?.name || ""}
                        onChange={(e) => updatePortfolioField(activePortfolioId, "name", e.target.value)}
                        className="w-32"
                        placeholder="ชื่อพอร์ต"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addPortfolio} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1" /> เพิ่มพอร์ต
                      </Button>
                      {portfolios.length > 1 && (
                        <Button
                          onClick={() => removePortfolio(activePortfolioId)}
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> ลบพอร์ต
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Existing single portfolio configuration */}
              <Card className="rounded-2xl shadow-lg border-0 bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
                <CardContent className="p-6">
                  <div className="grid lg:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="font-semibold text-slate-700 dark:text-slate-300">งบลงทุนต่อเดือน (THB)</Label>
                        <Input
                          type="number"
                          value={monthlyBudget}
                          onChange={(e) => setMonthlyBudget(Math.max(0, Number(e.target.value || 0)))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="font-semibold text-slate-700 dark:text-slate-300">ระยะเวลา</Label>
                        <div className="flex gap-2 items-center mt-1">
                          <Input
                            type="number"
                            value={periodInput}
                            onChange={(e) => setPeriodInput(Math.max(1, Number(e.target.value || 1)))}
                            className="flex-1"
                          />
                          <select
                            className="border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600 min-w-[80px]"
                            value={periodMode}
                            onChange={(e) => setPeriodMode(e.target.value)}
                          >
                            <option value="months">เดือน</option>
                            <option value="years">ปี</option>
                          </select>
                        </div>
                      </div>

                      <div className="border-t pt-4 space-y-4 dark:border-slate-700">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300">ค่าธรรมเนียมและปันผล</h3>

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div>
                            <Label className="font-medium text-slate-700 dark:text-slate-300">เปิดใช้ค่าธรรมเนียม</Label>
                            <p className="text-xs text-muted-foreground">คิดค่าธรรมเนียมการซื้อขาย</p>
                          </div>
                          <Switch checked={enableFees} onCheckedChange={setEnableFees} />
                        </div>

                        {enableFees && (
                          <div>
                            <Label className="font-medium text-slate-600 dark:text-slate-400">
                              ค่าธรรมเนียมซื้อขาย (%)
                            </Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={tradeFeePct}
                              onChange={(e) => setTradeFeePct(Math.max(0, Number(e.target.value || 0)))}
                              className="mt-1"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div>
                            <Label className="font-medium text-slate-700 dark:text-slate-300">เปิดใช้ปันผล</Label>
                            <p className="text-xs text-muted-foreground">คำนวณปันผลและการทบต้น</p>
                          </div>
                          <Switch checked={enableDividends} onCheckedChange={setEnableDividends} />
                        </div>

                        {enableDividends && (
                          <>
                            <div>
                              <Label className="font-medium text-slate-600 dark:text-slate-400">อัตราปันผลต่อปี (%)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={dividendYieldPct}
                                onChange={(e) => setDividendYieldPct(Math.max(0, Number(e.target.value || 0)))}
                                className="mt-1"
                              />
                            </div>

                            <div>
                              <Label className="font-medium text-slate-600 dark:text-slate-400">ภาษีหัก ณ ที่จ่าย (%)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={withholdTaxPct}
                                onChange={(e) => setWithholdTaxPct(Math.max(0, Number(e.target.value || 0)))}
                                className="mt-1"
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label className="font-medium text-slate-600 dark:text-slate-400">DRIP (ปันผลทบต้น)</Label>
                              <Switch checked={drip} onCheckedChange={setDrip} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {drip ? "ปันผลจะถูกนำไปลงทุนต่อโดยอัตโนมัติ" : "ปันผลจะเก็บเป็นเงินสดแยกต่างหาก"}
                            </p>
                          </>
                        )}

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div>
                            <Label className="font-medium text-slate-700 dark:text-slate-300">เปิดใช้ Rebalancing</Label>
                            <p className="text-xs text-muted-foreground">ปรับพอร์ตอัตโนมัติตามช่วงเวลาที่กำหนด</p>
                          </div>
                          <Switch checked={enableRebalancing} onCheckedChange={setEnableRebalancing} />
                        </div>

                        {enableRebalancing && (
                          <div>
                            <Label className="font-medium text-slate-600 dark:text-slate-400">
                              ความถี่ Rebalancing (เดือน)
                            </Label>
                            <Input
                              type="number"
                              min="1"
                              value={rebalanceFrequency}
                              onChange={(e) => setRebalanceFrequency(Math.max(1, Number(e.target.value || 1)))}
                              className="mt-1"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              ทุก ๆ {rebalanceFrequency} เดือน จะปรับสัดส่วนกลับไปตามที่ตั้งไว้
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <Label className="font-semibold text-slate-700 dark:text-slate-300">Assets Portfolio</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            การจัดสรรรวม:{" "}
                            <span
                              className={`font-medium ${totalAllocation === 100 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}
                            >
                              {totalAllocation.toFixed(1)}%
                            </span>
                            {totalAllocation !== 100 && (
                              <span className="text-amber-600 dark:text-amber-400 ml-1">(ควรเป็น 100%)</span>
                            )}
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
                            className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm dark:border-slate-700"
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
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
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

              {results && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">เปรียบเทียบ Scenarios</h2>
                        <Button onClick={copyToClipboard} variant="outline" className="gap-2 bg-transparent">
                          {copied ? (
                            <>
                              <Check className="h-4 w-4 text-green-600" />
                              คัดลอกแล้ว!
                            </>
                          ) : (
                            <>
                              <Share2 className="h-4 w-4" />
                              แชร์ผลลัพธ์
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="flex justify-center mb-6">
                        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                          {["low", "mid", "high"].map((scenario) => (
                            <button
                              key={scenario}
                              onClick={() => setSelectedScenario(scenario as "low" | "mid" | "high")}
                              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                selectedScenario === scenario
                                  ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                              }`}
                            >
                              {scenario.charAt(0).toUpperCase() + scenario.slice(1)} Scenario
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-6">
                        {(() => {
                          const result = scenarios[selectedScenario]
                          const profit = result.totalFinal - result.totalInvested
                          const roi = ((result.totalFinal - result.totalInvested) / result.totalInvested) * 100
                          const isProfit = profit > 0

                          return (
                            <div className="space-y-6">
                              {/* Summary Stats */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                <div className="text-center">
                                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    รวมทั้งหมด
                                  </Label>
                                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1">
                                    ฿{toTHB(result.totalFinal)}
                                  </p>
                                </div>
                                <div className="text-center">
                                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    กำไร/ขาดทุน
                                  </Label>
                                  <p
                                    className={`text-2xl font-bold mt-1 ${isProfit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                                  >
                                    ฿{toTHB(profit)}
                                  </p>
                                </div>
                                <div className="text-center">
                                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    ผลตอบแทน (ROI)
                                  </Label>
                                  <p
                                    className={`text-2xl font-bold mt-1 ${isProfit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                                  >
                                    {toPercent(roi)}
                                  </p>
                                </div>
                              </div>

                              {/* Chart */}
                              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 text-center">
                                  การเติบโตของพอร์ตโฟลิโอ -{" "}
                                  {selectedScenario.charAt(0).toUpperCase() + selectedScenario.slice(1)} Scenario
                                </h3>
                                <ResponsiveContainer width="100%" height={400}>
                                  <LineChart data={result.rows} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                    <XAxis
                                      dataKey="year"
                                      tick={{ fontSize: 12 }}
                                      tickLine={{ stroke: "#64748b" }}
                                      axisLine={{ stroke: "#64748b" }}
                                    />
                                    <YAxis
                                      tickFormatter={(value) => `฿${toTHB(value)}`}
                                      tick={{ fontSize: 12 }}
                                      tickLine={{ stroke: "#64748b" }}
                                      axisLine={{ stroke: "#64748b" }}
                                    />
                                    <Tooltip
                                      formatter={(value: number, name: string) => [`฿${toTHB(value)}`, name]}
                                      labelFormatter={(label) => `${label}`}
                                      contentStyle={{
                                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        fontSize: "14px",
                                      }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: "20px" }} />
                                    {result.rows[0] &&
                                      Object.keys(result.rows[0])
                                        .filter(
                                          (k) =>
                                            k !== "month" &&
                                            k !== "year" &&
                                            k !== "Total" &&
                                            k !== "CashDividends" &&
                                            k !== "MonthlyDividends" &&
                                            k !== "IsRebalanceMonth",
                                        )
                                        .map((assetName, idx) => (
                                          <Line
                                            key={idx}
                                            type="monotone"
                                            dataKey={assetName}
                                            stroke={colorForIndex(idx)}
                                            strokeWidth={3}
                                            dot={{ fill: colorForIndex(idx), strokeWidth: 2, r: 4 }}
                                            activeDot={{ r: 6, stroke: colorForIndex(idx), strokeWidth: 2 }}
                                          />
                                        ))}
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>

                              {/* Download Button */}
                              <div className="flex justify-center">
                                <Button
                                  onClick={() => downloadCSV(selectedScenario)}
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                >
                                  <Download className="h-4 w-4" />
                                  ดาวน์โหลด CSV ({selectedScenario.toUpperCase()})
                                </Button>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              {/* Portfolio Management Header */}
              <Card className="rounded-2xl shadow-lg border-0 bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">จัดการพอร์ตเพื่อเปรียบเทียบ</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        สร้างและแก้ไขพอร์ตต่าง ๆ เพื่อเปรียบเทียบผลลัพธ์การลงทุน (สูงสุด 3 พอร์ต)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={addPortfolio}
                        size="sm"
                        disabled={portfolios.length >= 3}
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        <Plus className="h-4 w-4 mr-1" /> เพิ่มพอร์ต ({portfolios.length}/3)
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Portfolio Configuration Cards */}
              <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {portfolios.map((portfolio, index) => (
                  <Card
                    key={portfolio.id}
                    className="rounded-2xl shadow-lg border-0 bg-white/80 backdrop-blur-sm dark:bg-slate-900/80"
                  >
                    <CardContent className="p-6">
                      <div className="flex justify-between items-center mb-4">
                        <Input
                          value={portfolio.name}
                          onChange={(e) => updatePortfolioField(portfolio.id, "name", e.target.value)}
                          className="text-lg font-bold bg-transparent border-none p-0 focus:ring-0"
                          placeholder="ชื่อพอร์ต"
                        />
                        {portfolios.length > 1 && (
                          <Button
                            onClick={() => removePortfolio(portfolio.id)}
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-4">
                        {/* Basic Settings */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">งบต่อเดือน</Label>
                            <Input
                              type="number"
                              value={portfolio.monthlyBudget}
                              onChange={(e) =>
                                updatePortfolioField(
                                  portfolio.id,
                                  "monthlyBudget",
                                  Math.max(0, Number(e.target.value || 0)),
                                )
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">ระยะเวลา</Label>
                            <div className="flex gap-1 mt-1">
                              <Input
                                type="number"
                                value={portfolio.periodInput}
                                onChange={(e) =>
                                  updatePortfolioField(
                                    portfolio.id,
                                    "periodInput",
                                    Math.max(1, Number(e.target.value || 1)),
                                  )
                                }
                                className="flex-1"
                              />
                              <select
                                className="border rounded-lg px-2 py-1 bg-white dark:bg-slate-800 dark:border-slate-600 text-xs"
                                value={portfolio.periodMode}
                                onChange={(e) => updatePortfolioField(portfolio.id, "periodMode", e.target.value)}
                              >
                                <option value="months">เดือน</option>
                                <option value="years">ปี</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Feature Toggles */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <Label className="text-xs font-medium">ค่าธรรมเนียม</Label>
                            <Switch
                              checked={portfolio.enableFees}
                              onCheckedChange={(checked) => updatePortfolioField(portfolio.id, "enableFees", checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <Label className="text-xs font-medium">ปันผล</Label>
                            <Switch
                              checked={portfolio.enableDividends}
                              onCheckedChange={(checked) =>
                                updatePortfolioField(portfolio.id, "enableDividends", checked)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <Label className="text-xs font-medium">Rebalancing</Label>
                            <Switch
                              checked={portfolio.enableRebalancing}
                              onCheckedChange={(checked) =>
                                updatePortfolioField(portfolio.id, "enableRebalancing", checked)
                              }
                            />
                          </div>
                        </div>

                        {/* Assets Summary */}
                        <div>
                          <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">สินทรัพย์</Label>
                          <div className="mt-2 space-y-1">
                            {portfolio.assets.map((asset, idx) => (
                              <div key={asset.id} className="flex justify-between items-center text-xs">
                                <span className="text-slate-700 dark:text-slate-300">{asset.name}</span>
                                <span className="font-medium">{asset.allocPct}%</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-1 mt-2">
                            <Button
                              onClick={() => addAssetToPortfolio(portfolio.id)}
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs"
                            >
                              <Plus className="h-3 w-3 mr-1" /> เพิ่ม
                            </Button>
                            <Button
                              onClick={() => {
                                const sum = portfolio.assets.reduce((s, a) => s + (Number(a.allocPct) || 0), 0)
                                if (sum === 0) return
                                const normalizedAssets = portfolio.assets.map((a) => ({
                                  ...a,
                                  allocPct: Number((((Number(a.allocPct) || 0) / sum) * 100).toFixed(2)),
                                }))
                                updatePortfolioField(portfolio.id, "assets", normalizedAssets)
                              }}
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs"
                            >
                              100%
                            </Button>
                          </div>
                        </div>

                        {/* Detailed Asset Configuration (Expandable) */}
                        <details className="group">
                          <summary className="cursor-pointer text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                            แก้ไขสินทรัพย์แบบละเอียด
                          </summary>
                          <div className="mt-3 space-y-2">
                            {portfolio.assets.map((asset) => (
                              <div key={asset.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2">
                                <div className="flex justify-between items-center">
                                  <Input
                                    value={asset.name}
                                    onChange={(e) =>
                                      updatePortfolioAsset(portfolio.id, asset.id, "name", e.target.value)
                                    }
                                    className="text-xs font-medium bg-transparent border-none p-0 focus:ring-0"
                                  />
                                  <Button
                                    onClick={() => removeAssetFromPortfolio(portfolio.id, asset.id)}
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-700 p-1"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">จัดสรร</Label>
                                    <Input
                                      type="number"
                                      value={asset.allocPct}
                                      onChange={(e) =>
                                        updatePortfolioAsset(portfolio.id, asset.id, "allocPct", e.target.value)
                                      }
                                      className="text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">ต่ำ</Label>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={asset.low}
                                      onChange={(e) =>
                                        updatePortfolioAsset(portfolio.id, asset.id, "low", e.target.value)
                                      }
                                      className="text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">กลาง</Label>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={asset.mid}
                                      onChange={(e) =>
                                        updatePortfolioAsset(portfolio.id, asset.id, "mid", e.target.value)
                                      }
                                      className="text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">สูง</Label>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={asset.high}
                                      onChange={(e) =>
                                        updatePortfolioAsset(portfolio.id, asset.id, "high", e.target.value)
                                      }
                                      className="text-xs"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {portfolios.length > 0 && (
                <Card className="rounded-2xl shadow-lg border-0 bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">เปรียบเทียบผลลัพธ์</h2>
                      <div className="text-sm text-muted-foreground">เปรียบเทียบ {portfolios.length} พอร์ต</div>
                    </div>

                    {/* Comparison Table */}
                    <div className="space-y-6">
                      {["low", "mid", "high"].map((scenario) => (
                        <div key={scenario} className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 border-b pb-2 dark:border-slate-600">
                            {scenario.charAt(0).toUpperCase() + scenario.slice(1)} Scenario
                          </h3>

                          {/* Results Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="border-b dark:border-slate-600">
                                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">พอร์ต</th>
                                  <th className="text-right p-3 font-medium text-slate-600 dark:text-slate-400">
                                    งบต่อเดือน
                                  </th>
                                  <th className="text-right p-3 font-medium text-slate-600 dark:text-slate-400">
                                    ลงทุนรวม
                                  </th>
                                  <th className="text-right p-3 font-medium text-slate-600 dark:text-slate-400">
                                    มูลค่าสุดท้าย
                                  </th>
                                  <th className="text-right p-3 font-medium text-slate-600 dark:text-slate-400">
                                    กำไร/ขาดทุน
                                  </th>
                                  <th className="text-right p-3 font-medium text-slate-600 dark:text-slate-400">
                                    ROI (%)
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {portfolios.map((portfolio) => {
                                  const effectiveMonths =
                                    portfolio.periodMode === "years"
                                      ? portfolio.periodInput * 12
                                      : portfolio.periodInput
                                  const result = simulateDCA(
                                    portfolio.monthlyBudget,
                                    portfolio.periodMode,
                                    portfolio.periodInput,
                                    portfolio.assets,
                                    portfolio.enableFees,
                                    portfolio.tradeFeePct,
                                    portfolio.enableDividends,
                                    portfolio.dividendYieldPct,
                                    portfolio.withholdTaxPct,
                                    portfolio.drip,
                                    portfolio.enableRebalancing,
                                    portfolio.rebalanceFrequency,
                                    scenario as "low" | "mid" | "high",
                                  )
                                  const profit = result.finalValue - result.totalInvested
                                  const roi = ((result.finalValue - result.totalInvested) / result.totalInvested) * 100
                                  const isProfit = profit > 0

                                  return (
                                    <tr
                                      key={portfolio.id}
                                      className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                    >
                                      <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                                        {portfolio.name}
                                      </td>
                                      <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                                        {toTHB(portfolio.monthlyBudget)}
                                      </td>
                                      <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                                        {toTHB(result.totalInvested)}
                                      </td>
                                      <td className="p-3 text-right font-medium text-slate-800 dark:text-slate-200">
                                        {toTHB(result.finalValue)}
                                      </td>
                                      <td
                                        className={`p-3 text-right font-medium ${isProfit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                                      >
                                        {toTHB(profit)}
                                      </td>
                                      <td
                                        className={`p-3 text-right font-medium ${isProfit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                                      >
                                        {toPercent(roi)}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Best/Worst Performance Highlights */}
                          <div className="grid md:grid-cols-2 gap-4 mt-4">
                            {(() => {
                              const results = portfolios.map((portfolio) => {
                                const effectiveMonths =
                                  portfolio.periodMode === "years" ? portfolio.periodInput * 12 : portfolio.periodInput
                                const result = simulateDCA(
                                  portfolio.monthlyBudget,
                                  portfolio.periodMode,
                                  portfolio.periodInput,
                                  portfolio.assets,
                                  portfolio.enableFees,
                                  portfolio.tradeFeePct,
                                  portfolio.enableDividends,
                                  portfolio.dividendYieldPct,
                                  portfolio.withholdTaxPct,
                                  portfolio.drip,
                                  portfolio.enableRebalancing,
                                  portfolio.rebalanceFrequency,
                                  scenario as "low" | "mid" | "high",
                                )
                                const roi = ((result.finalValue - result.totalInvested) / result.totalInvested) * 100
                                return { portfolio, result, roi }
                              })

                              const bestPerformer = results.reduce((best, current) =>
                                current.roi > best.roi ? current : best,
                              )
                              const worstPerformer = results.reduce((worst, current) =>
                                current.roi < worst.roi ? current : worst,
                              )

                              return (
                                <>
                                  <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <h4 className="font-medium text-green-800 dark:text-green-200 mb-1">
                                      ผลตอบแทนสูงสุด
                                    </h4>
                                    <p className="text-sm text-green-700 dark:text-green-300">
                                      {bestPerformer.portfolio.name}:{" "}
                                      <span className="font-medium">{toPercent(bestPerformer.roi)}</span>
                                    </p>
                                  </div>
                                  <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                                    <h4 className="font-medium text-red-800 dark:text-red-200 mb-1">ผลตอบแทนต่ำสุด</h4>
                                    <p className="text-sm text-red-700 dark:text-red-300">
                                      {worstPerformer.portfolio.name}:{" "}
                                      <span className="font-medium">{toPercent(worstPerformer.roi)}</span>
                                    </p>
                                  </div>
                                </>
                              )
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
