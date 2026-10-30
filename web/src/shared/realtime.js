/**
 * 实时通道抽象。
 *
 * 现在用轮询（后端已有 SSE，但轮询最简单可靠），
 * 将来换 WebSocket 只改这个文件，业务组件不用动。
 *
 * 为什么先抽象再实现：
 *   组件里直接写 setInterval，将来换 WS 要改遍所有组件。
 *   先定好 subscribe 接口，换实现就是换一个类。
 */

export class PollingChannel {
  /**
   * @param {Function} loader  返回 Promise<Array> 的函数
   * @param {Object}   opts
   */
  constructor(loader, opts = {}) {
    this.loader = loader
    this.interval = opts.interval || 3000
    this.onData = opts.onData || (() => {})
    this.onError = opts.onError || (() => {})
    this.timer = null
    this.stopped = true
    this.lastSig = ''
  }

  start() {
    if (!this.stopped) return
    this.stopped = false
    this._tick()
    this.timer = setInterval(() => this._tick(), this.interval)
  }

  stop() {
    this.stopped = true
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  async _tick() {
    if (this.stopped) return
    try {
      const data = await this.loader()
      // 数据没变就不通知，避免无谓的重新渲染
      const sig = JSON.stringify(data)
      if (sig !== this.lastSig) {
        this.lastSig = sig
        this.onData(data)
      }
    } catch (e) {
      if (e && e.status === 401) { this.stop(); return }
      this.onError(e)
    }
  }
}

export function createChannel(loader, opts) {
  return new PollingChannel(loader, opts)
}
