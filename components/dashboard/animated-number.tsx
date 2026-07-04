"use client"

import { useEffect, useRef, useState } from "react"

type Props = {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
}

export function AnimatedNumber({ value, duration = 1400, decimals = 2, prefix = "", suffix = "" }: Props) {
  const [display, setDisplay] = useState(0)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(value * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  const formatted = display.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
