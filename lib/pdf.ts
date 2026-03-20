import puppeteer from 'puppeteer'

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

export async function generateAuditPDF(auditId: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.goto(`${baseUrl}/audit/${auditId}?pdf=true`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
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
