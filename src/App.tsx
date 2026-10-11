import { useEffect, useRef } from 'react'
import { startGame } from './game/input'

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => (ref.current ? startGame(ref.current) : undefined), [])
  return <canvas ref={ref} id="game" width={720} height={1280} />
}
