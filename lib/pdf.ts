/**
 * Audit PDF generation.
 *
 * On Vercel/serverless, full `puppeteer` (which bundles a desktop Chromium)
 * exceeds the function bundle size and fails to launch - the classic cause of
 * the PDF route silently breaking. We use `puppeteer-core` + `@sparticuz/chromium`
 * (a Lambda-sized Chromium) in production, and fall back to a locally-installed
 * Chrome/Chromium in development.
 */
import puppeteer from 'puppeteer-core'
import { signToken } from './tokens'
import { footerText, scoreFooterText } from './pdf-footer'

const fallbackBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function getBrowser() {
  const isServerless = !!process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.VERCEL === '1'

  if (isServerless) {
    const chromium = (await import('@sparticuz/chromium')).default
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  // Local dev: use an installed Chrome. Override with CHROME_PATH if needed.
  const executablePath =
    process.env.CHROME_PATH ||
    (process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : '/usr/bin/google-chrome')

  return puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
}

export async function generateAuditPDF(auditId: string, origin?: string): Promise<Buffer> {
  // Prefer the request origin (always correct) over NEXT_PUBLIC_BASE_URL, which
  // is easy to leave unset on Vercel -> would point Chromium at localhost.
  const baseUrl = origin || fallbackBaseUrl
  const browser = await getBrowser()

  try {
    const page = await browser.newPage()
    // The audit page is access-gated; the renderer authenticates with a token.
    const token = signToken('audit', auditId)
    const response = await page.goto(`${baseUrl}/audit/${auditId}?pdf=true&token=${token}`, {
      waitUntil: 'networkidle0',
      timeout: 45000,
    })
    if (!response || !response.ok()) {
      throw new Error(`Client report render failed with HTTP ${response?.status() ?? 'unknown'}`)
    }

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="box-sizing:border-box;width:100%;padding:0 40px;font-family:Arial,sans-serif;font-size:7px;color:#777;text-align:center;">${escapeHtml(footerText())}</div>`,
      margin: { top: '40px', bottom: '52px', left: '40px', right: '40px' },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

export async function generateScorePDF(scoreId: string, origin?: string): Promise<Buffer> {
  const baseUrl = origin || fallbackBaseUrl
  const browser = await getBrowser()

  try {
    const page = await browser.newPage()
    const token = signToken('score', scoreId)
    const response = await page.goto(
      `${baseUrl}/score/${scoreId}?pdf=true&token=${encodeURIComponent(token)}`,
      {
        waitUntil: 'networkidle0',
        timeout: 45000,
      }
    )
    if (!response || !response.ok()) {
      throw new Error(`Score PDF render failed with HTTP ${response?.status() ?? 'unknown'}`)
    }

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="box-sizing:border-box;width:100%;padding:0 40px;font-family:Arial,sans-serif;font-size:7px;color:#77685d;text-align:center;">${escapeHtml(scoreFooterText())}</div>`,
      margin: { top: '34px', bottom: '48px', left: '38px', right: '38px' },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
