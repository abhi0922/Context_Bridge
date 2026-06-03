import { UserConfirmation } from '../../types'

export class ConfirmationDialog {
  private dialog: HTMLDivElement | null = null

  show(domain: string, confidence: number): Promise<UserConfirmation> {
    return new Promise(resolve => {
      this.createDialog(domain, confidence, resolve)
    })
  }

  private createDialog(domain: string, confidence: number, resolve: (value: UserConfirmation) => void): void {
    this.dialog = document.createElement('div')
    this.dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `

    const panel = document.createElement('div')
    panel.style.cssText = `
      background: #1a1a2e;
      color: #e0e0e0;
      border-radius: 12px;
      padding: 28px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      border: 1px solid #2a2a4e;
    `

    const confidencePercent = Math.round(confidence * 100)

    panel.innerHTML = `
      <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #ffffff;">
        Context Bridge
      </h2>
      <p style="margin: 0 0 4px 0; font-size: 14px; color: #b0b0cc;">
        This appears to be an AI conversation interface.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 12px; color: #8888aa;">
        Domain: <strong style="color: #aaaacc;">${domain}</strong>
        &middot; Confidence: <strong style="color: #aaaacc;">${confidencePercent}%</strong>
      </p>
      <p style="margin: 0 0 20px 0; font-size: 12px; color: #8888aa;">
        Would you like to enable Context Migration on this site?
      </p>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="cb-allow-once" style="
          background: #4a6cf7;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          flex: 1;
          min-width: 100px;
        ">Allow Once</button>
        <button id="cb-allow-always" style="
          background: #2a8a5e;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          flex: 1;
          min-width: 100px;
        ">Always Allow</button>
        <button id="cb-deny" style="
          background: #6c6c8a;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          flex: 1;
          min-width: 100px;
        ">Deny</button>
      </div>
    `

    this.dialog.appendChild(panel)
    document.body.appendChild(this.dialog)

    const cleanup = () => {
      if (this.dialog && this.dialog.parentNode) {
        this.dialog.parentNode.removeChild(this.dialog)
      }
      this.dialog = null
    }

    panel.querySelector('#cb-allow-once')?.addEventListener('click', () => {
      cleanup()
      resolve('allow_once')
    })

    panel.querySelector('#cb-allow-always')?.addEventListener('click', () => {
      cleanup()
      resolve('allow_always')
    })

    panel.querySelector('#cb-deny')?.addEventListener('click', () => {
      cleanup()
      resolve('deny')
    })
  }
}
