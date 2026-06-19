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

const fallbackBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

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
    await page.goto(`${baseUrl}/audit/${auditId}?pdf=true&token=${token}`, {
      waitUntil: 'networkidle0',
      timeout: 45000,
    })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '40px', bottom: '40px', left: '40px', right: '40px' },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
