import type { ServerWebSocket } from 'bun'
import type { ScanEvent } from '../shared/events'

const MAX_SOCKETS = 16

/** Tracks open WebSocket connections and sends each scan event to all of them. */
export class ScanHub {
  private readonly sockets = new Set<ServerWebSocket<unknown>>()

  get full(): boolean {
    return this.sockets.size >= MAX_SOCKETS
  }

  add(socket: ServerWebSocket<unknown>): void {
    this.sockets.add(socket)
  }

  remove(socket: ServerWebSocket<unknown>): void {
    this.sockets.delete(socket)
  }

  publish(event: ScanEvent): void {
    if (this.sockets.size === 0) return
    const payload = JSON.stringify(event)
    for (const socket of this.sockets) socket.send(payload)
  }

  stop(): void {
    for (const socket of this.sockets) socket.close(1001, 'Server stopping')
    this.sockets.clear()
  }
}
